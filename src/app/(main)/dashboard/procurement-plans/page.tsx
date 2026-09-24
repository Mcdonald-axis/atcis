"use client";

import { type KeyboardEvent, useCallback, useEffect, useState } from "react";

import { Download, Eye, FileSpreadsheet, RefreshCw, Search } from "lucide-react";

import { ProcurementPlanDetailDialog } from "@/components/procurement/procurement-plan-detail-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatCurrency } from "@/lib/utils";
import { AuthService } from "@/services/auth-service";
import { TenderApiService } from "@/services/tender-api";

import type { AdvanceProcurementPlan } from "../default/_components/tender-data";

export default function ProcurementPlansPage() {
  const [currentUser] = useState(() => AuthService.getCurrentUser());
  const isCountryAdmin =
    currentUser && currentUser.role !== "super_admin" && currentUser.country && currentUser.country !== "ALL";
  const userCountry: "ZW" | "ZM" | "ALL" = isCountryAdmin ? (currentUser.country as "ZW" | "ZM") : "ALL";

  const [plans, setPlans] = useState<AdvanceProcurementPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCountry, setFilterCountry] = useState<"ALL" | "ZW" | "ZM">(userCountry);
  const isSuperAdmin = currentUser?.role === "super_admin";
  const [selectedPlan, setSelectedPlan] = useState<AdvanceProcurementPlan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const effectiveCountry: "ALL" | "ZW" | "ZM" = isCountryAdmin ? userCountry : filterCountry;

  const loadPlans = useCallback(async () => {
    setIsLoading(true);
    try {
      const livePlans = await TenderApiService.getLiveProcurementPlans(effectiveCountry);
      setPlans(livePlans || []);
    } catch {
      setPlans([]);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveCountry]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const handleOpenPlan = (plan: AdvanceProcurementPlan) => {
    setSelectedPlan(plan);
    setIsDialogOpen(true);
  };

  const handlePlanKeyDown = (event: KeyboardEvent<HTMLElement>, plan: AdvanceProcurementPlan) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpenPlan(plan);
    }
  };

  const filtered = plans.filter((p) => {
    const matchCountry = effectiveCountry === "ALL" || p.countryCode === effectiveCountry;
    const matchSearch =
      p.procuringEntity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.planRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());

    return matchCountry && matchSearch;
  });

  const totalBudget = filtered.reduce((acc, p) => acc + p.estimatedBudget, 0);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/50 pb-5 md:flex-row md:items-center">
        <div className="min-w-0">
          <div className="flex flex-col items-start gap-2 min-[420px]:flex-row min-[420px]:items-center">
            <h1 className="font-bold text-xl tracking-tight text-foreground sm:text-3xl">Annual Procurement Plans</h1>
            <Badge variant="outline" className="font-mono text-xs">
              {plans.length} Gazetted Plans
            </Badge>
          </div>
          <p className="pt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Statutory pre-procurement pipeline published by ministries, state enterprises, and local authorities. Click
            any plan to view the full dossier.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 min-[480px]:flex-row md:w-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadPlans}
            disabled={isLoading}
            className="w-full text-xs min-[480px]:w-auto"
          >
            <RefreshCw data-icon="inline-start" className={isLoading ? "animate-spin" : undefined} />
            <span>Refresh</span>
          </Button>

          <Button variant="outline" size="sm" className="w-full text-xs min-[480px]:w-auto">
            <Download data-icon="inline-start" /> Export Schedule (CSV)
          </Button>
          <Button size="sm" className="w-full text-xs min-[480px]:w-auto">
            <FileSpreadsheet data-icon="inline-start" /> Import Annual Plan
          </Button>
        </div>
      </div>

      {/* Plans Table */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader>
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold">Advance Procurement Schedule</CardTitle>
              <CardDescription className="leading-relaxed">
                Identified future tenders before formal gazetting and portal publication. Click any plan to open its
                briefing dossier.
              </CardDescription>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <InputGroup className="w-full sm:min-w-64 lg:w-72">
                <InputGroupAddon>
                  <Search aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                  placeholder="Search entity, project description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-xs"
                />
              </InputGroup>

              {isSuperAdmin ? (
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  spacing={0}
                  value={filterCountry}
                  onValueChange={(value) => {
                    if (value === "ALL" || value === "ZW" || value === "ZM") {
                      setFilterCountry(value);
                    }
                  }}
                  aria-label="Filter procurement plans by market"
                  className="grid w-full grid-cols-3 sm:w-auto"
                >
                  <ToggleGroupItem value="ALL" className="min-w-0 px-2 text-xs">
                    All Markets
                  </ToggleGroupItem>
                  <ToggleGroupItem value="ZW" className="min-w-0 px-2 text-xs">
                    Zimbabwe
                  </ToggleGroupItem>
                  <ToggleGroupItem value="ZM" className="min-w-0 px-2 text-xs">
                    Zambia
                  </ToggleGroupItem>
                </ToggleGroup>
              ) : (
                <Badge variant="outline" className="h-8 justify-center gap-1.5 px-3 text-xs sm:justify-start">
                  <span className="font-mono font-bold text-primary text-[10px] uppercase">{filterCountry}</span>
                  {filterCountry === "ZW" ? "Zimbabwe" : "Zambia"}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 md:hidden">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
                <RefreshCw className="size-4 animate-spin text-primary" aria-hidden="true" />
                <span>Loading procurement plans...</span>
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No gazetted annual procurement plans found matching your criteria.
              </p>
            ) : (
              filtered.map((plan) => (
                <Card
                  key={plan.id}
                  size="sm"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenPlan(plan)}
                  onKeyDown={(event) => handlePlanKeyDown(event, plan)}
                  className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardDescription className="font-mono text-xs">{plan.planRef}</CardDescription>
                      <CardTitle className="mt-1 text-sm leading-snug">{plan.procuringEntity}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                      {plan.countryCode}
                    </Badge>
                  </CardHeader>

                  <CardContent className="flex flex-col items-start gap-3">
                    <div className="flex flex-col items-start gap-1.5">
                      <p className="line-clamp-2 text-sm leading-relaxed">{plan.description}</p>
                      <Badge variant="outline" className="max-w-full truncate text-[10px]">
                        {plan.category}
                      </Badge>
                    </div>

                    <div className="grid w-full grid-cols-2 gap-x-3 gap-y-2 border-t pt-3 text-xs">
                      <div className="min-w-0">
                        <p className="text-muted-foreground">Estimated budget</p>
                        <p className="truncate font-mono font-semibold">
                          {plan.estimatedBudget > 0
                            ? formatCurrency(plan.estimatedBudget, { noDecimals: true })
                            : "Subject to BoQ"}
                        </p>
                      </div>
                      <div className="min-w-0 text-right">
                        <p className="text-muted-foreground">Anticipated date</p>
                        <p className="truncate font-medium">{plan.expectedPublication}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-muted-foreground">Target quarter</p>
                        <p className="font-mono font-medium">{plan.quarter}</p>
                      </div>
                      <div className="min-w-0 text-right">
                        <p className="text-muted-foreground">Method</p>
                        <p className="truncate font-medium">{plan.procurementMethod}</p>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="justify-end gap-1 font-semibold text-primary text-xs">
                    View brief <Eye className="size-3.5" aria-hidden="true" />
                  </CardFooter>
                </Card>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto rounded-md border border-border/50 md:block">
            <Table>
              <TableHeader className="bg-muted/40 text-xs">
                <TableRow>
                  <TableHead>Plan Reference</TableHead>
                  <TableHead>Procuring Entity</TableHead>
                  <TableHead>Project Description & Category</TableHead>
                  <TableHead className="text-right">Estimated Budget</TableHead>
                  <TableHead>Anticipated Date</TableHead>
                  <TableHead>Target Quarter</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="size-4 animate-spin text-primary" />
                        <span>Loading gazetted annual procurement plans...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      No gazetted annual procurement plans found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((plan) => (
                    <TableRow
                      key={plan.id}
                      onClick={() => handleOpenPlan(plan)}
                      className="cursor-pointer transition-colors hover:bg-muted/40 group"
                    >
                      <TableCell className="font-mono font-medium text-foreground group-hover:text-primary transition-colors">
                        {plan.planRef}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded border border-border bg-muted px-1.5 py-0.2 font-mono text-[10px] font-semibold text-foreground">
                            {plan.countryCode}
                          </span>
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {plan.procuringEntity}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground line-clamp-1">{plan.description}</p>
                          <span className="inline-block rounded border border-border/50 bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">
                            {plan.category}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold tabular-nums text-foreground">
                        {plan.estimatedBudget > 0
                          ? formatCurrency(plan.estimatedBudget, { noDecimals: true })
                          : "Subject to BoQ"}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{plan.expectedPublication}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {plan.quarter}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{plan.procurementMethod}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs font-semibold">
                          <Eye data-icon="inline-start" /> View Brief
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

      <ProcurementPlanDetailDialog plan={selectedPlan} open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
}
