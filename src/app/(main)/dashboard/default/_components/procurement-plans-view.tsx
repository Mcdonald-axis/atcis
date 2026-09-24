"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Calendar,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import type { CountryScope, AdvanceProcurementPlan } from "./tender-data";
import { TenderApiService } from "@/services/tender-api";
import { AuthService } from "@/services/auth-service";
import { ProcurementPlanDetailDialog } from "@/components/procurement/procurement-plan-detail-dialog";

export type { AdvanceProcurementPlan };

interface ProcurementPlansViewProps {
  countryScope?: CountryScope;
}

export function ProcurementPlansView({ countryScope = "ALL" }: ProcurementPlansViewProps) {
  const [currentUser, setCurrentUser] = useState(() => AuthService.getCurrentUser());
  useEffect(() => {
    const sync = () => setCurrentUser(AuthService.getCurrentUser());
    window.addEventListener("atcis-auth-changed", sync);
    return () => window.removeEventListener("atcis-auth-changed", sync);
  }, []);

  const effectiveScope: CountryScope = currentUser?.role === "country_admin"
    ? (currentUser.country === "ZM" ? "ZM" : "ZW")
    : countryScope;

  const [plans, setPlans] = useState<AdvanceProcurementPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [quarterFilter, setQuarterFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [selectedPlan, setSelectedPlan] = useState<AdvanceProcurementPlan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadLivePlans() {
      setIsLoading(true);
      try {
        const livePlans = await TenderApiService.getLiveProcurementPlans(effectiveScope);
        if (isMounted && livePlans) {
          setPlans(livePlans);
        }
      } catch {
        if (isMounted) setPlans([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadLivePlans();
    return () => {
      isMounted = false;
    };
  }, [effectiveScope]);

  const handleOpenPlan = (plan: AdvanceProcurementPlan) => {
    setSelectedPlan(plan);
    setIsDialogOpen(true);
  };

  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      const matchCountry = effectiveScope === "ALL" || plan.countryCode === effectiveScope;
      const matchQuarter = quarterFilter === "ALL" || plan.quarter === quarterFilter;
      const matchMethod = methodFilter === "ALL" || plan.procurementMethod === methodFilter;
      const matchSearch =
        plan.procuringEntity.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plan.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plan.planRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plan.category.toLowerCase().includes(searchTerm.toLowerCase());

      return matchCountry && matchQuarter && matchMethod && matchSearch;
    });
  }, [plans, effectiveScope, quarterFilter, methodFilter, searchTerm]);

  return (
    <div className="space-y-5">
      {/* Plans Master Card */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3.5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg font-semibold flex items-center gap-2">
                <FileSpreadsheet className="size-4 text-primary" />
                <span>Annual Advance Procurement Plans</span>
              </CardTitle>
              <CardDescription>
                Statutory procurement plans published in advance by government parastatals and ministries. Click any row to view complete project parameters.
              </CardDescription>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search plan, entity, keyword..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background"
                />
              </div>

              {/* Quarter Filter */}
              <select
                value={quarterFilter}
                onChange={(e) => setQuarterFilter(e.target.value)}
                className="h-8 rounded-lg border border-border/70 bg-background px-2.5 text-xs text-foreground focus:outline-hidden"
              >
                <option value="ALL">All Quarters</option>
                <option value="Q3 2026">Q3 2026</option>
                <option value="Q4 2026">Q4 2026</option>
                <option value="Q1 2027">Q1 2027</option>
              </select>

              {/* Method Filter */}
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="h-8 rounded-lg border border-border/70 bg-background px-2.5 text-xs text-foreground focus:outline-hidden"
              >
                <option value="ALL">All Methods</option>
                <option value="Open Competitive">Open Competitive</option>
                <option value="RFP">RFP</option>
                <option value="Framework Agreement">Framework Agreement</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <Table>
              <TableHeader className="bg-muted/40 text-xs">
                <TableRow>
                  <TableHead className="w-[150px]">Plan Reference</TableHead>
                  <TableHead>Procuring Entity & Scope</TableHead>
                  <TableHead className="w-[150px]">Category</TableHead>
                  <TableHead className="w-[110px]">Expected Date</TableHead>
                  <TableHead className="w-[140px]">Procurement Method</TableHead>
                  <TableHead className="text-right w-[130px]">Est. Budget ($)</TableHead>
                  <TableHead className="w-[80px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs sm:text-sm">
                {filteredPlans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                      No procurement plans match your current criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPlans.map((plan) => (
                    <TableRow
                      key={plan.id}
                      onClick={() => handleOpenPlan(plan)}
                      className="cursor-pointer transition-colors hover:bg-muted/40 group"
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded border border-border bg-muted/80 px-1.5 py-0.2 font-mono text-[10px] font-bold text-foreground">
                              {plan.countryCode}
                            </span>
                            <span className="font-mono text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                              {plan.planRef}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                            {plan.quarter}
                          </Badge>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-bold text-foreground group-hover:text-primary transition-colors">{plan.procuringEntity}</p>
                          <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{plan.description}</p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="inline-flex rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          {plan.category}
                        </span>
                      </TableCell>

                      <TableCell className="font-mono text-xs text-foreground">
                        {plan.expectedPublication}
                      </TableCell>

                      <TableCell>
                        <span className="rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
                          {plan.procurementMethod}
                        </span>
                      </TableCell>

                      <TableCell className="text-right font-mono font-bold text-sm text-foreground">
                        {formatCurrency(plan.estimatedBudget, { noDecimals: true })}
                      </TableCell>

                      <TableCell className="text-right">
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
      </Card>

      <ProcurementPlanDetailDialog
        plan={selectedPlan}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </div>
  );
}
