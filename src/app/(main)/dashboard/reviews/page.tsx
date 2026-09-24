"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { ApprovalWorkflowCard } from "@/components/tender/approval-workflow-card";
import { downloadReviewFiles } from "@/components/tender/review-download";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthService, type AuthUser } from "@/services/auth-service";
import { formatCurrency } from "@/lib/utils";
import type {
  ChecklistSubmission,
  WorkflowStepConfig,
} from "@/lib/server-db";

export default function ReviewApprovalPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [submissions, setSubmissions] = useState<ChecklistSubmission[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowStepConfig[]>([]);
  const [activeTab, setActiveTab] = useState("submissions");
  const [isLoading, setIsLoading] = useState(true);

  // Selected submission for detail view / approval
  const [selectedSub, setSelectedSub] = useState<ChecklistSubmission | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [loadError, setLoadError] = useState("");
  const [downloadBusy, setDownloadBusy] = useState(false);

  // Load user & review data from database
  const loadData = async () => {
    const user = AuthService.getCurrentUser();
    setCurrentUser(user);
    setIsLoading(true);

    try {
      const res = await fetch("/api/reviews", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not load submissions");
      const rows: ChecklistSubmission[] = json.data.submissions || [];
      setSubmissions(rows);
      setSelectedSub((selected) => selected ? rows.find((row) => row.id === selected.id) || null : null);
      setWorkflow(json.data.workflow || []);
      setLoadError("");
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Could not load submissions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    window.addEventListener("atcis-auth-changed", loadData);
    window.addEventListener("focus", loadData);
    return () => {
      window.removeEventListener("atcis-auth-changed", loadData);
      window.removeEventListener("focus", loadData);
    };
  }, []);

  const userRole = currentUser?.role || "account_manager";
  const userCountry = currentUser?.country || "ALL";
  const isAccountManager = userRole === "account_manager";

  // Filter submissions by country if applicable
  const displayedSubmissions = submissions.filter((s) => {
    if (userCountry === "ALL") return true;
    return s.countryCode === userCountry;
  });

  // Calculate metrics
  const inReviewCount = displayedSubmissions.filter((s) => s.overallStatus === "In Review").length;
  const approvedCount = displayedSubmissions.filter((s) => s.overallStatus === "Approved for Submission").length;
  const revisionCount = displayedSubmissions.filter((s) => s.overallStatus === "Revision Requested" || s.overallStatus === "Declined").length;

  const handleDownloadAllDocs = async (submission: ChecklistSubmission) => {
    if (downloadBusy) return;
    setDownloadBusy(true);
    try {
      await downloadReviewFiles(submission.id);
      toast.success("Package download started");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not download the package");
    } finally { setDownloadBusy(false); }
  };

  const canUserApproveStep = (submission: ChecklistSubmission): boolean => {
    const step = submission.approvalSteps[submission.currentStepIndex];
    return !!submission.checklistId && submission.overallStatus === "In Review" && step?.status === "Pending"
      && userRole === step.requiredRole && currentUser?.email.toLowerCase() !== submission.submittedByEmail.toLowerCase();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/50 pb-5 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-2xl tracking-tight text-foreground sm:text-3xl">
              Review & Approval
            </h1>
            <Badge variant="outline" className="text-xs font-semibold">
              Multi-Stage Governance
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm pt-1">
            Submit checklist documents, route through HOD and Technical Review, and download approved bid packages.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="outline" onClick={loadData} disabled={isLoading}>Refresh submissions</Button>
          {/* Link to Atcis AI */}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10 font-semibold"
          >
            <Link href="/dashboard/atcis-ai">
              <Sparkles className="size-3.5 text-primary" />
              <span>Atcis AI</span>
              <ArrowRight className="size-3" />
            </Link>
          </Button>

          {/* Submit Checklist Button for AM */}
          <Button
            type="button"
            size="sm"
            asChild
            className="h-8 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
          >
            <Link href="/dashboard/tender-pipeline">Open tender checklist to submit</Link>
          </Button>
        </div>
      </div>

      {loadError && <Alert variant="destructive"><AlertTitle>Reviews unavailable</AlertTitle><AlertDescription>{loadError}</AlertDescription></Alert>}
      {/* Metric Cards Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total In Review</span>
              <FileCheck className="size-4 text-blue-500" />
            </div>
            <p className="mt-2 text-2xl font-bold font-mono text-foreground">{inReviewCount}</p>
            <p className="text-[11px] text-muted-foreground">Active in approval workflow</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Approved for Submission</span>
              <CheckCircle2 className="size-4 text-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{approvedCount}</p>
            <p className="text-[11px] text-muted-foreground">Ready for portal document download</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Declined / Changes Requested</span>
              <ShieldAlert className="size-4 text-amber-500" />
            </div>
            <p className="mt-2 text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">{revisionCount}</p>
            <p className="text-[11px] text-muted-foreground">Requires AM document amendment</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {isAccountManager ? "Pending HOD Review" : "Workflow Stages"}
              </span>
              {isAccountManager ? (
                <Clock className="size-4 text-primary" />
              ) : (
                <Settings2 className="size-4 text-purple-500" />
              )}
            </div>
            <p className="mt-2 text-2xl font-bold font-mono text-foreground">
              {isAccountManager
                ? displayedSubmissions.filter((s) => s.currentStepIndex === 0 && s.overallStatus === "In Review").length
                : `${workflow.length} Steps`}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isAccountManager ? "Awaiting Stage 1 sign-off" : "HOD → Tech → Committee"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs: Submissions vs Workflow Setup (Workflow Setup hidden for AMs) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {!isAccountManager && (
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="submissions" className="text-xs font-medium gap-1.5">
              <ShieldCheck className="size-3.5" />
              <span>Checklist Submissions ({displayedSubmissions.length})</span>
            </TabsTrigger>
            <TabsTrigger value="workflow" className="text-xs font-medium gap-1.5">
              <Settings2 className="size-3.5" />
              <span>Approval Sequence</span>
            </TabsTrigger>
          </TabsList>
        )}

        {/* TAB 1: Submissions List */}
        <TabsContent value="submissions" className="space-y-4">
          <Card className="border-border/60 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Tender Proposal Approvals</CardTitle>
                  <CardDescription className="text-xs">
                    Each checklist is reviewed sequentially by the HOD, Technical Review, and Committee before releasing the approved package.
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={loadData} className="h-8 gap-1 text-xs">
                  <RefreshCw className="size-3.5" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="border-b border-border/60 bg-muted/50 text-muted-foreground">
                      <tr>
                        <th scope="col" className="py-3.5 px-4 font-semibold text-foreground min-w-[260px]">
                          Tender Opportunity
                        </th>
                        <th scope="col" className="py-3.5 px-4 font-semibold text-foreground min-w-[140px]">
                          Submitted By
                        </th>
                        <th scope="col" className="py-3.5 px-4 font-semibold text-foreground min-w-[280px]">
                          Workflow Progress & Current Step
                        </th>
                        <th scope="col" className="py-3.5 px-4 font-semibold text-foreground min-w-[130px] whitespace-nowrap">
                          Checklist Items
                        </th>
                        <th scope="col" className="py-3.5 px-4 font-semibold text-foreground min-w-[120px] whitespace-nowrap">
                          Overall Status
                        </th>
                        <th scope="col" className="py-3.5 px-4 font-semibold text-foreground text-right min-w-[160px] whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {displayedSubmissions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-muted-foreground">
                            {isLoading ? "Loading submissions…" : "No submissions found. Open a tender checklist, attach its documents, and submit it to HOD Review."}
                          </td>
                        </tr>
                      ) : (
                        displayedSubmissions.map((sub) => {
                          const currentStep = sub.approvalSteps[sub.currentStepIndex] || sub.approvalSteps[sub.approvalSteps.length - 1];
                          const canApprove = canUserApproveStep(sub);
                          const isFullyApproved = sub.overallStatus === "Approved for Submission";

                          return (
                            <tr key={sub.id} className="transition-colors hover:bg-muted/30">
                              {/* 1. Tender Opportunity */}
                              <td className="align-top py-4 px-4">
                                <div className="space-y-1.5">
                                  <span className="inline-block font-mono font-bold text-primary text-[11px] bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                                    {sub.tenderRef}
                                  </span>
                                  <h4 className="font-semibold text-foreground text-xs leading-snug">
                                    {sub.tenderTitle}
                                  </h4>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <span className="truncate">{sub.entity}</span>
                                    {sub.bidAmount > 0 && <span className="font-mono font-bold text-foreground">
                                      {formatCurrency(sub.bidAmount, { noDecimals: true })}
                                    </span>}
                                  </div>
                                </div>
                              </td>

                              {/* 2. Submitted By */}
                              <td className="align-top py-4 px-4">
                                <div className="space-y-0.5">
                                  <span className="font-semibold text-foreground text-xs block">
                                    {sub.submittedByName}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-mono block">
                                    {new Date(sub.submittedAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </td>

                              {/* 3. Workflow Progress */}
                              <td className="align-top py-4 px-4">
                                <div className="space-y-2">
                                  {/* Stepper bar */}
                                  <div className="flex items-center gap-1.5">
                                    {sub.approvalSteps.map((step, idx) => (
                                      <div key={step.stepId} className="flex-1">
                                        <div
                                          className={`h-1.5 rounded-full ${
                                            step.status === "Approved"
                                              ? "bg-emerald-500"
                                              : step.status === "Pending"
                                              ? "bg-blue-500 animate-pulse"
                                              : step.status === "Revision Requested" || step.status === "Declined"
                                              ? "bg-amber-500"
                                              : "bg-muted"
                                          }`}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {isFullyApproved ? (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                        <Check className="size-3" />
                                        All {sub.approvalSteps.length} approvals complete
                                      </span>
                                    ) : (
                                      <span>
                                        Current: <strong className="text-foreground">{currentStep?.stepName}</strong>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* 4. Checklist Items */}
                              <td className="align-top py-4 px-4 whitespace-nowrap">
                                <div className="space-y-1">
                                  <span className="font-mono text-xs font-semibold">
                                    {sub.checklist.length} Documents
                                  </span>
                                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <FileCheck className="size-3" /> Files submitted
                                  </span>
                                </div>
                              </td>

                              {/* 5. Overall Status */}
                              <td className="align-top py-4 px-4 whitespace-nowrap">
                                <Badge
                                  variant={
                                    isFullyApproved
                                      ? "default"
                                      : sub.overallStatus === "In Review"
                                      ? "secondary"
                                      : "outline"
                                  }
                                  className={`text-[10px] font-medium ${
                                    isFullyApproved ? "bg-emerald-600 text-white" : ""
                                  }`}
                                >
                                  {sub.overallStatus}
                                </Badge>
                              </td>

                              {/* 6. Actions */}
                              <td className="align-top py-4 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* View Checklist Details */}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedSub(sub);
                                      setIsDetailOpen(true);
                                    }}
                                    className="h-7 px-2 text-xs"
                                  >
                                    <Eye className="size-3 mr-1" />
                                    Checklist
                                  </Button>

                                  {/* Approve Step (if authorized approver for current step) */}
                                  {canApprove && (
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedSub(sub);
                                        setIsDetailOpen(true);
                                      }}
                                      className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1 shadow-xs"
                                    >
                                      <CheckCircle2 className="size-3" />
                                      Approve Step
                                    </Button>
                                  )}

                                  {/* Download All Documents (Enabled once fully approved!) */}
                                  {isFullyApproved && !!sub.checklistId && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleDownloadAllDocs(sub)}
                                      disabled={downloadBusy}
                                      className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1 shadow-xs"
                                    >
                                      <Download className="size-3" />
                                      Download Package
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Approval Sequence (Hidden for Account Managers) */}
        {!isAccountManager && (
          <TabsContent value="workflow" className="space-y-4">
            <Card className="border-border/60 shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Configured Approval Sequence</CardTitle>
                <CardDescription className="text-xs">
                  Tender checklists follow HOD Review, Technical Review, and Committee Review in this order.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {workflow.map((step, idx) => (
                    <div
                      key={step.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border border-border/60 bg-muted/20 gap-3"
                    >
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary font-mono font-bold text-xs">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-xs text-foreground">{step.name}</h4>
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {step.roleLabel}
                            </Badge>
                            {step.isRequired && (
                              <Badge variant="secondary" className="text-[9px] text-primary">
                                Mandatory
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground pt-0.5 leading-relaxed">
                            {step.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground self-end sm:self-center font-mono">
                        <span>Role: {step.requiredRole}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-md bg-blue-500/10 p-3 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <ShieldCheck className="size-4 shrink-0" />
                  <span>
                    All submitted checklists automatically adhere to this sequence. Only users with the designated role can sign off each milestone. Submitters cannot approve their own packages.
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {selectedSub && (
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedSub.tenderRef}</DialogTitle>
              <DialogDescription>{selectedSub.tenderTitle}</DialogDescription>
            </DialogHeader>
            <ApprovalWorkflowCard
              key={`${selectedSub.id}:${selectedSub.revision}:${selectedSub.currentStepIndex}`}
              submission={selectedSub}
              profile={currentUser}
              error={loadError}
              showDocuments
              onRefresh={loadData}
              onChange={(updated) => {
                setSubmissions((rows) => rows.map((row) => row.id === updated.id ? updated : row));
                setSelectedSub(updated);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
