import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { collectTenderOutcomes, type OutcomeSourceRecord } from "@/lib/tender-outcomes";
import { STARTER_SUPPLIERS } from "@/lib/suppliers";

const kinds = new Set(["partner", "supplier", "registration", "renewal", "lesson"]);
type Context = { params: Promise<{ kind: string }> };

export async function GET(_req: Request, context: Context) {
  const { kind } = await context.params;
  if (!kinds.has(kind)) return NextResponse.json({ success: false }, { status: 404 });
  const { client, profile } = await requireUser();
  if (kind === "lesson") {
    const rows: OutcomeSourceRecord[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client
        .from("app_records")
        .select("kind,id,country,payload")
        .in("kind", ["lesson", "pipeline"])
        .order("updated_at", { ascending: false })
        .order("kind")
        .order("id")
        .range(offset, offset + 499);
      if (error)
        return NextResponse.json({ success: false, error: "Could not load tender outcomes." }, { status: 503 });
      rows.push(...((data || []) as OutcomeSourceRecord[]));
      if (!data || data.length < 500) break;
    }
    const isAm = profile.role === "account_manager";
    const userEmail = (profile.email || "").toLowerCase().trim();

    const filteredRows = isAm
      ? rows.filter((row) => row.kind !== "pipeline" || row.id.toLowerCase().trim() === userEmail)
      : rows;

    let outcomes = collectTenderOutcomes(filteredRows).filter(
      (item) => profile.country === "ALL" || item.countryCode === profile.country,
    );

    if (isAm) {
      outcomes = outcomes.filter((item) => item.outcome === "Won");
    }

    return NextResponse.json({ success: true, data: outcomes });
  }
  const { data, error } = await client
    .from("app_records")
    .select("payload")
    .eq("kind", kind)
    .order("updated_at", { ascending: false });
  return NextResponse.json(
    { success: !error, data: (data || []).map((row) => row.payload) },
    { status: error ? 503 : 200 },
  );
}

export async function POST(req: Request, context: Context) {
  const { kind } = await context.params;
  if (!kinds.has(kind)) return NextResponse.json({ success: false }, { status: 404 });
  const { client, profile } = await requireUser();
  let payload: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 100_000) throw new Error();
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    payload = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid record." }, { status: 400 });
  }
  const recordId = typeof payload.id === "string" ? payload.id.trim() : "";
  const recordCountry = typeof payload.countryCode === "string" ? payload.countryCode : "";
  if (!recordId || !["ZW", "ZM", "ALL"].includes(recordCountry))
    return NextResponse.json({ success: false, error: "ID and country are required" }, { status: 400 });
  if (kind === "supplier") {
    const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
    const list = (value: unknown, maxItems = 30) =>
      Array.isArray(value)
        ? [
            ...new Set(
              value
                .filter((item): item is string => typeof item === "string")
                .map((item) => item.trim())
                .filter(Boolean),
            ),
          ].slice(0, maxItems)
        : [];
    const countryCode = recordCountry;
    const id = text(recordId, 100);
    const validId = new RegExp(`^supplier-${String(countryCode).toLowerCase()}-[0-9a-f-]{36}$`, "i").test(id);
    const name = text(payload.name, 160);
    const city = text(payload.city, 120);
    const summary = text(payload.summary, 1200);
    const sectors = list(payload.sectors);
    const capabilities = list(payload.capabilities, 60);
    if (
      !["ZW", "ZM"].includes(String(countryCode)) ||
      !validId ||
      !name ||
      !city ||
      !summary ||
      !sectors.length ||
      !capabilities.length
    ) {
      return NextResponse.json({ success: false, error: "Complete the required supplier fields." }, { status: 400 });
    }
    payload = {
      ...payload,
      id,
      name,
      countryCode,
      countryName: countryCode === "ZM" ? "Zambia" : "Zimbabwe",
      city,
      summary,
      sectors,
      capabilities,
      brands: list(payload.brands),
      certifications: list(payload.certifications),
      procurementRegistration:
        text(payload.procurementRegistration, 300) || `${countryCode === "ZM" ? "ZPPA" : "PRAZ"} verification required`,
      verificationStatus: "Pending review",
      contactPerson: text(payload.contactPerson, 160) || "Supplier contact",
      email: text(payload.email, 254),
      phone: text(payload.phone, 60),
      website: text(payload.website, 500),
      leadTime: text(payload.leadTime, 160) || "Confirm with supplier",
      status: "Active",
      updatedAt: new Date().toISOString(),
      createdByEmail: profile.email,
      createdByName: profile.name,
    };
  }
  const { data, error } = await client.rpc("save_app_record", { p_kind: kind, p_id: recordId, p_payload: payload });
  return NextResponse.json({ success: !error, data, error: error?.message }, { status: error ? 400 : 200 });
}

export async function DELETE(req: Request, context: Context) {
  const { kind } = await context.params;
  if (!kinds.has(kind)) return NextResponse.json({ success: false }, { status: 404 });
  const { client, profile } = await requireUser();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const isAll = url.searchParams.get("all") === "true" || id === "all";

  if (kind === "supplier" && !["country_admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json(
      { success: false, error: "Administrator access is required to delete supplier profiles." },
      { status: 403 },
    );
  }

  if (isAll) {
    const { error } = await client.from("app_records").delete().eq("kind", kind);
    return NextResponse.json({ success: !error, error: error?.message }, { status: error ? 400 : 200 });
  }

  if (!id) return NextResponse.json({ success: false, error: "Record ID is required" }, { status: 400 });

  if (kind === "supplier") {
    const starter = STARTER_SUPPLIERS.find((s) => s.id === id);
    if (starter) {
      const tombstone = {
        ...starter,
        deleted: true,
        status: "Inactive",
        updatedAt: new Date().toISOString(),
        deletedByEmail: profile.email,
        deletedByName: profile.name,
      };
      const { data, error } = await client.rpc("save_app_record", {
        p_kind: kind,
        p_id: id,
        p_payload: tombstone,
        p_delete: false,
      });
      return NextResponse.json({ success: !error, data, error: error?.message }, { status: error ? 400 : 200 });
    }

    const countryFromQuery = url.searchParams.get("country");
    const targetCountry =
      countryFromQuery && ["ZW", "ZM"].includes(countryFromQuery)
        ? countryFromQuery
        : id.toLowerCase().includes("-zm")
        ? "ZM"
        : id.toLowerCase().includes("-zw")
        ? "ZW"
        : profile.country === "ALL"
        ? "ZW"
        : profile.country;

    const { data, error } = await client.rpc("save_app_record", {
      p_kind: kind,
      p_id: id,
      p_payload: { countryCode: targetCountry },
      p_delete: true,
    });
    return NextResponse.json({ success: !error, data, error: error?.message }, { status: error ? 400 : 200 });
  }

  const { data, error } = await client.rpc("save_app_record", {
    p_kind: kind,
    p_id: id,
    p_payload: {},
    p_delete: true,
  });
  return NextResponse.json({ success: !error, data, error: error?.message }, { status: error ? 400 : 200 });
}
