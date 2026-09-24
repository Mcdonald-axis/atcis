import { requireUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { DatabaseService, type DbAssignment } from "@/lib/server-db";

export async function GET() {
  try {
    await requireUser();
    let assignments = await DatabaseService.getAssignments();

    return NextResponse.json({
      success: true,
      source: "database",
      data: assignments,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to query database" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = await req.json();
    if (!body || !body.id) {
      return NextResponse.json({ success: false, error: "Missing assignment data" }, { status: 400 });
    }

    const ok = await DatabaseService.upsertAssignment(body);
    if (!ok) {
      return NextResponse.json({ success: false, error: "Database save failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: body });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Database write error" },
      { status: 500 }
    );
  }
}
