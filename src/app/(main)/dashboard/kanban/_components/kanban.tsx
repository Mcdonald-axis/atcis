"use client";

import * as React from "react";

import { arrayMove, move } from "@dnd-kit/helpers";
import {
  DragDropProvider,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
} from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import {
  ArrowUpDown,
  Download,
  Filter,
  Kanban as KanbanIcon,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAmsForUser, type SystemUser } from "@/data/users";
import {
  deletePipelineTaskInDb,
  emptyPipelineBoard,
  fetchLivePipelineBoardFromDb,
  getLivePipelineBoard,
  saveLivePipelineBoard,
  updatePipelineTaskInDb,
} from "@/lib/pipeline-sync";
import { syncTenderToZohoCrm } from "@/lib/zoho-sync";
import { AuthService } from "@/services/auth-service";

import { columnIds, columns } from "./data";
import { KanbanColumn } from "./kanban-column";
import { KanbanContext } from "./kanban-context";
import { TaskCard } from "./task-card";
import type { BoardState, ColumnId, Task } from "./types";

interface KanbanProps {
  initialBoard: BoardState;
}

type TaskDragData = {
  type: "task";
  task: Task;
  columnId: ColumnId;
};

function isColumnId(value: unknown): value is ColumnId {
  return typeof value === "string" && columnIds.includes(value as ColumnId);
}

function isTaskDragData(value: unknown): value is TaskDragData {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "task" &&
    "task" in value &&
    typeof value.task === "object" &&
    value.task !== null &&
    "columnId" in value &&
    isColumnId(value.columnId)
  );
}

function taskMatchesMember(task: Task, member: SystemUser): boolean {
  const memberEmail = member.email.toLowerCase().trim();
  const memberName = member.name.toLowerCase().trim();
  const cleanName = memberName.replace(/^(dr|mr|mrs|ms)\.?\s+/i, "");
  const nameParts = cleanName.split(/\s+/).filter(Boolean);
  const memberFirst = nameParts[0] || "";
  const memberLast = nameParts.slice(-1)[0] || "";

  const anyTask = task as any;
  const taskOwnerEmail = String(anyTask.ownerEmail || "")
    .toLowerCase()
    .trim();
  const taskAssignedEmail = String(anyTask.assignedToEmail || "")
    .toLowerCase()
    .trim();

  if (taskOwnerEmail && taskOwnerEmail === memberEmail) return true;
  if (taskAssignedEmail && taskAssignedEmail === memberEmail) return true;
  if (anyTask.assignedToId && String(anyTask.assignedToId) === String(member.id)) return true;

  const ownerName = String(task.owner?.name || "")
    .toLowerCase()
    .trim();
  const assignedName = String(anyTask.assignedToName || "")
    .toLowerCase()
    .trim();
  const hodName = String(anyTask.assignedByHodName || "")
    .toLowerCase()
    .trim();

  if (ownerName === memberName || assignedName === memberName) return true;
  if (cleanName && (ownerName === cleanName || assignedName === cleanName)) return true;

  if (member.role === "hod" && hodName) {
    if (hodName === memberName || hodName.includes(cleanName) || (memberLast && hodName.includes(memberLast))) {
      return true;
    }
  }

  if (memberFirst && memberFirst.length > 2) {
    if (ownerName.includes(memberFirst) || assignedName.includes(memberFirst)) return true;
  }
  if (memberLast && memberLast.length > 2) {
    if (ownerName.includes(memberLast) || assignedName.includes(memberLast)) return true;
  }

  const emailPrefix = memberEmail.split("@")[0].split(".")[0];
  if (emailPrefix && emailPrefix.length > 2) {
    if (ownerName.includes(emailPrefix) || assignedName.includes(emailPrefix)) return true;
  }

  return false;
}

export function Kanban({ initialBoard }: KanbanProps) {
  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const canDeletePipelineItems = currentUser?.role === "country_admin" || currentUser?.role === "super_admin";
  const [availableAms, setAvailableAms] = React.useState<SystemUser[]>([]);
  const [activeAmEmail, setActiveAmEmail] = React.useState<string>("all");
  const [board, setBoard] = React.useState<BoardState>(() => emptyPipelineBoard());
  const [columnOrder, setColumnOrder] = React.useState<ColumnId[]>(columnIds);
  const boardBeforeDrag = React.useRef<BoardState>(board);
  const orderedColumns = columnOrder.flatMap((columnId) => columns.find((column) => column.id === columnId) ?? []);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  // Sync user context, enforce country scope, and hydrate live pipeline from database on mount
  React.useEffect(() => {
    let isMounted = true;
    const syncUserAndFetchBoard = () => {
      const u = AuthService.getCurrentUser();
      setCurrentUser(u);
      // Purge any legacy mock storage keys from v2
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.includes("kanban_board_state_v2") ||
              key === "atcis_combined_pipeline_ALL" ||
              key === "atcis_combined_pipeline_ZW" ||
              key === "atcis_combined_pipeline_ZM")
          ) {
            localStorage.removeItem(key);
          }
        }
      } catch {}

      const ams = getAmsForUser(u);
      const filteredAms =
        u?.role === "country_admin" && u.country !== "ALL" ? ams.filter((a) => a.country === u.country) : ams;
      setAvailableAms(filteredAms);

      const isSuper = u?.role === "super_admin";
      if (u?.role === "country_admin") {
        const enforced = (u.country === "ZM" ? "ZM" : "ZW") as "ZW" | "ZM";
        setCountryFilter(enforced);
        try {
          localStorage.setItem("user_country_preference", enforced);
        } catch {}
      } else if (!isSuper && u?.country && u.country !== "ALL") {
        setCountryFilter(u.country as any);
        try {
          localStorage.setItem("user_country_preference", u.country);
        } catch {}
      } else {
        const pref = localStorage.getItem("user_country_preference");
        if (pref === "ZW" || pref === "ZM" || pref === "ALL") {
          setCountryFilter(pref as any);
        }
      }

      const isAm = u?.role === "account_manager";
      let targetEmail = "all";
      if (isAm) {
        targetEmail = u?.email || "";
      } else {
        const savedAm = localStorage.getItem("hod_selected_am");
        if (
          savedAm &&
          savedAm !== "all" &&
          savedAm.toLowerCase().trim() !==
            String(u?.email || "")
              .toLowerCase()
              .trim() &&
          filteredAms.some((a) => a.email.toLowerCase() === savedAm.toLowerCase())
        ) {
          targetEmail = savedAm;
        } else {
          targetEmail = "all";
          try {
            localStorage.setItem("hod_selected_am", "all");
          } catch {}
        }
      }

      setActiveAmEmail(targetEmail);

      // Immediately show cached board if available so UI doesn't flash empty
      const cached = getLivePipelineBoard();
      if (cached && Object.values(cached).some((col) => Array.isArray(col) && col.length > 0)) {
        setBoard(cached);
        boardBeforeDrag.current = cached;
      }

      setIsLoading(true);

      fetchLivePipelineBoardFromDb(targetEmail)
        .then((dbBoard) => {
          if (isMounted && dbBoard) {
            setBoard(dbBoard);
            boardBeforeDrag.current = dbBoard;
          }
        })
        .catch((error) => {
          console.warn("Could not load pipeline board:", error);
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    };

    syncUserAndFetchBoard();
    window.addEventListener("atcis-auth-changed", syncUserAndFetchBoard);
    return () => {
      isMounted = false;
      window.removeEventListener("atcis-auth-changed", syncUserAndFetchBoard);
    };
  }, []);

  const isSelfUpdatingRef = React.useRef<boolean>(false);

  // Also listen for tracked pipeline additions
  React.useEffect(() => {
    const handleStorage = (e?: any) => {
      // Ignore update if it originated locally from this Kanban instance saving
      if (isSelfUpdatingRef.current) return;
      const live = e?.detail || getLivePipelineBoard();
      if (live && typeof live === "object") {
        setBoard(live);
        boardBeforeDrag.current = live;
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("kanban-pipeline-updated", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("kanban-pipeline-updated", handleStorage);
    };
  }, []);

  const persistBoard = React.useCallback(
    (next: BoardState) => {
      const user = AuthService.getCurrentUser();
      const selected = localStorage.getItem("hod_selected_am");
      if (user?.role !== "account_manager" && selected && selected !== "all" && selected !== user?.email) {
        toast.error("Team pipelines are read-only. Account managers edit their own boards.");
        return;
      }
      isSelfUpdatingRef.current = true;
      saveLivePipelineBoard(next)
        .catch((error) => {
          toast.error(error.message);
          fetchLivePipelineBoardFromDb(activeAmEmail)
            .then((saved) => {
              if (saved) {
                setBoard(saved);
                boardBeforeDrag.current = saved;
              }
            })
            .catch(() => {});
        })
        .finally(() => {
          setTimeout(() => {
            isSelfUpdatingRef.current = false;
          }, 150);
        });
    },
    [activeAmEmail],
  );

  const updateTask = async (updatedTask: Task, _columnId?: ColumnId) => {
    const replaceTask = (currentBoard: BoardState, replacement: Task) => {
      const next = { ...currentBoard };
      for (const col of columnIds) {
        const index = (next[col] || []).findIndex((task) => task && task.id === replacement.id);
        if (index !== -1) {
          next[col] = [...next[col]];
          next[col][index] = replacement;
          break;
        }
      }
      return next;
    };

    setBoard((currentBoard) => replaceTask(currentBoard, updatedTask));
    try {
      const savedTask = await updatePipelineTaskInDb(updatedTask);
      setBoard((currentBoard) => replaceTask(currentBoard, savedTask));
    } catch (error) {
      const saved = await fetchLivePipelineBoardFromDb(activeAmEmail).catch(() => null);
      if (saved) {
        setBoard(saved);
        boardBeforeDrag.current = saved;
      }
      throw error;
    }
  };

  const handleAmChange = (email: string) => {
    if (currentUser?.role === "account_manager") return;
    setActiveAmEmail(email);
    try {
      localStorage.setItem("hod_selected_am", email);
    } catch {}
    setIsLoading(true);
    fetchLivePipelineBoardFromDb(email)
      .then((b) => {
        if (b) setBoard(b);
      })
      .catch((err) => {
        toast.error(err.message || "Failed to load team pipeline");
      })
      .finally(() => {
        setIsLoading(false);
      });
    window.dispatchEvent(new CustomEvent("hod-am-changed", { detail: email }));
  };

  React.useEffect(() => {
    const handleHodAm = (e: any) => {
      if (currentUser?.role === "account_manager") return;
      const email = e?.detail;
      if (email) {
        setActiveAmEmail(email);
        setIsLoading(true);
        fetchLivePipelineBoardFromDb(email)
          .then((b) => {
            if (b) setBoard(b);
          })
          .catch(() => {})
          .finally(() => {
            setIsLoading(false);
          });
      }
    };
    window.addEventListener("hod-am-changed", handleHodAm);
    return () => window.removeEventListener("hod-am-changed", handleHodAm);
  }, [currentUser]);

  const [countryFilter, setCountryFilter] = React.useState<"ALL" | "ZW" | "ZM">("ALL");

  React.useEffect(() => {
    const handleFilterChanged = (e: any) => {
      const u = AuthService.getCurrentUser();
      if (u && u.role !== "super_admin") return;
      const scope = e?.detail;
      if (scope === "ZW" || scope === "ZM" || scope === "ALL") {
        setCountryFilter(scope);
      }
    };
    window.addEventListener("country-filter-changed", handleFilterChanged);
    return () => window.removeEventListener("country-filter-changed", handleFilterChanged);
  }, []);

  // Filter tasks in columns based on country filter and selected AM
  const filteredBoard: BoardState = React.useMemo(() => {
    const result: Partial<BoardState> = {};
    const selectedAm = availableAms.find((a) => a.email === activeAmEmail);
    const isAm = currentUser?.role === "account_manager";
    const isCountryAdmin = currentUser?.role === "country_admin";
    const effectiveCountry = isCountryAdmin ? (currentUser?.country === "ZM" ? "ZM" : "ZW") : countryFilter;

    const userEmail = (currentUser?.email || "").toLowerCase().trim();
    const userName = (currentUser?.name || "").toLowerCase().trim();
    const userFirst = userName.split(" ")[0];
    const userLast = userName.split(" ").slice(-1)[0];

    for (const key of columnIds) {
      result[key] = (board[key] || []).filter((t) => {
        if (!t || typeof t !== "object" || !t.id) return false;
        if (effectiveCountry !== "ALL") {
          if (t.countryCode && t.countryCode !== effectiveCountry) {
            return false;
          }
          const ref = String(t.refNo || t.id || "").toUpperCase();
          const entity = String(t.entity || "").toLowerCase();
          if (effectiveCountry === "ZW") {
            if (
              ref.startsWith("ZPPA") ||
              entity.includes("zambia") ||
              entity.includes("zesco") ||
              entity.includes("rda") ||
              entity.includes("lusaka") ||
              entity.includes("lwsc")
            ) {
              return false;
            }
          } else if (effectiveCountry === "ZM") {
            if (
              ref.startsWith("PRAZ") ||
              entity.includes("zim") ||
              entity.includes("zetdc") ||
              entity.includes("harare") ||
              entity.includes("potraz") ||
              entity.includes("natpharm") ||
              entity.includes("mofed")
            ) {
              return false;
            }
          }
        }

        // Account Managers strictly only see their own pipeline tasks and wins alone
        if (isAm) {
          const anyTask = t as any;
          if (anyTask.assignedToEmail && String(anyTask.assignedToEmail).toLowerCase().trim() === userEmail) {
            return true;
          }
          if (anyTask.assignedToId && String(anyTask.assignedToId) === String(currentUser?.id)) {
            return true;
          }
          if (anyTask.ownerEmail && String(anyTask.ownerEmail).toLowerCase().trim() === userEmail) {
            return true;
          }

          const ownerName = (t.owner?.name || "").toLowerCase().trim();
          if (ownerName && userName) {
            if (ownerName === userName) return true;
            if (userFirst && userFirst.length > 2 && ownerName.includes(userFirst)) return true;
            if (userLast && userLast.length > 2 && ownerName.includes(userLast)) return true;
          }

          const emailPrefix = userEmail.split("@")[0].split(".")[0];
          if (emailPrefix && emailPrefix.length > 2 && ownerName && ownerName.includes(emailPrefix)) {
            return true;
          }

          if (ownerName === "account manager") {
            return true;
          }

          return false;
        }

        // HOD / Admin oversight: filter by selected member (HOD, AM) if not 'all'
        if (activeAmEmail !== "all" && selectedAm) {
          if (!taskMatchesMember(t, selectedAm)) {
            return false;
          }
        }
        return true;
      });
    }
    return result as BoardState;
  }, [board, countryFilter, activeAmEmail, availableAms, currentUser]);

  // Compute status distribution metrics dynamically from the active filtered view
  const countNew = filteredBoard.new?.length ?? 0;
  const countOpp = filteredBoard.opportunity?.length ?? 0;
  const countInp = filteredBoard["in-progress"]?.length ?? 0;
  const countSub = filteredBoard.submitted?.length ?? 0;
  const countWon = filteredBoard.won?.length ?? 0;
  const countCs = filteredBoard["contract-signing"]?.length ?? 0;
  const countDel = filteredBoard["in-delivery"]?.length ?? 0;
  const countDone = filteredBoard.delivered?.length ?? 0;
  const countLost = filteredBoard.lost?.length ?? 0;
  const countCanc = filteredBoard.cancelled?.length ?? 0;

  const totalTenders =
    countNew + countOpp + countInp + countSub + countWon + countCs + countDel + countDone + countLost + countCanc || 1;

  const pct = (count: number) => Math.round((count / totalTenders) * 100);

  function handleDragStart(event: DragStartEvent) {
    const { source } = event.operation;

    if (source?.type === "task") {
      boardBeforeDrag.current = board;
    }
  }

  function handleDragOver(_event: DragOverEvent) {
    // Intentionally no-op to prevent UI thread thrashing, layout shifts, and re-render loops.
    // The DragOverlay provides smooth 60fps cursor feedback, and columns highlight via useDroppable isDropTarget.
  }

  const cloneWonToDeliveryStage = React.useCallback(
    (task: Task, targetStage: "contract-signing" | "in-delivery" | "delivered") => {
      const cloneId = `${task.id}-exec-${targetStage}-${Date.now().toString(36)}`;
      const clonedTask: Task = {
        ...task,
        id: cloneId,
        progress:
          targetStage === "contract-signing"
            ? Math.max(task.progress || 0, 90)
            : targetStage === "in-delivery"
              ? Math.max(task.progress || 0, 95)
              : 100,
        deliveryStatusNotes:
          task.deliveryStatusNotes ||
          (targetStage === "contract-signing"
            ? "Contract signing & SLA finalization in progress."
            : targetStage === "in-delivery"
              ? "Active site deployment and project execution."
              : "Final handover and acceptance completed."),
      };

      let nextBoardToPersist: BoardState | null = null;
      setBoard((currentBoard) => {
        const next = { ...currentBoard };
        // Ensure original won task remains intact in won
        if (!next.won.some((t) => t && t.id === task.id)) {
          next.won = [...next.won, task];
        }
        // Insert execution clone at the top of the destination column
        next[targetStage] = [clonedTask, ...(next[targetStage] || []).filter((t) => t && t.id !== cloneId)];
        nextBoardToPersist = next;
        return next;
      });

      if (nextBoardToPersist) {
        persistBoard(nextBoardToPersist);
      }

      const targetTitle = columns.find((c) => c.id === targetStage)?.title || targetStage;
      toast.success("Won Tender Preserved & Cloned", {
        description: `"${task.refNo || task.title}" remains in Won. An execution clone was created in ${targetTitle}.`,
      });
    },
    [persistBoard],
  );

  const removePipelineTask = React.useCallback(
    async (task: Task) => {
      if (!canDeletePipelineItems) {
        const message = "Country or super administrator access is required to remove pipeline tenders.";
        toast.error(message);
        throw new Error(message);
      }

      try {
        await deletePipelineTaskInDb(task);
        setBoard((currentBoard) => {
          const next = { ...currentBoard };
          for (const column of columnIds) {
            next[column] = (next[column] || []).filter((item) => item.id !== task.id);
          }
          boardBeforeDrag.current = next;
          return next;
        });
        toast.success("Tender removed from pipeline", {
          description: `${task.refNo || task.title} was removed. Other pipeline tenders were not affected.`,
        });
      } catch (error) {
        const saved = await fetchLivePipelineBoardFromDb(activeAmEmail).catch(() => null);
        if (saved) {
          setBoard(saved);
          boardBeforeDrag.current = saved;
        }
        const message = error instanceof Error ? error.message : "The tender could not be removed from the pipeline.";
        toast.error(message);
        throw error;
      }
    },
    [activeAmEmail, canDeletePipelineItems],
  );

  const moveTaskToStage = React.useCallback(
    (taskId: string, targetStage: ColumnId, updates?: Partial<Task>) => {
      const actionContext = {
        targetTitle: "",
        toastType: "success" as "success" | "error" | "warning" | "info",
        toastTitle: "",
        toastDesc: "",
        taskForZoho: null as Task | null,
        nextBoardToPersist: null as BoardState | null,
      };

      setBoard((currentBoard) => {
        let sourceColumn: ColumnId | null = null;
        let sourceTask: Task | null = null;

        for (const col of columnIds) {
          const found = (currentBoard[col] || []).find((t) => t && t.id === taskId);
          if (found) {
            sourceColumn = col;
            sourceTask = found;
            break;
          }
        }

        if (!sourceColumn || !sourceTask) {
          actionContext.toastType = "error";
          actionContext.toastTitle = "Tender not found in pipeline";
          return currentBoard;
        }

        if (sourceColumn === targetStage && !updates) {
          return currentBoard;
        }

        const user = AuthService.getCurrentUser();
        const selected = localStorage.getItem("hod_selected_am");
        if (user?.role !== "account_manager" && selected && selected !== "all" && selected !== user?.email) {
          actionContext.toastType = "error";
          actionContext.toastTitle = "Team pipelines are read-only. Account managers edit their own boards.";
          return currentBoard;
        }

        const next = { ...currentBoard };
        const targetColObj = columns.find((c) => c.id === targetStage);
        actionContext.targetTitle = targetColObj?.title || targetStage;

        // Case 1: Moving from Won to delivery stage -> preserve won & create clone
        if (
          sourceColumn === "won" &&
          (targetStage === "contract-signing" || targetStage === "in-delivery" || targetStage === "delivered")
        ) {
          const cloneId = `${sourceTask.id}-exec-${targetStage}-${Date.now().toString(36)}`;
          const clonedTask: Task = {
            ...sourceTask,
            ...updates,
            id: cloneId,
            progress:
              targetStage === "contract-signing"
                ? Math.max(sourceTask.progress || 0, 90)
                : targetStage === "in-delivery"
                  ? Math.max(sourceTask.progress || 0, 95)
                  : 100,
            deliveryStatusNotes:
              updates?.deliveryStatusNotes ||
              sourceTask.deliveryStatusNotes ||
              (targetStage === "contract-signing"
                ? "Contract signing & SLA finalization in progress."
                : targetStage === "in-delivery"
                  ? "Active site deployment and project execution."
                  : "Final handover and acceptance completed."),
          };

          if (!next.won.some((t) => t && t.id === sourceTask.id)) {
            next.won = [...next.won, sourceTask];
          }
          next[targetStage] = [clonedTask, ...(next[targetStage] || []).filter((t) => t && t.id !== cloneId)];

          actionContext.toastType = "success";
          actionContext.toastTitle = "Won Tender Preserved & Cloned";
          actionContext.toastDesc = `"${sourceTask.refNo || sourceTask.title}" remains in Won. An execution clone was created in ${actionContext.targetTitle}.`;

          actionContext.taskForZoho = clonedTask;
          actionContext.nextBoardToPersist = next;
          return next;
        }

        // Case 2: Moving clone back to Won -> auto remove clone to prevent duplicate
        if (targetStage === "won") {
          const isClone = sourceTask.id.includes("-exec-") || sourceTask.id.includes("-delivery-");
          if (isClone) {
            next[sourceColumn] = (next[sourceColumn] || []).filter((t) => t && t.id !== taskId);
            actionContext.toastType = "info";
            actionContext.toastTitle = "Duplicate Clone Removed";
            actionContext.toastDesc = `"${sourceTask.refNo || sourceTask.title}" is already preserved in Won.`;

            actionContext.nextBoardToPersist = next;
            return next;
          }
        }

        // Remove from source column
        next[sourceColumn] = (next[sourceColumn] || []).filter((t) => t && t.id !== taskId);

        // Build updated task with stage-specific defaults
        const updatedTask: Task = {
          ...sourceTask,
          ...updates,
          progress:
            targetStage === "lost"
              ? 100
              : targetStage === "cancelled"
                ? 0
                : targetStage === "won"
                  ? Math.max(sourceTask.progress || 0, 85)
                  : (updates?.progress ?? sourceTask.progress),
          winLossReason:
            updates?.winLossReason ||
            (targetStage === "lost"
              ? sourceTask.winLossReason || "Tender lost during evaluation"
              : sourceTask.winLossReason),
          lessonsLearned: updates?.lessonsLearned || sourceTask.lessonsLearned,
        };

        // Insert at the top of target column
        next[targetStage] = [updatedTask, ...(next[targetStage] || []).filter((t) => t && t.id !== taskId)];

        if (targetStage === "lost") {
          actionContext.toastType = "error";
          actionContext.toastTitle = `Moved to Lost: "${sourceTask.refNo || sourceTask.title}"`;
          actionContext.toastDesc = updates?.winLossReason
            ? `Reason: ${updates.winLossReason}`
            : "Recorded in pipeline as Lost. Debrief logged.";
        } else if (targetStage === "cancelled") {
          actionContext.toastType = "warning";
          actionContext.toastTitle = `Moved to Cancelled: "${sourceTask.refNo || sourceTask.title}"`;
          actionContext.toastDesc = "Tender marked as cancelled / withdrawn.";
        } else {
          actionContext.toastType = "success";
          actionContext.toastTitle = `Moved to ${actionContext.targetTitle}`;
          actionContext.toastDesc = `"${sourceTask.refNo || sourceTask.title}" is now in ${actionContext.targetTitle}.`;
        }

        actionContext.taskForZoho = updatedTask;
        actionContext.nextBoardToPersist = next;
        return next;
      });

      // Side-effects cleanly executed outside state updater
      if (actionContext.nextBoardToPersist) {
        persistBoard(actionContext.nextBoardToPersist);
      }

      if (actionContext.toastTitle) {
        if (actionContext.toastType === "error") {
          toast.error(
            actionContext.toastTitle,
            actionContext.toastDesc ? { description: actionContext.toastDesc } : undefined,
          );
        } else if (actionContext.toastType === "warning") {
          toast.warning(
            actionContext.toastTitle,
            actionContext.toastDesc ? { description: actionContext.toastDesc } : undefined,
          );
        } else if (actionContext.toastType === "info") {
          toast.info(
            actionContext.toastTitle,
            actionContext.toastDesc ? { description: actionContext.toastDesc } : undefined,
          );
        } else {
          toast.success(
            actionContext.toastTitle,
            actionContext.toastDesc ? { description: actionContext.toastDesc } : undefined,
          );
        }
      }

      if (actionContext.taskForZoho && actionContext.targetTitle) {
        void syncTenderToZohoCrm(actionContext.taskForZoho, {
          event: "tender_stage_changed",
          stage: actionContext.targetTitle,
          countryCode: actionContext.taskForZoho.countryCode,
          silent: true,
        }).catch((err) => console.warn("Zoho CRM sync notice:", err));
      }
    },
    [persistBoard],
  );

  const scrollToColumn = (colId: ColumnId) => {
    const el = document.getElementById(`kanban-column-${colId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  };

  function handleDragEnd(event: DragEndEvent) {
    const { source, target } = event.operation;

    if (!source) {
      return;
    }

    if (event.canceled) {
      if (source.type === "task") {
        setBoard(boardBeforeDrag.current);
      }
      return;
    }

    if (source.type === "column") {
      setColumnOrder((currentOrder) => move(currentOrder, event));
      return;
    }

    if (source.type === "task") {
      const sourceId = String(source.id);
      if (!target) {
        return;
      }

      // Determine destination column
      let targetColumn: ColumnId | null = null;

      // 1. Check target.data.columnId
      if (target.data && typeof target.data === "object" && "columnId" in target.data) {
        const colId = (target.data as any).columnId;
        if (isColumnId(colId)) {
          targetColumn = colId;
        }
      }

      // 2. Check target id directly (column container droppable has id === column.id)
      if (!targetColumn && isColumnId(target.id)) {
        targetColumn = target.id as ColumnId;
      }

      // 3. If target is another task card, find which column contains it
      if (!targetColumn) {
        const targetIdStr = String(target.id);
        for (const col of columnIds) {
          if ((board[col] || []).some((t) => t && t.id === targetIdStr)) {
            targetColumn = col;
            break;
          }
        }
      }

      if (!targetColumn) {
        return;
      }

      // Find current source column of the dragged task
      let sourceColumn: ColumnId | null = null;
      for (const col of columnIds) {
        if ((board[col] || []).some((t) => t && t.id === sourceId)) {
          sourceColumn = col;
          break;
        }
      }

      if (!sourceColumn) {
        return;
      }

      // Same column reordering:
      if (sourceColumn === targetColumn) {
        const targetIdStr = String(target.id);
        if (targetIdStr && targetIdStr !== sourceId && !isColumnId(target.id)) {
          const colTasks = [...(board[sourceColumn] || [])];
          const oldIndex = colTasks.findIndex((t) => t && t.id === sourceId);
          const newIndex = colTasks.findIndex((t) => t && t.id === targetIdStr);
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const reordered = arrayMove(colTasks, oldIndex, newIndex);
            const nextBoard = { ...board, [sourceColumn]: reordered };
            setBoard(nextBoard);
            persistBoard(nextBoard);
          }
        }
        return;
      }

      // Moving to a new stage!
      moveTaskToStage(sourceId, targetColumn);
    }
  }

  const isCountryAdmin = currentUser?.role === "country_admin";
  const userCountryName = currentUser?.country === "ZM" ? "Zambia" : "Zimbabwe";

  const isHodOrAdmin = currentUser?.role === "hod" || currentUser?.role === "super_admin" || isCountryAdmin;

  const activeAmName = availableAms.find((a) => a.email === activeAmEmail)?.name || "Team Member";

  const oversightBannerText = isCountryAdmin
    ? `Country Admin Oversight: Reviewing ${userCountryName} end-to-end tender lifecycle, bid submissions, and contract execution for ${activeAmEmail === "all" ? `all ${userCountryName} personnel (HODs & AMs)` : activeAmName}.`
    : currentUser?.role === "super_admin"
      ? `Regional Oversight: Reviewing end-to-end tender lifecycle, bid submissions, and contract execution for ${activeAmEmail === "all" ? "all regional personnel (HODs & AMs)" : activeAmName}.`
      : isHodOrAdmin
        ? `Department HOD Oversight: Reviewing end-to-end tender lifecycle, bid submissions, and contract execution for ${activeAmEmail === "all" ? "all department personnel" : activeAmName}.`
        : "Track government and enterprise tenders from discovery, qualification, and bidding through contract signing, site execution, and final delivery sign-off.";

  const combinedAmLabel = isCountryAdmin
    ? `Combined Pipeline (All ${userCountryName} Team — HOD & AMs)`
    : currentUser?.role === "super_admin"
      ? "Combined Pipeline (All Regional Operations)"
      : "Combined Pipeline (All Department AMs)";

  return (
    <KanbanContext.Provider
      value={{ canDeletePipelineItems, updateTask, removePipelineTask, cloneWonToDeliveryStage, moveTaskToStage }}
    >
      <div className="flex h-[calc(100dvh-var(--dashboard-header-height,60px))] min-h-0 min-w-0 flex-col overflow-hidden">
        {/* Top Status Distribution Banner */}
        <div className="shrink-0 border-b border-border/60 bg-background/95 p-3 sm:p-4 sm:px-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-foreground tracking-tight sm:text-xl">
                  Tender Pipeline &amp; Delivery Lifecycle
                </h2>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{oversightBannerText}</p>
            </div>

            {isHodOrAdmin && availableAms.length > 0 && (
              <div className="flex min-w-0 items-center gap-2 sm:w-auto">
                {/* HOD / Country Admin Team Pipeline Selector */}
                <Users className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="hidden text-xs font-medium text-foreground sm:inline">Pipeline:</span>
                <Select value={activeAmEmail} onValueChange={handleAmChange}>
                  <SelectTrigger
                    size="sm"
                    className="min-w-0 flex-1 bg-background text-xs font-semibold sm:w-80"
                    aria-label="Select team member pipeline"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-w-[calc(100vw-2rem)]">
                    <SelectGroup>
                      <SelectItem value="all">{combinedAmLabel}</SelectItem>
                      {availableAms.map((member) => {
                        const roleTag =
                          member.role === "hod" ? "HOD" : member.role === "country_admin" ? "Admin" : "AM";
                        const countryTag =
                          member.country === "ZM" ? "Zambia" : member.country === "ZW" ? "Zimbabwe" : "Regional";
                        return (
                          <SelectItem key={member.email} value={member.email}>
                            {member.name} · {roleTag} ({countryTag})
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {isLoading && <RefreshCw className="size-3 shrink-0 animate-spin text-primary" aria-hidden="true" />}
              </div>
            )}
          </div>

          {/* Status Distribution Summary Badges & Cards (Clickable to jump directly to column) */}
          <div className="mt-3 rounded-xl border border-border/60 bg-muted/25 p-2.5 sm:mt-4 sm:p-3">
            <div className="flex flex-col items-start gap-0.5 pb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <span className="font-semibold text-xs text-foreground uppercase tracking-wider">
                End-to-End Lifecycle Stages ({totalTenders} total)
              </span>
              <span className="font-mono text-[10px] text-muted-foreground sm:text-[11px]">
                Tap a stage to jump to its column
              </span>
            </div>

            <div className="scrollbar-thin flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0 lg:grid-cols-10">
              {/* 1. New */}
              <button
                type="button"
                onClick={() => scrollToColumn("new")}
                className="min-w-28 snap-start cursor-pointer rounded-lg border border-border/50 bg-background/80 p-2 text-center shadow-2xs transition-all hover:border-primary/50 hover:bg-background sm:min-w-0"
                title="Jump to 1. New column"
              >
                <p className="text-[10px] font-semibold text-muted-foreground truncate">1. New</p>
                <p className="font-mono text-sm sm:text-base font-bold text-foreground">{countNew}</p>
                <p className="font-mono text-[9px] text-muted-foreground">({pct(countNew)}%)</p>
              </button>

              {/* 2. Opportunity */}
              <button
                type="button"
                onClick={() => scrollToColumn("opportunity")}
                className="min-w-28 snap-start cursor-pointer rounded-lg border border-blue-500/20 bg-background/80 p-2 text-center shadow-2xs transition-all hover:border-blue-500/50 hover:bg-blue-500/5 sm:min-w-0"
                title="Jump to 2. Opportunity column"
              >
                <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 truncate">2. Opportunity</p>
                <p className="font-mono text-sm sm:text-base font-bold text-foreground">{countOpp}</p>
                <p className="font-mono text-[9px] text-muted-foreground">({pct(countOpp)}%)</p>
              </button>

              {/* 3. In Progress */}
              <button
                type="button"
                onClick={() => scrollToColumn("in-progress")}
                className="min-w-28 snap-start cursor-pointer rounded-lg border border-amber-500/20 bg-background/80 p-2 text-center shadow-2xs transition-all hover:border-amber-500/50 hover:bg-amber-500/5 sm:min-w-0"
                title="Jump to 3. In Progress column"
              >
                <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 truncate">3. In Progress</p>
                <p className="font-mono text-sm sm:text-base font-bold text-foreground">{countInp}</p>
                <p className="font-mono text-[9px] text-muted-foreground">({pct(countInp)}%)</p>
              </button>

              {/* 4. Submitted */}
              <button
                type="button"
                onClick={() => scrollToColumn("submitted")}
                className="min-w-28 snap-start cursor-pointer rounded-lg border border-indigo-500/20 bg-background/80 p-2 text-center shadow-2xs transition-all hover:border-indigo-500/50 hover:bg-indigo-500/5 sm:min-w-0"
                title="Jump to 4. Submitted column"
              >
                <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 truncate">4. Submitted</p>
                <p className="font-mono text-sm sm:text-base font-bold text-foreground">{countSub}</p>
                <p className="font-mono text-[9px] text-muted-foreground">({pct(countSub)}%)</p>
              </button>

              {/* 5. Won */}
              <button
                type="button"
                onClick={() => scrollToColumn("won")}
                className="min-w-28 snap-start cursor-pointer rounded-lg border border-emerald-500/20 bg-background/80 p-2 text-center shadow-2xs transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5 sm:min-w-0"
                title="Jump to 5. Won column"
              >
                <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 truncate">5. Won</p>
                <p className="font-mono text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {countWon}
                </p>
                <p className="font-mono text-[9px] text-muted-foreground">({pct(countWon)}%)</p>
              </button>

              {/* 6. Contract Signing */}
              <button
                type="button"
                onClick={() => scrollToColumn("contract-signing")}
                className="min-w-28 snap-start cursor-pointer rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-2 text-center shadow-2xs transition-all hover:border-indigo-500/60 hover:bg-indigo-500/10 sm:min-w-0"
                title="Jump to 6. Contract Signing column"
              >
                <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 truncate">
                  6. Contract Sign
                </p>
                <p className="font-mono text-sm sm:text-base font-bold text-indigo-600 dark:text-indigo-400">
                  {countCs}
                </p>
                <p className="font-mono text-[9px] text-muted-foreground">({pct(countCs)}%)</p>
              </button>

              {/* 7. In Delivery */}
              <button
                type="button"
                onClick={() => scrollToColumn("in-delivery")}
                className="min-w-28 snap-start cursor-pointer rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-center shadow-2xs transition-all hover:border-amber-500/60 hover:bg-amber-500/10 sm:min-w-0"
                title="Jump to 7. In Delivery column"
              >
                <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 truncate">7. In Delivery</p>
                <p className="font-mono text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400">
                  {countDel}
                </p>
                <p className="font-mono text-[9px] text-muted-foreground">({pct(countDel)}%)</p>
              </button>

              {/* 8. Delivered */}
              <button
                type="button"
                onClick={() => scrollToColumn("delivered")}
                className="min-w-28 snap-start cursor-pointer rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 text-center shadow-2xs transition-all hover:border-emerald-500/60 hover:bg-emerald-500/20 sm:min-w-0"
                title="Jump to 8. Delivered column"
              >
                <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 truncate">
                  8. Delivered
                </p>
                <p className="font-mono text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-300">
                  {countDone}
                </p>
                <p className="font-mono text-[9px] text-muted-foreground">({pct(countDone)}%)</p>
              </button>

              {/* 9. Lost */}
              <button
                type="button"
                onClick={() => scrollToColumn("lost")}
                className="min-w-28 snap-start cursor-pointer rounded-lg border border-rose-500/30 bg-rose-500/5 p-2 text-center shadow-2xs transition-all hover:border-rose-500 hover:bg-rose-500/15 sm:min-w-0"
                title="Jump to 9. Lost column"
              >
                <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 truncate">9. Lost</p>
                <p className="font-mono text-sm sm:text-base font-bold text-foreground">{countLost}</p>
                <p className="font-mono text-[9px] text-muted-foreground">({pct(countLost)}%)</p>
              </button>

              {/* 10. Cancelled */}
              <button
                type="button"
                onClick={() => scrollToColumn("cancelled")}
                className="min-w-28 snap-start cursor-pointer rounded-lg border border-border/50 bg-background/80 p-2 text-center shadow-2xs transition-all hover:border-muted-foreground hover:bg-muted/40 sm:min-w-0"
                title="Jump to 10. Cancelled column"
              >
                <p className="text-[10px] font-semibold text-muted-foreground truncate">10. Cancelled</p>
                <p className="font-mono text-sm sm:text-base font-bold text-foreground">{countCanc}</p>
                <p className="font-mono text-[9px] text-muted-foreground">({pct(countCanc)}%)</p>
              </button>
            </div>
          </div>
        </div>

        {/* Main Drag and Drop Pipeline Board */}
        <DragDropProvider onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="scrollbar-thin min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden bg-muted/20 px-3 pt-3 pb-2 [scrollbar-color:var(--border)_transparent] sm:px-4 sm:pt-4 lg:px-6">
            <div className="inline-grid h-full min-w-full grid-flow-col auto-cols-[calc(100vw-1.5rem)] gap-3 pb-2 sm:grid-flow-row sm:grid-cols-[repeat(10,minmax(18.5rem,1fr))] sm:gap-4">
              {orderedColumns.map((column, index) => (
                <KanbanColumn key={column.id} column={column} index={index} tasks={filteredBoard[column.id] || []} />
              ))}
            </div>
          </div>
          <DragOverlay dropAnimation={null}>
            {(source) => {
              if (source.type !== "task" || !isTaskDragData(source.data)) {
                return null;
              }

              const columnId = isSortable(source) && isColumnId(source.group) ? source.group : source.data.columnId;

              return <TaskCard task={source.data.task} columnId={columnId} isOverlay />;
            }}
          </DragOverlay>
        </DragDropProvider>
      </div>
    </KanbanContext.Provider>
  );
}
