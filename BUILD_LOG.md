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

## Post-freeze bug fix (after 21:50 BST code freeze)

- 22:30 BST, 22 Oct 2026: post-freeze bug fix only, no feature changes. Scanning a personal QR code and then making a card sent people to their own home page instead of "Yes, we met", because phone QR scanners open links in a different browser and the pending meet id lived only in sessionStorage. The meet id is now carried in the /survey URL. Commit 5b6185d.

## Post-event design pass

### 22 Oct 2026, 23:25 BST — Keep the person you scanned in view

After the demo, from Atelier's design review. Built on commit 07e3c59ad01dc70a9d07db06412fbff4fc67bfca. No new features and no change to the rules: still no stranger matching, no prescribed time or place, contacts hidden until both confirm.

- Scanning someone's code now keeps them on screen until "Yes, we met". The card form shows "Connecting with" their name and "Step 1 of 2", and the save button says "Save and continue to" their first name. The meet page then asks "Did you meet" them, with "Card saved. One tap left." and the optional note under the button.
- The pending meet id still travels in the URL, then sessionStorage, then localStorage, and the localStorage copy now expires after an hour.
- The connection recap uses first names, quotes each person once, and no longer repeats those quotes in the reason below it. The opener reads like a person wrote it and only uses the note someone actually typed.
- The landing QR code now sits inside its frame at every width, before and after it loads.
- Tests: separate test stores no longer share one JSON file on Node 20, and the build log check accepts the hackathon commits that were squashed into this public repo's first commit.
- The README is rewritten for people who just want to try it.
- The colour and type restyle is on hold for a new visual direction.

### 23 Oct 2026, 00:20 BST — v4 redesign: Your people

Built on commit 500bba02005f5876dc3c8b8f037bf133b97fbc52, on the local branch v4-redesign. Preview only, not production.

- New look across every screen: people get a mark in their own colour, the connection page reads like a short chat ("Met at", what you both said, "You both said yes"), and frosted controls float over the content. Dark mode follows the phone's setting. Reduced motion and reduced transparency are respected.
- The card is three things: name, one way to reach you (WhatsApp, Discord, Instagram or email) and "What's something you're into right now?". Role, chips, top picks, LinkedIn, availability and the old goal question are gone. Old cards still open.
- The scoring code is deleted. There is no score and no "why" line, just what you both said and a shared note.
- Mute, Remove and Block are quiet and never tell the other person. Remove and Block have firmer confirms and an Undo toast. Blocked people are listed under Your people, and blocking stops them adding you again. There is no Report.
- Cards stay until someone removes a connection or deletes their card. "Delete my card" asks you to type your name, then really removes the card, its links and its connections.
- "Say hi" has an editable opener. WhatsApp opens with the message ready; Discord, Instagram and email get Copy plus the handle, or an email link. "Open in Discord" waits behind a flag that is off.
- At most one gentle reminder per person, off by default. "Talked again? Mark it" is private. Your own notes are private and the shared note is visible to both.
- The tab bar, counts and "Followed up" badges are gone.
- Tests were rewritten around the new rules rather than dropped.

### 23 Oct 2026, 00:40 BST — Review fixes after the Bible check

Built on commit 21f07f12d4bde418944012d9f409f1ef9c457dd4, still on the local branch v4-redesign and preview only.

- The README now tells the friendship-first story from BIBLE.md: the "into right now" question, Say hi on WhatsApp, Discord, Instagram or email, quiet Mute, Remove and Block, and Delete my card. The old pitch, scoring and "deleted after the event" lines are gone, and the three screenshots are from the new design.
- BIBLE.md is now in the repo, and PRD.md opens with a note that BIBLE.md supersedes it.
- The card form now says what is true: your answer shows on your card link, and your contact only shows once you both confirm.
- The organiser page leads with Talked again (private marks, added up) and Both said yes. Connections requested and cards are small context. Nothing is per person or ranked.
- Demo people carry the same small Demo label everywhere they appear.
- The QR meet flow was tested end to end in two separate browsers, one of them an emulated phone, including the storage fallback.

### 23 Oct 2026, 03:11 BST — v4.1: tab bar, private events, several ways to reach you, calendar reminder

Built on commits eee38664415ceaa80646ce8f5bafe4769bcd36b9 (features, data and Bible v1.1) and fa3129d81cafa4a0b7e05151d0e17f4ead2febb7 (design pass to Pixel's spec v4.1), on the local branch v4-redesign. Preview only, not production.

- A floating tab bar with Your people, Events and My card. It shows only on those three screens and hides while the keyboard is open. My card is no longer in the ⋯ menu, which now holds Blocked, Privacy and your data, and Help and feedback. The + to add someone moved to the Your people header.
- Events are private to each person. You can make, rename and delete them (deleting only moves people to No event, with Undo), move someone from their ⋯ sheet, and filter Your people by event. "I'm at an event now" files new people automatically and turns itself off at 4am or after 12 hours. Events show up to three small marks and never a number.
- People who joined before this release see a "Grok Bot London · 22 Oct" event holding their earlier connections. It is worked out when read and only saved once they change something, so the live site's data is never rewritten.
- A card can hold one way to reach you per app (WhatsApp, Discord, Instagram, email), with one starred. Old single-contact cards read as before, and the live build keeps reading the starred one. Say hi goes to an app you both use first, then their starred one, then the rest in their order.
- "Add a reminder to my calendar": a Google Calendar link or a .ics file made on the phone, "Say hi to Mira" three days after you met. The calendar only gets the title and a link without your private key; that link opens Afterflow on your own phone and shows nothing about the person anywhere else. Adding it switches off Afterflow's own reminder for that person.
- BIBLE.md is v1.1, with a positioning section ("Afterflow is the connector, not the connection. You do the connecting.") and a changelog.
- Not built: web push. There is still no email sending.
- 55 tests pass. The QR meet flow passes in two separate browsers against a local production build.

### 23 Oct 2026, 03:32 BST — v4.1a quote cards and a calmer person page

Built on commit 4220b3e8d7c7c8509953e97d6cc7d1927540706e, on the local branch v4-redesign. Preview only, not production.

- What you both said is now two stacked quote cards, theirs first, each with a thin rule in that person's colour and a label such as "Mira said · Grok Bot London". They are plain quotes, not chat: no bubbles, tails, times or reply box.
- The person page drops the chat-style top bar. It shows floating back and ⋯ buttons, then their mark, their name and where you met. A plain title bar with their name fades in as you scroll, and it stays solid when Reduce transparency is on.
- The page now reads Say hi, then the quotes, then your notes, then the calendar reminder.
- Discord's copy-username button is a copy icon with the word "Username".
- The How we built page now carries the positioning line: "Afterflow is the connector, not the connection. You do the connecting."
- The TypeScript build cache is no longer tracked, so builds stop leaving a stray change.
- 60 tests pass. The QR meet flow passes against a local production build. A fresh browser with no saved card sees only the neutral reminder page, checked in Chromium, Firefox and WebKit, and the QR redirect works in all three.

### 23 Oct 2026, 08:00 BST — v4.1c: a longer landing, chat-bubble person page, reminder on, home-screen app

On the local branch v4-redesign. Preview only, not production. All per Tanvir.

- The landing page is long again, like the hackathon page. Its extra lines are back and rewritten to match what Afterflow does now ("You already met. Afterflow gets the two of you talking again after the event."; your contact stays hidden until you both say yes). "Data deleted after the event" is gone because it isn't true any more. New sections: why it exists, how it works in six steps, private and quiet, and use it like an app. The positioning line is on the page.
- The person page uses the chat-bubble layout Tanvir prefers again: a centred name pill, a "Met at … · date" divider, their answer as a bubble on the left in their colour, yours on the right in grey, then "You both said yes", the shared note, your private note, and Say hi. There is no message box: Afterflow isn't a chat. The quote cards are gone. The Username copy button stays.
- The one gentle reminder is now on for new cards. Turn it off any time on My card. Cards saved before the setting existed read as on. A saved "off" stays off. Nothing is rewritten in bulk.
- You can add Afterflow to your home screen: there's a web app manifest, Pixel's icons, Apple tags and a small service worker. The worker keeps only the app's static files and the public start page. It never keeps API answers, your own /m pages, connection or card links. On your own pages the manifest opens your own Your people, so the home-screen app opens signed in, even on iPhone, where home-screen apps don't share Safari's storage.
- "Use it like an app" is a short guide with three steps for your phone (iPhone Safari or Android Chrome). Open it from a quiet line on My card, the line you see right after making a card, or the landing page. It stays hidden when Afterflow is already running from the home screen.

### 23 Oct 2026, 08:06 BST — v4.1d: the next-morning event recap, the install step, every contact saved

On the local branch v4-redesign. Preview only, not production. All per Tanvir.

- The morning after an event, Your people shows one small card: "{Event} · yesterday, Say hi to the people you met", with up to three marks and Open. It shows from 07:00 the day after the last time you and someone from that event both said yes, until the end of the third day. It goes when you hide it (with Undo) or when everyone in it is done. Only the most recent event gets a card. People with no event don't get one. It never uses push and doesn't change the per-person reminder.
- The recap screen lists everyone from the event you both said yes to. Each row has Say hi (or Copy hi for Discord), which opens their app with your hello ready, and Mark as talked, which works any time. A row shows "Opened WhatsApp" once you've opened a hello. When everyone is done, it says so, without counting anyone. Events has a Recap button for each event with people in it.
- A calendar reminder for a recap holds only /recap/{event}. That opens the recap on your own phone and shows the same neutral page as other reminders anywhere else.
- Right after making a card on a phone, a new step, "Add Afterflow to your home screen", shows that phone's steps, with Done and Not now. It's skipped when Afterflow is already on the home screen. The landing page no longer has the guide, only one short line. The hint on My card stays.
- The landing drops the "doesn't match you with strangers…" line. The positioning line is now "Afterflow keeps the door open. You two walk through it." here, on the landing, in the README and in BIBLE.md (v1.2, approved by Tanvir on 23 Oct).
- Make your card: each app tab keeps what you type, and every one you fill in is saved. The first one you filled is starred. A dot marks tabs with something in them. "Add another way" is gone from the form.
- 92 tests pass. 38 cross-engine checks pass in each of Chromium, Firefox and WebKit.

### 23 Oct 2026, 08:31 BST — v4.1e: shared note sync, a tidier Say hi, the home-screen pop-up, Appearance

On the local branch v4-redesign. Preview only, not production. All per Tanvir.

- Shared note: either of you can edit it and the other sees the change. The person page now checks again when you come back to it (switching apps, unlocking, refocusing), and a quiet "Updated by Mira · 08:14" line shows when they changed it. There's no live chat or typing dot. If they changed it while you were editing, Afterflow doesn't overwrite theirs: it shows their version and you can save again to replace it. Checked both ways, and there was no regression from v4.1.
- "Other ways to reach Mira" is one row with small app icons and a chevron. Tap it to open the rows. It starts closed and doesn't show when there's only one way.
- Right after you make your card on a phone, "Add Afterflow to your home screen" pops up as a sheet over your first signed-in page, with that phone's steps (and Install on Android when Chrome offers it), Done and Not now. It shows once, never on a computer or when Afterflow is already on the home screen. The hint on My card stays.
- Appearance: System, Light or Dark, on My card and as a small button on the landing. It's saved on this phone and applied before the page draws, so there's no flash, and the browser bar colour follows it.
- 104 tests pass. 53 cross-engine checks pass in each of Chromium, Firefox and WebKit.

### 23 Oct 2026, 08:54 BST — v4.1f: no focus ring when a sheet opens, calmer calendar copy

On the local branch v4-redesign. Preview only, not production. All per Tanvir.

- When a sheet opens (the ⋯ menu, the calendar reminder, the home-screen pop-up, Delete card and the rest), the sheet itself takes focus instead of its first button, so iPhone Safari no longer draws a blue ring on Blocked, the time chip or Done. Tab still moves through the controls with a visible ring, Escape still closes, and focus goes back to what opened the sheet. The chosen time chip shows as filled and bold.
- The calendar sheet now says "A nudge in a few days, in your own calendar." without "You can ignore it."
- The emails showing in an answer bubble were what the browser put into the answer box, not a bug where contacts are copied into the answer. The answer box now asks Safari not to AutoFill it.
- 112 tests pass. 60 cross-engine checks pass in each of Chromium, Firefox and WebKit.

### 23 Oct 2026, 09:21 BST — v4.1g: liquid-glass selectors

On the local branch v4-redesign. Preview only, not production. Pixel's motion spec (design-spec-v41g-motion), per Tanvir.

- The tab bar and every segmented control (the app picker on Edit my card, the contact tabs on Make your card, the calendar time chips and Appearance) now have one glass pill that glides to the option you pick. It springs, stretches a little on the way, dips when pressed and can be dragged. The label under it fades to full ink as the pill arrives.
- Appearance changes colour 200ms after you tap, once the pill has landed.
- Reduced motion: a short slide with no stretch. Reduced transparency, high contrast, forced colours and no JavaScript each get a plain fallback. Only transform and opacity animate.
- Segment buttons are 38px (a 44px target with the control's padding). Tabs are at least 50px. The contact tabs still show their filled dots, and tapping never draws a focus ring. Arrow keys, Home and End move through the options.
- 120 tests pass. 75 cross-engine checks pass in each of Chromium, Firefox and WebKit.

### 23 Oct 2026, 16:22 BST — v4.1h: organiser access per event, and a safer delete

On the local branch v4-redesign. Preview only, not production. Per Tanvir, from his screenshot of the organiser page.

- Every event now has its own organiser access. On `/organiser`, with the master code, you type the event name and day and tap once. You get the link attendees use to join and a private organiser link to send to that event's organiser, shown once with Copy and Share. The private link opens that event's totals and nothing else. "Make a new organiser link" swaps it, and the old link stops working.
- Totals (Talked again, Both said yes, connections requested, cards) count only that event's people and connections. Still totals only: nobody is listed or ranked.
- "Delete all data" is gone, and the old wipe now refuses. In its place, "Delete this event's data" sits in a danger zone far below everything else, as a quiet outlined button. It opens a sheet where you have to type the event's exact name before the red button works. It removes that event's connections (with their notes and marks) and who joined. A card goes only if that person was in no other event and has no other connections. Everyone else just leaves the event.
- Grok Bot London is built in. Cards and connections from before events shipped count for it, so its totals carry on without any data being moved.
- Keys are 256-bit, stored only as a hash, checked in constant time. A wrong key, a wrong code and an unknown event all get the same answer, and repeated wrong tries are slowed down. Organiser pages are never cached or indexed, and the service worker never stores them.
- 131 tests pass. 88 cross-engine checks pass in each of Chromium, Firefox and WebKit.

### 23 Oct 2026, 16:35 BST — v4.1i: smoother motion and the real app logos

On the local branch v4-redesign. Preview only, not production. From Pixel's motion and icon patch, reviewed and adjusted.

- The sliding pills (tab bar, contact apps, Appearance, calendar times) now move on the graphics compositor, so they stay smooth when the page is busy. A tap mid-glide redirects the pill from where it is.
- WhatsApp, Discord and Instagram show their official logos (Simple Icons, CC0), filled in the text colour. Email gets its own envelope. The licence and trademark note are in `licenses/simple-icons/`.
- Every line icon is a touch lighter (stroke 1.75). Checked on the main screens in light and dark.
- Appearance: Pixel's patch waited for the pill to land (about 0.4s) before changing the colours, which felt slow. Now the colours start changing about 30ms after the tap with a short crossfade, while the pill finishes its glide.
- The contact app switch takes effect at once too, so typing straight after a tap goes into the right app's field. The calendar time still commits when its pill lands.
- 136 tests pass. 90 cross-engine checks pass in each of Chromium, Firefox and WebKit.
