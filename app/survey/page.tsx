"use client";

import { JOIN_EVENT_KEY } from "@/lib/organiser-client";
import { isStandalone } from "@/components/pwa";
import { INSTALL_PENDING_KEY, platformOf, shouldPromptInstall } from "@/lib/install-guide";
import { DemoTag } from "@/components/ui/demo-tag";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { CircleLink, TopBar } from "@/components/ui/chrome";
import { ContactTabs } from "@/components/contact-fields";
import { Icon } from "@/components/ui/icons";
import { Mark } from "@/components/ui/mark";
import { api, rememberToken, savedToken } from "@/lib/api";
import type { HomeResult, PersonCard } from "@/lib/connections";
import { clearPendingMeet, firstName, readPendingMeet, rememberMeet } from "@/lib/pending-meet";
import {
  ANSWER_MAX,
  collectTabs,
  fillOrder,
  CONSENT_TEXT,
  CONTACT_LABEL,
  NAME_LABEL,
  NAME_MAX,
  parseContact,
  QUESTION,
  QUESTION_HELP,
  QUESTION_PLACEHOLDER,
  type Channel,
  type TabValues,
} from "@/lib/survey";

function forInput(channel: Channel, value: string) {
  return channel === "instagram" ? `@${value}` : value;
}

export default function CardForm() {
  const [name, setName] = useState("");
  // D25: every app tab keeps its own value; all filled ones are saved. The first filled is starred.
  const [values, setValues] = useState<TabValues>({});
  const [order, setOrder] = useState<Channel[]>([]);
  const [active, setActive] = useState<Channel>("whatsapp");
  const [contactProblem, setContactProblem] = useState<{ channel: Channel; error: string } | null>(null);
  const [answer, setAnswer] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [meetId, setMeetId] = useState<string | null>(null);
  const [meetPerson, setMeetPerson] = useState<PersonCard | null>(null);
  const [editToken, setEditToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("edit") ? savedToken() : null;
    if (token) {
      setEditToken(token);
      void api<HomeResult>(`/api/profiles/${token}`).then((result) => {
        if (result.ok && result.data.profile) {
          const stored = result.data.profile.contacts?.length ? result.data.profile.contacts : [result.data.profile.contact];
          const next: TabValues = {};
          const filledOrder: Channel[] = [];
          for (const value of stored) {
            const parsed = parseContact(value);
            if (parsed.value && !next[parsed.channel]) {
              next[parsed.channel] = forInput(parsed.channel, parsed.value);
              filledOrder.push(parsed.channel);
            }
          }
          setName(result.data.profile.name);
          setValues(next);
          setOrder(filledOrder);
          if (filledOrder.length) setActive(filledOrder[0]);
          setAnswer(result.data.profile.answer);
        } else setEditToken(null);
        setReady(true);
      });
      return;
    }
    setReady(true);
    const pending = readPendingMeet(params.get("meet"));
    if (!pending) return;
    setMeetId(pending);
    rememberMeet(pending);
    void api<{ person: PersonCard }>(`/api/people/${encodeURIComponent(pending)}`).then((result) => {
      if (result.ok && result.data.person) setMeetPerson(result.data.person);
    });
  }, []);

  const meetFirst = meetPerson ? firstName(meetPerson.name) : "";
  const editing = Boolean(editToken);

  function setValue(channel: Channel, value: string) {
    setValues((current) => ({ ...current, [channel]: value }));
    setOrder((current) => fillOrder(current, channel, value));
    if (contactProblem?.channel === channel) setContactProblem(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    // Empty tabs are skipped; a bad value switches to its tab and shows the error there.
    const collected = collectTabs(values, order);
    if (collected.invalid) {
      setActive(collected.invalid.channel);
      setContactProblem(collected.invalid);
      return;
    }
    setContactProblem(null);
    setSaving(true);
    let joinEventId: string | undefined;
    try {
      joinEventId = editing ? undefined : localStorage.getItem(JOIN_EVENT_KEY) || undefined;
    } catch {
      joinEventId = undefined;
    }
    const body = { name, contacts: collected.contacts, preferred: collected.preferred, answer, consent, ...(joinEventId ? { joinEventId } : {}) };
    const result = editing
      ? await api<{ profile?: unknown }>(`/api/profiles/${editToken}`, { method: "PATCH", body })
      : await api<{ token?: string }>("/api/profiles", { method: "POST", body });
    if (!result.ok) {
      setError(result.data.error || "Couldn't save. Try again.");
      setSaving(false);
      return;
    }
    if (editing) {
      window.location.assign(`/m/${editToken}/card`);
      return;
    }
    const token = (result.data as { token?: string }).token;
    if (!token) {
      setError("Couldn't save. Try again.");
      setSaving(false);
      return;
    }
    rememberToken(token);
    try {
      localStorage.removeItem(JOIN_EVENT_KEY);
    } catch {
      // Nothing stored.
    }
    const pending = meetId || readPendingMeet(new URLSearchParams(window.location.search).get("meet"));
    clearPendingMeet();
    // D28: a phone in the browser gets the "Add Afterflow to your home screen" pop-up on its first
    // signed-in page (Your people, or after "Yes, we met" on the QR path).
    if (shouldPromptInstall({ standalone: isStandalone(), platform: platformOf(navigator.userAgent, navigator.maxTouchPoints) })) {
      try {
        localStorage.setItem(INSTALL_PENDING_KEY, "1");
      } catch {
        // Private mode: no pop-up; the My card hint is still there.
      }
    }
    const next = `/m/${token}`;
    window.location.assign(pending ? `/meet/${encodeURIComponent(pending)}?saved=1` : next);
  }

  const back = editing ? `/m/${editToken}/card` : meetId ? `/meet/${encodeURIComponent(meetId)}` : "/";

  return (
    <main className="shell page-top pb-16">
      <TopBar left={<CircleLink href={back} icon="back" label="Back" />} />
      <h1 className="t-title">{editing ? "Edit your card" : "Make your card"}</h1>
      <p className="mt-1 mb-4 text-[15px] leading-[21px] text-muted">
        {editing ? "Change anything. People you've connected with see the update." : "Three quick things. Your answer shows on your card link. Your contact only shows once you both confirm."}
      </p>

      {meetPerson && !editing ? (
        <div className="mb-3 flex items-center gap-2.5 rounded-[22px] bg-panel py-2.5 pr-4 pl-2.5">
          <Mark name={meetPerson.name} seed={meetPerson.publicId} size={40} />
          <p className="min-w-0 flex-1 text-[14px] leading-5">
            <span className="flex min-w-0 items-center font-semibold"><span className="truncate">Then say yes to {meetPerson.name}</span>{meetPerson.isDemo ? <DemoTag /> : null}</span>
            <span className="block text-muted">Step 1 of 2</span>
          </p>
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate aria-busy={!ready}>
        <label className="field" htmlFor="name">
          <span className="field-label">{NAME_LABEL}</span>
          <input
            id="name"
            required
            value={name}
            maxLength={NAME_MAX}
            onChange={(event) => setName(event.target.value)}
            autoComplete="given-name"
            placeholder="Ada"
          />
        </label>

        <fieldset className="field mt-2.5">
          <legend className="sr-only">{CONTACT_LABEL}</legend>
          <span className="field-label" aria-hidden="true">
            {CONTACT_LABEL}
          </span>
          <ContactTabs
            id="contact"
            values={values}
            active={active}
            onActive={setActive}
            onValue={setValue}
            error={contactProblem?.channel === active ? contactProblem.error : ""}
          />
        </fieldset>

        <label htmlFor="answer" className="round mx-1 mt-[18px] mb-0.5 block text-[18px] leading-6 font-extrabold">
          {QUESTION}
        </label>
        <p id="answer-help" className="mx-1 mb-2 text-[13px] text-muted">
          {QUESTION_HELP}
        </p>
        <textarea
          id="answer"
          required
          value={answer}
          maxLength={ANSWER_MAX}
          onChange={(event) => setAnswer(event.target.value)}
          rows={3}
          placeholder={QUESTION_PLACEHOLDER}
          aria-describedby="answer-help"
          // D30: keep Safari's contact AutoFill (email, phone) out of the free-text answer.
          autoComplete="off"
          className="answer-bubble"
        />
        {answer.length > 160 ? (
          <p className="mx-1 mt-1 text-right text-[12px] text-muted" aria-live="polite">
            {ANSWER_MAX - answer.length} left
          </p>
        ) : null}

        {!editing ? (
          <label className="mx-1 mt-4 flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="sr-only" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
            <span className="check" aria-hidden="true">
              {consent ? <Icon name="check" size={16} /> : null}
            </span>
            <span className="text-[14px] leading-5">{CONSENT_TEXT}</span>
          </label>
        ) : null}

        {error ? (
          <p role="alert" className="mx-1 mt-3 text-[14px] text-hot">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={saving || !ready} aria-busy={saving} className="btn btn-lg btn-ink mt-[18px] w-full">
          {saving ? "Saving…" : editing ? "Save changes" : meetPerson ? `Save and say yes to ${meetFirst}` : "Save my card"}
        </button>
      </form>
      {!editing ? (
        <p className="mt-5 text-center text-[13px] text-muted">
          Already have a card? Open your link, or <Link href="/" className="underline">start here</Link>.
        </p>
      ) : null}
    </main>
  );
}
