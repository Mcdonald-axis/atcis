import type { ChecklistRequirement } from "@/components/tender/use-country-checklist";

export interface StarterTemplate {
  name: string;
  country: "ZW" | "ZM";
  description: string;
  items: ChecklistRequirement[];
}

export const STARTER_PRESET_REQUIREMENTS: Record<"ZW" | "ZM", ChecklistRequirement[]> = {
  ZW: [
    {
      id: "zw-tax-clearance",
      item: "ZIMRA Tax Clearance Certificate (ITF 263)",
      category: "Statutory & Legal",
      status: "Mandatory",
      description: "Must be valid for the current fiscal year. Confirms domestic tax compliance.",
    },
    {
      id: "zw-praz-reg",
      item: "PRAZ Annual Supplier Registration Certificate",
      category: "Statutory & Legal",
      status: "Mandatory",
      description: "Valid certificate in the relevant procurement category issued by the Procurement Regulatory Authority of Zimbabwe.",
    },
    {
      id: "zw-incorp-cert",
      item: "Certificate of Incorporation & CR14 / CR6 (Directors)",
      category: "Statutory & Legal",
      status: "Mandatory",
      description: "Certified copies stamped by Registrar of Companies or Commissioner of Oaths.",
    },
    {
      id: "zw-nssa-clearance",
      item: "NSSA Compliance Certificate",
      category: "Statutory & Legal",
      status: "Mandatory",
      description: "National Social Security Authority clearance confirming pension fund compliance.",
    },
    {
      id: "zw-bid-security",
      item: "Bid Security / Tender Bond (Bank Guarantee)",
      category: "Administrative & Bidding",
      status: "Mandatory",
      description: "Irrevocable bid bond from an accredited commercial bank or PRAZ receipt for refundable bid security deposit.",
    },
    {
      id: "zw-bid-submission-form",
      item: "Completed & Signed Bid Submission Form",
      category: "Administrative & Bidding",
      status: "Mandatory",
      description: "Duly signed by an authorized company director or holder of valid Power of Attorney.",
    },
    {
      id: "zw-audited-financials",
      item: "Audited Financial Statements (Last 2-3 Years)",
      category: "Financial & Commercial",
      status: "Mandatory",
      description: "Signed and audited by a registered public accounting firm. Demonstrates financial viability.",
    },
    {
      id: "zw-bank-rating",
      item: "Bank Rating / Financial Standing Letter",
      category: "Financial & Commercial",
      status: "Standard",
      description: "Recent letter from an established commercial bank confirming creditworthiness.",
    },
    {
      id: "zw-maf",
      item: "Manufacturer's Authorization Form (MAF)",
      category: "Technical & Quality",
      status: "Conditional",
      description: "Required when bidding on specialized hardware, machinery, or pharmaceuticals not directly manufactured by the bidder.",
    },
    {
      id: "zw-references",
      item: "Past Experience & Track Record (3 Reference Letters)",
      category: "Technical & Quality",
      status: "Mandatory",
      description: "Signed testimonial letters or completion certificates for similar contracts completed in the last 36 months.",
    },
    {
      id: "zw-personnel-cvs",
      item: "Key Personnel CVs & Educational Certificates",
      category: "Technical & Quality",
      status: "Standard",
      description: "CVs and qualifications of key technical personnel and project managers.",
    },
    {
      id: "zw-jv-agreement",
      item: "Joint Venture / Consortium Agreement",
      category: "Statutory & Legal",
      status: "Conditional",
      description: "Required if bidding as a consortium or JV. Must clearly state lead partner and percentage shares.",
    },
  ],
  ZM: [
    {
      id: "zm-pacra-cert",
      item: "PACRA Certificate of Incorporation & Shareholder List",
      category: "Statutory & Legal",
      status: "Mandatory",
      description: "Issued by the Patents and Companies Registration Agency (PACRA) Zambia.",
    },
    {
      id: "zm-zra-tax",
      item: "ZRA Valid Tax Clearance Certificate (TPIN)",
      category: "Statutory & Legal",
      status: "Mandatory",
      description: "Issued by the Zambia Revenue Authority showing active domestic tax compliance.",
    },
    {
      id: "zm-zppa-reg",
      item: "ZPPA Electronic Government Procurement (e-GP) Registration",
      category: "Statutory & Legal",
      status: "Mandatory",
      description: "Valid supplier registration certificate on the Zambia Public Procurement Authority e-GP portal.",
    },
    {
      id: "zm-napsa-cert",
      item: "NAPSA Compliance Certificate",
      category: "Statutory & Legal",
      status: "Mandatory",
      description: "Valid certificate from the National Pension Scheme Authority of Zambia.",
    },
    {
      id: "zm-wcfe-cert",
      item: "Workers' Compensation Fund Control Board (WCFCB) Certificate",
      category: "Statutory & Legal",
      status: "Mandatory",
      description: "Valid clearance certificate issued by the Workers' Compensation Fund of Zambia.",
    },
    {
      id: "zm-form-of-bid",
      item: "Form of Bid & Written Power of Attorney",
      category: "Administrative & Bidding",
      status: "Mandatory",
      description: "Properly sealed and signed by authorized officer accompanied by a certified Power of Attorney.",
    },
    {
      id: "zm-bid-securing",
      item: "Bid-Securing Declaration or Bid Bond",
      category: "Administrative & Bidding",
      status: "Mandatory",
      description: "Commercial bank guarantee or official ZPPA Bid-Securing Declaration in the required statutory format.",
    },
    {
      id: "zm-audited-financials",
      item: "Audited Financial Statements (Last 2 Years)",
      category: "Financial & Commercial",
      status: "Mandatory",
      description: "Certified financial statements showing net worth, liquidity ratio, and annual turnover.",
    },
    {
      id: "zm-ncc-cert",
      item: "National Council for Construction (NCC) Certificate",
      category: "Statutory & Legal",
      status: "Conditional",
      description: "Mandatory for civil works, construction, and engineering infrastructure tenders in Zambia.",
    },
    {
      id: "zm-maf",
      item: "Manufacturer's Authorization Form (MAF)",
      category: "Technical & Quality",
      status: "Conditional",
      description: "Official authorization from the OEM/Manufacturer for equipment or goods supply.",
    },
    {
      id: "zm-client-references",
      item: "Evidence of Similar Contracts Executed (3 Client References)",
      category: "Technical & Quality",
      status: "Mandatory",
      description: "Reference letters or copies of award contracts for similar supply or works within SADC/COMESA.",
    },
    {
      id: "zm-litigation",
      item: "Litigation History Declaration",
      category: "Administrative & Bidding",
      status: "Standard",
      description: "Signed statement detailing any current or past litigation or arbitration over the past 5 years.",
    },
  ],
};

export const DEFAULT_STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: "PRAZ Standard Procurement & Supply Checklist",
    country: "ZW",
    description: "Standard statutory and technical compliance checklist for public tenders published on the PRAZ portal in Zimbabwe.",
    items: STARTER_PRESET_REQUIREMENTS.ZW.filter((i) => i.id !== "zw-jv-agreement"),
  },
  {
    name: "PRAZ Works & Engineering Infrastructure Checklist",
    country: "ZW",
    description: "Full compliance and technical evaluation checklist for civil works, construction, and infrastructure projects in Zimbabwe.",
    items: STARTER_PRESET_REQUIREMENTS.ZW,
  },
  {
    name: "ZPPA Standard Goods & Services Checklist",
    country: "ZM",
    description: "Standard statutory compliance checklist for tenders governed by the Zambia Public Procurement Authority (ZPPA e-GP).",
    items: STARTER_PRESET_REQUIREMENTS.ZM.filter((i) => i.id !== "zm-ncc-cert"),
  },
  {
    name: "ZPPA Works & Construction Contracts Checklist",
    country: "ZM",
    description: "Complete compliance checklist including NCC registration and plant equipment for Zambian construction and engineering contracts.",
    items: STARTER_PRESET_REQUIREMENTS.ZM,
  },
];
