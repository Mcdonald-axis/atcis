import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const { client, profile } = await requireUser();
    const params = new URL(req.url).searchParams;
    const url = params.get("url");

    if (url) {
      const { data, error } = await client
        .from("procurement_plans")
        .select("details")
        .eq("payload->>viewAppUrl", url)
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ success: true, data: data?.details ?? null });
    }

    let query = client.from("procurement_plans").select("id,country,payload").order("id");
    let country = params.get("country") || "ALL";
    if (profile.role !== "super_admin" && profile.country !== "ALL") {
      country = profile.country;
    }
    if (country !== "ALL") query = query.in("country", [country, "ALL"]);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({
      success: true,
      data: (data || []).map((row) => ({ ...row.payload, id: row.id, countryCode: row.country })),
    });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load procurement plans" }, { status: 503 });
  }
}
