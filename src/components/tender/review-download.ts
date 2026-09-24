"use client";

export async function downloadReviewFiles(reviewId: string, fileId?: string) {
  const url = `/api/reviews/${encodeURIComponent(reviewId)}/package${fileId ? `?file=${encodeURIComponent(fileId)}` : ""}`;
  const response = await fetch(url, { method: "HEAD", cache: "no-store" });
  if (!response.ok) {
    throw new Error(decodeURIComponent(response.headers.get("X-Download-Error") || "Download unavailable"));
  }
  // Native download streams to disk without retaining the whole ZIP in JS.
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
