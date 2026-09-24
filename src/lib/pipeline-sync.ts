import type { CountryScope } from "@/app/(main)/dashboard/default/_components/tender-data";
import { columnIds } from "@/app/(main)/dashboard/kanban/_components/data";
import type { BoardState, Task, TaskTeam } from "@/app/(main)/dashboard/kanban/_components/types";
import { createClientId } from "@/lib/utils";

import { syncTenderToZohoCrm } from "./zoho-sync";

export { columnIds };

export function emptyPipelineBoard(): BoardState {
  return Object.fromEntries(columnIds.map((id) => [id, []])) as unknown as BoardState;
}

export function normalizePipelineBoard(value: Partial<BoardState> | null | undefined): BoardState {
  return Object.fromEntries(
    columnIds.map((id) => {
      const tasks = value?.[id];
      return [
        id,
        Array.isArray(tasks)
          ? tasks.map((task) => {
              // Manual tenders created before pipelineValue existed stored the user's
              // entered amount in estimatedValue. Migrate only those records; public
              // catalogue estimates must never inflate the live pipeline total.
              if (
                task.id.startsWith("manual-") &&
                task.pipelineValue === undefined &&
                Number.isFinite(task.estimatedValue)
              ) {
                return { ...task, pipelineValue: Math.max(0, task.estimatedValue ?? 0) };
              }
              return task;
            })
          : [],
      ];
    }),
  ) as unknown as BoardState;
}

export interface LivePipelineMetrics {
  awardedValue: number;
  awardedContractsCount: number;
  pipelineValue: number;
  activeTenders: number;
  submittedValue: number;
  submittedCount: number;
  criticalDeadlines: number;
  lostValue: number;
  lostContractsCount: number;
  submittedTasks: Task[];
  lostTasks: Task[];
  wonTasks: Task[];
}

/**
 * Returns a user-namespaced storage key so each logged in user has their own private pipeline
 */
export function getCurrentUserStorageKey(baseKey: string = "kanban_board_state"): string {
  if (typeof window === "undefined") return baseKey;
  try {
    const userStr = localStorage.getItem("atcis_user");
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.email) {
        if (baseKey === "kanban_board_state") {
          // Hydrate only from an authorized fetch/save, using a collision-free user key.
          return `${baseKey}_v3_${encodeURIComponent(user.id || user.email.toLowerCase())}`;
        }
        const sanitized = user.email.toLowerCase().replace(/[^a-z0-9]/g, "_");
        return `${baseKey}_${sanitized}`;
      }
    }
  } catch {
    // ignore
  }
  return baseKey;
}

/**
 * Safely resolves the active pipeline target email for oversight roles (Country Admin, Super Admin, HOD).
 * If the stored target is empty, "all", or equals the oversight user's own email (who has no individual tasks),
 * it defaults to "all" and normalizes localStorage.
 */
export function getOversightPipelineTarget(user: any): string {
  if (!user) return "all";
  const isOversight = ["country_admin", "super_admin", "hod"].includes(user.role);
  if (!isOversight) return user.email;
  if (typeof window === "undefined") return "all";

  const savedAm = localStorage.getItem("hod_selected_am");
  if (
    !savedAm ||
    savedAm === "all" ||
    savedAm.toLowerCase().trim() ===
      String(user.email || "")
        .toLowerCase()
        .trim()
  ) {
    try {
      localStorage.setItem("hod_selected_am", "all");
    } catch {}
    return "all";
  }
  return savedAm;
}

/**
 * Retrieves the live Kanban board for the currently authenticated user
 */
export function getLivePipelineBoard(): BoardState {
  if (typeof window === "undefined") {
    return emptyPipelineBoard();
  }

  try {
    const userStr = localStorage.getItem("atcis_user");
    const user = userStr ? JSON.parse(userStr) : null;
    const isOversight = user && ["country_admin", "super_admin", "hod"].includes(user.role);

    if (isOversight) {
      const target = getOversightPipelineTarget(user);
      if (target === "all") {
        const countryKey = user?.country || "ALL";
        const cached = localStorage.getItem(`atcis_combined_pipeline_v3_${countryKey}`);
        if (cached) {
          return normalizePipelineBoard(JSON.parse(cached));
        }
        const fallback = localStorage.getItem("atcis_combined_pipeline_v3_ALL");
        if (fallback) {
          return normalizePipelineBoard(JSON.parse(fallback));
        }
      } else {
        const amKey = `kanban_board_state_v3_${encodeURIComponent(target.toLowerCase())}`;
        const amSaved = localStorage.getItem(amKey);
        if (amSaved) {
          return normalizePipelineBoard(JSON.parse(amSaved));
        }
      }
      return emptyPipelineBoard();
    }

    const userKey = getCurrentUserStorageKey("kanban_board_state");
    if (userKey !== "kanban_board_state") {
      const saved = localStorage.getItem(userKey);
      if (saved) {
        return normalizePipelineBoard(JSON.parse(saved));
      }
    }
  } catch {
    // ignore
  }

  return emptyPipelineBoard();
}

/**
 * Calculates live pipeline KPI values for the user's board with optional country filtering
 */
export function calculatePipelineMetrics(board: BoardState, countryScope: CountryScope = "ALL"): LivePipelineMetrics {
  const matchesCountry = (t: Task) => {
    if (!countryScope || countryScope === "ALL") return true;
    return t.countryCode === countryScope;
  };

  // 1. Won Contracts Stage - strictly reflects tenders currently in the Won column
  const allWonTasks = board.won || [];
  const wonTasks = allWonTasks.filter(matchesCountry);
  const awardedValue = wonTasks.reduce((acc, t) => acc + (t.amountAwarded ?? t.pipelineValue ?? 0), 0);
  const awardedContractsCount = wonTasks.length;

  // 2. Active Tenders - discovery & preparation stages
  const activeColumns: (keyof BoardState)[] = ["new", "opportunity", "in-progress"];
  const activeTasks = activeColumns.flatMap((col) => (board[col] || []).filter(matchesCountry));
  const pipelineValue = activeTasks.reduce((acc, t) => acc + (t.pipelineValue ?? 0), 0);
  const activeTenders = activeTasks.length;

  // 3. Submitted Tenders Stage
  const allSubmittedTasks = board.submitted || [];
  const submittedTasks = allSubmittedTasks.filter(matchesCountry);
  const submittedValue = submittedTasks.reduce((acc, t) => acc + (t.pipelineValue ?? 0), 0);
  const submittedCount = submittedTasks.length;

  // 4. Critical Deadlines
  const criticalDeadlines = activeTasks.filter((t) => t.priority === "Urgent").length;

  // 5. Lost Tenders Stage
  const allLostTasks = board.lost || [];
  const lostTasks = allLostTasks.filter(matchesCountry);
  const lostValue = lostTasks.reduce((acc, t) => acc + (t.pipelineValue ?? 0), 0);
  const lostContractsCount = lostTasks.length;

  return {
    awardedValue,
    awardedContractsCount,
    pipelineValue,
    activeTenders,
    submittedValue,
    submittedCount,
    criticalDeadlines,
    lostValue,
    lostContractsCount,
    submittedTasks,
    lostTasks,
    wonTasks,
  };
}

/** Load an authorized board from Supabase. An absent board is an empty board. */
export async function fetchLivePipelineBoardFromDb(email?: string, signal?: AbortSignal): Promise<BoardState | null> {
  if (typeof window === "undefined") return null;
  const user = JSON.parse(localStorage.getItem("atcis_user") || "null");
  if (!user) return null;

  const isOversight = ["country_admin", "super_admin", "hod"].includes(user.role);
  const targetEmail = email || (isOversight ? getOversightPipelineTarget(user) : user.email);

  const response = await fetch(`/api/pipeline?email=${encodeURIComponent(targetEmail)}`, { signal, cache: "no-store" });
  const json = await response.json();
  if (!response.ok || !json.success) throw new Error(json.error || "Could not load pipeline");
  const board = normalizePipelineBoard(json.data);
  const activeUser = JSON.parse(localStorage.getItem("atcis_user") || "null");
  if (
    signal?.aborted ||
    !activeUser ||
    activeUser.id !== user.id ||
    activeUser.email !== user.email ||
    activeUser.role !== user.role ||
    activeUser.country !== user.country
  ) {
    throw new DOMException("Account changed during pipeline load", "AbortError");
  }
  if (["all", "combined"].includes(targetEmail)) {
    try {
      localStorage.setItem(`atcis_combined_pipeline_v3_${activeUser?.country || "ALL"}`, JSON.stringify(board));
    } catch {}
  } else if (targetEmail === user.email && activeUser?.email === user.email) {
    localStorage.setItem(getCurrentUserStorageKey(), JSON.stringify(board));
  } else {
    try {
      localStorage.setItem(
        `kanban_board_state_v3_${encodeURIComponent(targetEmail.toLowerCase())}`,
        JSON.stringify(board),
      );
    } catch {}
  }
  return board;
}

/** Load aggregated pipeline board across all users */
export async function fetchCombinedPipelineBoardFromDb(): Promise<BoardState> {
  return (await fetchLivePipelineBoardFromDb("combined")) || emptyPipelineBoard();
}

/** Update one stored task without ever writing an aggregated HOD board over an owner's pipeline. */
export async function updatePipelineTaskInDb(task: Task): Promise<Task> {
  const response = await fetch("/api/pipeline", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId: task.id, pipelineOwnerEmail: task.pipelineOwnerEmail, updates: task }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.error || "The tender value could not be saved.");
  }
  const savedTask = result.data.task as Task;
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key || (!key.includes("kanban_board_state") && !key.includes("atcis_combined_pipeline"))) continue;
      const cached = normalizePipelineBoard(JSON.parse(localStorage.getItem(key) || "null"));
      let changed = false;
      for (const column of columnIds) {
        const taskIndex = cached[column].findIndex((item) => item.id === savedTask.id);
        if (taskIndex === -1) continue;
        cached[column] = [...cached[column]];
        cached[column][taskIndex] = savedTask;
        changed = true;
      }
      if (changed) localStorage.setItem(key, JSON.stringify(cached));
    }
    localStorage.setItem("atcis_pipeline_revision", createClientId());
  } catch {}
  window.dispatchEvent(new CustomEvent("kanban-pipeline-updated", { detail: undefined }));
  window.dispatchEvent(new Event("atcis-pipeline-saved"));
  return savedTask;
}

/** Removes one task from its owner's persisted pipeline without replacing a combined board. */
export async function deletePipelineTaskInDb(task: Task): Promise<void> {
  const response = await fetch("/api/pipeline", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId: task.id, pipelineOwnerEmail: task.pipelineOwnerEmail }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.error || "The tender could not be removed from the pipeline.");
  }

  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key || (!key.includes("kanban_board_state") && !key.includes("atcis_combined_pipeline"))) continue;
      const cached = normalizePipelineBoard(JSON.parse(localStorage.getItem(key) || "null"));
      let changed = false;
      for (const column of columnIds) {
        const nextTasks = cached[column].filter((item) => item.id !== task.id);
        if (nextTasks.length === cached[column].length) continue;
        cached[column] = nextTasks;
        changed = true;
      }
      if (changed) localStorage.setItem(key, JSON.stringify(cached));
    }
    localStorage.setItem("atcis_pipeline_revision", createClientId());
  } catch {}
  window.dispatchEvent(new CustomEvent("kanban-pipeline-updated", { detail: undefined }));
  window.dispatchEvent(new Event("atcis-pipeline-saved"));
}

/** Saves are serialized so an older request cannot overwrite a later edit. */
let pendingSave: Promise<void> = Promise.resolve();
export function saveLivePipelineBoard(board: BoardState, customEmail?: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const user = JSON.parse(localStorage.getItem("atcis_user") || "null");
  if (!user) return Promise.reject(new Error("Sign in to save a pipeline"));
  const email = customEmail || user.email;
  const serializedBoard = JSON.stringify(board);

  // Optimistically persist to local storage and notify Kanban UI immediately
  try {
    const activeUser = JSON.parse(localStorage.getItem("atcis_user") || "null");
    if (!customEmail || activeUser?.email?.toLowerCase() === customEmail.toLowerCase()) {
      localStorage.setItem(getCurrentUserStorageKey(), serializedBoard);
      window.dispatchEvent(new CustomEvent("kanban-pipeline-updated", { detail: JSON.parse(serializedBoard) }));
    }
  } catch {
    // ignore
  }

  const save = async () => {
    try {
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, board: JSON.parse(serializedBoard) }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.success) {
        throw new Error(json.error || response.statusText || "The pipeline could not be saved.");
      } else {
        // Notify readers after the database commit as well as the optimistic edit.
        // Cache writes from ordinary reads must never be mistaken for mutations.
        try {
          localStorage.setItem("atcis_pipeline_revision", createClientId());
        } catch {}
        window.dispatchEvent(new Event("atcis-pipeline-saved"));
      }
    } catch (err) {
      console.warn("Pipeline remote save failed:", err);
      throw err;
    }
  };
  pendingSave = pendingSave.catch(() => {}).then(save);
  return pendingSave;
}

/** Check if a tender is already present in any column of the pipeline */
export function isTenderInPipeline(tender: { id?: string; refNo?: string; title?: string }): {
  exists: boolean;
  column?: string;
} {
  if (typeof window === "undefined") return { exists: false };
  try {
    const board = getLivePipelineBoard();
    const id = String(tender.id || "").toLowerCase();
    const ref = (tender.refNo || "").toLowerCase();
    const title = (tender.title || "").toLowerCase();

    for (const col of columnIds) {
      const match = (board[col] || []).find(
        (t) =>
          (id && t.id && (t.id.toLowerCase() === id || t.id.toLowerCase() === `pipeline-${id}`)) ||
          (ref && t.refNo && t.refNo.toLowerCase() === ref) ||
          (title && t.title && t.title.toLowerCase() === title),
      );
      if (match) return { exists: true, column: col };
    }
  } catch {
    // ignore
  }
  return { exists: false };
}

/** Add an arbitrary tender opportunity to the user's live Kanban pipeline under "new" */
export async function addTenderToPipeline(tender: {
  id: string;
  refNo?: string;
  title: string;
  procuringEntity?: string;
  estimatedValue?: number;
  closingDate?: string;
  countryCode?: "ZW" | "ZM" | string;
  sector?: string;
  aiScore?: number;
  description?: string;
  sourcePortal?: string;
  documentsCount?: number;
}): Promise<{ success: boolean; alreadyExists: boolean; column?: string; task?: Task }> {
  if (typeof window === "undefined") return { success: false, alreadyExists: false };

  // 1. Fetch live board or fall back to local cache
  let board: BoardState;
  try {
    const fetched = await fetchLivePipelineBoardFromDb();
    board = fetched || getLivePipelineBoard();
  } catch {
    board = getLivePipelineBoard();
  }

  const tenderId = String(tender.id || "").toLowerCase();
  const tenderRef = (tender.refNo || "").toLowerCase();
  const tenderTitle = (tender.title || "").toLowerCase();

  // Check if already tracked in any stage
  for (const col of columnIds) {
    const existing = (board[col] || []).find(
      (t) =>
        (t.id && (t.id.toLowerCase() === tenderId || t.id.toLowerCase() === `pipeline-${tenderId}`)) ||
        (t.refNo && tenderRef && t.refNo.toLowerCase() === tenderRef) ||
        (t.title && tenderTitle && t.title.toLowerCase() === tenderTitle),
    );
    if (existing) {
      return { success: true, alreadyExists: true, column: col, task: existing };
    }
  }

  // 2. Map sector to TaskTeam
  let taskTeam: TaskTeam = "ICT & Telecoms";
  const s = (tender.sector || "").toLowerCase();
  if (s.includes("health") || s.includes("medic")) taskTeam = "Healthcare";
  else if (s.includes("ict") || s.includes("soft") || s.includes("tech")) taskTeam = "ICT & Telecoms";
  else if (s.includes("elect") || s.includes("energy")) taskTeam = "Electrical Grid";
  else if (s.includes("civil") || s.includes("road") || s.includes("infra")) taskTeam = "Civil & Roads";
  else if (s.includes("solar")) taskTeam = "Solar & Energy";
  else if (s.includes("water") || s.includes("sanit")) taskTeam = "Water & Sanitation";
  else if (s.includes("legal") || s.includes("compli")) taskTeam = "Compliance & Legal";

  const user = JSON.parse(localStorage.getItem("atcis_user") || "null");
  const estValue = Number(tender.estimatedValue) || 0;

  const newTask: Task = {
    id: `pipeline-${tender.id || Date.now()}`,
    refNo: tender.refNo || tender.id || `TND-${Date.now()}`,
    countryCode: (tender.countryCode as "ZW" | "ZM") || "ZW",
    title: tender.title,
    description:
      tender.description ||
      `Procurement opportunity issued by ${tender.procuringEntity || "Procuring Authority"}. Source Portal: ${tender.sourcePortal || "Official Portal"}.`,
    entity: tender.procuringEntity || "Procuring Authority",
    estimatedValue: estValue,
    actualCost: Math.round(estValue * 0.75),
    grossMargin: Math.round(estValue * 0.25),
    aiScore: tender.aiScore || 88,
    team: taskTeam,
    priority: "High",
    dueDate: tender.closingDate || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    progress: 10,
    insights:
      tender.documentsCount && tender.documentsCount > 0 ? [{ label: "Documents", count: tender.documentsCount }] : [],
    owner: {
      name: user?.name || "Account Manager",
      tone: "[&_[data-slot=avatar-fallback]]:bg-emerald-100 [&_[data-slot=avatar-fallback]]:text-emerald-700",
    },
  };

  const updatedBoard: BoardState = {
    ...board,
    new: [newTask, ...(board.new || [])],
  };

  await saveLivePipelineBoard(updatedBoard);

  // Automatically sync newly added opportunity to country-specific Zoho CRM (Zambia / Zimbabwe)
  void syncTenderToZohoCrm(newTask, {
    event: "tender_pipeline_added",
    stage: "New",
    countryCode: newTask.countryCode,
    silent: false,
  });

  return { success: true, alreadyExists: false, column: "new", task: newTask };
}
