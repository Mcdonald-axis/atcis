import { Zip, ZipPassThrough } from "fflate";
import { NextResponse } from "next/server";
import type { ChecklistSubmission } from "@/lib/server-db";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };
interface PackageFile {
  id: string;
  category: string;
  name: string;
  file_name: string;
  size: number;
  storage_bucket: string;
  storage_path: string;
}

function safeName(value: string) {
  return value.replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g, "_").replace(/^\.+/, "_").slice(0, 160) || "document";
}

async function packageAccess(req: Request, context: Context) {
  const { client } = await requireUser();
  const { id } = await context.params;
  const fileId = new URL(req.url).searchParams.get("file");
  const { data: record, error } = await client.from("app_records").select("payload")
    .eq("kind", "review").eq("id", id).single();
  if (error || !record) throw new Error("Submission unavailable for your account");
  const submission = record.payload as ChecklistSubmission;
  if (!fileId && submission.overallStatus !== "Approved for Submission") {
    throw new Error("All three review stages must approve before downloading the complete package");
  }
  const files: PackageFile[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = client.from("review_package_files").select("*").eq("review_id", id).order("id");
    if (fileId) query = query.eq("id", fileId);
    const { data, error: filesError } = await query.range(offset, offset + 499);
    if (filesError) throw new Error(filesError.message);
    files.push(...(data as PackageFile[]));
    if (data.length < 500 || files.length > 65000) break;
  }
  if (!files.length) throw new Error("No saved files in this package. Submit the checklist from the tender page");
  // fflate writes standard ZIP archives (32-bit offsets), not ZIP64.
  if (files.length > 65000 || files.reduce((sum, file) => sum + file.size + 1024, 0) > 4_000_000_000) {
    throw new Error("This package exceeds the ZIP size limit. Download the documents individually");
  }
  return { client, submission, files, fileId };
}

export async function HEAD(req: Request, context: Context) {
  try {
    await packageAccess(req, context);
    return new Response(null, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Download unavailable";
    return new Response(null, { status: 403, headers: { "X-Download-Error": encodeURIComponent(message) } });
  }
}

export async function GET(req: Request, context: Context) {
  try {
    const { client, submission, files, fileId } = await packageAccess(req, context);
    const filename = fileId ? safeName(files[0].file_name) : `${safeName(submission.tenderRef)}_Approved_Package.zip`;
    const headers = {
      "Content-Type": fileId ? "application/octet-stream" : "application/zip",
      "Content-Disposition": `attachment; filename="download.${fileId ? "bin" : "zip"}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (fileId) {
      const file = files[0];
      const { data, error } = await client.storage.from(file.storage_bucket).download(file.storage_path);
      if (error || !data || data.size !== file.size) throw new Error(`Could not retrieve ${file.file_name}`);
      return new Response(data, { headers });
    }

    // Pull-driven output keeps at most one source file in memory. Repeated
    // filenames get a stable prefix, so every checklist/reference is included.
    async function* archive() {
      const output: Uint8Array[] = [];
      const zip = new Zip((error, chunk) => {
        if (error) throw error;
        output.push(chunk);
      });
      try {
        for (const [index, file] of files.entries()) {
          if (req.signal.aborted) throw new Error("Download cancelled");
          const { data, error } = await client.storage.from(file.storage_bucket).download(file.storage_path);
          if (error || !data || data.size !== file.size) throw new Error(`Could not retrieve ${file.file_name}`);
          const entry = new ZipPassThrough(`${safeName(file.category)}/${index + 1}_${safeName(file.file_name)}`);
          zip.add(entry);
          entry.push(new Uint8Array(await data.arrayBuffer()), true);
          while (output.length) yield output.shift()!;
        }
        const manifest = new ZipPassThrough("Approval_Record.json");
        zip.add(manifest);
        manifest.push(new TextEncoder().encode(JSON.stringify({ ...submission,
          archiveFiles: files.map((file, index) => ({ id: file.id, requirement: file.name,
            path: `${safeName(file.category)}/${index + 1}_${safeName(file.file_name)}` })),
        }, null, 2)), true);
        zip.end();
        while (output.length) yield output.shift()!;
      } finally {
        zip.terminate();
      }
    }
    const iterator = archive();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const result = await iterator.next();
          if (result.done) controller.close();
          else controller.enqueue(result.value);
        } catch (cause) {
          controller.error(cause);
        }
      },
      async cancel() { await iterator.return(undefined); },
    });
    return new Response(stream, { headers });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Download failed" }, { status: 403 });
  }
}
