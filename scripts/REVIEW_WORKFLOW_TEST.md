# Review workflow browser test

Start the dashboard (`npm run dev`). With Chrome installed, run:

```sh
ATCIS_TEST_SECRETS=/private/tmp/atcis-test-secrets.json npm run test:workflow
```

The credentials file must have mode 0600 and contain `url` and `serviceRole` for
an authorized Supabase project. The URL must match `.env.local`. Keep this file
outside the repository and remove it after testing. `ATCIS_TEST_URL` optionally
selects an app URL (default: `http://localhost:3000`).

The script creates uniquely named disposable accounts, a tender, and real sample
files. Privileged credentials are used only for fixture setup/cleanup. Uploads,
links, submissions, reviewer decisions, and downloads use authenticated users
through the browser and application APIs. It does not send invitations or emails,
modify existing users, or approve any real tender.

The test checks mandatory evidence, three references, repository linking,
reviewer access to all source bytes, country/owner isolation, stage order,
declines with visible reasons, resubmission, stale revisions, and the final ZIP.
Fixture users and records are removed in `finally`. Reports and screenshots are
written under the ignored `test-results/` directory. An assertion or cleanup
failure makes the command exit unsuccessfully.
