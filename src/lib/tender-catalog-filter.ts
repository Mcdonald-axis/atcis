import type { CountryScope, TenderItem } from "@/app/(main)/dashboard/default/_components/tender-data";
import { classifyTenderSector } from "@/lib/tender-mapping";

export interface TenderCatalogFilters {
  countryFilter: CountryScope;
  categoryFilter: string;
  statusFilter: string;
  portalFilter: string;
  aiConfidenceFilter: string;
  focusModeOnly: boolean;
  searchTerm: string;
  sortOrder: string;
}

export function filterTenderCatalog(tendersList: TenderItem[], filters: TenderCatalogFilters): TenderItem[] {
  const {
    countryFilter,
    categoryFilter,
    statusFilter,
    portalFilter,
    aiConfidenceFilter,
    focusModeOnly,
    searchTerm,
    sortOrder,
  } = filters;
  const normalizedTenders = tendersList.map((tender) => {
    if (tender.classificationSource) return tender;
    const classification = classifyTenderSector({
      title: tender.title,
      description: tender.description,
      category: tender.category,
    });
    if (tender.sector === classification.sector && tender.aiScore === classification.aiScore) return tender;
    return {
      ...tender,
      sector: classification.sector,
      aiScore: classification.aiScore,
      classificationSource: classification.classificationSource,
      classificationConfidence: classification.classificationConfidence,
      classificationEvidence: classification.classificationEvidence,
      classificationReason: classification.classificationReason,
      focusEligible: classification.focusEligible,
      needsClassificationReview: classification.needsClassificationReview,
    };
  });

  const list = normalizedTenders.filter((t) => {
    const matchCountry =
      countryFilter === "ALL" || t.countryCode === countryFilter || t.countryCode === ("ALL" as string);

    const matchCategory =
      categoryFilter === "ALL" ||
      t.sector?.toLowerCase().includes(categoryFilter.toLowerCase()) ||
      t.category?.toLowerCase().includes(categoryFilter.toLowerCase());

    const matchStatus = statusFilter === "ALL" || t.status === statusFilter;

    const matchPortal =
      portalFilter === "ALL" ||
      (t.sourcePortal &&
        (() => {
          const sp = t.sourcePortal.toLowerCase();
          const pf = portalFilter.toLowerCase();
          if (pf === "ungm" || pf === "un") {
            return (
              sp.includes("ungm") ||
              sp.includes("un ") ||
              sp.includes("united nations") ||
              sp.includes("undp") ||
              sp.includes("unicef")
            );
          }
          if (pf === "world bank" || pf === "worldbank") {
            return sp.includes("world bank") || sp.includes("worldbank");
          }
          if (pf === "onlinetenders") {
            return sp.includes("online");
          }
          if (pf === "praz") {
            return sp.includes("praz");
          }
          if (pf === "zppa") {
            return sp.includes("zppa");
          }
          if (pf === "afdb") {
            return sp.includes("afdb") || sp.includes("african development");
          }
          if (pf === "gozambia" || pf === "gozambiajobs") {
            return sp.includes("gozambia");
          }
          return sp.includes(pf);
        })());

    const matchAiConfidence =
      aiConfidenceFilter === "ALL" ||
      (aiConfidenceFilter === "HIGH" && t.aiScore >= 88) ||
      (aiConfidenceFilter === "TOP" && t.aiScore >= 92);

    const matchFocus = !focusModeOnly || (t.focusEligible === true && !t.needsClassificationReview);

    const query = searchTerm.toLowerCase().trim();
    const matchSearch =
      !query ||
      t.title.toLowerCase().includes(query) ||
      t.refNo.toLowerCase().includes(query) ||
      t.procuringEntity.toLowerCase().includes(query) ||
      t.sourcePortal?.toLowerCase().includes(query) ||
      t.sector?.toLowerCase().includes(query) ||
      t.category?.toLowerCase().includes(query);

    return (
      matchCountry && matchCategory && matchStatus && matchPortal && matchAiConfidence && matchSearch && matchFocus
    );
  });

  const sorted = [...list].sort((a, b) => {
    if (sortOrder === "CLOSING_SOON") {
      const aOpen = a.daysRemaining > 0;
      const bOpen = b.daysRemaining > 0;
      if (aOpen && !bOpen) return -1;
      if (!aOpen && bOpen) return 1;
      if (aOpen && bOpen) return a.daysRemaining - b.daysRemaining;
      return (b.closingDate || "").localeCompare(a.closingDate || "");
    }
    if (sortOrder === "NEWEST") {
      return (b.publishDate || "").localeCompare(a.publishDate || "");
    }
    if (sortOrder === "HIGHEST_SCORE") {
      return b.aiScore - a.aiScore;
    }
    if (sortOrder === "PORTAL_ORDER" || portalFilter.toLowerCase().includes("online")) {
      const orderA = typeof a.siteOrder === "number" ? a.siteOrder : 999999;
      const orderB = typeof b.siteOrder === "number" ? b.siteOrder : 999999;
      if (orderA !== orderB) return orderA - orderB;
    }

    // Default: "PRIORITY" (Official National Portals & Active Bidding First)
    // 1. Demote completed / historical contract awards below active open tenders
    const isAwardA = a.title.toLowerCase().includes("contract award") || a.title.toLowerCase().includes("attribution");
    const isAwardB = b.title.toLowerCase().includes("contract award") || b.title.toLowerCase().includes("attribution");
    if (!isAwardA && isAwardB) return -1;
    if (isAwardA && !isAwardB) return 1;

    // 2. Active open tenders before closed
    const aOpen = a.daysRemaining > 0 || a.status === "Open" || a.status === "Closing Soon";
    const bOpen = b.daysRemaining > 0 || b.status === "Open" || b.status === "Closing Soon";
    if (aOpen && !bOpen) return -1;
    if (!aOpen && bOpen) return 1;

    // 3. Official Zimbabwe National Portals (PRAZ e-GP, OnlineTenders, UNGM) first
    const getPortalRank = (t: TenderItem) => {
      const p = (t.sourcePortal || "").toLowerCase();
      if (p.includes("praz")) return 1;
      if (p.includes("online")) return 2;
      if (p.includes("ungm") || p.includes("un ")) return 3;
      if (p.includes("world")) return 4;
      if (p.includes("zppa")) return 5;
      if (p.includes("afdb")) return 6;
      return 7;
    };
    const rankA = getPortalRank(a);
    const rankB = getPortalRank(b);
    if (rankA !== rankB) return rankA - rankB;

    // 4. Within OnlineTenders, preserve official page order
    if (typeof a.siteOrder === "number" && typeof b.siteOrder === "number") {
      return a.siteOrder - b.siteOrder;
    }

    // 5. Within same portal, upcoming closing deadline
    if (a.daysRemaining > 0 && b.daysRemaining > 0) {
      return a.daysRemaining - b.daysRemaining;
    }

    return (b.publishDate || "").localeCompare(a.publishDate || "");
  });

  return sorted;
}
