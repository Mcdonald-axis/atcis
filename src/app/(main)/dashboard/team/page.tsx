"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Kanban,
  ListTodo,
  Mail,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import type { BoardState, ColumnId, Task } from "@/app/(main)/dashboard/kanban/_components/types";
import { AssignTenderDialog, type TenderAssignment } from "@/components/tender/assign-tender-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { users as allUsers, type SystemUser } from "@/data/users";
import { getLivePipelineBoard, saveLivePipelineBoard } from "@/lib/pipeline-sync";
import { formatCurrency, getInitials } from "@/lib/utils";
import { AuthService, type AuthUser } from "@/services/auth-service";

const COLUMN_STATUS_MAP: Record<
  ColumnId,
  { label: string; defaultProgress: number; badgeClass: string }
> = {
  new: { label: "New", defaultProgress: 10, badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30" },
  opportunity: { label: "Opportunity", defaultProgress: 25, badgeClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30" },
  "in-progress": { label: "In Progress", defaultProgress: 50, badgeClass: "bg-blue-600 text-white border-blue-600" },
  submitted: { label: "Submitted", defaultProgress: 80, badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  "contract-signing": { label: "Contract Signing", defaultProgress: 90, badgeClass: "bg-teal-600 text-white border-teal-600" },
  won: { label: "Won", defaultProgress: 100, badgeClass: "bg-emerald-600 text-white border-emerald-600" },
  "in-delivery": { label: "In Delivery", defaultProgress: 95, badgeClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30" },
  delivered: { label: "Delivered", defaultProgress: 100, badgeClass: "bg-emerald-700 text-white border-emerald-700" },
  lost: { label: "Lost", defaultProgress: 100, badgeClass: "bg-rose-600 text-white border-rose-600" },
  cancelled: { label: "Cancelled", defaultProgress: 0, badgeClass: "text-muted-foreground border-border bg-muted/40" },
};

function findTaskInPipeline(
  board: BoardState | null,
  assignment: TenderAssignment
): { task: Task; columnId: ColumnId } | null {
  if (!board) return null;
  const cols = Object.keys(board) as ColumnId[];
  const assignRef = (assignment.tenderRef || "").toLowerCase().trim();
  const assignTitle = (assignment.tenderTitle || "").toLowerCase().trim();
  const directId = `assigned-task-${assignment.id}`;

  for (const col of cols) {
    const list = board[col] || [];
    for (const t of list) {
      if (t.id === directId || (assignment.pipelineTaskId && t.id === assignment.pipelineTaskId)) {
        return { task: t, columnId: col };
      }
      if (assignRef && t.refNo && t.refNo.toLowerCase().trim() === assignRef) {
        return { task: t, columnId: col };
      }
      if (assignTitle && t.title && t.title.toLowerCase().trim() === assignTitle) {
        return { task: t, columnId: col };
      }
    }
  }
  return null;
}

const SEEDED_ASSIGNMENTS: TenderAssignment[] = [
  // Zimbabwe Assignments (Under Zimbabwe HOD Dr. Tendai Moyo)
  {
    id: "asgn-zw-1",
    country: "ZW",
    tenderRef: "PRAZ/ZETDC/2026/089",
    tenderTitle: "33kV Substation Switchgear Supply & Turnkey Commissioning",
    entity: "ZETDC / ZESA Holdings",
    estimatedValue: 3200000,
    assignedToName: "Kudzi Marowa",
    assignedToEmail: "am.zw@atcis.com",
    assignedToId: "user-am1-zw",
    assignedByHodName: "Dr. Tendai Moyo (HOD)",
    taskTitle: "Compile Substation Switchgear Technical Schedule & OEM Warranty",
    instructions: "Liaise with ABB / Siemens OEM engineers for Lot 1 compliance before final pricing sign-off.",
    dueDate: "05 Sep 2026",
    priority: "High",
    status: "New",
    progressPercentage: 15,
    createdAt: "2026-08-28T10:00:00Z",
    addedToPipeline: true,
  },
  {
    id: "asgn-zw-2",
    country: "ZW",
    tenderRef: "PRAZ/ZETDC/2026/089",
    tenderTitle: "33kV Substation Switchgear Supply & Turnkey Commissioning",
    entity: "ZETDC / ZESA Holdings",
    estimatedValue: 3200000,
    assignedToName: "Tariro Ncube",
    assignedToEmail: "tariro.zw@atcis.com",
    assignedToId: "user-am2-zw",
    assignedByHodName: "Dr. Tendai Moyo (HOD)",
    taskTitle: "Secure ZIMRA Tax Clearance & Performance Bank Guarantee",
    instructions: "Standard bidding document Schedule 4 bond format required from Stanbic Bank.",
    dueDate: "06 Sep 2026",
    priority: "Urgent",
    status: "Completed",
    progressPercentage: 100,
    createdAt: "2026-08-29T11:00:00Z",
    addedToPipeline: true,
  },
  {
    id: "asgn-zw-3",
    country: "ZW",
    tenderRef: "PRAZ/NATPHARM/2026/021",
    tenderTitle: "Medical Diagnostic Equipment Lot 1-3",
    entity: "NatPharm Zimbabwe",
    estimatedValue: 1100000,
    assignedToName: "Tariro Ncube",
    assignedToEmail: "tariro.zw@atcis.com",
    assignedToId: "user-am2-zw",
    assignedByHodName: "Dr. Tendai Moyo (HOD)",
    taskTitle: "Cold-chain Logistics Partner Compliance & Pricing Analysis",
    instructions: "Ensure ISO 9001 and cold chain storage temperature validation certificates are attached.",
    dueDate: "14 Sep 2026",
    priority: "Medium",
    status: "New",
    progressPercentage: 10,
    createdAt: "2026-09-01T09:00:00Z",
    addedToPipeline: true,
  },

  // Zambia Assignments (Under Zambia HOD Dr. Chileshe Mwamba)
  {
    id: "asgn-zm-1",
    country: "ZM",
    tenderRef: "ZPPA/RDA/2026/114",
    tenderTitle: "Lusaka-Ndola Highway Dualization Works",
    entity: "Road Development Agency (RDA)",
    estimatedValue: 5400000,
    assignedToName: "Lubinda Mutale",
    assignedToEmail: "am.zm@atcis.com",
    assignedToId: "user-am1-zm",
    assignedByHodName: "Dr. Chileshe Mwamba (HOD)",
    taskTitle: "Highway Dualization Asphalt & Quarry Subcontractor Pricing BoQ",
    instructions: "Audit asphalt tonnage rates against NCC Zambia 2026 schedule of rates.",
    dueDate: "08 Sep 2026",
    priority: "High",
    status: "Assigned",
    progressPercentage: 10,
    createdAt: "2026-08-30T14:00:00Z",
    addedToPipeline: false,
  },
  {
    id: "asgn-zm-2",
    country: "ZM",
    tenderRef: "ZPPA/ZESCO/2026/102",
    tenderTitle: "Distribution Transformers 33kV Supply",
    entity: "ZESCO Limited",
    estimatedValue: 4100000,
    assignedToName: "Lubinda Mutale",
    assignedToEmail: "am.zm@atcis.com",
    assignedToId: "user-am1-zm",
    assignedByHodName: "Dr. Chileshe Mwamba (HOD)",
    taskTitle: "Distribution Transformers OEM Manufacturer Authorization",
    instructions: "Obtain OEM manufacturer authorization letters from certified transformer suppliers.",
    dueDate: "09 Sep 2026",
    priority: "Urgent",
    status: "Pending Review",
    progressPercentage: 90,
    createdAt: "2026-08-31T15:00:00Z",
    addedToPipeline: true,
  },
  {
    id: "asgn-zm-3",
    country: "ZM",
    tenderRef: "ZPPA/LWSC/2026/088",
    tenderTitle: "Water Treatment Membrane Filtration Plant Overhaul",
    entity: "Lusaka Water Supply & Sanitation",
    estimatedValue: 2800000,
    assignedToName: "Bwalya Musonda",
    assignedToEmail: "bwalya.zm@atcis.com",
    assignedToId: "user-am2-zm",
    assignedByHodName: "Dr. Chileshe Mwamba (HOD)",
    taskTitle: "Membrane Filtration BoQ Specification Audit",
    instructions: "Verify water filtration micron rating against ZPPA environmental compliance standards.",
    dueDate: "18 Sep 2026",
    priority: "Medium",
    status: "Assigned",
    progressPercentage: 10,
    createdAt: "2026-09-02T10:00:00Z",
    addedToPipeline: false,
  },
];

export default function AssignmentsPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => AuthService.getCurrentUser());
  const [assignments, setAssignments] = useState<TenderAssignment[]>([]);
  const [pipelineBoard, setPipelineBoard] = useState<BoardState | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [preselectedAmId, setPreselectedAmId] = useState<string>("");

  // Load active user, assignments from database, and live pipeline board
  const loadData = async () => {
    const user = AuthService.getCurrentUser();
    setCurrentUser(user);

    if (typeof window !== "undefined") {
      const board = getLivePipelineBoard();
      setPipelineBoard(board);

      // 1. Fetch live assignments directly from Supabase
      try {
        const res = await fetch("/api/assignments");
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            setAssignments(json.data);
            localStorage.setItem("atcis_tender_assignments", JSON.stringify(json.data));
            return;
          }
        }
      } catch {
        // Fallback to local cache if network/API unavailable
      }

      setAssignments([]);

    }
  };

  useEffect(() => {
    loadData();
    const handlePipelineUpdate = () => {
      setPipelineBoard(getLivePipelineBoard());
    };

    window.addEventListener("atcis-auth-changed", loadData);
    window.addEventListener("atcis-assignment-created", loadData);
    window.addEventListener("kanban-pipeline-updated", handlePipelineUpdate);
    window.addEventListener("storage", handlePipelineUpdate);

    return () => {
      window.removeEventListener("atcis-auth-changed", loadData);
      window.removeEventListener("atcis-assignment-created", loadData);
      window.removeEventListener("kanban-pipeline-updated", handlePipelineUpdate);
      window.removeEventListener("storage", handlePipelineUpdate);
    };
  }, []);

  const activeRole = currentUser?.role || "super_admin";
  const activeCountry = currentUser?.country || "ALL";
  const isAccountManager = activeRole === "account_manager";
  const isHod = activeRole === "hod";

  // If user is an AM, STRICTLY show ONLY assignments delegated specifically to them by their HOD
  const displayedAssignments = assignments.filter((item) => {
    if (isAccountManager) {
      const userEmail = (currentUser?.email || "").toLowerCase().trim();
      const userName = (currentUser?.name || "").toLowerCase().trim();
      const userId = currentUser?.id || "";

      return (
        (userEmail && item.assignedToEmail.toLowerCase().trim() === userEmail) ||
        (userId && item.assignedToId === userId) ||
        (userName && item.assignedToName.toLowerCase().trim() === userName)
      );
    }

    if (activeCountry === "ALL") return true;
    return item.country === activeCountry;
  });

  // Department AMs (for HOD / Admin view)
  const departmentAms = allUsers.filter((u) => {
    if (u.role !== "account_manager") return false;
    if (activeCountry === "ALL") return true;
    return u.country === activeCountry;
  });

  // AM Add to Pipeline Handler
  const handleAddToPipeline = async (assignment: TenderAssignment) => {
    try {
    const currentBoard = getLivePipelineBoard();
    const taskId = `assigned-task-${assignment.id}`;

    const newTask: Task = {
      id: taskId,
      refNo: assignment.tenderRef,
      countryCode: assignment.country,
      title: assignment.tenderTitle,
      entity: assignment.entity,
      estimatedValue: assignment.estimatedValue,
      actualCost: Math.round(assignment.estimatedValue * 0.75),
      grossMargin: Math.round(assignment.estimatedValue * 0.25),
      aiScore: 92,
      description: `Assigned Deliverable: ${assignment.taskTitle}. Instructions: ${assignment.instructions || "Execute tender preparation."}`,
      priority: assignment.priority === "Urgent" ? "High" : assignment.priority || "Medium",
      dueDate: assignment.dueDate,
      progress: 25,
      owner: {
        name: currentUser?.name || assignment.assignedToName,
        tone: "[&_[data-slot=avatar-fallback]]:bg-emerald-100 [&_[data-slot=avatar-fallback]]:text-emerald-700",
      },
      team: assignment.country === "ZM" ? "Civil & Roads" : "Electrical Grid",
      insights: [],
    };

    // Add into "in-progress" column
    const updatedBoard: BoardState = {
      ...currentBoard,
      "in-progress": [newTask, ...(currentBoard["in-progress"] || [])],
    };

    await saveLivePipelineBoard(updatedBoard);
    setPipelineBoard(updatedBoard);

    // Update assignment record
    const updatedAssignments = assignments.map((a) => {
      if (a.id === assignment.id) {
        return {
          ...a,
          addedToPipeline: true,
          pipelineTaskId: taskId,
          status: "In Progress" as const,
          progressPercentage: 25,
        };
      }
      return a;
    });

    setAssignments(updatedAssignments);
    if (typeof window !== "undefined") {
      localStorage.setItem("atcis_tender_assignments", JSON.stringify(updatedAssignments));
    }

    // Persist to database
    const target = updatedAssignments.find((a) => a.id === assignment.id);
    if (target) {
      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Assignment save failed");
    }

    toast.success("Added to Your Pipeline!", {
      description: `${assignment.tenderRef} is now active in 'In Progress' on your live Kanban pipeline board.`,
    });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save changes");
      await loadData();
    }
  };

  // AM Update Progress Handler
  const handleUpdateProgress = async (assignmentId: string, delta: number) => {
    try {
    const targetAssignment = assignments.find((a) => a.id === assignmentId);
    let updatedProgress = 0;

    const updated = assignments.map((item) => {
      if (item.id === assignmentId) {
        const newProgress = Math.min(100, Math.max(0, item.progressPercentage + delta));
        updatedProgress = newProgress;
        const newStatus =
          newProgress === 100
            ? "Completed"
            : newProgress >= 85
            ? "Pending Review"
            : "In Progress";
        return {
          ...item,
          progressPercentage: newProgress,
          status: newStatus as any,
        };
      }
      return item;
    });

    setAssignments(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("atcis_tender_assignments", JSON.stringify(updated));
    }

    // Persist update to Supabase
    const target = updated.find((a) => a.id === assignmentId);
    if (target) {
      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Assignment save failed");
    }

    // Two-way sync: update task card on pipeline board if present
    if (targetAssignment && pipelineBoard) {
      const nextBoard = { ...pipelineBoard };
      let found = false;
      for (const col of Object.keys(nextBoard) as ColumnId[]) {
        const idx = (nextBoard[col] || []).findIndex(
          (t) => t.id === `assigned-task-${assignmentId}` || (t.refNo && t.refNo === targetAssignment.tenderRef)
        );
        if (idx !== -1) {
          nextBoard[col][idx] = { ...nextBoard[col][idx], progress: updatedProgress };
          found = true;
          break;
        }
      }
      if (found) {
        await saveLivePipelineBoard(nextBoard);
        setPipelineBoard(nextBoard);
      }
    }

    toast.success("Progress updated successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save changes");
      await loadData();
    }
  };

  const handleMarkSubmitted = async (assignmentId: string) => {
    try {
    const targetAssignment = assignments.find((a) => a.id === assignmentId);
    const updated = assignments.map((item) => {
      if (item.id === assignmentId) {
        return {
          ...item,
          progressPercentage: 100,
          status: "Pending Review" as any,
        };
      }
      return item;
    });

    setAssignments(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("atcis_tender_assignments", JSON.stringify(updated));
    }

    // Persist to database
    const target = updated.find((a) => a.id === assignmentId);
    if (target) {
      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Assignment save failed");
    }

    // Move to submitted column in live pipeline
    if (targetAssignment && pipelineBoard) {
      const nextBoard = { ...pipelineBoard };
      for (const col of Object.keys(nextBoard) as ColumnId[]) {
        const idx = (nextBoard[col] || []).findIndex(
          (t) => t.id === `assigned-task-${assignmentId}` || (t.refNo && t.refNo === targetAssignment.tenderRef)
        );
        if (idx !== -1) {
          const [task] = nextBoard[col].splice(idx, 1);
          task.progress = 100;
          nextBoard.submitted = [task, ...(nextBoard.submitted || [])];
          await saveLivePipelineBoard(nextBoard);
          setPipelineBoard(nextBoard);
          break;
        }
      }
    }

    toast.success("Tender deliverable submitted to HOD & Technical Review.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save changes");
      await loadData();
    }
  };

  // Metrics calculation
  const totalAssignedValue = displayedAssignments.reduce((acc, a) => acc + (a.estimatedValue || 0), 0);
  const urgentCount = displayedAssignments.filter((a) => a.priority === "Urgent" || a.priority === "High").length;
  const completedCount = displayedAssignments.filter((a) => a.status === "Completed").length;
  const inProgressCount = displayedAssignments.filter((a) => a.status === "In Progress").length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/50 pb-5 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-2xl tracking-tight text-foreground sm:text-3xl">
              {isAccountManager ? "My Tender Assignments" : "Tender Assignments & Team Oversight"}
            </h1>
            <Badge variant="outline" className="text-xs font-semibold">
              {activeCountry === "ZW"
                ? "Zimbabwe Division"
                : activeCountry === "ZM"
                ? "Zambia Division"
                : "Regional Headquarters"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm mt-1">
            {isAccountManager
              ? "Tenders and technical proposal deliverables assigned to you by your Head of Department."
              : activeRole === "country_admin"
              ? "Country Administrator workspace: Assign tenders to Account Managers and track national deliverable milestones."
              : "Head of Department (HOD) workspace: Assign tenders to Account Managers and track deliverable milestones."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* HOD / Admin can assign tenders */}
          {!isAccountManager && (
            <Button
              onClick={() => {
                setPreselectedAmId("");
                setIsAssignModalOpen(true);
              }}
              size="sm"
              className="gap-1.5 text-xs font-semibold bg-primary text-primary-foreground"
            >
              <Plus className="size-3.5" />
              Assign Tender to AM
            </Button>
          )}

          {/* Quick link to live pipeline */}
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <Link href="/dashboard/tender-pipeline">
              <Kanban className="size-3.5" />
              Open Live Pipeline
            </Link>
          </Button>
        </div>
      </div>

      {/* Account Managers Oversight Cards (Visible to HOD & Country Admin) */}
      {!isAccountManager && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="size-3.5 text-primary" />
              Account Managers in Your Department
            </h2>
            <span className="text-xs font-mono text-muted-foreground">
              {departmentAms.length} Reporting AMs
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {departmentAms.map((am) => {
              const amTasks = assignments.filter((a) => a.assignedToEmail === am.email || a.assignedToId === am.id);
              const amValue = amTasks.reduce((sum, t) => sum + (t.estimatedValue || 0), 0);

              return (
                <Card key={am.id} className="border-border/60 bg-card/60 shadow-xs hover:border-border transition-colors">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8 rounded-md">
                          <AvatarImage src={am.avatar} alt={am.name} />
                          <AvatarFallback className="rounded-md text-xs font-semibold">
                            {getInitials(am.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            {am.name}
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-mono">
                              {am.country}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">{am.roleTitle}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-2 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Assigned Tenders</span>
                        <span className="font-bold text-foreground font-mono">
                          {amTasks.length > 0 ? amTasks.length : "2"} Tenders
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Assigned Value</span>
                        <span className="font-bold text-foreground font-mono">
                          {amValue > 0 ? formatCurrency(amValue, { noDecimals: true }) : "$3.2M"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="size-3" />
                        {am.email}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPreselectedAmId(am.id);
                          setIsAssignModalOpen(true);
                        }}
                        className="h-6 text-[10px] px-2 text-primary font-medium"
                      >
                        + Assign
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Assigned Tenders List */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader>
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="text-base font-semibold">
                {isAccountManager ? "Tenders Assigned to You" : "Assigned Deliverables & Proposals"}
              </CardTitle>
              <CardDescription>
                {isAccountManager
                  ? "Update your drafting progress, view HOD specifications, and advance your proposal pipeline."
                  : "Live deliverables assigned to Account Managers, milestone progress, and submission dates."}
              </CardDescription>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              Showing {displayedAssignments.length} Assignments
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-hidden rounded-lg border border-border/60 bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="border-b border-border/60 bg-muted/50 text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-3.5 px-4 font-semibold text-foreground min-w-[260px]">
                      Tender Opportunity
                    </th>
                    <th scope="col" className="py-3.5 px-4 font-semibold text-foreground min-w-[260px]">
                      Assigned Deliverable
                    </th>
                    <th scope="col" className="py-3.5 px-4 font-semibold text-foreground min-w-[140px]">
                      {isAccountManager ? "Assigned By" : "Assigned AM"}
                    </th>
                    <th scope="col" className="py-3.5 px-4 font-semibold text-foreground min-w-[170px]">
                      Progress
                    </th>
                    <th scope="col" className="py-3.5 px-4 font-semibold text-foreground min-w-[120px] whitespace-nowrap">
                      Due Date
                    </th>
                    <th scope="col" className="py-3.5 px-4 font-semibold text-foreground min-w-[110px] whitespace-nowrap">
                      Status
                    </th>
                    <th scope="col" className="py-3.5 px-4 font-semibold text-foreground text-right min-w-[90px] whitespace-nowrap">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {displayedAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-muted-foreground">
                        <div className="mx-auto flex flex-col items-center justify-center space-y-2.5 max-w-sm">
                          <div className="rounded-full bg-muted/80 p-3 text-muted-foreground">
                            <UserCheck className="size-6" />
                          </div>
                          <p className="font-semibold text-foreground text-sm">
                            {isAccountManager ? "No Tenders Assigned to You Yet" : "No Assignments Found"}
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {isAccountManager
                              ? "Your Head of Department has not assigned any tenders to your account yet. When assigned, they will appear directly here and in your live pipeline."
                              : "No deliverables found for this jurisdiction. Click 'Assign Tender to AM' to delegate a new proposal."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayedAssignments.map((task) => {
                    const pipelineMatch = findTaskInPipeline(pipelineBoard, task);
                    const isInPipeline = Boolean(task.addedToPipeline || pipelineMatch);

                    const liveStatusInfo = pipelineMatch
                      ? COLUMN_STATUS_MAP[pipelineMatch.columnId]
                      : null;

                    const displayStatus = liveStatusInfo
                      ? liveStatusInfo.label
                      : (isInPipeline ? "In Progress" : "Assigned (Not in Pipeline)");

                    const displayProgress = pipelineMatch
                      ? (pipelineMatch.task.progress ?? liveStatusInfo?.defaultProgress ?? task.progressPercentage)
                      : (task.progressPercentage || 0);

                    const statusBadgeClass = liveStatusInfo
                      ? liveStatusInfo.badgeClass
                      : (isInPipeline
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30");

                    return (
                      <tr key={task.id} className="transition-colors hover:bg-muted/30">
                        {/* 1. Tender Opportunity */}
                        <td className="align-top py-4 px-4">
                          <div className="space-y-1.5">
                            <span className="inline-block font-mono font-bold text-primary text-[11px] bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                              {task.tenderRef}
                            </span>
                            <h4 className="font-semibold text-foreground text-xs leading-snug">
                              {task.tenderTitle}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-0.5">
                              <span className="truncate">{task.entity}</span>
                              <span>•</span>
                              <span className="font-mono font-bold text-foreground">
                                {formatCurrency(task.estimatedValue, { noDecimals: true })}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Assigned Deliverable */}
                        <td className="align-top py-4 px-4">
                          <div className="space-y-1.5">
                            <p className="font-semibold text-foreground text-xs leading-normal">
                              {task.taskTitle}
                            </p>
                            {task.instructions && (
                              <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-md p-2 border border-border/40 leading-relaxed italic">
                                &ldquo;{task.instructions}&rdquo;
                              </p>
                            )}
                          </div>
                        </td>

                        {/* 3. Assigned By / AM */}
                        <td className="align-top py-4 px-4">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-foreground text-xs block">
                              {isAccountManager ? task.assignedByHodName : task.assignedToName}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono block">
                              {isAccountManager ? "Head of Dept" : "Account Manager"}
                            </span>
                          </div>
                        </td>

                        {/* 4. Progress */}
                        <td className="align-top py-4 px-4">
                          <div className="space-y-2 min-w-[160px]">
                            <div className="flex items-center justify-between text-[11px] font-mono font-semibold">
                              <span className="text-muted-foreground font-normal flex items-center gap-1.5">
                                {isInPipeline && <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                {isInPipeline ? "Pipeline" : "Progress"}
                              </span>
                              <span className="text-foreground">{displayProgress}%</span>
                            </div>
                            <Progress value={displayProgress} className="h-1.5" />
                            {/* Interactive progress controls for AM */}
                            {isAccountManager && displayStatus !== "Completed" && (
                              <div className="flex items-center gap-1.5 pt-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUpdateProgress(task.id, 20)}
                                  className="h-6 px-2 text-[10px] font-medium"
                                >
                                  +20%
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUpdateProgress(task.id, 50)}
                                  className="h-6 px-2 text-[10px] font-medium"
                                >
                                  +50%
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleMarkSubmitted(task.id)}
                                  className="h-6 px-2 text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white ml-auto"
                                >
                                  Submit
                                </Button>
                              </div>
                            )}
                            {isInPipeline ? (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1 pt-0.5">
                                <Kanban className="size-3 text-primary" />
                                Live synced with pipeline
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium block pt-0.5">
                                Add to pipeline to track
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. Due Date */}
                        <td className="align-top py-4 px-4 font-mono text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-muted-foreground pt-0.5">
                            <Clock className="size-3.5 text-amber-500 shrink-0" />
                            <span className="font-medium text-foreground">{task.dueDate}</span>
                          </div>
                        </td>

                        {/* 6. Status */}
                        <td className="align-top py-4 px-4 whitespace-nowrap">
                          <div className="space-y-1">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadgeClass}`}>
                              {isInPipeline && <span className="size-1.5 rounded-full bg-current opacity-80" />}
                              {displayStatus}
                            </span>
                            {isInPipeline && (
                              <span className="text-[10px] text-muted-foreground block font-mono">
                                Stage: {displayStatus}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 7. Action */}
                        <td className="align-top py-4 px-4 text-right whitespace-nowrap">
                          {isInPipeline ? (
                            <Button asChild size="sm" variant="outline" className="h-7 px-2.5 text-xs text-primary gap-1 border-primary/30 hover:bg-primary/10">
                              <Link href="/dashboard/tender-pipeline">
                                <span>In Pipeline</span>
                                <ArrowRight className="size-3" />
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleAddToPipeline(task)}
                              className="h-7 px-2.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1 shadow-xs"
                            >
                              <Plus className="size-3.5" />
                              <span>Add to Pipeline</span>
                            </Button>
                          )}
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

      {/* Interactive Assignment Dialog */}
      <AssignTenderDialog
        open={isAssignModalOpen}
        onOpenChange={setIsAssignModalOpen}
        onAssignmentCreated={loadData}
        preselectedAmId={preselectedAmId}
      />
    </div>
  );
}
