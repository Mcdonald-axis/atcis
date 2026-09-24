"use client";

import { useEffect, useState } from "react";

import { toast } from "sonner";

export function useAppRecords<T>(kind: string): T[] {
  const [records, setRecords] = useState<T[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/records/${kind}`, { signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error("Could not load records from Supabase");
        setRecords(json.data);
      })
      .catch((error) => {
        if (error.name !== "AbortError") toast.error(error.message);
      });
    return () => controller.abort();
  }, [kind]);
  return records;
}
