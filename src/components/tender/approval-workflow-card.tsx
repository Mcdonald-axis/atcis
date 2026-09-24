"use client";

import { useId, useRef, useState } from "react";

import Link from "next/link";

import { Download, Eye, FileText, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { ChecklistDocItem, ChecklistSubmission, ReviewChecklistRequirement } from "@/lib/server-db";
import type { AuthUser } from "@/services/auth-service";

import { downloadReviewFiles } from "./review-download";

const reviewers = [
  { name: "HOD Review", role: "Head of Department" },
  { name: "Technical Review", role: "Lead Engineer / Architect" },
  { name: "Committee Review", role: "Executive Bid Committee" },
];

interface Props {
  submission: ChecklistSubmission | null;
  profile: Pick<AuthUser, "role" | "email"> | null;
  loading?: boolean;
  error?: string;
  submit?: { checklistId: string; tenderRef: string; tenderTitle: string; entity: string };
  blockedReason?: string;
  showDocuments?: boolean;
  onChange: (submission: ChecklistSubmission) => void;
  onRefresh: () => void;
  onBusyChange?: (busy: boolean) => void;
}

interface CategorizedReviewDocument extends ChecklistDocItem {
  displayCategory: string;
  requirement?: ReviewChecklistRequirement;
}

function categorizeReviewDocuments(submission: ChecklistSubmission) {
  const requirements = submission.requirements ?? [];
  const requirementOrder = new Map(requirements.map((requirement, index) => [requirement.item.toLowerCase(), index]));
  const categoryOrder = new Map<string, number>();
  for (const requirement of requirements) {
    const category = requirement.category.trim() || "Uncategorized";
    if (!categoryOrder.has(category)) categoryOrder.set(category, categoryOrder.size);
  }

  const groups = new Map<string, CategorizedReviewDocument[]>();
  for (const file of submission.checklist) {
    const requirement = requirements.find((item) => item.item.trim().toLowerCase() === file.name.trim().toLowerCase());
    const sourceCategory = file.category.trim();
    const referenceDocument =
      sourceCategory.toLowerCase() === "reference" || sourceCategory.toLowerCase() === "reference documents";
    let displayCategory = sourceCategory || requirement?.category.trim() || "Uncategorized";
    if (referenceDocument) {
      displayCategory = "Reference Documents";
    } else if (sourceCategory.toLowerCase() === "checklist") {
      displayCategory = requirement?.category.trim() || "Uncategorized";
    }
    const row = { ...file, displayCategory, requirement };
    groups.set(displayCategory, [...(groups.get(displayCategory) || []), row]);
  }

  return [...groups.entries()]
    .map(([category, files]) => ({
      category,
      files: files.sort((left, right) => {
        const leftOrder = requirementOrder.get(left.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = requirementOrder.get(right.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
        return leftOrder - rightOrder || left.name.localeCompare(right.name);
      }),
    }))
    .sort((left, right) => {
      if (left.category === "Reference Documents") return 1;
      if (right.category === "Reference Documents") return -1;
      return (
        (categoryOrder.get(left.category) ?? Number.MAX_SAFE_INTEGER) -
          (categoryOrder.get(right.category) ?? Number.MAX_SAFE_INTEGER) || left.category.localeCompare(right.category)
      );
    });
}

export function ApprovalWorkflowCard({
  submission,
  profile,
  loading,
  error,
  submit,
  blockedReason,
  showDocuments,
  onChange,
  onRefresh,
  onBusyChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [comments, setComments] = useState("");
  const [previewFile, setPreviewFile] = useState<ChecklistDocItem | null>(null);
  const commentsId = useId();
  const approved = submission?.overallStatus === "Approved for Submission";
  const declined = submission?.overallStatus === "Declined";
  const revision = submission?.overallStatus === "Revision Requested" || declined;
  const legacy = !!submission && !submission.checklistId;
  const step = submission?.approvalSteps[submission.currentStepIndex];
  const canReview =
    !legacy &&
    submission?.overallStatus === "In Review" &&
    step?.status === "Pending" &&
    profile?.role === step.requiredRole &&
    profile.email.toLowerCase() !== submission.submittedByEmail.toLowerCase();
  const canSubmit =
    !!submit &&
    (!submission || revision) &&
    !!profile &&
    ["account_manager", "hod", "country_admin", "super_admin"].includes(profile.role);
  const documentGroups = submission ? categorizeReviewDocuments(submission) : [];

  async function act(action: "submit_checklist" | "approve_step" | "request_revision" | "decline_submission") {
    if (running.current) return;
    if ((action === "request_revision" || action === "decline_submission") && !comments.trim()) {
      toast.error("Enter a reason for declining or requesting revision");
      return;
    }
    running.current = true;
    setBusy(true);
    onBusyChange?.(true);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          submission:
            action === "submit_checklist"
              ? { ...submit, id: `checklist-${submit!.checklistId}`, revision: submission?.revision ?? 0 }
              : { id: submission!.id, revision: submission!.revision },
          stepId: step?.stepId,
          comments,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not save review action");
      onChange(result.data);
      setComments("");
      toast.success(
        action === "submit_checklist"
          ? "Submitted to HOD Review"
          : action === "decline_submission"
            ? "Submission declined — the AM can see your reason"
            : action === "request_revision"
              ? "Returned to the AM for revision"
              : result.data.overallStatus === "Approved for Submission"
                ? "Approved — complete package ready to download"
                : "Approved and sent to the next reviewer",
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Review action failed");
      onRefresh();
    } finally {
      running.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  async function download(fileId?: string) {
    if (!submission || running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await downloadReviewFiles(submission.id, fileId);
      toast.success("Download started");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Download failed");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck />
            Approval Workflow
          </CardTitle>
          <CardDescription>AM submission → HOD → Technical → Committee → Approved</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={busy || loading}>
            <RefreshCw data-icon="inline-start" />
            Refresh status
          </Button>
          {loading && <p role="status">Loading approval status…</p>}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Approval status unavailable</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {legacy && (
            <Alert>
              <AlertTitle>Documents need to be submitted</AlertTitle>
              <AlertDescription>
                This older record has no saved file package. Submit the actual checklist from the tender page.
              </AlertDescription>
            </Alert>
          )}
          {!loading && !error && !legacy && (
            <>
              <ol className="flex flex-col gap-3" aria-label="Approval stages">
                <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <span>1. {declined ? "Submission declined" : revision ? "Revision requested" : "AM submission"}</span>
                  <Badge variant="outline">
                    {declined ? "Declined" : revision ? "Changes needed" : submission ? "Submitted" : "Pending"}
                  </Badge>
                </li>
                {reviewers.map((reviewer, index) => {
                  const recorded = submission?.approvalSteps[index];
                  return (
                    <li key={reviewer.name} className="flex flex-col gap-2 rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {index + 2}. {reviewer.name}
                        </span>
                        <Badge variant={recorded?.status === "Approved" ? "default" : "outline"}>
                          {recorded?.status || "Waiting"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{reviewer.role}</p>
                      {recorded?.approvedByName && (
                        <p className="text-sm text-muted-foreground">
                          {recorded.approvedByName} ·{" "}
                          {recorded.approvedAt && new Date(recorded.approvedAt).toLocaleString()}
                        </p>
                      )}
                      {recorded?.comments && (
                        <p className="whitespace-pre-wrap break-words text-sm">{recorded.comments}</p>
                      )}
                    </li>
                  );
                })}
                <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <span>5. Approved</span>
                  <Badge variant={approved ? "default" : "outline"}>{approved ? "Complete" : "Waiting"}</Badge>
                </li>
              </ol>
              {submission && (
                <p className="text-sm text-muted-foreground">
                  Submitted by {submission.submittedByName} · Revision {submission.revision ?? 1}
                </p>
              )}
              {canSubmit && (
                <>
                  {blockedReason && <p className="text-sm text-muted-foreground">{blockedReason}</p>}
                  <Button disabled={busy || !!blockedReason} onClick={() => act("submit_checklist")}>
                    {busy ? "Submitting…" : revision ? "Resubmit to HOD Review" : "Submit to HOD Review"}
                  </Button>
                </>
              )}
              {!submission && !submit && (
                <p className="text-sm text-muted-foreground">Create and complete your checklist to submit it.</p>
              )}
              {canReview && (
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor={commentsId}>Review comments</FieldLabel>
                    <Textarea
                      id={commentsId}
                      value={comments}
                      onChange={(event) => setComments(event.target.value)}
                      disabled={busy}
                      maxLength={5000}
                      placeholder="Required when declining or requesting changes"
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => act("approve_step")} disabled={busy}>
                      Accept {step?.stepName}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => act("decline_submission")}
                      disabled={busy || !comments.trim()}
                    >
                      Decline submission
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => act("request_revision")}
                      disabled={busy || !comments.trim()}
                    >
                      Request revision
                    </Button>
                  </div>
                </FieldGroup>
              )}
              {submission && !revision && (
                <p className="text-sm text-muted-foreground">
                  {approved
                    ? "All reviewers approved this package. Its documents are locked."
                    : "Documents are locked while the assigned reviewers assess this package."}
                </p>
              )}
              {revision && !canSubmit && (
                <Button asChild variant="outline">
                  <Link href="/dashboard/tender-pipeline">Open tender checklist to make changes</Link>
                </Button>
              )}
              <Button disabled={!approved || busy} onClick={() => download()}>
                <Download data-icon="inline-start" />
                Download all files (.zip)
              </Button>
              <p className="text-sm text-muted-foreground">
                Includes checklist files, reference documents, and the approval record. Available after Committee
                approval.
              </p>
              {showDocuments && submission && (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="font-medium">Submitted document package ({submission.checklist.length})</p>
                    <p className="text-xs text-muted-foreground">
                      Grouped by the same categories and requirement levels used in the submitted checklist.
                    </p>
                  </div>
                  {documentGroups.map((group) => (
                    <section key={group.category} className="overflow-hidden rounded-lg border">
                      <div className="flex items-center justify-between gap-2 border-b bg-muted/45 px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <FileText className="size-4 text-primary" />
                          <h4 className="text-sm font-semibold">{group.category}</h4>
                        </div>
                        <Badge variant="outline">
                          {group.files.length} {group.files.length === 1 ? "document" : "documents"}
                        </Badge>
                      </div>
                      <div className="divide-y">
                        {group.files.map((file) => (
                          <div
                            key={file.id}
                            className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="break-words font-medium">{file.name}</p>
                                {file.requirement?.status && (
                                  <Badge variant={file.requirement.status === "Mandatory" ? "default" : "secondary"}>
                                    {file.requirement.status}
                                  </Badge>
                                )}
                              </div>
                              {file.requirement?.description && (
                                <p className="break-words text-xs text-muted-foreground">
                                  {file.requirement.description}
                                </p>
                              )}
                              <p className="break-all text-xs text-muted-foreground">
                                {file.fileName}
                                {file.fileSize ? ` · ${file.fileSize}` : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPreviewFile(file)}
                                disabled={busy}
                                aria-label={`Preview ${file.fileName}`}
                              >
                                <Eye data-icon="inline-start" /> Preview
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => download(file.id)}
                                disabled={busy}
                                aria-label={`Download ${file.fileName}`}
                              >
                                <Download data-icon="inline-start" /> Download
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
              {!!submission?.history?.length && (
                <details>
                  <summary className="cursor-pointer">Previous review attempts ({submission.history.length})</summary>
                  <div className="flex flex-col gap-2 pt-2">
                    {submission.history.map((attempt) => (
                      <div key={attempt.revision} className="rounded-lg border p-3 text-sm">
                        <p>Revision {attempt.revision}</p>
                        {attempt.approvalSteps.map((record) => (
                          <p key={record.stepId} className="break-words">
                            {record.stepName}: {record.status}
                            {record.approvedByName && ` — ${record.approvedByName}`}
                            {record.comments && `: ${record.comments}`}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(previewFile)}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(null);
        }}
      >
        <DialogContent className="h-[88vh] max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{previewFile?.name || "Document preview"}</DialogTitle>
            <DialogDescription>{previewFile?.fileName}</DialogDescription>
          </DialogHeader>
          {submission && previewFile && (
            <iframe
              key={previewFile.id}
              src={`/api/reviews/${encodeURIComponent(submission.id)}/preview?file=${encodeURIComponent(previewFile.id)}`}
              title={`Preview ${previewFile.fileName}`}
              className="size-full min-h-0 rounded-lg border bg-white"
            />
          )}
          <DialogFooter>
            {previewFile && (
              <Button variant="outline" size="sm" onClick={() => download(previewFile.id)} disabled={busy}>
                <Download data-icon="inline-start" /> Download original
              </Button>
            )}
            <Button type="button" size="sm" onClick={() => setPreviewFile(null)}>
              Close preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
