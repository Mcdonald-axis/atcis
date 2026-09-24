import { NextResponse } from "next/server";

import { z } from "zod";

import { requireUser } from "@/lib/supabase/server";

const preferencesSchema = z.object({
  enabled: z.boolean(),
  categories: z.array(z.string().trim().min(1).max(80)).max(20),
  alertTypes: z.array(z.string().trim().min(1).max(80)).max(10),
  keywords: z.array(z.string().trim().min(1).max(80)).max(20),
  channels: z.object({
    inApp: z.boolean(),
    email: z.boolean(),
    whatsapp: z.boolean(),
  }),
  emailAddress: z.email().max(254),
  whatsappNumber: z.string().trim().max(40),
  countryScope: z.enum(["ALL", "ZW", "ZM"]),
  frequency: z.enum(["instant", "twice-daily", "daily", "weekly"]),
  minimumMatchScore: z.enum(["50", "70", "85", "95"]),
});

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = message.includes("Authentication required") ? 401 : 500;
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET() {
  try {
    const { client, user } = await requireUser();
    const { data, error } = await client
      .from("notification_preferences")
      .select("preferences,updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({
      success: true,
      data: data ? { preferences: data.preferences, savedAt: data.updated_at } : null,
    });
  } catch (error) {
    console.error("GET /api/notification-preferences error:", error);
    return errorResponse(error, "Failed to load notification preferences");
  }
}

export async function PUT(request: Request) {
  try {
    const { client, user, profile } = await requireUser();
    const parsed = preferencesSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid notification preferences" }, { status: 400 });
    }

    const requested = parsed.data;
    const countryScope = profile.country === "ALL" ? requested.countryScope : profile.country;
    const preferences = {
      ...requested,
      emailAddress: requested.emailAddress.trim().toLowerCase(),
      countryScope,
    };
    const savedAt = new Date().toISOString();
    const { error } = await client.from("notification_preferences").upsert(
      {
        user_id: user.id,
        email: preferences.emailAddress,
        enabled: preferences.enabled,
        email_enabled: preferences.channels.email,
        country_scope: preferences.countryScope,
        alert_types: preferences.alertTypes,
        preferences,
        updated_at: savedAt,
      },
      { onConflict: "user_id" },
    );

    if (error) throw error;
    return NextResponse.json({ success: true, data: { preferences, savedAt } });
  } catch (error) {
    console.error("PUT /api/notification-preferences error:", error);
    return errorResponse(error, "Failed to save notification preferences");
  }
}

export async function POST() {
  try {
    const { client } = await requireUser();
    const { data, error } = await client.functions.invoke("send-tender-alert", {
      body: { type: "TEST" },
    });
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("POST /api/notification-preferences error:", error);
    return errorResponse(error, "Failed to send test email");
  }
}
