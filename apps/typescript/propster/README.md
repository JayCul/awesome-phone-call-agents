# Propster

**Find properties. Verify them by phone.**

Propster searches rental listings and then calls the listing agent — with
[CALL-E](https://docs.heycall-e.com/) — to verify availability, pricing and
real-world details before you waste your time.

Built for the CALL-E hackathon.

---

## 1. Product overview

You describe what you want in plain English:

> I need a 3 bedroom apartment in Lekki under ₦8 million per year. I need
> parking, prepaid electricity and I want to move in this month.

Propster extracts a typed requirement, searches the listing corpus, ranks the
candidates, and then **places a real phone call** to the contact on each listing
you choose to verify. The conversation is turned into structured facts, compared
field by field against what the advert claimed, and scored on evidence.

The output is a shortlist where every property has either been checked against
a real conversation, or is clearly marked as unchecked.

## 2. The problem

A rental listing is a claim, not a fact.

- The flat went two weeks ago, but the listing is still up.
- The advert says ₦7.5M. The agent says ₦9M.
- The "private parking" is the street outside.
- Nobody mentions the service charge, agency fee, legal fee and caution deposit
  until you are standing in the flat.

Every one of those costs a trip, an inspection fee, and an afternoon. In Lagos,
where listings are frequently stale and rent moves between the photos and the
phone call, this is the single largest source of wasted effort in finding a
place to live.

## 3. The solution

Propster does the calling first.

```
User requirement
       ↓
Requirement extraction      Claude, or a deterministic parser, then Zod validation
       ↓
Property discovery          PropertySearchProvider
       ↓
Candidate ranking           requirement match, evidence-discounted
       ↓
CALL-E phone verification   PhoneVerificationProvider
       ↓
Conversation
       ↓
Structured extraction       JSON Schema handed to CALL-E, re-validated with Zod
       ↓
Listing vs reality          field-by-field discrepancy detection
       ↓
Verification score          transparent, weighted, explainable
       ↓
Verified shortlist
```

The differentiator: **Propster does not trust the listing. It calls the
real-world contact and checks.**

## 4. Architecture

```
                 ┌─────────────────┐
                 │      USER       │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │    WEB APP      │
                 │  Next.js 16     │
                 │  App Router     │
                 └────────┬────────┘
                          │  server-only boundary
                          ▼
                 ┌─────────────────────────────┐
                 │  PropertyVerificationService│
                 │        orchestrator         │
                 └───────┬─────────────────────┘
                         │
              ┌──────────┼───────────┬──────────────┐
              ▼          ▼           ▼              ▼
     ┌──────────────┐ ┌────────┐ ┌──────────┐ ┌───────────┐
     │  Property    │ │ Claude │ │  SQLite  │ │  Domain   │
     │  Search      │ │  LLM   │ │  Prisma  │ │  scoring  │
     │  Provider    │ │(optional)│          │ │ + matching│
     └──────────────┘ └────────┘ └──────────┘ └───────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │   CALL-E    │◀──── webhook ────┐
                  │ Phone Agent │                  │
                  └──────┬──────┘      /api/call-e/webhook/:token
                         │                         │
                         ▼                         │
                  ┌─────────────┐                  │
                  │  Property   │──────────────────┘
                  │ Agent/Owner │
                  └─────────────┘
```

### Layering

| Layer | Location | Responsibility |
| --- | --- | --- |
| Domain | `src/domain/` | Pure functions. Types, Zod schemas, scoring, matching, discrepancy detection, the verification state machine. No I/O, fully unit tested. |
| Server services | `src/server/` | Persistence, providers, orchestration, config. Every file starts with `import "server-only"`. |
| API | `src/app/api/` | Thin HTTP shells over the services. Validation, rate limiting, error envelopes. |
| Application UI | `src/app/(site)/`, `src/components/` | Search, dashboard and property detail. Server components read through `src/server/readModel.ts`; small client components handle the form and the live polling. |
| Landing | `src/app/page.tsx`, `src/components/landing/` | The public page. A server component composes fourteen sections and passes the real provider configuration down. |

Routes live in two groups so each can own its chrome. `(site)` carries the
product header and footer; the landing page has its own floating navigation
that changes appearance with the section beneath it. Route groups do not affect
URLs — `/search` is still `/search`.

**No React component ever talks to CALL-E.** Provider access is confined to
`src/server/verification/`.

### Provider abstractions

Two seams, both explicit:

```ts
interface PropertySearchProvider {
  search(requirements: PropertySearchRequirement): Promise<PropertyListing[]>;
}

interface PhoneVerificationProvider {
  initiateCall(input: VerificationCallInput): Promise<CallSession>;
  getCallStatus(callId: string): Promise<CallStatus>;
  getCallResult(callId: string): Promise<CallResult>;
  listProgress(callId: string): Promise<CallProgressEvent[]>;
}
```

| Interface | Implementations |
| --- | --- |
| `PropertySearchProvider` | `MockPropertySearchProvider` (seeded Lagos corpus) |
| `PhoneVerificationProvider` | `CallEPhoneVerificationProvider` (real calls), `MockPhoneVerificationProvider` (deterministic demo) |

## 4a. The landing page

The public page is a directed sequence rather than a stack of feature blocks.
It moves through three colour worlds, and the order is the argument:

| World | Sections | What it does |
| --- | --- | --- |
| **Property** — warm neutrals, photography | Hero · The property · The problem · "It calls." | Sells the listing the way a portal would, then puts the first crack in it |
| **Investigation** — near-black, electric blue | The call · The investigation | The page turns dark and the language becomes instrumental |
| **Evidence** — light ground, sourced facts | Evidence · Listing vs reality · The score | Back to daylight, but everything on screen now has a source |

Then the practical half: use cases, how it works, a live investigation, CALL-E,
and the close.

The intended reading, by dwell time: *this is a serious property product* →
*this isn't just a property site* → *it investigates listings* → *the AI calls
the contact* → *I understand why this is useful*.

**Typography carries the central contrast.** Emotion is set in an editorial
grotesque (Archivo) at display sizes with tight tracking; anything the product
claims to *know* is set in a monospace (IBM Plex Mono), uppercase and tabular.
A serif italic (Instrument Serif) appears on single words only. If it looks
like a fact, it is set like data.

**Motion is CSS and IntersectionObserver — no animation library.** Only
`transform`, `opacity` and `clip-path` are animated. The primitives live in
`src/components/landing/motion.tsx`: `Reveal` for entrances, `useScrollSteps`
for the sticky scroll-told sections, `useTimedSequence` for the self-running
demonstrations, `useCountUp` for the score, and `HoverLabel` for the desktop
cursor labels. Everything honours `prefers-reduced-motion` by arriving at its
final state immediately.

**Photography is art-directed, not decorative.** Every image is declared in
`src/components/landing/art.ts` with the narrative job it does. Property #04 is
deliberately the same photograph in three sections — pinned during the
investigation, at the centre of the evidence dossier, and on the listing side of
the comparison — so the page reads as one property tracked from claim to
verdict.

**Photography is vendored, not hotlinked.** Every image ships in
`public/img/` as WebP at two widths, generated by `npm run vendor:images`. The
app makes no third-party requests at runtime: fonts are self-hosted by
`next/font` and images are local, so Propster renders fully offline. That
matters for a demo given on conference wifi. Sources are recorded in
`public/img/CREDITS.md`; the assets total about 5MB.

## 5. CALL-E integration

**Where CALL-E is used:** `src/server/verification/calleProvider.ts`. That is the
only file in the repository that imports the CALL-E SDK.

Propster uses the official server SDK, [`@call-e/calle`](https://www.npmjs.com/package/@call-e/calle).

### How a verification call is made

1. **Objective is built** (`callObjective.ts`) from the listing *and* the user's
   requirement, so the questions asked are the ones this user actually cares
   about. It is an objective, not a script: CALL-E holds a natural conversation.

2. **Result schema is built** (`schemas.ts → buildCallResultJsonSchema`) and
   passed as `recipientResultSchema`. CALL-E performs the structured extraction
   from the conversation, so Propster receives typed facts rather than a
   transcript to parse.

   ```ts
   const call = await client.calls.create(
     {
       task: objective.task,
       recipients: [{ phones: [phone], region: "NG", locale: "en-NG" }],
       recipientResultSchema: buildCallResultJsonSchema(),
       resultSchema: buildCallTaskJsonSchema(),
       metadata: { propster_verification_id: verification.id },
       webhookUrl,
     },
     { idempotencyKey: "propster:verify:" + verification.id },
   );
   ```

3. **Progress is streamed** via `client.calls.listEvents(callId)`, which drives
   the live activity panel judges watch during the demo.

4. **Result is collected** either by webhook (`POST /api/call-e/webhook/:token`)
   when the instance is publicly reachable, or by polling
   `client.calls.get(callId)` in local development. Both paths converge on the
   same `applyCallResult` function.

5. **Everything is re-validated.** CALL-E's structured result is parsed with
   `callVerificationResultSchema` before it is trusted. A result that fails
   validation fails the verification — it is never silently accepted.

### Call conduct

The objective hard-codes these rules, and the agent opens every call with them:

- Identifies itself as an AI assistant. Never claims or implies it is human.
- States the purpose of the call immediately.
- Makes no booking, offer, commitment or payment.
- Does not negotiate rent or enter any agreement.
- Stops asking questions the moment the contact says the property is gone.
- Asks one short clarifying question when an answer is ambiguous, then moves on.
- Ends politely as soon as it has what it needs.

### Safety rails

- `CALLE_PHONE_ALLOWLIST` — when set, Propster refuses to dial any number not on
  the list. Set this before pointing Propster at real contacts.
- Phone numbers must be valid E.164 or the call is refused.
- `POST /api/properties/:id/verify` is rate limited to 6 calls per minute.
- One live verification per property at a time, so the same person is never rung
  twice for the same question.
- Phone numbers are redacted in logs and masked in the UI.

## 6. Setup

Requirements: Node 20+ (developed on 22), npm.

```bash
cd Propster
npm install
cp .env.example .env
npm run setup
```

`npm run setup` runs `prisma generate`, creates the SQLite database, and seeds
14 demo listings.

## 7. Environment variables

Ordered by what you actually have to set. A production boot was verified with
only the five in the first table.

### Required

| Variable | Why |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** connection (host contains `-pooler`) |
| `CALLE_API_KEY` | Places real calls. Absent, the simulated provider runs instead |
| `GROQ_API_KEY` | Transcript and requirement extraction |
| `GROQ_MODEL` | `qwen/qwen3.8-27b`; without it the default is a different model |
| `CALLE_PHONE_ALLOWLIST` | Only these numbers may be dialled. Set it on anything internet-facing |

### After deploying

Set once the app has a public HTTPS URL. Without them CALL-E results are
collected by polling, which works but is slower.

| Variable | Why |
| --- | --- |
| `PUBLIC_APP_URL` | e.g. `https://propster.vercel.app`, no trailing slash |
| `CALLE_WEBHOOK_TOKEN` | A long random string you invent. CALL-E deliveries are unsigned, so this unguessable path segment authenticates the receiver |

### Local only — never set on the host

| Variable | Why |
| --- | --- |
| `DIRECT_DB_URL` | Neon **direct** connection. Needed by `prisma db push`; pgBouncer cannot run its DDL. The runtime client never reads it |
| `DEMO_AGENT_PHONE` | The one seeded listing that may be dialled. Read by `npm run db:seed` only — the seeded rows already live in the database |

### Defaults

`LLM_PROVIDER` (`auto`), `PROPSTER_DEMO_MODE` (`false`), `CALLE_BASE_URL`,
`GROQ_BASE_URL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`. Set one only to change
it. With just a Groq key present, `auto` selects Groq.

### Deploying to Vercel

Set the Build Command to:

```
prisma generate && next build
```

The default `next build` does not generate the Prisma client and the deploy
will fail without it.

## 8. Running locally

```bash
npm run dev
```

Then open http://localhost:3100.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3100 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit`, strict mode |
| `npm test` | Vitest unit suite |
| `npm run setup` | Generate client, create DB, seed |
| `npm run db:reset` | Re-seed the demo corpus to a clean state |
| `npm run vendor:images` | Re-download the photography into `public/img/` |

## 9. Demo instructions

A complete run takes about two minutes.

1. Go to http://localhost:3100 and click **Run the demo search**. The query is
   pre-filled:

   > I need a 3 bedroom apartment in Lekki under ₦8 million per year. I need
   > parking, prepaid electricity and I want to move in this month.

2. Press **Search properties**. The dashboard shows 7 properties found and 5
   candidates selected, with the extracted requirement rendered as chips —
   location, bedrooms, budget, move-in window and the two required amenities.

3. Click **Verify with AI** on any candidate. The property page opens with the
   live activity panel running.

4. Watch the call progress: queued → dialing → contact answered → each fact
   confirmed → verification complete. The panel is driven by real provider
   events, not a fixed animation.

5. Read the result: the score with its full breakdown, what was confirmed, the
   fee table, any discrepancies, and the call transcript.

6. Go back to the shortlist. Verified properties have moved above unverified
   ones.

The five candidates are seeded to demonstrate every outcome:

| Property | Outcome |
| --- | --- |
| 3 Bedroom Apartment with BQ, Lekki Phase 1 | Highly verified, everything confirmed |
| 3 Bedroom Flat, Chevron Drive | **Price mismatch** — agent quotes 32% above the listing |
| 3 Bedroom Apartment, Osapa London | **Amenity mismatch** — advertised parking does not exist |
| 3 Bedroom Apartment, Lekki Phase 1 (Waterfront) | **Unavailable** — let two weeks ago |
| 3 Bedroom Apartment, Agungi | Verified, but the contact could not confirm all fees |

Two further listings stay unverified so the ranking difference is visible, and a
Sangotedo listing is seeded as a **no-answer** call to demonstrate the failure
path.

### Running the demo against real CALL-E

Set `CALLE_API_KEY`, and — importantly — set `CALLE_PHONE_ALLOWLIST` to the
number you actually want dialled, then reseed with that number in
`prisma/seed-data.ts`. Propster will place a genuine outbound call.

## 10. API documentation

All endpoints return JSON. Errors use a stable envelope:

```json
{ "error": { "code": "invalid_request", "message": "...", "hint": "..." } }
```

Codes: `invalid_request`, `not_found`, `rate_limited`, `verification_conflict`,
`provider_unavailable`, `extraction_failed`, `internal_error`.

### `POST /api/search`

Accepts natural language, structured fields, or both. Structured fields override
anything inferred from prose.

```jsonc
// Request
{
  "naturalLanguage": "3 bedroom apartment in Lekki under 8 million with parking",
  "structured": { "bedrooms": 3, "amenities": ["parking"] }   // optional
}

// Response
{
  "searchId": "cmt...",
  "found": 7,
  "candidates": 5,
  "extractionSource": "rules",
  "requirement": {
    "location": "Lekki",
    "propertyType": "apartment",
    "bedrooms": 3,
    "maxRent": 8000000,
    "rentPeriod": "yearly",
    "amenities": ["parking"],
    "additionalRequirements": []
  }
}
```

Rate limit: 20/minute.

### `POST /api/properties/:id/verify`

Starts a verification call. **This dials a real number when CALL-E is
configured.**

```jsonc
// Request
{ "searchId": "cmt..." }

// Response
{
  "verificationId": "cmt...",
  "callId": "call_...",
  "provider": "call-e",
  "isLive": true,
  "status": "pending"
}
```

Rate limit: 6/minute. Returns the in-flight verification if one already exists
for this property.

### `GET /api/verifications/:id/status`

Polled by the live activity panel. Each request advances the state machine by
asking the provider where the call has reached, then returns a snapshot.

```jsonc
{
  "id": "cmt...",
  "status": "in_progress",
  "callStatus": "in_progress",
  "provider": "call-e",
  "isLive": true,
  "score": null,
  "failureMessage": null,
  "durationSeconds": null,
  "isTerminal": false,
  "events": [
    { "id": "...", "at": "...", "level": "success", "message": "Contact answered" }
  ]
}
```

### `GET /api/properties/:id?searchId=...`

Full property detail: listing, requirement match, verification, score breakdown,
discrepancies, call metadata and transcript.

### `GET /api/verifications/:id`

The same detail view, addressed by verification id.

### `POST /api/call-e/webhook/:token`

Terminal call events from CALL-E. Current CALL-E deliveries are **unsigned**, so
the endpoint is authenticated three ways:

1. An unguessable path token (`CALLE_WEBHOOK_TOKEN`), compared in constant time.
2. The `CALL-E-Event-Id` header must match the `id` in the body.
3. The call must correspond to a verification this server started, matched on the
   metadata sent with the call.

Delivery is at-least-once, so the handler is idempotent: a verification that has
already settled is left alone.

## 11. How the score is calculated

| Component | Weight |
| --- | --- |
| Availability | 30 |
| Price accuracy | 20 |
| Required amenities | 20 |
| Property details | 15 |
| Additional fees | 10 |
| Contact confidence | 5 |

Discrepancies are then deducted on top: 8 points for high severity, 4 for
medium, 1 for low. An active contradiction is worse than a gap in knowledge.

| Score | Band |
| --- | --- |
| 90–100 | Highly verified |
| 75–89 | Verified |
| 50–74 | Needs review |
| 0–49 | Poor match |

Two principles hold throughout:

- **An unanswered question earns partial credit, never full credit.** A
  confirmed fact must outrank an assumed one, or the product means nothing.
- **A score is never rounded up into a higher band.**

Every component carries its own `detail` string, so the UI explains the number
rather than asking you to trust it.

## 12. Testing

```bash
npm test
```

52 tests over five suites:

- `requirements.test.ts` — natural-language extraction, Nigerian money notation
  (`8m`, `₦8 million`, `N8,000,000`, `800k`), and the rule that a budget is never
  invented.
- `discrepancy.test.ts` — price mismatch, amenity mismatch, unavailability,
  cross-period comparison, and that an unanswered question produces no
  discrepancy.
- `scoring.test.ts` — weights sum to 100, bands, explainability, and that
  unanswered questions score below confirmed ones.
- `ranking.test.ts` — that a verified property outranks an unverified better
  match, that unavailable properties sink, and candidate selection limits.
- `stateMachine.test.ts` — the full lifecycle plus every failure path, including
  the guarantee that `failed` can never transition to `verified`.

## 13. Error handling

Every one of these has a specific, honest UI state:

| Situation | What the user sees |
| --- | --- |
| No recognisable location | "Tell us which area you are looking in…" |
| No properties found | An empty state suggesting how to widen the search |
| Listing has no phone number | The verify button is disabled with a reason |
| No answer / busy | "Nobody answered on the listing's number, so it has not been verified." |
| CALL-E unreachable or timed out | "The call service did not respond in time. The property has not been verified." |
| Insufficient CALL-E balance | "The call account has no remaining balance…" |
| Result fails schema validation | "The call completed but the answers could not be read reliably." |
| Verification timeout (6 min) | The verification is failed, not left hanging |
| Rate limited | "Too many requests. Try again in Ns." |

**A failed verification is never presented as a successful one.** The state
machine has no transition from any failure state into `verified`, and a failed
call resets the property to `unverified` rather than leaving a stale score.

## 14. Security

- All secrets are server-side. Every server module begins with
  `import "server-only"`, which makes it a build error to pull one into a client
  component.
- All input is validated with Zod at the boundary — user input, LLM output, and
  the provider's structured result.
- LLM output is never used unvalidated. A schema failure falls back to the
  deterministic parser.
- Webhook authentication as described above, with constant-time token comparison.
- Rate limiting on search, verify and webhook endpoints.
- Phone numbers and keys are redacted in logs and masked in the UI.
- Outbound call allowlist available as a hard guard rail.

## 14a. Safety, side effects and cancellation

Propster places **real telephone calls to real people**. That is the product,
and it is also the thing most likely to cause harm if it is built carelessly.
This section states exactly what the software does to the outside world, and
how to stop it.

### The side effect

One action in this application has an external, irreversible consequence:
pressing **Verify with AI** causes an outbound phone call to the number stored
on that listing. Nothing else in the app dials, sends, charges or writes to any
third party. Search, ranking, scoring and browsing are all local.

A call cannot be un-placed. Once CALL-E accepts the request, the phone rings.

### What the person who answers is told

Every call opens by identifying itself as an AI assistant calling on behalf of
a prospective tenant, and states its purpose immediately. The objective in
`src/server/verification/callObjective.ts` binds the agent to:

- never claim or imply it is human;
- never book, offer, commit, pay, or negotiate;
- never share the caller's personal details;
- end the call politely when asked to call back or when the contact declines;
- stop early and hang up if told the property is no longer available.

These are stated once each, in the fewest words that still bind them, because
the prompt is also what CALL-E uses to build the voice agent before dialling.

### Who can be called

Three independent controls, each of which can block a call on its own:

| Control | Where | Effect |
| --- | --- | --- |
| E.164 validation | `calleProvider.ts` | A malformed number is rejected before any request is made |
| `CALLE_PHONE_ALLOWLIST` | `.env` | When set, only listed numbers may be dialled |
| Consent flag | `Property.consentedAt` | A number its own owner submitted through `/try` may bypass the allowlist |

The seeded demo listings carry numbers in a reserved fictional range
(`+23470000000xx`). `/try` refuses to accept a number in that range, so a
fabricated listing can never be used to reach whoever happens to own it. A test
(`tests/seedData.test.ts`) asserts the guard's pattern and the seed generator
stay in agreement.

The one seeded listing that can be dialled for real reads its number from
`DEMO_AGENT_PHONE` in the environment. No live phone number is committed to
this repository. Without that variable the listing falls back to a fictional
number and simply cannot be called.

### Consent

`/try` exists so someone can have Propster call **their own** phone. It
requires an explicit checkbox asserting the number belongs to the submitter and
that they agree to an automated call. The assertion is stored as
`consentedAt` on the listing, and only a listing carrying it may bypass the
allowlist. Submitting the form does **not** dial: it creates the listing, and
the call remains a separate, deliberate action.

### Rate limits

Per-caller fixed windows, tightest on the paths that cost money or ring a
phone:

| Bucket | Limit |
| --- | --- |
| `search` | 20 / minute |
| `verify` | 6 / minute |
| `testProperty` | 4 / 10 minutes |
| `webhook` | 120 / minute |

### Cancellation and recovery

There is no "cancel" once a call is in flight — the CALL-E API this project
uses exposes no cancellation endpoint, and a ringing phone cannot be recalled.
What the system does instead:

- **One call per property at a time.** A second verification request for a
  property already in `pending` or `in_progress` returns the existing
  verification rather than dialling again.
- **Idempotency.** Every call carries `propster:verify:<verificationId>`, so a
  retried request returns the original call instead of placing a second one.
- **Timeout.** A verification that has not reached a terminal state within
  20 minutes is marked `failed`. The ceiling is deliberately well clear of the
  ~6 minutes observed end to end on a real call, because a timeout that fires
  early destroys a verification that was actually succeeding.
- **Failure is never success.** The state machine has no path from `failed` to
  `verified`. A dropped call, a busy line, an unparseable result or a model
  outage all leave the property **unverified**, never falsely confirmed.

To stop the system dialling anything at all, set `PROPSTER_DEMO_MODE="true"`.
The entire workflow, UI and state machine continue to run against a
deterministic simulated provider, and every simulated call is labelled as such
in the interface.

### Deploying on serverless

The application runs on any Node host. Two notes for serverless platforms,
where each request may be served by a different instance:

- The simulated phone provider is **stateless by design**: a demo call carries
  its start time, scenario and listing context inside its own call id, so any
  instance can answer a poll for a call it did not start. Demo mode therefore
  works identically on Vercel, Netlify, Render or a long-lived Node process.
- The rate limiter in `src/server/rateLimit.ts` keeps its counters in process
  memory, so on a multi-instance host the effective limits are per instance
  rather than global. That loosens them; it does not disable them, and the
  consent flag, allowlist and E.164 validation are unaffected. Moving the
  counters to Postgres or Redis is the fix for a real deployment.

Use the **pooled** Neon connection string for `DATABASE_URL` on serverless, and
the direct one for `DIRECT_DB_URL`. `prisma generate` must run at build time;
the `build` script does not do this for you, so set the platform's build
command to `prisma generate && next build`.

### Data handling

- Secrets live only in `.env`, which is gitignored. Nothing is prefixed
  `NEXT_PUBLIC_`, and `src/server/env.ts` imports `server-only`, so a build
  fails if server configuration is ever pulled into a client bundle.
- Phone numbers are redacted in logs by `src/server/logger.ts` and masked in
  the UI (`+234 ••• 446`).
- Transcripts and extracted facts are stored against the verification, because
  the user is entitled to read what was actually said about a property they are
  considering.

## 15. Future improvements

- **A real listing provider.** `PropertySearchProvider` is ready for one; the
  MVP ships with a seeded corpus rather than scraping any portal, since that
  requires terms that permit programmatic access.
- **CALL-E Goals.** The SDK's reusable published Goals would let the verification
  objective be versioned and managed outside the codebase.
- **Batch verification.** CALL-E accepts multiple recipients per call task, so an
  entire shortlist could be verified in one request.
- **Re-verification on a schedule.** A verification decays; a property confirmed
  three weeks ago is nearly as unreliable as an unverified listing. Scores should
  age.
- **Negotiation-free viewing booking.** Once a property is verified, a second
  call could arrange an inspection slot, with explicit user confirmation.
- **Multi-tenant accounts.** The MVP has no auth; searches are addressed by an
  unguessable id.
- **Postgres and a job queue.** SQLite and in-process polling are correct for a
  single-instance MVP, not for concurrent users.

## 16. Note on the demo data

Every listing, agent name and phone number in this repository is **fictional**,
written for the hackathon. Phone numbers are in a reserved demo block that does
not route to a real subscriber. Nothing here represents a real property, a real
agent or a real asking price.
