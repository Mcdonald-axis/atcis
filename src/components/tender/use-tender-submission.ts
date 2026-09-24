"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChecklistSubmission } from "@/lib/server-db";

export function useTenderSubmission(open: boolean, checklistId?: string) {
  const [saved, setSaved] = useState<ChecklistSubmission | null>(null);
  const [loadedId, setLoadedId] = useState<string>();
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const writes = useRef(0);
  const currentId = useRef(checklistId);
  currentId.current = checklistId;
  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    setSaved(null);
    setLoadedId(undefined);
    setError("");
    if (!open || !checklistId) return;
    const controller = new AbortController();
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      const writeVersion = writes.current;
      try {
        const response = await fetch(`/api/reviews?checklistId=${encodeURIComponent(checklistId!)}`, {
          signal: controller.signal, cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Could not load approval status");
        if (!controller.signal.aborted && writeVersion === writes.current) { setSaved(result.data); setError(""); }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load approval status");
      } finally {
        if (!controller.signal.aborted) setLoadedId(checklistId);
        pending = false;
      }
    }
    void load();
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 20000);
    window.addEventListener("focus", load);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", load); };
  }, [open, checklistId, version]);

  const submission = saved?.checklistId === checklistId ? saved : null;
  return {
    submission, error, refresh,
    loading: !!checklistId && loadedId !== checklistId,
    locked: submission?.overallStatus === "In Review" || submission?.overallStatus === "Approved for Submission",
    update: (value: ChecklistSubmission) => {
      if (value.checklistId !== currentId.current) return;
      writes.current += 1;
      setSaved(value);
      setLoadedId(value.checklistId);
    },
  };
}
