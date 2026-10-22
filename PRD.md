# Afterflow PRD (binding source of truth)
Owner: Tanvir (founder). Version 1.0, 22 Oct 2026, 20:57 BST. Any change to this file needs Tanvir's approval.
Deadlines (BST): feature freeze 21:15, working build for fallback video 21:25, code freeze 21:50, demo 22:20.

## 1. Purpose
Afterflow helps people who ALREADY met or worked together at a hackathon reconnect and keep collaborating AFTER the event.
It is NOT a stranger-matching app and NOT a list of recommended people.

## 2. Users
- Attendee: met people tonight, wants those conversations to turn into something.
- Organiser: wants to see whether the event produced lasting connections.

## 3. Core user journey (must work end to end, in this order)
J1. Landing: one-line pitch, QR code of the site, privacy note, Start.
J2. Make my card: name, contact (email or Discord), optional LinkedIn, one-line role, offers (multi-select, one top), needs (multi-select, one top), availability, REQUIRED free text "What's one thing you're trying to make happen in the next month, and what's stopping you?" (helper text + example chips + soft nudge under 8 words), REQUIRED consent checkbox.
J3. My card: personal QR code and share link so someone I met can add me.
J4. Add someone I met: scan their QR / open their link, or search people who signed up by name. Optional note: "what we talked about / worked on".
J5. Double opt-in: the other person sees the request and confirms "yes, we met". Contact details stay hidden until BOTH confirm. Declining is possible and quiet.
J6. Connection page (the payoff, must not feel like a dead end):
  - recap of who they are and what you talked about, quoting both people's own words and the note word for word in quotation marks;
  - why it's worth continuing: mutual-value explanation from deterministic overlap of offers/needs/free text, evidence quoted, never invented;
  - OPTIONAL next steps the pair can choose from: keep chatting online (copyable opener for Discord/email/LinkedIn), share a link or repo, one community next step from event-context.json (a real partner contact or Discord channel), or suggest a time to meet (suggestion only);
  - "Did you follow up?" Yes / Not yet, stored with timestamp.
J7. My connections (home): everyone I added or who added me, with status: waiting for them / needs my confirm / connected / followed up.

## 4. Rules (must)
R1. Never prescribe a meeting time, place, or code. Online chat is a valid outcome.
R2. No stranger "top matches" list as a primary screen. (A secondary "you might also want to meet" is out of scope tonight.)
R3. Scoring/explanations are deterministic; an LLM may only rephrase and must use only the two cards, the note and event-context.json; template fallback always works.
R4. Never invent facts about people or community resources. If evidence is weak, say so plainly instead of stretching.
R5. Privacy: minimal data, consent required, contact/LinkedIn hidden until mutual confirm, "data deleted after the event" shown, organiser delete-all really deletes. No scraping Luma or any profiles. No WiFi passwords or coupon/credit codes anywhere.
R6. Seeded demo profiles are visibly labelled "demo".
R7. Mobile-first; must look intentional and polished, not generic AI UI.

## 5. Organiser view (/organiser, passcode) - built last
Sign-ups, connections requested, mutual confirms, followed up (funnel), delete-all.

## 6. Out of scope tonight (the named cut for the pitch)
Stranger/cross-community matching, automated 48h / 2-week check-ins, outcome tracking (jobs, projects), in-app chat, auth, notifications, profile browsing.

## 7. Acceptance checklist (Judge verifies each change)
[ ] J1-J7 work end to end in two separate browsers.
[ ] Contacts hidden until both confirm; decline works.
[ ] Connection page quotes both people verbatim and offers optional next steps only.
[ ] No prescribed time/place; no stranger-match list as main screen.
[ ] Community next step comes only from event-context.json.
[ ] Scoring unit tests pass.
[ ] Organiser funnel + delete-all work (if built).
[ ] Demo labels, consent, privacy note present.
[ ] BUILD_LOG.md updated.
