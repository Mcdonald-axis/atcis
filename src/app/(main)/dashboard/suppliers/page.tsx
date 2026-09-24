"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Bot,
  Building2,
  CheckCircle2,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import type { TenderItem } from "@/app/(main)/dashboard/default/_components/tender-data";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAppRecords } from "@/hooks/use-app-records";
import {
  mergeSupplierProfiles,
  recommendSuppliers,
  type SupplierProfile,
  type SupplierRecommendation,
} from "@/lib/suppliers";
import { createClientId } from "@/lib/utils";
import { AuthService } from "@/services/auth-service";
import { TenderApiService } from "@/services/tender-api";

type CountryFilter = "ALL" | "ZW" | "ZM";

interface MatchResponse {
  success: boolean;
  matches?: Array<{
    supplierId: string;
    supplier: SupplierProfile;
    score: number;
    reasons: string[];
    matchedCapabilities: string[];
    source: SupplierRecommendation["source"];
  }>;
  provider?: string;
  model?: string;
  error?: string;
}

interface SupplierFormState {
  name: string;
  countryCode: "" | "ZW" | "ZM";
  city: string;
  summary: string;
  sectors: string;
  capabilities: string;
  brands: string;
  certifications: string;
  procurementRegistration: string;
  contactPerson: string;
  email: string;
  phone: string;
  website: string;
  leadTime: string;
}

function emptySupplierForm(country: CountryFilter): SupplierFormState {
  const countryCode = country === "ZW" || country === "ZM" ? country : "";
  return {
    name: "",
    countryCode,
    city: "",
    summary: "",
    sectors: "",
    capabilities: "",
    brands: "",
    certifications: "",
    procurementRegistration: countryCode === "ZM" ? "ZPPA verification required" : "PRAZ verification required",
    contactPerson: "",
    email: "",
    phone: "",
    website: "",
    leadTime: "Confirm with supplier",
  };
}

function commaList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function countryLabel(country: CountryFilter) {
  if (country === "ZM") return "Zambia";
  if (country === "ZW") return "Zimbabwe";
  return "Zambia & Zimbabwe";
}

export default function SuppliersPage() {
  const savedSuppliers = useAppRecords<SupplierProfile>("supplier");
  const [currentUser, setCurrentUser] = useState(() => AuthService.getCurrentUser());
  const [scopeReady, setScopeReady] = useState(false);
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [tenders, setTenders] = useState<TenderItem[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<SupplierProfile | null>(null);
  const [aiMatches, setAiMatches] = useState<SupplierRecommendation[]>([]);
  const [matching, setMatching] = useState(false);
  const [matchProvider, setMatchProvider] = useState("");
  const [createdSuppliers, setCreatedSuppliers] = useState<SupplierProfile[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState<SupplierFormState>(() => emptySupplierForm("ALL"));
  const [formError, setFormError] = useState("");
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<SupplierProfile | null>(null);
  const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("atcis_deleted_suppliers");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const isCountryBound = Boolean(currentUser && currentUser.role !== "super_admin" && currentUser.country !== "ALL");
  const canDeleteSupplierProfiles =
    currentUser?.role === "country_admin" || currentUser?.role === "super_admin";
  const effectiveCountry: CountryFilter = isCountryBound
    ? currentUser?.country === "ZM"
      ? "ZM"
      : "ZW"
    : countryFilter;
  const allSuppliers = useMemo(() => {
    const merged = mergeSupplierProfiles([...savedSuppliers, ...createdSuppliers]);
    return merged.filter((s) => !deletedIds.includes(s.id));
  }, [createdSuppliers, deletedIds, savedSuppliers]);

  useEffect(() => {
    const sync = () => {
      const user = AuthService.getCurrentUser();
      setCurrentUser(user);
      if (user?.role !== "super_admin" && (user?.country === "ZW" || user?.country === "ZM")) {
        setCountryFilter(user.country);
      }
      setScopeReady(true);
    };
    sync();
    window.addEventListener("atcis-auth-changed", sync);
    return () => window.removeEventListener("atcis-auth-changed", sync);
  }, []);

  useEffect(() => {
    if (!scopeReady) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ country: effectiveCountry, page: "1", pageSize: "100" });
    TenderApiService.getTenderPage(params, controller.signal)
      .then((result) => setTenders(result.data))
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === "AbortError")) {
          toast.error("Could not load tenders for supplier matching.");
        }
      });
    return () => controller.abort();
  }, [effectiveCountry, scopeReady]);

  useEffect(() => {
    if (!scopeReady) return;
    const params = new URLSearchParams(window.location.search);
    const supplierId = params.get("supplier");
    const tenderId = params.get("tender");
    if (supplierId) {
      setSelectedProfile(
        allSuppliers.find(
          (supplier) =>
            supplier.id === supplierId && (effectiveCountry === "ALL" || supplier.countryCode === effectiveCountry),
        ) || null,
      );
    }
    if (tenderId) setSelectedTenderId(tenderId);
  }, [allSuppliers, effectiveCountry, scopeReady]);

  const selectedTender = useMemo(
    () => tenders.find((tender) => tender.id === selectedTenderId) || null,
    [selectedTenderId, tenders],
  );

  const visibleSuppliers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!scopeReady) return [];
    return allSuppliers.filter((supplier) => {
      if (effectiveCountry !== "ALL" && supplier.countryCode !== effectiveCountry) return false;
      if (!query) return true;
      return [supplier.name, supplier.city, supplier.summary, ...supplier.sectors, ...supplier.capabilities]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [allSuppliers, effectiveCountry, scopeReady, searchTerm]);

  useEffect(() => {
    if (!selectedTender) {
      setAiMatches([]);
      setMatchProvider("");
      return;
    }

    const controller = new AbortController();
    const localMatches = recommendSuppliers(selectedTender, allSuppliers);
    setAiMatches(localMatches);
    setMatching(true);
    fetch("/api/suppliers/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tender: selectedTender }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as MatchResponse;
        if (!response.ok || !result.success) throw new Error(result.error || "Supplier matching failed");
        const resolved = (result.matches || []).flatMap((match) => {
          if (!match.supplier?.id || match.supplier.id !== match.supplierId) return [];
          return [{
            supplier: match.supplier,
            score: match.score,
            reasons: match.reasons,
            matchedCapabilities: match.matchedCapabilities || [],
            source: match.source || "directory",
          }];
        });
        if (resolved.length) setAiMatches(resolved);
        setMatchProvider(result.model || result.provider || "Rules engine");
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === "AbortError")) setMatchProvider("Explainable rules fallback");
      })
      .finally(() => {
        if (!controller.signal.aborted) setMatching(false);
      });
    return () => controller.abort();
  }, [allSuppliers, selectedTender]);

  const openProfile = (supplier: SupplierProfile) => {
    setSelectedProfile(supplier);
    const params = new URLSearchParams(window.location.search);
    params.set("supplier", supplier.id);
    if (selectedTender) params.set("tender", selectedTender.id);
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  };

  const closeProfile = () => {
    setSelectedProfile(null);
    const params = new URLSearchParams(window.location.search);
    params.delete("supplier");
    window.history.replaceState(
      null,
      "",
      params.size ? `${window.location.pathname}?${params}` : window.location.pathname,
    );
  };

  const openAddSupplier = () => {
    const initialCountry = effectiveCountry === "ZW" || effectiveCountry === "ZM" ? effectiveCountry : "ALL";
    setSupplierForm(emptySupplierForm(initialCountry));
    setFormError("");
    setAddDialogOpen(true);
  };

  const updateSupplierField = (field: keyof SupplierFormState, value: string) => {
    setSupplierForm((current) => {
      if (field !== "countryCode") return { ...current, [field]: value };
      return {
        ...current,
        countryCode: value as SupplierFormState["countryCode"],
        procurementRegistration: value === "ZM" ? "ZPPA verification required" : "PRAZ verification required",
      };
    });
  };

  const saveSupplier = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser) {
      setFormError("Sign in before adding a supplier.");
      return;
    }

    const capabilities = commaList(supplierForm.capabilities);
    const sectors = commaList(supplierForm.sectors);
    if (!supplierForm.name.trim() || !supplierForm.city.trim() || !supplierForm.summary.trim()) {
      setFormError("Company name, city and company summary are required.");
      return;
    }
    if (supplierForm.countryCode !== "ZW" && supplierForm.countryCode !== "ZM") {
      setFormError("Choose Zambia or Zimbabwe for this supplier.");
      return;
    }
    if (isCountryBound && supplierForm.countryCode !== effectiveCountry) {
      setFormError("You can only add suppliers in your assigned country.");
      return;
    }
    if (!sectors.length || !capabilities.length) {
      setFormError("Add at least one sector and one capability so tenders can be matched.");
      return;
    }

    const countryCode = supplierForm.countryCode;
    const supplier: SupplierProfile = {
      id: `supplier-${countryCode.toLowerCase()}-${createClientId()}`,
      name: supplierForm.name.trim(),
      countryCode,
      countryName: countryCode === "ZM" ? "Zambia" : "Zimbabwe",
      city: supplierForm.city.trim(),
      summary: supplierForm.summary.trim(),
      sectors,
      capabilities,
      brands: commaList(supplierForm.brands),
      certifications: commaList(supplierForm.certifications),
      procurementRegistration:
        supplierForm.procurementRegistration.trim() ||
        `${countryCode === "ZM" ? "ZPPA" : "PRAZ"} verification required`,
      verificationStatus: "Pending review",
      contactPerson: supplierForm.contactPerson.trim() || "Supplier contact",
      email: supplierForm.email.trim(),
      phone: supplierForm.phone.trim(),
      website: supplierForm.website.trim() || undefined,
      leadTime: supplierForm.leadTime.trim() || "Confirm with supplier",
      status: "Active",
      updatedAt: new Date().toISOString(),
      createdByEmail: currentUser.email,
      createdByName: currentUser.name,
    };

    setSavingSupplier(true);
    setFormError("");
    try {
      const response = await fetch("/api/records/supplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplier),
      });
      const result = (await response.json()) as { success?: boolean; data?: SupplierProfile; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || "Could not save the supplier profile.");
      const saved = result.data || supplier;
      setCreatedSuppliers((current) => [...current.filter((item) => item.id !== saved.id), saved]);
      setAddDialogOpen(false);
      setSupplierForm(emptySupplierForm(effectiveCountry));
      toast.success(`${saved.name} was added to the supplier directory.`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save the supplier profile.");
    } finally {
      setSavingSupplier(false);
    }
  };

  const handleDeleteSupplier = async (supplier: SupplierProfile) => {
    if (!canDeleteSupplierProfiles) {
      toast.error("Administrator access is required to delete supplier profiles.");
      return;
    }

    setDeletingSupplierId(supplier.id);
    try {
      const response = await fetch(
        `/api/records/supplier?id=${encodeURIComponent(supplier.id)}&country=${encodeURIComponent(supplier.countryCode)}`,
        {
          method: "DELETE",
        },
      );
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not delete supplier profile.");
      }

      setDeletedIds((prev) => {
        const next = [...new Set([...prev, supplier.id])];
        try {
          localStorage.setItem("atcis_deleted_suppliers", JSON.stringify(next));
        } catch {}
        return next;
      });

      setCreatedSuppliers((prev) => prev.filter((s) => s.id !== supplier.id));

      if (selectedProfile?.id === supplier.id) {
        closeProfile();
      }
      setSupplierToDelete(null);
      toast.success("Supplier deleted successfully", {
        description: `${supplier.name} has been removed from the directory.`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete supplier profile.");
    } finally {
      setDeletingSupplierId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PackageSearch />
            </div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Supplier Intelligence</h1>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Country-scoped supplier profiles and AI-assisted tender matching for {countryLabel(effectiveCountry)}.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={openAddSupplier}>
            <Plus data-icon="inline-start" />
            Add supplier
          </Button>
          {!isCountryBound && (
            <Select value={countryFilter} onValueChange={(value) => setCountryFilter(value as CountryFilter)}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Filter supplier country">
                <Globe2 />
                <SelectValue placeholder="Choose country" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="ALL">Both countries</SelectItem>
                  <SelectItem value="ZM">Zambia</SelectItem>
                  <SelectItem value="ZW">Zimbabwe</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
          <InputGroup className="sm:w-72">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search supplier or capability"
              aria-label="Search suppliers"
            />
          </InputGroup>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles /> Match suppliers to a tender
          </CardTitle>
          <CardDescription>
            AI ranks suppliers from the tender&apos;s country and source-reviewed international candidates using the
            tender requirements.
          </CardDescription>
          {matchProvider && (
            <CardAction>
              <Badge variant="secondary">{matchProvider}</Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Select value={selectedTenderId} onValueChange={setSelectedTenderId}>
            <SelectTrigger className="w-full" aria-label="Select a tender for supplier matching">
              <SelectValue placeholder="Select a tender" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {tenders.map((tender) => (
                  <SelectItem key={tender.id} value={tender.id}>
                    {tender.refNo} — {tender.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {selectedTender && (
            <div className="flex flex-col gap-3 rounded-lg bg-muted/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{selectedTender.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedTender.refNo} · {selectedTender.countryName}
                  </p>
                </div>
                <Badge variant="outline">
                  <Bot /> {matching ? "AI matching…" : `${aiMatches.length} suggestions`}
                </Badge>
              </div>
              {aiMatches.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {aiMatches.map((match) => (
                    <button
                      key={match.supplier.id}
                      type="button"
                      onClick={() => {
                        if (match.source === "suggestion" && match.supplier.website) {
                          window.open(match.supplier.website, "_blank", "noopener,noreferrer");
                          return;
                        }
                        openProfile(match.supplier);
                      }}
                      className={`flex flex-col gap-3 rounded-lg border bg-card p-4 text-left transition-colors
                        hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none
                        focus-visible:ring-3 focus-visible:ring-ring/50`}
                    >
                      <div className="flex w-full items-start justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="flex flex-wrap items-center gap-1.5 font-medium">
                            {match.supplier.name}
                            {match.source === "suggestion" && <Badge variant="outline">International suggestion</Badge>}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {match.supplier.city}, {match.supplier.countryName}
                          </span>
                        </div>
                        <Badge>{match.score}% fit</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {match.reasons.slice(0, 2).map((reason) => (
                          <Badge key={reason} variant="secondary">
                            {reason}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              ) : !matching ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <PackageSearch />
                    </EmptyMedia>
                    <EmptyTitle>No evidence-based supplier match found</EmptyTitle>
                    <EmptyDescription>
                      Add a supplier with matching capabilities or expand the tender&apos;s requirement details.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">Supplier profiles</h2>
          <p className="text-sm text-muted-foreground">
            {visibleSuppliers.length} profiles visible in your jurisdiction
          </p>
        </div>
        <Badge variant="outline">
          <ShieldCheck /> Country access enforced
        </Badge>
      </div>

      {visibleSuppliers.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleSuppliers.map((supplier) => (
            <Card key={supplier.id} size="sm">
              <CardHeader>
                <CardTitle>{supplier.name}</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <MapPin /> {supplier.city}, {supplier.countryName}
                </CardDescription>
                <CardAction>
                  <div className="flex items-center gap-1.5">
                    {supplier.createdByEmail?.toLowerCase() === currentUser?.email.toLowerCase() && (
                      <Badge variant="secondary">Added by you</Badge>
                    )}
                    <Badge variant="outline">{supplier.countryCode}</Badge>
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <p className="line-clamp-3 text-sm text-muted-foreground">{supplier.summary}</p>
                <div className="flex flex-wrap gap-1.5">
                  {supplier.capabilities.slice(0, 4).map((capability) => (
                    <Badge key={capability} variant="secondary">
                      {capability}
                    </Badge>
                  ))}
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2 /> {supplier.verificationStatus}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setSupplierToDelete(supplier)}
                      title={`Delete ${supplier.name}`}
                    >
                      <Trash2 className="size-3.5" />
                      <span className="sr-only">Delete {supplier.name}</span>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openProfile(supplier)}>
                      View profile
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>No supplier profiles found</EmptyTitle>
            <EmptyDescription>Try a different capability or country filter.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          if (!savingSupplier) setAddDialogOpen(open);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <form className="flex flex-col gap-5" onSubmit={saveSupplier}>
            <DialogHeader>
              <DialogTitle>Add supplier profile</DialogTitle>
              <DialogDescription>
                Add a supplier from your country. Its capabilities will immediately be considered for tender matching.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(formError && !supplierForm.name.trim())}>
                <FieldLabel htmlFor="supplier-name">Company name</FieldLabel>
                <Input
                  id="supplier-name"
                  value={supplierForm.name}
                  onChange={(event) => updateSupplierField("name", event.target.value)}
                  maxLength={160}
                  required
                  aria-invalid={Boolean(formError && !supplierForm.name.trim())}
                  placeholder="Supplier company name"
                />
              </Field>

              <Field data-invalid={Boolean(formError && !supplierForm.countryCode)}>
                <FieldLabel htmlFor="supplier-country">Country</FieldLabel>
                <Select
                  value={supplierForm.countryCode}
                  onValueChange={(value) => updateSupplierField("countryCode", value)}
                  disabled={isCountryBound}
                >
                  <SelectTrigger
                    id="supplier-country"
                    className="w-full"
                    aria-invalid={Boolean(formError && !supplierForm.countryCode)}
                  >
                    <SelectValue placeholder="Choose supplier country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="ZM">Zambia</SelectItem>
                      <SelectItem value="ZW">Zimbabwe</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {isCountryBound && <FieldDescription>Locked to your assigned country.</FieldDescription>}
              </Field>

              <Field data-invalid={Boolean(formError && !supplierForm.city.trim())}>
                <FieldLabel htmlFor="supplier-city">City</FieldLabel>
                <Input
                  id="supplier-city"
                  value={supplierForm.city}
                  onChange={(event) => updateSupplierField("city", event.target.value)}
                  maxLength={120}
                  required
                  aria-invalid={Boolean(formError && !supplierForm.city.trim())}
                  placeholder="Lusaka or Harare"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="supplier-contact">Contact person</FieldLabel>
                <Input
                  id="supplier-contact"
                  value={supplierForm.contactPerson}
                  onChange={(event) => updateSupplierField("contactPerson", event.target.value)}
                  maxLength={160}
                  placeholder="Name or sales team"
                />
              </Field>

              <Field className="sm:col-span-2" data-invalid={Boolean(formError && !supplierForm.summary.trim())}>
                <FieldLabel htmlFor="supplier-summary">Company summary</FieldLabel>
                <Textarea
                  id="supplier-summary"
                  value={supplierForm.summary}
                  onChange={(event) => updateSupplierField("summary", event.target.value)}
                  maxLength={1200}
                  required
                  aria-invalid={Boolean(formError && !supplierForm.summary.trim())}
                  placeholder="What the supplier provides and the type of projects it supports"
                />
              </Field>

              <Field
                className="sm:col-span-2"
                data-invalid={Boolean(formError && !commaList(supplierForm.sectors).length)}
              >
                <FieldLabel htmlFor="supplier-sectors">Sectors</FieldLabel>
                <Input
                  id="supplier-sectors"
                  value={supplierForm.sectors}
                  onChange={(event) => updateSupplierField("sectors", event.target.value)}
                  maxLength={600}
                  required
                  aria-invalid={Boolean(formError && !commaList(supplierForm.sectors).length)}
                  placeholder="ICT & Software, Telecommunications"
                />
                <FieldDescription>Separate multiple sectors with commas.</FieldDescription>
              </Field>

              <Field
                className="sm:col-span-2"
                data-invalid={Boolean(formError && !commaList(supplierForm.capabilities).length)}
              >
                <FieldLabel htmlFor="supplier-capabilities">Products and capabilities</FieldLabel>
                <Textarea
                  id="supplier-capabilities"
                  value={supplierForm.capabilities}
                  onChange={(event) => updateSupplierField("capabilities", event.target.value)}
                  maxLength={1600}
                  required
                  aria-invalid={Boolean(formError && !commaList(supplierForm.capabilities).length)}
                  placeholder="Fibre internet, satellite connectivity, managed networks"
                />
                <FieldDescription>
                  Use clear comma-separated phrases. These are the main signals used for tender matching.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="supplier-brands">Brands</FieldLabel>
                <Input
                  id="supplier-brands"
                  value={supplierForm.brands}
                  onChange={(event) => updateSupplierField("brands", event.target.value)}
                  maxLength={600}
                  placeholder="Optional, comma separated"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="supplier-certifications">Certifications</FieldLabel>
                <Input
                  id="supplier-certifications"
                  value={supplierForm.certifications}
                  onChange={(event) => updateSupplierField("certifications", event.target.value)}
                  maxLength={600}
                  placeholder="Optional, comma separated"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="supplier-email">Email</FieldLabel>
                <Input
                  id="supplier-email"
                  type="email"
                  value={supplierForm.email}
                  onChange={(event) => updateSupplierField("email", event.target.value)}
                  maxLength={254}
                  placeholder="sales@supplier.com"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="supplier-phone">Phone</FieldLabel>
                <Input
                  id="supplier-phone"
                  type="tel"
                  value={supplierForm.phone}
                  onChange={(event) => updateSupplierField("phone", event.target.value)}
                  maxLength={60}
                  placeholder="+260 or +263"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="supplier-website">Website</FieldLabel>
                <Input
                  id="supplier-website"
                  type="url"
                  value={supplierForm.website}
                  onChange={(event) => updateSupplierField("website", event.target.value)}
                  maxLength={500}
                  placeholder="https://supplier.example"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="supplier-lead-time">Typical lead time</FieldLabel>
                <Input
                  id="supplier-lead-time"
                  value={supplierForm.leadTime}
                  onChange={(event) => updateSupplierField("leadTime", event.target.value)}
                  maxLength={160}
                  placeholder="Confirm with supplier"
                />
              </Field>

              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="supplier-registration">Procurement registration</FieldLabel>
                <Input
                  id="supplier-registration"
                  value={supplierForm.procurementRegistration}
                  onChange={(event) => updateSupplierField("procurementRegistration", event.target.value)}
                  maxLength={300}
                />
                <FieldDescription>
                  New profiles remain pending review until their PRAZ or ZPPA registration is confirmed.
                </FieldDescription>
              </Field>
            </FieldGroup>

            {formError && <FieldError>{formError}</FieldError>}

            <DialogFooter>
              <Button type="button" variant="outline" disabled={savingSupplier} onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingSupplier}>
                {savingSupplier && <Spinner data-icon="inline-start" />}
                {savingSupplier ? "Saving supplier…" : "Save supplier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedProfile)}
        onOpenChange={(open) => {
          if (!open) closeProfile();
        }}
      >
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          {selectedProfile && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3 pr-8">
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-lg
                      bg-primary/10 text-primary`}
                  >
                    <Building2 />
                  </div>
                  <div className="flex flex-col gap-1">
                    <DialogTitle>{selectedProfile.name}</DialogTitle>
                    <DialogDescription>
                      {selectedProfile.city}, {selectedProfile.countryName} · {selectedProfile.countryCode}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="flex flex-col gap-5">
                <p className="text-sm text-muted-foreground">{selectedProfile.summary}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2 rounded-lg border p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Capabilities</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProfile.capabilities.map((capability) => (
                        <Badge key={capability} variant="secondary">
                          {capability}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 rounded-lg border p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Procurement readiness
                    </p>
                    <p className="text-sm font-medium">{selectedProfile.procurementRegistration}</p>
                    <p className="text-xs text-muted-foreground">
                      Company source: {selectedProfile.verificationStatus}. Confirm statutory registration before award.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
                  <p className="font-medium">Contact</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground">
                    {selectedProfile.email && (
                      <a
                        className="flex items-center gap-1 hover:text-foreground"
                        href={`mailto:${selectedProfile.email}`}
                      >
                        <Mail /> {selectedProfile.email}
                      </a>
                    )}
                    {selectedProfile.phone && (
                      <a
                        className="flex items-center gap-1 hover:text-foreground"
                        href={`tel:${selectedProfile.phone}`}
                      >
                        <Phone /> {selectedProfile.phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 w-full">
                {canDeleteSupplierProfiles && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      const prof = selectedProfile;
                      closeProfile();
                      setSupplierToDelete(prof);
                    }}
                  >
                    <Trash2 data-icon="inline-start" />
                    Delete supplier
                  </Button>
                )}
                <div className="flex items-center gap-2 justify-end">
                  {selectedProfile.website && (
                    <Button asChild size="sm" variant="outline">
                      <a href={selectedProfile.website} target="_blank" rel="noreferrer">
                        <ExternalLink data-icon="inline-start" /> Visit company website
                      </a>
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="outline" onClick={closeProfile}>
                    Close
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(supplierToDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingSupplierId) setSupplierToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 />
              Delete supplier profile?
            </AlertDialogTitle>
            <AlertDialogDescription className="flex flex-col gap-2 text-sm">
              <span>
                Are you sure you want to delete{" "}
                <strong className="text-foreground">{supplierToDelete?.name}</strong>?
              </span>
              <span className="text-xs text-muted-foreground">
                This supplier will be removed from your directory and will no longer match with tenders in{" "}
                {supplierToDelete?.countryName || "your jurisdiction"}.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingSupplierId)}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={Boolean(deletingSupplierId)}
              onClick={() => {
                if (supplierToDelete) handleDeleteSupplier(supplierToDelete);
              }}
            >
              {deletingSupplierId ? <Spinner data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
              {deletingSupplierId ? "Deleting…" : "Delete supplier"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
