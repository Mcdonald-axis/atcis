"use client";

import React from "react";

import type { ColumnId, Task } from "./types";

interface KanbanContextType {
  canDeletePipelineItems: boolean;
  updateTask: (updatedTask: Task, columnId?: ColumnId) => Promise<void>;
  removePipelineTask?: (task: Task) => Promise<void>;
  cloneWonToDeliveryStage?: (task: Task, targetStage: "contract-signing" | "in-delivery" | "delivered") => void;
  moveTaskToStage?: (taskId: string, targetStage: ColumnId, updates?: Partial<Task>) => void;
}

export const KanbanContext = React.createContext<KanbanContextType>({
  canDeletePipelineItems: false,
  updateTask: async () => {},
  removePipelineTask: async () => {},
  cloneWonToDeliveryStage: () => {},
  moveTaskToStage: () => {},
});

export const useKanbanContext = () => React.useContext(KanbanContext);
