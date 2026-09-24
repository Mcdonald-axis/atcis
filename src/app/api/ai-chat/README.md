# Atcis AI data access

The chat endpoint uses Gemini 2.5 Flash with OpenAI GPT-4.1 mini as a fallback,
with server-executed `search_system` and `read_document` function calls. Both
providers use the same tools and permissions. It requires an active Supabase session. The
server reads identity, country and role from the authenticated profile; request
body identity fields cannot change access.

Searchable sources: official tenders and saved notice details, procurement plans,
pipeline tasks and stage counts, assignments, approvals and revision history,
checklists and templates, checklist attachments, reference documents, reviewed
package files, repository documents and folders, partners, registrations,
renewals, manual debriefs, the combined Win/Loss feed, people, and scrape status.

All database reads and storage downloads use the user's Supabase client and
existing RLS. There is no service-role client, model-generated SQL, write action,
arbitrary URL fetch, or change to database grants. Secrets and storage locations
are omitted from model-visible record metadata. File reads require a source
handle issued by an authorized lookup in the same request.

Search results include exact matching counts and pagination. Pipeline stages
remain distinct: only `won` counts as Won. The outcome feed uses the same merge
helper as Win/Loss Debriefs. Pipeline reads have a 5,000-board/debrief-row ceiling;
when reached, the response explicitly marks counts as partial. Record excerpts
are capped at 3,500 characters, or 50,000 for an exact-id lookup, with truncation
reported. The model must disclose incomplete evidence.

PDF, PNG, JPEG and WebP files are sent as actual bytes to the answering provider. DOCX body text
and TXT/CSV/Markdown/JSON/XML are returned as extracted text. Limits: 8 MB per
file, 10 MB total per answer, and 60,000 characters for extracted text. DOCX
images/layout and external official document URLs are not read. File presence
does not establish validity or compliance.

Each answer may perform up to 12 tool calls across 7 model turns, with a 165-second
request deadline. At least one tool lookup is requested before answering.
Returned source markers identify real fetched records; the UI shows their
module links under Sources consulted. Errors surface in chat rather than being
silently ignored. Clearing chat aborts the active request.

Provider handling is shared with `/api/tenders/analyze`, which also requires an
authenticated user and no longer has a service-role/anonymous lookup fallback.
Network failures, quota exhaustion, invalid provider credentials and temporary
provider errors can switch providers. Once switched, that provider handles the
remaining tool calls for the answer. Cancellation does not trigger fallback.
Safety refusals and malformed requests are not used to trigger provider switches.
A brief in-process cooldown avoids repeatedly calling an unavailable provider;
Gemini is probed again automatically. The UI identifies the answering model and
whether fallback was used. OpenAI requests use the Responses API with `store:false`.

Server-only configuration in the ignored `.env.local`: `GEMINI_API_KEY` and
`OPENAI_API_KEY`. Optional `OPENAI_MODEL` defaults to `gpt-4.1-mini`;
`AI_PRIMARY_PROVIDER=openai` reverses the preferred provider. Never prefix these
keys with `NEXT_PUBLIC_` or commit them.

Validation completed on 2026-09-08: TypeScript passed; all 20 end-to-end checks
passed using the OpenAI fallback, and 13 isolated provider retry/conversion checks
passed. Coverage includes all 19 data sources, country/owner isolation, spoofed
roles, pipeline counts, pagination, checklist/reference ownership, saved decline
history, actual PDF/text contents, DOCX extraction, missing files, live source
links/provider labels, authenticated JSON tender analysis, errors and cancellation.
The browser regression starts with "hie", asks for the Won count, then asks which
tender it was in the same thread. All three requests succeed with retained context.
Assistant history uses `output_text` in OpenAI requests; sending it as `input_text`
previously caused OpenAI HTTP 400 and a chat HTTP 502 on follow-up messages.
The live Gemini count test also passed in an earlier run; remaining Gemini calls
were blocked by its confirmed 20-request daily free-tier quota. OpenAI completed
the previously blocked document tests. All disposable users, records and files
were removed. Final report: `test-results/ai-e2e-1788877593336/report.json`.

Run `npm run test:ai` with the local application running. Live fixture setup and
cleanup use the configured `SUPABASE_SECRET_KEY`; the actual data tools and chat
requests use temporary signed-in users and RLS. No invitations/emails are sent.
`ATCIS_EXPECT_PROVIDER=openai` additionally asserts fallback provider identity.
Reports and screenshots are stored under the ignored `test-results/` directory.

API references: [Gemini](https://ai.google.dev/api/generate-content),
[OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling),
[OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs).
