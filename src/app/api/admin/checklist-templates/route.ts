import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";

const itemStatusEnum = z.enum(["Mandatory", "Conditional", "Standard", "Optional"]);

const requirementItemSchema = z.object({
  id: z.string().trim().min(1).max(100),
  item: z.string().trim().min(1).max(500),
  category: z.string().trim().max(100).default("General"),
  status: itemStatusEnum,
  description: z.string().trim().max(2000).default(""),
});

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  country: z.enum(["ZW", "ZM"]),
  items: z.array(requirementItemSchema).min(1).max(100),
});

const updateTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  country: z.enum(["ZW", "ZM"]),
  items: z.array(requirementItemSchema).min(1).max(100),
});

function hasDuplicateIds(items: Array<{ id: string }>): boolean {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) return true;
    ids.add(item.id);
  }
  return false;
}

/**
 * GET /api/admin/checklist-templates?country=ZW|ZM
 * Returns all checklist templates or filtered by country
 */
export async function GET(request: Request) {
  try {
    const { profile } = await requireUser();
    if (!["super_admin", "country_admin"].includes(profile.role)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const countryParam = searchParams.get("country")?.toUpperCase();

    const admin = createAdminClient();
    let query = admin.from("checklist_templates").select("*").order("created_at", { ascending: false });

    // Country admin is restricted to their assigned country
    if (profile.role === "country_admin") {
      query = query.eq("country", profile.country);
    } else if (countryParam === "ZW" || countryParam === "ZM") {
      query = query.eq("country", countryParam);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, templates: data || [] });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load checklist templates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/checklist-templates
 * Creates a new checklist template
 */
export async function POST(request: Request) {
  try {
    const { user, profile } = await requireUser();
    if (!["super_admin", "country_admin"].includes(profile.role)) {
      return NextResponse.json({ success: false, error: "Administrator access required" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid template data" },
        { status: 400 }
      );
    }

    const { name, country, items } = parsed.data;

    // Country admin check
    if (profile.role === "country_admin" && profile.country !== country) {
      return NextResponse.json(
        { success: false, error: `You can only create templates for your assigned country (${profile.country})` },
        { status: 403 }
      );
    }

    if (hasDuplicateIds(items)) {
      return NextResponse.json(
        { success: false, error: "Checklist requirement IDs must be unique" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("checklist_templates")
      .insert({
        name,
        country,
        items,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { success: false, error: `A template named "${name}" already exists for ${country === "ZW" ? "Zimbabwe" : "Zambia"}.` },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, template: data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create checklist template" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/checklist-templates
 * Updates an existing checklist template
 */
export async function PUT(request: Request) {
  try {
    const { profile } = await requireUser();
    if (!["super_admin", "country_admin"].includes(profile.role)) {
      return NextResponse.json({ success: false, error: "Administrator access required" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid template data" },
        { status: 400 }
      );
    }

    const { id, name, country, items } = parsed.data;

    if (profile.role === "country_admin" && profile.country !== country) {
      return NextResponse.json(
        { success: false, error: `You can only modify templates for ${profile.country}` },
        { status: 403 }
      );
    }

    if (hasDuplicateIds(items)) {
      return NextResponse.json(
        { success: false, error: "Checklist requirement IDs must be unique" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("checklist_templates")
      .update({
        name,
        country,
        items,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { success: false, error: `Another template named "${name}" already exists for ${country === "ZW" ? "Zimbabwe" : "Zambia"}.` },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, template: data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update checklist template" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/checklist-templates?id=UUID
 * Deletes a checklist template
 */
export async function DELETE(request: Request) {
  try {
    const { profile } = await requireUser();
    if (!["super_admin", "country_admin"].includes(profile.role)) {
      return NextResponse.json({ success: false, error: "Administrator access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Template ID is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Check if template exists
    const { data: existing, error: findError } = await admin
      .from("checklist_templates")
      .select("id, country, name")
      .eq("id", id)
      .maybeSingle();

    if (findError) throw findError;
    if (!existing) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    if (profile.role === "country_admin" && profile.country !== existing.country) {
      return NextResponse.json({ success: false, error: "Permission denied for this country" }, { status: 403 });
    }

    // Check if active tender checklists reference this template
    const { count, error: countError } = await admin
      .from("tender_checklists")
      .select("id", { count: "exact", head: true })
      .eq("template_id", id);

    if (countError) throw countError;
    if (count && count > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete template "${existing.name}". It is currently applied to ${count} active tender checklist(s).`,
        },
        { status: 409 }
      );
    }

    const { error: deleteError } = await admin.from("checklist_templates").delete().eq("id", id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true, message: `Template "${existing.name}" deleted successfully` });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete checklist template" },
      { status: 500 }
    );
  }
}
