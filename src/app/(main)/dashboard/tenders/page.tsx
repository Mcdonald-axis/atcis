"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSearchParams } from "next/navigation";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { LogManualTenderDialog } from "@/components/tender/log-manual-tender-dialog";
import { TenderDetailDialog } from "@/components/tender/tender-detail-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isIctHealthFocusTender } from "@/lib/tender-mapping";
import { formatCurrency } from "@/lib/utils";
import { AuthService, type AuthUser } from "@/services/auth-service";
import { TenderApiService } from "@/services/tender-api";

import { type CountryScope, type TenderItem } from "../default/_components/tender-data";

function loadManualTenders(): TenderItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem("custom_logged_tenders") || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is TenderItem =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as TenderItem).id === "string" &&
        typeof (item as TenderItem).refNo === "string",
    );
  } catch {
    return [];
  }
}

function matchesManualTenderFilters(
  tender: TenderItem,
  filters: {
    country: CountryScope;
    query: string;
    category: string;
    status: string;
    portal: string;
    confidence: string;
    focusOnly: boolean;
  },
) {
  if (filters.country !== "ALL" && tender.countryCode !== filters.country && tender.countryCode !== "ALL") {
    return false;
  }

  const query = filters.query.trim().toLowerCase();
  if (
    query &&
    ![tender.refNo, tender.title, tender.procuringEntity, tender.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  ) {
    return false;
  }

  const classification = `${tender.sector || ""} ${tender.category || ""}`.toLowerCase();
  if (filters.category !== "ALL" && !classification.includes(filters.category.toLowerCase())) return false;
  if (filters.status !== "ALL" && tender.status !== filters.status) return false;
  if (filters.portal !== "ALL" && !tender.sourcePortal.toLowerCase().includes(filters.portal.toLowerCase()))
    return false;
  if (filters.confidence === "HIGH" && tender.aiScore < 88) return false;
  if (filters.confidence === "TOP" && tender.aiScore < 92) return false;
  if (filters.focusOnly && !isIctHealthFocusTender(tender)) return false;
  return true;
}

function TendersDirectoryContent() {
  const searchParams = useSearchParams();
  const portalParam = searchParams.get("portal");
  const countryParam = searchParams.get("country");
  const sectorParam = searchParams.get("sector");
  const searchParam = searchParams.get("q") || searchParams.get("search");

  // The server and first browser render must use the same defaults. Browser
  // storage is restored by syncUserScope after hydration.
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [scopeReady, setScopeReady] = useState(false);
  const isCountryBound =
    currentUser && currentUser.role !== "super_admin" && currentUser.country && currentUser.country !== "ALL";
  const userCountryScope: CountryScope = isCountryBound ? (currentUser.country as CountryScope) : "ALL";

  const [tendersList, setTendersList] = useState<TenderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [countryFilter, setCountryFilter] = useState<CountryScope>("ALL");
  const [userJurisdiction, setUserJurisdiction] = useState<CountryScope>("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [portalFilter, setPortalFilter] = useState("ALL");
  const [aiConfidenceFilter, setAiConfidenceFilter] = useState("ALL");
  const [focusModeOnly, setFocusModeOnly] = useState(false);
  const [selectedTender, setSelectedTender] = useState<TenderItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  const [sortOrder, setSortOrder] = useState<"PRIORITY" | "CLOSING_SOON" | "NEWEST" | "HIGHEST_SCORE" | "PORTAL_ORDER">(
    "PRIORITY",
  );

  // Effective country strictly locked for Country-bound personnel (Country Admin, AM, HOD)
  const effectiveCountry: CountryScope = isCountryBound ? userCountryScope : countryFilter;

  // Dynamic portal options strictly constrained by effective user country scope
  const availablePortals = useMemo(() => {
    if (effectiveCountry === "ZM") {
      return [
        { value: "ALL", label: "All Portals (Zambia & Multilateral)" },
        { value: "ZPPA", label: "ZPPA e-Procurement (Zambia)" },
        { value: "GoZambiaJobs", label: "GoZambiaJobs Portal" },
        { value: "World Bank", label: "World Bank Southern Africa" },
        { value: "UNGM", label: "UN Global Marketplace (UNGM)" },
        { value: "AfDB", label: "African Development Bank (AfDB)" },
      ];
    }

    if (effectiveCountry === "ZW") {
      return [
        { value: "ALL", label: "All Portals (Zimbabwe & Multilateral)" },
        { value: "PRAZ", label: "PRAZ e-GP (Zimbabwe)" },
        { value: "OnlineTenders", label: "OnlineTenders Zimbabwe" },
        { value: "World Bank", label: "World Bank Southern Africa" },
        { value: "UNGM", label: "UN Global Marketplace (UNGM)" },
        { value: "AfDB", label: "African Development Bank (AfDB)" },
      ];
    }

    // ALL (Super Admin or combined view)
    return [
      { value: "ALL", label: "All Portals" },
      { value: "PRAZ", label: "PRAZ e-GP (Zimbabwe)" },
      { value: "OnlineTenders", label: "OnlineTenders Zimbabwe" },
      { value: "ZPPA", label: "ZPPA e-Procurement (Zambia)" },
      { value: "GoZambiaJobs", label: "GoZambiaJobs Portal" },
      { value: "World Bank", label: "World Bank Southern Africa" },
      { value: "UNGM", label: "UN Global Marketplace (UNGM)" },
      { value: "AfDB", label: "African Development Bank (AfDB)" },
    ];
  }, [effectiveCountry]);

  // If the currently selected portal is invalid for the user's country, auto-reset to ALL
  useEffect(() => {
    if (portalFilter !== "ALL" && !availablePortals.some((p) => p.value === portalFilter)) {
      setPortalFilter("ALL");
    }
  }, [availablePortals, portalFilter]);

  // Reset page to 1 when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    countryFilter,
    categoryFilter,
    statusFilter,
    portalFilter,
    aiConfidenceFilter,
    focusModeOnly,
    sortOrder,
  ]);

  // Initialize and synchronize preference from user profile
  useEffect(() => {
    const syncUserScope = () => {
      const user = AuthService.getCurrentUser();
      setCurrentUser(user);
      const boundCountry =
        user?.role !== "super_admin" && (user?.country === "ZW" || user?.country === "ZM") ? user.country : null;
      setUserJurisdiction(boundCountry ?? "ALL");
      let preferredCountry: CountryScope = "ALL";
      try {
        const pref = localStorage.getItem("user_country_preference");
        if (pref === "ZW" || pref === "ZM" || pref === "ALL") preferredCountry = pref;
      } catch {
        // Storage can be unavailable; the profile and URL still determine scope.
      }
      const requestedCountry =
        countryParam === "ZW" || countryParam === "ZM" || countryParam === "ALL" ? countryParam : preferredCountry;
      setCountryFilter(boundCountry ?? requestedCountry);
      setScopeReady(true);
    };

    syncUserScope();
    window.addEventListener("atcis-auth-changed", syncUserScope);
    return () => window.removeEventListener("atcis-auth-changed", syncUserScope);
  }, [countryParam]);

  // Sync state with URL search parameters
  useEffect(() => {
    if (portalParam) {
      const p = portalParam.toLowerCase();
      if (p.includes("praz")) setPortalFilter("PRAZ");
      else if (p.includes("online")) setPortalFilter("OnlineTenders");
      else if (p.includes("zppa")) setPortalFilter("ZPPA");
      else if (p.includes("world")) setPortalFilter("World Bank");
      else if (p.includes("ungm") || p.includes("un")) setPortalFilter("UNGM");
      else if (p.includes("afdb")) setPortalFilter("AfDB");
      else if (p.includes("gozambia")) setPortalFilter("GoZambiaJobs");
      else setPortalFilter(portalParam);
    }

    if (sectorParam) {
      setCategoryFilter(sectorParam);
    }

    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, [portalParam, sectorParam, searchParam]);

  const fetchTenders = useCallback(
    async (showFullLoader = true) => {
      if (!scopeReady) return;
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      if (showFullLoader) setLoading(true);
      setIsSyncing(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams({
          country: effectiveCountry,
          page: String(currentPage),
          pageSize: String(pageSize),
          q: debouncedSearch,
          category: categoryFilter,
          status: statusFilter,
          portal: portalFilter,
          confidence: aiConfidenceFilter,
          focus: String(focusModeOnly),
          sort: sortOrder,
        });
        const result = await TenderApiService.getTenderPage(params, controller.signal);
        if (controller.signal.aborted) return;
        const manualTenders = loadManualTenders().filter((tender) =>
          matchesManualTenderFilters(tender, {
            country: effectiveCountry,
            query: debouncedSearch,
            category: categoryFilter,
            status: statusFilter,
            portal: portalFilter,
            confidence: aiConfidenceFilter,
            focusOnly: focusModeOnly,
          }),
        );
        const visibleManualTenders = currentPage === 1 ? manualTenders : [];
        const manualIds = new Set(visibleManualTenders.map((tender) => tender.id));
        setTendersList([...visibleManualTenders, ...result.data.filter((tender) => !manualIds.has(tender.id))]);
        setTotalItems(result.total + manualTenders.length);
        setCurrentPage(result.page);
        setLastSyncTime(result.updatedAt ? new Date(result.updatedAt) : null);
      } catch (error) {
        if (!controller.signal.aborted) {
          if (showFullLoader) {
            setLoadError(error instanceof Error ? error.message : "Could not load saved tenders.");
            setTendersList([]);
            setTotalItems(0);
          } else {
            toast.error("Could not refresh the catalogue. Showing the previously loaded tenders.");
          }
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setIsSyncing(false);
        }
      }
    },
    [
      scopeReady,
      effectiveCountry,
      currentPage,
      pageSize,
      debouncedSearch,
      categoryFilter,
      statusFilter,
      portalFilter,
      aiConfidenceFilter,
      focusModeOnly,
      sortOrder,
    ],
  );

  useEffect(() => {
    if (!scopeReady) return;
    void fetchTenders(true);
    const interval = setInterval(() => {
      void fetchTenders(false);
    }, 60_000);
    return () => {
      clearInterval(interval);
      requestRef.current?.abort();
    };
  }, [fetchTenders, scopeReady]);

  const handleOpenDetails = (tender: TenderItem) => {
    setSelectedTender(tender);
    setIsDialogOpen(true);
  };

  const handleResetFilters = () => {
    setPortalFilter("ALL");
    setCountryFilter(isCountryBound ? userCountryScope : "ALL");
    setCategoryFilter("ALL");
    setStatusFilter("ALL");
    setSearchTerm("");
    setAiConfidenceFilter("ALL");
    setFocusModeOnly(false);
    setSortOrder("PRIORITY");
  };

  // Filter tenders strictly by country scope to guarantee no leak (multilateral notices marked ALL are accessible to both countries)
  const filtered = useMemo(() => {
    if (effectiveCountry === "ALL") return tendersList;
    return tendersList.filter((t) => t.countryCode === effectiveCountry || t.countryCode === "ALL");
  }, [tendersList, effectiveCountry]);

  // Top evidence-ranked recommendations for ICT, Software & Healthcare Focus
  const aiSuggestions = useMemo(() => {
    return filtered
      .filter(
        (t) =>
          isIctHealthFocusTender(t) &&
          t.aiScore >= 88 &&
          (effectiveCountry === "ALL" || t.countryCode === effectiveCountry || t.countryCode === "ALL"),
      )
      .slice(0, 3);
  }, [filtered, effectiveCountry]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + filtered.length, totalItems);
  const paginatedTenders = filtered;

  const getPortalBadgeStyle = (portal?: string) => {
    const p = (portal || "").toLowerCase();
    if (p.includes("online")) {
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30";
    }
    if (p.includes("world bank") || p.includes("worldbank")) {
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    }
    if (p.includes("ungm") || p.includes("un ") || p.includes("united nations")) {
      return "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30";
    }
    if (p.includes("afdb") || p.includes("african development")) {
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    }
    if (p.includes("zppa")) {
      return "bg-lime-500/15 text-lime-700 dark:text-lime-300 border-lime-500/30";
    }
    return "bg-primary/10 text-primary border-primary/25";
  };

  const getSectorBadgeStyle = (sector?: string) => {
    switch (sector) {
      case "Healthcare & Medical":
        return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
      case "Electrical & Energy":
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "Civil & Infrastructure":
        return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "ICT & Software":
        return "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30";
      case "General Goods & Consumables":
        return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "Services & Logistics":
        return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30";
      default:
        return "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30";
    }
  };

  const hasActiveFilters =
    portalFilter !== "ALL" ||
    focusModeOnly ||
    categoryFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    aiConfidenceFilter !== "ALL" ||
    (userJurisdiction === "ALL" && countryFilter !== "ALL") ||
    searchTerm.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/50 pb-5 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-bold text-2xl tracking-tight text-foreground sm:text-3xl">
              Tender Log & All Opportunities
            </h1>
            <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary">
              Evidence-Based Suggestions
            </span>
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm mt-0.5">
            Real-time public procurement repository with evidence-based sector matching for your core business profile
            in <strong className="text-foreground">ICT, Software, and Healthcare & Medical</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Automated 10-Minute Live Pulse Indicator */}
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
            </span>
            <span>Saved catalogue · checks every minute</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground font-normal">
              Last source update {lastSyncTime?.toLocaleString() || "—"}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchTenders(false);
              toast.info("Loading the latest saved catalogue; source updates run in the background.");
            }}
            disabled={isSyncing}
            className="gap-1.5 text-xs h-8"
          >
            <RefreshCw className={`size-3.5 ${isSyncing ? "animate-spin text-primary" : ""}`} />
            <span>{isSyncing ? "Checking..." : "Check Now"}</span>
          </Button>

          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Download className="size-3.5" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => setIsManualDialogOpen(true)} className="gap-1.5 text-xs h-8">
            <Plus className="size-3.5" /> Log Manual Tender
          </Button>
        </div>
      </div>

      {/* Featured strategic suggestions feed */}
      {aiSuggestions.length > 0 && (
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">Recommended Opportunities for Your Core Focus</span>
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                ICT • Software • Healthcare Focus
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              Ranked by title, scope and category evidence
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {aiSuggestions.map((item) => (
              <div
                key={`suggest-${item.id}`}
                onClick={() => handleOpenDetails(item)}
                className="group cursor-pointer rounded-lg border border-border/80 bg-background p-3 space-y-2 shadow-2xs hover:border-primary/50 hover:shadow-xs transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground">
                    {item.countryCode}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    {item.aiScore}% Focus Fit
                  </span>
                </div>

                <div>
                  <h4 className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-muted-foreground truncate">{item.procuringEntity}</p>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40 font-mono">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold border ${getSectorBadgeStyle(item.sector)}`}
                  >
                    {item.sector}
                  </span>
                  <span className="font-bold text-foreground">
                    {formatCurrency(item.estimatedValue, { noDecimals: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Filter & Table Card */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="space-y-4">
          {/* Top Row: Title, Subtitle, and Quick Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                <span>Tender Directory</span>
                <Badge variant="secondary" className="font-mono text-xs font-medium bg-muted/80 text-foreground">
                  {totalItems.toLocaleString()} notices matched
                </Badge>
                {userJurisdiction !== "ALL" && (
                  <Badge
                    variant="outline"
                    className="font-mono text-[11px] font-semibold text-primary border-primary/30 bg-primary/5"
                  >
                    {userJurisdiction === "ZW" ? "Zimbabwe (ZW)" : "Zambia (ZM)"}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-0.5">
                Procurement directory with evidence-based sector classification and real-time portal synchronization.
              </CardDescription>
            </div>

            {/* Quick Action Toggle & Reset */}
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <Button
                variant={focusModeOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setFocusModeOnly(!focusModeOnly)}
                className={`h-8 gap-1.5 text-xs font-semibold transition-all ${
                  focusModeOnly
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border-border/80 hover:border-primary/40 hover:bg-muted/40"
                }`}
              >
                <Sparkles className="size-3.5" />
                <span>ICT & Health Focus</span>
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2.5"
                >
                  <X className="size-3.5" />
                  <span>Reset</span>
                </Button>
              )}
            </div>
          </div>

          {/* Dedicated Full-Width Filter Toolbar */}
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2.5">
            {/* Primary Row: Wide Search Input + Market Scope + Sort */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by tender title, procuring entity, reference no..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8.5 w-full pl-8 pr-8 text-xs bg-background shadow-2xs border-border/70"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Country Market Filter (Super Admin / Global view) */}
              {userJurisdiction === "ALL" && (
                <select
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value as CountryScope)}
                  className="h-8.5 rounded-md border border-border/70 bg-background px-2.5 font-medium text-xs text-foreground shadow-2xs focus:outline-hidden cursor-pointer shrink-0"
                >
                  <option value="ALL">All Markets</option>
                  <option value="ZW">Zimbabwe (ZW)</option>
                  <option value="ZM">Zambia (ZM)</option>
                </select>
              )}

              {/* Sort Order Selector */}
              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="h-8.5 rounded-md border border-border/70 bg-background px-2.5 font-medium text-xs text-foreground shadow-2xs focus:outline-hidden cursor-pointer"
                >
                  <option value="PRIORITY">Sort: Active & National First</option>
                  <option value="CLOSING_SOON">Sort: Closing Soonest</option>
                  <option value="NEWEST">Sort: Newest Published</option>
                  <option value="HIGHEST_SCORE">Sort: Highest Focus Fit</option>
                  <option value="PORTAL_ORDER">Sort: Portal Listing Order</option>
                </select>
              </div>
            </div>

            {/* Secondary Row: Categorical Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40 text-xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:inline mr-1">
                Filter:
              </span>

              {/* Source Portal Filter */}
              <select
                value={portalFilter}
                onChange={(e) => setPortalFilter(e.target.value)}
                className={`h-8 rounded-md border px-2.5 font-medium text-xs shadow-2xs focus:outline-hidden cursor-pointer ${
                  portalFilter !== "ALL"
                    ? "border-primary/50 bg-primary/10 text-primary font-semibold"
                    : "border-border/70 bg-background text-foreground"
                }`}
              >
                {availablePortals.map((portal) => (
                  <option key={portal.value} value={portal.value}>
                    {portal.label}
                  </option>
                ))}
              </select>

              {/* Category / Sector Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={`h-8 rounded-md border px-2.5 font-medium text-xs shadow-2xs focus:outline-hidden cursor-pointer ${
                  categoryFilter !== "ALL"
                    ? "border-primary/50 bg-primary/10 text-primary font-semibold"
                    : "border-border/70 bg-background text-foreground"
                }`}
              >
                <option value="ALL">All Sectors</option>
                <option value="Healthcare">Healthcare & Medical</option>
                <option value="Electrical">Electrical & Energy</option>
                <option value="Civil">Civil & Infrastructure</option>
                <option value="ICT">ICT & Software</option>
                <option value="General Goods">General Goods</option>
                <option value="Services">Services & Logistics</option>
              </select>

              {/* Focus Fit Filter */}
              <select
                value={aiConfidenceFilter}
                onChange={(e) => setAiConfidenceFilter(e.target.value)}
                className={`h-8 rounded-md border px-2.5 font-medium text-xs shadow-2xs focus:outline-hidden cursor-pointer ${
                  aiConfidenceFilter !== "ALL"
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                    : "border-border/70 bg-background text-foreground"
                }`}
              >
                <option value="ALL">All Focus Scores</option>
                <option value="HIGH">High Fit (88%+)</option>
                <option value="TOP">Top Focus Fit (92%+)</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`h-8 rounded-md border px-2.5 font-medium text-xs shadow-2xs focus:outline-hidden cursor-pointer ${
                  statusFilter !== "ALL"
                    ? "border-primary/50 bg-primary/10 text-primary font-semibold"
                    : "border-border/70 bg-background text-foreground"
                }`}
              >
                <option value="ALL">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Closing Soon">Closing Soon</option>
                <option value="Under Evaluation">Under Evaluation</option>
              </select>
            </div>
          </div>

          {/* Active Filter Chips & Clear All */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap text-xs pt-2 border-t border-border/40">
              <span className="text-muted-foreground font-medium text-[11px]">Filtered By:</span>

              {portalFilter !== "ALL" && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-[11px] font-mono py-0.5 bg-primary/10 text-primary border-primary/30"
                >
                  <span>Portal: {portalFilter}</span>
                  <button
                    type="button"
                    onClick={() => setPortalFilter("ALL")}
                    className="hover:text-foreground font-bold ml-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                </Badge>
              )}

              {focusModeOnly && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-[11px] font-mono py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
                >
                  <span>Focus: ICT & Healthcare</span>
                  <button
                    type="button"
                    onClick={() => setFocusModeOnly(false)}
                    className="hover:text-foreground font-bold ml-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                </Badge>
              )}

              {categoryFilter !== "ALL" && (
                <Badge variant="secondary" className="gap-1 text-[11px] font-mono py-0.5">
                  <span>Sector: {categoryFilter}</span>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter("ALL")}
                    className="hover:text-foreground font-bold ml-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                </Badge>
              )}

              {countryFilter !== "ALL" && userJurisdiction === "ALL" && (
                <Badge variant="secondary" className="gap-1 text-[11px] font-mono py-0.5">
                  <span>Country: {countryFilter}</span>
                  <button
                    type="button"
                    onClick={() => setCountryFilter("ALL")}
                    className="hover:text-foreground font-bold ml-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                </Badge>
              )}

              {statusFilter !== "ALL" && (
                <Badge variant="secondary" className="gap-1 text-[11px] font-mono py-0.5">
                  <span>Status: {statusFilter}</span>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("ALL")}
                    className="hover:text-foreground font-bold ml-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                </Badge>
              )}

              {aiConfidenceFilter !== "ALL" && (
                <Badge variant="secondary" className="gap-1 text-[11px] font-mono py-0.5">
                  <span>Focus Score: {aiConfidenceFilter}</span>
                  <button
                    type="button"
                    onClick={() => setAiConfidenceFilter("ALL")}
                    className="hover:text-foreground font-bold ml-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                </Badge>
              )}

              {searchTerm.trim().length > 0 && (
                <Badge variant="secondary" className="gap-1 text-[11px] font-mono py-0.5">
                  <span>Search: &ldquo;{searchTerm}&rdquo;</span>
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="hover:text-foreground font-bold ml-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                </Badge>
              )}

              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[11px] text-muted-foreground hover:text-primary underline ml-1 font-medium cursor-pointer"
              >
                Reset all filters
              </button>
            </div>
          )}
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border/50">
            <Table>
              <TableHeader className="bg-muted/40 text-xs">
                <TableRow>
                  <TableHead className="w-[160px] whitespace-nowrap">Reference No.</TableHead>
                  <TableHead className="min-w-[280px]">Tender Title & Sector</TableHead>
                  <TableHead className="min-w-[200px]">Procuring Entity & Source Portal</TableHead>
                  <TableHead className="text-right whitespace-nowrap min-w-[120px]">Est. Budget</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[120px]">Closing Date</TableHead>
                  <TableHead className="text-center whitespace-nowrap min-w-[95px]">Focus Fit</TableHead>
                  <TableHead className="text-center whitespace-nowrap min-w-[100px]">Status</TableHead>
                  <TableHead className="text-right whitespace-nowrap min-w-[90px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="size-5 animate-spin text-primary" />
                        <span>Loading saved tenders...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : loadError ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center">
                      <p role="alert">{loadError}</p>
                      <Button variant="outline" size="sm" onClick={() => fetchTenders(true)}>
                        Retry
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="size-8 text-muted-foreground/50" />
                        <p className="font-semibold text-foreground">No tenders match your current search criteria.</p>
                        <p className="text-xs max-w-sm text-muted-foreground">
                          Try adjusting or resetting your portal, country, or category filters to see more tenders.
                        </p>
                        {hasActiveFilters && (
                          <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-2 text-xs">
                            Reset All Filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTenders.map((t) => (
                    <TableRow
                      key={t.id}
                      onClick={() => handleOpenDetails(t)}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <TableCell className="font-mono font-medium text-foreground whitespace-nowrap align-middle">
                        {t.refNo}
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground line-clamp-1">{t.title}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {t.sector && (
                              <span
                                className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-bold border ${getSectorBadgeStyle(
                                  t.sector,
                                )}`}
                              >
                                {t.sector}
                              </span>
                            )}
                            <span className="inline-block rounded border border-border/50 bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground line-clamp-1">
                              {t.category}
                            </span>
                            <span
                              className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-medium ${
                                t.needsClassificationReview
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                  : t.classificationSource === "ai"
                                    ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
                                    : "border-border/60 bg-background text-muted-foreground"
                              }`}
                              title={[t.classificationReason, ...(t.classificationEvidence || [])]
                                .filter(Boolean)
                                .join(" Evidence: ")}
                            >
                              {t.needsClassificationReview
                                ? "Needs AI review"
                                : t.classificationSource === "ai"
                                  ? `AI verified ${t.classificationConfidence}%`
                                  : `Rules verified ${t.classificationConfidence ?? 0}%`}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="space-y-1">
                          <span className="font-medium text-foreground line-clamp-1">{t.procuringEntity}</span>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="rounded border border-border bg-muted/60 px-1 py-0.2 font-mono text-[9px] font-semibold text-foreground">
                              {t.countryCode}
                            </span>
                            {t.portalUrl ? (
                              <a
                                href={t.portalUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold border transition-opacity hover:opacity-80 ${getPortalBadgeStyle(
                                  t.sourcePortal,
                                )}`}
                                title={`Open tender notice on ${t.sourcePortal}`}
                              >
                                <span>{t.sourcePortal}</span>
                                <ExternalLink className="size-2.5 opacity-80" />
                              </a>
                            ) : (
                              <span
                                className={`inline-block rounded px-1.5 py-0.5 font-mono text-[9px] font-bold border ${getPortalBadgeStyle(
                                  t.sourcePortal,
                                )}`}
                              >
                                {t.sourcePortal}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold tabular-nums text-foreground whitespace-nowrap align-middle">
                        {formatCurrency(t.estimatedValue, { noDecimals: true })}
                      </TableCell>
                      <TableCell className="whitespace-nowrap align-middle">
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">{t.closingDate}</p>
                          <p
                            className={`font-mono text-[10px] font-medium ${
                              t.daysRemaining <= 5 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                            }`}
                          >
                            {t.daysRemaining} days left
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap align-middle">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${
                            t.aiScore >= 85
                              ? "border-emerald-500/30 bg-emerald-500/10 font-bold text-emerald-600 dark:text-emerald-400"
                              : t.aiScore >= 50
                                ? "border-amber-500/30 bg-amber-500/10 font-semibold text-amber-600 dark:text-amber-400"
                                : "border-zinc-500/20 bg-zinc-500/10 font-medium text-zinc-500 dark:text-zinc-400"
                          }`}
                        >
                          {t.aiScore}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap align-middle">
                        <Badge
                          variant={
                            t.status === "Closing Soon" ? "destructive" : t.status === "Open" ? "default" : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap align-middle">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetails(t);
                          }}
                          className="h-7 px-2 text-xs"
                        >
                          Details <ExternalLink className="ml-1 size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/40 text-xs">
              <div className="flex items-center gap-3 text-muted-foreground">
                <span>
                  Showing <strong className="font-semibold text-foreground">{startIndex + 1}</strong> to{" "}
                  <strong className="font-semibold text-foreground">{endIndex}</strong> of{" "}
                  <strong className="font-semibold text-foreground">{totalItems}</strong> tenders
                </span>
                <div className="flex items-center gap-1.5 pl-2 border-l border-border/50">
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-7 rounded border border-border/70 bg-background px-1.5 font-medium text-xs text-foreground shadow-xs focus:outline-hidden"
                  >
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage <= 1}
                  className="h-7 w-7 p-0"
                  title="First Page"
                >
                  <ChevronsLeft className="size-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="h-7 px-2 text-xs"
                >
                  <ChevronLeft className="size-3.5 mr-1" /> Prev
                </Button>

                <div className="flex items-center px-2.5 font-mono text-xs">
                  <span>
                    Page <strong className="text-foreground">{safeCurrentPage}</strong> of{" "}
                    <strong className="text-foreground">{totalPages}</strong>
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="h-7 px-2 text-xs"
                >
                  Next <ChevronRight className="size-3.5 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage >= totalPages}
                  className="h-7 w-7 p-0"
                  title="Last Page"
                >
                  <ChevronsRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
          <TenderDetailDialog tender={selectedTender} open={isDialogOpen} onOpenChange={setIsDialogOpen} />

          {/* Log Manual Tender Modal */}
          <LogManualTenderDialog
            open={isManualDialogOpen}
            onOpenChange={setIsManualDialogOpen}
            onTenderCreated={() => {
              void fetchTenders(false);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function AllTendersPage() {
  return (
    <Suspense
      fallback={<div className="py-12 text-center text-xs text-muted-foreground">Loading tender directory...</div>}
    >
      <TendersDirectoryContent />
    </Suspense>
  );
}
