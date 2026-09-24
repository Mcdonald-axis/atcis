import type { TenderItem } from "@/app/(main)/dashboard/default/_components/tender-data";
import { recommendSuppliers, type SupplierProfile } from "@/lib/suppliers";

function analysisLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

export function formatAnalysisText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    const items = value
      .map((item) => formatAnalysisText(item))
      .filter(Boolean);
    return items.length > 0 ? items.map((item) => `• ${item}`).join("\n") : fallback;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const text = formatAnalysisText(item);
        return text ? `${analysisLabel(key)}: ${text}` : "";
      })
      .filter(Boolean);
    return entries.length > 0 ? entries.join("\n") : fallback;
  }

  return fallback;
}

export interface SuggestedSupplierMatch {
  supplierId?: string;
  supplierName: string;
  countryCode?: "ZW" | "ZM" | "INTL";
  tier: string;
  matchScore: number;
  location: string;
  leadTime: string;
  estimatedPrice?: number;
  contactEmail: string;
  contactPhone: string;
  prazRegistered: boolean;
  verificationStatus?: string;
  profileHref?: string;
  notes: string;
}

export interface RequiredItemSpecification {
  itemNumber: string;
  itemName: string;
  specifications: string;
  quantity: string;
  unit: string;
  estimatedUnitCost?: number;
  totalEstimatedCost?: number;
  complianceStandards: string;
  suggestedSuppliers: SuggestedSupplierMatch[];
}

export function generateRequiredItems(
  tender: TenderItem,
  lineItems?: any[],
  suppliers?: SupplierProfile[],
): RequiredItemSpecification[] {
  const title = (tender.title || "").toLowerCase();
  const entity = (tender.procuringEntity || "").toLowerCase();
  const category = (tender.category || "").toLowerCase();

  // Generate sector-intelligent required items and linked supplier suggestions
  let generatedItems: RequiredItemSpecification[] = [];

  if (
    title.includes("switchgear") ||
    title.includes("substation") ||
    title.includes("transformer") ||
    title.includes("power") ||
    title.includes("electrical") ||
    title.includes("solar") ||
    title.includes("zetdc") ||
    title.includes("zesa") ||
    title.includes("zesco")
  ) {
    generatedItems = [
      {
        itemNumber: "1",
        itemName: "33kV 1250A Indoor Vacuum Circuit Breaker (VCB) Panels",
        specifications:
          "Metal-clad air-insulated switchgear panel, rated voltage 36kV, short-circuit breaking capacity 25kA/3s, internal arc classification IAC AFLR 25kA 1s. Equipped with motorized spring mechanism, dual shunt trip coils, and integrated capacitive voltage dividers.",
        quantity: "6",
        unit: "Units",
        estimatedUnitCost: 28500,
        totalEstimatedCost: 171000,
        complianceStandards: "IEC 62271-200, IEC 62271-100, ISO 9001:2015, PRAZ Category ME04",
        suggestedSuppliers: [
          {
            supplierName: "Schneider Electric Southern Africa",
            tier: "Tier 1 Global OEM Partner",
            matchScore: 98,
            location: "Regional Hub / Harare Technical Agency",
            leadTime: "7-10 Days (In-Stock Regional)",
            estimatedPrice: 24200,
            contactEmail: "tenders.southernafrica@se.com",
            contactPhone: "+27 11 254 6400",
            prazRegistered: true,
            notes: "Direct OEM warranty, type-tested to IEC 62271, includes factory witness test support.",
          },
          {
            supplierName: "ABB Power Grids Regional (Hitachi Energy SADC)",
            tier: "Authorized OEM Distributor",
            matchScore: 95,
            location: "Johannesburg & Bulawayo Supply Depot",
            leadTime: "12-14 Days",
            estimatedPrice: 25100,
            contactEmail: "procurement@abb-power.co.zw",
            contactPhone: "+263 242 770 120",
            prazRegistered: true,
            notes: "Full type test certifications submitted; includes installation supervision by certified engineers.",
          },
          {
            supplierName: "Relcon / Lucy Electric Zimbabwe",
            tier: "PRAZ Registered Local Sourcing Partner",
            matchScore: 92,
            location: "Harare Industrial Sites, Zimbabwe",
            leadTime: "Immediate Local Stock",
            estimatedPrice: 26000,
            contactEmail: "sales@relcon.co.zw",
            contactPhone: "+263 242 668 901",
            prazRegistered: true,
            notes: "Local enclosure fabrication and assembly in Harare; complies with ZESA standard specs.",
          },
        ],
      },
      {
        itemNumber: "2",
        itemName: "Microprocessor Digital Feeder Protection & Automation Relays",
        specifications:
          "Numerical multifunction protection relay for overcurrent, earth fault, directional overcurrent, and sensitive earth fault (50/51/50N/51N/67). Features IEC 61850 protocol with dual optical Ethernet ports, Modbus TCP/IP, and disturbance recording.",
        quantity: "12",
        unit: "Units",
        estimatedUnitCost: 4200,
        totalEstimatedCost: 50400,
        complianceStandards: "IEC 60255, IEEE C37.90, CE Marked",
        suggestedSuppliers: [
          {
            supplierName: "Schweitzer Engineering Laboratories (SEL SADC)",
            tier: "Tier 1 Protection Specialist",
            matchScore: 97,
            location: "Regional Technical Centre / Harare Rep",
            leadTime: "5-7 Days",
            estimatedPrice: 3400,
            contactEmail: "support-africa@selinc.com",
            contactPhone: "+27 12 664 5930",
            prazRegistered: true,
            notes: "10-year no-questions-asked warranty; pre-configured relay settings for ZETDC networks.",
          },
          {
            supplierName: "Siemens Energy SADC Division",
            tier: "OEM Certified Distributor",
            matchScore: 94,
            location: "Johannesburg Distribution Centre",
            leadTime: "8-10 Days",
            estimatedPrice: 3650,
            contactEmail: "energy.orders@siemens.com",
            contactPhone: "+27 11 652 2000",
            prazRegistered: true,
            notes: "SIPROTEC 5 series relay with integrated synchrocheck and fault locator.",
          },
        ],
      },
      {
        itemNumber: "3",
        itemName: "33kV Single-Core 630mm² Cu/XLPE/CWS/PVC Power Cables",
        specifications:
          "High voltage copper conductor stranded compact circular, cross-linked polyethylene (XLPE) insulated, copper wire screen with helically applied copper tape, non-magnetic metallic sheath, and heavy-duty flame-retardant PVC outer sheath.",
        quantity: "1,800",
        unit: "Meters",
        estimatedUnitCost: 65,
        totalEstimatedCost: 117000,
        complianceStandards: "IEC 60502-2, SABS 1339, ZESA 240/2018",
        suggestedSuppliers: [
          {
            supplierName: "Cafca Limited (Zimbabwe)",
            tier: "Local Primary Manufacturer (PRAZ Top Tier)",
            matchScore: 99,
            location: "Harare, Zimbabwe",
            leadTime: "3-5 Days (Factory Direct)",
            estimatedPrice: 54,
            contactEmail: "sales@cafca.co.zw",
            contactPhone: "+263 242 754 070",
            prazRegistered: true,
            notes: "Local content rating 100%; eliminates import duties and forex clearance holdups.",
          },
          {
            supplierName: "Aberdare Cables SADC",
            tier: "Authorized Regional Cable Maker",
            matchScore: 93,
            location: "Gauteng & Bulawayo Depot",
            leadTime: "10 Days Freight",
            estimatedPrice: 52,
            contactEmail: "tenders@aberdare.co.za",
            contactPhone: "+27 11 683 2000",
            prazRegistered: true,
            notes: "Full SABS test certification and factory drum test certificates included.",
          },
        ],
      },
    ];
  } else if (
    title.includes("software") ||
    title.includes("ict") ||
    title.includes("cloud") ||
    title.includes("datacenter") ||
    title.includes("server") ||
    title.includes("network") ||
    title.includes("fiber") ||
    category.includes("ict")
  ) {
    generatedItems = [
      {
        itemNumber: "1",
        itemName: "Enterprise 2U Rackmount Dual-Socket Compute Nodes",
        specifications:
          "2x Intel Xeon Gold 6430 (32 Core, 2.1GHz), 512GB DDR5 4800MHz ECC Registered RAM, 4x 1.92TB Enterprise Read-Intensive NVMe SSDs, Dual 25GbE SFP28 ports, Redundant 1400W Platinum PSUs, Hardware TPM 2.0, Enterprise out-of-band management with remote KVM.",
        quantity: "6",
        unit: "Nodes",
        estimatedUnitCost: 16500,
        totalEstimatedCost: 99000,
        complianceStandards: "ISO 27001, CE, FCC, PRAZ Category ICT02",
        suggestedSuppliers: [
          {
            supplierName: "Hewlett Packard Enterprise (HPE) Authorized SADC",
            tier: "Tier 1 OEM Hardware Partner",
            matchScore: 98,
            location: "Regional Depot / Harare Sourcing Agent",
            leadTime: "5-7 Days (In-Stock)",
            estimatedPrice: 13800,
            contactEmail: "enterprise-sales@hpe-sadc.com",
            contactPhone: "+27 11 236 6000",
            prazRegistered: true,
            notes: "Includes 3-Year Proactive Care 24x7 4-hour on-site response and MAF authorization.",
          },
          {
            supplierName: "Dell Technologies Platinum Partner (Dandemutande)",
            tier: "Authorized Local Distributor",
            matchScore: 96,
            location: "Harare Central, Zimbabwe",
            leadTime: "In-Stock Harare Warehouse",
            estimatedPrice: 14200,
            contactEmail: "corporate@dandemutande.co.zw",
            contactPhone: "+263 242 885 000",
            prazRegistered: true,
            notes: "Direct factory shipment with ProSupport Plus mission-critical coverage in Zimbabwe.",
          },
        ],
      },
      {
        itemNumber: "2",
        itemName: "32-Port 100GbE QSFP28 Spine/Leaf Top-of-Rack Switches",
        specifications:
          "32x 100GbE QSFP28 ports with auto-breakout support (4x25GbE), non-blocking throughput 6.4Tbps, low-latency cut-through architecture, BGP EVPN, VXLAN encapsulation, dual hot-swap AC power supplies, reversible front-to-back airflow.",
        quantity: "4",
        unit: "Units",
        estimatedUnitCost: 18900,
        totalEstimatedCost: 75600,
        complianceStandards: "IEEE 802.3ba, RoHS, IEC 60950-1",
        suggestedSuppliers: [
          {
            supplierName: "Cisco Systems Regional Distributor (Mustek East Africa)",
            tier: "Cisco Gold Tier Partner",
            matchScore: 99,
            location: "Regional Logistics Hub",
            leadTime: "7 Days Delivery",
            estimatedPrice: 15400,
            contactEmail: "cisco-bids@mustek.co.za",
            contactPhone: "+27 11 237 1000",
            prazRegistered: true,
            notes: "Direct Cisco SmartNet 8x5 NBD hardware replacement with Cisco MAF certification.",
          },
          {
            supplierName: "Huawei Enterprise Zimbabwe",
            tier: "Direct OEM Enterprise Office",
            matchScore: 94,
            location: "Harare, Zimbabwe",
            leadTime: "In-Stock Local Office",
            estimatedPrice: 14800,
            contactEmail: "enterprise.zw@huawei.com",
            contactPhone: "+263 242 778 000",
            prazRegistered: true,
            notes: "CloudEngine 6800 Series switches with 3-year Hi-Care on-site maintenance.",
          },
        ],
      },
    ];
  } else if (
    title.includes("road") ||
    title.includes("highway") ||
    title.includes("construction") ||
    title.includes("civil") ||
    title.includes("bridge") ||
    title.includes("water")
  ) {
    generatedItems = [
      {
        itemNumber: "1",
        itemName: "Polymer Modified Bitumen (PMB Grade A - PG 76-22)",
        specifications:
          "High-performance elastomer-modified bitumen conforming to AASHTO M320 and SABS 307. Softening point minimum 65°C, penetration at 25°C: 50-70 dmm, elastic recovery at 25°C >75%. Formulated for heavy axle load commercial corridors.",
        quantity: "650",
        unit: "Metric Tons",
        estimatedUnitCost: 1250,
        totalEstimatedCost: 812500,
        complianceStandards: "SABS 307, AASHTO M320, ASTM D6373, PRAZ Category CE01",
        suggestedSuppliers: [
          {
            supplierName: "Puma Energy Bitumen Southern Africa",
            tier: "Primary Refiner & Terminal Operator",
            matchScore: 98,
            location: "Beira & Harare Bulk Terminals",
            leadTime: "3-5 Days Tanker Dispatch",
            estimatedPrice: 1020,
            contactEmail: "bitumen.southernafrica@pumaenergy.com",
            contactPhone: "+263 242 755 800",
            prazRegistered: true,
            notes: "Supplied in hot bulk tankers directly to job site asphalt mixing plant.",
          },
          {
            supplierName: "TotalEnergies Commercial Bitumen SADC",
            tier: "Global Oil Major Certified",
            matchScore: 95,
            location: "Ndola & Bulawayo Supply Hubs",
            leadTime: "5-7 Days",
            estimatedPrice: 1060,
            contactEmail: "commercial.sales@totalenergies.co.zw",
            contactPhone: "+263 242 770 230",
            prazRegistered: true,
            notes: "Batch laboratory test certificates provided for every 30-ton delivery lot.",
          },
        ],
      },
      {
        itemNumber: "2",
        itemName: "Heavy-Duty High-Density Polyethylene (HDPE) Corrugated Culverts",
        specifications:
          "Double-wall corrugated HDPE storm drain pipes with smooth interior, nominal diameter DN 900mm and DN 1200mm, stiffness class SN8 (8 kN/m²), bell-and-spigot rubber gasketed joints.",
        quantity: "480",
        unit: "Meters",
        estimatedUnitCost: 240,
        totalEstimatedCost: 115200,
        complianceStandards: "EN 13476-3, ISO 9969, SANS 21138",
        suggestedSuppliers: [
          {
            supplierName: "Proplastics Limited (Zimbabwe)",
            tier: "Local Tier-1 Pipe Manufacturer",
            matchScore: 99,
            location: "Harare & Bulawayo, Zimbabwe",
            leadTime: "Immediate Factory Stock",
            estimatedPrice: 195,
            contactEmail: "sales@proplastics.co.zw",
            contactPhone: "+263 242 621 651",
            prazRegistered: true,
            notes: "Local PRAZ manufacturer; certified to SAZ standards with zero forex import friction.",
          },
        ],
      },
    ];
  } else if (
    title.includes("hospital") ||
    title.includes("medical") ||
    title.includes("health") ||
    title.includes("oncology") ||
    title.includes("pharma") ||
    title.includes("diagnostic")
  ) {
    generatedItems = [
      {
        itemNumber: "1",
        itemName: "Automated Clinical Chemistry & Immunoassay Integrated Analyzer",
        specifications:
          "High-throughput benchtop analyzer: 800 photometric tests/hr + 600 ISE tests/hr. On-board refrigerated reagent storage for 70 positions. Clot detection, liquid level sensing, automatic sample rerun and dilution. Fully interfaced with LIS (HL7/ASTM).",
        quantity: "4",
        unit: "Systems",
        estimatedUnitCost: 78000,
        totalEstimatedCost: 312000,
        complianceStandards: "FDA 510(k), CE-IVD, ISO 13485, MCAZ Import License",
        suggestedSuppliers: [
          {
            supplierName: "Roche Diagnostics Southern Africa",
            tier: "Tier 1 Medical Device OEM",
            matchScore: 98,
            location: "Johannesburg Logistics / Harare Rep",
            leadTime: "10-14 Days Airfreight",
            estimatedPrice: 66000,
            contactEmail: "southernafrica.tenders@roche.com",
            contactPhone: "+27 11 504 4600",
            prazRegistered: true,
            notes: "Complete system with 2 years preventive maintenance kit and applications specialist training.",
          },
          {
            supplierName: "NatPharm Wholesale Supply Depot",
            tier: "National Statutory Medical Warehouse",
            matchScore: 95,
            location: "Harare Central Warehouse, Zimbabwe",
            leadTime: "In-Stock Central Depot",
            estimatedPrice: 69000,
            contactEmail: "procurement@natpharm.co.zw",
            contactPhone: "+263 242 621 991",
            prazRegistered: true,
            notes: "Pre-cleared with MCAZ regulatory compliance and batch test certificates.",
          },
        ],
      },
      {
        itemNumber: "2",
        itemName: "Multiplex Molecular Diagnostic Reagents & Control Kits (1,000 Tests/Lot)",
        specifications:
          "Ready-to-use lyophilized real-time RT-PCR reagents for rapid pathogen detection with internal positive/negative controls, enzyme mixes, and reaction buffers. Cold-chain storage stability 2°C to 8°C.",
        quantity: "24",
        unit: "Kits",
        estimatedUnitCost: 2800,
        totalEstimatedCost: 67200,
        complianceStandards: "WHO-PQS, CE-IVD, ISO 9001",
        suggestedSuppliers: [
          {
            supplierName: "Bio-Rad Laboratories Southern Africa",
            tier: "Authorized Molecular Diagnostic OEM",
            matchScore: 97,
            location: "Johannesburg Cold-Chain Facility",
            leadTime: "3-5 Days Temperature-Controlled Freight",
            estimatedPrice: 2350,
            contactEmail: "diag_africa@bio-rad.com",
            contactPhone: "+27 11 442 8500",
            prazRegistered: true,
            notes: "Validated cold-chain datalogger included with each shipment drum.",
          },
        ],
      },
    ];
  } else {
    // Default high-precision deliverables
    generatedItems = [
      {
        itemNumber: "1",
        itemName: `${tender.title} - Main Package Deliverables & Equipment`,
        specifications: `Commercial-grade equipment and turnkey deliverables conforming to gazetted bidding dossier requirements for ${tender.procuringEntity}. Must meet national statutory requirements, minimum 12-month defect liability warranty, and manufacturer OEM compliance.`,
        quantity: "1",
        unit: "Turnkey Lot",
        estimatedUnitCost: Math.round((tender.estimatedValue || 150000) * 0.75),
        totalEstimatedCost: Math.round((tender.estimatedValue || 150000) * 0.75),
        complianceStandards: "PRAZ Standard Bidding Guidelines, ISO 9001:2015, SAZ Standards",
        suggestedSuppliers: [
          {
            supplierName: "Verified SADC Regional OEM Distributor",
            tier: "Tier 1 Sourcing Partner",
            matchScore: 96,
            location: "Harare / Lusaka Logistics Hub",
            leadTime: "7-10 Days",
            estimatedPrice: Math.round((tender.estimatedValue || 150000) * 0.65),
            contactEmail: "bids@regional-oem.co.zw",
            contactPhone: "+263 242 788 120",
            prazRegistered: true,
            notes: "PRAZ Category registration active; provides full manufacturer authorization and technical support.",
          },
          {
            supplierName: "Apex Corporate Engineering Solutions",
            tier: "PRAZ Registered Category Partner",
            matchScore: 92,
            location: "Harare Industrial Park",
            leadTime: "Immediate Stock",
            estimatedPrice: Math.round((tender.estimatedValue || 150000) * 0.68),
            contactEmail: "supply@apexengineering.co.zw",
            contactPhone: "+263 242 660 300",
            prazRegistered: true,
            notes: "Local warehousing and installation fleet in Zimbabwe and Zambia.",
          },
        ],
      },
    ];
  }

  return generatedItems.map((item) => ({
    ...item,
    suggestedSuppliers: recommendSuppliers(
      tender,
      suppliers,
      [item.itemName, item.specifications, item.complianceStandards].join(" "),
    ).map(({ supplier, score, reasons }) => ({
      supplierId: supplier.id,
      supplierName: supplier.name,
      countryCode: supplier.countryCode,
      tier: "Local supplier profile",
      matchScore: score,
      location: `${supplier.city}, ${supplier.countryName}`,
      leadTime: supplier.leadTime,
      contactEmail: supplier.email,
      contactPhone: supplier.phone,
      prazRegistered: false,
      verificationStatus: supplier.verificationStatus,
      profileHref: `/dashboard/suppliers?supplier=${encodeURIComponent(supplier.id)}&tender=${encodeURIComponent(tender.id)}`,
      notes: reasons.join(" · "),
    })),
  }));
}

export function enrichAnalysisWithItemsAndSuppliers(
  rawResult: any,
  tender: TenderItem,
  lineItems?: any[],
  isScopeAnalysis?: boolean,
  suppliers?: SupplierProfile[],
): any {
  const safeRawResult =
    rawResult && typeof rawResult === "object" && !Array.isArray(rawResult) ? rawResult : {};
  const isWb =
    (tender.sourcePortal || "").toLowerCase().includes("world bank") ||
    (tender.sourcePortal || "").toLowerCase().includes("worldbank") ||
    (tender.id || "").toLowerCase().startsWith("worldbank:") ||
    ((tender as any).source || "").toLowerCase().includes("worldbank");

  const isUn =
    (tender.sourcePortal || "").toLowerCase().includes("ungm") ||
    (tender.sourcePortal || "").toLowerCase().includes("un global") ||
    (tender.sourcePortal || "").toLowerCase().includes("unprocurement") ||
    (tender.procuringEntity || "").toLowerCase().includes("united nations") ||
    (tender.procuringEntity || "").toLowerCase().includes("unpd") ||
    (tender.id || "").toLowerCase().startsWith("unprocurement:") ||
    (tender.id || "").toLowerCase().startsWith("ungm:");

  const isScopeMode =
    isScopeAnalysis ||
    isWb ||
    isUn ||
    !safeRawResult.fileName ||
    (typeof safeRawResult.fileName === "string" && safeRawResult.fileName.includes("Scope"));

  const defaultFileName = isScopeMode
    ? "Scope of Works & Official Gazette Specifications"
    : "Tender Bidding Document.pdf";

  const defaultChecklist = isWb
    ? [
        { item: "World Bank Eligibility Declaration", status: "Mandatory", description: "Confirmation of eligibility under World Bank Procurement Regulations" },
        { item: "Consultant / Vendor Technical Track Record", status: "Mandatory", description: "Demonstrated prior execution of similar advisory or technical scopes" },
        { item: "Key Expert Curriculum Vitae (CVs)", status: "Mandatory", description: "Certified expert profiles meeting Terms of Reference qualification criteria" },
        { item: "Technical Methodology & Work Plan", status: "Mandatory", description: "Detailed assignment approach aligned with project scope deliverables" },
        { item: "Financial Proposal & Remuneration Schedule", status: "Mandatory", description: "Full breakdown of fees, reimbursable expenses, and taxes" },
      ]
    : isUn
    ? [
        { item: "UNGM Active Registration (Basic / Level 1)", status: "Mandatory", description: "Verified vendor registration on the UN Global Marketplace (www.ungm.org)" },
        { item: "Expression of Interest (EOI) Response", status: "Mandatory", description: "Official EOI vendor response form conforming to solicitation terms" },
        { item: "Acceptance of UN General Conditions of Contract", status: "Mandatory", description: "Formal acceptance of UN standard contract terms and ethics policy" },
        { item: "Relevant Corporate Experience & References", status: "Mandatory", description: "Past performance references for goods/services of similar scale" },
        { item: "Financial Capability & Balance Sheet Evidence", status: "Conditional", description: "Audited financial statements or banking standing confirmation" },
      ]
    : tender.countryCode === "ZM"
    ? [
        { item: "ZPPA e-GP Supplier Registration", status: "Mandatory", description: "Valid registration certificate with Zambia Public Procurement Authority" },
        { item: "PACRA Certificate of Incorporation", status: "Mandatory", description: "Proof of legal entity registration in Zambia" },
        { item: "ZRA Tax Clearance Certificate", status: "Mandatory", description: "Valid Zambia Revenue Authority statutory clearance" },
        { item: "NAPSA Compliance Certificate", status: "Mandatory", description: "National Pension Scheme Authority compliance" },
        { item: "Bid Security Guarantee", status: "Mandatory", description: "Bank or insurance bond in stipulated ZPPA format" },
      ]
    : [
        { item: "PRAZ 2026 Category Registration", status: "Mandatory", description: "Valid annual PRAZ certificate matching gazetted code" },
        { item: "ZIMRA Tax Clearance (ITF263)", status: "Mandatory", description: "Tax clearance verification active" },
        { item: "NSSA Social Security Compliance", status: "Mandatory", description: "Certificate of good standing" },
        { item: "Bid Security Bond", status: "Mandatory", description: "Bank guarantee in required format" },
        { item: "Manufacturer Authorization Form (MAF)", status: "Conditional", description: "Direct OEM authorization for bidding equipment" },
      ];

  const generatedItems = generateRequiredItems(tender, lineItems, suppliers);

  const defaultEvaluationMatrix = [
    {
      criterion: "Preliminary Statutory Compliance",
      weight: "Pass/Fail",
      description: "Mandatory documents check",
    },
    {
      criterion: "Technical Specification Conformance",
      weight: "70 Points",
      description: "Compliance with detailed item specifications",
    },
    {
      criterion: "Past Experience & Track Record",
      weight: "20 Points",
      description: "3 reference letters for similar contracts",
    },
    {
      criterion: "Delivery Timeline & SLA",
      weight: "10 Points",
      description: "Guaranteed delivery period and warranty terms",
    },
  ];
  const defaultCommercialTerms = {
    currency: "USD / Gazetted currency",
    paymentTerms: "30-day payment upon inspection and sign-off",
    deliveryPeriod: "As stipulated in bidding schedule",
    warrantyPeriod: "12 to 24 Months Manufacturer Warranty",
    penalties: "0.5% per week up to 10% maximum",
  };
  const defaultRiskAssessment = [
    {
      risk: "Strict Delivery Schedule",
      severity: "Medium",
      mitigation: "Pre-lock supplier inventory and secure written lead-time commitments.",
    },
    {
      risk: "Compliance Formatting",
      severity: "High",
      mitigation: "Strictly adhere to issuing authority bid template instructions.",
    },
  ];

  const commercialTerms =
    safeRawResult.commercialTerms &&
    typeof safeRawResult.commercialTerms === "object" &&
    !Array.isArray(safeRawResult.commercialTerms)
      ? safeRawResult.commercialTerms
      : defaultCommercialTerms;

  return {
    ...safeRawResult,
    fileName: safeRawResult.fileName || defaultFileName,
    executiveSummary: formatAnalysisText(
      safeRawResult.executiveSummary,
      `Comprehensive evaluation of ${tender.title} issued by ${tender.procuringEntity}. The project scope requires verified statutory registration, rigorous technical specification conformance, and vetted supplier supply chains for timely execution.`,
    ),
    mandatoryChecklist: Array.isArray(safeRawResult.mandatoryChecklist)
      ? safeRawResult.mandatoryChecklist
      : defaultChecklist,
    evaluationMatrix: Array.isArray(safeRawResult.evaluationMatrix)
      ? safeRawResult.evaluationMatrix
      : defaultEvaluationMatrix,
    commercialTerms,
    riskAssessment: Array.isArray(safeRawResult.riskAssessment)
      ? safeRawResult.riskAssessment
      : defaultRiskAssessment,
    pricingStrategy: formatAnalysisText(
      safeRawResult.pricingStrategy,
      "Recommend targeted gross margin of 18-22% based on supplier OEM discounts. Pass through manufacturer warranty to maximize technical evaluation points.",
    ),
    aiFitScore: safeRawResult.aiFitScore || tender.aiScore || 92,
    bidDecision: safeRawResult.bidDecision || "STRONG_BID",
    requiredItems: generatedItems,
  };
}
