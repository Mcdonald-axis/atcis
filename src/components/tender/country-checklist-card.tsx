"use client";

import { CheckCircle2, Circle, Download, Link2, ListChecks, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, createClientId } from "@/lib/utils";

import type { ChecklistRequirement, CountryChecklistState, CountryChecklistTemplate } from "./use-country-checklist";
import { ChecklistDocumentPicker } from "./checklist-document-picker";

const requirementLevels: ChecklistRequirement["status"][] = ["Mandatory", "Conditional", "Standard", "Optional"];

function ChecklistEditor({ state, template, personal = false, onClose }: {
  state: CountryChecklistState;
  template?: Pick<CountryChecklistTemplate, "id" | "name" | "items">;
  personal?: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(template?.name || "");
  const [items, setItems] = useState<ChecklistRequirement[]>(template?.items.map((item) => ({ ...item })) || []);
  const [validation, setValidation] = useState("");
  const update = (id: string, patch: Partial<ChecklistRequirement>) =>
    setItems((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  const hasEvidence = (id: string) => personal && !!state.completed[id];

  return (
    <form className="flex flex-col gap-4 rounded-lg border p-4" onSubmit={async (event) => {
      event.preventDefault();
      if (!name.trim() || !items.length || items.some((item) => !item.item.trim())) {
        setValidation("Enter a name and at least one named requirement.");
        return;
      }
      setValidation("");
      const requirements = items.map((item) => hasEvidence(item.id) ? item : ({
        ...item, item: item.item.trim(), category: item.category.trim(), description: item.description.trim(),
      }));
      const saved = personal
        ? await state.savePersonalChecklist(name, requirements)
        : await state.saveTemplate(name, requirements, template?.id);
      if (saved) onClose();
    }}>
      <p className="font-semibold">
        {personal ? "Your checklist" : template ? "Edit country template" : "Create country template"}
      </p>
      <p className="text-xs text-muted-foreground">
        {personal
          ? "Add the documents you need for this tender. Your checklist is saved to your account."
          : "Everyone in this country can reuse this template. Changes apply when a template is applied to a tender."}
      </p>
      <fieldset disabled={state.busy} className="flex min-w-0 flex-col gap-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="checklist-template-name">{personal ? "Checklist name" : "Template name"}</FieldLabel>
            <Input id="checklist-template-name" value={name} onChange={(event) => setName(event.target.value)}
              maxLength={200} required placeholder={personal ? "e.g. My tender requirements" : "e.g. Standard government tender"} />
          </Field>
        </FieldGroup>
        {items.map((item, index) => (
          <FieldGroup key={item.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Requirement {index + 1}</p>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove requirement ${index + 1}`}
                disabled={hasEvidence(item.id)}
                onClick={() => setItems((rows) => rows.filter((row) => row.id !== item.id))}>
                <Trash2 data-icon="inline-start" />
              </Button>
            </div>
            {hasEvidence(item.id) && (
              <p className="text-xs text-muted-foreground">Remove this requirement’s attachments before editing it.</p>
            )}
            <Field>
              <FieldLabel htmlFor={`requirement-${item.id}`}>Document required</FieldLabel>
              <Input id={`requirement-${item.id}`} value={item.item} maxLength={500} required
                disabled={hasEvidence(item.id)}
                onChange={(event) => update(item.id, { item: event.target.value })}
                placeholder="e.g. Tax clearance certificate" />
            </Field>
            <Field>
              <FieldLabel htmlFor={`category-${item.id}`}>Category</FieldLabel>
              <Input id={`category-${item.id}`} value={item.category} maxLength={100}
                disabled={hasEvidence(item.id)}
                onChange={(event) => update(item.id, { category: event.target.value })} placeholder="e.g. Statutory" />
            </Field>
            <Field>
              <FieldLabel htmlFor={`status-${item.id}`}>Requirement level</FieldLabel>
              <Select value={item.status} disabled={state.busy || hasEvidence(item.id)} onValueChange={(value) => {
                const status = requirementLevels.find((level) => level === value);
                if (status) update(item.id, { status });
              }}>
                <SelectTrigger id={`status-${item.id}`} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>
                  {requirementLevels.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectGroup></SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor={`description-${item.id}`}>Description</FieldLabel>
              <Input id={`description-${item.id}`} value={item.description} maxLength={2000}
                disabled={hasEvidence(item.id)}
                onChange={(event) => update(item.id, { description: event.target.value })} />
            </Field>
          </FieldGroup>
        ))}
        <Button type="button" variant="outline" disabled={items.length >= 100} onClick={() => setItems((rows) => [
          ...rows, { id: createClientId(), item: "", category: "Statutory", status: "Mandatory", description: "" },
        ])}>
          <Plus data-icon="inline-start" />Add requirement
        </Button>
        {validation && <p role="alert" className="text-sm text-destructive">{validation}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!items.length}>
            {state.busy && <Loader2 className="animate-spin" data-icon="inline-start" />}
            {personal ? "Save checklist" : "Save template"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function CountryChecklistCard({ state, country }: { state: CountryChecklistState; country: string }) {
  const [selectedId, setSelectedId] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null);
  const [editor, setEditor] = useState<CountryChecklistTemplate | "new" | "personal" | null>(null);
  const selected = state.templates.find((template) => template.id === selectedId)
    || state.templates.find((template) => template.id === state.instance?.template_id)
    || state.templates[0];
  const completedCount = state.items.filter((item) => state.completed[item.id]).length;
  const progress = state.items.length ? Math.round(completedCount / state.items.length * 100) : 0;
  const hasUploads = state.items.some((item) => item.attachedFiles.length > 0);
  const countryName = country === "ZW" ? "Zimbabwe" : country === "ZM" ? "Zambia" : country;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2"><ListChecks className="size-5 text-primary" />Compliance Checklist</CardTitle>
          <Badge variant="outline">{countryName}</Badge>
        </div>
        <CardDescription>
          Apply a country template or create your own checklist. Upload a file or link a saved document to complete each item.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state.loading ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />Loading country templates and checklist…
          </p>
        ) : state.error ? (
          <Alert variant="destructive">
            <AlertTitle>Checklist unavailable</AlertTitle>
            <AlertDescription>
              <p>{state.error}</p>
              <Button variant="outline" size="sm" onClick={state.retry}>Retry</Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {state.templates.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Field>
                  <FieldLabel htmlFor="country-checklist-template">Country template</FieldLabel>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select value={selected?.id || ""} onValueChange={setSelectedId} disabled={state.busy}>
                      <SelectTrigger id="country-checklist-template" className="w-full min-w-0 flex-1">
                        <SelectValue placeholder="Select a template" />
                      </SelectTrigger>
                      <SelectContent><SelectGroup>
                        {state.templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
                      </SelectGroup></SelectContent>
                    </Select>
                    <Button disabled={state.busy || !selected || hasUploads || editor !== null || addingItem}
                      onClick={() => selected && state.applyTemplate(selected.id)}>
                      <Plus data-icon="inline-start" />Apply
                    </Button>
                  </div>
                </Field>
                {hasUploads && <p className="text-xs text-muted-foreground">Remove attached documents before replacing this tender’s checklist.</p>}
              </div>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No country templates yet</EmptyTitle>
                  <EmptyDescription>
                    {state.canManage
                      ? `Create a reusable template for ${countryName}, or start your own checklist below.`
                      : "You can create your own checklist now. Country templates will appear here when your admin adds them."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            <Button variant="outline" size="sm" disabled={state.busy || addingItem} onClick={() => setEditor("personal")}>
              {state.instance ? <Pencil data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
              {state.instance
                ? state.instance.template_id ? "Customize my checklist" : "Edit my checklist"
                : "Create your own checklist"}
            </Button>
            {state.canManage && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={state.busy} onClick={() => setEditor("new")}>
                  <Plus data-icon="inline-start" />Create template
                </Button>
                {selected && <Button variant="outline" size="sm" disabled={state.busy} onClick={() => setEditor(selected)}>
                  <Pencil data-icon="inline-start" />Edit template
                </Button>}
              </div>
            )}
            {editor === "personal" && (
              <ChecklistEditor key={`personal:${state.instance?.id || "new"}`} state={state} personal
                template={state.instance ? {
                  id: state.instance.id, name: state.instance.template_name, items: state.instance.items,
                } : undefined} onClose={() => setEditor(null)} />
            )}
            {state.canManage && editor && editor !== "personal" && (
              <ChecklistEditor key={editor === "new" ? "new" : editor.id} state={state}
                template={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} />
            )}
            {state.instance ? (
              <>
                <Button variant="outline" size="sm" disabled={state.busy || state.items.length >= 100 || editor !== null}
                  onClick={() => setAddingItem(true)}>
                  <Plus data-icon="inline-start" />Add item
                </Button>
                {addingItem && <form className="flex flex-col gap-3 rounded-lg border p-3" onSubmit={async (event) => {
                  event.preventDefault();
                  if (await state.addItem(newItemName)) { setNewItemName(""); setAddingItem(false); }
                }}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="new-checklist-item">Item name</FieldLabel>
                      <Input id="new-checklist-item" required maxLength={500} value={newItemName} disabled={state.busy}
                        onChange={(event) => setNewItemName(event.target.value)} placeholder="Document required" />
                    </Field>
                  </FieldGroup>
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={state.busy}
                      onClick={() => { setAddingItem(false); setNewItemName(""); }}>Cancel</Button>
                    <Button type="submit" size="sm" disabled={state.busy || !newItemName.trim()}>Save item</Button>
                  </div>
                </form>}
                <div className="flex flex-col gap-2" aria-live="polite">
                  <p className="text-xs text-muted-foreground">
                    {state.instance.template_id ? "Applied template" : "Your checklist"}: {state.instance.template_name}
                  </p>
                  <p className="text-sm font-medium">{completedCount} / {state.items.length} items complete ({progress}%)</p>
                  <Progress value={progress} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
                    aria-label="Checklist completion" />
                </div>
                <ul className="flex flex-col gap-3">
                  {state.items.map((item) => (
                    <li key={item.id} className="flex flex-col gap-3 rounded-lg border p-3">
                      <div className="flex items-start gap-3">
                        {state.completed[item.id]
                          ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-label="Completed" />
                          : <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-label="Document required" />}
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <p className={cn("text-sm font-semibold break-words", state.completed[item.id] && "text-muted-foreground line-through")}>{item.item}</p>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant={item.status === "Mandatory" ? "default" : "secondary"}>{item.status}</Badge>
                            {item.category && <Badge variant="outline">{item.category}</Badge>}
                            {state.completed[item.id] && <Badge variant="secondary">Document attached</Badge>}
                          </div>
                          {item.description && <p className="text-xs text-muted-foreground break-words">{item.description}</p>}
                        </div>
                      </div>
                      {item.attachedFiles.map((file) => (
                        <div key={file.id} className="flex min-w-0 items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-xs" title={file.name}>{file.name}</span>
                          {file.repository_document_id && <Badge variant="outline">Linked</Badge>}
                          <span className="text-xs text-muted-foreground">{Math.ceil(file.size / 1024)} KB</span>
                          <Button variant="ghost" size="icon-sm" disabled={state.busy}
                            aria-label={`Download ${file.name}`} onClick={() => state.download(file)}>
                            <Download data-icon="inline-start" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" disabled={state.busy}
                            aria-label={`${file.repository_document_id ? "Unlink" : "Remove"} ${file.name}`}
                            onClick={() => state.removeAttachment(file)}>
                            <Trash2 data-icon="inline-start" />
                          </Button>
                        </div>
                      ))}
                      <Field>
                        <FieldLabel htmlFor={`upload-${item.id}`}><Upload className="size-4" />Upload document</FieldLabel>
                        <Input id={`upload-${item.id}`} type="file" disabled={state.busy}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.zip,.rar,.txt,.csv"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file) void state.upload(item.id, file);
                          }} />
                      </Field>
                      <Button variant="outline" size="sm" disabled={state.busy}
                        onClick={() => setLinkingItemId(item.id)}><Link2 data-icon="inline-start" />Link from Documents</Button>
                      {linkingItemId === item.id && <ChecklistDocumentPicker country={country} busy={state.busy}
                        linkedIds={item.attachedFiles.flatMap((file) => file.repository_document_id ? [file.repository_document_id] : [])}
                        onLink={(documentId) => state.linkDocument(item.id, documentId)}
                        onClose={() => setLinkingItemId(null)} />}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Maximum 20 MB per document. Removing the last attachment reopens the item. Unlinking keeps the original in Documents.
                </p>
              </>
            ) : state.templates.length > 0 && (
              <p className="text-sm text-muted-foreground">Apply a template or create your own checklist to get started.</p>
            )}
            {state.busy && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />Saving…
            </p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
