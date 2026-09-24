"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/browser";
import { createClientId, sha256Hex } from "@/lib/utils";

export interface ReferenceDocument {
  id: string;
  country: "ZW" | "ZM";
  tender_key: string;
  name: string;
  file_name: string;
  file_size: number;
  content_hash: string;
  storage_path: string;
}

const bucket = "reference-documents";
const errorMessage = (error: unknown) =>
  error && typeof error === "object" && "message" in error ? String(error.message) : "Reference document operation failed";

export function useReferenceDocuments(open: boolean, country?: string, tenderKey?: string) {
  const [documents, setDocuments] = useState<ReferenceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const generation = useRef(0);
  const pending = useRef(false);

  useEffect(() => {
    const current = ++generation.current;
    setDocuments([]);
    setLoading(true);
    setError("");
    if (!open) return;
    async function load() {
      try {
        if (!tenderKey || (country !== "ZW" && country !== "ZM")) throw new Error("A tender and country are required.");
        const client = createClient();
        const { data: auth, error: authError } = await client.auth.getUser();
        if (authError || !auth.user) throw new Error("Please sign in to load reference documents.");
        const { data, error: failure } = await client.from("tender_reference_documents").select("*")
          .eq("country", country).eq("tender_key", tenderKey).eq("owner_id", auth.user.id).order("created_at");
        if (failure) throw failure;
        if (generation.current === current) setDocuments(data as ReferenceDocument[]);
      } catch (cause) {
        if (generation.current === current) setError(errorMessage(cause));
      } finally {
        if (generation.current === current) setLoading(false);
      }
    }
    void load();
    return () => { generation.current++; };
  }, [open, country, tenderKey, reload]);

  async function run(action: (isCurrent: () => boolean) => Promise<void>) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    const current = generation.current;
    try {
      await action(() => generation.current === current);
      return true;
    } catch (cause) {
      toast.error(errorMessage(cause));
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function upload(name: string, file: File | null) {
    if (loading || error || !tenderKey || (country !== "ZW" && country !== "ZM")) return false;
    if (!name.trim() || !file) {
      toast.error("Enter the document name and choose a file.");
      return false;
    }
    if (name.trim().length > 200 || !file.size || file.size > 20 * 1024 * 1024) {
      toast.error("Use a name under 201 characters and a non-empty file no larger than 20 MB.");
      return false;
    }
    return run(async (isCurrent) => {
      const hash = await sha256Hex(await file.arrayBuffer());
      if (documents.some((document) => document.content_hash === hash)) {
        throw new Error("This file is already included. Choose a different reference document.");
      }
      const client = createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("Please sign in to upload documents.");
      const path = `${country}/${auth.user.id}/${createClientId()}`;
      const { error: uploadError } = await client.storage.from(bucket).upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data, error: saveError } = await client.from("tender_reference_documents").insert({
        country, tender_key: tenderKey, name: name.trim(), file_name: file.name,
        file_size: file.size, content_hash: hash, storage_path: path,
      }).select().single();
      if (saveError) {
        await client.storage.from(bucket).remove([path]);
        if (saveError.code === "23505") throw new Error("This reference document is already included.");
        throw saveError;
      }
      if (isCurrent()) setDocuments((rows) => [...rows, data as ReferenceDocument]);
      toast.success("Reference document uploaded");
    });
  }

  async function remove(document: ReferenceDocument) {
    return run(async (isCurrent) => {
      const client = createClient();
      const { error: failure } = await client.from("tender_reference_documents")
        .delete().eq("id", document.id).select("id").single();
      if (failure) throw failure;
      if (isCurrent()) setDocuments((rows) => rows.filter((row) => row.id !== document.id));
      const { error: storageError } = await client.storage.from(bucket).remove([document.storage_path]);
      if (storageError) toast.warning("Reference removed, but its stored file could not be deleted.");
      else toast.success("Reference document removed");
    });
  }

  async function download(reference: ReferenceDocument) {
    return run(async () => {
      const { data, error: failure } = await createClient().storage.from(bucket).download(reference.storage_path);
      if (failure) throw failure;
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = reference.file_name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  return {
    documents: documents.filter((document) => document.country === country && document.tender_key === tenderKey),
    loading, busy, error, upload, remove, download, retry: () => setReload((value) => value + 1),
  };
}

export type ReferenceDocumentsState = ReturnType<typeof useReferenceDocuments>;
