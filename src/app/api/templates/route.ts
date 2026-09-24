import { requireUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { DatabaseService } from "@/lib/server-db";

export async function GET() {
  try {
    await requireUser();
    const folders = await DatabaseService.getRepositoryFolders();
    const documents = await DatabaseService.getRepositoryDocuments();

    return NextResponse.json({
      success: true,
      data: {
        folders,
        documents,
      },
    });
  } catch (error: any) {
    console.error("GET /api/templates error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load repository data" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { profile } = await requireUser();
    const body = await req.json();
    const { action } = body || {};
    const canDeleteRepositoryItems = ["country_admin", "super_admin"].includes(profile.role);

    if (action === "create_folder") {
      const { folder } = body;
      if (!folder || !folder.name) {
        return NextResponse.json({ success: false, error: "Folder data required" }, { status: 400 });
      }

      const ok = await DatabaseService.saveRepositoryFolder(folder);
      return NextResponse.json({ success: ok });
    }

    if (action === "delete_folder") {
      if (!canDeleteRepositoryItems) {
        return NextResponse.json(
          { success: false, error: "Administrator access is required to delete folders." },
          { status: 403 },
        );
      }

      const { folderId } = body;
      if (!folderId) {
        return NextResponse.json({ success: false, error: "folderId required" }, { status: 400 });
      }

      const ok = await DatabaseService.deleteRepositoryFolder(folderId);
      return NextResponse.json({ success: ok });
    }

    if (action === "upload_document") {
      const { doc } = body;
      if (!doc || !doc.name || !doc.folderId || !doc.storagePath ||
        doc.storageBucket !== "repository-documents" || !doc.fileName || !doc.sizeBytes) {
        return NextResponse.json({ success: false, error: "A document name, folder, and uploaded file are required" }, { status: 400 });
      }

      const ok = await DatabaseService.saveRepositoryDocument(doc);
      return NextResponse.json({ success: ok });
    }

    if (action === "renew_document") {
      const { docId, newExpiryDate, newRef } = body;
      if (!docId || !newExpiryDate) {
        return NextResponse.json({ success: false, error: "docId and newExpiryDate required" }, { status: 400 });
      }

      const ok = await DatabaseService.renewRepositoryDocument(docId, newExpiryDate, newRef);
      return NextResponse.json({ success: ok });
    }

    if (action === "increment_download") {
      const { docId } = body;
      if (docId) {
        await DatabaseService.incrementDocumentDownload(docId);
      }
      return NextResponse.json({ success: true });
    }

    if (action === "delete_document") {
      if (!canDeleteRepositoryItems) {
        return NextResponse.json(
          { success: false, error: "Administrator access is required to delete documents." },
          { status: 403 },
        );
      }

      const { docId } = body;
      if (!docId) {
        return NextResponse.json({ success: false, error: "docId required" }, { status: 400 });
      }

      const ok = await DatabaseService.deleteRepositoryDocument(docId);
      return NextResponse.json({ success: ok });
    }

    if (action === "clear_all_documents") {
      if (!canDeleteRepositoryItems) {
        return NextResponse.json(
          { success: false, error: "Administrator access is required to clear repository documents." },
          { status: 403 },
        );
      }

      const ok = await DatabaseService.clearAllRepositoryDocuments();
      return NextResponse.json({ success: ok });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/templates error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process repository action" },
      { status: 500 }
    );
  }
}
