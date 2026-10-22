# Afterflow

Post-event follow-through for the Grok Bot Community Engineering London Hackathon (Thu 22 Oct 2026, Expedite London HQ).

Afterflow is for people who already met or worked together at the hackathon, so they can pick the conversation up after the event. Each person makes a short card (optional LinkedIn stays hidden until both confirm). They add someone they met by scanning that person's QR code, opening their link, or searching the room by name, with an optional note about what they talked about. Both confirm, or either can quietly decline. Only then are contact and LinkedIn revealed. The connection page recaps both people's words and the note, gives a one or two sentence reason tied to those quotes, and offers three optional ways to keep going: chat online (and share a link), one community next step from `event-context.json`, and a time suggestion. A follow-up yes or not yet is stored with a timestamp and can be changed. `/demo` opens a seeded, already confirmed demo pair.

## Run locally

No accounts are required. Sign-ups go to a SQLite file, or a JSON file if SQLite cannot open.

```bash
npm install
npm run build
npm start
```

The server binds `0.0.0.0`. The port comes from `PORT` and defaults to `4721`.

Open http://127.0.0.1:4721

For editing:

```bash
npm run dev
```

### Storage

| Mode | When | Where |
| --- | --- | --- |
| SQLite | Default on Node 22+ | `data/afterflow.sqlite` (override with `SQLITE_PATH`) |
| JSON | SQLite cannot open | `data/afterflow.json` (override with `JSON_PATH`) |
| Supabase | `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are both set, and `STORAGE` is unset | Postgres, see below |
| Netlify Blobs | On Netlify, or `STORAGE=netlify-blobs` | One blob per profile and connection |

Each person gets a secret token in the page URL and in `localStorage`. There is no login.

### Tests and demo profiles

```bash
npm test
npm run seed
```

`npm test` checks scoring, the no-match cutoff, quoted explanations, the community next step, and a two-person "yes we met" flow against SQLite.

`npm run seed` replaces demo profiles (labelled **Demo** in the UI) and leaves real sign-ups in place. A connection with a demo profile can simulate that demo profile confirming. A real attendee cannot.

## Environment

Copy `.env.example`. All of these are optional for a local demo.

| Variable | Purpose |
| --- | --- |
| `PORT` | Listen port. Default `4721`. |
| `ORGANISER_PASSCODE` | Passcode for `/organiser`. Default `afterflow` when unset. |
| `SQLITE_PATH` | SQLite file path. |
| `JSON_PATH` | JSON fallback path. |
| `SUPABASE_URL` | Switches storage to Supabase when set with the service role key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase key. Never expose this in the browser. |
| `LLM_API_KEY` | Optional OpenAI-compatible key for the "why you two" text. |
| `LLM_BASE_URL` | API base. Defaults to `https://api.openai.com/v1`, or `https://api.x.ai/v1` when only `XAI_API_KEY` is set. |
| `LLM_MODEL` | Model name. Defaults to `gpt-4o-mini` or `grok-3`. |
| `XAI_API_KEY` | Used when `LLM_API_KEY` is unset. Base URL defaults to `https://api.x.ai/v1`. |

If no LLM key is set, or the call errors or exceeds 6 seconds, Afterflow uses a template. The template quotes both free-text answers and picks one next step from `event-context.json` (a named partner or a Discord channel).

## Organiser

Open `/organiser`. The default passcode is `afterflow` unless `ORGANISER_PASSCODE` is set.

The page is a live funnel: sign-ups, connections requested, mutual confirms, followed up. **Delete all data** removes every profile and connection.

`npm run seed:backup` ensures the confirmed demo pair. Opening `/demo` does the same and sends you to that connection page.

## Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor. Row level security is on and there are no anon policies. The app uses the service role key from the server only.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
4. Restart the server. New sign-ups go to Postgres. The local file is not migrated for you.

## Deploy on Netlify

The public site is [afterflow-f1](https://afterflow-f1.netlify.app). `netlify.toml` runs `npm run build`. Netlify detects Next.js and applies its Next.js runtime. On Netlify, sign-ups go to Netlify Blobs (`STORAGE=netlify-blobs`). Local dev stays on SQLite.

To seed the confirmed demo pair into that blob store from this machine:

```bash
STORAGE=netlify-blobs NETLIFY_SITE_ID=... NETLIFY_AUTH_TOKEN=... npm run seed:backup
```

## Deploy on Vercel

Vercel has no durable disk, so use Supabase there.

1. Push this repo to the host you want Vercel to build.
2. Import the project. Framework preset: Next.js. Build command `npm run build`.
3. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a real `ORGANISER_PASSCODE`.
4. Add `LLM_API_KEY` or `XAI_API_KEY` only if you want model-written explanations. The template works without them.
5. Deploy. The landing QR code uses `window.location.origin`, so it points at the deployed URL.

## What still needs a person

- A Netlify token (`NETLIFY_AUTH_TOKEN`) to publish https://afterflow-f1.netlify.app. Blobs are the hosted store for that site.
- A Supabase project and the service role key, if you want Postgres instead of Blobs.
- An LLM key, if you want model-written copy instead of the template.
- Change `ORGANISER_PASSCODE` before the room can see the organiser page.
- Run `npm run seed` on the machine that is hosting the demo if you want the eight labelled demo profiles.
