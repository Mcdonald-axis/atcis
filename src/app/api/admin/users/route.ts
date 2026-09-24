import { NextResponse } from "next/server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";

import { randomBytes } from "node:crypto";

const roles = ["account_manager", "technical_review", "hod", "committee", "country_admin", "super_admin"] as const;
const countries = ["ZW", "ZM", "ALL"] as const;
const createSchema = z.object({
  action: z.literal("create"),
  name: z.string().trim().min(2).max(100),
  email: z.email().transform((value) => value.toLowerCase()),
  role: z.enum(roles),
  country: z.enum(countries),
  department: z.string().trim().max(100).default(""),
});
const updateSchema = z.object({
  action: z.literal("update"),
  id: z.uuid(),
  name: z.string().trim().min(2).max(100),
  role: z.enum(roles),
  country: z.enum(countries),
  department: z.string().trim().max(100).default(""),
  active: z.boolean(),
});
const resetSchema = z.object({ action: z.literal("reset_password"), id: z.uuid() });
const deleteSchema = z.object({ action: z.literal("delete"), id: z.uuid() });
const requestSchema = z.discriminatedUnion("action", [createSchema, updateSchema, resetSchema, deleteSchema]);

const activePipelineStages = [
  "new",
  "opportunity",
  "in-progress",
  "submitted",
  "won",
  "contract-signing",
  "in-delivery",
] as const;

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function activePipelineItemCount(payload: unknown) {
  if (!isJsonObject(payload)) return 0;
  const board = payload.board;
  if (!isJsonObject(board)) return 0;
  return activePipelineStages.reduce((total, stage) => {
    const items = board[stage];
    return total + (Array.isArray(items) ? items.length : 0);
  }, 0);
}

function temporaryPassword() {
  return `Atcis!${randomBytes(9).toString("base64url")}7a`;
}

export async function POST(request: Request) {
  let _createdId: string | null = null;
  try {
    const { user, profile } = await requireUser();
    if (profile.role !== "super_admin") {
      return NextResponse.json({ success: false, error: "Super administrator access is required" }, { status: 403 });
    }
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Check the account details and try again" }, { status: 400 });
    }
    const input = parsed.data;
    const admin = createAdminClient();

    if (input.action === "create") {
      if ((input.role === "super_admin") !== (input.country === "ALL")) {
        return NextResponse.json(
          { success: false, error: "Regional super administrators use All regions; other roles need a country" },
          { status: 400 },
        );
      }
      const password = temporaryPassword();
      const { data, error } = await admin.auth.admin.createUser({
        email: input.email,
        password,
        email_confirm: true,
        user_metadata: {
          name: input.name,
          role: input.role,
          country: input.country,
          department: input.department,
          must_change_password: true,
        },
      });
      if (error) throw error;
      _createdId = data.user.id;
      const { error: profileError } = await admin.from("profiles").upsert({
        id: data.user.id,
        email: input.email,
        name: input.name,
        role: input.role,
        country: input.country,
        department: input.department || null,
        active: true,
        must_change_password: true,
      });
      if (profileError) {
        await admin.auth.admin.deleteUser(data.user.id);
        _createdId = null;
        throw profileError;
      }
      await admin.from("admin_audit_logs").insert({
        actor_id: user.id,
        target_id: data.user.id,
        action: "user_created",
        details: { email: input.email, role: input.role, country: input.country },
      });
      return NextResponse.json({ success: true, temporaryPassword: password });
    }

    const { data: target, error: targetError } = await admin.from("profiles").select("*").eq("id", input.id).single();
    if (targetError || !target)
      return NextResponse.json({ success: false, error: "User was not found" }, { status: 404 });

    if (input.action === "reset_password") {
      const password = temporaryPassword();
      const { error } = await admin.auth.admin.updateUserById(input.id, {
        password,
        user_metadata: { must_change_password: true },
      });
      if (error) throw error;
      await admin.from("profiles").update({ must_change_password: true }).eq("id", input.id);
      await admin.from("admin_audit_logs").insert({
        actor_id: user.id,
        target_id: input.id,
        action: "password_reset",
        details: {},
      });
      return NextResponse.json({ success: true, temporaryPassword: password });
    }

    if (input.action === "delete") {
      if (input.id === user.id) {
        return NextResponse.json({ success: false, error: "You cannot delete your own account" }, { status: 400 });
      }

      if (target.role === "super_admin" && target.active) {
        const { count, error: countError } = await admin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "super_admin")
          .eq("active", true);
        if (countError) throw countError;
        if ((count ?? 0) <= 1) {
          return NextResponse.json(
            { success: false, error: "The last active super administrator cannot be deleted" },
            { status: 400 },
          );
        }
      }

      const targetEmail = String(target.email).trim().toLowerCase();
      const { data: records, error: recordsError } = await admin
        .from("app_records")
        .select("kind,owner_email,payload")
        .in("kind", ["assignment", "review", "pipeline"]);
      if (recordsError) throw recordsError;

      let activeAssignments = 0;
      let pendingReviews = 0;
      let activePipelineItems = 0;
      for (const record of records ?? []) {
        const ownerEmail = String(record.owner_email ?? "")
          .trim()
          .toLowerCase();
        const payload = isJsonObject(record.payload) ? record.payload : {};
        if (record.kind === "assignment") {
          const assignedToEmail = String(payload.assignedToEmail ?? ownerEmail)
            .trim()
            .toLowerCase();
          const status = String(payload.status ?? "")
            .trim()
            .toLowerCase();
          if (assignedToEmail === targetEmail && !["completed", "closed"].includes(status)) activeAssignments += 1;
        }
        if (record.kind === "review" && ownerEmail === targetEmail && payload.overallStatus === "In Review") {
          pendingReviews += 1;
        }
        if (record.kind === "pipeline" && ownerEmail === targetEmail) {
          activePipelineItems += activePipelineItemCount(payload);
        }
      }

      if (activeAssignments || pendingReviews || activePipelineItems) {
        const work = [
          activeAssignments ? `${activeAssignments} active assignment${activeAssignments === 1 ? "" : "s"}` : "",
          pendingReviews ? `${pendingReviews} review${pendingReviews === 1 ? "" : "s"} in progress` : "",
          activePipelineItems
            ? `${activePipelineItems} active pipeline item${activePipelineItems === 1 ? "" : "s"}`
            : "",
        ].filter(Boolean);
        return NextResponse.json(
          {
            success: false,
            error: `Reassign or close this user's ${work.join(", ")} before deleting the account`,
          },
          { status: 409 },
        );
      }

      // Soft deletion is irreversible, removes sign-in access, and preserves
      // Auth references used by historical audit and uploaded-file ownership.
      const { error: authDeleteError } = await admin.auth.admin.deleteUser(input.id, true);
      if (authDeleteError) throw authDeleteError;
      const { error: profileDeleteError } = await admin.from("profiles").delete().eq("id", input.id);
      if (profileDeleteError) throw profileDeleteError;

      await admin.from("admin_audit_logs").insert({
        actor_id: user.id,
        target_id: input.id,
        action: "user_updated",
        details: {
          operation: "deleted",
          targetName: target.name,
          email: target.email,
          role: target.role,
          country: target.country,
        },
      });
      return NextResponse.json({ success: true });
    }

    if (input.id === user.id && (!input.active || input.role !== "super_admin" || input.country !== "ALL")) {
      return NextResponse.json(
        { success: false, error: "You cannot remove your own super-admin access" },
        { status: 400 },
      );
    }
    if ((input.role === "super_admin") !== (input.country === "ALL")) {
      return NextResponse.json(
        { success: false, error: "Regional super administrators use All regions; other roles need a country" },
        { status: 400 },
      );
    }
    if (target.role === "super_admin" && target.active && (!input.active || input.role !== "super_admin")) {
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "super_admin")
        .eq("active", true);
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { success: false, error: "At least one active super administrator is required" },
          { status: 400 },
        );
      }
    }

    const { error } = await admin
      .from("profiles")
      .update({
        name: input.name,
        role: input.role,
        country: input.country,
        department: input.department || null,
        active: input.active,
      })
      .eq("id", input.id);
    if (error) throw error;
    await admin.auth.admin.updateUserById(input.id, { user_metadata: { name: input.name } });
    await admin.from("admin_audit_logs").insert({
      actor_id: user.id,
      target_id: input.id,
      action: "user_updated",
      details: { role: input.role, country: input.country, active: input.active },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Account operation failed" },
      { status: 500 },
    );
  }
}
