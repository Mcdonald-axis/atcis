export function officialDocumentPreviewUrl(downloadUrl: string): string {
  try {
    const url = new URL(downloadUrl);
    if (url.hostname.toLowerCase() === "egp.praz.org.zw") {
      return `/api/tenders/document-preview?url=${encodeURIComponent(url.href)}`;
    }
  } catch {
    // Preserve existing handling for documents from other sources.
  }
  return downloadUrl;
}
