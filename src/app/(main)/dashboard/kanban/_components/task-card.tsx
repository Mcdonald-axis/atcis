"use client";

import React, { useState } from "react";

import {
  ArrowRight,
  ArrowRightLeft,
  Ban,
  CalendarDays,
  Check,
  CheckCircle2,
  FileText,
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";

import type { TenderItem } from "@/app/(main)/dashboard/default/_components/tender-data";
import { TenderDetailDialog } from "@/components/tender/tender-detail-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import { syncTenderToZohoCrm } from "@/lib/zoho-sync";

import { columns, tagTones } from "./data";
import { useKanbanContext } from "./kanban-context";
import { TenderPipelineEditDialog } from "./tender-pipeline-edit-dialog";
import type { ColumnId, Task, TaskPriority } from "./types";

const priorityBadgeConfig: Record<TaskPriority, { className: string }> = {
  Urgent: {
    className: "bg-red-600/20 text-red-600 dark:text-red-400 border border-red-600/30 font-semibold",
  },
  High: {
    className: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25",
  },
  Medium: {
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25",
  },
  Low: {
    className: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/25",
  },
};

export const TaskCard = React.memo(function TaskCard({
  task,
  columnId,
  isOverlay = false,
}: {
  task: Task;
  columnId?: ColumnId;
  isOverlay?: boolean;
}) {
  const isWon = columnId === "won";
  const isContractSigning = columnId === "contract-signing";
  const isInDelivery = columnId === "in-delivery";
  const isDelivered = columnId === "delivered";
  const isLost = columnId === "lost";
  const isCancelled = columnId === "cancelled";
  const usesAwardedValue = isWon || isContractSigning || isInDelivery || isDelivered;
  const displayedValue = usesAwardedValue ? (task.amountAwarded ?? task.pipelineValue ?? 0) : (task.pipelineValue ?? 0);
  const isClone = Boolean(task.id && (task.id.includes("-exec-") || task.id.includes("-delivery-")));

  // Fast path for DragOverlay: zero modals, zero heavy hooks, 60fps drag preview
  if (isOverlay) {
    return (
      <article
        className={cn(
          "group relative flex w-68 rotate-1 flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-lg pointer-events-none",
          isWon && "border-emerald-500/30 bg-emerald-500/5",
          isContractSigning && "border-indigo-500/30 bg-indigo-500/5",
          isInDelivery && "border-amber-500/30 bg-amber-500/5",
          isDelivered && "border-emerald-500/40 bg-emerald-500/10",
          isLost && "border-rose-500/20 opacity-80",
          isCancelled && "border-muted-foreground/20 opacity-60",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {task.countryCode && (
              <span className="inline-flex h-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-semibold text-foreground leading-none">
                {task.countryCode}
              </span>
            )}
            <span className="font-mono text-xs text-muted-foreground truncate max-w-[125px]">
              {task.refNo ?? task.id}
            </span>
            {isClone && (
              <span className="inline-flex h-4 items-center justify-center rounded border border-indigo-500/30 bg-indigo-500/10 px-1 font-mono text-[9px] font-semibold text-indigo-700 dark:text-indigo-300 leading-none">
                Clone
              </span>
            )}
          </div>
          {task.priority && (
            <span
              className={cn(
                "inline-flex h-5 items-center justify-center rounded-md px-2 text-[10px] font-semibold leading-none",
                priorityBadgeConfig[task.priority]?.className,
              )}
            >
              {task.priority}
            </span>
          )}
        </div>

        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold text-sm leading-snug text-foreground line-clamp-2">{task.title}</h3>
          {task.entity && <p className="text-[11px] font-medium text-muted-foreground truncate">{task.entity}</p>}
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/30 p-2 text-xs">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-muted-foreground font-medium truncate">
              {usesAwardedValue && task.amountAwarded ? "Awarded" : "Tender Value"}
            </span>
            <span className="font-bold text-foreground">{formatCurrency(displayedValue, { noDecimals: true })}</span>
          </div>
        </div>
      </article>
    );
  }

  const { canDeletePipelineItems, updateTask, removePipelineTask, cloneWonToDeliveryStage, moveTaskToStage } =
    useKanbanContext();
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Quick Lost Debrief Dialog states
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [lostReason, setLostReason] = useState("Price higher than winning bidder");
  const [competitorName, setCompetitorName] = useState("");
  const [competitorPrice, setCompetitorPrice] = useState("");
  const [lossDebriefNotes, setLossDebriefNotes] = useState("");

  const owner = task.owner;

  const handleConfirmLost = (skipDebrief = false) => {
    if (!moveTaskToStage) return;
    const finalReason = skipDebrief
      ? "Tender lost during evaluation"
      : `${lostReason}${competitorName ? ` (Won by: ${competitorName}${competitorPrice ? ` at $${competitorPrice}` : ""})` : ""}`;

    moveTaskToStage(task.id, "lost", {
      winLossReason: finalReason,
      lessonsLearned: skipDebrief ? task.lessonsLearned : lossDebriefNotes || task.lessonsLearned,
      amountAwarded: competitorPrice ? parseFloat(competitorPrice) : task.amountAwarded,
    });
    setLostDialogOpen(false);
  };

  const handleQuickCancelled = () => {
    if (!moveTaskToStage) return;
    moveTaskToStage(task.id, "cancelled", {
      deliveryStatusNotes: "Tender cancelled or withdrawn by procuring entity",
    });
  };

  const handleMoveToStage = (targetCol: ColumnId) => {
    if (targetCol === "lost") {
      setLostDialogOpen(true);
      return;
    }
    if (targetCol === "cancelled") {
      handleQuickCancelled();
      return;
    }
    if (moveTaskToStage) {
      moveTaskToStage(task.id, targetCol);
    }
  };

  const handleSyncToZoho = async () => {
    const stageTitle = columns.find((c) => c.id === columnId)?.title || columnId || "New";
    await syncTenderToZohoCrm(task, {
      event: "manual_sync",
      stage: stageTitle,
      countryCode: task.countryCode,
      silent: false,
    });
  };

  const handleRemoveFromPipeline = async () => {
    if (!removePipelineTask) return;
    setRemoving(true);
    try {
      await removePipelineTask(task);
      setRemoveDialogOpen(false);
    } catch {
      // The board reports the server error and restores the persisted state.
    } finally {
      setRemoving(false);
    }
  };

  // Adapt task into TenderItem format for the shared TenderDetailDialog
  const tenderDetailItem: TenderItem = {
    id: task.id,
    refNo: task.refNo ?? "TND/2026/001",
    title: task.title,
    procuringEntity: task.entity ?? "National Procuring Authority",
    countryCode: task.countryCode ?? "ZW",
    countryName: task.countryCode === "ZM" ? "Zambia" : "Zimbabwe",
    category: task.team,
    estimatedValue: task.amountAwarded ?? task.pipelineValue ?? task.estimatedValue ?? 0,
    currency: "USD",
    publishDate: "15 Aug 2026",
    closingDate: task.dueDate,
    daysRemaining: 5,
    sourcePortal: task.sourcePortal || (task.countryCode === "ZM" ? "ZPPA e-GP" : "PRAZ e-GP"),
    portalUrl: task.portalUrl,
    aiScore: task.aiScore ?? 88,
    documents: task.rfqDocument
      ? [
          {
            documentId: task.rfqDocument.id,
            title: "Original RFQ / Tender Document",
            fileName: task.rfqDocument.name,
            downloadUrl: `/api/tenders/reference-document?id=${encodeURIComponent(task.rfqDocument.id)}`,
          },
        ]
      : [],
    status: isDelivered
      ? "Delivered & Accepted"
      : isInDelivery
        ? "In Execution"
        : isContractSigning
          ? "Contract Signing"
          : isWon
            ? "Awarded"
            : isLost
              ? "Lost"
              : isCancelled
                ? "Cancelled"
                : "Open",
  };

  return (
    <>
      <article
        onClick={() => {
          if (!isOverlay) setDetailOpen(true);
        }}
        className={cn(
          "group relative flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs transition-all hover:border-border hover:shadow-md",
          isOverlay && "w-68 rotate-1 shadow-lg",
          isWon && "border-emerald-500/30 bg-emerald-500/5",
          isContractSigning && "border-indigo-500/30 bg-indigo-500/5",
          isInDelivery && "border-amber-500/30 bg-amber-500/5",
          isDelivered && "border-emerald-500/40 bg-emerald-500/10",
          isLost && "border-rose-500/20 opacity-80",
          isCancelled && "border-muted-foreground/20 opacity-60",
        )}
      >
        {/* Top Header: Jurisdiction, Ref & Priority */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {task.countryCode && (
              <span className="inline-flex h-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-semibold text-foreground leading-none">
                {task.countryCode}
              </span>
            )}
            <span className="font-mono text-xs text-muted-foreground truncate max-w-[125px]">
              {task.refNo ?? task.id}
            </span>
            {isClone && (
              <span className="inline-flex h-4 items-center justify-center rounded border border-indigo-500/30 bg-indigo-500/10 px-1 font-mono text-[9px] font-semibold text-indigo-700 dark:text-indigo-300 leading-none">
                Clone
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {task.aiScore ? (
              <span className="inline-flex h-5 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2 font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 leading-none">
                {task.aiScore}%
              </span>
            ) : null}

            <span
              className={cn(
                "inline-flex h-5 items-center justify-center rounded-md px-2 text-[10px] font-semibold leading-none",
                priorityBadgeConfig[task.priority].className,
              )}
            >
              {task.priority}
            </span>

            {/* Quick Header More Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => e.stopPropagation()}
                  className="size-5 rounded-md p-0 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Stage actions & quick move"
                >
                  <MoreHorizontal className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 text-xs" onClick={(e) => e.stopPropagation()}>
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Quick Move
                </div>
                {!isLost && (
                  <DropdownMenuItem
                    className="cursor-pointer text-xs text-rose-600 focus:text-rose-600 focus:bg-rose-500/10 font-medium"
                    onClick={() => setLostDialogOpen(true)}
                  >
                    <XCircle className="size-3.5 mr-2 text-rose-600" />
                    <span>Mark as Lost...</span>
                  </DropdownMenuItem>
                )}
                {!isCancelled && (
                  <DropdownMenuItem
                    className="cursor-pointer text-xs text-muted-foreground focus:text-foreground"
                    onClick={handleQuickCancelled}
                  >
                    <Ban className="size-3.5 mr-2 text-muted-foreground" />
                    <span>Mark as Cancelled</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer text-xs" onClick={handleSyncToZoho}>
                  <Share2 className="size-3.5 mr-2 text-primary" />
                  <span>Sync to {task.countryCode === "ZM" ? "Zambia" : "Zimbabwe"} Zoho</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => setEditOpen(true)}>
                  <Pencil className="size-3.5 mr-2 text-muted-foreground" />
                  <span>Edit Custom Data...</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Quick Edit Custom Data Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setEditOpen(true);
              }}
              className="size-5 rounded-md p-0 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Edit custom data"
            >
              <Pencil className="size-2.5" />
            </Button>
          </div>
        </div>

        {/* Title and Entity */}
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold text-sm leading-snug text-foreground line-clamp-2">{task.title}</h3>
          {task.entity && <p className="text-[11px] font-medium text-muted-foreground truncate">{task.entity}</p>}
          <p className="line-clamp-2 text-muted-foreground text-xs leading-4">{task.description}</p>
        </div>

        {/* Financial Breakdown (Value, Cost & Margin) */}
        <div className="rounded-lg border border-border/70 bg-muted/30 p-2 text-xs space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-muted-foreground font-medium truncate">
              {usesAwardedValue && task.amountAwarded ? "Awarded" : "Tender Value"}
            </span>
            <span className="font-bold text-foreground">{formatCurrency(displayedValue, { noDecimals: true })}</span>
          </div>

          {task.actualCost ? (
            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span>{usesAwardedValue && task.amountAwarded ? "Execution Cost" : "Cost"}</span>
              <span className="font-medium text-foreground">
                {formatCurrency(task.actualCost, { noDecimals: true })}
              </span>
            </div>
          ) : null}

          {task.grossMargin !== undefined ? (
            <div className="flex items-center justify-between text-[10px] font-mono border-t border-border/40 pt-1">
              <span className="text-muted-foreground">Margin</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                +{formatCurrency(task.grossMargin, { noDecimals: true })}
                {(() => {
                  const base = Number(displayedValue);
                  return base > 0 ? ` (${Math.round((task.grossMargin / base) * 100)}%)` : "";
                })()}
              </span>
            </div>
          ) : null}
        </div>

        {/* Category Tag */}
        <div className="flex items-center justify-between">
          <Badge
            variant="secondary"
            className={cn("rounded-md border-transparent px-2 text-[10px] font-medium", tagTones[task.team])}
          >
            {task.team}
          </Badge>
        </div>

        {/* Custom Lessons Learned Preview */}
        {task.lessonsLearned && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-2 text-[11px] space-y-0.5">
            <div className="font-semibold text-amber-800 dark:text-amber-200 text-[10px] uppercase tracking-wider">
              Lessons Learned
            </div>
            <p className="line-clamp-2 text-amber-900/90 dark:text-amber-100/90 text-[10px] leading-relaxed">
              {task.lessonsLearned}
            </p>
          </div>
        )}

        {/* Custom Delivery Notes Preview */}
        {task.deliveryStatusNotes && (
          <div className="rounded-lg border border-blue-500/25 bg-blue-500/10 p-2 text-[11px] space-y-0.5">
            <div className="font-semibold text-blue-800 dark:text-blue-200 text-[10px] uppercase tracking-wider">
              Delivery Milestone
            </div>
            <p className="line-clamp-2 text-blue-900/90 dark:text-blue-100/90 text-[10px] leading-relaxed">
              {task.deliveryStatusNotes}
            </p>
          </div>
        )}

        {/* Contract Ref Tag */}
        {task.contractRef && (
          <div className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/60">
            <span className="truncate">Ref: {task.contractRef}</span>
          </div>
        )}

        {/* Progress Bar (if in progress or active) */}
        {task.progress > 0 && !isWon && !isLost && !isCancelled && !task.deliveryStatusNotes && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[10px]">
              <span>Dossier Progress</span>
              <span className="font-mono">{task.progress}%</span>
            </div>
            <Progress value={task.progress} className="h-1" />
          </div>
        )}

        <Separator />

        {/* Footer: metadata and actions are deliberately separated to prevent clipping. */}
        <div className="space-y-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className={cn("size-6 shrink-0 after:rounded-md", owner.tone)}>
                <AvatarFallback className="rounded-md text-[9px] font-semibold">
                  {getInitials(owner.name)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 truncate text-[11px] font-medium text-foreground/80" title={owner.name}>
                {owner.name}
              </span>
            </div>

            <div className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 text-[10px] text-muted-foreground">
              <CalendarDays className="size-3 shrink-0" />
              <span className="whitespace-nowrap font-mono tabular-nums">{task.dueDate}</span>
            </div>
          </div>

          <div className="flex min-h-7 flex-wrap items-center justify-end gap-1.5 border-t border-border/50 pt-2">
            {isWon && cloneWonToDeliveryStage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 rounded-md px-2.5 text-[10px] gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20"
                    title="Clone won contract into an execution/delivery stage"
                  >
                    <ArrowRight className="size-2.5" /> Clone
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs w-48" onClick={(e) => e.stopPropagation()}>
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Clone to Delivery Stage
                  </div>
                  <DropdownMenuItem
                    className="cursor-pointer text-xs"
                    onClick={() => cloneWonToDeliveryStage(task, "contract-signing")}
                  >
                    <FileText className="size-3.5 mr-2 text-indigo-500" />
                    <span>6. Contract Signing</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer text-xs"
                    onClick={() => cloneWonToDeliveryStage(task, "in-delivery")}
                  >
                    <Truck className="size-3.5 mr-2 text-amber-500" />
                    <span>7. In Delivery</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer text-xs"
                    onClick={() => cloneWonToDeliveryStage(task, "delivered")}
                  >
                    <CheckCircle2 className="size-3.5 mr-2 text-emerald-500" />
                    <span>8. Delivered</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Quick Stage Move Dropdown Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 min-w-16 rounded-md px-2.5 text-[10px] gap-1.5 font-medium text-muted-foreground hover:text-foreground"
                  title="Move tender to Lost, Cancelled, or another stage"
                >
                  <ArrowRightLeft className="size-2.5" /> Stage
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 text-xs" onClick={(e) => e.stopPropagation()}>
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Quick Actions
                </div>

                {!isLost && (
                  <DropdownMenuItem
                    className="cursor-pointer text-xs text-rose-600 focus:text-rose-600 focus:bg-rose-500/10 font-medium"
                    onClick={() => setLostDialogOpen(true)}
                  >
                    <XCircle className="size-3.5 mr-2 text-rose-600" />
                    <span>Mark as Lost...</span>
                  </DropdownMenuItem>
                )}

                {!isCancelled && (
                  <DropdownMenuItem
                    className="cursor-pointer text-xs text-muted-foreground focus:text-foreground"
                    onClick={handleQuickCancelled}
                  >
                    <Ban className="size-3.5 mr-2 text-muted-foreground" />
                    <span>Mark as Cancelled</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Move to Stage
                </div>

                {columns.map((col) => {
                  const isCurrent = col.id === columnId;
                  return (
                    <DropdownMenuItem
                      key={col.id}
                      disabled={isCurrent}
                      className="cursor-pointer text-xs flex items-center justify-between"
                      onClick={() => handleMoveToStage(col.id)}
                    >
                      <span className={cn(isCurrent && "font-semibold text-primary")}>{col.title}</span>
                      {isCurrent && <Check className="size-3 text-primary ml-auto" />}
                    </DropdownMenuItem>
                  );
                })}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="cursor-pointer text-xs text-primary font-medium"
                  onClick={handleSyncToZoho}
                >
                  <Share2 className="size-3.5 mr-2" />
                  <span>Sync to {task.countryCode === "ZM" ? "Zambia" : "Zimbabwe"} Zoho CRM</span>
                </DropdownMenuItem>

                {canDeletePipelineItems && removePipelineTask && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setRemoveDialogOpen(true)}>
                      <Trash2 />
                      <span>Remove from pipeline</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                setEditOpen(true);
              }}
              className="h-7 min-w-16 rounded-md px-2.5 text-[10px] gap-1.5 font-medium text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-2.5" /> Edit
            </Button>
          </div>
        </div>
      </article>

      {/* Quick Move to Lost Modal Dialog */}
      {lostDialogOpen && (
        <Dialog open={lostDialogOpen} onOpenChange={setLostDialogOpen}>
          <DialogContent className="max-w-md p-5 gap-4 border-rose-500/20" onClick={(e) => e.stopPropagation()}>
            <DialogHeader className="p-0 text-left space-y-1">
              <div className="flex items-center gap-2 text-rose-600">
                <XCircle className="size-5" />
                <DialogTitle className="text-base font-bold text-foreground">Mark Tender as Lost</DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Move <span className="font-semibold text-foreground font-mono">{task.refNo || task.id}</span> to the
                Lost column. Recording loss reasons automatically updates your Win/Loss Debriefs.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="lostReasonSelect" className="text-xs font-semibold text-foreground">
                  Primary Loss Reason
                </Label>
                <Select value={lostReason} onValueChange={setLostReason}>
                  <SelectTrigger id="lostReasonSelect" className="h-8 text-xs">
                    <SelectValue placeholder="Select primary reason" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="Price higher than winning bidder">Price higher than winning bidder</SelectItem>
                    <SelectItem value="Technical non-compliance / specification deviation">
                      Technical non-compliance / spec deviation
                    </SelectItem>
                    <SelectItem value="Defective bid security / bank guarantee">
                      Defective bid security / bank guarantee
                    </SelectItem>
                    <SelectItem value="Missing mandatory compliance doc (PRAZ / Tax / NSSA)">
                      Missing compliance doc (PRAZ / Tax / NSSA)
                    </SelectItem>
                    <SelectItem value="Late bid submission / electronic portal timeout">
                      Late submission / portal timeout
                    </SelectItem>
                    <SelectItem value="Lead time / delivery schedule uncompetitive">
                      Lead time / delivery schedule uncompetitive
                    </SelectItem>
                    <SelectItem value="Client preferred competitor brand / OEM">
                      Client preferred competitor brand / OEM
                    </SelectItem>
                    <SelectItem value="Procurement authority cancelled or changed requirements">
                      Procurement cancelled / scope changed
                    </SelectItem>
                    <SelectItem value="Other / Unspecified commercial reason">
                      Other / Unspecified commercial reason
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="compName" className="text-xs font-medium text-muted-foreground">
                    Winning Bidder (Optional)
                  </Label>
                  <Input
                    id="compName"
                    value={competitorName}
                    onChange={(e) => setCompetitorName(e.target.value)}
                    placeholder="e.g. Rival Engineering Ltd"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="compPrice" className="text-xs font-medium text-muted-foreground">
                    Winning Bid ($ USD)
                  </Label>
                  <Input
                    id="compPrice"
                    type="number"
                    value={competitorPrice}
                    onChange={(e) => setCompetitorPrice(e.target.value)}
                    placeholder="e.g. 1350000"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="lostDebrief" className="text-xs font-medium text-muted-foreground">
                  Debrief / Lessons Learned Notes (Optional)
                </Label>
                <Textarea
                  id="lostDebrief"
                  rows={3}
                  value={lossDebriefNotes}
                  onChange={(e) => setLossDebriefNotes(e.target.value)}
                  placeholder="e.g. Winning bid was 8% lower on imported cabling. Next time engage regional SADC manufacturers."
                  className="text-xs leading-relaxed"
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 sm:justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleConfirmLost(true)}
                className="text-xs text-muted-foreground hover:text-foreground order-2 sm:order-1"
              >
                Skip Notes &amp; Move Now
              </Button>

              <div className="flex items-center gap-2 order-1 sm:order-2">
                <Button variant="outline" size="sm" onClick={() => setLostDialogOpen(false)} className="text-xs">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleConfirmLost(false)}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3"
                >
                  Move to Lost
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog
        open={removeDialogOpen}
        onOpenChange={(next) => {
          if (!next && !removing) setRemoveDialogOpen(false);
        }}
      >
        <AlertDialogContent onClick={(event) => event.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Remove this tender from the pipeline?</AlertDialogTitle>
            <AlertDialogDescription>
              {task.refNo || task.title} will be removed from this pipeline only. The source tender and every other
              pipeline tender will remain unchanged. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removing}
              onClick={(event) => {
                event.preventDefault();
                void handleRemoveFromPipeline();
              }}
            >
              {removing ? <Spinner data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
              {removing ? "Removing…" : "Remove tender"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tender Detail Modal */}
      {detailOpen && <TenderDetailDialog tender={tenderDetailItem} open={detailOpen} onOpenChange={setDetailOpen} />}

      {/* Tender Pipeline Custom Data & Performance Dossier Editor */}
      {editOpen && (
        <TenderPipelineEditDialog
          task={task}
          columnId={columnId}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSave={async (updatedTask, targetStage) => {
            if (targetStage && targetStage !== columnId && moveTaskToStage) {
              moveTaskToStage(task.id, targetStage, updatedTask);
            } else {
              await updateTask(updatedTask, columnId);
            }
          }}
        />
      )}
    </>
  );
});
