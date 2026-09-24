import { NextResponse } from "next/server";

import { requireUser } from "@/lib/supabase/server";

const CRM_TIMEZONE_OFFSET_MINUTES = 2 * 60;

/** Format a value for Zoho CRM DateTime fields (ISO 8601, no milliseconds). */
function formatZohoDateTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const raw = value instanceof Date ? value.toISOString() : String(value).trim();
  const dateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(raw);
  if (dateOnly) return `${dateOnly[1]}T00:00:00+02:00`;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  const localTime = new Date(parsed.getTime() + CRM_TIMEZONE_OFFSET_MINUTES * 60_000);
  return `${localTime.toISOString().slice(0, 19)}+02:00`;
}

function getCountryName(code?: string): string {
  const c = String(code || "")
    .toUpperCase()
    .trim();
  if (c === "ZM") return "Zambia";
  if (c === "ZW") return "Zimbabwe";
  return code || "Unknown";
}

function getWebhookUrlForCountry(countryCode?: string): string | null {
  const code = String(countryCode || "")
    .toUpperCase()
    .trim();
  if (code === "ZM") {
    return process.env.ZOHO_CRM_WEBHOOK_ZM || null;
  }
  if (code === "ZW") {
    return process.env.ZOHO_CRM_WEBHOOK_ZW || null;
  }
  // Default to ZM if unspecified or generic
  return process.env.ZOHO_CRM_WEBHOOK_ZM || process.env.ZOHO_CRM_WEBHOOK_ZW || null;
}

/**
 * GET /api/crm/zoho
 * Returns connection and configuration status for each country without exposing webhook endpoints
 */
export async function GET() {
  const zmUrl = process.env.ZOHO_CRM_WEBHOOK_ZM || null;
  const zwUrl = process.env.ZOHO_CRM_WEBHOOK_ZW || null;

  return NextResponse.json({
    success: true,
    countries: {
      ZM: {
        code: "ZM",
        name: "Zambia",
        configured: Boolean(zmUrl),
      },
      ZW: {
        code: "ZW",
        name: "Zimbabwe",
        configured: Boolean(zwUrl),
      },
    },
  });
}

/**
 * POST /api/crm/zoho
 * Dispatches a tender payload to the country-specific Zoho CRM webhook
 */
export async function POST(req: Request) {
  try {
    const { user, profile } = await requireUser();
    const body = await req.json();
    const { event = "tender_pipeline_added", tender, countryCode: explicitCountry, stage = "New" } = body || {};

    const requestedCountryCode = String(
      explicitCountry || tender?.countryCode || (tender?.refNo?.includes("ZPPA") ? "ZM" : "ZW"),
    )
      .toUpperCase()
      .trim();

    // CRM routing follows the authenticated user's assigned market. Tender catalogue
    // records can legitimately be marked ALL (regional/multilateral), but ALL is a
    // visibility scope rather than a Zoho CRM destination.
    const profileCountry = String(profile.country ?? "")
      .toUpperCase()
      .trim();
    const countryCode = ["ZM", "ZW"].includes(profileCountry) ? profileCountry : requestedCountryCode;

    const countryName = getCountryName(countryCode);
    if (!["ZM", "ZW"].includes(countryCode)) {
      return NextResponse.json({ success: false, error: "A valid Zoho CRM country is required." }, { status: 400 });
    }
    const webhookUrl = getWebhookUrlForCountry(countryCode);

    if (!webhookUrl) {
      return NextResponse.json(
        {
          success: false,
          error: `No Zoho CRM webhook URL configured for ${countryName} (${countryCode}). Set ZOHO_CRM_WEBHOOK_${countryCode} in your configuration.`,
          countryCode,
          countryName,
        },
        { status: 400 },
      );
    }

    const estValue = Number(tender?.pipelineValue ?? tender?.estimatedValue ?? 0);
    const awarded = Number(tender?.amountAwarded || 0);
    const cost = Number(tender?.actualCost || 0);
    const grossMargin = Number(tender?.grossMargin || (awarded > 0 && cost > 0 ? awarded - cost : 0));
    const baseValue = awarded > 0 ? awarded : estValue;
    const marginPct = baseValue > 0 && grossMargin > 0 ? Math.round((grossMargin / baseValue) * 100) : 0;
    const tenderTitle = tender?.title || `Tender ${tender?.refNo || tender?.id || ""}`;
    const orgEntity = tender?.entity || tender?.procuringEntity || "National Procuring Authority";
    const syncActorEmail = String(profile.email ?? user.email ?? "")
      .trim()
      .toLowerCase();
    const syncActorName = String(profile.name ?? syncActorEmail).trim();

    if (!syncActorEmail) {
      return NextResponse.json(
        { success: false, error: "Your ATCIS profile needs the email address of your Zoho CRM account." },
        { status: 400 },
      );
    }

    // Zoho CRM DateTime fields require seconds and an explicit timezone, without milliseconds.
    const rawDeadline = tender?.dueDate || tender?.closingDate;
    const deadlineIso = formatZohoDateTime(rawDeadline);

    // Exact fields matching user's Zoho CRM CustomModule1 ("Tenders Zambia") API names
    const primaryName = `${orgEntity} - ${tender?.refNo || tenderTitle}`.slice(0, 120);
    const submissionDate = deadlineIso || formatZohoDateTime(Date.now() + 14 * 86400000);
    const submittedAt = stage === "Submitted" || stage === "Won" ? formatZohoDateTime(new Date()) : null;
    const tenderValStr = (awarded > 0 ? awarded : estValue).toString();
    const productsServices = `${tender?.team || "General Procurement"} - ${tenderTitle}`.slice(0, 255);
    const compilationPct = Number(tender?.progress || 0);

    const customModule1Data = {
      // Primary Record Name: Tendering Organization (API Name: Name)
      Name: primaryName,
      Budget_Amt: estValue,
      Tender_Value: tenderValStr,
      Tender_Status: stage || "New",
      Compilation_Percentage: compilationPct,
      Gross_Profit_USD: grossMargin,
      GP_Age: marginPct,
      Products_Services_Supplied: productsServices,
      Official_Submission_Date: submissionDate,
      Date_Tender_Submitted: submittedAt,
      Currency: tender?.currency || "USD",
      Checked_for_Compliance: "Yes",
      Tender_Budget_Available: estValue > 0 ? "Yes" : "Pending",
      Reason_for_Tender_Loss: tender?.winLossReason || "",
      Comments: tender?.lessonsLearned || tender?.deliveryStatusNotes || tender?.description || "",
      Comment: tender?.description ? tender.description.slice(0, 250) : "",
      Tag: countryCode === "ZM" ? "ZPPA" : "PRAZ",
      // Zoho Flow uses this authenticated email to fetch the corresponding CRM user.
      Owner: syncActorEmail,
      Email: tender?.owner?.email || "",
      Exchange_Rate: 1.0,
      Email_Opt_Out: false,
    };

    // Human-readable labels matching exact Zoho Flow UI field names
    const displayLabelFields = {
      "Tendering Organization": primaryName,
      Tendering_Organization: primaryName,
      tendering_organization: primaryName,
      "Tendering Org": primaryName,
      "Budget Amt": estValue,
      "Tender Value": tenderValStr,
      "Tender Status": stage || "New",
      "Compilation Percentage": compilationPct,
      "Gross Profit (USD)": grossMargin,
      "GP % Age": marginPct,
      "Products / Services Supplied": productsServices,
      Products_Services_Supplied: productsServices,
      "Official Submission Date": submissionDate,
      "Date Tender Submitted": submittedAt,
      "Tenders Zambia Owner": syncActorEmail,
      "Tenders Zimbabwe Owner": syncActorEmail,
      "Deal Owner": syncActorEmail,
      "Synced By": syncActorName,
      "Synced By Email": syncActorEmail,
      "Checked for Compliance": "Yes",
      "Tender Budget Available": estValue > 0 ? "Yes" : "Pending",
      "Reason for Tender Loss / Award": tender?.winLossReason || "",
    };

    // Standardized flat + structured payload for Zoho Flow mapping to Zoho CRM CustomModule1 or Deals
    const payload = {
      // 1. Root-level fields matching Zoho CRM API names directly
      ...customModule1Data,

      // 2. Root-level fields matching Zoho Flow display names with spaces
      ...displayLabelFields,

      event,
      timestamp: new Date().toISOString(),
      module_target: countryCode === "ZM" ? "CustomModule1" : "Deals",
      module_label: countryCode === "ZM" ? "Tenders Zambia" : "Tenders Zimbabwe",

      country: {
        code: countryCode,
        name: countryName,
      },

      // Nested structures for different Zoho Flow trigger container extraction models
      body: {
        ...customModule1Data,
        ...displayLabelFields,
      },
      payload: {
        ...customModule1Data,
        ...displayLabelFields,
      },

      // Nested structure specifically for Tenders Zambia (CustomModule1)
      CustomModule1: {
        ...customModule1Data,
        ...displayLabelFields,
      },
      Tenders_Zambia: {
        ...customModule1Data,
        ...displayLabelFields,
      },

      // Standard CRM Deals mapping (if user prefers mapping to Deals module)
      deal: {
        deal_name: tenderTitle,
        stage: stage || "New",
        amount: awarded > 0 ? awarded : estValue,
        closing_date: deadlineIso,
        account_name: orgEntity,
        lead_source: tender?.sourcePortal || (countryCode === "ZM" ? "ZPPA e-GP" : "PRAZ e-GP"),
        pipeline_category: tender?.team || "General Procurement",
        priority: tender?.priority || "High",
      },

      tender_data: {
        tender_id: tender?.id || "",
        reference_number: tender?.refNo || tender?.id || "",
        title: tenderTitle,
        procuring_entity: orgEntity,
        country_code: countryCode,
        country_name: countryName,
        pipeline_stage: stage,
        estimated_budget_usd: estValue,
        amount_awarded_usd: awarded,
        actual_execution_cost_usd: cost,
        gross_margin_usd: grossMargin,
        margin_percentage: marginPct,
        sector: tender?.team || "",
        priority: tender?.priority || "Medium",
        closing_date: rawDeadline || "",
        progress_percentage: Number(tender?.progress || 0),
        ai_fit_score: Number(tender?.aiScore || 85),
        source_portal: tender?.sourcePortal || (countryCode === "ZM" ? "ZPPA e-GP" : "PRAZ e-GP"),
        portal_url: tender?.portalUrl || "",
        assigned_owner: syncActorName,
        assigned_owner_email: syncActorEmail,
        win_loss_reason: tender?.winLossReason || "",
        lessons_learned: tender?.lessonsLearned || "",
        delivery_status_notes: tender?.deliveryStatusNotes || "",
        signed_contract_ref: tender?.contractRef || "",
        lead_partner: tender?.leadPartner || "",
        satisfaction_score: tender?.satisfactionScore || null,
        synced_at: new Date().toISOString(),
      },

      // Raw object for custom webhook field mappings
      // Preserve the tender fields used by existing Flow mappings, but replace the
      // UI-only owner object ({ name, tone }) with the authenticated Zoho email.
      raw_tender: {
        ...(tender || {}),
        owner: syncActorEmail,
        ownerName: syncActorName,
        ownerEmail: syncActorEmail,
      },
      sync_actor: {
        id: user.id,
        name: syncActorName,
        email: syncActorEmail,
        country: countryCode,
      },
    };

    let response: Response;
    try {
      response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "ATCIC-Tender-Pipeline/1.0",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
    } catch (networkError: any) {
      return NextResponse.json(
        {
          success: false,
          error: `Network timeout or connection error contacting Zoho Flow: ${networkError.message || networkError}`,
          countryCode,
          countryName,
        },
        { status: 502 },
      );
    }

    const resText = await response.text();
    let resJson: any = null;
    try {
      resJson = JSON.parse(resText);
    } catch {
      // not json
    }

    if (response.status === 410) {
      return NextResponse.json(
        {
          success: false,
          status: 410,
          error: `Zoho Flow returned HTTP 410. In Zoho Flow, this means the Flow is currently turned OFF (inactive) or paused. Please open your Zoho Flow dashboard and toggle the flow switch to ON.`,
          details: resJson || resText,
          countryCode,
          countryName,
        },
        { status: 410 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          status: response.status,
          error: `Zoho Flow responded with status ${response.status}: ${resText}`,
          details: resJson || resText,
          countryCode,
          countryName,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      status: response.status,
      message: `Successfully synced "${tender?.refNo || tender?.title || "Tender"}" to ${countryName} Zoho CRM.`,
      countryCode,
      countryName,
      details: resJson || { status: "received" },
    });
  } catch (error: any) {
    const message = error.message || "Internal server error during Zoho CRM sync";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: message === "Authentication required" ? 401 : 500 },
    );
  }
}
