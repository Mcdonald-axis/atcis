import type {
  TenderClassificationSource,
  TenderItem,
  TenderSector,
} from "@/app/(main)/dashboard/default/_components/tender-data";

const keywordPatterns = new Map<string, RegExp>();

export interface TenderClassificationInput {
  title?: unknown;
  scope?: unknown;
  description?: unknown;
  category?: unknown;
  categoryNames?: unknown;
  categoryCodes?: unknown;
  lineItems?: unknown;
}

export interface TenderClassificationDecision {
  sector: TenderSector;
  displayCategory: string;
  aiScore: number;
  classificationSource: TenderClassificationSource;
  classificationConfidence: number;
  classificationEvidence: string[];
  classificationReason: string;
  focusEligible: boolean;
  needsClassificationReview: boolean;
}

function tenderText(raw: TenderClassificationInput): string {
  const lineItems = Array.isArray(raw.lineItems)
    ? raw.lineItems.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [String(item || "")];
        const line = item as Record<string, unknown>;
        return [line.description, line.specification].filter(Boolean).map(String);
      })
    : [];
  return [raw.title, raw.scope, raw.description, ...lineItems].filter(Boolean).join("\n");
}

function calculateDaysRemaining(closingDateStr?: string): number {
  if (!closingDateStr) return 0;
  try {
    const closing = new Date(closingDateStr);
    const now = new Date();
    const diffTime = closing.getTime() - now.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  } catch {
    return 0;
  }
}

function hasKeyword(text: string, kw: string): boolean {
  const cached = keywordPatterns.get(kw);
  if (cached) return cached.test(text);
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const optionalPlural = !kw.includes(" ") && !kw.endsWith("s") ? "s?" : "";
  const pattern = new RegExp(`\\b${escaped}${optionalPlural}\\b`, "i");
  keywordPatterns.set(kw, pattern);
  return pattern.test(text);
}

export function classifyTenderSector(raw: TenderClassificationInput): TenderClassificationDecision {
  // Strictly check procurement requirement subject matter (Title, Scope, Description, Gazetted Categories)
  // DO NOT include procuringEntity (e.g. POTRAZ buying catering is Catering, NOT ICT)
  const titleText = String(raw.title || "").toLowerCase();
  const detailText = tenderText({
    scope: raw.scope,
    description: raw.description,
    lineItems: raw.lineItems,
  }).toLowerCase();

  // Corporate Strategic Core Profile: IT & Healthcare Enterprise
  // 1. Core Priority: ICT & Software Keywords
  const ictKeywords = [
    "ict",
    "software",
    "laptop",
    "laptops",
    "computer",
    "computers",
    "computer hardware",
    "network hardware",
    "server",
    "servers",
    "networking",
    "printer",
    "printers",
    "toner",
    "toners",
    "photocopier",
    "scanner",
    "cctv",
    "biometric",
    "access control",
    "cloud",
    "license",
    "licenses",
    "database",
    "cybersecurity",
    "telecom",
    "internet",
    "erp",
    "oracle",
    "microsoft",
    "sap",
    "website",
    "software application",
    "mobile app",
    "firewall",
    "switch 24 port",
    "24 port-upoe",
    "poe switch",
    "cisco",
    "data center",
    "systems integration",
    "it support",
    "digital",
    "workstation",
    "software suite",
    "automation software",
    "process automation",
    "model automation",
    "automation",
    "fiber optic",
    "opgw",
    "voip",
    "bandwidth",
    "structured cabling",
    "network upgrade",
    "apple developer",
    "developer account",
  ];

  // 2. Core Priority: Healthcare & Medical Keywords
  const healthcareKeywords = [
    "surgical",
    "surgicals",
    "medical",
    "pharmaceutical",
    "pharmaceuticals",
    "medicine",
    "medicines",
    "drug",
    "drugs",
    "hospital",
    "clinical",
    "biomedical",
    "laboratory consumables",
    "lab consumables",
    "reagent",
    "reagents",
    "medical ppe",
    "bandage",
    "bandages",
    "syringe",
    "syringes",
    "dental",
    "x-ray",
    "radiology",
    "ultrasound",
    "patient monitor",
    "dialysis",
    "autoclave",
    "surgical gloves",
    "gauze",
    "stethoscope",
    "prosthetic",
    "orthopaedic",
    "medical consumables",
    "hospital consumables",
    "medicines and drugs",
    "medical gases",
    "oxygen concentrator",
    "clinical waste",
    "hospital linen",
    "medical supplies",
    "hospital supplies",
    "diagnostic",
    "test kits",
    "catheter",
    "medical equipment",
    "healthcare equipment",
    "disinfectant",
    "disinfectants",
    "health informatics",
    "medical devices",
    "blood pressure",
    "thermometer",
    "pharma",
    "spine board",
  ];

  // 3. Secondary/Supporting: Electrical & Power (Data center/hospital power)
  const electricalKeywords = [
    "switchgear",
    "transformer",
    "transformers",
    "substation",
    "solar",
    "solar mini-grid",
    "power supply",
    "overhead line",
    "feeder line",
    "inverter",
    "inverters",
    "generator",
    "generators",
    "high voltage",
    "distribution board",
    "circuit breaker",
    "electrician",
    "grid upgrade",
    "power distribution",
    "switchgear panels",
    "smart metering",
    "ups",
    "power transmission",
    "electromechanical equipment",
  ];

  // 4. Non-Core: Motor Vehicles, Spares & Transport Fleet
  const motorSparesKeywords = [
    "motor vehicle spares",
    "vehicle spares",
    "spares",
    "spare parts",
    "motor vehicle",
    "motor vehicles",
    "vehicle repair",
    "automotive",
    "tyres",
    "tires",
    "clutch",
    "brake pads",
    "battery",
    "fleet",
    "transport",
    "freight",
    "courier",
    "haulage",
    "car hire",
    "mechanic",
    "tractor",
    "panel beating",
    "service of vehicles",
    "lubricants",
    "engine oil",
    "fuel",
    "diesel",
    "petrol",
    "vehicle",
    "vehicles",
    "minibus",
    "truck",
    "automotive",
  ];

  // 5. Non-Core: Services & Facilities (Catering, Security, Cleaning, Audit)
  const servicesKeywords = [
    "catering",
    "catering service",
    "catering services",
    "lunch",
    "refreshments",
    "guarding",
    "security services",
    "security guard",
    "consultancy",
    "consulting",
    "audit",
    "cleaning services",
    "pest control",
    "waste collection",
    "maintenance services",
    "picture frames",
    "picture frame",
    "event management",
    "launch event",
    "consultant",
    "advisor",
    "advisory",
    "evaluation",
    "assessment",
    "review",
    "survey",
    "capacity building",
    "editing",
    "translation",
    "resource mobilization",
  ];

  // 6. Non-Core: General Goods & Consumables (Mutton cloth, Stationery, Groceries)
  const generalGoodsKeywords = [
    "mutton cloth",
    "stationery",
    "paper",
    "office supplies",
    "toiletries",
    "sanitary products",
    "cold meats",
    "groceries",
    "provisions",
    "detergent",
    "detergents",
    "cleaning materials",
    "tools and hardware",
    "hardware",
    "furniture",
    "linen",
    "uniforms",
    "protective clothing",
    "soap",
    "tissue paper",
    "food",
    "catering supplies",
    "dromex",
    "work gloves",
    "safety gloves",
    "dust mask",
    "mist mask",
    "dust and mist masks",
    "industrial ppe",
    "home economics equipment",
    "kitchen equipment",
    "agricultural inputs",
    "farming inputs",
    "fertilizer",
    "seed supply",
    "livestock",
    "animal feed",
    "building materials",
    "furniture",
    "banner",
    "printing services",
    "air conditioner",
    "pipes and fittings",
    "weather equipment",
    "forensic laboratory",
    "laboratory furniture",
    "laboratory cupboards",
  ];

  // 7. Non-Core: Civil & Infrastructure
  const civilKeywords = [
    "highway",
    "road",
    "roads",
    "dualization",
    "civil",
    "construction",
    "granite",
    "granite tops",
    "cupboards with granite",
    "laboratory cupboards",
    "building works",
    "plumbing",
    "borehole",
    "roofing",
    "concrete",
    "drainage",
    "earthworks",
    "paving",
    "fencing",
    "civil works",
    "structural",
    "refurbishment",
    "renovation",
    "bitumen",
    "asphalt",
    "cement",
    "bridge",
    "consolidation works",
  ];

  const evidenceScore = (keywords: string[]) => {
    const count = (text: string) => keywords.reduce((total, keyword) => total + Number(hasKeyword(text, keyword)), 0);
    return count(titleText) * 8 + count(detailText) * 3;
  };

  const ictScore = evidenceScore(ictKeywords);
  const healthScore = evidenceScore(healthcareKeywords);
  const electricalScore = evidenceScore(electricalKeywords);
  let civilScore = evidenceScore(civilKeywords);
  const generalScore = evidenceScore(generalGoodsKeywords);
  let servicesScore = evidenceScore(servicesKeywords) + evidenceScore(motorSparesKeywords);

  // Construction verbs in the title describe the procured work and outweigh an
  // incidental institution/category reference such as hospital, ICT or hardware.
  if (
    ["construction", "civil works", "building works", "bridge", "road", "renovation"].some((keyword) =>
      hasKeyword(titleText, keyword),
    )
  ) {
    civilScore += 12;
  }
  if (
    [
      "consultancy",
      "consulting",
      "consultant",
      "advisor",
      "audit",
      "evaluation",
      "assessment",
      "review",
      "survey",
      "feasibility",
      "technical assistance",
      "training",
    ].some((keyword) => hasKeyword(titleText, keyword))
  ) {
    servicesScore += 12;
  }

  const ranked = [
    { key: "ict", score: ictScore },
    { key: "health", score: healthScore },
    { key: "electrical", score: electricalScore },
    { key: "civil", score: civilScore },
    { key: "general", score: generalScore },
    { key: "services", score: servicesScore },
  ].sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const secondScore = ranked[1]?.score || 0;
  const keywordGroups: Record<string, string[]> = {
    ict: ictKeywords,
    health: healthcareKeywords,
    electrical: electricalKeywords,
    civil: civilKeywords,
    general: generalGoodsKeywords,
    services: [...servicesKeywords, ...motorSparesKeywords],
  };
  const sourceText = tenderText(raw);
  const sourceTextLower = sourceText.toLowerCase();
  const evidence = (keywordGroups[top.key] || [])
    .filter((keyword) => hasKeyword(sourceTextLower, keyword))
    .map((keyword) => {
      const index = sourceTextLower.indexOf(keyword.toLowerCase());
      return index >= 0 ? sourceText.slice(index, index + keyword.length) : keyword;
    })
    .filter((value, index, values) => values.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index)
    .slice(0, 5);
  const titleEvidenceCount = (keywordGroups[top.key] || []).filter((keyword) => hasKeyword(titleText, keyword)).length;
  const scoreMargin = top.score - secondScore;
  const isConclusive = top.score > 0 && titleEvidenceCount > 0 && scoreMargin >= 4;
  let confidence = 20;
  if (top.score > 0) {
    confidence = isConclusive
      ? Math.min(98, 78 + Math.min(12, titleEvidenceCount * 6) + Math.min(8, scoreMargin))
      : Math.min(69, 45 + Math.min(16, top.score) + Math.min(8, Math.max(0, scoreMargin)));
  }

  const definitions: Record<string, { sector: TenderSector; category: string }> = {
    ict: {
      sector: "ICT & Software",
      category: healthScore > 0 ? "Health Informatics & MedTech" : "ICT & Software Solutions",
    },
    health: { sector: "Healthcare & Medical", category: "Healthcare & Medical Systems" },
    electrical: { sector: "Electrical & Energy", category: "Electrical & Power Infrastructure" },
    civil: { sector: "Civil & Infrastructure", category: "Civil Works & Infrastructure" },
    general: { sector: "General Goods & Consumables", category: "General Goods, Agriculture & Supplies" },
    services: { sector: "Services & Logistics", category: "Professional, Fleet & Logistics Services" },
  };
  const definition =
    top.score > 0
      ? definitions[top.key]
      : {
          sector: "Other" as const,
          category: "Needs Classification Review",
        };
  const focusSector = definition.sector === "ICT & Software" || definition.sector === "Healthcare & Medical";
  let classificationReason = "No reliable sector evidence was found in the saved tender text.";
  if (top.score > 0) {
    classificationReason = isConclusive
      ? `The title contains direct ${definition.sector} procurement evidence.`
      : "The available evidence is incomplete or overlaps multiple sectors; AI validation is required.";
  }

  return {
    sector: definition.sector,
    displayCategory: definition.category,
    aiScore: confidence,
    classificationSource: "rules",
    classificationConfidence: confidence,
    classificationEvidence: evidence,
    classificationReason,
    focusEligible: focusSector && isConclusive,
    needsClassificationReview: !isConclusive,
  };
}

export function isIctHealthFocusTender(tender: TenderItem): boolean {
  if (typeof tender.focusEligible === "boolean") {
    return tender.focusEligible && !tender.needsClassificationReview;
  }
  const classification = classifyTenderSector({
    title: tender.title,
    description: tender.description,
    category: tender.category,
  });
  return classification.focusEligible;
}

function isTenderSector(value: unknown): value is TenderSector {
  return [
    "ICT & Software",
    "Healthcare & Medical",
    "Electrical & Energy",
    "Civil & Infrastructure",
    "General Goods & Consumables",
    "Services & Logistics",
    "Other",
  ].includes(String(value));
}

function savedClassification(
  value: unknown,
  fallback: TenderClassificationDecision,
): TenderClassificationDecision | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const saved = value as Record<string, unknown>;
  if (!isTenderSector(saved.sector)) return null;
  const confidence = Number(saved.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) return null;
  let source: TenderClassificationSource | null = null;
  if (saved.source === "manual" || saved.source === "ai") source = saved.source;
  if (!source) return null;
  const focusSector = saved.sector === "ICT & Software" || saved.sector === "Healthcare & Medical";
  const needsReview = saved.needsReview === true || confidence < 80;
  return {
    sector: saved.sector,
    displayCategory:
      typeof saved.subcategory === "string" && saved.subcategory.trim()
        ? saved.subcategory.trim()
        : fallback.displayCategory,
    aiScore: confidence,
    classificationSource: source,
    classificationConfidence: confidence,
    classificationEvidence: Array.isArray(saved.evidence)
      ? saved.evidence.filter((item): item is string => typeof item === "string").slice(0, 5)
      : [],
    classificationReason:
      typeof saved.reason === "string" && saved.reason.trim() ? saved.reason.trim() : fallback.classificationReason,
    focusEligible: focusSector && !needsReview && saved.focusEligible === true,
    needsClassificationReview: needsReview,
  };
}

export function mapRawTenderToItem(raw: any, index: number): TenderItem {
  const countryRaw = String(raw.country || raw.countryCode || "")
    .toUpperCase()
    .trim();
  const rawId = (raw.id || "").toString().toLowerCase();
  const rawSource = (raw.source || raw.sourcePortal || raw.portal || "").toLowerCase();
  const rawUrl = (raw.detailsUrl || raw.sourceUrl || "").toLowerCase();

  const isZambia =
    countryRaw === "ZM" ||
    countryRaw.includes("ZAM") ||
    rawId.startsWith("zppa:") ||
    rawId.startsWith("gozambiajobs:") ||
    rawSource.includes("zppa") ||
    rawSource.includes("gozambia") ||
    rawUrl.includes("zppa.org.zm") ||
    rawUrl.includes("gozambiajobs.com");

  const isZimbabwe =
    countryRaw === "ZW" ||
    countryRaw.includes("ZIM") ||
    rawId.startsWith("praz:") ||
    rawId.startsWith("onlinetenders:") ||
    rawSource.includes("praz") ||
    rawUrl.includes("praz.org.zw") ||
    rawUrl.includes("onlinetenders.co.za/tenders/zimbabwe");

  const isMultilateral =
    countryRaw === "ALL" ||
    countryRaw === "INTL" ||
    countryRaw === "GLOBAL" ||
    rawSource === "unprocurement" ||
    rawSource === "ungm" ||
    rawSource === "afdb" ||
    rawSource === "worldbank" ||
    rawSource.includes("world bank") ||
    rawSource.includes("eufunding") ||
    rawUrl.includes("un.org/procurement") ||
    rawUrl.includes("ungm.org") ||
    rawUrl.includes("worldbank.org") ||
    rawUrl.includes("afdb.org");

  const countryCode = isZambia ? "ZM" : isZimbabwe ? "ZW" : isMultilateral ? "ALL" : "ZW";
  const countryName = isZambia
    ? "Zambia"
    : isZimbabwe
      ? "Zimbabwe"
      : isMultilateral
        ? "Regional / Multilateral"
        : "Zimbabwe";

  const closingDate = raw.closingDate ? raw.closingDate.slice(0, 10) : "";
  const publishDate = raw.publishDate ? raw.publishDate.slice(0, 10) : "";
  const daysRemaining = calculateDaysRemaining(raw.closingDate);

  const rulesClassification = classifyTenderSector(raw);
  const classification = savedClassification(raw.classificationDecision, rulesClassification) ?? rulesClassification;
  const {
    sector,
    displayCategory,
    aiScore,
    classificationSource,
    classificationConfidence,
    classificationEvidence,
    classificationReason,
    focusEligible,
    needsClassificationReview,
  } = classification;

  let portalName = isZambia ? "ZPPA e-Procurement" : isMultilateral ? "Multilateral Development Portal" : "PRAZ e-GP";
  let portalUrl = isZambia
    ? "https://eprocure.zppa.org.zm"
    : "https://egp.praz.org.zw/index?url=egp-SW5kZXhlcy9pbmRleA%3D%3D";

  // 1. OnlineTenders (Aggregator)
  if (rawId.startsWith("onlinetenders:") || rawSource.includes("online") || rawUrl.includes("onlinetenders")) {
    portalName = isZambia ? "OnlineTenders Zambia" : "OnlineTenders Zimbabwe";
    portalUrl =
      raw.sourceUrl ||
      (isZambia
        ? "https://www.onlinetenders.co.za/tenders/zambia"
        : "https://www.onlinetenders.co.za/tenders/zimbabwe");
  }
  // 2. UN Global Procurement & UNGM
  else if (
    rawId.startsWith("ungm:") ||
    rawId.startsWith("unprocurement:") ||
    rawSource === "ungm" ||
    rawSource === "unprocurement" ||
    rawSource.includes("ungm") ||
    rawUrl.includes("un.org/procurement") ||
    rawUrl.includes("ungm.org") ||
    raw.procuringEntity?.toLowerCase().includes("united nations")
  ) {
    portalName = "UN Global Marketplace (UNGM)";
    portalUrl = raw.portalUrl || raw.detailsUrl || raw.sourceUrl || "https://www.ungm.org/Public/Notice";
  }
  // 3. World Bank
  else if (
    rawId.startsWith("worldbank:") ||
    rawSource.includes("worldbank") ||
    rawSource.includes("world bank") ||
    rawUrl.includes("worldbank.org")
  ) {
    portalName = "World Bank";
    const wbId =
      raw.tenderId ||
      (raw.source_id ? raw.source_id.split("-").pop() : "") ||
      (raw.id ? raw.id.split(":").pop() : "") ||
      "";
    portalUrl =
      raw.portalUrl ||
      raw.detailsUrl ||
      raw.sourceUrl ||
      (wbId
        ? `https://projects.worldbank.org/en/projects-operations/procurement-detail/${wbId}`
        : "https://projects.worldbank.org/en/projects-operations/procurement-notices");
  }
  // 4. African Development Bank
  else if (rawId.startsWith("afdb:") || rawSource.includes("afdb") || rawUrl.includes("afdb.org")) {
    portalName = "AfDB";
    portalUrl = raw.sourceUrl || "https://www.afdb.org/en/projects-and-operations/procurement";
  }
  // 5. GoZambiaJobs
  else if (rawId.startsWith("gozambiajobs:") || rawSource.includes("gozambia") || rawUrl.includes("gozambiajobs.com")) {
    portalName = "GoZambiaJobs";
    portalUrl = raw.sourceUrl || "https://gozambiajobs.com/tenders";
  }
  // 6. ZPPA Zambia
  else if (rawId.startsWith("zppa:") || isZambia || rawSource.includes("zppa") || rawUrl.includes("zppa.org.zm")) {
    portalName = "ZPPA e-Procurement";
    portalUrl =
      raw.sourceUrl ||
      (raw.tenderId
        ? `https://eprocure.zppa.org.zm/epps/cft/prepareViewCfTWS.do?resourceId=${encodeURIComponent(raw.tenderId)}`
        : "https://eprocure.zppa.org.zm");
  }
  // 7. EU Funding
  else if (rawId.startsWith("eufunding:") || rawSource.includes("eu")) {
    portalName = "EU Funding & Tenders";
    portalUrl =
      raw.sourceUrl ||
      "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/tender-search";
  }
  // 8. PRAZ e-GP (Official Zimbabwe Government Portal)
  else if (rawId.startsWith("praz:") || rawSource.includes("praz") || rawUrl.includes("praz.org.zw")) {
    portalName = "PRAZ e-GP";
    const cleanId = (raw.source_id || raw.tenderId || raw.id || "").toString().replace("praz:", "");
    portalUrl =
      raw.detailsUrl ||
      (cleanId && cleanId.length >= 3
        ? `https://egp.praz.org.zw/Indexes/viewLiveTenderDetails/${cleanId}`
        : "https://egp.praz.org.zw/index?url=egp-SW5kZXhlcy9pbmRleA%3D%3D");
  } else {
    if (isZambia) {
      portalName = "ZPPA e-Procurement";
      portalUrl = "https://eprocure.zppa.org.zm";
    } else if (isMultilateral) {
      portalName = "Multilateral Development Portal";
      portalUrl = raw.sourceUrl || raw.detailsUrl || "#";
    } else {
      portalName = "PRAZ e-GP";
      portalUrl = "https://egp.praz.org.zw/index?url=egp-SW5kZXhlcy9pbmRleA%3D%3D";
    }
  }

  return {
    id: raw.id ? raw.id.toString() : `live-${index}`,
    refNo: raw.referenceNumber || raw.refNo || raw.tenderId || (raw.id ? `TEN-${raw.id}` : `REF-${index + 1}`),
    title: raw.title || "Procurement Notice",
    procuringEntity: raw.procuringEntity || raw.entity || "Procuring Entity",
    countryCode,
    countryName,
    category: displayCategory,
    sector,
    estimatedValue: raw.estimatedValue || raw.contractValue || 0,
    currency: raw.currency || "USD",
    publishDate,
    closingDate,
    daysRemaining,
    aiScore: aiScore,
    classificationSource,
    classificationConfidence,
    classificationEvidence,
    classificationReason,
    focusEligible,
    needsClassificationReview,
    status: daysRemaining <= 3 && daysRemaining > 0 ? "Closing Soon" : "Open",
    sourcePortal: portalName,
    portalUrl: portalUrl,
    description: raw.description || raw.scope,
    procurementMethod: raw.procurementMethod || raw.procurementType,
    siteOrder: typeof raw.siteOrder === "number" ? raw.siteOrder : undefined,
    lineItems: raw.lineItems,
    documents: raw.documents || [],
    contact: raw.contact || raw.contactInfo,
    projectId: raw.projectId || raw.project_id,
    projectTitle: raw.projectTitle || raw.project_name,
    procurementType: raw.procurementType || raw.notice_type,
    tenderId: raw.tenderId || raw.id,
    noticeAtAGlance: raw.noticeAtAGlance,
    contactInfo: raw.contactInfo,
    noticeTextHtml: raw.noticeTextHtml || raw.notice_text,
    noticeStatus: raw.noticeStatus || raw.notice_status,
    noticeLang: raw.noticeLang || raw.notice_lang_name,
    submissionDeadlineTime: raw.submissionDeadlineTime || raw.submission_deadline_time,
  };
}
