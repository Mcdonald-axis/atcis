# Shared public tender reads

`GET /api/tenders` authenticates each request before returning public notices
within the profile's country permissions. Pipelines, reference documents,
checklist files and review packages are not part of this cache.

The directory requests 50 summaries per page by default (maximum 100). Search,
sector, portal, status, confidence and sorting operate across the full authorised
catalogue on the server, before pagination. Full notice text and document lists
are fetched only when opening a tender. Existing deadline and assignment screens
can explicitly request `view=all` summaries when they need the full result set.

Supabase remains the shared persistent catalogue. A process-local catalogue cache
reuses the mapped summaries for 60 seconds and deduplicates simultaneous loads.
Stale summaries can be returned for up to five minutes while `after()` refreshes
them from Supabase. Separate server instances warm their own summary caches.
An initial cold read still loads the saved catalogue from Supabase; it does not
scrape the external websites. Country and verified access scope form the cache key.
API responses use `private, no-store` so an intermediary cannot bypass authentication.

Sector classification uses a guarded hybrid pipeline. Direct title evidence is
handled by deterministic whole-word rules. Ambiguous notices are classified in
small background AI batches at temperature zero, and an AI result is accepted
only when its quoted evidence occurs verbatim in the saved notice. ICT & Health
Focus includes only high-confidence ICT or healthcare results; pending and
low-confidence records are marked for review and excluded from that focus view.

Migration `202609220001_tender_ai_classification_cache.sql` stores the validated
result, content hash, classifier version and refresh lease. A changed notice or
classifier version invalidates the saved result automatically. Manual overrides
remain authoritative. The process-local cache is a deployment fallback, while
the service-role RPCs provide durable and cross-instance deduplication.

Opening a tender returns its saved payload/details immediately. Supported detail
sources (PRAZ, AfDB and World Bank) refresh after the response. Other sources use
the records populated by the existing scraper. The dialog polls for completion
without clearing the saved content. It shows the actual source/cache timestamp.

Migration `202609080008_tender_detail_cache.sql` adds persistent refresh metadata
and two service-role-only RPCs. A 90-second database lease prevents concurrent
requests across users and server instances from fetching the same source twice.
Successful detail results are reused for one hour, or until a newer scrape is
saved. Failed refreshes preserve the previous details and back off for five minutes.
PRAZ checks that return no document links are remembered as completed checks.

The server's `SUPABASE_SECRET_KEY` is used only for these cache RPCs, after an
authorised user query has resolved the tender ID. It is never used for catalogue
reads, private records or client-supplied URLs. AfDB execution uses an argument
array and an official-host check, rather than a shell command.

The migration was applied to the connected Supabase project (HTTP 201).
Automated validation has not been run for this change.
