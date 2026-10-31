# Tamil Thiruthi production readiness — 31 October 2026

## Decision

**Not yet approved for a public production launch.** The live backend and synthetic correction tests work, but genuine handwriting accuracy, the hosted frontend, email delivery and real teacher onboarding are not verified. This is an AI-assisted practice tool, not a validated VCE examination marker.

## Completed checks

- 12/12 synthetic language/image cases passed the specified assertions: correct Tamil, a Sri Lankan vocabulary variant, plural and conditional sentences, first-person and feminine verb agreement, pronoun form, தமிழ் spelling, an embedded prompt-manipulation attempt, a longer correct paragraph, printed-photo transcription and blank-image rejection.
- 2/2 follow-up live cases passed after the dependency/prompt update.
- 14/14 API workflow checks passed: teacher class creation, student joining, parent linking, comments, student isolation, private-photo access, parent revocation, owner-only checking, completed-check reuse and anonymous rejection.
- 8/8 local-browser workflow checks passed against the live backend: teacher class creation, student joining on mobile, parent linking, saving teacher feedback, student/parent feedback visibility, no mobile horizontal overflow, and sign-out. No browser page errors were recorded. The browser test used an environment-specific proxy/certificate workaround; this does not verify production-domain TLS.
- Four local security test groups passed. Earlier transactional database tests also covered role escalation, result tampering, retry recovery, usage ceilings and retained usage after deletion.
- The full npm dependency audit reported zero known vulnerabilities after updating the pinned Supabase, Vite and React plugin dependencies. This is not a guarantee against unknown vulnerabilities.
- Deno type checking and the production frontend build passed.
- Supabase security advisors reported no warnings. Two informational notices are intentional: the teacher allow-list and private attempt log have RLS enabled with no client policies.
- GitHub Android build 41175754880 succeeded after fixing the signing configuration expression. The build warns that it uses a temporary debug signing key; it is not a production-signed release.

Raw synthetic results are under `tests/*readiness-results.json`. These are small, targeted tests, not a representative marking benchmark or accuracy percentage. End-to-end synthetic requests took approximately 19–30 seconds, including network overhead.

## Fixes made during this review

- Updated vulnerable dependencies and kept exact versions plus the lockfile.
- Fixed the Android signing-expression build failure and added security tests to its CI workflow.
- Changed definite-sounding marking labels to AI suggestions, removed the absolute “verb must be last” instruction, and reduced unnecessary technical claims in general feedback.
- Added an explicit disclosure that writing/photos are sent to Anthropic.
- Protected profile loading from stale responses during account changes.
- Configured the public Supabase project URL and publishable key as the frontend default. No privileged or Anthropic keys are in the frontend.
- Selected newly created classes immediately, so teachers see the correct join code.
- Refreshed completed submissions and teacher comments on opening and while viewing. Revoked access clears the view. Photo links expire after five minutes and are renewed when reopened.

## Remaining launch gates

1. **Genuine handwriting benchmark:** test anonymised handwritten pages against teacher-reviewed transcriptions and corrections, including faint pulli, similar letters, crossed-out text, poor lighting and multiple pages. The image test here used printed text, not handwriting.
2. **Live website and email:** confirm the production URL, HTTPS, correct deployed revision, auth Site URL and redirects, and actual confirmation/reset email delivery. No matching live deployment was identified. Email confirmation is enabled; delivery has not been verified.
3. **Teacher onboarding:** no non-test teacher email was in the allow-list at review time. Add the intended teacher email and test its actual account.
4. **Android release, if distributing an APK:** configure a permanent release keystore and password. Verify camera/gallery and sign-in on physical devices. The successful CI artifact is debug-signed.
5. **Marking scope:** no numerical VCE rubric, calibrated examiner score or per-correction teacher approval workflow is implemented. Teacher comments are supported. Do not present automated suggestions as verified exam marks.

No real student writing was used. Temporary test users, records and uploaded fixtures are removed after the review. Previously issued signed photo URLs are bearer URLs and remain usable until their short expiry; revoking a parent blocks new access and new URLs.
