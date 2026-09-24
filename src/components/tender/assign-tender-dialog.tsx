"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Kanban,
  Layers,
  User,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

import { type TenderItem } from "@/app/(main)/dashboard/default/_components/tender-data";
import { TenderApiService } from "@/services/tender-api";
import type { BoardState, Task } from "@/app/(main)/dashboard/kanban/_components/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { users as allUsers, type SystemUser } from "@/data/users";
import { fetchCombinedPipelineBoardFromDb, getLivePipelineBoard, saveLivePipelineBoard } from "@/lib/pipeline-sync";
import { formatCurrency } from "@/lib/utils";
import { AuthService } from "@/services/auth-service";

export interface TenderAssignment {
  id: string;
  country: "ZW" | "ZM";
  tenderRef: string;
  tenderTitle: string;
  entity: string;
  estimatedValue: number;
  assignedToName: string;
  assignedToEmail: string;
  assignedToId: string;
  assignedByHodName: string;
  taskTitle: string;
  instructions: string;
  dueDate: string;
  priority: "High" | "Medium" | "Urgent";
  status: "New" | "In Progress" | "Pending Review" | "Completed" | string;
  progressPercentage: number;
  createdAt: string;
  addedToPipeline?: boolean;
  pipelineTaskId?: string;
}

interface AssignTenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignmentCreated?: () => void;
  defaultTender?: TenderItem | null;
  preselectedAmId?: string;
}

export function AssignTenderDialog({
  open,
  onOpenChange,
  onAssignmentCreated,
  defaultTender,
  preselectedAmId,
}: AssignTenderDialogProps) {
  const [currentHod, setCurrentHod] = useState<SystemUser | null>(null);
  const [sourceMode, setSourceMode] = useState<"pipeline_new" | "all">("pipeline_new");
  const [pipelineNewTasks, setPipelineNewTasks] = useState<Task[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState<string>("");
  const [selectedAmId, setSelectedAmId] = useState<string>("");
  const [taskTitle, setTaskTitle] = useState("Compile Technical Schedule & Pricing BoQ");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("12 Sep 2026");
  const [priority, setPriority] = useState<"High" | "Medium" | "Urgent">("High");
  const [syncToPipeline, setSyncToPipeline] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const user = AuthService.getCurrentUser();
    if (user) {
      const found = allUsers.find((u) => u.email === user.email || u.role === user.role);
      setCurrentHod(found || (user as any));
    }
  }, [open]);

  const userJurisdiction = AuthService.getUserJurisdiction();
  const hodCountry = currentHod?.country || userJurisdiction || "ALL";

  const [liveCatalogTenders, setLiveCatalogTenders] = useState<TenderItem[]>([]);

  // Load live tasks from pipeline "new" column (local storage + database sync)
  useEffect(() => {
    if (open) {
      const loadTasks = async () => {
        // 1. Fast load from local storage
        const localBoard = getLivePipelineBoard();
        let tasks = localBoard?.new || [];
        if (tasks.length > 0) {
          setPipelineNewTasks(tasks);
        }

        // 2. Fresh load from database
        try {
          const dbBoard = await fetchCombinedPipelineBoardFromDb();
          const dbTasks = dbBoard?.new || [];
          if (dbTasks.length > 0) {
            setPipelineNewTasks(dbTasks);
            tasks = dbTasks;
          }
        } catch {
          // ignore
        }

        // 3. Load live scraped catalog tenders from database
        try {
          const live = await TenderApiService.getLiveTenders(hodCountry as any);
          if (live && live.length > 0) {
            setLiveCatalogTenders(live);
          }
        } catch {
          // ignore
        }

        if (defaultTender) {
          setSelectedTenderId(defaultTender.id);
          setSourceMode("all");
        } else if (tasks.length > 0) {
          setSourceMode("pipeline_new");
        }
      };

      void loadTasks();
    }
  }, [defaultTender, open, hodCountry]);

  // Helper to determine country of task
  const getTaskCountry = (t: Task) => {
    if (t.countryCode) return t.countryCode;
    if (t.refNo?.startsWith("ZPPA") || t.refNo?.startsWith("ZESCO") || t.refNo?.startsWith("RDA")) return "ZM";
    return "ZW";
  };

  // Filter AMs reporting to this HOD / jurisdiction
  const eligibleAms = allUsers.filter((u) => {
    if (u.role !== "account_manager") return false;
    if (hodCountry === "ALL") return true;
    return u.country === hodCountry;
  });

  // Set default or preselected AM
  useEffect(() => {
    if (preselectedAmId && eligibleAms.some((am) => am.id === preselectedAmId)) {
      setSelectedAmId(preselectedAmId);
    } else if (eligibleAms.length > 0 && !selectedAmId) {
      setSelectedAmId(eligibleAms[0].id);
    }
  }, [eligibleAms, preselectedAmId, selectedAmId, open]);

  // Real scraped catalog tenders from database
  const availableCatalogTenders = liveCatalogTenders.filter((t) => {
    if (hodCountry === "ALL") return true;
    return t.countryCode === hodCountry;
  });

  // Filtered pipeline "new" tasks by country
  const filteredPipelineNew = pipelineNewTasks.filter((t) => {
    if (hodCountry === "ALL") return true;
    return getTaskCountry(t) === hodCountry;
  });

  // Keep selectedTenderId aligned when switching modes
  useEffect(() => {
    if (defaultTender) return;
    if (sourceMode === "pipeline_new") {
      if (filteredPipelineNew.length > 0) {
        if (!filteredPipelineNew.some((t) => t.id === selectedTenderId)) {
          setSelectedTenderId(filteredPipelineNew[0].id);
        }
      } else {
        setSelectedTenderId("");
      }
    } else {
      if (availableCatalogTenders.length > 0) {
        if (!availableCatalogTenders.some((t) => t.id === selectedTenderId)) {
          setSelectedTenderId(availableCatalogTenders[0].id);
        }
      } else {
        setSelectedTenderId("");
      }
    }
  }, [sourceMode, filteredPipelineNew, availableCatalogTenders, selectedTenderId, defaultTender]);

  // Selected tender resolution strictly based on current sourceMode
  const selectedPipelineTask = filteredPipelineNew.find((t) => t.id === selectedTenderId);
  const selectedCatalogItem = availableCatalogTenders.find((t) => t.id === selectedTenderId);

  const selectedTender =
    sourceMode === "pipeline_new"
      ? selectedPipelineTask
        ? {
            id: selectedPipelineTask.id,
            refNo: selectedPipelineTask.refNo || selectedPipelineTask.id,
            countryCode: selectedPipelineTask.countryCode || "ZW",
            title: selectedPipelineTask.title,
            procuringEntity: selectedPipelineTask.entity || "Procuring Authority",
            estimatedValue: selectedPipelineTask.estimatedValue || 1500000,
            team: selectedPipelineTask.team || "General Procurement",
            dueDate: selectedPipelineTask.dueDate || "15 Sep 2026",
            isFromPipeline: true,
          }
        : null
      : selectedCatalogItem
      ? {
          id: selectedCatalogItem.id,
          refNo: selectedCatalogItem.refNo,
          countryCode: selectedCatalogItem.countryCode,
          title: selectedCatalogItem.title,
          procuringEntity: selectedCatalogItem.procuringEntity,
          estimatedValue: selectedCatalogItem.estimatedValue,
          team: selectedCatalogItem.sector || "General Goods",
          dueDate: selectedCatalogItem.closingDate || "15 Sep 2026",
          isFromPipeline: false,
        }
      : null;

  const selectedAm = eligibleAms.find((am) => am.id === selectedAmId) || eligibleAms[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTender || !selectedAm) {
      toast.error("Please select both a tender and an Account Manager.");
      return;
    }

    setIsSubmitting(true);

    try {
      const assignmentId = `asgn-${Date.now()}`;
      const taskId = selectedTender.isFromPipeline
        ? selectedTender.id
        : `assigned-task-${assignmentId}`;

      const newAssignment: TenderAssignment = {
        id: assignmentId,
        country: selectedTender.countryCode as "ZW" | "ZM",
        tenderRef: selectedTender.refNo,
        tenderTitle: selectedTender.title,
        entity: selectedTender.procuringEntity,
        estimatedValue: selectedTender.estimatedValue,
        assignedToName: selectedAm.name,
        assignedToEmail: selectedAm.email,
        assignedToId: selectedAm.id,
        assignedByHodName: currentHod?.name || "Head of Department (HOD)",
        taskTitle: taskTitle.trim() || "Tender Response & Proposal Preparation",
        instructions: instructions.trim(),
        dueDate: dueDate,
        priority: priority,
        status: "New",
        progressPercentage: 10,
        createdAt: new Date().toISOString(),
        addedToPipeline: syncToPipeline,
        pipelineTaskId: taskId,
      };

      const response = await fetch("/api/assignments", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newAssignment),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Assignment failed");
      window.dispatchEvent(new CustomEvent("atcis-assignment-created", { detail: result.data }));
      if (syncToPipeline) window.dispatchEvent(new CustomEvent("hod-am-changed", { detail: selectedAm.email }));

      toast.success(`Tender Assigned to ${selectedAm.name}`, {
        description: syncToPipeline ? `${selectedTender.refNo} was added to the account manager's pipeline.` : "Assignment saved to Supabase.",
      });

      onAssignmentCreated?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign tender");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <UserCheck className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Assign Tender to Account Manager</DialogTitle>
              <DialogDescription className="text-xs">
                Delegate proposal ownership directly into the Account Manager&apos;s pipeline under &quot;New&quot;.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {/* Source Selector: Pipeline "New" vs Full Catalog */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Select Tender to Assign</Label>
              <div className="flex items-center rounded-md border border-border/80 p-0.5 bg-muted/40 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setSourceMode("pipeline_new");
                    if (filteredPipelineNew.length > 0) {
                      setSelectedTenderId(filteredPipelineNew[0].id);
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    sourceMode === "pipeline_new"
                      ? "bg-background text-foreground shadow-2xs font-semibold text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Pipeline &quot;New&quot; ({filteredPipelineNew.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSourceMode("all");
                    if (availableCatalogTenders.length > 0) {
                      setSelectedTenderId(availableCatalogTenders[0].id);
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    sourceMode === "all"
                      ? "bg-background text-foreground shadow-2xs font-semibold text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All Catalog
                </button>
              </div>
            </div>

            <Select value={selectedTenderId} onValueChange={setSelectedTenderId}>
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Select tender to assign" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {sourceMode === "pipeline_new" ? (
                  filteredPipelineNew.length > 0 ? (
                    filteredPipelineNew.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        <span className="font-mono font-semibold text-primary mr-1.5">
                          [{t.countryCode || "ZW"}] {t.refNo || t.id}
                        </span>
                        <span>- {t.title.slice(0, 48)}...</span>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      No tenders currently in Pipeline &quot;New&quot;.
                    </div>
                  )
                ) : (
                  availableCatalogTenders.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      <span className="font-mono font-semibold text-primary mr-1.5">
                        [{t.countryCode}] {t.refNo}
                      </span>
                      <span>- {t.title.slice(0, 48)}...</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {selectedTender ? (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 space-y-1 text-[11px]">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-foreground font-semibold">{selectedTender.procuringEntity}</span>
                  <span className="font-mono font-bold text-primary">
                    {formatCurrency(selectedTender.estimatedValue)}
                  </span>
                </div>
                <p className="text-foreground line-clamp-1 font-medium">{selectedTender.title}</p>
                <div className="flex items-center gap-2 pt-0.5 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded bg-background/80 px-1.5 py-0.5 border border-border/60">
                    <Kanban className="size-3 text-primary" />
                    Stage: {selectedTender.isFromPipeline ? "New in Pipeline" : "General Catalog"}
                  </span>
                  <span>Due: {selectedTender.dueDate}</span>
                </div>
              </div>
            ) : sourceMode === "pipeline_new" && filteredPipelineNew.length === 0 ? (
              <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5 text-[11px] text-amber-700 dark:text-amber-300">
                No tenders currently in Pipeline &quot;New&quot; for this region. Switch to <strong>All Catalog</strong> above to select from catalog notices.
              </div>
            ) : null}
          </div>

          {/* 2. Select Account Manager (AM) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Assign to Account Manager (AM)</Label>
            <Select value={selectedAmId} onValueChange={setSelectedAmId}>
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Select Account Manager" />
              </SelectTrigger>
              <SelectContent>
                {eligibleAms.map((am) => (
                  <SelectItem key={am.id} value={am.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{am.name}</span>
                      <span className="text-muted-foreground text-[10px]">({am.roleTitle})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 3. Task Deliverable Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Assigned Deliverable / Action Item</Label>
            <Input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Compile Technical Schedule & OEM Quotations"
              className="text-xs"
              required
            />
            {/* Quick Chips */}
            <div className="flex flex-wrap gap-1 pt-1">
              {[
                "Compile Technical Schedule & BoQ",
                "Secure ZIMRA / ZRA Tax Clearance",
                "Obtain OEM Manufacturer Letter",
                "Full Proposal Bid Compilation",
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setTaskTitle(chip)}
                  className="rounded-full border border-border/80 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Target Deadline & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Submission Target Deadline</Label>
              <Input
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="e.g. 12 Sep 2026"
                className="text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Priority Level</Label>
              <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High" className="text-xs">High Priority</SelectItem>
                  <SelectItem value="Urgent" className="text-xs text-rose-600 dark:text-rose-400 font-semibold">Urgent (&lt;48h)</SelectItem>
                  <SelectItem value="Medium" className="text-xs">Medium Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 5. Instructions from HOD */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">HOD Instructions &amp; Specifications (Optional)</Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Liaise with local engineers for Lot 1 compliance before final pricing sign-off."
              className="text-xs min-h-[60px]"
            />
          </div>

          {/* 6. Sync to AM Pipeline Checkbox */}
          <div className="flex items-center space-x-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
            <Checkbox
              id="sync-pipeline"
              checked={syncToPipeline}
              onCheckedChange={(checked) => setSyncToPipeline(Boolean(checked))}
            />
            <label
              htmlFor="sync-pipeline"
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Automatically place this tender into the AM&apos;s pipeline under &quot;New&quot;
            </label>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="gap-1.5 text-xs font-semibold bg-primary text-primary-foreground"
            >
              <UserCheck className="size-3.5" />
              Confirm Assignment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
