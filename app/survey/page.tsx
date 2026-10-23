"use client";

import { DemoTag } from "@/components/ui/demo-tag";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { CircleLink, TopBar } from "@/components/ui/chrome";
import { ContactWay, contactError } from "@/components/contact-fields";
import { Icon } from "@/components/ui/icons";
import { Mark } from "@/components/ui/mark";
import { api, rememberToken, savedToken } from "@/lib/api";
import type { HomeResult, PersonCard } from "@/lib/connections";
import { clearPendingMeet, firstName, readPendingMeet, rememberMeet } from "@/lib/pending-meet";
import {
  ANSWER_MAX,
  CHANNELS,
  CONSENT_TEXT,
  CONTACT_LABEL,
  NAME_LABEL,
  NAME_MAX,
  parseContact,
  QUESTION,
  QUESTION_HELP,
  QUESTION_PLACEHOLDER,
  type Channel,
} from "@/lib/survey";

type Way = { channel: Channel; value: string };

function forInput(channel: Channel, value: string) {
  return channel === "instagram" ? `@${value}` : value;
}

export default function CardForm() {
  const [name, setName] = useState("");
  // The first way is "Best way to reach you" (the starred one); the rest are optional extras.
  const [ways, setWays] = useState<Way[]>([{ channel: "whatsapp", value: "" }]);
  const [tried, setTried] = useState(false);
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
          const next: Way[] = [];
          for (const value of stored) {
            const parsed = parseContact(value);
            if (parsed.value && !next.some((way) => way.channel === parsed.channel)) next.push({ channel: parsed.channel, value: forInput(parsed.channel, parsed.value) });
          }
          setName(result.data.profile.name);
          if (next.length) setWays(next);
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

  function setWay(index: number, patch: Partial<Way>) {
    setWays((current) => current.map((way, i) => (i === index ? { ...way, ...patch, ...(patch.channel ? { value: "" } : {}) } : way)));
  }

  function addWay() {
    const free = CHANNELS.find((option) => !ways.some((way) => way.channel === option));
    if (free) setWays((current) => [...current, { channel: free, value: "" }]);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setTried(true);
    // Extra ways left empty are just skipped; a bad value stops the save with its own message.
    const filled = ways.filter((way, index) => index === 0 || way.value.trim());
    if (filled.some((way) => contactError(way.channel, way.value))) return;
    setSaving(true);
    const contacts = filled.map((way) => ({ channel: way.channel, value: way.value }));
    const body = { name, contacts, preferred: ways[0].channel, answer, consent };
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
    const pending = meetId || readPendingMeet(new URLSearchParams(window.location.search).get("meet"));
    clearPendingMeet();
    window.location.assign(pending ? `/meet/${encodeURIComponent(pending)}?saved=1` : `/m/${token}`);
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
          <ContactWay
            id="contact"
            channel={ways[0].channel}
            value={ways[0].value}
            taken={ways.slice(1).map((way) => way.channel)}
            onChannel={(channel) => setWay(0, { channel })}
            onValue={(value) => setWay(0, { value })}
            showError={tried}
          />
          {ways.slice(1).map((way, offset) => {
            const index = offset + 1;
            return (
              <div key={index} className="mt-3 border-t-[0.5px] border-line pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-muted">Another way · optional</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-plain !h-8 !px-2"
                    onClick={() => setWays((current) => current.filter((_, i) => i !== index))}
                    aria-label={`Remove this way to reach you`}
                  >
                    Remove
                  </button>
                </div>
                <ContactWay
                  id={`contact-${index + 1}`}
                  channel={way.channel}
                  value={way.value}
                  taken={ways.filter((_, i) => i !== index).map((other) => other.channel)}
                  onChannel={(channel) => setWay(index, { channel })}
                  onValue={(value) => setWay(index, { value })}
                  showError={tried && Boolean(way.value.trim())}
                  autoFocus
                />
              </div>
            );
          })}
          {ways.length < CHANNELS.length ? (
            <button type="button" className="mt-2 flex min-h-11 w-full items-center gap-2.5 border-t-[0.5px] border-line pt-2 text-left text-[16px]" onClick={addWay}>
              <Icon name="plus" size={20} />
              <span className="font-semibold">Add another way</span>
              <span className="text-muted">· optional</span>
            </button>
          ) : null}
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
