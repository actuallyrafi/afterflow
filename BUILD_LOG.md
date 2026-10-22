# How Afterflow was built

### 22 Oct 2026, 19:46 BST — Project start

Hackbot scoped Afterflow with Tanvir. Grok Bot held the community context and wrote `event-context.json` from the public event page. Commit 7b63fd5ad157ac4b7b6e03a8e4601c5c16b4f0db.

### 22 Oct 2026, 20:05 BST — Card survey

Phone survey for name, contact, role, offers, needs, availability, free text, and consent. Commit 0e3efed1b50c6aef1bfab3ad122309b80ed23728.

### 22 Oct 2026, 20:06 BST — Scoring

Deterministic complement scoring with unit tests. Commit c38aca2ad29bbae997564fa5d8a69e620a2f4f97.

### 22 Oct 2026, 20:08 BST — Contact stays hidden

Contact is returned only after both people accept. Commit c7584f61dd7ad90d0d919a379c2d8c22692a1cc3.

### 22 Oct 2026, 20:11 BST — Organiser and demo seed

Organiser counts, labelled demo seed, and optional Supabase storage. Commit be878a054d7aa5b91d456fd57c26556c5e487712.

### 22 Oct 2026, 20:41 BST — Meetup pass, later withdrawn

A boarding-pass reveal prescribed a time, a place, and a code. Commit 2d67b0b3da752cb9b116fe037d1fb96255efea72. Noted in 7490db6a17b81a70178c7dbc76b271b0fd8a767f.

### 22 Oct 2026, 20:54 BST — Founder correction

Tanvir: Afterflow is for people who already met, so they can keep talking after the event. Stranger matching is not the product. Commit 315b7a0ce47b311740ddd78f07b400239b5ba3c0.

### 22 Oct 2026, 20:59 BST — Binding PRD

Tanvir approved PRD.md version 1.0. Commit 17a43d5191c826652b815f23f5919a81fb80e883.

### 22 Oct 2026, 21:02 BST — PRD alignment

Optional LinkedIn, quiet decline, quoted mutual reason, three optional next steps, follow-up with a timestamp, `/demo`, and the organiser funnel. Commit a2da926d340e34fcf2a44a38ba8c3c5b7434e5a2.

### 22 Oct 2026, 21:04 BST — Notes stay with the writer

Each person's note stays on their side of the connection. Commit 3f447d52838b4e796838336d49fd350046f88107. Recorded in 9028f02de993a19163818ec8c432e2283ffd1c88.

### 22 Oct 2026, 21:11 BST — Netlify Blobs

Sign-ups on Netlify go to Netlify Blobs. Local SQLite stays the default. Commit b657094f0d022fd61efd680eaec7c457404a726c.

### 22 Oct 2026, 21:16 BST — Compliance pass

Removed the leftover matches route and the "my matches" link. Contact and LinkedIn stay off the API until both confirm. Connection copy stays on the template, and any LLM call aborts within 4 seconds. Every seeded card, including Ada Quinn and Jonah Blake, is labelled demo. The build log above cites only commits that exist in this repo.

## Named cut (not built tonight)

Recorded with the PRD log, commit b2a9d3149d9db91fafa6c8fae2ea0ed37c641dde.

- Stranger matching and cross-community matching.
- Automatic 48-hour and 2-week check-ins.
- Tracking real outcomes such as jobs or projects.
- In-app chat, accounts, notifications, and browsing other people's profiles.
