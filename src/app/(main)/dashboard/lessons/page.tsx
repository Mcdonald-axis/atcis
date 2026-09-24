"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Search, Trophy } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { TenderOutcome } from "@/lib/tender-outcomes";
import { getLivePipelineBoard } from "@/lib/pipeline-sync";
import { formatCurrency } from "@/lib/utils";
import { AuthService, type AuthUser } from "@/services/auth-service";

export type { TenderOutcome } from "@/lib/tender-outcomes";

export default function ResultsTrackerPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => AuthService.getCurrentUser());
  const isAm = currentUser?.role === "account_manager";

  const [localRecords, setLocalRecords] = useState<TenderOutcome[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>(() => (isAm ? "Won" : "ALL"));
  const [countryFilter, setCountryFilter] = useState<"ALL" | "ZW" | "ZM">("ALL");

  useEffect(() => {
    const syncUser = () => {
      const u = AuthService.getCurrentUser();
      setCurrentUser(u);
      if (u?.role === "account_manager") {
        setOutcomeFilter("Won");
      }
    };
    syncUser();
    window.addEventListener("atcis-auth-changed", syncUser);
    return () => window.removeEventListener("atcis-auth-changed", syncUser);
  }, []);

  // The feed combines saved pipeline outcomes with manually logged debriefs.
  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    fetch("/api/records/lesson", { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || "Could not load tender outcomes.");
        if (!controller.signal.aborted) {
          setLocalRecords(json.data);
          setLoadError("");
        }
      })
      .catch(error => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Could not load tender outcomes.");
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, [refreshVersion]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setRefreshVersion(value => value + 1);
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("kanban-pipeline-updated", refresh);
    document.addEventListener("visibilitychange", refresh);
    const interval = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("kanban-pipeline-updated", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(interval);
    };
  }, []);

  // Restrict default view to user jurisdiction if non-super-admin
  useEffect(() => {
    const jurisdiction = AuthService.getUserJurisdiction();
    if (jurisdiction !== "ALL") {
      setCountryFilter(jurisdiction);
    }
  }, []);

  // Combine remote records with live won tasks from user's current pipeline
  const combinedRecords = useMemo(() => {
    if (!isAm) return localRecords;
    const seen = new Set<string>();
    const list: TenderOutcome[] = [];

    try {
      const liveBoard = getLivePipelineBoard();
      const liveWon = (liveBoard.won || []).map(task => ({
        id: `pipeline-outcome:${task.countryCode || "ZW"}:${task.id}`,
        tenderRef: task.refNo || task.id,
        title: task.title,
        entity: task.entity || "Procuring Authority",
        countryCode: (task.countryCode || "ZW") as "ZW" | "ZM",
        outcome: "Won" as const,
        ourBidPrice: 0,
        winningBidPrice: task.amountAwarded || task.estimatedValue || 0,
        winningCompany: "Our Company",
        awardDate: task.dueDate || "",
        keyTakeaway: [task.winLossReason, task.lessonsLearned].filter(Boolean).join(" — ") || "Awarded and active in execution.",
        currency: task.currency || "USD",
      }));

      for (const item of [...liveWon, ...localRecords]) {
        if (item.outcome !== "Won") continue;
        const key = `${item.countryCode}:${item.tenderRef || item.id}`.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          list.push(item);
        }
      }
      return list;
    } catch {
      return localRecords.filter(item => item.outcome === "Won");
    }
  }, [localRecords, isAm, refreshVersion]);

  // Filtered dataset
  const filteredOutcomes = useMemo(() => {
    return combinedRecords.filter((item) => {
      if (isAm && item.outcome !== "Won") return false;
      if (countryFilter !== "ALL" && item.countryCode !== countryFilter) return false;
      if (!isAm && outcomeFilter !== "ALL" && item.outcome !== outcomeFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          item.title?.toLowerCase().includes(q) ||
          item.tenderRef?.toLowerCase().includes(q) ||
          item.entity?.toLowerCase().includes(q) ||
          item.winningCompany?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [combinedRecords, isAm, countryFilter, outcomeFilter, searchTerm]);

  // New Debrief Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formRef, setFormRef] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formEntity, setFormEntity] = useState("");
  const [formCountry, setFormCountry] = useState<"ZW" | "ZM">("ZW");
  const [formOutcome, setFormOutcome] = useState<"Won" | "Lost" | "Under Evaluation">("Won");
  const [formOurBid, setFormOurBid] = useState("");
  const [formWinningBid, setFormWinningBid] = useState("");
  const [formWinningCompany, setFormWinningCompany] = useState("");
  const [formAwardDate, setFormAwardDate] = useState(new Date().toISOString().slice(0, 10));
  const [formTakeaway, setFormTakeaway] = useState("");

  const handleCreateOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.trim() || !formTitle.trim() || !formEntity.trim()) {
      toast.error("Please fill in the required tender details.");
      return;
    }

    setIsSubmitting(true);
    const newOutcome: TenderOutcome = {
      id: `lesson-${Date.now()}`,
      tenderRef: formRef.trim(),
      title: formTitle.trim(),
      entity: formEntity.trim(),
      countryCode: formCountry,
      outcome: formOutcome,
      ourBidPrice: Number(formOurBid) || 0,
      winningBidPrice: Number(formWinningBid) || Number(formOurBid) || 0,
      winningCompany: formWinningCompany.trim() || (formOutcome === "Won" ? "Our Company" : "Winning Bidder"),
      awardDate: formAwardDate,
      keyTakeaway: formTakeaway.trim() || "No debrief takeaway logged.",
    };

    try {
      const res = await fetch("/api/records/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOutcome),
      });

      if (!res.ok) {
        throw new Error("Failed to save outcome to database");
      }

      setRefreshVersion(value => value + 1);
      toast.success("Tender Outcome Logged", {
        description: `${newOutcome.tenderRef} debrief saved to database.`,
      });
      setIsAddOpen(false);
      // Reset form
      setFormRef("");
      setFormTitle("");
      setFormEntity("");
      setFormOurBid("");
      setFormWinningBid("");
      setFormWinningCompany("");
      setFormTakeaway("");
    } catch (err: any) {
      toast.error(err.message || "Failed to save tender outcome");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadReport = () => {
    if (loadError || isLoading) {
      toast.error("Wait for tender outcomes to finish loading before exporting.");
      return;
    }
    if (filteredOutcomes.length === 0) {
      toast.error("No debrief records available to export.");
      return;
    }

    const headers = [
      "Reference",
      "Title",
      "Procuring Entity",
      "Country",
      "Currency",
      "Outcome",
      "Our Bid Price",
      "Winning Price",
      "Awardee",
      "Award Date",
      "Strategic Debrief",
    ];

    const rows = filteredOutcomes.map((item) => [
      `"${item.tenderRef.replaceAll('"', '""')}"`,
      `"${item.title.replaceAll('"', '""')}"`,
      `"${item.entity.replaceAll('"', '""')}"`,
      item.countryCode,
      item.currency || "USD",
      item.outcome,
      item.ourBidPrice || "",
      item.winningBidPrice || "",
      `"${item.winningCompany.replaceAll('"', '""')}"`,
      item.awardDate,
      `"${item.keyTakeaway.replaceAll('"', '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", isAm ? `ATCIS_Won_Contracts_Report_${new Date().toISOString().slice(0, 10)}.csv` : `ATCIS_Win_Loss_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Report Downloaded", {
      description: isAm ? "Won contracts report exported as CSV." : "Win/loss report exported as CSV.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/50 pb-5 md:flex-row md:items-center">
        <div>
          <h1 className="font-bold text-2xl tracking-tight text-foreground sm:text-3xl">
            {isAm ? "Won Contracts & Win Debriefs" : "Results Tracker & Post-Mortem Intelligence"}
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {isAm
              ? "Your awarded tenders, winning bid pricing benchmarks, and post-award strategic takeaways."
              : "Win/Loss bid analytics, winning competitor pricing benchmarks, and institutional debrief takeaways."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadReport}
            className="gap-1.5 text-xs font-medium"
          >
            <Download className="size-3.5" /> {isAm ? "Download Won Contracts Report" : "Download Win/Loss Report"}
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="gap-1.5 text-xs font-medium"
          >
            <Plus className="size-3.5" /> {isAm ? "Log Won Tender Debrief" : "Log Tender Debrief"}
          </Button>
        </div>
      </div>

      {/* Results History Table */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold">
              {isAm ? "My Won Contracts & Debriefs" : "Tender Outcome Log & Debriefs"}
            </CardTitle>
            <CardDescription>
              {isAm
                ? "Your awarded pipeline tenders with recorded award values and debrief takeaways."
                : "Won and lost pipeline tenders, with recorded award values and debrief notes."}
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-48 sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search debriefs…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            <Select value={countryFilter} onValueChange={(val: any) => setCountryFilter(val)}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Regions</SelectItem>
                <SelectItem value="ZW" className="text-xs">Zimbabwe</SelectItem>
                <SelectItem value="ZM" className="text-xs">Zambia</SelectItem>
              </SelectContent>
            </Select>

            {isAm ? (
              <Badge
                variant="outline"
                className="h-8 gap-1.5 px-3 text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 font-medium whitespace-nowrap"
              >
                <Trophy className="size-3 text-emerald-600 dark:text-emerald-400" /> Won Contracts Alone
              </Badge>
            ) : (
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue placeholder="Outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">All Outcomes</SelectItem>
                  <SelectItem value="Won" className="text-xs">Won</SelectItem>
                  <SelectItem value="Lost" className="text-xs">Lost</SelectItem>
                  <SelectItem value="Under Evaluation" className="text-xs">Under Evaluation</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border/50">
            <Table>
              <TableHeader className="bg-muted/40 text-xs">
                <TableRow>
                  <TableHead>Tender Reference & Title</TableHead>
                  <TableHead>Procuring Entity</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="text-right">Our Bid Price</TableHead>
                  <TableHead className="text-right">Winning Price</TableHead>
                  <TableHead>Awardee Company</TableHead>
                  <TableHead className="w-[300px]">Key Takeaway & Debrief</TableHead>
                  <TableHead>Award Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {loadError || filteredOutcomes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      {loadError ? (
                        <>
                          {loadError}{" "}
                          <Button variant="outline" size="sm" disabled={isLoading}
                            onClick={() => setRefreshVersion(value => value + 1)}>
                            Retry
                          </Button>
                        </>
                      ) : isLoading ? "Loading tender outcomes…"
                        : isAm
                        ? "No won tenders recorded yet. Tenders marked as Won in your pipeline appear here automatically."
                        : "No outcomes match these filters. Won and lost pipeline tenders appear here automatically."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOutcomes.map((item) => (
                    <TableRow key={item.id} className="transition-colors hover:bg-muted/30">
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded border border-border bg-muted px-1.5 py-0.2 font-mono text-[10px] font-semibold text-foreground">
                              {item.countryCode}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">{item.tenderRef}</span>
                          </div>
                          <p className="font-semibold text-foreground line-clamp-1">{item.title}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.entity}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.outcome === "Won"
                              ? "default"
                              : item.outcome === "Lost"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {item.outcome}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold tabular-nums text-foreground">
                        {item.ourBidPrice ? formatCurrency(item.ourBidPrice, { noDecimals: true, currency: item.currency || "USD" }) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold tabular-nums text-foreground">
                        {item.winningBidPrice ? formatCurrency(item.winningBidPrice, { noDecimals: true, currency: item.currency || "USD" }) : "—"}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{item.winningCompany || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.keyTakeaway || "—"}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{item.awardDate || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* MODAL: Log Tender Outcome / Debrief */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleCreateOutcome} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                {isAm ? "Log Won Tender Debrief" : "Log Tender Outcome & Debrief"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isAm
                  ? "Record post-award contract details, winning bid price, and key execution takeaways."
                  : "Record post-tender competitive intelligence, winning price, and institutional lessons learned."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <Label htmlFor="debrief-ref">Tender Reference *</Label>
                <Input
                  id="debrief-ref"
                  placeholder="e.g. PRAZ/ZETDC/2026/044"
                  value={formRef}
                  onChange={(e) => setFormRef(e.target.value)}
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="debrief-country">Jurisdiction</Label>
                <Select value={formCountry} onValueChange={(v: "ZW" | "ZM") => setFormCountry(v)}>
                  <SelectTrigger id="debrief-country" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ZW" className="text-xs">Zimbabwe (PRAZ)</SelectItem>
                    <SelectItem value="ZM" className="text-xs">Zambia (ZPPA)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-1">
                <Label htmlFor="debrief-title">Tender Title *</Label>
                <Input
                  id="debrief-title"
                  placeholder="e.g. Supply and Delivery of 33kV Switchgear"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="debrief-entity">Procuring Entity *</Label>
                <Input
                  id="debrief-entity"
                  placeholder="e.g. ZETDC / ZESA Holdings"
                  value={formEntity}
                  onChange={(e) => setFormEntity(e.target.value)}
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="debrief-outcome">Outcome *</Label>
                {isAm ? (
                  <div className="flex h-8 items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Won (Account Manager)
                  </div>
                ) : (
                  <Select
                    value={formOutcome}
                    onValueChange={(v: "Won" | "Lost" | "Under Evaluation") => setFormOutcome(v)}
                  >
                    <SelectTrigger id="debrief-outcome" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Won" className="text-xs">Won</SelectItem>
                      <SelectItem value="Lost" className="text-xs">Lost</SelectItem>
                      <SelectItem value="Under Evaluation" className="text-xs">Under Evaluation</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="debrief-our-bid">Our Bid Price (USD)</Label>
                <Input
                  id="debrief-our-bid"
                  type="number"
                  placeholder="e.g. 1450000"
                  value={formOurBid}
                  onChange={(e) => setFormOurBid(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="debrief-win-bid">Winning Bid Price (USD)</Label>
                <Input
                  id="debrief-win-bid"
                  type="number"
                  placeholder="e.g. 1450000"
                  value={formWinningBid}
                  onChange={(e) => setFormWinningBid(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <Label htmlFor="debrief-winner">Winning Contractor / Company</Label>
                <Input
                  id="debrief-winner"
                  placeholder="e.g. Our Company or Competitor Name"
                  value={formWinningCompany}
                  onChange={(e) => setFormWinningCompany(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <Label htmlFor="debrief-takeaway">Strategic Debrief & Lessons Learned *</Label>
                <Textarea
                  id="debrief-takeaway"
                  placeholder="Key technical, commercial, or compliance takeaways from this bid process..."
                  value={formTakeaway}
                  onChange={(e) => setFormTakeaway(e.target.value)}
                  rows={3}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save Debrief to Database"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
