# Propster architecture

Companion to the README. This document covers the decisions behind the code
rather than how to run it.

## Request flow

### Search

```
POST /api/search
  → Zod: searchRequestSchema
  → rate limit (20/min)
  → extractRequirement()
       ├─ Claude (if ANTHROPIC_API_KEY)  → Zod validate → accept or fall through
       └─ extractRequirementWithRules()  → Zod validate
  → mergeRequirements(extracted, structuredFormFields)
  → runSearch()
       ├─ PropertySearchProvider.search()
       ├─ matchRequirements() per listing
       ├─ rankProperties()
       ├─ selectVerificationCandidates()
       └─ persist Search + SearchCandidate rows
  → { searchId, found, candidates, requirement }
```

### Verification

```
POST /api/properties/:id/verify
  → rate limit (6/min)
  → startVerification()
       ├─ reject if no phone number
       ├─ return existing verification if one is in flight
       ├─ buildCallObjective(listing, requirement)
       ├─ create PropertyVerification  (status: pending)
       ├─ PhoneVerificationProvider.initiateCall()
       │     └─ CALL-E: calls.create({ task, recipients, recipientResultSchema,
       │                               resultSchema, metadata, webhookUrl },
       │                             { idempotencyKey })
       └─ create CallSession (records which provider placed the call)

GET /api/verifications/:id/status          ← polled by the UI every 1.4s
  → refreshVerification()
       ├─ provider.getCallStatus()
       ├─ provider.listProgress()   → upsert VerificationEvent rows
       ├─ on completed → provider.getCallResult() → applyCallResult()
       └─ on failure   → failVerification()

POST /api/call-e/webhook/:token            ← CALL-E terminal event
  → token + CALL-E-Event-Id + metadata checks
  → normalise wire shape → toCallResult() → applyCallResult()
```

Both the poll path and the webhook path converge on `applyCallResult`, so there
is exactly one place where a verification can be settled.

### Settling a result

```
applyCallResult()
  ├─ persist raw transcript, summary, evidence on CallSession
  ├─ atomic claim: updateMany where status in (pending, in_progress)
  │     → a concurrent poll and webhook cannot both settle it
  ├─ Zod: callVerificationResultSchema  → FAIL means failVerification()
  ├─ reached_contact false              → failVerification()
  ├─ detectDiscrepancies(listing, facts)
  ├─ scoreVerification(listing, verification, requirement)
  ├─ status = !available   ? "unavailable"
  │         : hasHighSeverity ? "disputed"
  │         : "verified"
  ├─ assertTransition("in_progress", status)
  └─ transaction: verification + discrepancies + property
```

## Key decisions

### Why the phone provider is an interface

Three reasons, in order of importance:

1. **The demo must work offline.** Judging cannot depend on a live telephone
   network, a funded account, or somebody picking up.
2. **CI must not dial anyone.** Tests run against pure domain functions; the
   provider seam means no test can accidentally place a call.
3. **Honesty.** Because `provider` is recorded on every `CallSession`, a
   simulated call can never later be mistaken for a real one. The UI reads that
   column and labels it.

The mock is not a stub that returns a canned blob. It advances through the same
states over a compressed timeline, emits the same progress events, and returns
the same shapes, so the entire state machine is exercised in demo mode.

### Why CALL-E does the extraction

CALL-E accepts a `recipientResultSchema` and returns a schema-valid object. That
means Propster does not have to run a second LLM pass over a transcript to
recover facts, which removes a whole class of parsing failure. Propster still
re-validates the result with Zod, because a provider's promise about a schema is
not the same as a check.

### Why an unanswered question is not `false`

This is the single most important modelling decision in the codebase.

`parkingAvailable === undefined` means *nobody established whether there is
parking*. `parkingAvailable === false` means *the contact said there is none*.
Collapsing those two would either invent discrepancies that were never stated,
or quietly credit the listing for claims nobody checked.

So:

- `detectDiscrepancies` only flags a field the call actually established.
- `scoreVerification` awards half credit for an unconfirmed listing claim, and
  full credit only for a confirmed one.

### Why the ranking discounts unverified listings

`rankScoreFor` gives requirement match 60% of the weight unconditionally. The
remaining 40% comes from verification evidence — and an unverified property
gets only 55% of that portion. The effect is that a verified property beats an
unverified one at equal or slightly lower match, which is the product thesis
expressed as arithmetic. A confirmed-unavailable property collapses to 10% of
its match score, so it stays visible for transparency but never near the top.

### Why the state machine has no failure→success edge

A dropped call, a busy line, a timeout or an unparseable result all tell you
*nothing* about the property. The transition table makes it structurally
impossible to present any of those as a verified listing; the only way out of a
terminal state is to start a fresh verification. `failVerification` also resets
the property to `unverified` rather than leaving a stale score behind.

### Why SQLite

One instance, one demo, no concurrent writers to speak of. The schema uses no
SQLite-specific features, so switching the datasource provider to `postgresql`
and pointing `DATABASE_URL` at a real database is the entire migration. JSON
columns are stored as strings and parsed defensively, because SQLite has no
native JSON column type in Prisma.

### Why polling rather than only webhooks

A webhook needs a public HTTPS URL, which a laptop running a demo does not have.
Propster prefers the webhook when `PUBLIC_APP_URL` and `CALLE_WEBHOOK_TOKEN` are
both set, and falls back to polling `calls.get` otherwise. The live activity
panel polls the *server*, not CALL-E, so the browser never holds a CALL-E
credential.

## Module map

```
src/
├── domain/                  pure, no I/O, fully unit tested
│   ├── types.ts             the shared vocabulary
│   ├── schemas.ts           Zod + the JSON Schema handed to CALL-E
│   ├── amenities.ts         canonicalisation ("prepaid meter" == "prepaid")
│   ├── discrepancy.ts       listing vs call comparison
│   ├── scoring.ts           weighted, explainable verification score
│   ├── matching.ts          requirement match + ranking + candidate selection
│   ├── stateMachine.ts      the transition table
│   └── format.ts            formatting shared by server and client components
│
├── server/                  every file starts: import "server-only"
│   ├── env.ts               validated config; the only reader of process.env
│   ├── db.ts                Prisma singleton
│   ├── http.ts              ApiError, handleRoute, typed JSON responses
│   ├── rateLimit.ts         fixed-window limiter
│   ├── logger.ts            structured logs with secret redaction
│   ├── readModel.ts         read models for the pages
│   ├── requirements/        extractor.ts (Claude) + ruleExtractor.ts
│   ├── search/              provider.ts, mockProvider.ts, searchService.ts
│   └── verification/
│       ├── phoneProvider.ts       the interface
│       ├── calleProvider.ts       ← the only file importing @call-e/calle
│       ├── mockPhoneProvider.ts   deterministic demo
│       ├── callObjective.ts       dynamic objective + conduct rules
│       └── service.ts             the orchestrator
│
├── app/
│   ├── layout.tsx           document, fonts, stylesheet — no chrome
│   ├── page.tsx             the landing page (its own nav and footer)
│   ├── (site)/              product chrome: search, dashboard, property
│   └── api/                 route handlers
│
└── components/
    ├── ui.tsx               shared application primitives
    ├── SearchForm / PropertyCard / VerificationActivity / VerifyButton
    └── landing/
        ├── motion.tsx       Reveal, useScrollSteps, useTimedSequence,
        │                    useCountUp, HoverLabel — the whole motion system
        ├── art.ts           art-direction manifest; every image's narrative job
        └── <14 sections>    Hero, TheProperty, Problem, PropsterIntro,
                             CallExperience, Investigation, Evidence,
                             ListingReality, ScoreSection, UseCases, Workflow,
                             LiveInvestigation, CallESection, FinalCTA
```

### Why the landing page has no animation library

The page needs scroll-told sections, staged entrances and two self-running
demonstrations. That is reachable with IntersectionObserver plus CSS
transitions, and the alternative was a runtime dependency larger than the rest
of the application put together for what is decorative motion. Everything
animates `transform`, `opacity` or `clip-path` only, and scroll listeners
coalesce through `requestAnimationFrame` so a fast scroll costs at most one
read per frame.

One trap worth recording, because it is invisible until you hit it: a reveal
that hides itself with `clip-path: inset(0 0 100% 0)` has a **zero-area
intersection rectangle**, so an IntersectionObserver watching that same element
never reports it as intersecting and it can never reveal itself. `Reveal`
therefore splits the image variant across two nodes — an unclipped outer node
that is observed, and an inner node that is clipped.

## The `server-only` boundary

Every module under `src/server/` opens with `import "server-only"`. If any of
them were ever imported by a client component, the build would fail rather than
shipping a key to the browser. Combined with the absence of any `NEXT_PUBLIC_`
variable, that is the guarantee behind "no secrets in the frontend bundle".

The client components are exactly three — `SearchForm`, `PropertyCard` and
`VerificationActivity`, plus the small `VerifyButton` — and all four talk only
to Propster's own API routes.
