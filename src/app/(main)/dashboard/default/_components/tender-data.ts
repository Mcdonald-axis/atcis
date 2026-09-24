export type CountryScope = "ALL" | "ZW" | "ZM";

export type TenderSector =
  | "ICT & Software"
  | "Healthcare & Medical"
  | "Electrical & Energy"
  | "Civil & Infrastructure"
  | "General Goods & Consumables"
  | "Services & Logistics"
  | "Other";

export type TenderClassificationSource = "rules" | "ai" | "manual";

export interface TenderLineItem {
  itemNumber: string;
  description: string;
  quantity: number;
  unit: string;
  specification: string;
  estUnitPrice?: number;
  estTotal?: number;
}

export interface TenderItem {
  id: string;
  refNo: string;
  title: string;
  category: string;
  procuringEntity: string;
  countryCode: CountryScope;
  countryName: string;
  estimatedValue: number;
  currency: string;
  publishDate: string;
  closingDate: string;
  daysRemaining: number;
  aiScore: number;
  classificationSource?: TenderClassificationSource;
  classificationConfidence?: number;
  classificationEvidence?: string[];
  classificationReason?: string;
  focusEligible?: boolean;
  needsClassificationReview?: boolean;
  status:
    | "Open"
    | "Closing Soon"
    | "Under Evaluation"
    | "Awarded"
    | "Contract Signing"
    | "In Execution"
    | "Delivered & Accepted"
    | "Lost"
    | "Cancelled"
    | string;
  sourcePortal: string;
  portalUrl?: string;
  description?: string;
  procurementMethod?: string;
  sector?: TenderSector | string;
  siteOrder?: number;
  lineItems?: TenderLineItem[];
  documents?: any[];
  contact?: any;
  projectId?: string;
  projectTitle?: string;
  procurementType?: string;
  tenderId?: string;
  noticeAtAGlance?: any;
  contactInfo?: any;
  noticeTextHtml?: string;
  noticeStatus?: string;
  noticeLang?: string;
  submissionDeadlineTime?: string;
}

export interface ProcurementPlanLineItem {
  itemId: string;
  refNo: string;
  classOfProcurement: string;
  objectCode: string;
  description: string;
  pmoEndUser: string;
  procurementMethod: string;
  eoiPublicationDate?: string;
  eoiClosingDate?: string;
  tenderPublicationDate?: string;
  bidClosingDate?: string;
  awardNoticeDate?: string;
  contractSigningDate?: string;
  cycleDays?: string;
  leadTime?: string;
  spoc?: string;
  sourceOfFunds?: string;
  unitOfMeasurement?: string;
  quantity?: string;
  comments?: string;
}

export interface AdvanceProcurementPlan {
  id: string;
  planRef: string;
  procuringEntity: string;
  countryCode: "ZW" | "ZM";
  countryName: string;
  description: string;
  category: string;
  estimatedBudget: number;
  expectedPublication: string;
  quarter: "Q3 2026" | "Q4 2026" | "Q1 2027" | "Q2 2027" | string;
  procurementMethod: "Open Competitive" | "Framework Agreement" | "RFP" | "Direct Procurement" | string;
  spocContact: string;
  sourcePortal?: string;
  portalUrl?: string;
  items?: ProcurementPlanLineItem[];
}

export interface UrgentDeadline {
  id: string;
  refNo: string;
  title: string;
  entity: string;
  countryCode: "ZW" | "ZM";
  amount: number;
  dueDate: string;
  daysLeft: number;
  urgency: "critical" | "high" | "medium";
}

export interface SectorItem {
  id: string;
  name: string;
  tendersCount: number;
  value: number;
  percentage: number;
  iconName: "Building2" | "Cpu" | "Zap" | "HeartPulse" | "Truck" | "Droplets";
}

export interface PortalFeedItem {
  id: string;
  name: string;
  countryCode: "ZW" | "ZM" | "REGIONAL";
  jurisdiction: string;
  tendersCount: number;
  syncStatus: string;
  health: "healthy" | "syncing" | "idle";
}

export interface SpotlightTender {
  id: string;
  refNo: string;
  title: string;
  entity: string;
  location: string;
  countryCode: "ZW" | "ZM";
  countryName: string;
  portalName: string;
  estimatedValue: number;
  daysRemaining: number;
  closingDate: string;
  aiFitScore: number;
  fitReason: string;
}

export interface TenderMetrics {
  activeTenders: number;
  activeTendersTrend: string;
  pipelineValue: number;
  pipelineValueTrend: string;
  closingSoonCount: number;
  criticalDeadlines: number;
  submittedCount?: number;
  submittedValue?: number;
  lostContractsCount?: number;
  lostValue?: number;
  awardedContractsCount: number;
  awardedValue: number;
  aiMatchRate: number;
}

export interface SubmittedTenderItem {
  id: string;
  refNo: string;
  title: string;
  entity: string;
  countryCode: string;
  submittedValue: number;
  closingDate: string;
  hoursRemaining: number;
  urgency: "critical" | "high" | "medium";
}

export interface LostTenderItem {
  id: string;
  refNo: string;
  title: string;
  entity: string;
  countryCode: string;
  ourBidValue: number;
  winningBidValue: number;
  winnerName: string;
  lossReason: string;
  dateLost: string;
}

export const TENDER_DATA_BY_REGION: Record<
  CountryScope,
  {
    metrics: TenderMetrics;
    spotlight: SpotlightTender;
    chartData: { month: string; published: number; awarded: number }[];
    sectors: SectorItem[];
    portals: PortalFeedItem[];
    urgentDeadlines: UrgentDeadline[];
  }
> = {
  ALL: {
    metrics: {
      activeTenders: 184,
      activeTendersTrend: "+18 new this week",
      pipelineValue: 64250000,
      pipelineValueTrend: "+14.2% vs last month",
      closingSoonCount: 29,
      criticalDeadlines: 12,
      submittedCount: 29,
      submittedValue: 18450000,
      lostContractsCount: 14,
      lostValue: 9240000,
      awardedContractsCount: 52,
      awardedValue: 21800000,
      aiMatchRate: 84,
    },
    spotlight: {
      id: "spotlight-all",
      refNo: "PRAZ/ZETDC/2026/089",
      title: "33kV Substation Switchgear Supply & Install",
      entity: "ZETDC / ZESA Holdings",
      location: "Harare, Zimbabwe",
      countryCode: "ZW",
      countryName: "Zimbabwe",
      portalName: "PRAZ e-GP",
      estimatedValue: 3200000,
      daysRemaining: 3,
      closingDate: "05 Sep 2026",
      aiFitScore: 94,
      fitReason: "High capability match based on technical electrical certifications and past completed substation projects.",
    },
    chartData: [
      { month: "Jan", published: 4800, awarded: 2100 },
      { month: "Feb", published: 6200, awarded: 3400 },
      { month: "Mar", published: 7900, awarded: 4200 },
      { month: "Apr", published: 5400, awarded: 3100 },
      { month: "May", published: 8600, awarded: 5200 },
      { month: "Jun", published: 9400, awarded: 6100 },
      { month: "Jul", published: 7200, awarded: 4600 },
      { month: "Aug", published: 10500, awarded: 7300 },
      { month: "Sep", published: 11200, awarded: 6800 },
      { month: "Oct", published: 8900, awarded: 5400 },
      { month: "Nov", published: 7800, awarded: 4900 },
      { month: "Dec", published: 9100, awarded: 5800 },
    ],
    sectors: [
      {
        id: "infra",
        name: "Construction & Civil Works",
        tendersCount: 48,
        value: 22400000,
        percentage: 35,
        iconName: "Building2",
      },
      {
        id: "ict",
        name: "ICT & Digital Solutions",
        tendersCount: 39,
        value: 14800000,
        percentage: 23,
        iconName: "Cpu",
      },
      {
        id: "energy",
        name: "Energy, Power & Solar",
        tendersCount: 28,
        value: 11200000,
        percentage: 17,
        iconName: "Zap",
      },
      {
        id: "health",
        name: "Healthcare & Medical Supplies",
        tendersCount: 22,
        value: 8600000,
        percentage: 13,
        iconName: "HeartPulse",
      },
      {
        id: "logistics",
        name: "Logistics & Fleet Management",
        tendersCount: 16,
        value: 4500000,
        percentage: 7,
        iconName: "Truck",
      },
    ],
    portals: [
      {
        id: "praz",
        name: "PRAZ Zimbabwe e-GP",
        countryCode: "ZW",
        jurisdiction: "Zimbabwe National Portal",
        tendersCount: 112,
        syncStatus: "Synced 4m ago",
        health: "healthy",
      },
      {
        id: "onlinetenders-zw",
        name: "OnlineTenders Zimbabwe",
        countryCode: "ZW",
        jurisdiction: "Commercial & Parastatal Leads",
        tendersCount: 484,
        syncStatus: "Synced 2m ago",
        health: "healthy",
      },
      {
        id: "zppa",
        name: "ZPPA Zambia e-Procurement",
        countryCode: "ZM",
        jurisdiction: "Zambia National Portal",
        tendersCount: 48,
        syncStatus: "Synced 9m ago",
        health: "healthy",
      },
      {
        id: "worldbank",
        name: "World Bank Southern Africa",
        countryCode: "REGIONAL",
        jurisdiction: "Multilateral Funding",
        tendersCount: 14,
        syncStatus: "Synced 1h ago",
        health: "healthy",
      },
      {
        id: "ungm",
        name: "UN Global Marketplace (UNGM)",
        countryCode: "REGIONAL",
        jurisdiction: "United Nations Agencies",
        tendersCount: 12,
        syncStatus: "Synced 6m ago",
        health: "healthy",
      },
      {
        id: "afdb",
        name: "African Development Bank (AfDB)",
        countryCode: "REGIONAL",
        jurisdiction: "Infrastructure & ZimFund",
        tendersCount: 6,
        syncStatus: "Synced 15m ago",
        health: "healthy",
      },
    ],
    urgentDeadlines: [
      {
        id: "u-1",
        refNo: "PRAZ/ZETDC/2026/089",
        title: "33kV Substation Switchgear Upgrade",
        entity: "ZETDC (Zimbabwe)",
        countryCode: "ZW",
        amount: 3200000,
        dueDate: "05 Sep 2026",
        daysLeft: 3,
        urgency: "critical",
      },
      {
        id: "u-2",
        refNo: "ZPPA/RDA/2026/114",
        title: "Lusaka-Ndola Highway Dualization Works",
        entity: "Road Development Agency (Zambia)",
        countryCode: "ZM",
        amount: 1850000,
        dueDate: "06 Sep 2026",
        daysLeft: 4,
        urgency: "high",
      },
      {
        id: "u-3",
        refNo: "MOFED/ICT/2026/042",
        title: "Integrated Financial Cloud Infrastructure",
        entity: "Ministry of Finance (Zimbabwe)",
        countryCode: "ZW",
        amount: 640000,
        dueDate: "07 Sep 2026",
        daysLeft: 5,
        urgency: "medium",
      },
      {
        id: "u-4",
        refNo: "ZPPA/ZESCO/2026/102",
        title: "Distribution Transformers Procurement",
        entity: "ZESCO Limited (Zambia)",
        countryCode: "ZM",
        amount: 4100000,
        dueDate: "08 Sep 2026",
        daysLeft: 6,
        urgency: "medium",
      },
    ],
  },
  ZW: {
    metrics: {
      activeTenders: 128,
      activeTendersTrend: "+12 new this week",
      pipelineValue: 42800000,
      pipelineValueTrend: "+11.8% vs last month",
      closingSoonCount: 19,
      criticalDeadlines: 8,
      submittedCount: 19,
      submittedValue: 11950000,
      lostContractsCount: 9,
      lostValue: 5620000,
      awardedContractsCount: 36,
      awardedValue: 14600000,
      aiMatchRate: 86,
    },
    spotlight: {
      id: "spotlight-zw",
      refNo: "PRAZ/ZETDC/2026/089",
      title: "33kV Substation Switchgear Supply & Install",
      entity: "ZETDC / ZESA Holdings",
      location: "Harare, Zimbabwe",
      countryCode: "ZW",
      countryName: "Zimbabwe",
      portalName: "PRAZ e-GP",
      estimatedValue: 3200000,
      daysRemaining: 3,
      closingDate: "05 Sep 2026",
      aiFitScore: 94,
      fitReason: "High capability match based on technical electrical certifications and past completed substation projects.",
    },
    chartData: [
      { month: "Jan", published: 3200, awarded: 1400 },
      { month: "Feb", published: 4100, awarded: 2300 },
      { month: "Mar", published: 5300, awarded: 2900 },
      { month: "Apr", published: 3600, awarded: 2100 },
      { month: "May", published: 5900, awarded: 3600 },
      { month: "Jun", published: 6300, awarded: 4200 },
      { month: "Jul", published: 4900, awarded: 3100 },
      { month: "Aug", published: 7100, awarded: 4900 },
      { month: "Sep", published: 7600, awarded: 4500 },
      { month: "Oct", published: 5900, awarded: 3600 },
      { month: "Nov", published: 5200, awarded: 3300 },
      { month: "Dec", published: 6100, awarded: 3900 },
    ],
    sectors: [
      {
        id: "infra",
        name: "Construction & Civil Works",
        tendersCount: 34,
        value: 15600000,
        percentage: 36,
        iconName: "Building2",
      },
      {
        id: "energy",
        name: "Energy, Power & Solar",
        tendersCount: 22,
        value: 9400000,
        percentage: 22,
        iconName: "Zap",
      },
      {
        id: "ict",
        name: "ICT & Digital Solutions",
        tendersCount: 26,
        value: 8900000,
        percentage: 21,
        iconName: "Cpu",
      },
      {
        id: "health",
        name: "Healthcare & Medical Supplies",
        tendersCount: 16,
        value: 5800000,
        percentage: 14,
        iconName: "HeartPulse",
      },
      {
        id: "logistics",
        name: "Logistics & Fleet Management",
        tendersCount: 10,
        value: 3100000,
        percentage: 7,
        iconName: "Truck",
      },
    ],
    portals: [
      {
        id: "praz",
        name: "PRAZ Zimbabwe e-GP",
        countryCode: "ZW",
        jurisdiction: "Primary National Portal",
        tendersCount: 112,
        syncStatus: "Synced 4m ago",
        health: "healthy",
      },
      {
        id: "onlinetenders-zw",
        name: "OnlineTenders Zimbabwe",
        countryCode: "ZW",
        jurisdiction: "Commercial & Parastatal Leads",
        tendersCount: 484,
        syncStatus: "Synced 2m ago",
        health: "healthy",
      },
      {
        id: "worldbank-zw",
        name: "World Bank Zimbabwe Portfolio",
        countryCode: "ZW",
        jurisdiction: "Development Projects",
        tendersCount: 8,
        syncStatus: "Synced 1h ago",
        health: "healthy",
      },
      {
        id: "ungm-zw",
        name: "UNGM / UNDP Zimbabwe",
        countryCode: "ZW",
        jurisdiction: "UN Agencies (UNDP, UNICEF)",
        tendersCount: 12,
        syncStatus: "Synced 6m ago",
        health: "healthy",
      },
      {
        id: "afdb-zw",
        name: "African Development Bank (AfDB)",
        countryCode: "ZW",
        jurisdiction: "Infrastructure & ZimFund",
        tendersCount: 6,
        syncStatus: "Synced 15m ago",
        health: "healthy",
      },
      {
        id: "herald",
        name: "Government Gazette & Notices",
        countryCode: "ZW",
        jurisdiction: "Official Publications",
        tendersCount: 16,
        syncStatus: "Synced 30m ago",
        health: "healthy",
      },
    ],
    urgentDeadlines: [
      {
        id: "u-1",
        refNo: "PRAZ/ZETDC/2026/089",
        title: "33kV Substation Switchgear Upgrade",
        entity: "ZETDC (Zimbabwe)",
        countryCode: "ZW",
        amount: 3200000,
        dueDate: "05 Sep 2026",
        daysLeft: 3,
        urgency: "critical",
      },
      {
        id: "u-3",
        refNo: "MOFED/ICT/2026/042",
        title: "Integrated Financial Cloud Infrastructure",
        entity: "Ministry of Finance (Zimbabwe)",
        countryCode: "ZW",
        amount: 640000,
        dueDate: "07 Sep 2026",
        daysLeft: 5,
        urgency: "medium",
      },
      {
        id: "u-5",
        refNo: "NATPHARM/2026/021",
        title: "Essential Medical Consumables Supply",
        entity: "NatPharm Zimbabwe",
        countryCode: "ZW",
        amount: 1100000,
        dueDate: "08 Sep 2026",
        daysLeft: 6,
        urgency: "medium",
      },
    ],
  },
  ZM: {
    metrics: {
      activeTenders: 56,
      activeTendersTrend: "+6 new this week",
      pipelineValue: 21450000,
      pipelineValueTrend: "+18.5% vs last month",
      closingSoonCount: 10,
      criticalDeadlines: 4,
      submittedCount: 10,
      submittedValue: 6500000,
      lostContractsCount: 5,
      lostValue: 3620000,
      awardedContractsCount: 16,
      awardedValue: 7200000,
      aiMatchRate: 82,
    },
    spotlight: {
      id: "spotlight-zm",
      refNo: "ZPPA/RDA/2026/114",
      title: "Lusaka-Ndola Highway Dualization Subcontracts",
      entity: "Road Development Agency (RDA)",
      location: "Lusaka, Zambia",
      countryCode: "ZM",
      countryName: "Zambia",
      portalName: "ZPPA e-GP",
      estimatedValue: 1850000,
      daysRemaining: 4,
      closingDate: "06 Sep 2026",
      aiFitScore: 92,
      fitReason: "Qualified contractor tier matches RDA highway and asphalt resurfacing prerequisites.",
    },
    chartData: [
      { month: "Jan", published: 1600, awarded: 700 },
      { month: "Feb", published: 2100, awarded: 1100 },
      { month: "Mar", published: 2600, awarded: 1300 },
      { month: "Apr", published: 1800, awarded: 1000 },
      { month: "May", published: 2700, awarded: 1600 },
      { month: "Jun", published: 3100, awarded: 1900 },
      { month: "Jul", published: 2300, awarded: 1500 },
      { month: "Aug", published: 3400, awarded: 2400 },
      { month: "Sep", published: 3600, awarded: 2300 },
      { month: "Oct", published: 3000, awarded: 1800 },
      { month: "Nov", published: 2600, awarded: 1600 },
      { month: "Dec", published: 3000, awarded: 1900 },
    ],
    sectors: [
      {
        id: "infra",
        name: "Construction & Road Works",
        tendersCount: 18,
        value: 8400000,
        percentage: 39,
        iconName: "Building2",
      },
      {
        id: "ict",
        name: "ICT & Telecom Infrastructure",
        tendersCount: 13,
        value: 5900000,
        percentage: 27,
        iconName: "Cpu",
      },
      {
        id: "energy",
        name: "Power, Grid & Hydro",
        tendersCount: 11,
        value: 3900000,
        percentage: 18,
        iconName: "Zap",
      },
      {
        id: "health",
        name: "Medical Equipment & Consumables",
        tendersCount: 8,
        value: 2100000,
        percentage: 10,
        iconName: "HeartPulse",
      },
      {
        id: "logistics",
        name: "Logistics & Transport",
        tendersCount: 6,
        value: 1150000,
        percentage: 6,
        iconName: "Truck",
      },
    ],
    portals: [
      {
        id: "zppa",
        name: "ZPPA Zambia e-Procurement",
        countryCode: "ZM",
        jurisdiction: "Primary National Portal",
        tendersCount: 48,
        syncStatus: "Synced 9m ago",
        health: "healthy",
      },
      {
        id: "gozambia",
        name: "GoZambiaJobs Tender Portal",
        countryCode: "ZM",
        jurisdiction: "Aggregated Notices",
        tendersCount: 8,
        syncStatus: "Synced 15m ago",
        health: "healthy",
      },
      {
        id: "worldbank-zm",
        name: "World Bank Zambia Portfolio",
        countryCode: "ZM",
        jurisdiction: "Development Projects",
        tendersCount: 6,
        syncStatus: "Synced 1h ago",
        health: "idle",
      },
    ],
    urgentDeadlines: [
      {
        id: "u-2",
        refNo: "ZPPA/RDA/2026/114",
        title: "Lusaka-Ndola Highway Dualization Works",
        entity: "Road Development Agency (Zambia)",
        countryCode: "ZM",
        amount: 1850000,
        dueDate: "06 Sep 2026",
        daysLeft: 4,
        urgency: "critical",
      },
      {
        id: "u-4",
        refNo: "ZPPA/ZESCO/2026/102",
        title: "Distribution Transformers Procurement",
        entity: "ZESCO Limited (Zambia)",
        countryCode: "ZM",
        amount: 4100000,
        dueDate: "08 Sep 2026",
        daysLeft: 6,
        urgency: "high",
      },
      {
        id: "u-6",
        refNo: "WB/ZM/WATER/2026/003",
        title: "Lusaka Sanitation Program Sub-Catchment",
        entity: "Lusaka Water Supply & Sanitation Co.",
        countryCode: "ZM",
        amount: 6500000,
        dueDate: "25 Sep 2026",
        daysLeft: 23,
        urgency: "medium",
      },
    ],
  },
};

export const MASTER_TENDER_LIST: TenderItem[] = [];

export const SUBMITTED_TENDERS_LIST: SubmittedTenderItem[] = [];

export const LOST_TENDERS_LIST: LostTenderItem[] = [];
