"use client";

import { useState } from "react";

import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";

import { columns } from "../../kanban/_components/data";
import type { BoardState } from "../../kanban/_components/types";

type Metric = "value" | "count";
type StageDatum = { stage: string; value: number; count: number };

const chartConfig = {
  value: { label: "Tender value", color: "var(--primary)" },
  count: { label: "Tenders", color: "var(--primary)" },
} satisfies ChartConfig;

const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const fullNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const money = (value: number) => `$${fullNumber.format(value)}`;
const compactMoney = (value: number) => `$${compactNumber.format(value)}`;

export function TenderTrendsChart({ board }: { board: BoardState }) {
  const [metric, setMetric] = useState<Metric>("value");
  const isMobile = useIsMobile();
  const chartData: StageDatum[] = columns.map((column) => ({
    stage: column.title,
    count: board[column.id].length,
    value: board[column.id].reduce((sum, task) => {
      const amount = column.id === "won" ? (task.amountAwarded ?? task.pipelineValue ?? 0) : (task.pipelineValue ?? 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0),
  }));
  const totalValue = chartData.reduce((sum, stage) => sum + stage.value, 0);
  const totalCount = chartData.reduce((sum, stage) => sum + stage.count, 0);
  const occupiedStages = chartData.filter((stage) => stage.count > 0).length;
  const hasValues = chartData.some((stage) => stage.value !== 0);
  const hasMetricValues = metric === "count" ? totalCount > 0 : hasValues;
  const minimumValue = Math.min(0, ...chartData.map((stage) => stage[metric]));
  const formatMetric = (value: number) => (metric === "value" ? compactMoney(value) : compactNumber.format(value));

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{metric === "value" ? "Pipeline Value by Stage" : "Pipeline Tenders by Stage"}</CardTitle>
        <CardDescription>See how your selected pipeline is distributed across each stage.</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {metric === "value" ? "Total value across all stages" : "Total tenders across all stages"}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="break-all text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                {metric === "value" ? money(totalValue) : fullNumber.format(totalCount)}
              </span>
              <Badge variant="secondary">
                {metric === "value"
                  ? `${fullNumber.format(totalCount)} ${totalCount === 1 ? "tender" : "tenders"}`
                  : `${occupiedStages} of ${columns.length} stages`}
              </Badge>
            </div>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={metric}
            onValueChange={(value) => {
              if (value === "value" || value === "count") setMetric(value);
            }}
            aria-label="Chart measure"
            className="grid w-full grid-cols-2 sm:flex sm:w-fit"
          >
            <ToggleGroupItem value="value" aria-label="Show tender values">
              Value
            </ToggleGroupItem>
            <ToggleGroupItem value="count" aria-label="Show tender counts">
              Tenders
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {totalCount > 0 ? (
          <div className="flex flex-col gap-3">
            {metric === "value" && !hasValues && (
              <p className="text-sm text-muted-foreground">
                No values recorded yet. Select Tenders to compare the number at each stage.
              </p>
            )}
            <ChartContainer
              className="h-80 w-full aspect-auto sm:h-100"
              config={chartConfig}
              aria-label={`Pipeline ${metric === "value" ? "value" : "tender count"} by stage`}
            >
              <BarChart
                accessibilityLayer
                data={chartData}
                layout="vertical"
                margin={{ left: 0, right: isMobile ? 36 : 64, top: 4, bottom: 0 }}
                barSize={16}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 5" />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tickCount={4}
                  minTickGap={28}
                  allowDecimals={metric === "value"}
                  domain={hasMetricValues ? [minimumValue, "auto"] : [0, 1]}
                  tickFormatter={formatMetric}
                  hide={!hasMetricValues}
                />
                <YAxis
                  dataKey="stage"
                  type="category"
                  width={isMobile ? 84 : 112}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={12}
                  interval={0}
                  tick={{ fontSize: isMobile ? 10 : 11 }}
                />
                <ChartTooltip
                  cursor={{ fill: "var(--muted)", fillOpacity: 0.35 }}
                  content={({ active, payload }) => {
                    const stage = payload?.[0]?.payload as StageDatum | undefined;
                    if (!stage) return null;
                    const total = metric === "value" ? totalValue : totalCount;
                    const share = total > 0 ? `${((stage[metric] / total) * 100).toFixed(1)}%` : "—";
                    return (
                      <ChartTooltipContent
                        active={active}
                        payload={payload}
                        label={stage.stage}
                        className="min-w-52 p-3"
                        formatter={() => (
                          <dl className="grid w-full grid-cols-[1fr_auto] gap-x-6 gap-y-2">
                            <dt className="text-muted-foreground">Tender value</dt>
                            <dd className="text-right font-medium tabular-nums">{money(stage.value)}</dd>
                            <dt className="text-muted-foreground">Tenders</dt>
                            <dd className="text-right font-medium tabular-nums">{stage.count}</dd>
                            <dt className="text-muted-foreground">
                              Share of {metric === "value" ? "value" : "tenders"}
                            </dt>
                            <dd className="text-right font-medium tabular-nums">{share}</dd>
                          </dl>
                        )}
                      />
                    );
                  }}
                />
                <Bar
                  dataKey={metric}
                  fill={`var(--color-${metric})`}
                  fillOpacity={0.85}
                  activeBar={{ fillOpacity: 1 }}
                  background={{ fill: "var(--muted)", fillOpacity: 0.4, radius: 4 }}
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey={metric}
                    position="right"
                    offset={10}
                    className="fill-foreground tabular-nums"
                    fontSize={11}
                    formatter={(value) => formatMetric(Number(value))}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
            <ul className="sr-only" aria-label="Pipeline stage figures">
              {chartData.map((stage) => (
                <li key={stage.stage}>
                  {stage.stage}: {money(stage.value)}, {stage.count} tenders.
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Empty className="min-h-72">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ChartNoAxesColumnIncreasing aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Your pipeline starts here</EmptyTitle>
              <EmptyDescription>
                Add a tender or receive an assignment to see its value and stage here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>

      <CardFooter>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Includes all stages, including lost and cancelled tenders. Won uses the recorded award value when available;
          other stages use values entered in the pipeline editor.
        </p>
      </CardFooter>
    </Card>
  );
}
