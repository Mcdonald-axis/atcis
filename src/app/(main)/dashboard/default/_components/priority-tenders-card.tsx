"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { formatCurrency } from "@/lib/utils";

import type { BoardState } from "../../kanban/_components/types";

export function PriorityTendersCard({ board }: { board: BoardState }) {
  const activeTasks = [...board.new, ...board.opportunity, ...board["in-progress"], ...board.submitted];
  const deadline = (value: string) => (Number.isFinite(Date.parse(value)) ? Date.parse(value) : Infinity);
  const priorityTasks = [...activeTasks].sort((a, b) => deadline(a.dueDate) - deadline(b.dueDate)).slice(0, 4);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Priority Pipeline Tenders</CardTitle>
        <CardDescription>Upcoming bid deadlines in the selected pipeline.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {priorityTasks.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No active tenders in this pipeline</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          priorityTasks.map((task) => (
            <Link
              key={task.id}
              href="/dashboard/tender-pipeline"
              className="flex flex-col gap-2 rounded-lg border p-4 hover:bg-muted/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{task.refNo || task.id}</span>
                <Badge variant="outline">{task.priority || "Medium"}</Badge>
              </div>
              <p className="font-medium">{task.title}</p>
              <p className="text-sm text-muted-foreground">{task.entity || "Entity not recorded"}</p>
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span>{formatCurrency(task.pipelineValue ?? 0, { noDecimals: true })}</span>
                <span className="text-muted-foreground">Due: {task.dueDate || "Not recorded"}</span>
              </div>
            </Link>
          ))
        )}
        <Button asChild variant="outline">
          <Link href="/dashboard/tender-pipeline">Open Tender Pipeline</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
