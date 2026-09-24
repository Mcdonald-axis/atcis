import type { TenderItem } from "@/app/(main)/dashboard/default/_components/tender-data";

export type LocalSupplierCountry = "ZW" | "ZM";
export type SupplierCountry = LocalSupplierCountry | "INTL";

export interface SupplierProfile {
  id: string;
  name: string;
  countryCode: SupplierCountry;
  countryName: string;
  city: string;
  summary: string;
  sectors: string[];
  capabilities: string[];
  brands: string[];
  certifications: string[];
  procurementRegistration: string;
  verificationStatus: "Source reviewed" | "Pending review";
  sourceUrl?: string;
  contactPerson: string;
  email: string;
  phone: string;
  website?: string;
  leadTime: string;
  status: "Active" | "Inactive";
  /** Suggestions are source-reviewed candidates and are not directory records. */
  listingType?: "directory" | "suggestion";
  coverageCountries?: LocalSupplierCountry[];
  updatedAt?: string;
  createdByEmail?: string;
  createdByName?: string;
}

export interface SupplierRecommendation {
  supplier: SupplierProfile;
  score: number;
  reasons: string[];
  matchedCapabilities: string[];
  source: "directory" | "suggestion";
}

/**
 * Starter profiles are backed by the companies' own country or corporate pages.
 * A reviewed website is not evidence of ZPPA/PRAZ registration, so procurement
 * registration is deliberately kept as a separate, unverified field.
 */
export const STARTER_SUPPLIERS: SupplierProfile[] = [
  {
    id: "zm-liquid-intelligent-technologies",
    name: "Liquid Intelligent Technologies Zambia",
    countryCode: "ZM",
    countryName: "Zambia",
    city: "Lusaka",
    summary:
      "Enterprise connectivity and digital infrastructure provider with a Zambia office and fibre network services.",
    sectors: ["ICT & Software", "Telecommunications"],
    capabilities: [
      "fibre internet",
      "enterprise connectivity",
      "cloud",
      "cyber security",
      "data centre",
      "managed networks",
    ],
    brands: ["Liquid Intelligent Technologies"],
    certifications: [],
    procurementRegistration: "ZPPA verification required",
    verificationStatus: "Source reviewed",
    sourceUrl: "https://liquid.tech/local-offices/country/zambia/",
    contactPerson: "Zambia sales team",
    email: "support@liquid.tech",
    phone: "+260 211 255 106",
    website: "https://liquid.tech/local-offices/country/zambia/",
    leadTime: "Confirm against scope",
    status: "Active",
  },
  {
    id: "zm-paratus-zambia",
    name: "Paratus Zambia",
    countryCode: "ZM",
    countryName: "Zambia",
    city: "Lusaka",
    summary:
      "Licensed telecommunications provider offering connectivity, satellite and managed network services in Zambia.",
    sectors: ["ICT & Software", "Telecommunications"],
    capabilities: [
      "satellite internet",
      "starlink",
      "fibre internet",
      "wireless connectivity",
      "managed networks",
      "telecommunications",
    ],
    brands: ["Paratus", "Starlink"],
    certifications: [],
    procurementRegistration: "ZPPA verification required",
    verificationStatus: "Source reviewed",
    sourceUrl: "https://paratus.africa/zambia/about-us/",
    contactPerson: "Zambia sales team",
    email: "support.zm@paratus.africa",
    phone: "+260 96 555 6489",
    website: "https://paratus.africa/zambia/",
    leadTime: "Confirm against site survey",
    status: "Active",
  },
  {
    id: "zm-davis-shirtliff",
    name: "Davis & Shirtliff Zambia",
    countryCode: "ZM",
    countryName: "Zambia",
    city: "Lusaka",
    summary: [
      "Water and energy equipment supplier covering pumps, boreholes, treatment,",
      "irrigation, generators and solar solutions.",
    ].join(" "),
    sectors: ["Civil & Infrastructure", "Electrical & Energy", "Water & Sanitation"],
    capabilities: [
      "water pumps",
      "boreholes",
      "water treatment",
      "irrigation",
      "solar power",
      "generators",
      "swimming pools",
    ],
    brands: ["Dayliff"],
    certifications: [],
    procurementRegistration: "ZPPA verification required",
    verificationStatus: "Source reviewed",
    sourceUrl: "https://www.davisandshirtliff.com/zambia/about-us",
    contactPerson: "Zambia sales team",
    email: "lusaka@dayliff.com",
    phone: "+260 211 252 721",
    website: "https://www.davisandshirtliff.com/zambia/",
    leadTime: "Confirm stock and installation scope",
    status: "Active",
  },
  {
    id: "zw-cafca",
    name: "CAFCA Limited",
    countryCode: "ZW",
    countryName: "Zimbabwe",
    city: "Harare",
    summary: [
      "Zimbabwe cable manufacturer supplying electrical conductors and cable products",
      "for energy and infrastructure projects.",
    ].join(" "),
    sectors: ["Electrical & Energy", "Civil & Infrastructure"],
    capabilities: [
      "electrical cables",
      "power cables",
      "conductors",
      "building wire",
      "mining cable",
      "telecommunications cable",
    ],
    brands: ["CAFCA"],
    certifications: [],
    procurementRegistration: "PRAZ verification required",
    verificationStatus: "Source reviewed",
    sourceUrl: "https://www.cafca.co.zw/about-us/",
    contactPerson: "Sales team",
    email: "sales@cafca.co.zw",
    phone: "+263 242 754 070",
    website: "https://www.cafca.co.zw/",
    leadTime: "Confirm factory schedule",
    status: "Active",
  },
  {
    id: "zw-proplastics",
    name: "Proplastics Limited",
    countryCode: "ZW",
    countryName: "Zimbabwe",
    city: "Harare",
    summary:
      "Zimbabwe manufacturer and supplier of plastic piping systems for water, irrigation, mining and civil works.",
    sectors: ["Civil & Infrastructure", "Water & Sanitation", "Mining"],
    capabilities: [
      "pvc pipes",
      "hdpe pipes",
      "pipe fittings",
      "irrigation",
      "sewer systems",
      "water reticulation",
      "civil works",
    ],
    brands: ["Proplastics"],
    certifications: [],
    procurementRegistration: "PRAZ verification required",
    verificationStatus: "Source reviewed",
    sourceUrl: "https://www.proplastics.co.zw/",
    contactPerson: "Sales team",
    email: "",
    phone: "+263 787 121 723",
    website: "https://www.proplastics.co.zw/",
    leadTime: "Confirm factory stock",
    status: "Active",
  },
  {
    id: "zw-davis-shirtliff",
    name: "Davis & Shirtliff Zimbabwe",
    countryCode: "ZW",
    countryName: "Zimbabwe",
    city: "Harare",
    summary: [
      "Water and energy equipment supplier covering pumping, water treatment,",
      "irrigation, generators and solar solutions.",
    ].join(" "),
    sectors: ["Civil & Infrastructure", "Electrical & Energy", "Water & Sanitation"],
    capabilities: [
      "water pumps",
      "boreholes",
      "water treatment",
      "irrigation",
      "solar power",
      "generators",
      "swimming pools",
    ],
    brands: ["Dayliff"],
    certifications: [],
    procurementRegistration: "PRAZ verification required",
    verificationStatus: "Source reviewed",
    sourceUrl: "https://www.davisandshirtliff.com/",
    contactPerson: "Zimbabwe sales team",
    email: "zimbabwe@dayliff.com",
    phone: "+263 8644 290 462",
    website: "https://www.davisandshirtliff.com/",
    leadTime: "Confirm stock and installation scope",
    status: "Active",
  },
];

/**
 * International sourcing candidates are kept outside the supplier directory.
 * Each profile is grounded in the manufacturer's official product catalogue and
 * is only eligible for AI/rules suggestions when its documented capabilities
 * overlap with a tender. Availability, local registration and delivery must be
 * confirmed with the manufacturer or an authorised in-country partner.
 */
export const INTERNATIONAL_SUGGESTION_SUPPLIERS: SupplierProfile[] = [
  {
    id: "suggestion-intl-schneider-electric",
    name: "Schneider Electric",
    countryCode: "INTL",
    countryName: "International",
    city: "Global / Southern Africa",
    summary:
      "Global manufacturer of electrical distribution, industrial automation, grid, data-centre and solar energy products.",
    sectors: ["Electrical & Energy", "Industrial Automation", "ICT & Software"],
    capabilities: [
      "medium voltage switchgear",
      "low voltage distribution",
      "circuit breakers",
      "power transformers",
      "protection relays",
      "industrial automation",
      "solar inverters",
      "energy storage",
      "data centre power",
    ],
    brands: ["Schneider Electric", "EcoStruxure", "APC"],
    certifications: [],
    procurementRegistration: "Confirm local registration and authorised channel before award",
    verificationStatus: "Source reviewed",
    sourceUrl: "https://www.se.com/ww/en/all-products/",
    contactPerson: "Manufacturer sales channel",
    email: "",
    phone: "",
    website: "https://www.se.com/ww/en/all-products/",
    leadTime: "Confirm regional availability",
    status: "Active",
    listingType: "suggestion",
    coverageCountries: ["ZM", "ZW"],
  },
  {
    id: "suggestion-intl-hitachi-energy",
    name: "Hitachi Energy",
    countryCode: "INTL",
    countryName: "International",
    city: "Global / Southern Africa",
    summary:
      "Global grid-technology manufacturer with transformer, switchgear, substation automation, protection and power-quality portfolios.",
    sectors: ["Electrical & Energy", "Utilities", "Industrial Automation"],
    capabilities: [
      "power transformers",
      "distribution transformers",
      "high voltage switchgear",
      "circuit breakers",
      "substation automation",
      "protection relays",
      "grid automation",
      "power quality",
      "energy storage",
    ],
    brands: ["Hitachi Energy", "Relion", "TXpert"],
    certifications: [],
    procurementRegistration: "Confirm local registration and authorised channel before award",
    verificationStatus: "Source reviewed",
    sourceUrl: "https://www.hitachienergy.com/products-and-solutions",
    contactPerson: "Manufacturer sales channel",
    email: "",
    phone: "",
    website: "https://www.hitachienergy.com/products-and-solutions",
    leadTime: "Confirm regional availability",
    status: "Active",
    listingType: "suggestion",
    coverageCountries: ["ZM", "ZW"],
  },
  {
    id: "suggestion-intl-cisco",
    name: "Cisco",
    countryCode: "INTL",
    countryName: "International",
    city: "Global / authorised partner network",
    summary:
      "Global networking and security manufacturer covering enterprise, data-centre, wireless, collaboration and industrial connectivity.",
    sectors: ["ICT & Software", "Telecommunications", "Cyber Security"],
    capabilities: [
      "network switches",
      "network routers",
      "wireless networking",
      "data centre networking",
      "network security",
      "cyber security",
      "industrial networking",
      "collaboration systems",
    ],
    brands: ["Cisco", "Cisco Catalyst", "Cisco Meraki"],
    certifications: [],
    procurementRegistration: "Confirm local registration and authorised partner before award",
    verificationStatus: "Source reviewed",
    sourceUrl: "https://www.cisco.com/site/us/en/products/index.html",
    contactPerson: "Manufacturer or authorised partner",
    email: "",
    phone: "",
    website: "https://www.cisco.com/site/us/en/products/index.html",
    leadTime: "Confirm partner stock and licensing",
    status: "Active",
    listingType: "suggestion",
    coverageCountries: ["ZM", "ZW"],
  },
  {
    id: "suggestion-intl-hpe",
    name: "Hewlett Packard Enterprise",
    countryCode: "INTL",
    countryName: "International",
    city: "Global / authorised partner network",
    summary:
      "Enterprise technology manufacturer covering compute servers, storage, networking, hybrid cloud and data-centre infrastructure.",
    sectors: ["ICT & Software", "Data Centre", "Telecommunications"],
    capabilities: [
      "enterprise servers",
      "rack servers",
      "data storage",
      "networking",
      "wireless networking",
      "hybrid cloud",
      "data centre infrastructure",
      "backup systems",
    ],
    brands: ["HPE", "HPE ProLiant", "HPE Aruba Networking", "HPE GreenLake"],
    certifications: [],
    procurementRegistration: "Confirm local registration and authorised partner before award",
    verificationStatus: "Source reviewed",
    sourceUrl: "https://buy.hpe.com/us/en/",
    contactPerson: "Manufacturer or authorised partner",
    email: "",
    phone: "",
    website: "https://buy.hpe.com/us/en/",
    leadTime: "Confirm partner stock and configuration",
    status: "Active",
    listingType: "suggestion",
    coverageCountries: ["ZM", "ZW"],
  },
  {
    id: "suggestion-intl-grundfos",
    name: "Grundfos",
    countryCode: "INTL",
    countryName: "International",
    city: "Global / regional partner network",
    summary:
      "Global pump manufacturer with water supply, wastewater, irrigation, dosing and water-treatment solutions.",
    sectors: ["Water & Sanitation", "Civil & Infrastructure", "Industrial Equipment"],
    capabilities: [
      "water pumps",
      "borehole pumps",
      "wastewater pumps",
      "irrigation pumps",
      "dosing pumps",
      "water treatment",
      "pressure boosting",
      "pump controls",
    ],
    brands: ["Grundfos"],
    certifications: [],
    procurementRegistration: "Confirm local registration and authorised partner before award",
    verificationStatus: "Source reviewed",
    sourceUrl: "https://www.grundfos.com/products",
    contactPerson: "Manufacturer or authorised partner",
    email: "",
    phone: "",
    website: "https://www.grundfos.com/products",
    leadTime: "Confirm regional availability and duty-point selection",
    status: "Active",
    listingType: "suggestion",
    coverageCountries: ["ZM", "ZW"],
  },
  {
    id: "suggestion-intl-caterpillar",
    name: "Caterpillar",
    countryCode: "INTL",
    countryName: "International",
    city: "Global / authorised dealer network",
    summary:
      "Global manufacturer of construction and mining equipment, diesel and gas generator sets, and related power systems.",
    sectors: ["Civil & Infrastructure", "Mining", "Electrical & Energy"],
    capabilities: [
      "construction equipment",
      "earthmoving equipment",
      "excavators",
      "wheel loaders",
      "motor graders",
      "diesel generators",
      "gas generators",
      "mobile generators",
      "battery energy storage",
    ],
    brands: ["Cat", "Caterpillar"],
    certifications: [],
    procurementRegistration: "Confirm local registration and authorised dealer before award",
    verificationStatus: "Source reviewed",
    sourceUrl: "https://www.cat.com/en_US/products.html",
    contactPerson: "Manufacturer or authorised dealer",
    email: "",
    phone: "",
    website: "https://www.cat.com/en_US/products.html",
    leadTime: "Confirm dealer availability",
    status: "Active",
    listingType: "suggestion",
    coverageCountries: ["ZM", "ZW"],
  },
];

const STOP_WORDS = new Set([
  "and",
  "are",
  "for",
  "from",
  "into",
  "of",
  "or",
  "services",
  "supply",
  "tender",
  "the",
  "this",
  "to",
  "with",
]);

const EXPANSIONS: Record<string, string[]> = {
  internet: ["connectivity", "fibre", "fiber", "satellite", "starlink", "telecommunications", "network"],
  ict: [
    "cloud",
    "connectivity",
    "data",
    "internet",
    "network",
    "software",
    "telecommunications",
    "hardware",
    "computers",
    "laptops",
  ],
  network: ["connectivity", "fibre", "fiber", "internet", "managed", "telecommunications"],
  solar: ["energy", "generator", "power", "inverter", "battery", "photovoltaic", "panels", "renewable"],
  water: ["boreholes", "irrigation", "pumps", "reticulation", "treatment", "pipes", "tanks", "plumbing"],
  pipe: ["civil", "fittings", "hdpe", "pvc", "reticulation", "sewer", "water"],
  cable: ["conductors", "electrical", "power", "telecommunications", "wire"],
  electrical: [
    "cable",
    "conductors",
    "energy",
    "power",
    "solar",
    "wire",
    "switchgear",
    "transformer",
    "substation",
    "generator",
  ],
  medical: ["health", "hospital", "pharmaceutical", "clinical", "laboratory", "ppe", "surgical", "medicine"],
  construction: ["civil", "building", "infrastructure", "engineering", "concrete", "structural", "cement", "roads"],
  hardware: ["computers", "laptops", "desktops", "printers", "servers", "ict", "monitors", "it"],
  stationery: ["printing", "paper", "office", "supplies", "stationery"],
  security: ["cctv", "surveillance", "access", "guard", "alarm"],
  cleaning: ["janitorial", "detergents", "sanitation", "hygiene", "chemicals"],
  uniform: ["protective", "clothing", "apparel", "ppe", "workwear", "boots", "safety"],
  transport: ["vehicles", "logistics", "automotive", "fleet", "haulage", "trucks"],
  server: ["compute", "storage", "datacenter", "networking", "rack"],
  transformer: ["electrical", "grid", "power", "substation", "switchgear"],
  generator: ["diesel", "energy", "gas", "power"],
  pump: ["borehole", "dosing", "irrigation", "pressure", "water", "wastewater"],
};

const TOKEN_ALIASES: Record<string, string> = {
  centre: "datacenter",
  centers: "datacenter",
  center: "datacenter",
  centres: "datacenter",
  cybersecurity: "security",
  fibre: "fiber",
  generators: "generator",
  pumps: "pump",
  servers: "server",
  transformers: "transformer",
};

function canonicalToken(value: string): string {
  const aliased = TOKEN_ALIASES[value] || value;
  if (aliased.length > 5 && aliased.endsWith("ies")) return `${aliased.slice(0, -3)}y`;
  if (aliased.length > 5 && aliased.endsWith("s") && !aliased.endsWith("ss")) return aliased.slice(0, -1);
  return aliased;
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    .map(canonicalToken);
}

function tenderText(tender: TenderItem, requirementText = ""): string {
  const lines = (tender.lineItems || []).flatMap((item) => [item.description, item.specification]);
  return [
    tender.title,
    tender.category,
    tender.sector,
    tender.description,
    tender.procuringEntity,
    requirementText,
    ...lines,
  ]
    .filter(Boolean)
    .join(" ");
}

export function extractSuggestedCapabilities(tender: TenderItem): string[] {
  const words = tokens([tender.title, tender.category, tender.sector].filter(Boolean).join(" "));
  return [...new Set(words)].slice(0, 6);
}

export function mergeSupplierProfiles(saved: SupplierProfile[]): SupplierProfile[] {
  const byId = new Map(STARTER_SUPPLIERS.map((supplier) => [supplier.id, supplier]));

  let clientDeleted = new Set<string>();
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("atcis_deleted_suppliers");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) clientDeleted = new Set(parsed);
      }
    } catch {}
  }

  for (const supplier of saved) {
    if (!supplier?.id) continue;
    if ((supplier as any).deleted || supplier.status === "Inactive" || clientDeleted.has(supplier.id)) {
      byId.delete(supplier.id);
      continue;
    }
    if (supplier.countryCode !== "ZW" && supplier.countryCode !== "ZM") continue;
    const previous = byId.get(supplier.id);
    byId.set(supplier.id, {
      ...previous,
      ...supplier,
      countryName: supplier.countryName || (supplier.countryCode === "ZM" ? "Zambia" : "Zimbabwe"),
      city: supplier.city || "Not specified",
      summary: supplier.summary || "Supplier profile awaiting additional company information.",
      sectors: Array.isArray(supplier.sectors) ? supplier.sectors : [],
      capabilities: Array.isArray(supplier.capabilities) ? supplier.capabilities : [],
      brands: Array.isArray(supplier.brands) ? supplier.brands : [],
      certifications: Array.isArray(supplier.certifications) ? supplier.certifications : [],
      procurementRegistration:
        supplier.procurementRegistration || `${supplier.countryCode === "ZM" ? "ZPPA" : "PRAZ"} verification required`,
      verificationStatus: supplier.verificationStatus === "Source reviewed" ? "Source reviewed" : "Pending review",
      contactPerson: supplier.contactPerson || "Supplier contact",
      email: supplier.email || "",
      phone: supplier.phone || "",
      leadTime: supplier.leadTime || "Confirm with supplier",
      status: "Active",
    });
  }
  return [...byId.values()].filter(
    (s) => !clientDeleted.has(s.id) && !(s as any).deleted && s.status === "Active"
  );
}

export function recommendSuppliers(
  tender: TenderItem,
  suppliers: SupplierProfile[] = STARTER_SUPPLIERS,
  requirementText = "",
): SupplierRecommendation[] {
  const tenderCountry = tender.countryCode === "ZW" || tender.countryCode === "ZM" ? tender.countryCode : null;
  const evidenceText = tenderText(tender, requirementText).toLowerCase();
  const baseTokens = tokens(evidenceText);
  const expanded = new Set(baseTokens);
  for (const token of baseTokens) {
    for (const related of EXPANSIONS[token] || []) expanded.add(canonicalToken(related));
  }

  return suppliers
    .filter((supplier) => {
      if (supplier.status !== "Active") return false;
      if (!tenderCountry) return ["INTL", "ZM", "ZW"].includes(supplier.countryCode);
      if (supplier.countryCode === tenderCountry) return true;
      return supplier.countryCode === "INTL" && (supplier.coverageCountries || []).includes(tenderCountry);
    })
    .map((supplier) => {
      const capabilityEvidence = supplier.capabilities.flatMap((capability) => {
        const capabilityTokens = [...new Set(tokens(capability))];
        const overlap = capabilityTokens.filter((token) => expanded.has(token));
        const exact = evidenceText.includes(capability.toLowerCase());
        const coverage = capabilityTokens.length ? overlap.length / capabilityTokens.length : 0;
        const hasEnoughEvidence =
          exact || (capabilityTokens.length === 1 ? overlap.length === 1 : overlap.length >= 2 && coverage >= 0.5);
        if (!hasEnoughEvidence) return [];
        return [{ capability, exact, coverage }];
      });
      const sectorOverlap = [
        ...new Set(tokens(supplier.sectors.join(" ")).filter((token) => expanded.has(token))),
      ];
      const technicalScore = Math.min(
        65,
        capabilityEvidence.reduce(
          (total, evidence) => total + (evidence.exact ? 24 : Math.round(8 + evidence.coverage * 12)),
          0,
        ) + Math.min(12, sectorOverlap.length * 4),
      );
      const sourceConfidence = supplier.verificationStatus === "Source reviewed" ? 5 : 0;
      const marketFit = supplier.countryCode === tenderCountry ? 10 : 5;
      const score = Math.min(96, 20 + technicalScore + sourceConfidence + marketFit);
      const matchedCapabilities = capabilityEvidence.map((evidence) => evidence.capability).slice(0, 5);
      const reasons = matchedCapabilities.length
        ? [
            supplier.countryCode === "INTL"
              ? `International candidate covering ${
                  tenderCountry === "ZM" ? "Zambia" : tenderCountry === "ZW" ? "Zimbabwe" : "the region"
                }; local availability must be confirmed`
              : `Directory supplier in ${supplier.countryName}`,
            `Tender evidence matches: ${matchedCapabilities.slice(0, 3).join(", ")}`,
            supplier.verificationStatus === "Source reviewed"
              ? "Capabilities reviewed against the company source"
              : "Supplier profile awaiting review",
          ]
        : [];
      return {
        supplier,
        score,
        reasons,
        matchedCapabilities,
        source: supplier.listingType === "suggestion" ? ("suggestion" as const) : ("directory" as const),
      };
    })
    .filter((match) => match.matchedCapabilities.length > 0)
    .sort((a, b) => b.score - a.score || a.supplier.name.localeCompare(b.supplier.name))
    .slice(0, 10);
}
