import { NextResponse } from "next/server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";

const changePasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid password provided" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // Update password in Supabase Auth and remove the must_change_password flag
    const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
      password: parsed.data.password,
      user_metadata: { must_change_password: false },
    });
    if (authError) {
      return NextResponse.json(
        { success: false, error: authError.message || "Failed to update authentication password" },
        { status: 400 },
      );
    }

    // Clear must_change_password on profiles
    const { error: profileError } = await admin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id);
    if (profileError) {
      return NextResponse.json(
        { success: false, error: profileError.message || "Failed to update profile status" },
        { status: 500 },
      );
    }

    // Record audit trail
    await admin.from("admin_audit_logs").insert({
      actor_id: user.id,
      target_id: user.id,
      action: "password_changed",
      details: { forced_reset: true },
    });

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Password update failed" },
      { status: 401 },
    );
  }
}
