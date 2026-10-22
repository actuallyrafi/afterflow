<h1 align="center">Afterflow</h1>

<p align="center">
  <a href="https://afterflow-f1.netlify.app"><strong>Open Afterflow → afterflow-f1.netlify.app</strong></a>
</p>

<p align="center">
  You already met at the hackathon. Afterflow gets the two of you talking again.
</p>

<p align="center">
  <a href="https://afterflow-f1.netlify.app">Live app</a> ·
  <a href="https://afterflow-f1.netlify.app/demo">Demo connection</a> ·
  <a href="https://afterflow-f1.netlify.app/how-we-built">How we built it</a> ·
  <a href="#run-it-yourself">Run it yourself</a> ·
  <a href="LICENSE">MIT licence</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black" alt="Next.js 15">
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6" alt="TypeScript 5">
  <img src="https://img.shields.io/badge/hosted%20on-Netlify-00ad9f" alt="Hosted on Netlify">
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-MIT-blue" alt="MIT licence"></a>
</p>

<p align="center">
  <img src="docs/home.png" width="230" alt="Afterflow home page with the event QR code in its frame">
  <img src="docs/meet.png" width="230" alt="Did you meet Maya? One tap left">
  <img src="docs/connection.png" width="230" alt="A demo connection page quoting both people">
</p>

Afterflow was built in one evening at the Grok Bot Community Engineering London Hackathon (22 Oct 2026). It is for people who **already met**. It does not match you with strangers.

## How it works

1. **Make a card.** Name, a way to reach you, and one honest answer: *what's one thing you're trying to make happen in the next month, and what's stopping you?*
2. **Share your code.** Someone you talked to scans your QR code or opens your link, adds an optional note, and taps **Yes, we met**.
3. **Both confirm.** Contact details stay hidden on the server until you both say yes. Saying no is quiet.
4. **Pick it back up.** The connection page quotes what you both wrote, word for word, says plainly why it could be worth continuing, and offers optional next steps: a ready-to-send opener, a link to share, one community step from the event, or a time suggestion.
5. **Did you follow up?** One tap, so organisers can see whether the night produced real connections.

## Private by default

- Your contact and LinkedIn are revealed only after both people confirm.
- Recaps only quote what people actually typed. Nothing is made up.
- Demo profiles are always labelled **Demo**.
- Data is deleted after the event, and the organiser's "delete all" really deletes.

## Run it yourself

You need Node 20 or newer. No accounts or keys are needed for a local demo.

```bash
git clone https://github.com/actuallyrafi/afterflow.git
cd afterflow
npm install
npm run dev
```

Open http://127.0.0.1:4721 (set `PORT` to change it).

<details>
<summary><strong>Developer notes</strong></summary>

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on `0.0.0.0:${PORT:-4721}` |
| `npm run build` and `npm start` | Production build and server |
| `npm test` | Unit and flow tests (Node's built-in test runner) |
| `npm run seed` | Replaces the labelled demo profiles, keeps real sign-ups |
| `npm run seed:backup` | Makes sure the confirmed demo pair behind `/demo` exists |

### Storage

| Mode | When | Where |
| --- | --- | --- |
| SQLite | Default on Node 22+ | `data/afterflow.sqlite` (`SQLITE_PATH`) |
| JSON | SQLite is unavailable (Node 20) | `data/afterflow.json` (`JSON_PATH`) |
| Supabase | `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set, `STORAGE` unset | Postgres, schema in `supabase/schema.sql` |
| Netlify Blobs | On Netlify, or `STORAGE=netlify-blobs` | One blob per profile and connection |

Each person gets a secret token in their page URL and in `localStorage`. There is no login.

### Environment variables

All optional locally. Never commit real values.

| Variable | Purpose |
| --- | --- |
| `PORT` | Listen port, default `4721` |
| `ORGANISER_PASSCODE` | Passcode for `/organiser` (default `afterflow`; change it before an event) |
| `STORAGE` | Force a store, e.g. `netlify-blobs` |
| `SQLITE_PATH`, `JSON_PATH` | Local file locations |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Postgres storage. The service key is server-only |
| `LLM_API_KEY` or `XAI_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | Optional rephrasing of the "why" text |

Scoring is deterministic. A model may only rephrase it, using just the two cards, the note and `event-context.json`. With no key, an error, or a call over 4 seconds, the built-in template is used.

### Deploy

Netlify: `netlify.toml` runs `npm run build` and stores sign-ups in Netlify Blobs.

```bash
npx netlify-cli deploy --prod
```

To seed the `/demo` pair into the hosted blob store:

```bash
STORAGE=netlify-blobs NETLIFY_SITE_ID=your-site-id NETLIFY_AUTH_TOKEN=your-token npm run seed:backup
```

Vercel has no durable disk, so use Supabase there: set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and a real `ORGANISER_PASSCODE`, then deploy as a normal Next.js project.

### Organiser view

`/organiser` (passcode) shows a live funnel: sign-ups, connections requested, mutual confirms, followed up, plus **Delete all data**.

</details>

## How we built it

Afterflow was built solo with a small team of agents, and every step is logged with real commits. Read it at [/how-we-built](https://afterflow-f1.netlify.app/how-we-built) or in [BUILD_LOG.md](BUILD_LOG.md).

## Licence

MIT. See [LICENSE](LICENSE).
