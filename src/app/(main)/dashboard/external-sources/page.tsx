"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Globe, Play, RefreshCw, Server, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AuthService } from "@/services/auth-service";
import { TenderApiService } from "@/services/tender-api";
import { toast } from "sonner";

interface ScraperSource {
  id: string;
  name: string;
  portalUrl: string;
  countryCode: "ZW" | "ZM" | "INTL";
  jurisdiction: string;
  intervalMinutes: number;
  lastRun: string;
  recordsHarvested: number;
  status: "Active" | "Syncing" | "Idle" | "Degraded";
  healthPercentage: number;
}

const scraperSources: ScraperSource[] = [
  {
    id: "src-1",
    name: "PRAZ Zimbabwe e-GP Portal",
    portalUrl: "https://egp.praz.org.zw",
    countryCode: "ZW",
    jurisdiction: "Zimbabwe National Public Procurement",
    intervalMinutes: 10,
    lastRun: "2 minutes ago",
    recordsHarvested: 5420,
    status: "Active",
    healthPercentage: 99.9,
  },
  {
    id: "src-2",
    name: "OnlineTenders Zimbabwe",
    portalUrl: "https://www.onlinetenders.co.za/tenders/zimbabwe",
    countryCode: "ZW",
    jurisdiction: "Commercial, Parastatal & UN Notices",
    intervalMinutes: 10,
    lastRun: "3 minutes ago",
    recordsHarvested: 484,
    status: "Active",
    healthPercentage: 99.8,
  },
  {
    id: "src-3",
    name: "ZPPA Zambia e-Procurement Portal",
    portalUrl: "https://eprocure.zppa.org.zm",
    countryCode: "ZM",
    jurisdiction: "Zambia Public Procurement Authority",
    intervalMinutes: 10,
    lastRun: "4 minutes ago",
    recordsHarvested: 3840,
    status: "Active",
    healthPercentage: 99.7,
  },
  {
    id: "src-4",
    name: "World Bank Southern Africa Projects",
    portalUrl: "https://projects.worldbank.org",
    countryCode: "INTL",
    jurisdiction: "World Bank Multilateral Financing",
    intervalMinutes: 10,
    lastRun: "6 minutes ago",
    recordsHarvested: 1120,
    status: "Active",
    healthPercentage: 100,
  },
  {
    id: "src-5",
    name: "UN Global Marketplace (UNGM)",
    portalUrl: "https://www.ungm.org",
    countryCode: "INTL",
    jurisdiction: "United Nations Agencies Procurement",
    intervalMinutes: 10,
    lastRun: "7 minutes ago",
    recordsHarvested: 890,
    status: "Active",
    healthPercentage: 99.4,
  },
  {
    id: "src-6",
    name: "African Development Bank (AfDB)",
    portalUrl: "https://www.afdb.org/en/projects-and-operations/procurement",
    countryCode: "INTL",
    jurisdiction: "ZimFund & Regional Infrastructure",
    intervalMinutes: 10,
    lastRun: "8 minutes ago",
    recordsHarvested: 420,
    status: "Active",
    healthPercentage: 99.5,
  },
  {
    id: "src-7",
    name: "DevelopmentAid Southern Africa",
    portalUrl: "https://www.developmentaid.org",
    countryCode: "INTL",
    jurisdiction: "Donor & Development Sector Notices",
    intervalMinutes: 180,
    lastRun: "3 hours ago",
    recordsHarvested: 570,
    status: "Idle",
    healthPercentage: 100,
  },
];

export default function ExternalSourcesPage() {
  const [currentUser, setCurrentUser] = useState(() => AuthService.getCurrentUser());
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setCurrentUser(AuthService.getCurrentUser());
    window.addEventListener("atcis-auth-changed", sync);
    return () => window.removeEventListener("atcis-auth-changed", sync);
  }, []);

  const visibleSources = useMemo(() => {
    if (!currentUser || currentUser.role === "super_admin" || currentUser.country === "ALL") {
      return scraperSources;
    }
    return scraperSources.filter((s) => s.countryCode === currentUser.country || s.countryCode === "INTL");
  }, [currentUser]);

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      const res = await TenderApiService.triggerScraperSync(10);
      if (res.success) {
        toast.success("Scrape job queued!", {
          description: "The Railway scraper worker will pick up this request and harvest tenders.",
        });
      } else {
        toast.error("Could not trigger sync", { description: res.message });
      }
    } catch (e: any) {
      toast.error("Failed to queue scrape", { description: e.message || "Network error" });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleSyncSingle = async (src: ScraperSource) => {
    setSyncingSourceId(src.id);
    try {
      const res = await TenderApiService.triggerScraperSync(5);
      if (res.success) {
        toast.success(`Sync queued for ${src.name}`, {
          description: "The Railway scraper worker is processing the latest notices.",
        });
      } else {
        toast.error("Could not trigger sync", { description: res.message });
      }
    } catch (e: any) {
      toast.error("Failed to queue scrape", { description: e.message || "Network error" });
    } finally {
      setSyncingSourceId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/50 pb-5 md:flex-row md:items-center">
        <div>
          <h1 className="font-bold text-2xl tracking-tight text-foreground sm:text-3xl">
            External Sources &amp; Scraper Feeds
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Automated background scrapers, API endpoints, and synchronization schedules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSyncAll}
            disabled={isSyncingAll}
            size="sm"
            className="gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={`size-3.5 ${isSyncingAll ? "animate-spin" : ""}`} />
            {isSyncingAll ? "Synchronizing All Portals..." : "Trigger Manual Global Sync"}
          </Button>
        </div>
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Connected Portals
            </span>
            <div className="mt-1 font-bold font-mono text-2xl text-foreground sm:text-3xl">{visibleSources.length} Active</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {currentUser?.country === "ZM" ? "ZPPA, UNGM, World Bank" : currentUser?.country === "ZW" ? "PRAZ, OnlineTenders, UNGM, World Bank" : "PRAZ, ZPPA, UNGM, World Bank"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Harvested Records
            </span>
            <div className="mt-1 font-bold font-mono text-2xl text-foreground sm:text-3xl">12,480</div>
            <p className="mt-1 text-xs text-muted-foreground">Live &amp; historical tender items</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sync Health &amp; Uptime
            </span>
            <div className="mt-1 font-bold font-mono text-2xl text-emerald-600 dark:text-emerald-400 sm:text-3xl">
              99.8%
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Zero scraper schema drift errors</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sync Frequency
            </span>
            <div className="mt-1 font-bold font-mono text-2xl text-foreground sm:text-3xl">5 Mins</div>
            <p className="mt-1 text-xs text-muted-foreground">Hangfire background recurring job</p>
          </CardContent>
        </Card>
      </div>

      {/* Sources Table */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Configured External Portals</CardTitle>
          <CardDescription>
            Monitored tender websites, scraper health, harvesting telemetry, and execution intervals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border/50">
            <Table>
              <TableHeader className="bg-muted/40 text-xs">
                <TableRow>
                  <TableHead>Portal &amp; Source Name</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Last Execution</TableHead>
                  <TableHead className="text-right">Harvested Records</TableHead>
                  <TableHead className="text-center">Uptime</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {visibleSources.map((src) => (
                  <TableRow key={src.id} className="transition-colors hover:bg-muted/30">
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded border border-border bg-muted px-1.5 py-0.2 font-mono text-[10px] font-semibold text-foreground">
                            {src.countryCode}
                          </span>
                          <span className="font-semibold text-foreground">{src.name}</span>
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground">{src.portalUrl}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{src.jurisdiction}</TableCell>
                    <TableCell className="font-mono">{src.intervalMinutes} mins</TableCell>
                    <TableCell className="text-muted-foreground">{src.lastRun}</TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums text-foreground">
                      {src.recordsHarvested.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center font-mono text-emerald-600 dark:text-emerald-400">
                      {src.healthPercentage}%
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={src.status === "Active" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {src.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={syncingSourceId === src.id}
                        onClick={() => handleSyncSingle(src)}
                      >
                        <Play className={`mr-1 size-3 ${syncingSourceId === src.id ? "animate-spin" : ""}`} />
                        {syncingSourceId === src.id ? "Syncing..." : "Sync Now"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
