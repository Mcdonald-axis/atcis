"use client";

import { Building2, Cpu, Droplets, HeartPulse, Truck, Zap } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";

import type { SectorItem } from "./tender-data";

interface SectorBreakdownProps {
  sectors?: SectorItem[];
}

const iconMap = {
  Building2,
  Cpu,
  Zap,
  HeartPulse,
  Truck,
  Droplets,
};

export function SectorBreakdown({ sectors = [] }: SectorBreakdownProps) {
  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Tenders by Sector</CardTitle>
        <CardDescription>Value distribution across key procurement categories.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {sectors.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No sector data yet</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
        {sectors.map((sector) => {
          const Icon = iconMap[sector.iconName] || Building2;
          return (
            <div key={sector.id} className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded bg-muted">
                    <Icon className="size-3.5 text-muted-foreground" />
                  </div>
                  <span className="min-w-0 break-words font-medium text-foreground">{sector.name}</span>
                </div>
                <div className="flex items-center justify-between gap-2 pl-8 sm:justify-start sm:pl-0">
                  <span className="text-muted-foreground">{sector.tendersCount} tenders</span>
                  <span className="font-semibold font-mono tabular-nums text-foreground">
                    {formatCurrency(sector.value, { noDecimals: true })}
                  </span>
                </div>
              </div>
              <Progress value={sector.percentage} className="h-1.5" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
