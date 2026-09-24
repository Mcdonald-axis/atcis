import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ReferenceDocument = {
  file_name: string;
  file_size: number;
  storage_path: string;
};

export async function GET(request: Request) {
  try {
    const { client } = await requireUser();
    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return new Response("A valid stored tender document is required.", { status: 400 });
    }

    const { data, error } = await client
      .from("tender_reference_documents")
      .select("file_name,file_size,storage_path")
      .eq("id", id)
      .maybeSingle();
    const reference = data as ReferenceDocument | null;
    if (error || !reference) return new Response("Tender document not found.", { status: 404 });

    const { data: blob, error: downloadError } = await client.storage
      .from("reference-documents")
      .download(reference.storage_path);
    if (downloadError || !blob || blob.size !== reference.file_size) {
      return new Response("The stored tender document could not be retrieved.", { status: 502 });
    }

    return new Response(blob, {
      headers: {
        "Content-Type": blob.type || "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(reference.file_name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The tender document could not be loaded.";
    return new Response(message, { status: message === "Authentication required" ? 401 : 500 });
  }
}
