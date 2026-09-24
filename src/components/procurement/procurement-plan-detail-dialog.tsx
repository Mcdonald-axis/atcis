"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpDown,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Layers,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Printer,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copyTextToClipboard, formatCurrency } from "@/lib/utils";
import type {
  AdvanceProcurementPlan,
  ProcurementPlanLineItem,
} from "@/app/(main)/dashboard/default/_components/tender-data";
import { TenderApiService } from "@/services/tender-api";

interface ProcurementPlanDetailDialogProps {
  plan: AdvanceProcurementPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseDateFlexible(dateStr?: string): Date | null {
  if (!dateStr || dateStr === "Not Applicable" || dateStr.trim() === "") return null;
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;

  const parts = dateStr.split(/[-/\s]/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const months: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    const monthStr = parts[1].toLowerCase().slice(0, 3);
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && months[monthStr] !== undefined && !isNaN(year)) {
      return new Date(year, months[monthStr], day);
    }
  }
  return null;
}

function calculateCycleDays(item: ProcurementPlanLineItem): string {
  if (item.cycleDays && item.cycleDays !== "-" && item.cycleDays !== "0" && item.cycleDays.trim() !== "") {
    return item.cycleDays.replace(/\s*d(ays)?/i, "").trim();
  }

  const pubDate = parseDateFlexible(item.tenderPublicationDate || item.eoiPublicationDate);
  const closeDate = parseDateFlexible(
    item.contractSigningDate || item.bidClosingDate || item.awardNoticeDate || item.eoiClosingDate,
  );

  if (pubDate && closeDate) {
    const diffMs = closeDate.getTime() - pubDate.getTime();
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (days > 0 && days <= 365) return `${days}`;
  }

  // Statutory PRAZ Procurement Cycle Standards by method
  const method = (item.procurementMethod || "").toLowerCase();
  if (method.includes("quotation") || method.includes("rfq")) return "30";
  if (method.includes("competitive") || method.includes("open") || method.includes("bidding")) return "45";
  if (method.includes("direct") || method.includes("single")) return "14";
  if (method.includes("framework")) return "60";
  if (method.includes("proposal") || method.includes("rfp")) return "45";

  return "30";
}

export function ProcurementPlanDetailDialog({ plan, open, onOpenChange }: ProcurementPlanDetailDialogProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [activeTab, setActiveTab] = useState("schedule");
  const [lineItems, setLineItems] = useState<ProcurementPlanLineItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [trackedItemIds, setTrackedItemIds] = useState<Record<string, boolean>>({});
  const [selectedItemKeys, setSelectedItemKeys] = useState<Set<string>>(new Set());
  const [viewLayout, setViewLayout] = useState<"compact" | "wide">("compact");

  const scrollTable = (direction: "left" | "right") => {
    const el = document.getElementById("procurement-schedule-scroll-container");
    if (el) {
      const amount = direction === "left" ? -450 : 450;
      el.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function loadLiveDetail() {
      if (!plan?.portalUrl) {
        setLineItems([]);
        return;
      }
      setIsLoadingItems(true);
      try {
        const detail = await TenderApiService.getProcurementPlanDetail(plan.portalUrl);
        if (isMounted && detail?.items && detail.items.length > 0) {
          setLineItems(detail.items);
          setActiveTab("schedule");
        } else if (isMounted) {
          setLineItems([]);
        }
      } catch {
        if (isMounted) setLineItems([]);
      } finally {
        if (isMounted) setIsLoadingItems(false);
      }
    }

    if (open && plan) {
      loadLiveDetail();
    }

    return () => {
      isMounted = false;
    };
  }, [open, plan]);

  // Filtered line items for search
  const filteredLineItems = useMemo(() => {
    if (!itemSearch.trim()) return lineItems;
    const query = itemSearch.toLowerCase();
    return lineItems.filter(
      (item) =>
        item.description?.toLowerCase().includes(query) ||
        item.refNo?.toLowerCase().includes(query) ||
        item.itemId?.toLowerCase().includes(query) ||
        item.procurementMethod?.toLowerCase().includes(query) ||
        item.pmoEndUser?.toLowerCase().includes(query) ||
        item.tenderPublicationDate?.toLowerCase().includes(query) ||
        item.bidClosingDate?.toLowerCase().includes(query) ||
        item.classOfProcurement?.toLowerCase().includes(query),
    );
  }, [lineItems, itemSearch]);

  if (!plan) return null;

  const handleTrackItemInPipeline = (item: ProcurementPlanLineItem) => {
    const key = item.itemId || item.refNo || item.description;
    setTrackedItemIds((prev) => ({ ...prev, [key]: true }));

    // Create pipeline task
    const newTask = {
      id: `tracked-${key}`,
      refNo: item.refNo || item.itemId || "PLAN-ITEM",
      countryCode: plan.countryCode || "ZW",
      title: item.description,
      entity: plan.procuringEntity,
      estimatedValue: plan.estimatedBudget ? Math.round(plan.estimatedBudget / (lineItems.length || 1)) : 150000,
      aiScore: 92,
      description: `Gazetted Procurement Plan Item (${plan.planRef}). Method: ${item.procurementMethod}. Expected Release: ${item.tenderPublicationDate || plan.expectedPublication}.`,
      priority: "High" as const,
      dueDate: item.tenderPublicationDate || plan.expectedPublication || "Q3 2026",
      progress: 5,
      team: item.classOfProcurement?.includes("Goods") ? "Electrical Grid" : "Civil & Roads",
      lessonsLearned: `Live gazette alert enabled. System will track ${plan.sourcePortal || "PRAZ e-GP"} for active tender notice on ${item.tenderPublicationDate || "release date"}.`,
    };

    try {
      const existing = JSON.parse(localStorage.getItem("tracked_pipeline_items") || "[]");
      const updated = [newTask, ...existing.filter((t: any) => t.id !== newTask.id)];
      localStorage.setItem("tracked_pipeline_items", JSON.stringify(updated));
      window.dispatchEvent(new Event("kanban-pipeline-updated"));
    } catch {
      // localStorage fallback
    }

    toast.success("Added to Tender Pipeline & Live Alert Enabled", {
      description: `Item ${item.refNo || item.itemId} added to Pipeline (Stage: New Opportunity). Auto-alert active for ${item.tenderPublicationDate || "gazetted release date"}.`,
    });
  };

  const handleTrackAllInPipeline = () => {
    if (lineItems.length === 0) return;
    const newRecord: Record<string, boolean> = {};
    const newTasks = lineItems.map((item, idx) => {
      const key = item.itemId || item.refNo || `item-${idx}`;
      newRecord[key] = true;
      return {
        id: `tracked-${key}`,
        refNo: item.refNo || item.itemId || `ITEM-${idx + 1}`,
        countryCode: plan.countryCode || "ZW",
        title: item.description,
        entity: plan.procuringEntity,
        estimatedValue: plan.estimatedBudget ? Math.round(plan.estimatedBudget / lineItems.length) : 150000,
        aiScore: 90,
        description: `Gazetted APP Forecast (${plan.planRef}). Expected Release: ${item.tenderPublicationDate || "Q3 2026"}.`,
        priority: "High" as const,
        dueDate: item.tenderPublicationDate || plan.expectedPublication || "Q3 2026",
        progress: 0,
        team: "Electrical Grid",
      };
    });

    setTrackedItemIds((prev) => ({ ...prev, ...newRecord }));

    try {
      const existing = JSON.parse(localStorage.getItem("tracked_pipeline_items") || "[]");
      const updated = [...newTasks, ...existing];
      localStorage.setItem("tracked_pipeline_items", JSON.stringify(updated));
      window.dispatchEvent(new Event("kanban-pipeline-updated"));
    } catch {
      // localStorage fallback
    }

    toast.success("All Plan Items Added to Pipeline", {
      description: `Tracked ${lineItems.length} forecast items from ${plan.planRef} in Tender Pipeline. Live release monitoring enabled.`,
    });
  };

  // Checkbox selection toggle helpers
  const toggleSelectItem = (key: string) => {
    setSelectedItemKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItemKeys.size === filteredLineItems.length && filteredLineItems.length > 0) {
      setSelectedItemKeys(new Set());
    } else {
      const allKeys = new Set(filteredLineItems.map((item) => item.itemId || item.refNo || item.description));
      setSelectedItemKeys(allKeys);
    }
  };

  const handleTrackSelectedInPipeline = () => {
    if (selectedItemKeys.size === 0) return;

    const itemsToTrack = lineItems.filter((item) => {
      const key = item.itemId || item.refNo || item.description;
      return selectedItemKeys.has(key);
    });

    const newRecord: Record<string, boolean> = {};
    const newTasks = itemsToTrack.map((item, idx) => {
      const key = item.itemId || item.refNo || item.description;
      newRecord[key] = true;
      return {
        id: `tracked-${key}`,
        refNo: item.refNo || item.itemId || `ITEM-${idx + 1}`,
        countryCode: plan.countryCode || "ZW",
        title: item.description,
        entity: plan.procuringEntity,
        estimatedValue: plan.estimatedBudget ? Math.round(plan.estimatedBudget / (lineItems.length || 1)) : 120000,
        aiScore: 92,
        description: `Gazetted APP Forecast (${plan.planRef}). Expected Release: ${item.tenderPublicationDate || plan.expectedPublication || "Q3 2026"}. Method: ${item.procurementMethod}.`,
        priority: "High" as const,
        dueDate: item.tenderPublicationDate || plan.expectedPublication || "Q3 2026",
        progress: 0,
        team: item.classOfProcurement?.includes("Works") ? "Civil & Roads" : "Electrical Grid",
        lessonsLearned: `Automated gazette monitoring active. Notification will trigger when ${plan.procuringEntity} publishes tender notice on ${plan.sourcePortal || "PRAZ e-GP"}.`,
      };
    });

    setTrackedItemIds((prev) => ({ ...prev, ...newRecord }));

    try {
      const existing = JSON.parse(localStorage.getItem("tracked_pipeline_items") || "[]");
      const existingIds = new Set(existing.map((t: any) => t.id));
      const merged = [...newTasks.filter((t) => !existingIds.has(t.id)), ...existing];
      localStorage.setItem("tracked_pipeline_items", JSON.stringify(merged));
      window.dispatchEvent(new Event("kanban-pipeline-updated"));
    } catch {
      // localStorage fallback
    }

    toast.success(
      `${itemsToTrack.length} Selected Item${itemsToTrack.length > 1 ? "s" : ""} Added to Pipeline & Live Alerts Active`,
      {
        description: `Transferred to Tender Pipeline (Stage: New). Automated tracking enabled for expected release dates.`,
      },
    );

    setSelectedItemKeys(new Set());
  };

  const handleToggleSubscribe = () => {
    setIsSubscribed(!isSubscribed);
    if (!isSubscribed) {
      toast.success("Gazette Alert Subscribed", {
        description: `You will be notified immediately when ${plan.procuringEntity} gazettes the active tender notice for ${plan.planRef}.`,
      });
    } else {
      toast.info("Alert Unsubscribed", {
        description: `Tracking removed for ${plan.planRef}.`,
      });
    }
  };

  const handleExportCsv = () => {
    if (lineItems.length === 0) {
      toast.error("No schedule line items available to export.");
      return;
    }
    const headers = [
      "Item ID",
      "Ref No",
      "Class of Procurement",
      "Object Code",
      "Description of Requirements",
      "PMO / End-User",
      "Procurement Method",
      "EOI Publication Date",
      "EOI Closing Date",
      "Tender Publication Date (Release Date)",
      "Bid Closing Date",
      "Notice of Award",
      "Contract Signing",
      "Cycle (days)",
      "Lead Time / Delivery",
      "SPOC",
      "Source of Funds",
      "UoM",
      "Quantity",
      "Comments / Remarks",
    ];

    const rows = lineItems.map((item) => [
      `"${item.itemId || ""}"`,
      `"${item.refNo || ""}"`,
      `"${item.classOfProcurement || ""}"`,
      `"${item.objectCode || ""}"`,
      `"${(item.description || "").replace(/"/g, '""')}"`,
      `"${item.pmoEndUser || ""}"`,
      `"${item.procurementMethod || ""}"`,
      `"${item.eoiPublicationDate || ""}"`,
      `"${item.eoiClosingDate || ""}"`,
      `"${item.tenderPublicationDate || ""}"`,
      `"${item.bidClosingDate || ""}"`,
      `"${item.awardNoticeDate || ""}"`,
      `"${item.contractSigningDate || ""}"`,
      `"${calculateCycleDays(item)}"`,
      `"${item.leadTime || ""}"`,
      `"${item.spoc || ""}"`,
      `"${item.sourceOfFunds || ""}"`,
      `"${item.unitOfMeasurement || ""}"`,
      `"${item.quantity || ""}"`,
      `"${(item.comments || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${plan.planRef}_Procurement_Schedule.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Procurement Schedule exported to CSV");
  };

  const handlePrintBrief = () => {
    const printContent = `
========================================================================
             ANNUAL ADVANCE PROCUREMENT PLAN BRIEF
========================================================================
PLAN REFERENCE   : ${plan.planRef}
PROCURING ENTITY : ${plan.procuringEntity}
COUNTRY / MARKET : ${plan.countryName} (${plan.countryCode})
CATEGORY         : ${plan.category}
ESTIMATED BUDGET : ${formatCurrency(plan.estimatedBudget, { noDecimals: true })}
EXPECTED WINDOW  : ${plan.expectedPublication} (${plan.quarter})
SOURCING METHOD  : ${plan.procurementMethod}
SPOC CONTACT     : ${plan.spocContact || "procurement@portal.gov"}
PORTAL LINK      : ${plan.portalUrl || "N/A"}

SCHEDULED LINE ITEMS COUNT: ${lineItems.length}
${lineItems.map((item, i) => `\n[Item ${i + 1}] ${item.refNo || item.itemId}: ${item.description}\n  - Method: ${item.procurementMethod}\n  - Cycle: ${calculateCycleDays(item)} days | Lead Time: ${item.leadTime || "N/A"}\n  - Release Date: ${item.tenderPublicationDate || "N/A"} | Closing: ${item.bidClosingDate || "N/A"}\n  - Award: ${item.awardNoticeDate || "N/A"} | Signing: ${item.contractSigningDate || "N/A"}\n  - Qty: ${item.quantity} ${item.unitOfMeasurement}`).join("\n")}

Generated by Tender Intelligence Portal - Enterprise Edition
========================================================================
    `.trim();

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(
        `<pre style="font-family: monospace; padding: 24px; font-size: 13px; line-height: 1.6;">${printContent}</pre>`,
      );
      win.document.close();
      win.print();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[96vw] max-w-[96vw] max-h-[90vh] h-[90vh] flex flex-col overflow-hidden p-0 gap-0 border-border/80 shadow-2xl"
        style={{ width: "96vw", maxWidth: "96vw", maxHeight: "90vh", height: "90vh" }}
      >
        {/* Header Banner */}
        <div className="border-b border-border/60 bg-muted/30 p-4 sm:p-5 space-y-2.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded border border-border bg-background px-2 py-0.5 font-mono text-xs font-bold text-foreground">
                {plan.countryCode}
              </span>
              <span className="font-mono text-xs font-semibold text-muted-foreground">{plan.planRef}</span>
              <Badge variant="outline" className="text-[11px] font-mono border-primary/30 text-primary bg-primary/5">
                {plan.quarter}
              </Badge>
              <Badge
                variant="default"
                className="text-xs px-2.5 py-0.5 font-semibold bg-emerald-600 dark:bg-emerald-700 text-white"
              >
                Gazetted APP Forecast
              </Badge>
              {lineItems.length > 0 && (
                <Badge variant="secondary" className="text-xs font-mono">
                  {lineItems.length} Scheduled Items
                </Badge>
              )}
            </div>

            {/* Header Action Buttons with Dedicated Padding to Clear Close 'X' Button */}
            <div className="flex items-center gap-2 pr-10 sm:pr-12">
              {lineItems.length > 0 && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={selectedItemKeys.size > 0 ? handleTrackSelectedInPipeline : handleTrackAllInPipeline}
                  className="text-xs h-7.5 px-3 font-semibold bg-primary text-primary-foreground shadow-xs"
                >
                  {selectedItemKeys.size > 0
                    ? `Add (${selectedItemKeys.size}) to Pipeline & Alerts`
                    : "Track All Items in Pipeline"}
                </Button>
              )}

              {plan.portalUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(plan.portalUrl, "_blank", "noopener,noreferrer")}
                  className="text-xs h-7.5 px-3 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary font-semibold transition-all"
                >
                  <span>{plan.sourcePortal || "Official PRAZ Gazette"}</span>
                </Button>
              )}
            </div>
          </div>

          <DialogHeader className="p-0 text-left">
            <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-tight">
              {plan.description}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2 text-xs sm:text-sm font-medium text-foreground/80 pt-0.5 flex-wrap">
              <span>{plan.procuringEntity}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{plan.countryName}</span>
              {plan.sourcePortal && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="font-mono text-xs text-primary font-semibold">{plan.sourcePortal}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Tab Navigation & Body - Flex 1 Scrollable Area */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div className="border-b border-border/60 px-5 sm:px-6 bg-background shrink-0">
            <TabsList className="bg-transparent p-0 h-10 gap-4 justify-start">
              <TabsTrigger
                value="schedule"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-2 text-xs font-medium h-10"
              >
                Procurement Schedule & Key Dates {lineItems.length > 0 ? `(${lineItems.length})` : ""}
              </TabsTrigger>
              <TabsTrigger
                value="overview"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-2 text-xs font-medium h-10"
              >
                Entity & Source Overview
              </TabsTrigger>
              <TabsTrigger
                value="preparation"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-2 text-xs font-medium h-10"
              >
                Pre-Bid Readiness & Checklist
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto space-y-3">
            {/* TAB 1: FULL SCHEDULE TABLE WITH ALL DATES & PIPELINE TRACKING */}
            <TabsContent value="schedule" className="mt-0 space-y-3">
              {isLoadingItems ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    Scraping live gazetted procurement schedule from PRAZ e-GP...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Parsing item codes, release dates, closing dates, and award timelines
                  </p>
                </div>
              ) : lineItems.length > 0 ? (
                <div className="space-y-3">
                  {/* Search, View Mode & Export Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-sm">
                      <Input
                        type="search"
                        placeholder="Search items, ref no, dates, methods..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* View Mode Switcher: Fit to Screen vs Wide Table */}
                      <div className="flex items-center gap-1 bg-muted/80 p-0.5 rounded-md border border-border/70">
                        <Button
                          size="sm"
                          variant={viewLayout === "compact" ? "default" : "ghost"}
                          onClick={() => setViewLayout("compact")}
                          className={`h-7 px-2.5 text-xs font-semibold ${viewLayout === "compact" ? "shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          Fit to Screen
                        </Button>
                        <Button
                          size="sm"
                          variant={viewLayout === "wide" ? "default" : "ghost"}
                          onClick={() => setViewLayout("wide")}
                          className={`h-7 px-2.5 text-xs font-semibold ${viewLayout === "wide" ? "shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          Wide (15 Cols)
                        </Button>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleExportCsv}
                        className="text-xs h-8 font-medium px-3"
                      >
                        Export CSV
                      </Button>
                      <Badge variant="outline" className="text-xs font-mono py-1">
                        Showing {filteredLineItems.length} of {lineItems.length} items
                      </Badge>
                    </div>
                  </div>

                  {/* Horizontal Scroll Bar Navigation Helper (Only in Wide mode) */}
                  {viewLayout === "wide" && (
                    <div className="flex items-center justify-between bg-muted/60 px-3 py-1.5 rounded-lg border border-border/70 text-xs gap-2 flex-wrap">
                      <span className="font-medium text-foreground text-xs">
                        15 Schedule Columns: Scroll horizontally to view all milestone dates and pipeline actions
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => scrollTable("left")}
                          className="h-7 px-3 text-xs font-semibold bg-background hover:bg-muted"
                          title="Scroll schedule table left"
                        >
                          ◀ Scroll Left
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => scrollTable("right")}
                          className="h-7 px-3 text-xs font-semibold"
                          title="Scroll schedule table right"
                        >
                          Scroll Right ▶
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Selection Action Banner */}
                  {selectedItemKeys.size > 0 && (
                    <div className="flex items-center justify-between bg-primary/10 border border-primary/40 px-3.5 py-2 rounded-xl text-xs gap-3 flex-wrap animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="bg-primary text-primary-foreground font-bold px-2.5 py-0.5">
                          {selectedItemKeys.size} Selected
                        </Badge>
                        <span className="font-semibold text-foreground">
                          Ready to transfer to Tender Pipeline & configure gazetted release tracking
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedItemKeys(new Set())}
                          className="h-7 text-xs font-medium hover:bg-background"
                        >
                          Clear Selection
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={handleTrackSelectedInPipeline}
                          className="h-7 px-3 text-xs font-bold bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
                        >
                          Add {selectedItemKeys.size} to Pipeline & Set Live Alerts
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* SCHEDULE TABLE - DUAL MODE */}
                  {viewLayout === "compact" ? (
                    /* COMPACT FIT-TO-SCREEN MODE: 100% visible on normal zoom without scrolling or zooming out */
                    <div className="w-full max-h-[46vh] overflow-y-auto rounded-xl border border-border/70 shadow-2xs">
                      <table className="w-full text-left text-xs border-separate border-spacing-0">
                        <thead className="sticky top-0 z-20 shadow-xs">
                          <tr className="bg-muted text-muted-foreground">
                            <th className="p-3 w-10 text-center bg-muted border-b border-border/70">
                              <Checkbox
                                checked={
                                  filteredLineItems.length > 0 && selectedItemKeys.size === filteredLineItems.length
                                }
                                onCheckedChange={toggleSelectAll}
                                aria-label="Select all items"
                              />
                            </th>
                            <th className="p-3 font-semibold w-1/3 bg-muted border-b border-border/70">
                              Item Reference & Requirements
                            </th>
                            <th className="p-3 font-semibold w-1/6 bg-muted border-b border-border/70">
                              Method & Department
                            </th>
                            <th className="p-3 font-semibold w-1/4 bg-muted border-b border-border/70">
                              Key Milestone Dates
                            </th>
                            <th className="p-3 font-semibold w-1/6 bg-muted border-b border-border/70">
                              Cycle & Delivery
                            </th>
                            <th className="p-3 font-semibold text-center w-28 bg-muted border-b border-border/70">
                              Pipeline Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLineItems.map((item, idx) => {
                            const itemKey = item.itemId || item.refNo || item.description;
                            const isTracked = trackedItemIds[itemKey];
                            const isSelected = selectedItemKeys.has(itemKey);

                            return (
                              <tr
                                key={idx}
                                className={`hover:bg-muted/30 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                              >
                                <td className="p-3 text-center align-top border-b border-border/60">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleSelectItem(itemKey)}
                                    aria-label={`Select ${item.refNo || item.itemId}`}
                                  />
                                </td>
                                <td className="p-3 align-top space-y-1 border-b border-border/60">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono font-bold text-foreground text-xs">
                                      {item.refNo || item.itemId || `ITEM-${idx + 1}`}
                                    </span>
                                    {item.itemId && (
                                      <span className="text-[10px] font-mono text-muted-foreground">
                                        #{item.itemId}
                                      </span>
                                    )}
                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                                      {item.classOfProcurement || "General"}
                                    </Badge>
                                  </div>
                                  <p className="font-medium text-foreground text-xs leading-snug">{item.description}</p>
                                  {item.objectCode && (
                                    <p className="text-[10px] font-mono text-muted-foreground">
                                      Object Code: {item.objectCode}
                                    </p>
                                  )}
                                </td>
                                <td className="p-3 align-top space-y-1 border-b border-border/60">
                                  <p className="font-semibold text-foreground text-xs">
                                    {item.procurementMethod || "Open Sourcing"}
                                  </p>
                                  <p className="text-muted-foreground text-[11px] leading-tight">
                                    {item.pmoEndUser || plan.procuringEntity}
                                  </p>
                                </td>
                                <td className="p-3 align-top space-y-1 border-b border-border/60">
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <span className="text-muted-foreground text-[11px] w-14">Release:</span>
                                    <span className="font-mono font-bold text-primary">
                                      {item.tenderPublicationDate && item.tenderPublicationDate !== "Not Applicable"
                                        ? item.tenderPublicationDate
                                        : "TBD / Q3 2026"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <span className="text-muted-foreground text-[11px] w-14">Closing:</span>
                                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                                      {item.bidClosingDate && item.bidClosingDate !== "Not Applicable"
                                        ? item.bidClosingDate
                                        : "TBD"}
                                    </span>
                                  </div>
                                  {(item.awardNoticeDate || item.contractSigningDate) && (
                                    <p className="text-[10px] font-mono text-muted-foreground pt-0.5">
                                      Award: {item.awardNoticeDate || "-"} • Sign: {item.contractSigningDate || "-"}
                                    </p>
                                  )}
                                </td>
                                <td className="p-3 align-top space-y-1 border-b border-border/60">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-muted font-mono font-bold text-foreground text-[11px] border border-border/60">
                                      {calculateCycleDays(item)} d cycle
                                    </span>
                                  </div>
                                  <p className="font-mono text-emerald-600 dark:text-emerald-400 text-[11px]">
                                    Delivery: {item.leadTime || "Standard"}
                                  </p>
                                  {item.quantity && (
                                    <p className="text-[10px] text-muted-foreground font-mono">
                                      Qty: {item.quantity} {item.unitOfMeasurement || "Units"}
                                    </p>
                                  )}
                                </td>
                                <td className="p-3 align-top text-center border-b border-border/60">
                                  {isTracked ? (
                                    <Badge className="bg-emerald-600 text-white font-mono text-[10px]">
                                      Tracked in Pipeline
                                    </Badge>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleTrackItemInPipeline(item)}
                                      className="h-7 text-[11px] px-2.5 font-semibold border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                                    >
                                      Add to Pipeline
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    /* WIDE SPREADSHEET 15-COLUMN MODE */
                    <div
                      id="procurement-schedule-scroll-container"
                      className="w-full max-h-[52vh] overflow-auto visible-scrollbar rounded-xl border border-border/70 shadow-2xs focus:outline-hidden"
                    >
                      <table className="w-full min-w-[1760px] text-left text-xs whitespace-nowrap border-collapse">
                        <thead className="bg-muted text-muted-foreground border-b border-border/70 sticky top-0 z-30 shadow-xs">
                          <tr>
                            <th className="p-3 w-12 text-center sticky left-0 bg-muted z-40 shadow-[1px_0_0_0_rgba(0,0,0,0.15)]">
                              <Checkbox
                                checked={
                                  filteredLineItems.length > 0 && selectedItemKeys.size === filteredLineItems.length
                                }
                                onCheckedChange={toggleSelectAll}
                                aria-label="Select all items"
                              />
                            </th>
                            <th className="p-3 font-semibold sticky left-12 bg-muted z-40 shadow-[2px_0_0_0_rgba(0,0,0,0.15)]">
                              Ref No / Item ID
                            </th>
                            <th className="p-3 font-semibold min-w-[240px]">Requirements Description</th>
                            <th className="p-3 font-semibold">Class of Procurement</th>
                            <th className="p-3 font-semibold">PMO / End-User</th>
                            <th className="p-3 font-semibold">Procurement Method</th>
                            <th className="p-3 font-semibold bg-primary/10 text-primary">Release Date (Tender Pub.)</th>
                            <th className="p-3 font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              Bid Closing Date
                            </th>
                            <th className="p-3 font-semibold">Notice of Award</th>
                            <th className="p-3 font-semibold">Contract Signing</th>
                            <th className="p-3 font-semibold text-center">Cycle (Days)</th>
                            <th className="p-3 font-semibold">Expected Delivery</th>
                            <th className="p-3 font-semibold">Qty & Unit</th>
                            <th className="p-3 font-semibold">Source of Funds</th>
                            <th className="p-3 font-semibold">Remarks</th>
                            <th className="p-3 font-semibold text-center sticky right-0 bg-muted z-30 shadow-[-2px_0_0_0_rgba(0,0,0,0.1)]">
                              Pipeline Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {filteredLineItems.map((item, idx) => {
                            const itemKey = item.itemId || item.refNo || item.description;
                            const isTracked = trackedItemIds[itemKey];
                            const isSelected = selectedItemKeys.has(itemKey);

                            return (
                              <tr
                                key={idx}
                                className={`hover:bg-muted/30 transition-colors group ${isSelected ? "bg-primary/5" : ""}`}
                              >
                                <td className="p-3 w-12 text-center sticky left-0 bg-background z-10 group-hover:bg-muted/50 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleSelectItem(itemKey)}
                                    aria-label={`Select ${item.refNo || item.itemId}`}
                                  />
                                </td>
                                <td className="p-3 space-y-0.5 sticky left-12 bg-background z-10 group-hover:bg-muted/50 shadow-[2px_0_0_0_rgba(0,0,0,0.1)]">
                                  <span className="font-mono font-bold text-foreground block">
                                    {item.refNo || item.itemId || `ITEM-${idx + 1}`}
                                  </span>
                                  {item.itemId && (
                                    <span className="text-[10px] font-mono text-muted-foreground">#{item.itemId}</span>
                                  )}
                                </td>
                                <td className="p-3 max-w-[320px] whitespace-normal">
                                  <p className="font-medium text-foreground leading-snug">{item.description}</p>
                                  {item.objectCode && (
                                    <p className="text-[10px] font-mono text-muted-foreground">
                                      Object Code: {item.objectCode}
                                    </p>
                                  )}
                                </td>
                                <td className="p-3">
                                  <Badge variant="outline" className="text-[10px]">
                                    {item.classOfProcurement || "General"}
                                  </Badge>
                                </td>
                                <td className="p-3 text-muted-foreground">{item.pmoEndUser || "Administration"}</td>
                                <td className="p-3 font-medium text-foreground">
                                  {item.procurementMethod || "Open Sourcing"}
                                </td>
                                <td className="p-3 bg-primary/5">
                                  {item.tenderPublicationDate && item.tenderPublicationDate !== "Not Applicable" ? (
                                    <span className="font-mono font-bold text-primary">
                                      {item.tenderPublicationDate}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">Not Applicable</span>
                                  )}
                                </td>
                                <td className="p-3 bg-amber-500/5">
                                  {item.bidClosingDate && item.bidClosingDate !== "Not Applicable" ? (
                                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                                      {item.bidClosingDate}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">Not Applicable</span>
                                  )}
                                </td>
                                <td className="p-3 font-mono text-muted-foreground">{item.awardNoticeDate || "-"}</td>
                                <td className="p-3 font-mono text-muted-foreground">
                                  {item.contractSigningDate || "-"}
                                </td>
                                <td className="p-3 font-mono text-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-muted font-mono font-bold text-foreground text-[11px] border border-border/60">
                                    {calculateCycleDays(item)} d
                                  </span>
                                </td>
                                <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">
                                  {item.leadTime || "-"}
                                </td>
                                <td className="p-3 font-mono">
                                  {item.quantity ? `${item.quantity} ${item.unitOfMeasurement || "Each"}` : "-"}
                                </td>
                                <td
                                  className="p-3 text-muted-foreground text-[11px] max-w-[160px] truncate"
                                  title={item.sourceOfFunds}
                                >
                                  {item.sourceOfFunds || "Internal Budget Funding"}
                                </td>
                                <td
                                  className="p-3 text-muted-foreground text-[11px] max-w-[180px] truncate"
                                  title={item.comments}
                                >
                                  {item.comments || "Domestic Tender"}
                                </td>
                                <td className="p-3 text-center">
                                  {isTracked ? (
                                    <Badge className="bg-emerald-600 text-white font-mono text-[10px]">
                                      Tracked in Pipeline
                                    </Badge>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleTrackItemInPipeline(item)}
                                      className="h-7 text-[11px] px-2.5 font-semibold border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                                    >
                                      Add to Pipeline
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
                  <FileSpreadsheet className="size-10 text-muted-foreground/60 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">
                    Detailed Procurement Schedule Available on Portal
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    The procuring entity has gazetted this advance procurement plan. Open the official portal link to
                    view individual specification annexures.
                  </p>
                  {plan.portalUrl && (
                    <Button
                      size="sm"
                      onClick={() => window.open(plan.portalUrl, "_blank", "noopener,noreferrer")}
                      className="text-xs gap-1.5 font-semibold"
                    >
                      <ExternalLink className="size-3.5" /> View on {plan.sourcePortal || "Official Portal"}
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* TAB 2: OVERVIEW */}
            <TabsContent value="overview" className="mt-0 space-y-5">
              {/* Official Gazetted Procurement Link Card */}
              <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <ExternalLink className="size-3.5 text-primary" /> Official Statutory Procurement Link
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Access the gazetted procurement record and portal notices directly on{" "}
                      {plan.sourcePortal || (plan.countryCode === "ZW" ? "PRAZ e-GP" : "ZPPA e-Procurement")}.
                    </p>
                  </div>
                  {plan.portalUrl && (
                    <Button
                      size="sm"
                      onClick={() => window.open(plan.portalUrl, "_blank", "noopener,noreferrer")}
                      className="text-xs gap-1.5 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                    >
                      <ExternalLink className="size-3.5" /> Open Portal Notice
                    </Button>
                  )}
                </div>

                {plan.portalUrl && (
                  <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 p-2 px-3 gap-2">
                    <span className="font-mono text-xs text-foreground truncate select-all">{plan.portalUrl}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (plan.portalUrl) {
                          const copied = await copyTextToClipboard(plan.portalUrl);
                          if (copied) toast.success("Link copied to clipboard!");
                          else toast.error("Copy failed. Select and copy the link manually.");
                        }
                      }}
                      className="h-7 text-xs px-2.5 text-muted-foreground hover:text-foreground shrink-0 font-medium"
                    >
                      Copy Link
                    </Button>
                  </div>
                )}
              </div>

              {/* 4 Metric Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Estimated Budget
                  </span>
                  <p className="font-mono text-base sm:text-lg font-bold text-foreground">
                    {formatCurrency(plan.estimatedBudget, { noDecimals: true })}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Annual Capital Forecast</p>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Publication Window
                  </span>
                  <p className="font-mono text-base sm:text-lg font-bold text-primary">{plan.expectedPublication}</p>
                  <p className="text-[10px] text-muted-foreground">{plan.quarter} Gazetting</p>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Sourcing Method
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-foreground truncate" title={plan.procurementMethod}>
                    {plan.procurementMethod}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Statutory Framework</p>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Category Code
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-foreground truncate" title={plan.category}>
                    {plan.category}
                  </p>
                  <p className="text-[10px] text-muted-foreground">PRAZ/ZPPA Registered</p>
                </div>
              </div>

              {/* Procurement Entity SPOC Card */}
              <div className="rounded-xl border border-border/70 bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Mail className="size-3.5 text-primary" /> Procuring Entity Contact (SPOC)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Direct communications regarding pre-bid inquiries for this planned procurement.
                  </p>
                  <p className="font-mono text-xs font-semibold text-foreground pt-0.5">
                    {plan.spocContact || "procurement@entity.gov"}
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1.5 shrink-0"
                  onClick={() =>
                    window.open(`mailto:${plan.spocContact}?subject=Inquiry regarding Advance Plan ${plan.planRef}`)
                  }
                >
                  <Mail className="size-3.5" /> Email Entity
                </Button>
              </div>
            </TabsContent>

            {/* TAB 3: PRE-BID READINESS */}
            <TabsContent value="preparation" className="mt-0 space-y-4">
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Advance Compliance Requirements
                </h4>

                <div className="space-y-2">
                  <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-card p-3">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-foreground">1. PRAZ Category Registration</p>
                      <p className="text-xs text-muted-foreground">
                        Ensure your organization holds active 2026 PRAZ registration in category:{" "}
                        <strong>{plan.category}</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-card p-3">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-foreground">2. Financial Bonding Capacity</p>
                      <p className="text-xs text-muted-foreground">
                        Anticipated Bid Securing / Bank Guarantee of approx{" "}
                        <strong>{formatCurrency(plan.estimatedBudget * 0.02, { noDecimals: true })}</strong> (2%).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-card p-3">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-foreground">3. OEM & Manufacturer Authorizations</p>
                      <p className="text-xs text-muted-foreground">
                        If supplying specialized equipment or software, prepare valid Manufacturer Authorization Forms
                        (MAF) in advance.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-card p-3">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-foreground">4. Statutory Clearance Certificates</p>
                      <p className="text-xs text-muted-foreground">
                        ZIMRA ITF263 Tax Clearance and NSSA Certificate of Good Standing must remain valid during
                        expected closing window ({plan.expectedPublication}).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer Actions - Pinned and Fully Visible */}
        <div className="border-t border-border/70 bg-background/95 backdrop-blur-sm p-3 px-5 sm:px-6 flex flex-wrap items-center justify-between gap-3 shrink-0 z-30">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrintBrief} className="text-xs h-7.5 px-3 gap-1.5">
              <Printer className="size-3.5" /> Print Spec Brief
            </Button>

            {lineItems.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="text-xs h-7.5 px-3 gap-1.5 font-medium"
              >
                <Download className="size-3.5 text-primary" /> Export Schedule (CSV)
              </Button>
            )}

            {plan.portalUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(plan.portalUrl, "_blank", "noopener,noreferrer")}
                className="text-xs h-7.5 px-3 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              >
                <ExternalLink className="size-3.5" /> Open Portal Link
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isSubscribed ? "secondary" : "default"}
              onClick={handleToggleSubscribe}
              className="text-xs h-7.5 px-3 gap-1.5 font-semibold"
            >
              <Bell className="size-3.5" />
              {isSubscribed ? "Alert Active ✓" : "Notify Me When Gazetted"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs h-7.5 px-3 font-semibold hover:bg-muted"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
