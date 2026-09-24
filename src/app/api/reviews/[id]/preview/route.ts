import { strFromU8, unzipSync } from "fflate";

import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

interface ReviewFile {
  id: string;
  file_name: string;
  size: number;
  storage_bucket: string;
  storage_path: string;
}

const maximumPreviewBytes = 20 * 1024 * 1024;
const maximumDocumentXmlBytes = 8 * 1024 * 1024;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function decodeXmlText(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function htmlDocument(title: string, body: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>
  :root{color-scheme:light dark}body{max-width:900px;margin:0 auto;padding:32px;font:15px/1.65 system-ui,sans-serif;background:#fff;color:#172033}
  h1{font-size:20px;margin:0 0 8px}.notice{margin:0 0 28px;color:#667085;font-size:13px}.document{white-space:pre-wrap;overflow-wrap:anywhere}
  .paragraph{margin:0 0 12px}.empty{color:#667085;font-style:italic}
  @media(prefers-color-scheme:dark){body{background:#161b26;color:#e7eaf0}.notice,.empty{color:#aab2c0}}
</style></head><body><h1>${escapeHtml(title)}</h1><p class="notice">Read-only preview. Complex Word formatting may be simplified.</p><main class="document">${body}</main></body></html>`;
}

function docxPreview(bytes: Uint8Array, filename: string) {
  const archive = unzipSync(bytes, {
    filter: (file) => file.name === "word/document.xml" && file.originalSize <= maximumDocumentXmlBytes,
  });
  const documentXml = archive["word/document.xml"];
  if (!documentXml) throw new Error("This Word file does not contain a previewable document body.");
  const xml = strFromU8(documentXml);
  const paragraphs = xml
    .split(/<\/w:p>/i)
    .map((paragraph) => {
      const text = [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gi)]
        .map((match) => decodeXmlText(match[1]))
        .join("");
      const withSpacing = paragraph.includes("<w:tab") ? text.replace(/\s*$/, "\t") : text;
      return withSpacing.trim();
    })
    .filter(Boolean);
  const body = paragraphs.length
    ? paragraphs.map((paragraph) => `<p class="paragraph">${escapeHtml(paragraph)}</p>`).join("")
    : '<p class="empty">No readable text was found in this document.</p>';
  return new Response(htmlDocument(filename, body), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="preview.html"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'",
    },
  });
}

function directPreview(bytes: Uint8Array, contentType: string, filename: string) {
  return new Response(Uint8Array.from(bytes).buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });
}

function renderPreview(bytes: Uint8Array, filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase() || "";
  if (extension === "pdf" && strFromU8(bytes.subarray(0, 5)) === "%PDF-") {
    return directPreview(bytes, "application/pdf", filename);
  }
  if (extension === "png" && bytes[0] === 0x89 && strFromU8(bytes.subarray(1, 4)) === "PNG") {
    return directPreview(bytes, "image/png", filename);
  }
  if (extension === "jpg" || extension === "jpeg") {
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return directPreview(bytes, "image/jpeg", filename);
  }
  if (extension === "gif" && ["GIF87a", "GIF89a"].includes(strFromU8(bytes.subarray(0, 6)))) {
    return directPreview(bytes, "image/gif", filename);
  }
  if (extension === "docx" && bytes[0] === 0x50 && bytes[1] === 0x4b) return docxPreview(bytes, filename);
  if (["txt", "csv", "json", "xml", "md"].includes(extension)) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return new Response(htmlDocument(filename, `<pre class="document">${escapeHtml(text)}</pre>`), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": 'inline; filename="preview.html"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'",
      },
    });
  }
  throw new Error("Inline preview is not available for this file type. Use Download to inspect the original file.");
}

export async function GET(request: Request, context: Context) {
  try {
    const { client } = await requireUser();
    const { id } = await context.params;
    const fileId = new URL(request.url).searchParams.get("file");
    if (!fileId || fileId.length > 500 || id.length > 500) throw new Error("A valid review document is required.");

    const { data: review, error: reviewError } = await client
      .from("app_records")
      .select("id")
      .eq("kind", "review")
      .eq("id", id)
      .maybeSingle();
    if (reviewError || !review) throw new Error("This review package is unavailable for your account.");

    const { data, error } = await client
      .from("review_package_files")
      .select("id,file_name,size,storage_bucket,storage_path")
      .eq("review_id", id)
      .eq("id", fileId)
      .maybeSingle();
    const file = data as ReviewFile | null;
    if (error || !file) throw new Error("The selected document is not part of this review package.");
    if (file.size < 1 || file.size > maximumPreviewBytes) {
      throw new Error("This document is too large for inline preview. Use Download instead.");
    }

    const { data: blob, error: downloadError } = await client.storage
      .from(file.storage_bucket)
      .download(file.storage_path);
    if (downloadError || !blob || blob.size !== file.size)
      throw new Error("The saved document could not be retrieved.");
    return renderPreview(new Uint8Array(await blob.arrayBuffer()), file.file_name);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "The document preview could not be loaded.";
    return new Response(message, {
      status: 422,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
}
