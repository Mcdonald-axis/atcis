"use client";

import { useEffect, useMemo, useState } from "react";

import { Briefcase, FileSpreadsheet, Layers } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AuthService, type AuthUser } from "@/services/auth-service";

import { PriorityTendersCard } from "./_components/priority-tenders-card";
import { ProcurementPlansView } from "./_components/procurement-plans-view";
import { RecentTendersTable } from "./_components/recent-tenders-table";
import { SectorBreakdown } from "./_components/sector-breakdown";
import type { CountryScope, SectorItem } from "./_components/tender-data";
import { TenderKpis } from "./_components/tender-kpis";
import { TenderTrendsChart } from "./_components/tender-trends-chart";
import { useDashboardPipeline } from "./_components/use-dashboard-pipeline";

export default function Page() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [countryScope, setCountryScope] = useState<CountryScope>("ALL");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const syncUserScope = () => {
      const user = AuthService.getCurrentUser();
      setCurrentUser(user);
      const isSuper = user?.role === "super_admin";
      setIsSuperAdmin(isSuper);

      if (user?.role === "country_admin") {
        const enforced = (user.country === "ZM" ? "ZM" : "ZW") as CountryScope;
        setCountryScope(enforced);
        try {
          localStorage.setItem("user_country_preference", enforced);
        } catch {
          // Continue with the in-memory scope when browser storage is unavailable.
        }
        return;
      }

      if (!isSuper && user?.country && user.country !== "ALL") {
        const userScope = user.country as CountryScope;
        setCountryScope(userScope);
        try {
          localStorage.setItem("user_country_preference", userScope);
        } catch {
          // Continue with the in-memory scope when browser storage is unavailable.
        }
      } else {
        try {
          const pref = localStorage.getItem("user_country_preference");
          if (pref === "ZW" || pref === "ZM" || pref === "ALL") {
            setCountryScope(pref);
          } else {
            setCountryScope("ALL");
          }
        } catch {
          setCountryScope("ALL");
        }
      }
    };

    syncUserScope();
    window.addEventListener("atcis-auth-changed", syncUserScope);
    return () => window.removeEventListener("atcis-auth-changed", syncUserScope);
  }, []);

  const handleSetCountry = (scope: CountryScope) => {
    const user = AuthService.getCurrentUser();
    if (user && user.role !== "super_admin") return;
    setCountryScope(scope);
    try {
      localStorage.setItem("user_country_preference", scope);
      window.dispatchEvent(new CustomEvent("country-filter-changed", { detail: scope }));
    } catch {
      // The local state still updates when browser storage or custom events are unavailable.
    }
  };

  useEffect(() => {
    const handleFilterChanged = (event: Event) => {
      const user = AuthService.getCurrentUser();
      if (user && user.role !== "super_admin") return;
      const scope = (event as CustomEvent<CountryScope>).detail;
      if (scope === "ZW" || scope === "ZM" || scope === "ALL") {
        setCountryScope(scope);
      }
    };
    window.addEventListener("country-filter-changed", handleFilterChanged);
    return () => window.removeEventListener("country-filter-changed", handleFilterChanged);
  }, []);

  const pipeline = useDashboardPipeline(countryScope);
  const sectors = useMemo(() => {
    const groups = new Map<string, { count: number; value: number }>();
    for (const task of Object.values(pipeline.board).flat()) {
      const name = task.team || "Uncategorized";
      const group = groups.get(name) || { count: 0, value: 0 };
      group.count++;
      group.value += task.estimatedValue || 0;
      groups.set(name, group);
    }
    const total = [...groups.values()].reduce((sum, group) => sum + group.value, 0);
    return [...groups].map(
      ([name, group]): SectorItem => ({
        id: name,
        name,
        tendersCount: group.count,
        value: group.value,
        percentage: total ? (group.value / total) * 100 : 0,
        iconName: "Building2",
      }),
    );
  }, [pipeline.board]);

  const countryLabel = { ALL: "All Regions", ZW: "Zimbabwe", ZM: "Zambia" }[countryScope];
  let portalDescription = "Your tender pipeline, bids and contract outcomes.";
  if (pipeline.isHodOrAdmin) portalDescription = "Country and team pipeline oversight.";
  if (currentUser?.role === "country_admin") {
    portalDescription = `${countryLabel} operations and team pipeline oversight.`;
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/50 pb-4 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-col items-start gap-2 min-[420px]:flex-row min-[420px]:items-center">
            <h1 className="font-bold text-xl leading-tight tracking-tight text-foreground sm:text-3xl">
              Tender Intelligence Portal
            </h1>
            <Badge variant="outline" className="shrink-0 border-primary/20 bg-primary/10 font-mono text-primary">
              Enterprise v6.2
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm">{portalDescription}</p>
        </div>

        {/* Synchronized Country Scope Switcher */}
        {isSuperAdmin ? (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={countryScope}
            onValueChange={(value) => {
              if (value === "ALL" || value === "ZW" || value === "ZM") handleSetCountry(value);
            }}
            aria-label="Country scope"
            className="grid w-full grid-cols-3 self-start sm:w-fit md:self-auto"
          >
            <ToggleGroupItem value="ALL" aria-label="Show all regions" className="min-w-0 px-2 text-xs">
              All Regions
            </ToggleGroupItem>
            <ToggleGroupItem value="ZW" aria-label="Show Zimbabwe" className="min-w-0 px-2 text-xs">
              Zimbabwe
            </ToggleGroupItem>
            <ToggleGroupItem value="ZM" aria-label="Show Zambia" className="min-w-0 px-2 text-xs">
              Zambia
            </ToggleGroupItem>
          </ToggleGroup>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground self-start md:self-auto">
            <span className="font-mono text-[10px] uppercase text-primary font-bold px-1.5 py-0.5 rounded bg-primary/10 border border-primary/25">
              {countryScope}
            </span>
            <span className="font-semibold">{countryLabel}</span>
          </div>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs className="gap-4" defaultValue="overview">
        <TabsList className="grid h-auto w-full grid-cols-3 bg-muted/60 p-1 sm:flex sm:w-fit">
          <TabsTrigger value="overview" className="min-w-0 gap-1 text-[11px] sm:gap-1.5 sm:text-xs">
            <Layers data-icon="inline-start" />
            <span className="sm:hidden">Pipeline</span>
            <span className="hidden sm:inline">Pipeline Overview</span>
          </TabsTrigger>
          <TabsTrigger value="active-tenders" className="min-w-0 gap-1 text-[11px] sm:gap-1.5 sm:text-xs">
            <Briefcase data-icon="inline-start" />
            <span className="sm:hidden">Tenders</span>
            <span className="hidden sm:inline">Public Tenders</span>
          </TabsTrigger>
          <TabsTrigger value="procurement-plans" className="min-w-0 gap-1 text-[11px] sm:gap-1.5 sm:text-xs">
            <FileSpreadsheet data-icon="inline-start" />
            <span className="sm:hidden">Plans</span>
            <span className="hidden sm:inline">Public Procurement Plans</span>
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="flex min-w-0 flex-col gap-5">
          {/* Top 4 KPI Cards */}
          <TenderKpis pipeline={pipeline} countryScope={countryScope} />
          {(pipeline.error || pipeline.refreshError) && (
            <Alert variant="destructive">
              <AlertTitle>{pipeline.error ? "Pipeline unavailable" : "Could not refresh pipeline"}</AlertTitle>
              <AlertDescription>
                {pipeline.error || "Showing your last loaded figures. Retry to check for updates."}
              </AlertDescription>
              <Button variant="outline" size="sm" onClick={pipeline.retry}>
                Retry
              </Button>
            </Alert>
          )}

          {/* Main 2-Column Grid */}
          {!pipeline.loading && !pipeline.error && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(330px,1fr)]">
              <div className="flex flex-col gap-5">
                <TenderTrendsChart board={pipeline.board} />
                <SectorBreakdown sectors={sectors} />
              </div>
              <PriorityTendersCard board={pipeline.board} />
            </div>
          )}
        </TabsContent>

        {/* ACTIVE TENDERS TAB - Full Width Priority Opportunities */}
        <TabsContent value="active-tenders" className="flex min-w-0 flex-col gap-5">
          <RecentTendersTable countryScope={countryScope} />
        </TabsContent>

        {/* PROCUREMENT PLANS TAB - Showing ONLY Procurement Plans */}
        <TabsContent value="procurement-plans" className="flex min-w-0 flex-col gap-5">
          <ProcurementPlansView countryScope={countryScope} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
