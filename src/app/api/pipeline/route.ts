import { NextResponse } from "next/server";

import { DatabaseService } from "@/lib/server-db";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";

const deletionRoles = new Set(["country_admin", "super_admin"]);
const pipelineEditorRoles = new Set(["account_manager", "hod", "country_admin", "super_admin"]);
const pipelineColumns = [
  "new",
  "opportunity",
  "in-progress",
  "submitted",
  "won",
  "contract-signing",
  "in-delivery",
  "delivered",
  "lost",
  "cancelled",
] as const;

type JsonObject = Record<string, unknown>;

interface PipelineRecord {
  id: string;
  country: string;
  owner_email: string | null;
  payload: JsonObject;
  updated_at: string;
}

function textUpdate(value: unknown, maximum: number, required = false) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (required && !normalized) throw new Error("The tender title cannot be empty.");
  if (normalized.length > maximum) throw new Error("One of the tender fields is too long.");
  return normalized;
}

function moneyUpdate(value: unknown, label: string) {
  if (value === undefined) return undefined;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000_000_000) {
    throw new Error(`${label} must be a valid non-negative USD amount.`);
  }
  return amount;
}

function permittedTaskUpdates(input: unknown): JsonObject {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Tender updates are required.");
  const source = input as JsonObject;
  const updates: JsonObject = {};

  const pipelineValue = moneyUpdate(source.pipelineValue, "Pipeline value");
  const amountAwarded = moneyUpdate(source.amountAwarded, "Amount awarded");
  const actualCost = moneyUpdate(source.actualCost, "Execution cost");
  if (pipelineValue !== undefined) updates.pipelineValue = pipelineValue;
  if (amountAwarded !== undefined) updates.amountAwarded = amountAwarded;
  if (actualCost !== undefined) updates.actualCost = actualCost;

  const strings = [
    ["title", 500, true],
    ["description", 5_000, false],
    ["lessonsLearned", 5_000, false],
    ["deliveryStatusNotes", 5_000, false],
    ["winLossReason", 2_000, false],
    ["contractRef", 500, false],
    ["leadPartner", 500, false],
    ["customNotes", 5_000, false],
  ] as const;
  for (const [key, maximum, required] of strings) {
    const value = textUpdate(source[key], maximum, required);
    if (value !== undefined) updates[key] = value;
  }

  for (const key of ["progress", "satisfactionScore"] as const) {
    if (source[key] === undefined) continue;
    const value = Number(source[key]);
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`${key} must be between 0 and 100.`);
    updates[key] = Math.round(value);
  }

  return updates;
}

function findTask(record: PipelineRecord, taskId: string) {
  const board = record.payload.board;
  if (!board || typeof board !== "object" || Array.isArray(board)) return null;
  for (const column of pipelineColumns) {
    const tasks = (board as JsonObject)[column];
    if (!Array.isArray(tasks)) continue;
    const index = tasks.findIndex(
      (task) => task && typeof task === "object" && !Array.isArray(task) && (task as JsonObject).id === taskId,
    );
    if (index !== -1) return { column, index, tasks: tasks as JsonObject[], board: board as JsonObject };
  }
  return null;
}

function pipelineTaskIds(rawBoard: unknown) {
  const ids = new Set<string>();
  if (!rawBoard || typeof rawBoard !== "object" || Array.isArray(rawBoard)) return ids;
  for (const tasks of Object.values(rawBoard)) {
    if (!Array.isArray(tasks)) continue;
    for (const task of tasks) {
      if (task && typeof task === "object" && "id" in task && typeof task.id === "string" && task.id) {
        ids.add(task.id);
      }
    }
  }
  return ids;
}

export async function GET(req: Request) {
  try {
    const { client, profile } = await requireUser();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ success: false, error: "Email query param required" }, { status: 400 });
    }

    const ownEmail = String(profile.email).toLowerCase();
    const canOversee = ["hod", "country_admin", "super_admin"].includes(profile.role);
    if (!canOversee && email.trim().toLowerCase() !== ownEmail) {
      return NextResponse.json({ success: false, error: "You can only view your own pipeline." }, { status: 403 });
    }

    // Country Admin jurisdiction check on individual AM queries
    if (
      profile.role === "country_admin" &&
      profile.country !== "ALL" &&
      !["all", "combined"].includes(email.trim().toLowerCase())
    ) {
      const { data: targetProfile } = await client
        .from("profiles")
        .select("country")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (targetProfile && targetProfile.country !== profile.country && targetProfile.country !== "ALL") {
        return NextResponse.json(
          { success: false, error: `You can only view pipelines in your assigned country (${profile.country}).` },
          { status: 403 },
        );
      }
    }

    const board = await DatabaseService.getUserPipelineBoard(email);

    // Prune cross-country tasks for country administrators and country-bound users
    let sanitizedBoard = board;
    if (
      profile.role === "country_admin" &&
      profile.country &&
      profile.country !== "ALL" &&
      board &&
      typeof board === "object"
    ) {
      sanitizedBoard = sanitizeBoardForCountry(board, profile.country);
    }

    return NextResponse.json({
      success: true,
      source: "database",
      data: sanitizedBoard,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to read pipeline board from database" },
      { status: 500 },
    );
  }
}

function sanitizeBoardForCountry(rawBoard: any, country: string) {
  if (!rawBoard || typeof rawBoard !== "object") return rawBoard;
  const sanitized: Record<string, any[]> = {};
  for (const [column, tasks] of Object.entries(rawBoard)) {
    if (!Array.isArray(tasks)) {
      sanitized[column] = [];
      continue;
    }
    sanitized[column] = tasks.filter((task: any) => {
      if (!task) return false;
      if (task.countryCode && task.countryCode === country) return true;
      if (task.countryCode && task.countryCode !== country) return false;

      const ref = String(task.refNo || task.id || "").toUpperCase();
      const entity = String(task.entity || "").toLowerCase();
      const desc = String(task.description || "").toLowerCase();

      if (country === "ZW") {
        if (
          ref.startsWith("ZPPA") ||
          entity.includes("zambia") ||
          entity.includes("zesco") ||
          entity.includes("rda") ||
          entity.includes("lusaka") ||
          entity.includes("lwsc") ||
          desc.includes("zppa")
        ) {
          return false;
        }
        return true;
      }

      if (country === "ZM") {
        if (
          ref.startsWith("PRAZ") ||
          entity.includes("zim") ||
          entity.includes("zetdc") ||
          entity.includes("harare") ||
          entity.includes("potraz") ||
          entity.includes("natpharm") ||
          entity.includes("mofed") ||
          desc.includes("praz")
        ) {
          return false;
        }
        return true;
      }

      return true;
    });
  }
  return sanitized;
}

export async function PATCH(req: Request) {
  try {
    const { profile } = await requireUser();
    if (!pipelineEditorRoles.has(profile.role)) {
      return NextResponse.json({ success: false, error: "Pipeline editing access is required." }, { status: 403 });
    }

    const body = await req.json();
    const taskId = typeof body?.taskId === "string" ? body.taskId.trim() : "";
    const pipelineOwnerEmail =
      typeof body?.pipelineOwnerEmail === "string" ? body.pipelineOwnerEmail.trim().toLowerCase() : "";
    if (!taskId || taskId.length > 500) {
      return NextResponse.json({ success: false, error: "A valid pipeline tender is required." }, { status: 400 });
    }
    const updates = permittedTaskUpdates(body?.updates);
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: "No supported tender changes were supplied." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    let query = admin.from("app_records").select("id,country,owner_email,payload,updated_at").eq("kind", "pipeline");
    const actorEmail = String(profile.email).trim().toLowerCase();
    if (profile.role === "account_manager") {
      query = query.eq("owner_email", actorEmail);
    } else {
      if (pipelineOwnerEmail) query = query.eq("owner_email", pipelineOwnerEmail);
      if (profile.role !== "super_admin" && profile.country && profile.country !== "ALL") {
        query = query.eq("country", profile.country);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    const matches = ((data ?? []) as PipelineRecord[])
      .map((record) => ({ record, location: findTask(record, taskId) }))
      .filter((candidate) => candidate.location !== null);
    if (matches.length === 0) {
      return NextResponse.json(
        { success: false, error: "This tender was not found in a pipeline you are allowed to edit." },
        { status: 404 },
      );
    }
    if (matches.length > 1) {
      return NextResponse.json(
        { success: false, error: "This tender appears in more than one pipeline. Select its owner before editing." },
        { status: 409 },
      );
    }

    const { record, location } = matches[0];
    if (!location) throw new Error("The pipeline tender could not be located.");

    if (profile.role === "hod") {
      const ownerEmail = String(record.owner_email ?? record.id)
        .trim()
        .toLowerCase();
      const { data: owner, error: ownerError } = await admin
        .from("profiles")
        .select("email,country,department,active")
        .eq("email", ownerEmail)
        .maybeSingle();
      if (ownerError) throw ownerError;
      const actorDepartment = String(profile.department ?? "")
        .trim()
        .toLowerCase();
      const ownerDepartment = String(owner?.department ?? "")
        .trim()
        .toLowerCase();
      const outsideCountry = profile.country !== "ALL" && owner?.country !== profile.country;
      const outsideDepartment = actorDepartment && ownerDepartment && actorDepartment !== ownerDepartment;
      if (!owner?.active || outsideCountry || outsideDepartment) {
        return NextResponse.json(
          { success: false, error: "HODs can only edit active pipelines in their country and department." },
          { status: 403 },
        );
      }
    }

    const currentTask = location.tasks[location.index];
    const updatedTask: JsonObject = { ...currentTask, ...updates, id: taskId };
    const awarded = Number(updatedTask.amountAwarded ?? 0);
    const cost = Number(updatedTask.actualCost ?? 0);
    if (awarded > 0 && cost > 0) updatedTask.grossMargin = awarded - cost;
    else delete updatedTask.grossMargin;

    const nextTasks = [...location.tasks];
    nextTasks[location.index] = updatedTask;
    const nextPayload = {
      ...record.payload,
      board: { ...location.board, [location.column]: nextTasks },
    };
    const { data: saved, error: saveError } = await admin
      .from("app_records")
      .update({ payload: nextPayload })
      .eq("kind", "pipeline")
      .eq("id", record.id)
      .eq("updated_at", record.updated_at)
      .select("payload,updated_at")
      .maybeSingle();
    if (saveError) throw saveError;
    if (!saved) {
      return NextResponse.json(
        { success: false, error: "The pipeline changed while you were editing. Reopen the tender and try again." },
        { status: 409 },
      );
    }

    const persistedLocation = findTask(
      {
        ...record,
        payload: saved.payload as JsonObject,
        updated_at: saved.updated_at,
      },
      taskId,
    );
    const persistedTask = persistedLocation?.tasks[persistedLocation.index];
    if (!persistedTask || Number(persistedTask.pipelineValue) !== Number(updatedTask.pipelineValue)) {
      return NextResponse.json(
        { success: false, error: "The saved tender value could not be verified. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        task: { ...persistedTask, pipelineOwnerEmail: record.owner_email ?? record.id },
        stage: location.column,
        pipelineOwner: record.owner_email ?? record.id,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "The tender value could not be saved.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { profile } = await requireUser();
    if (!deletionRoles.has(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Country or super administrator access is required to remove pipeline tenders." },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    const taskId = typeof body?.taskId === "string" ? body.taskId.trim() : "";
    const pipelineOwnerEmail =
      typeof body?.pipelineOwnerEmail === "string" ? body.pipelineOwnerEmail.trim().toLowerCase() : "";
    if (!taskId || taskId.length > 500) {
      return NextResponse.json({ success: false, error: "A valid pipeline tender is required." }, { status: 400 });
    }

    const admin = createAdminClient();
    let query = admin.from("app_records").select("id,country,owner_email,payload,updated_at").eq("kind", "pipeline");
    if (pipelineOwnerEmail) query = query.eq("owner_email", pipelineOwnerEmail);
    if (profile.role === "country_admin" && profile.country !== "ALL") {
      query = query.eq("country", profile.country);
    }

    const { data, error } = await query;
    if (error) throw error;
    const matches = ((data ?? []) as PipelineRecord[])
      .map((record) => ({ record, location: findTask(record, taskId) }))
      .filter((candidate) => candidate.location !== null);

    if (matches.length === 0) {
      return NextResponse.json(
        { success: false, error: "This tender was not found in a pipeline you are allowed to manage." },
        { status: 404 },
      );
    }
    if (matches.length > 1) {
      return NextResponse.json(
        { success: false, error: "This tender appears in more than one pipeline. Select its owner and try again." },
        { status: 409 },
      );
    }

    const { record, location } = matches[0];
    if (!location) throw new Error("The pipeline tender could not be located.");
    const nextPayload = {
      ...record.payload,
      board: {
        ...location.board,
        [location.column]: location.tasks.filter((task) => task.id !== taskId),
      },
    };
    const { data: saved, error: saveError } = await admin
      .from("app_records")
      .update({ payload: nextPayload })
      .eq("kind", "pipeline")
      .eq("id", record.id)
      .eq("updated_at", record.updated_at)
      .select("payload,updated_at")
      .maybeSingle();
    if (saveError) throw saveError;
    if (!saved) {
      return NextResponse.json(
        { success: false, error: "The pipeline changed while you were deleting. Refresh and try again." },
        { status: 409 },
      );
    }

    const persistedLocation = findTask(
      { ...record, payload: saved.payload as JsonObject, updated_at: saved.updated_at },
      taskId,
    );
    if (persistedLocation) {
      return NextResponse.json(
        { success: false, error: "The tender could not be removed from the pipeline. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId,
        stage: location.column,
        pipelineOwner: record.owner_email ?? record.id,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "The tender could not be removed from the pipeline.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { profile } = await requireUser();
    const body = await req.json();
    const { email, board } = body || {};
    const canManageOtherPipelines = deletionRoles.has(profile.role);

    if (!email || !board || typeof board !== "object" || Array.isArray(board)) {
      return NextResponse.json({ success: false, error: "Email and board are required" }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (["all", "combined"].includes(normalizedEmail)) {
      return NextResponse.json(
        { success: false, error: "Choose a specific pipeline owner before saving changes." },
        { status: 400 },
      );
    }
    if (!canManageOtherPipelines && normalizedEmail !== String(profile.email).trim().toLowerCase()) {
      return NextResponse.json({ success: false, error: "You can only update your own pipeline." }, { status: 403 });
    }

    const storedBoard = await DatabaseService.getStoredUserPipelineBoard(normalizedEmail);
    const storedIds = pipelineTaskIds(storedBoard);
    const nextIds = pipelineTaskIds(board);
    const removedTask = [...storedIds].some((taskId) => !nextIds.has(taskId));
    if (removedTask) {
      return NextResponse.json(
        { success: false, error: "Use the Remove from pipeline action to delete one tender at a time." },
        { status: 403 },
      );
    }

    const ok = await DatabaseService.saveUserPipelineBoard(normalizedEmail, board);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Failed to persist pipeline board to database" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Pipeline write error" }, { status: 500 });
  }
}
