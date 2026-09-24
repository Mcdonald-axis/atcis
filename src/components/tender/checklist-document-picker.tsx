"use client";

import { Link2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface RepositoryDocument {
  id: string;
  name: string;
  documentRef?: string;
  countryCode: string;
  storagePath?: string;
  storageBucket?: string;
  sizeBytes?: number;
}

export function ChecklistDocumentPicker({ country, busy, linkedIds, onLink, onClose }: {
  country: string;
  busy: boolean;
  linkedIds: string[];
  onLink: (documentId: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [documents, setDocuments] = useState<RepositoryDocument[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/templates", { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error("Could not load documents.");
        if (!controller.signal.aborted) setDocuments(body.data.documents as RepositoryDocument[]);
      })
      .catch(() => { if (!controller.signal.aborted) setError("Could not load documents. Please try again."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  const visible = documents.filter((document) => [country, "ALL"].includes(document.countryCode)
    && `${document.name} ${document.documentRef || ""}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Link from Documents</p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" disabled={busy || loading}
            onClick={() => setReload((value) => value + 1)}>Refresh</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
        </div>
      </div>
      <Field>
        <FieldLabel htmlFor="checklist-document-search">Search documents</FieldLabel>
        <Input id="checklist-document-search" placeholder="Name or reference" value={search}
          onChange={(event) => setSearch(event.target.value)} />
      </Field>
      {loading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />Loading documents…
      </p> : error ? <div role="alert" className="flex flex-col gap-2">
        <p className="text-sm text-destructive">{error}</p>
        <Button size="sm" variant="outline" onClick={() => setReload((value) => value + 1)}>Retry</Button>
      </div> : visible.length ? <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
        {visible.map((document) => {
          const linked = linkedIds.includes(document.id);
          const hasFile = !!document.storagePath && document.storageBucket === "repository-documents"
            && (document.sizeBytes || 0) > 0;
          return <li key={document.id} className="flex items-center gap-2 rounded-md border p-2">
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm">{document.name}</p>
              {!hasFile && <p className="text-xs text-muted-foreground">Attach a file on the Documents page first.</p>}
            </div>
            <Button size="sm" variant="outline" disabled={busy || linked || !hasFile} onClick={async () => {
              if (await onLink(document.id)) onClose();
            }}><Link2 data-icon="inline-start" />{linked ? "Linked" : "Link"}</Button>
          </li>;
        })}
      </ul> : <p className="text-sm text-muted-foreground">No matching documents for this country.</p>}
      <a href="/dashboard/templates" target="_blank" rel="noopener noreferrer" className="text-sm underline">
        Open Documents page
      </a>
    </div>
  );
}
