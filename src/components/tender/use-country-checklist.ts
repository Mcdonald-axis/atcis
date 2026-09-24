"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/browser";
import { createClientId } from "@/lib/utils";
import type { AuthUser } from "@/services/auth-service";

export interface ChecklistRequirement {
  id: string;
  item: string;
  status: "Mandatory" | "Conditional" | "Standard" | "Optional";
  description: string;
  category: string;
}

export interface CountryChecklistTemplate {
  id: string;
  country: "ZW" | "ZM";
  name: string;
  items: ChecklistRequirement[];
}

interface ChecklistInstance {
  id: string;
  country: "ZW" | "ZM";
  owner_id: string;
  tender_key: string;
  template_id: string | null;
  template_name: string;
  items: ChecklistRequirement[];
}

export interface ChecklistAttachment {
  id: string;
  checklist_id: string;
  item_id: string;
  name: string;
  size: number;
  storage_path: string;
  storage_bucket: "checklist-documents" | "repository-documents";
  repository_document_id: string | null;
  original_file_name?: string | null;
}

const bucket = "checklist-documents";
const message = (error: unknown) =>
  error && typeof error === "object" && "message" in error ? String(error.message) : "Checklist operation failed";

export function useCountryChecklist(open: boolean, country?: string, tenderKey?: string) {
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [templates, setTemplates] = useState<CountryChecklistTemplate[]>([]);
  const [instance, setInstance] = useState<ChecklistInstance | null>(null);
  const [attachments, setAttachments] = useState<ChecklistAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const generation = useRef(0);
  const operation = useRef(false);

  useEffect(() => {
    const current = ++generation.current;
    setProfile(null);
    setTemplates([]);
    setInstance(null);
    setAttachments([]);
    setError("");
    setLoading(true);
    if (!open) return;
    if (!tenderKey) {
      setError("A tender reference is required for this checklist.");
      setLoading(false);
      return;
    }
    if (country !== "ZW" && country !== "ZM") {
      setError("A Zimbabwe or Zambia country is required for this checklist.");
      setLoading(false);
      return;
    }
    const client = createClient();
    async function load() {
      try {
        const { data: auth, error: authError } = await client.auth.getUser();
        if (authError || !auth.user) throw new Error("Please sign in to load your checklist.");
        const [userResult, templateResult, checklistResult] = await Promise.all([
          client.from("profiles").select("*").eq("id", auth.user.id).eq("active", true).single(),
          client.from("checklist_templates").select("*").eq("country", country).order("name"),
          client.from("tender_checklists").select("*").eq("country", country)
            .eq("tender_key", tenderKey).eq("owner_id", auth.user.id).maybeSingle(),
        ]);
        for (const result of [userResult, templateResult, checklistResult]) if (result.error) throw result.error;
        const saved = checklistResult.data as ChecklistInstance | null;
        const files = saved
          ? await client.from("checklist_attachments").select("*").eq("checklist_id", saved.id).order("created_at")
          : { data: [], error: null };
        if (files.error) throw files.error;
        if (generation.current !== current) return;
        setProfile(userResult.data as AuthUser);
        setTemplates(templateResult.data as CountryChecklistTemplate[]);
        setInstance(saved);
        setAttachments(files.data as ChecklistAttachment[]);
      } catch (cause) {
        if (generation.current === current) setError(`Could not load checklist: ${message(cause)}`);
      } finally {
        if (generation.current === current) setLoading(false);
      }
    }
    void load();
    return () => { generation.current++; };
  }, [open, country, tenderKey, reload]);

  const canManage = profile?.role === "super_admin" ||
    (profile?.role === "country_admin" && profile.country === country);

  async function run(action: (isCurrent: () => boolean) => Promise<void>) {
    if (operation.current) return false;
    operation.current = true;
    setBusy(true);
    const current = generation.current;
    const isCurrent = () => current === generation.current;
    try {
      await action(isCurrent);
      return true;
    } catch (cause) {
      toast.error(message(cause));
      return false;
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  async function saveTemplate(name: string, items: ChecklistRequirement[], id?: string) {
    if (!canManage || (country !== "ZW" && country !== "ZM")) return false;
    return run(async (isCurrent) => {
      const client = createClient();
      const query = id
        ? client.from("checklist_templates").update({ name: name.trim(), items }).eq("id", id).eq("country", country)
        : client.from("checklist_templates").insert({ name: name.trim(), items, country });
      const { data, error: failure } = await query.select().single();
      if (failure) throw failure;
      if (isCurrent()) setTemplates((rows) => [...rows.filter((row) => row.id !== data.id), data]
        .sort((a, b) => a.name.localeCompare(b.name)));
      toast.success("Country checklist template saved");
    });
  }

  async function applyTemplate(id: string) {
    if (!tenderKey || loading || error) return false;
    return run(async (isCurrent) => {
      const { data, error: failure } = await createClient().rpc("apply_checklist_template", {
        p_template_id: id, p_tender_key: tenderKey,
      });
      if (failure) throw failure;
      if (isCurrent()) { setInstance(data as ChecklistInstance); setAttachments([]); }
      toast.success("Checklist saved for this tender");
    });
  }

  async function savePersonalChecklist(name: string, items: ChecklistRequirement[]) {
    if (!tenderKey || loading || error || (country !== "ZW" && country !== "ZM")) return false;
    return run(async (isCurrent) => {
      const { data, error: failure } = await createClient().rpc("save_personal_checklist", {
        p_country: country,
        p_tender_key: tenderKey,
        p_name: name.trim(),
        p_items: items,
        p_checklist_id: instance?.id || null,
      });
      if (failure) throw failure;
      if (isCurrent()) setInstance(data as ChecklistInstance);
      toast.success("Your checklist has been saved");
    });
  }

  async function upload(itemId: string, file: File) {
    if (!instance) return;
    if (!file.size || file.size > 20 * 1024 * 1024) {
      toast.error("Choose a non-empty document no larger than 20 MB.");
      return;
    }
    await run(async (isCurrent) => {
      const client = createClient();
      const path = `${instance.country}/${instance.owner_id}/${instance.id}/${createClientId()}`;
      const { error: uploadError } = await client.storage.from(bucket).upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data, error: saveError } = await client.from("checklist_attachments").insert({
        checklist_id: instance.id, item_id: itemId, name: file.name, size: file.size, storage_path: path,
      }).select().single();
      if (saveError) {
        await client.storage.from(bucket).remove([path]);
        throw saveError;
      }
      if (isCurrent()) setAttachments((files) => [...files, data as ChecklistAttachment]);
      toast.success("Document uploaded — requirement completed");
    });
  }

  async function addItem(title: string) {
    if (!instance || !title.trim()) return false;
    return run(async (isCurrent) => {
      const { data, error: failure } = await createClient().rpc("add_checklist_item", {
        p_checklist_id: instance.id,
        p_item: {
          id: createClientId(), item: title.trim(), status: "Mandatory", category: "", description: "",
        },
      });
      if (failure) throw failure;
      if (isCurrent()) setInstance(data as ChecklistInstance);
      toast.success("Checklist item added");
    });
  }

  async function linkDocument(itemId: string, documentId: string) {
    if (!instance) return false;
    return run(async (isCurrent) => {
      const { data, error: failure } = await createClient().rpc("link_checklist_document", {
        p_checklist_id: instance.id, p_item_id: itemId, p_document_id: documentId,
      });
      if (failure?.code === "23505") throw new Error("This document is already linked to the item.");
      if (failure) throw failure;
      if (isCurrent()) setAttachments((files) => [...files, data as ChecklistAttachment]);
      toast.success("Document linked — requirement completed");
    });
  }

  async function removeAttachment(file: ChecklistAttachment) {
    await run(async (isCurrent) => {
      const client = createClient();
      const { data, error: failure } = await client.from("checklist_attachments")
        .delete().eq("id", file.id).select("id").single();
      if (failure || !data) throw failure || new Error("Document could not be removed");
      if (isCurrent()) setAttachments((files) => files.filter((row) => row.id !== file.id));
      if (file.repository_document_id) {
        toast.success("Document unlinked from checklist");
        return;
      }
      const { error: storageError } = await client.storage.from(bucket).remove([file.storage_path]);
      if (storageError) toast.warning("Document detached, but its stored file could not be deleted.");
      else toast.success("Document removed");
    });
  }

  async function download(file: ChecklistAttachment) {
    await run(async () => {
      const { data, error: failure } = await createClient().storage
        .from(file.storage_bucket || bucket).download(file.storage_path);
      if (failure) throw failure;
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.original_file_name || file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  const currentInstance = instance && instance.country === country && instance.tender_key === tenderKey ? instance : null;
  const items = (currentInstance?.items || []).map((item) => ({
    ...item,
    attachedFiles: attachments.filter((file) => file.item_id === item.id),
  }));
  const completed = Object.fromEntries(items.map((item) => [item.id, item.attachedFiles.length > 0]));
  return {
    profile,
    templates: templates.filter((template) => template.country === country),
    instance: currentInstance, items, completed, canManage, loading, busy, error,
    saveTemplate, savePersonalChecklist, applyTemplate, addItem, linkDocument, upload, removeAttachment, download,
    retry: () => setReload((value) => value + 1),
  };
}

export type CountryChecklistState = ReturnType<typeof useCountryChecklist>;
