import { NextResponse } from "next/server";

import type { TenderItem } from "@/app/(main)/dashboard/default/_components/tender-data";
import { AiProviders } from "@/lib/ai/providers";
import { requireUser } from "@/lib/supabase/server";
import {
  INTERNATIONAL_SUGGESTION_SUPPLIERS,
  mergeSupplierProfiles,
  recommendSuppliers,
  type SupplierProfile,
} from "@/lib/suppliers";

export const runtime = "nodejs";
export const maxDuration = 65;

interface ModelMatch {
  supplierId?: unknown;
  score?: unknown;
  reasons?: unknown;
}

function fallback(matches: ReturnType<typeof recommendSuppliers>) {
  return matches.map((match) => ({
    supplierId: match.supplier.id,
    supplier: match.supplier,
    score: match.score,
    reasons: match.reasons,
    matchedCapabilities: match.matchedCapabilities,
    source: match.source,
  }));
}

export async function POST(request: Request) {
  let auth: Awaited<ReturnType<typeof requireUser>>;
  try {
    auth = await requireUser();
  } catch {
    return NextResponse.json({ success: false, error: "Sign in to match suppliers." }, { status: 401 });
  }

  let tender: TenderItem;
  let requirementText = "";
  try {
    const raw = await request.text();
    if (raw.length > 80_000) throw new Error("Request too large");
    const body = JSON.parse(raw) as { tender?: TenderItem; requirementText?: unknown };
    if (!body.tender?.id || !body.tender.title || !["ZW", "ZM"].includes(body.tender.countryCode))
      throw new Error("Invalid tender");
    tender = body.tender;
    requirementText = typeof body.requirementText === "string" ? body.requirementText.slice(0, 20_000) : "";
  } catch {
    return NextResponse.json(
      { success: false, error: "A valid Zambia or Zimbabwe tender is required." },
      { status: 400 },
    );
  }

  if (auth.profile.country !== "ALL" && tender.countryCode !== auth.profile.country) {
    return NextResponse.json({ success: false, error: "Country access denied." }, { status: 403 });
  }

  const { data } = await auth.client
    .from("app_records")
    .select("payload")
    .eq("kind", "supplier")
    .in("country", [tender.countryCode, "ALL"])
    .limit(250);
  const saved = (data || []).map((row) => row.payload as SupplierProfile);
  const localProfiles = mergeSupplierProfiles(saved).filter((supplier) => supplier.countryCode === tender.countryCode);
  const profiles = [...localProfiles, ...INTERNATIONAL_SUGGESTION_SUPPLIERS];
  const ruleMatches = recommendSuppliers(tender, profiles, requirementText);
  const ruleResponse = fallback(ruleMatches);

  if (!ruleMatches.length || (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY)) {
    return NextResponse.json({
      success: true,
      matches: ruleResponse,
      provider: "rules",
      model: "Explainable rules fallback",
    });
  }

  const candidates = ruleMatches.map(({ supplier, score, matchedCapabilities }) => ({
    id: supplier.id,
    name: supplier.name,
    country: supplier.countryCode,
    sectors: supplier.sectors,
    capabilities: supplier.capabilities,
    certifications: supplier.certifications,
    procurementRegistration: supplier.procurementRegistration,
    officialSource: supplier.sourceUrl,
    candidateType: supplier.listingType === "suggestion" ? "international suggestion" : "local directory",
    baselineScore: score,
    matchedCapabilities,
  }));
  const tenderEvidence = {
    id: tender.id,
    title: tender.title,
    category: tender.category,
    sector: tender.sector,
    description: tender.description,
    countryCode: tender.countryCode,
    lineItems: (tender.lineItems || []).slice(0, 30),
    additionalRequirements: requirementText,
  };

  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]);
    const result = await new AiProviders().generate(
      {
        systemInstruction: {
          parts: [
            {
              text: `You rank supplier profiles for one procurement tender.
Use only the supplied tender and source-reviewed candidate facts.
Do not invent registrations, certifications, pricing, stock, delivery promises or experience.
Candidates are either local directory suppliers or international manufacturers eligible for sourcing research in both Zambia and Zimbabwe.
International eligibility is not evidence of local stock, registration, delivery or an authorised local partner.
Rank technical capability fit and evidence quality only; do not reward a famous brand without a direct requirement match.
Return strict JSON: {"matches":[{"supplierId":"id","score":0,"reasons":["short evidence-based reason"]}]}.
Return at most five matches and use only candidate IDs. A score must be an integer from 0 to 100.`,
            },
          ],
        },
        contents: [{ role: "user", parts: [{ text: JSON.stringify({ tender: tenderEvidence, candidates }) }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 1200, responseMimeType: "application/json" },
      },
      signal,
    );
    const text = result.content.parts
      .map((part) => part.text || "")
      .join("")
      .trim()
      .replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(text) as { matches?: ModelMatch[] };
    const allowed = new Map(ruleMatches.map((match) => [match.supplier.id, match]));
    const matches = (Array.isArray(parsed.matches) ? parsed.matches : []).flatMap((match) => {
      if (typeof match.supplierId !== "string") return [];
      const baseline = allowed.get(match.supplierId);
      if (!baseline) return [];
      const rawScore = typeof match.score === "number" ? match.score : Number(match.score);
      if (!Number.isFinite(rawScore)) return [];
      const modelScore = Math.round(rawScore);
      const evidenceBoundScore = Math.max(
        baseline.score - 10,
        Math.min(baseline.score + 10, modelScore),
      );
      return [
        {
          supplierId: match.supplierId,
          supplier: baseline.supplier,
          score: Math.max(0, Math.min(100, evidenceBoundScore)),
          reasons: baseline.reasons,
          matchedCapabilities: baseline.matchedCapabilities,
          source: baseline.source,
        },
      ];
    });

    return NextResponse.json({
      success: true,
      matches: matches.length ? matches : ruleResponse,
      provider: result.provider,
      model: result.model,
    });
  } catch {
    return NextResponse.json({
      success: true,
      matches: ruleResponse,
      provider: "rules",
      model: "Explainable rules fallback",
    });
  }
}
