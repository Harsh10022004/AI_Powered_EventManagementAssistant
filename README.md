# Xperience — AI Event Copilot

An AI-powered assistant for event managers. You talk to it in plain English about
an event as it evolves; it turns that conversation into a structured, live
**Task board, Vendor tracker, and Risk radar** — and proactively flags problems
(capacity mismatches, missed deadlines, missing vendors, blocked dependencies)
before they become fire-drills.

Built for The Xperience SDE Intern technical assessment.

---

## 1. The approach

Event managers don't lose track of *events* — they lose track of the hundreds of
small facts scattered across calls, WhatsApp, and email: "the sangeet venue is
booked", "catering needs the headcount a week out", "the transport vendor can
only do 150 seats." Nothing connects those facts to what they imply.

So the product isn't "a chatbot next to a dashboard." It's a **single pipeline**:

```
event manager message
        │
        ▼
 AI extraction (Groq, structured JSON output)
        │   → new/updated tasks, new/updated vendors, event facts (guest counts...)
        │   → judgement-call risks (things only readable from free text)
        ▼
 diff applied to MongoDB (create/update, never duplicate — AI is told the
 existing tasks/vendors and matches against them)
        │
        ▼
 deterministic Risk Engine re-evaluates the WHOLE event fresh
        │   → capacity math, deadline countdowns, missing-vendor checks,
        │     dependency-chain checks — plain code, not a model, so it's
        │     reproducible and explainable every single time
        ▼
 dashboard (Kanban board · vendor tracker · risk panel · overview stats)
```

The key design decision: **the LLM extracts and updates state; a separate,
deterministic rule engine decides what's risky.** An LLM is excellent at
reading "the transportation vendor can only provide vehicles for 150 people"
and turning it into `{vendor: "...", capacity: 150}`. It is not reliable for
"is 150 < 200? by how much? is that critical?" — that's arithmetic, and it
should never silently hallucinate. So every quantitative risk (capacity,
deadlines, missing vendors, dependency blocks) is **plain, readable code** in
[`backend/src/services/riskEngine.js`](backend/src/services/riskEngine.js).
The AI is only asked for *qualitative* judgement calls a rule can't express
(e.g. "the photographer is unavailable for the Reception" — a scheduling
conflict buried in prose), and those are clearly labelled `source: "ai"` in
the UI so a manager knows which risks to double-check.

This also makes the system **idempotent**: the risk engine re-runs after
every message and reconciles (not appends) — a risk auto-resolves the moment
its underlying condition stops being true (e.g. the vendor's capacity is
increased), instead of piling up stale duplicate warnings forever.

### Walking through Scenario 1 (wedding)
1. "Three-day wedding, ~400 guests, Sangeet/Haldi/Wedding/Reception, need
   venue/catering/décor/photography/entertainment/accommodation/transportation/invitations"
   → creates ~8 tasks (one per checklist item), sets `guestCount: 400`,
   records the 4 sub-events on the Event document.
2. "Sangeet venue finalised, décor vendor still needed" → the AI matches
   "Sangeet venue" against the existing "Finalise venue" task (passed to it
   as `EXISTING_TASKS`) and marks it `done`, rather than creating a duplicate.
3. "~150 guests travelling, arrange accommodation + airport transfers"
   → sets `guestTravelCount: 150`. Later, when a transport vendor is logged
   with `capacity: 100`, the risk engine immediately raises a **critical
   capacity_mismatch** risk — 100 < 150, and it's >30% short — with a
   suggested action, without needing another AI call.
4. "Catering needs final guest count one week before" → logged as a note on
   the catering task; if that week-out date passes without the guest count
   being finalised, `deadline_risk` fires automatically.
5. "Photographer unavailable for the Reception" → no numeric rule captures
   this, so the AI raises a `scheduling_conflict` risk directly, with a
   suggested action ("reassign or source a backup photographer for the
   Reception").

### Walking through Scenario 2 (corporate outing)
"Transportation vendor can only provide vehicles for 150 people" against
200 confirmed attendees is the textbook case for Rule 1 — the moment that
message is logged, the dashboard shows a critical alert with the exact
shortfall (50 people) and a suggested action, with zero extra AI reasoning
required. "CEO joins only on Day 2" becomes a `leadership_session` task
tagged `subEvent: "Day 2"`, keeping it distinct from Day 1 activities.

### Why this genuinely helps (not just a feature checklist)
- **Nothing is retyped.** The manager talks the way they already think out
  loud; the structure comes out the other side.
- **Traceability.** Every task/vendor carries a `sourceMessage` reference and
  every assistant reply shows an actions summary (`+2 tasks · 1 vendor
  updated · ⚠ 1 new risk`) — a manager can always answer "why is this here?"
- **Nothing silently duplicates.** The AI is shown current state and told to
  match, not just append.
- **Risk detection is trustworthy, not a black box.** Deterministic rules for
  anything that involves a number or a deadline; AI only for prose judgement,
  and visibly labelled as such.
- **Manual override always available.** Every task/vendor/risk can also be
  edited directly on the dashboard (drag a status, change capacity) — the
  chat is the fast path, not the only path.

---

## 2. Technology stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS | Fast to build a clean, responsive UI; App Router's client components suit a live chat + polling dashboard. |
| Backend | Node.js + Express.js | Explicit REST routes/controllers keep the AI pipeline (the interesting part) easy to read top-to-bottom. |
| Database | MongoDB + Mongoose | Flexible schema suits fast-evolving event data (sub-events, notes, ad-hoc risk types) better than a rigid relational schema for this scope. |
| Auth | JWT (bcrypt-hashed passwords) | Stateless, simple, sufficient for the assessment's scope (see assumptions). |
| AI | Groq (`groq-sdk`, `openai/gpt-oss-120b`), JSON mode (`response_format: json_object`) | Groq's OpenAI-compatible API and very low inference latency make the chat feel instant; JSON mode guarantees a parseable response so extraction never crashes on malformed text. |
| Fallback | Deterministic keyword extractor | The app is fully demoable with **zero API key** — see `backend/src/services/fallbackExtractor.js`. |

**Two separate apps/repos** (`/backend`, `/frontend`) rather than one Next.js
full-stack app, per the assessment's suggested Node/Express + Next.js split —
communicating over a versioned REST API (`/api/...`).

---

## 3. Project structure

```
Xperience/
├── backend/
│   └── src/
│       ├── config/        # db connection, shared constants (task/vendor categories)
│       ├── models/        # User, Event, Message, Task, Vendor, Risk (Mongoose)
│       ├── middleware/     # JWT auth guard, central error handler
│       ├── services/
│       │   ├── aiService.js         # Groq call + JSON-mode schema + prompt builder
│       │   ├── fallbackExtractor.js # offline keyword-based extractor
│       │   └── riskEngine.js        # deterministic rule engine (the core "intelligence")
│       ├── controllers/    # one per resource: auth, event, task, vendor, risk, message
│       ├── routes/         # authRoutes.js, eventRoutes.js (mounts everything else)
│       ├── app.js          # Express app wiring
│       └── server.js       # entrypoint (connects DB, starts listening)
└── frontend/
    ├── app/
    │   ├── login/, signup/           # auth pages
    │   ├── events/                   # event list + create
    │   └── events/[id]/              # the main dashboard page
    ├── components/
    │   ├── ChatPanel.tsx             # the conversation UI
    │   ├── OverviewStats.tsx         # days-to-event / completion / risk summary cards
    │   ├── TaskBoard.tsx             # Kanban board (todo/in_progress/blocked/done)
    │   ├── VendorTable.tsx           # vendor tracker
    │   └── RiskPanel.tsx             # risk/alert feed with acknowledge/resolve
    └── lib/                          # typed API client, shared types, auth hook
```

---

## 4. Setup instructions

### Prerequisites
- Node.js 18+
- A MongoDB connection string (local `mongod`, or a free MongoDB Atlas cluster)
- (Optional but recommended) A Groq API key from https://console.groq.com/keys (free, fast `openai/gpt-oss-120b` inference)

### Backend
```bash
cd backend
npm install
cp .env.example .env      # then edit .env:
#   MONGODB_URI=<your connection string>
#   JWT_SECRET=<any long random string>
#   GROQ_API_KEY=<your key>            (optional — omit to run in offline fallback mode)
npm run dev                # http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:5000/api
npm run dev                        # http://localhost:3000
```

Sign up, create an event, and start typing messages like the ones in the
assessment's scenarios into the chat panel.

**No Groq key?** The app still fully works — `aiService.extract` returns
`null` when `GROQ_API_KEY` is unset, and the controller transparently falls
back to the keyword-based extractor, with a small banner on the dashboard
telling you it's in offline mode.

---

## 5. Key assumptions & design decisions

- **Two-app split, REST over HTTP** — matches the assessment's suggested
  stack (separate Next.js frontend / Node-Express backend) rather than a
  single Next.js full-stack app, at the cost of an extra deploy target.
- **JWT in `localStorage`, not an httpOnly cookie** — simpler for a
  same-origin-free demo (frontend and backend on different ports/domains) and
  fine at this scope; a production version would move to httpOnly cookies +
  CSRF protection.
- **AI diffs are auto-applied, not proposed-then-approved** — chosen for a
  faster, more "alive" feel matching the brief ("system helps transform
  conversations into a dashboard"). Every change stays traceable
  (`sourceMessage`) and is manually reversible on the dashboard, which was
  judged sufficient trust for this scope instead of an approve/reject step.
- **Deterministic risk engine re-runs in full on every message** rather than
  incrementally patching risks — the event's task/vendor list is small
  (dozens, not thousands) so an O(n) full re-evaluation is instant, and it's
  far simpler to reason about ("the risk list always equals what's currently
  true") than incremental diffing.
- **Dashboard refresh is request/response, not WebSockets** — a single
  event manager drives one conversation at a time; real-time push across
  multiple simultaneous viewers was out of scope for this assessment but
  would be the natural next step (Socket.IO room per event).
- **Category taxonomy is a fixed enum** (venue, catering, decor, photography,
  entertainment, accommodation, transportation, invitations, branding,
  team_building, leadership_session, other) rather than free text, so the
  risk engine can reliably match a vendor to the tasks it covers.

---

## 6. What I'd build next with more time
- WebSocket-based live sync for multiple collaborators on one event.
- A timeline/Gantt view for sub-event scheduling and dependency chains.
- Guest-list CSV import + RSVP tracking as a first-class entity.
- Voice input for on-the-go updates from a venue walkthrough.
- Per-vendor contact/negotiation history instead of a single notes field.
