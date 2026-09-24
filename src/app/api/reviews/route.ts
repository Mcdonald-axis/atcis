import { NextResponse } from "next/server";
import { DatabaseService } from "@/lib/server-db";
import { requireUser } from "@/lib/supabase/server";
import { TENDER_REVIEW_WORKFLOW } from "@/lib/review-workflow";

export async function GET(req: Request) {
  try {
    const { client } = await requireUser();
    const checklistId = new URL(req.url).searchParams.get("checklistId");
    if (checklistId) {
      const { data, error } = await client.from("app_records").select("payload")
        .eq("kind", "review").eq("id", `checklist-${checklistId}`).maybeSingle();
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, data: data?.payload || null });
    }
    const submissions = await DatabaseService.getChecklistSubmissions();
    return NextResponse.json({ success: true, data: { submissions, workflow: TENDER_REVIEW_WORKFLOW } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Cannot load reviews" }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const { client } = await requireUser();
    const body = await req.json();
    if (body.action === "save_workflow") {
      if (!Array.isArray(body.workflow) || body.workflow.length === 0) throw new Error("At least one workflow step is required");
      const roles = ["hod", "technical_review", "committee", "country_admin", "super_admin"];
      const ids = new Set();
      for (const step of body.workflow) {
        if (!step.id || ids.has(step.id) || !step.name || !roles.includes(step.requiredRole)) throw new Error("Invalid workflow step");
        ids.add(step.id);
      }
      await DatabaseService.saveWorkflowConfig(body.workflow);
      return NextResponse.json({ success: true, data: body.workflow });
    }
    if (!body.submission?.id) throw new Error("Submission id is required");
    const { data, error } = await client.rpc("review_action", {
      p_action: body.action, p_id: body.submission.id, p_payload: body.submission,
      p_step_id: body.stepId || null, p_comments: body.comments || null,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Review operation failed" }, { status: 400 });
  }
}
