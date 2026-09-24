"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getAmsForUser, type SystemUser } from "@/data/users";
import { emptyPipelineBoard } from "@/lib/pipeline-sync";
import { AuthService, type AuthUser } from "@/services/auth-service";
import type { BoardState } from "../../kanban/_components/types";
import type { CountryScope } from "./tender-data";
import {
  dashboardAccessScope, getCachedDashboardBoard, getDashboardSelection, isPipelineMutationStorage,
  loadDashboardBoard, prepareDashboardPipelineCache, setDashboardSelection,
} from "./dashboard-pipeline-cache";

function taskMatchesMember(task: any, member: SystemUser): boolean {
  const memberEmail = member.email.toLowerCase().trim();
  const memberName = member.name.toLowerCase().trim();
  const cleanName = memberName.replace(/^(dr|mr|mrs|ms)\.?\s+/i, "");
  const nameParts = cleanName.split(/\s+/).filter(Boolean);
  const memberFirst = nameParts[0] || "";
  const memberLast = nameParts.slice(-1)[0] || "";

  const taskOwnerEmail = String(task.ownerEmail || "").toLowerCase().trim();
  const taskAssignedEmail = String(task.assignedToEmail || "").toLowerCase().trim();

  if (taskOwnerEmail && taskOwnerEmail === memberEmail) return true;
  if (taskAssignedEmail && taskAssignedEmail === memberEmail) return true;
  if (task.assignedToId && String(task.assignedToId) === String(member.id)) return true;

  const ownerName = String(task.owner?.name || "").toLowerCase().trim();
  const assignedName = String(task.assignedToName || "").toLowerCase().trim();
  const hodName = String(task.assignedByHodName || "").toLowerCase().trim();

  if (ownerName === memberName || assignedName === memberName) return true;
  if (cleanName && (ownerName === cleanName || assignedName === cleanName)) return true;

  if (member.role === "hod" && hodName) {
    if (hodName === memberName || hodName.includes(cleanName) || (memberLast && hodName.includes(memberLast))) {
      return true;
    }
  }

  if (memberFirst && memberFirst.length > 2) {
    if (ownerName.includes(memberFirst) || assignedName.includes(memberFirst)) return true;
  }
  if (memberLast && memberLast.length > 2) {
    if (ownerName.includes(memberLast) || assignedName.includes(memberLast)) return true;
  }

  const emailPrefix = memberEmail.split("@")[0].split(".")[0];
  if (emailPrefix && emailPrefix.length > 2) {
    if (ownerName.includes(emailPrefix) || assignedName.includes(emailPrefix)) return true;
  }

  return false;
}

export function useDashboardPipeline(countryScope: CountryScope) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [availableAms, setAvailableAms] = useState<SystemUser[]>([]);
  const [selectedEmail, setSelectedEmail] = useState("all");
  const [result, setResult] = useState<{
    key: string; board: BoardState; error: string | null; hasData: boolean;
  } | null>(null);
  const previousScope = useRef<string | null>(null);
  const retryRef = useRef<(() => void) | null>(null);

  const isCountryAdmin = user?.role === "country_admin";
  const effectiveCountryScope: CountryScope = isCountryAdmin
    ? (user?.country === "ZM" ? "ZM" : "ZW")
    : countryScope;

  const isHodOrAdmin = Boolean(user && ["hod", "country_admin", "super_admin"].includes(user.role));
  const activeAmEmail = isHodOrAdmin && (selectedEmail === "all" || availableAms.some(am => am.email === selectedEmail))
    ? selectedEmail : user?.email || "";
  const accessScope = dashboardAccessScope(user);
  // Country filtering is local; changing it does not require another identical API read.
  const key = JSON.stringify([accessScope, activeAmEmail.toLowerCase()]);

  useEffect(() => {
    const sync = () => {
      const current = AuthService.getCurrentUser();
      const scope = dashboardAccessScope(current);
      prepareDashboardPipelineCache(current);
      setUser(previous => JSON.stringify(previous) === JSON.stringify(current) ? previous : current);
      const ams = getAmsForUser(current);
      const filteredAms = current?.role === "country_admin" && current.country !== "ALL"
        ? ams.filter(a => a.country === current.country)
        : ams;
      setAvailableAms(filteredAms);
      // Profile refreshes often repeat the same account. Preserve its selection and figures.
      if (previousScope.current !== scope) {
        previousScope.current = scope;
        const selection = getDashboardSelection(scope);
        setSelectedEmail(selection);
        const oversight = current && ["hod", "country_admin", "super_admin"].includes(current.role);
        const target = oversight && (selection === "all" || filteredAms.some(am => am.email === selection))
          ? selection : current?.email || "";
        const cachedKey = JSON.stringify([scope, target.toLowerCase()]);
        const cached = getCachedDashboardBoard(cachedKey);
        setResult(cached ? { key: cachedKey, board: cached, error: null, hasData: true } : null);
      }
    };
    const storage = (event: StorageEvent) => {
      if (event.key === "atcis_user" || event.key === null) sync();
    };
    sync();
    window.addEventListener("atcis-auth-changed", sync);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("atcis-auth-changed", sync);
      window.removeEventListener("storage", storage);
    };
  }, []);

  useEffect(() => {
    if (!accessScope || !activeAmEmail) return;
    let active = true;
    const load = (force = false) => {
      const cached = getCachedDashboardBoard(key);
      if (cached) setResult({ key, board: cached, error: null, hasData: true });
      // Do not clear a loaded board during background refreshes.
      void loadDashboardBoard(key, accessScope, activeAmEmail, force).then(board => {
        if (active) setResult({ key, board, error: null, hasData: true });
      }).catch((error: unknown) => {
        if (!active) return;
        const saved = getCachedDashboardBoard(key);
        setResult({ key, board: saved || emptyPipelineBoard(), hasData: Boolean(saved),
          error: error instanceof Error ? error.message : "Could not load your pipeline." });
      });
    };
    const reload = () => load();
    const visible = () => { if (document.visibilityState === "visible") load(); };
    const storage = (event: StorageEvent) => {
      // Ordinary cache reads also write storage. Only committed edits invalidate it.
      if (isPipelineMutationStorage(event) || event.key === null) load();
    };
    retryRef.current = () => load(true);
    load();
    window.addEventListener("kanban-pipeline-updated", reload);
    window.addEventListener("atcis-pipeline-saved", reload);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      retryRef.current = null;
      // The shared request may finish and warm the cache after navigation.
      window.removeEventListener("kanban-pipeline-updated", reload);
      window.removeEventListener("atcis-pipeline-saved", reload);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [key, accessScope, activeAmEmail]);

  const board = useMemo(() => {
    const filtered = emptyPipelineBoard();
    if (result?.key !== key) return filtered;

    const isAm = user?.role === "account_manager";
    const userEmail = (user?.email || "").toLowerCase().trim();
    const userName = (user?.name || "").toLowerCase().trim();
    const userFirst = userName.split(" ")[0];
    const userLast = userName.split(" ").slice(-1)[0];

    for (const stage of Object.keys(filtered) as (keyof BoardState)[]) {
      filtered[stage] = result.board[stage].filter(task => {
        // Enforce Country Scope / Country Admin boundary
        if (effectiveCountryScope !== "ALL") {
          if (task.countryCode && task.countryCode !== effectiveCountryScope) {
            return false;
          }
          const ref = String(task.refNo || task.id || "").toUpperCase();
          const entity = String(task.entity || "").toLowerCase();
          if (effectiveCountryScope === "ZW") {
            if (ref.startsWith("ZPPA") || entity.includes("zambia") || entity.includes("zesco") || entity.includes("rda") || entity.includes("lusaka") || entity.includes("lwsc")) {
              return false;
            }
          } else if (effectiveCountryScope === "ZM") {
            if (ref.startsWith("PRAZ") || entity.includes("zim") || entity.includes("zetdc") || entity.includes("harare") || entity.includes("potraz") || entity.includes("natpharm") || entity.includes("mofed")) {
              return false;
            }
          }
        }

        if (isAm) {
          const anyTask = task as any;
          if (anyTask.assignedToEmail && String(anyTask.assignedToEmail).toLowerCase().trim() === userEmail) {
            return true;
          }
          if (anyTask.assignedToId && String(anyTask.assignedToId) === String(user?.id)) {
            return true;
          }
          if (anyTask.ownerEmail && String(anyTask.ownerEmail).toLowerCase().trim() === userEmail) {
            return true;
          }

          const ownerName = (task.owner?.name || "").toLowerCase().trim();
          if (ownerName && userName) {
            if (ownerName === userName) return true;
            if (userFirst && userFirst.length > 2 && ownerName.includes(userFirst)) return true;
            if (userLast && userLast.length > 2 && ownerName.includes(userLast)) return true;
          }

          const emailPrefix = userEmail.split("@")[0].split(".")[0];
          if (emailPrefix && emailPrefix.length > 2 && ownerName && ownerName.includes(emailPrefix)) {
            return true;
          }

          if (ownerName === "account manager") {
            return true;
          }

          return false;
        }

        // HOD / Country Admin oversight: filter by selected member (HOD, AM) if not 'all'
        if (isHodOrAdmin && activeAmEmail !== "all") {
          const selectedMember = availableAms.find(m => m.email.toLowerCase() === activeAmEmail.toLowerCase());
          if (selectedMember && !taskMatchesMember(task, selectedMember)) {
            return false;
          }
        }

        return true;
      });
    }
    return filtered;
  }, [result, key, effectiveCountryScope, user, isHodOrAdmin, activeAmEmail, availableAms]);

  return {
    board,
    user,
    effectiveCountryScope,
    isHodOrAdmin,
    availableAms,
    activeAmEmail,
    handleAmChange: (email: string) => {
      setDashboardSelection(accessScope, email);
      setSelectedEmail(email);
    },
    loading: result?.key !== key,
    error: result?.key === key && !result.hasData ? result.error : null,
    refreshError: result?.key === key && result.hasData ? result.error : null,
    retry: () => retryRef.current?.(),
  };
}

export type DashboardPipeline = ReturnType<typeof useDashboardPipeline>;
