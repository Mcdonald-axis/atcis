import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { client, user, profile } = await requireUser();
    if (!["super_admin", "country_admin"].includes(profile.role)) {
      return NextResponse.json({ success: false, message: "Only administrators can start a scrape" }, { status: 403 });
    }
    const { pages = 5 } = await req.json();
    if (!Number.isInteger(pages) || pages < 1 || pages > 50) return NextResponse.json({ success: false, message: "Pages must be between 1 and 50" }, { status: 400 });
    const { data, error } = await client.from("scrape_requests").insert({ requested_by: user.id, pages }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ success: true, id: data.id, message: "Scrape queued. The running ASP.NET scraper will pick it up; completion is recorded in Supabase." }, { status: 202 });
  } catch {
    return NextResponse.json({ success: false, message: "Could not queue the scrape" }, { status: 503 });
  }
}

export async function GET() {
  const { client } = await requireUser();
  const { data, error } = await client.from("scrape_requests").select("*").order("created_at", { ascending: false }).limit(20);
  return NextResponse.json({ success: !error, data: data || [] }, { status: error ? 503 : 200 });
}
