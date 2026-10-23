"use client";

import { DemoTag } from "@/components/ui/demo-tag";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { CircleLink, TopBar } from "@/components/ui/chrome";
import { Icon, type IconName } from "@/components/ui/icons";
import { Mark } from "@/components/ui/mark";
import { api, rememberToken, savedToken } from "@/lib/api";
import type { HomeResult, PersonCard } from "@/lib/connections";
import { clearPendingMeet, firstName, readPendingMeet, rememberMeet } from "@/lib/pending-meet";
import {
  ANSWER_MAX,
  CHANNEL_LABEL,
  CHANNEL_PLACEHOLDER,
  CHANNELS,
  CONSENT_TEXT,
  CONTACTS_HELP,
  CONTACTS_LABEL,
  NAME_LABEL,
  NAME_MAX,
  parseContact,
  QUESTION,
  QUESTION_HELP,
  QUESTION_PLACEHOLDER,
  type Channel,
} from "@/lib/survey";

const INPUT_MODE: Record<Channel, "tel" | "text" | "email"> = { whatsapp: "tel", discord: "text", instagram: "text", email: "email" };
const CHANNEL_ICON: Record<Channel, IconName> = { whatsapp: "chat", discord: "chat", instagram: "camera", email: "mail" };
const CHANNEL_HUE: Record<Channel, number> = { whatsapp: 3, discord: 4, instagram: 5, email: 2 };
const EMPTY: Record<Channel, string> = { whatsapp: "", discord: "", instagram: "", email: "" };

function forInput(channel: Channel, value: string) {
  return channel === "instagram" ? `@${value}` : value;
}

export default function CardForm() {
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<Channel, string>>(EMPTY);
  const [preferred, setPreferred] = useState<Channel | null>(null);
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
          const next = { ...EMPTY };
          for (const value of stored) {
            const parsed = parseContact(value);
            if (parsed.value && !next[parsed.channel]) next[parsed.channel] = forInput(parsed.channel, parsed.value);
          }
          setName(result.data.profile.name);
          setValues(next);
          setPreferred(stored[0] ? parseContact(stored[0]).channel : null);
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

  const filled = CHANNELS.filter((option) => values[option].trim());
  // The star sits on the one you picked, or on the first you filled in.
  const starred: Channel | null = preferred && values[preferred].trim() ? preferred : (filled[0] ?? null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const contacts = filled.map((option) => ({ channel: option, value: values[option] }));
    const body = { name, contacts, preferred: starred, answer, consent };
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

        <fieldset className="mt-2.5" aria-describedby="contact-help">
          <legend className="mx-1 mb-1.5 text-[13px] leading-[18px] font-semibold text-muted">{CONTACTS_LABEL}</legend>
          <div className="group">
            {CHANNELS.map((option) => {
              const has = Boolean(values[option].trim());
              const isStar = starred === option;
              return (
                <div key={option} className="contact-row">
                  <span className={`app-chip hue-${CHANNEL_HUE[option]}`} aria-hidden="true">
                    <Icon name={CHANNEL_ICON[option]} />
                  </span>
                  <span className="contact-main">
                    <label htmlFor={`contact-${option}`} className="contact-label">
                      {CHANNEL_LABEL[option]}
                      {isStar ? <span className="font-normal"> · tried first</span> : null}
                    </label>
                    <input
                      id={`contact-${option}`}
                      value={values[option]}
                      onChange={(event) => setValues((current) => ({ ...current, [option]: event.target.value }))}
                      inputMode={INPUT_MODE[option]}
                      type={option === "email" ? "email" : option === "whatsapp" ? "tel" : "text"}
                      autoComplete={option === "email" ? "email" : option === "whatsapp" ? "tel" : "off"}
                      autoCapitalize="off"
                      spellCheck={false}
                      placeholder={CHANNEL_PLACEHOLDER[option]}
                    />
                  </span>
                  <button
                    type="button"
                    className="star"
                    aria-pressed={isStar}
                    disabled={!has}
                    aria-label={isStar ? `${CHANNEL_LABEL[option]} is the one people try first` : `Make ${CHANNEL_LABEL[option]} the one people try first`}
                    onClick={() => setPreferred(option)}
                  >
                    <Icon name="star" />
                  </button>
                </div>
              );
            })}
          </div>
          <p id="contact-help" className="mx-1 mt-1.5 text-[12px] leading-4 text-muted">
            {CONTACTS_HELP}
          </p>
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
