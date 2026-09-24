"use client";

import { useEffect, useMemo, useState } from "react";

import NextLink from "next/link";

import {
  Building2,
  Check,
  Clock,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  Package,
  PackageSearch,
  Phone,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Store,
  User,
} from "lucide-react";

import type { TenderItem, TenderLineItem } from "@/app/(main)/dashboard/default/_components/tender-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  extractSuggestedCapabilities,
  recommendSuppliers,
  type SupplierProfile,
  type SupplierRecommendation,
} from "@/lib/suppliers";

interface SupplierMatchResponse {
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

export interface MatchedSuppliersTabProps {
  tender: TenderItem;
  lineItems: TenderLineItem[];
  supplierProfiles: SupplierProfile[];
  onRequestRfq: (target: {
    item: {
      itemName: string;
      quantity: string;
      unit: string;
      specifications: string;
      complianceStandards: string;
    };
    supplier: {
      supplierName: string;
      contactEmail: string;
      contactPhone?: string;
      location?: string;
    };
  }) => void;
}

export function MatchedSuppliersTab({ tender, lineItems, supplierProfiles, onRequestRfq }: MatchedSuppliersTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [aiMatches, setAiMatches] = useState<SupplierRecommendation[] | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchProvider, setMatchProvider] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<SupplierProfile | null>(null);

  const requirementText = useMemo(
    () => lineItems.map((item) => `${item.description} ${item.specification}`).join(" "),
    [lineItems],
  );

  const directoryMatches: SupplierRecommendation[] = useMemo(() => {
    if (!tender) return [];
    return recommendSuppliers(tender, supplierProfiles, requirementText);
  }, [tender, supplierProfiles, requirementText]);

  useEffect(() => {
    const controller = new AbortController();
    setAiMatches(null);
    setMatchProvider("");
    setMatching(true);
    fetch("/api/suppliers/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tender, requirementText }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as SupplierMatchResponse;
        if (!response.ok || !result.success) throw new Error(result.error || "Supplier matching failed");
        const resolved = (result.matches || []).flatMap((match) => {
          if (!match.supplier?.id || match.supplier.id !== match.supplierId) return [];
          return [
            {
              supplier: match.supplier,
              score: match.score,
              reasons: match.reasons || [],
              matchedCapabilities: match.matchedCapabilities || [],
              source: match.source || "directory",
            },
          ];
        });
        setAiMatches(resolved);
        setMatchProvider(result.model || result.provider || "Evidence rules");
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === "AbortError")) {
          setAiMatches(directoryMatches);
          setMatchProvider("Evidence rules fallback");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setMatching(false);
      });
    return () => controller.abort();
  }, [directoryMatches, requirementText, tender]);

  const allMatches = aiMatches ?? directoryMatches;

  const filteredMatches = useMemo(() => {
    if (!searchQuery.trim()) return allMatches;
    const q = searchQuery.toLowerCase().trim();
    return allMatches.filter(({ supplier, matchedCapabilities }) => {
      const haystack = [
        supplier.name,
        supplier.city,
        supplier.countryName,
        supplier.summary,
        ...supplier.sectors,
        ...supplier.capabilities,
        ...matchedCapabilities,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [allMatches, searchQuery]);

  const suggestedCapabilities = useMemo(() => {
    return extractSuggestedCapabilities(tender);
  }, [tender]);

  const handleCreateRfqForSupplier = (match: SupplierRecommendation) => {
    const specs =
      lineItems.length > 0
        ? lineItems
            .map((li) => `${li.itemNumber}: ${li.description} — ${li.specification} (Qty: ${li.quantity} ${li.unit})`)
            .join("\n")
        : tender.description || tender.title;

    onRequestRfq({
      item: {
        itemName: tender.title,
        quantity: lineItems.length > 0 ? `${lineItems.length} items` : "1",
        unit: lineItems.length > 0 ? "BoQ Package" : "Lot",
        specifications: specs,
        complianceStandards: tender.category || "Official Statutory Procurement Standards",
      },
      supplier: {
        supplierName: match.supplier.name,
        contactEmail: match.supplier.email,
        contactPhone: match.supplier.phone,
        location: `${match.supplier.city}, ${match.supplier.countryName}`,
      },
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card p-4 sm:p-6 min-w-0">
      {/* Top Banner Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border/60 min-w-0">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Store className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <h3 className="font-bold text-base sm:text-lg text-foreground">Matched Sourcing Suppliers</h3>
            <Badge
              variant="outline"
              className="text-xs font-mono border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
            >
              {allMatches.length} {allMatches.length === 1 ? "Supplier Match" : "Suppliers Matched"}
            </Badge>
            {matching && <Badge variant="secondary">AI matching…</Badge>}
            {!matching && matchProvider && <Badge variant="secondary">{matchProvider}</Badge>}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Country-local directory suppliers plus source-reviewed international candidates, ranked from this
            tender&apos;s requirements.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" asChild className="h-8 text-xs gap-1.5 border-border/70">
            <NextLink href={`/dashboard/suppliers?tender=${encodeURIComponent(tender.id)}`} target="_blank">
              <Building2 className="size-3.5" />
              <span>Open Suppliers Directory</span>
              <ExternalLink className="size-3 opacity-60" />
            </NextLink>
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar (if there are matches) */}
      {allMatches.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by supplier name, city, or goods..."
              className="h-8 text-xs pl-8 bg-muted/30"
            />
          </div>
          <span className="text-[11px] text-muted-foreground self-center sm:self-auto font-mono">
            Showing {filteredMatches.length} of {allMatches.length} matching{" "}
            {allMatches.length === 1 ? "vendor" : "vendors"}
          </span>
        </div>
      )}

      {/* Empty State: When no matching suppliers found */}
      {allMatches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/15 p-6 sm:p-8 text-center space-y-4">
          <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
            <PackageSearch className="size-6" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h4 className="font-semibold text-sm sm:text-base text-foreground">
              No evidence-based supplier match found
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              No country-local directory supplier or source-reviewed international candidate matches the required goods
              for <strong className="text-foreground">&ldquo;{tender.title}&rdquo;</strong> (
              {tender.countryCode === "ZM" ? "Zambia" : tender.countryCode === "ZW" ? "Zimbabwe" : "Regional"}).
            </p>
          </div>

          {/* Sourcing Suggestion Box */}
          {suggestedCapabilities.length > 0 && (
            <div className="max-w-md mx-auto p-3 rounded-lg border border-border/60 bg-card text-left space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="size-3.5 text-emerald-500 shrink-0" />
                <span>Suggested goods &amp; capability tags to match this tender:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestedCapabilities.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-[11px] font-mono bg-muted/40 text-foreground border-border/70"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                When you add a supplier profile with any of these capabilities on the Suppliers page, it will
                automatically be considered for this tender.
              </p>
            </div>
          )}

          <div className="pt-2">
            <Button size="sm" asChild className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5">
              <NextLink href={`/dashboard/suppliers?tender=${encodeURIComponent(tender.id)}`} target="_blank">
                <Plus className="size-3.5" />
                Add Supplier on Suppliers Page
              </NextLink>
            </Button>
          </div>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">No suppliers match your search query</p>
          <p className="text-xs text-muted-foreground">Try clearing or adjusting your search terms.</p>
          <Button size="sm" variant="outline" onClick={() => setSearchQuery("")} className="h-7 text-xs mt-2">
            Clear Search
          </Button>
        </div>
      ) : (
        /* Grid of Matching Supplier Cards */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 pt-1">
          {filteredMatches.map((match, idx) => {
            const { supplier, score, matchedCapabilities } = match;
            const countryBadge =
              supplier.countryCode === "ZM"
                ? "🇿🇲 Zambia"
                : supplier.countryCode === "ZW"
                  ? "🇿🇼 Zimbabwe"
                  : "🌍 International";
            const scoreColor =
              score >= 85
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : score >= 70
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";

            return (
              <div
                key={supplier.id || idx}
                className="rounded-xl border border-border/70 bg-card p-4 space-y-3.5 flex flex-col justify-between shadow-2xs hover:border-emerald-500/40 hover:shadow-xs transition-all"
              >
                {/* Header: Name, Score & Country */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-sm sm:text-base text-foreground leading-tight">
                          {supplier.name}
                        </h4>
                        {supplier.verificationStatus && (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] px-1.5 py-0 h-4">
                            {supplier.verificationStatus}
                          </Badge>
                        )}
                        {match.source === "suggestion" && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            International suggestion
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <MapPin className="size-3 shrink-0 text-muted-foreground" />
                        <span>
                          {supplier.city}, {countryBadge}
                        </span>
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className={`px-2 py-0.5 rounded-full font-mono text-xs font-bold border ${scoreColor}`}>
                        {score}% Match
                      </span>
                    </div>
                  </div>

                  {/* Summary */}
                  {supplier.summary && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{supplier.summary}</p>
                  )}

                  {match.reasons.length > 0 && (
                    <div className="space-y-1 rounded-md bg-muted/35 p-2 text-[11px] text-muted-foreground">
                      {match.reasons.slice(0, 2).map((reason) => (
                        <p key={reason} className="flex items-start gap-1.5">
                          <Sparkles className="mt-0.5 size-3 shrink-0 text-emerald-500" />
                          <span>{reason}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Matched Capabilities / Goods Tags */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Package className="size-3 text-emerald-600 dark:text-emerald-400" />
                      Matched Goods &amp; Capabilities ({matchedCapabilities.length}):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {matchedCapabilities.map((cap) => (
                        <Badge
                          key={cap}
                          className="bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] py-0 px-2"
                        >
                          <Check className="size-2.5 mr-1" />
                          {cap}
                        </Badge>
                      ))}
                      {supplier.capabilities
                        .filter((cap) => !matchedCapabilities.includes(cap))
                        .slice(0, 3)
                        .map((cap) => (
                          <Badge
                            key={cap}
                            variant="outline"
                            className="text-[10px] text-muted-foreground border-border/60 py-0"
                          >
                            {cap}
                          </Badge>
                        ))}
                    </div>
                  </div>

                  {/* Key Procurement Details Row */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-border/40">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="size-3 shrink-0" />
                      <span className="truncate">Lead: {supplier.leadTime || "Confirm with supplier"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <ShieldCheck className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="truncate">{supplier.procurementRegistration || "Statutory compliance"}</span>
                    </div>
                  </div>

                  {/* Contact Info Row */}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap pt-0.5">
                    {supplier.contactPerson && (
                      <span className="flex items-center gap-1">
                        <User className="size-3 shrink-0" />
                        {supplier.contactPerson}
                      </span>
                    )}
                    {supplier.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3 shrink-0" />
                        <span className="truncate max-w-[140px] sm:max-w-[180px]">{supplier.email}</span>
                      </span>
                    )}
                    {supplier.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3 shrink-0" />
                        <span>{supplier.phone}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center gap-2 pt-2.5 border-t border-border/60">
                  {match.source === "directory" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs shrink-0"
                      aria-haspopup="dialog"
                      onClick={() => setSelectedProfile(supplier)}
                    >
                      <Building2 className="size-3 mr-1" /> Profile
                    </Button>
                  )}

                  {supplier.email ? (
                    <Button
                      size="sm"
                      onClick={() => handleCreateRfqForSupplier(match)}
                      className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 shadow-2xs"
                    >
                      <Send className="size-3" /> Request Quote (RFQ)
                    </Button>
                  ) : supplier.website ? (
                    <Button size="sm" asChild className="flex-1 h-8 text-xs gap-1.5">
                      <a href={supplier.website} target="_blank" rel="noreferrer">
                        <Globe2 className="size-3" /> Verify availability on official site
                      </a>
                    </Button>
                  ) : null}

                  {supplier.email && (
                    <Button size="sm" variant="outline" asChild className="h-8 text-xs px-2.5">
                      <a
                        href={`mailto:${supplier.email}?subject=${encodeURIComponent(`RFQ / Sourcing Inquiry - ${tender.title} (Ref: ${tender.refNo})`)}&body=${encodeURIComponent(`Dear ${supplier.name} Sales Team,\n\nWe are preparing a quotation submission for "${tender.title}" (Ref: ${tender.refNo}) issued by ${tender.procuringEntity}.\n\nBased on your registered capabilities in ${matchedCapabilities.join(", ")}, please provide your availability, lead time, and quotation for these goods.\n\nBest regards,\nProcurement Department`)}`}
                        title={`Email ${supplier.email}`}
                      >
                        <Mail className="size-3.5" />
                      </a>
                    </Button>
                  )}

                  {supplier.phone && (
                    <Button size="sm" variant="outline" asChild className="h-8 text-xs px-2.5">
                      <a href={`tel:${supplier.phone}`} title={`Call ${supplier.phone}`}>
                        <Phone className="size-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={Boolean(selectedProfile)}
        onOpenChange={(open) => {
          if (!open) setSelectedProfile(null);
        }}
      >
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          {selectedProfile && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3 pr-8">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="size-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <DialogTitle>{selectedProfile.name}</DialogTitle>
                    <DialogDescription>
                      {selectedProfile.city}, {selectedProfile.countryName} · {selectedProfile.countryCode}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-muted-foreground">{selectedProfile.summary}</p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 rounded-lg border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Capabilities</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProfile.capabilities.map((capability) => (
                        <Badge key={capability} variant="secondary">
                          {capability}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Procurement readiness
                    </p>
                    <p className="text-sm font-medium">{selectedProfile.procurementRegistration}</p>
                    <p className="text-xs text-muted-foreground">
                      Profile source: {selectedProfile.verificationStatus}. Confirm statutory registration before award.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sectors</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProfile.sectors.map((sector) => (
                      <Badge key={sector} variant="outline">
                        {sector}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border p-4 text-sm">
                  <p className="font-medium">Contact</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground">
                    {selectedProfile.contactPerson && (
                      <span className="inline-flex items-center gap-1.5">
                        <User className="size-4" /> {selectedProfile.contactPerson}
                      </span>
                    )}
                    {selectedProfile.email && (
                      <a
                        className="inline-flex items-center gap-1.5 hover:text-foreground"
                        href={`mailto:${selectedProfile.email}`}
                      >
                        <Mail className="size-4" /> {selectedProfile.email}
                      </a>
                    )}
                    {selectedProfile.phone && (
                      <a
                        className="inline-flex items-center gap-1.5 hover:text-foreground"
                        href={`tel:${selectedProfile.phone}`}
                      >
                        <Phone className="size-4" /> {selectedProfile.phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                {selectedProfile.website && (
                  <Button asChild size="sm" variant="outline">
                    <a href={selectedProfile.website} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-3.5" /> Visit company website
                    </a>
                  </Button>
                )}
                <Button type="button" size="sm" onClick={() => setSelectedProfile(null)}>
                  Close profile
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
