"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Globe, RefreshCw } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PortalFeedItem } from "./tender-data";

interface ProcurementSourcesProps {
  portals?: PortalFeedItem[];
}

export function ProcurementSources({ portals = [] }: ProcurementSourcesProps) {
  const getPortalParam = (id: string) => {
    const lower = id.toLowerCase();
    if (lower.startsWith("praz")) return "PRAZ";
    if (lower.startsWith("onlinetenders")) return "OnlineTenders";
    if (lower.startsWith("zppa")) return "ZPPA";
    if (lower.startsWith("worldbank")) return "World Bank";
    if (lower.startsWith("ungm") || lower.startsWith("un")) return "UNGM";
    if (lower.startsWith("afdb")) return "AfDB";
    if (lower.startsWith("gozambia")) return "GoZambiaJobs";
    return id;
  };

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold">Portal Sync Feeds</CardTitle>
          <CardDescription>Automated background scraper status &amp; sync frequency.</CardDescription>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="size-3 animate-spin text-emerald-500" />
          <span className="font-medium text-[11px] text-emerald-600 dark:text-emerald-400">Sync Active</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-2.5 pt-1">
        {portals.map((portal) => {
          const portalParam = getPortalParam(portal.id);
          const countryParam = portal.countryCode === "REGIONAL" ? "ALL" : portal.countryCode;

          return (
            <Link
              key={portal.id}
              href={`/dashboard/tenders?portal=${encodeURIComponent(portalParam)}&country=${encodeURIComponent(countryParam)}`}
              title={`View & filter tenders from ${portal.name}`}
              className="group flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-2.5 transition-all hover:border-primary/40 hover:bg-muted/50"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded border border-border/70 bg-muted px-1.5 py-0.2 font-mono text-[10px] font-semibold text-foreground">
                    {portal.countryCode}
                  </span>
                  <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                    {portal.name}
                    <ArrowUpRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">{portal.jurisdiction}</p>
              </div>

              <div className="flex flex-col items-end gap-0.5">
                <span className="font-mono text-xs font-bold tabular-nums text-foreground">
                  {portal.tendersCount.toLocaleString()} tenders
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500"></span>
                  </span>
                  {portal.syncStatus}
                </span>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
