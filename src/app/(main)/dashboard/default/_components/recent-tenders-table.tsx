"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  Cpu,
  ExternalLink,
  Filter,
  HeartPulse,
  Laptop,
  Layers,
  RefreshCw,
  Search,
  Sparkles,
  Stethoscope,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { TenderDetailDialog } from "@/components/tender/tender-detail-dialog";
import { TenderApiService } from "@/services/tender-api";
import { AuthService } from "@/services/auth-service";
import { type CountryScope, type TenderItem } from "./tender-data";

interface RecentTendersTableProps {
  countryScope: CountryScope;
}

export function RecentTendersTable({ countryScope }: RecentTendersTableProps) {
  const [tenders, setTenders] = useState<TenderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSector, setSelectedSector] = useState<"ALL" | "ICT" | "HEALTHCARE">("ALL");
  const [selectedTender, setSelectedTender] = useState<TenderItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState(() => AuthService.getCurrentUser());
  useEffect(() => {
    const sync = () => setCurrentUser(AuthService.getCurrentUser());
    window.addEventListener("atcis-auth-changed", sync);
    return () => window.removeEventListener("atcis-auth-changed", sync);
  }, []);

  const effectiveScope: CountryScope = currentUser?.role === "country_admin"
    ? (currentUser.country === "ZM" ? "ZM" : "ZW")
    : countryScope;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    TenderApiService.getLiveTenders(effectiveScope)
      .then((data) => {
        if (isMounted) {
          // Filter strictly to ICT & Software and Healthcare & Medical
          const focusTenders = (data || []).filter(
            (t) => t.sector === "ICT & Software" || t.sector === "Healthcare & Medical"
          );
          setTenders(focusTenders);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [effectiveScope]);

  const handleOpenDetails = (tender: TenderItem) => {
    setSelectedTender(tender);
    setIsDialogOpen(true);
  };

  // Live Sector Counts
  const ictCount = useMemo(
    () => tenders.filter((t) => t.sector === "ICT & Software").length,
    [tenders]
  );
  const healthCount = useMemo(
    () => tenders.filter((t) => t.sector === "Healthcare & Medical").length,
    [tenders]
  );

  const filteredTenders = useMemo(() => {
    return tenders.filter((t) => {
      // 1. Country scope filter
      const matchesCountry = effectiveScope === "ALL" || t.countryCode === effectiveScope;

      // 2. Sector filter (ICT & Software vs Healthcare)
      const matchesSector =
        selectedSector === "ALL" ||
        (selectedSector === "ICT" && t.sector === "ICT & Software") ||
        (selectedSector === "HEALTHCARE" && t.sector === "Healthcare & Medical");

      // 3. Search query filter
      const query = searchTerm.toLowerCase();
      const matchesSearch =
        t.title.toLowerCase().includes(query) ||
        t.refNo.toLowerCase().includes(query) ||
        t.procuringEntity.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        (t.sector || "").toLowerCase().includes(query);

      return matchesCountry && matchesSector && matchesSearch;
    });
  }, [tenders, countryScope, selectedSector, searchTerm]);

  const marketTitle =
    countryScope === "ZW"
      ? "Zimbabwe Priority Procurement Opportunities"
      : countryScope === "ZM"
      ? "Zambia Priority Procurement Opportunities"
      : "Regional Priority Procurement Opportunities";

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <span>{marketTitle}</span>
              <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-mono font-bold text-primary">
                {filteredTenders.length} Active
              </span>
            </CardTitle>
            <CardDescription>
              Focused strictly on active gazetted tenders for <strong>ICT & Software</strong> (laptops, servers, dev, networking) and <strong>Healthcare & Medical</strong>.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search laptops, servers, drugs, hospital..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 w-48 pl-8 text-xs sm:w-64"
              />
            </div>
          </div>
        </div>

        {/* Focus Sector Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
          <Button
            size="sm"
            variant={selectedSector === "ALL" ? "default" : "outline"}
            onClick={() => setSelectedSector("ALL")}
            className="h-7 text-xs gap-1.5 font-medium"
          >
            <Layers className="size-3.5" />
            <span>All Focus Sectors</span>
            <span className="ml-1 rounded px-1.5 py-0.2 bg-background/20 font-mono text-[10px] font-bold">
              {tenders.length}
            </span>
          </Button>

          <Button
            size="sm"
            variant={selectedSector === "ICT" ? "default" : "outline"}
            onClick={() => setSelectedSector("ICT")}
            className={`h-7 text-xs gap-1.5 font-medium ${
              selectedSector === "ICT"
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
            }`}
          >
            <Laptop className="size-3.5" />
            <span>ICT & Software</span>
            <span className="ml-1 rounded px-1.5 py-0.2 bg-background/20 font-mono text-[10px] font-bold">
              {ictCount}
            </span>
          </Button>

          <Button
            size="sm"
            variant={selectedSector === "HEALTHCARE" ? "default" : "outline"}
            onClick={() => setSelectedSector("HEALTHCARE")}
            className={`h-7 text-xs gap-1.5 font-medium ${
              selectedSector === "HEALTHCARE"
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
            }`}
          >
            <HeartPulse className="size-3.5" />
            <span>Healthcare & Medical</span>
            <span className="ml-1 rounded px-1.5 py-0.2 bg-background/20 font-mono text-[10px] font-bold">
              {healthCount}
            </span>
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <Table>
            <TableHeader className="bg-muted/40 text-xs">
              <TableRow>
                <TableHead className="w-[70px]">Market</TableHead>
                <TableHead className="w-[150px]">Reference</TableHead>
                <TableHead className="min-w-[260px]">Tender Title & Scope</TableHead>
                <TableHead className="w-[200px]">Procuring Authority</TableHead>
                <TableHead className="w-[150px]">Focus Sector</TableHead>
                <TableHead className="w-[120px]">Closing Date</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[90px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs sm:text-sm">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-xs">
                    Loading live ICT & Healthcare tenders directly from gazette...
                  </TableCell>
                </TableRow>
              ) : filteredTenders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-xs">
                    No active tenders matching the selected focus filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTenders.map((tender) => (
                  <TableRow
                    key={tender.id}
                    onClick={() => handleOpenDetails(tender)}
                    className="cursor-pointer transition-colors hover:bg-muted/30"
                  >
                    {/* Country Badge */}
                    <TableCell>
                      <span className="rounded border border-border bg-muted/90 px-2 py-1 font-mono text-[10px] font-bold text-foreground">
                        {tender.countryCode}
                      </span>
                    </TableCell>

                    {/* Reference # */}
                    <TableCell className="font-mono text-xs font-semibold text-foreground truncate max-w-[150px]">
                      {tender.refNo}
                    </TableCell>

                    {/* Title & Category */}
                    <TableCell className="min-w-[260px]">
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground line-clamp-1 hover:underline">
                          {tender.title}
                        </p>
                        <span className="inline-block text-[11px] text-muted-foreground line-clamp-1">
                          {tender.category}
                        </span>
                      </div>
                    </TableCell>

                    {/* Procuring Entity */}
                    <TableCell className="w-[200px]">
                      <div className="text-xs text-foreground font-medium truncate max-w-[200px]" title={tender.procuringEntity}>
                        {tender.procuringEntity}
                      </div>
                    </TableCell>

                    {/* Sector Badge */}
                    <TableCell className="w-[150px]">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold border ${
                          tender.sector === "ICT & Software"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {tender.sector === "ICT & Software" ? (
                          <Laptop className="size-3" />
                        ) : (
                          <HeartPulse className="size-3" />
                        )}
                        <span>{tender.sector}</span>
                      </span>
                    </TableCell>

                    {/* Deadline */}
                    <TableCell className="w-[120px] font-mono text-xs text-foreground">
                      <div>{tender.closingDate || "Open"}</div>
                      <span
                        className={`text-[10px] font-semibold ${
                          tender.daysRemaining <= 3
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {tender.daysRemaining > 0 ? `${tender.daysRemaining}d remaining` : "Active"}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="w-[100px]">
                      <Badge
                        variant={tender.status === "Closing Soon" ? "destructive" : "default"}
                        className="text-[10px] px-2 py-0.5 font-mono"
                      >
                        {tender.status}
                      </Badge>
                    </TableCell>

                    {/* Action */}
                    <TableCell className="w-[90px] text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs font-semibold text-foreground hover:bg-muted px-2.5"
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <TenderDetailDialog
        tender={selectedTender}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </Card>
  );
}
