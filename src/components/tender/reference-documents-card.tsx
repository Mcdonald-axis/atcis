"use client";

import { Download, FileText, Loader2, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import type { ReferenceDocumentsState } from "./use-reference-documents";

export function ReferenceDocumentsCard({ state }: { state: ReferenceDocumentsState }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const close = () => { setAdding(false); setName(""); setFile(null); };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2"><FileText className="size-5" />Reference Documents</CardTitle>
          <Badge variant={state.documents.length >= 3 ? "default" : "outline"}>
            {state.documents.length} / 3 uploaded
          </Badge>
        </div>
        <CardDescription>Three reference documents are required. Each entry needs a name and an uploaded file.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state.loading ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />Loading reference documents…
          </p>
        ) : state.error ? (
          <Alert variant="destructive">
            <AlertTitle>Reference documents unavailable</AlertTitle>
            <AlertDescription>
              <p>{state.error}</p>
              <Button size="sm" variant="outline" onClick={state.retry}>Retry</Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {!adding && <Button variant="outline" size="sm" disabled={state.busy} onClick={() => setAdding(true)}>
              <Plus data-icon="inline-start" />Add Reference Document
            </Button>}
            {adding && (
              <form className="flex flex-col gap-3 rounded-lg border p-3" onSubmit={async (event) => {
                event.preventDefault();
                if (await state.upload(name, file)) close();
              }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Add Reference Document</p>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={state.busy}
                    aria-label="Close reference document form" onClick={close}><X data-icon="inline-start" /></Button>
                </div>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="reference-document-name">Document name</FieldLabel>
                    <Input id="reference-document-name" placeholder="Document name" required maxLength={200}
                      value={name} disabled={state.busy} onChange={(event) => setName(event.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="reference-document-file">Document</FieldLabel>
                    <Input id="reference-document-file" type="file" required disabled={state.busy}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"
                      onChange={(event) => setFile(event.target.files?.[0] || null)} />
                  </Field>
                </FieldGroup>
                <p className="text-xs text-muted-foreground">Maximum file size: 20 MB.</p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={state.busy} onClick={close}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={state.busy || !name.trim() || !file}>
                    {state.busy && <Loader2 className="animate-spin" data-icon="inline-start" />}Save Document
                  </Button>
                </div>
              </form>
            )}
            {state.documents.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No reference documents uploaded</EmptyTitle>
                  <EmptyDescription>Add three documents to complete this requirement.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {state.documents.map((reference) => (
                  <li key={reference.id} className="flex items-center gap-2 rounded-lg border p-3">
                    <span className="min-w-0 flex-1 break-words text-sm font-medium">{reference.name}</span>
                    <Button variant="ghost" size="icon-sm" disabled={state.busy}
                      aria-label={`Download ${reference.name}`} onClick={() => state.download(reference)}>
                      <Download data-icon="inline-start" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" disabled={state.busy}
                      aria-label={`Remove ${reference.name}`} onClick={() => state.remove(reference)}>
                      <Trash2 data-icon="inline-start" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p aria-live="polite" className="text-xs text-muted-foreground">
              {state.documents.length >= 3 ? "Three-document requirement complete." : `${3 - state.documents.length} more document(s) required.`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
