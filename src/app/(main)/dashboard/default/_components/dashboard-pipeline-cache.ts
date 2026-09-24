import { emptyPipelineBoard, fetchLivePipelineBoardFromDb } from "@/lib/pipeline-sync";
import { AuthService, type AuthUser } from "@/services/auth-service";
import type { BoardState } from "../../kanban/_components/types";

type Entry = {
  board?: BoardState;
  updatedAt: number;
  revision: number;
  retryAt: number;
  error?: Error;
  pending?: Promise<BoardState>;
  controller?: AbortController;
};

// Memory only: survives client navigation, never shared between accounts or servers.
const entries = new Map<string, Entry>();
const selections = new Map<string, string>();
const freshFor = 60_000;
let activeScope = "";
let listening = false;

export function dashboardAccessScope(user: AuthUser | null): string {
  return user ? JSON.stringify([user.id, user.email.toLowerCase(), user.role, user.country, user.department]) : "";
}

function invalidate() {
  for (const entry of entries.values()) {
    entry.updatedAt = 0;
    entry.retryAt = 0;
    entry.revision++;
  }
}

export function isPipelineMutationStorage(event: StorageEvent): boolean {
  return event.key === "atcis_pipeline_revision";
}

export function prepareDashboardPipelineCache(user: AuthUser | null) {
  const scope = dashboardAccessScope(user);
  if (scope !== activeScope) {
    for (const entry of entries.values()) entry.controller?.abort();
    entries.clear();
    selections.clear();
    activeScope = scope;
  }
  if (listening || typeof window === "undefined") return;
  listening = true;
  // Keep invalidation active while the dashboard page is unmounted.
  window.addEventListener("kanban-pipeline-updated", invalidate);
  window.addEventListener("atcis-pipeline-saved", invalidate);
  window.addEventListener("atcis-auth-changed", () => prepareDashboardPipelineCache(AuthService.getCurrentUser()));
  window.addEventListener("storage", (event) => {
    if (event.key === "atcis_user" || event.key === null) {
      prepareDashboardPipelineCache(AuthService.getCurrentUser());
      if (event.key === null) invalidate();
    } else if (isPipelineMutationStorage(event)) invalidate();
  });
}

export function getDashboardSelection(scope: string): string {
  return selections.get(scope) || "all";
}

export function setDashboardSelection(scope: string, email: string) {
  if (scope && scope === activeScope) selections.set(scope, email);
}

export function getCachedDashboardBoard(key: string): BoardState | undefined {
  return entries.get(key)?.board;
}

export function loadDashboardBoard(key: string, scope: string, email: string, force = false): Promise<BoardState> {
  if (!scope || scope !== activeScope || dashboardAccessScope(AuthService.getCurrentUser()) !== scope) {
    return Promise.reject(new Error("Your account changed. Reload the dashboard."));
  }
  let entry = entries.get(key);
  if (!entry) {
    entry = { updatedAt: 0, revision: 0, retryAt: 0 };
    entries.set(key, entry);
  }
  const current = entry;
  // A navigation, focus event and visibility event can all reuse this request.
  if (current.pending) return current.pending;
  if (!force && current.board && Date.now() - current.updatedAt < freshFor) return Promise.resolve(current.board);
  if (!force && current.error && Date.now() < current.retryAt) return Promise.reject(current.error);

  const controller = new AbortController();
  current.controller = controller;
  current.pending = (async () => {
    while (true) {
      const revision = current.revision;
      const board = await fetchLivePipelineBoardFromDb(email, AbortSignal.any([
        controller.signal, AbortSignal.timeout(15_000),
      ]));
      if (controller.signal.aborted || entries.get(key) !== current
        || dashboardAccessScope(AuthService.getCurrentUser()) !== scope) {
        throw new DOMException("Account changed", "AbortError");
      }
      // A save completed during this read. Fetch its committed state before
      // publishing a result, so an older read cannot replace a newer edit.
      if (revision !== current.revision) continue;
      current.board = board || emptyPipelineBoard();
      current.updatedAt = Date.now();
      current.retryAt = 0;
      current.error = undefined;
      return current.board;
    }
  })().catch((error: unknown) => {
    current.error = error instanceof Error ? error : new Error("Could not refresh your pipeline.");
    current.retryAt = Date.now() + 15_000;
    throw current.error;
  }).finally(() => {
    current.pending = undefined;
    current.controller = undefined;
  });
  return current.pending;
}
