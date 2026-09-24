"use client";

import { useState } from "react";

import {
  AlertTriangle,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Send,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculatePipelineMetrics } from "@/lib/pipeline-sync";
import { formatCurrency } from "@/lib/utils";

import type { CountryScope } from "./tender-data";
import type { DashboardPipeline } from "./use-dashboard-pipeline";

interface TenderKpisProps {
  pipeline: DashboardPipeline;
  countryScope?: CountryScope;
}

export function TenderKpis({ pipeline, countryScope = "ALL" }: TenderKpisProps) {
  const [selectedDialog, setSelectedDialog] = useState<"won" | "submitted" | "lost" | null>(null);
  const { board, user, effectiveCountryScope, isHodOrAdmin, availableAms, activeAmEmail, handleAmChange } = pipeline;

  const isCountryAdmin = user?.role === "country_admin";
  const effectiveScope: CountryScope =
    effectiveCountryScope || (isCountryAdmin ? (user?.country === "ZM" ? "ZM" : "ZW") : countryScope);
  const pipelineMetrics = calculatePipelineMetrics(board, effectiveScope);

  const scopeLabel = effectiveScope === "ZW" ? "Zimbabwe" : effectiveScope === "ZM" ? "Zambia" : "Zimbabwe & Zambia";

  const kpis = [
    {
      id: "won-tenders",
      title: "Won Contracts Value",
      value:
        pipeline.loading || pipeline.error ? "—" : formatCurrency(pipelineMetrics.awardedValue, { noDecimals: true }),
      description: `${pipelineMetrics.awardedContractsCount} Contracts Won · ${scopeLabel}`,
      badge: "Live Pipeline Won",
      badgeColor: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      icon: Trophy,
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      clickable: true,
      onClick: () => setSelectedDialog("won"),
    },
    {
      id: "pipeline-value",
      title: "Total Pipeline Value",
      value:
        pipeline.loading || pipeline.error ? "—" : formatCurrency(pipelineMetrics.pipelineValue, { noDecimals: true }),
      description: `${pipelineMetrics.activeTenders} Active Bids & Opportunities in Pipeline`,
      badge: "Live Pipeline Active",
      badgeColor: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
      icon: TrendingUp,
      iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      clickable: false,
    },
    {
      id: "closing-soon",
      title: "Submitted",
      value:
        pipeline.loading || pipeline.error ? "—" : formatCurrency(pipelineMetrics.submittedValue, { noDecimals: true }),
      description: `${pipelineMetrics.submittedCount} Bids Submitted · ${pipelineMetrics.criticalDeadlines} in <48h`,
      badge: `${pipelineMetrics.criticalDeadlines} Closing in 48h`,
      badgeColor: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
      icon: Clock,
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      clickable: true,
      onClick: () => setSelectedDialog("submitted"),
    },
    {
      id: "lost-tenders",
      title: "Lost Tenders Value",
      value: pipeline.loading || pipeline.error ? "—" : formatCurrency(pipelineMetrics.lostValue, { noDecimals: true }),
      description: `${pipelineMetrics.lostContractsCount} Lost Tenders · Debriefs Captured`,
      badge: `${pipelineMetrics.lostContractsCount} Lost · Debriefed`,
      badgeColor: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
      icon: XCircle,
      iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      clickable: true,
      onClick: () => setSelectedDialog("lost"),
    },
  ];

  const selectedAmName =
    activeAmEmail === "all"
      ? isCountryAdmin
        ? `All ${scopeLabel} Account Managers`
        : "All Account Managers (Combined)"
      : availableAms.find((a) => a.email === activeAmEmail)?.name || "Account Manager";

  const oversightTitle = isCountryAdmin
    ? "Country Admin Oversight:"
    : user?.role === "super_admin"
      ? "Super Admin Regional Oversight:"
      : "HOD Team Oversight:";

  const oversightSubtitle =
    activeAmEmail === "all"
      ? isCountryAdmin
        ? `Viewing combined pipeline across all ${scopeLabel} personnel (HOD & AMs)`
        : user?.role === "super_admin"
          ? "Viewing combined pipeline across all regional personnel (HOD & AMs)"
          : "Viewing combined pipeline across all personnel in your department"
      : `Viewing pipeline for ${selectedAmName}`;

  const combinedOptionLabel = isCountryAdmin
    ? `Combined Pipeline (All ${scopeLabel} Team — HOD & AMs)`
    : user?.role === "super_admin"
      ? "Combined Pipeline (All Regional Operations)"
      : "Combined Pipeline (All Department Personnel)";

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/* Oversight Selector */}
      {isHodOrAdmin && (
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-3.5 sm:py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Users className="size-4 text-primary shrink-0" />
            <span className="min-w-0 font-semibold text-foreground">{oversightTitle}</span>
            <span className="text-muted-foreground hidden sm:inline">{oversightSubtitle}</span>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">Pipeline View:</span>
            <Select value={activeAmEmail} onValueChange={handleAmChange}>
              <SelectTrigger size="sm" className="w-full min-w-0 bg-background font-semibold sm:w-80">
                <SelectValue placeholder="Choose a pipeline" />
              </SelectTrigger>
              <SelectContent position="popper" align="end" className="max-w-[calc(100vw-2rem)]">
                <SelectGroup>
                  <SelectItem value="all">{combinedOptionLabel}</SelectItem>
                  {availableAms.map((member) => {
                    const roleTag = member.role === "hod" ? "HOD" : member.role === "country_admin" ? "Admin" : "AM";
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
          </div>
        </div>
      )}

      {/* Live Synchronization Status Indicator */}
      <div className="flex flex-col items-start gap-1 px-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-semibold text-foreground">
            {pipeline.loading ? "Loading pipeline…" : pipeline.error ? "Pipeline unavailable" : "Pipeline up to date"}
          </span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            — Real-time calculation from Kanban board &amp; tracked procurement items
          </span>
        </div>
        <span className="pl-3.5 font-mono text-[10px] text-muted-foreground sm:pl-0">Auto-updates on card drag</span>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card
              key={kpi.id}
              onClick={kpi.onClick}
              size="sm"
              className={`min-h-36 gap-3 border-border/70 bg-card shadow-xs transition-all ${
                kpi.clickable
                  ? "cursor-pointer hover:border-primary/50 hover:shadow-md hover:bg-muted/20 active:scale-[0.99]"
                  : "hover:border-border hover:shadow-sm"
              }`}
            >
              {/* Top Row: Label & Icon */}
              <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <CardTitle className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${kpi.iconBg}`}>
                  <Icon className="size-3.5" />
                </div>
              </CardHeader>

              {/* Metric Value & Subtitle with fixed heights for perfect vertical alignment */}
              <CardContent className="flex flex-1 flex-col gap-0.5">
                <div className="flex min-h-7 items-center truncate font-mono text-2xl font-bold tracking-tight text-foreground">
                  {kpi.value}
                </div>
                <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">{kpi.description}</p>
              </CardContent>

              {/* Bottom Badge Row */}
              <CardFooter className="mt-auto justify-between gap-2 border-0 bg-transparent pt-0">
                <Badge variant="outline" className={`min-w-0 truncate text-[10px] ${kpi.badgeColor}`}>
                  {kpi.badge}
                </Badge>
                {kpi.clickable && (
                  <span className="shrink-0 text-[10px] text-muted-foreground transition-colors hover:text-primary">
                    View list →
                  </span>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Won Contracts Detail Dialog */}
      <Dialog open={selectedDialog === "won"} onOpenChange={(open) => !open && setSelectedDialog(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
          <div className="p-5 border-b border-border/70 bg-muted/20 shrink-0">
            <div className="flex items-center justify-between gap-2 pr-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs font-semibold">
                    Won &amp; In Execution
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground">
                    {pipelineMetrics.awardedContractsCount} Contracts Awarded
                  </span>
                </div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Won Contracts · {formatCurrency(pipelineMetrics.awardedValue, { noDecimals: true })} Total Awarded
                  Value
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Tenders currently marked in the Won stage on your live pipeline.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="p-5 overflow-y-auto flex-1 space-y-3">
            {pipelineMetrics.wonTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Trophy className="size-10 stroke-1 text-muted-foreground/30 mb-2" />
                <p className="text-sm font-semibold text-foreground">No Tenders in Won Stage</p>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  You currently have 0 tenders in the Won column. When tenders are awarded, drag them to the Won column
                  on your pipeline to track them here.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/70 overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted text-muted-foreground border-b border-border/70">
                    <tr>
                      <th className="p-3 font-semibold">Tender Ref & Title</th>
                      <th className="p-3 font-semibold">Procuring Entity</th>
                      <th className="p-3 font-semibold text-right">Awarded Value</th>
                      <th className="p-3 font-semibold">Contract Ref</th>
                      <th className="p-3 font-semibold">Delivery / Status Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {pipelineMetrics.wonTasks.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 space-y-0.5 max-w-[220px]">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 block">
                            {item.refNo}
                          </span>
                          <p className="font-medium text-foreground text-xs leading-snug line-clamp-2">{item.title}</p>
                        </td>
                        <td className="p-3 text-muted-foreground font-medium">{item.entity}</td>
                        <td className="p-3 font-mono font-bold text-foreground text-right">
                          {formatCurrency(item.amountAwarded ?? item.pipelineValue ?? 0, { noDecimals: true })}
                        </td>
                        <td className="p-3 font-mono text-muted-foreground text-[11px]">
                          {item.contractRef || "Pending Ref"}
                        </td>
                        <td className="p-3 max-w-[220px]">
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            {item.deliveryStatusNotes || item.winLossReason || item.description}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="p-3 px-5 border-t border-border/70 bg-muted/20 flex items-center justify-between shrink-0">
            <span className="text-xs text-muted-foreground">Directly synced with your Kanban Pipeline</span>
            <Button size="sm" variant="outline" onClick={() => setSelectedDialog(null)} className="h-7 text-xs">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Submitted Tenders Detail Dialog */}
      <Dialog open={selectedDialog === "submitted"} onOpenChange={(open) => !open && setSelectedDialog(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
          <div className="p-5 border-b border-border/70 bg-muted/20 shrink-0">
            <div className="flex items-center justify-between gap-2 pr-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs">
                    Submitted Bids
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground">
                    {pipelineMetrics.submittedCount} Bids Lodged
                  </span>
                </div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Submitted Tenders · {formatCurrency(pipelineMetrics.submittedValue, { noDecimals: true })} Total
                  Lodged
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Live proposals currently in evaluation from your Kanban pipeline.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="p-5 overflow-y-auto flex-1 space-y-3">
            <div className="rounded-xl border border-border/70 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-muted text-muted-foreground border-b border-border/70">
                  <tr>
                    <th className="p-3 font-semibold">Tender Ref & Title</th>
                    <th className="p-3 font-semibold">Procuring Entity</th>
                    <th className="p-3 font-semibold text-right">Submitted Value</th>
                    <th className="p-3 font-semibold">Deadline</th>
                    <th className="p-3 font-semibold text-center">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {pipelineMetrics.submittedTasks.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 space-y-0.5 max-w-[240px]">
                        <span className="font-mono font-bold text-primary block">{item.refNo}</span>
                        <p className="font-medium text-foreground text-xs leading-snug line-clamp-2">{item.title}</p>
                      </td>
                      <td className="p-3 text-muted-foreground font-medium">{item.entity}</td>
                      <td className="p-3 font-mono font-bold text-foreground text-right">
                        {formatCurrency(item.pipelineValue ?? 0, { noDecimals: true })}
                      </td>
                      <td className="p-3 font-mono text-foreground font-medium">{item.dueDate || "Closing Soon"}</td>
                      <td className="p-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize font-medium ${
                            item.priority === "High"
                              ? "border-rose-500/40 text-rose-600 bg-rose-500/10"
                              : "border-blue-500/40 text-blue-600 bg-blue-500/10"
                          }`}
                        >
                          {item.priority}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-3 px-5 border-t border-border/70 bg-muted/20 flex items-center justify-between shrink-0">
            <span className="text-xs text-muted-foreground">Directly synced with your Kanban Pipeline</span>
            <Button size="sm" variant="outline" onClick={() => setSelectedDialog(null)} className="h-7 text-xs">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lost Tenders Detail Dialog */}
      <Dialog open={selectedDialog === "lost"} onOpenChange={(open) => !open && setSelectedDialog(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
          <div className="p-5 border-b border-border/70 bg-muted/20 shrink-0">
            <div className="flex items-center justify-between gap-2 pr-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-xs">
                    Lost Proposals
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground">
                    {pipelineMetrics.lostContractsCount} Lost Tenders
                  </span>
                </div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Lost Tenders & Debrief Analysis · {formatCurrency(pipelineMetrics.lostValue, { noDecimals: true })}{" "}
                  Total Lost
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Root-cause debriefs and lessons learned captured from your pipeline.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="p-5 overflow-y-auto flex-1 space-y-3">
            <div className="rounded-xl border border-border/70 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-muted text-muted-foreground border-b border-border/70">
                  <tr>
                    <th className="p-3 font-semibold">Tender Ref & Title</th>
                    <th className="p-3 font-semibold">Procuring Entity</th>
                    <th className="p-3 font-semibold text-right">Our Bid Value</th>
                    <th className="p-3 font-semibold text-right">Winning Bid</th>
                    <th className="p-3 font-semibold">Debrief & Lessons Learned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {pipelineMetrics.lostTasks.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 space-y-0.5 max-w-[200px]">
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400 block">{item.refNo}</span>
                        <p className="font-medium text-foreground text-xs leading-snug line-clamp-2">{item.title}</p>
                      </td>
                      <td className="p-3 text-muted-foreground font-medium">{item.entity}</td>
                      <td className="p-3 font-mono font-bold text-foreground text-right">
                        {formatCurrency(item.pipelineValue ?? 0, { noDecimals: true })}
                      </td>
                      <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400 text-right">
                        {item.amountAwarded ? formatCurrency(item.amountAwarded, { noDecimals: true }) : "-"}
                      </td>
                      <td className="p-3 max-w-[240px]">
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          {item.lessonsLearned || item.winLossReason || item.description}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-3 px-5 border-t border-border/70 bg-muted/20 flex items-center justify-between shrink-0">
            <span className="text-xs text-muted-foreground">Directly synced with your Kanban Pipeline</span>
            <Button size="sm" variant="outline" onClick={() => setSelectedDialog(null)} className="h-7 text-xs">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
