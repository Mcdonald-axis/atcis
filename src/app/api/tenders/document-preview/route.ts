import { requireUser } from "@/lib/supabase/server";

const maximumBytes = 50 * 1024 * 1024;

function officialUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "egp.praz.org.zw"
    || (url.port && url.port !== "443") || url.username || url.password) {
    throw new Error("Only official Zimbabwe e-GP documents can be previewed here.");
  }
  return url;
}

export async function GET(request: Request) {
  try {
    await requireUser();
  } catch {
    return new Response("Please sign in to preview this document.", { status: 401 });
  }

  try {
    let url = officialUrl(new URL(request.url).searchParams.get("url") || "");
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30000)]);
    let response: Response | undefined;
    for (let redirects = 0; redirects <= 4; redirects++) {
      response = await fetch(url, { redirect: "manual", cache: "no-store", signal });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || redirects === 4) throw new Error("The official document could not be opened.");
      // Revalidate every redirect; never proxy other hosts or forward credentials.
      url = officialUrl(new URL(location, url).href);
    }
    if (!response?.ok || !response.body) throw new Error("The official document is currently unavailable.");
    if (Number(response.headers.get("content-length")) > maximumBytes) {
      await response.body.cancel();
      throw new Error("This document is too large for the inline preview. Use Download to save it.");
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maximumBytes) {
          await reader.cancel();
          throw new Error("This document is too large for the inline preview. Use Download to save it.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes("%PDF-")) {
      throw new Error("An inline PDF preview is not available for this file. Use Download if you want to save it.");
    }

    // The portal may send attachment/octet-stream headers. Only verified PDFs
    // reach the browser, always with inline disposition; other formats show text.
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="egp-document.pdf"',
        "Content-Length": String(size),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
  } catch (cause) {
    const message = cause instanceof Error && cause.name !== "TimeoutError" && cause.name !== "AbortError"
      ? cause.message : "The preview could not be loaded. Please try again or use Download.";
    return new Response(message, {
      status: 422,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store",
        "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff" },
    });
  }
}
