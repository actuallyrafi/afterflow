"use client";

import { DemoTag } from "@/components/ui/demo-tag";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CHANNEL_ICON, ContactWay, contactError } from "@/components/contact-fields";
import { AppearanceControl } from "@/components/theme";
import { DeleteCardSheet } from "@/components/delete-card-sheet";
import { PersonalQr } from "@/components/personal-qr";
import { InstallHint } from "@/components/pwa";
import { Sheet, Toast, useToast } from "@/components/ui/chrome";
import { Icon } from "@/components/ui/icons";
import { hueOf, Mark } from "@/components/ui/mark";
import { Unavailable } from "@/components/unavailable";
import { api, rememberToken } from "@/lib/api";
import type { HomeResult } from "@/lib/connections";
import { CHANNEL_LABEL, CHANNELS, CONTACTS_HELP, CONTACTS_LAST_ONE, CONTACTS_LABEL, parseContact, type Channel } from "@/lib/survey";

type Profile = HomeResult["profile"];
type Way = { channel: Channel; value: string };

function waysOf(profile: Profile): Way[] {
  const raw = profile.contacts?.length ? profile.contacts : [profile.contact];
  const out: Way[] = [];
  for (const value of raw) {
    const parsed = parseContact(value);
    if (parsed.value && !out.some((way) => way.channel === parsed.channel)) out.push(parsed);
  }
  return out;
}

function shown(way: Way): string {
  return way.channel === "instagram" ? `@${way.value}` : way.value;
}

export default function MyCard() {
  const { token } = useParams<{ token: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [missing, setMissing] = useState(false);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [qr, setQr] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Channel | null>(null);
  const [addChannel, setAddChannel] = useState<Channel>("whatsapp");
  const [addValue, setAddValue] = useState("");
  const [announce, setAnnounce] = useState("");
  const { toast, show, hide } = useToast();

  useEffect(() => {
    rememberToken(token);
    void api<HomeResult>(`/api/profiles/${token}`).then((result) => {
      if (result.ok && result.data.profile) {
        setProfile(result.data.profile);
        setUrl(`${window.location.origin}/meet/${result.data.profile.publicId}`);
      } else if (result.status === 404) setMissing(true);
    });
  }, [token]);

  // Old /delete links land here with #danger-zone; the section renders after the card loads.
  const loaded = Boolean(profile);
  useEffect(() => {
    if (loaded && window.location.hash === "#danger-zone") document.getElementById("danger-zone")?.scrollIntoView({ block: "end" });
  }, [loaded]);

  const ways = profile ? waysOf(profile) : [];
  const free = CHANNELS.filter((channel) => !ways.some((way) => way.channel === channel));

  useEffect(() => {
    if (free.length && !free.includes(addChannel)) setAddChannel(free[0]);
  }, [free, addChannel]);

  if (missing) return <Unavailable />;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      show("Link copied");
    } catch {
      show("Couldn't copy. Press and hold the link instead.");
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "My Afterflow card", text: "Here's my card from the Grok Bot hackathon", url });
      } catch {
        // Cancelled.
      }
      return;
    }
    await copyLink();
  }

  async function toggleReminder() {
    if (!profile) return;
    const next = !profile.reminders;
    setSaving(true);
    setProfile({ ...profile, reminders: next });
    const result = await api<{ profile: Profile }>(`/api/profiles/${token}`, { method: "PATCH", body: { reminders: next } });
    setSaving(false);
    if (!result.ok) {
      setProfile({ ...profile, reminders: !next });
      show("Couldn't save that. Try again.");
    }
  }

  /** Save the whole list in order; the first is the starred one. */
  async function saveWays(next: Way[], done?: string): Promise<boolean> {
    if (!profile || !next.length) return false;
    setSaving(true);
    const result = await api<{ profile: Profile }>(`/api/profiles/${token}`, {
      method: "PATCH",
      body: { contacts: next.map((way) => ({ channel: way.channel, value: way.value })), preferred: next[0].channel },
    });
    setSaving(false);
    if (!result.ok || !result.data.profile) {
      show(result.data.error || "Couldn't save that. Try again.");
      return false;
    }
    setProfile(result.data.profile);
    if (done) show(done);
    return true;
  }

  function star(channel: Channel) {
    const way = ways.find((item) => item.channel === channel);
    if (!way || ways[0].channel === channel) return;
    void saveWays([way, ...ways.filter((item) => item.channel !== channel)], `${CHANNEL_LABEL[channel]} is now your preferred way.`);
  }

  async function move(index: number, by: -1 | 1) {
    const target = index + by;
    if (target < 0 || target >= ways.length) return;
    const next = [...ways];
    [next[index], next[target]] = [next[target], next[index]];
    const label = CHANNEL_LABEL[ways[index].channel];
    if (await saveWays(next)) {
      setAnnounce(`${label} moved to position ${target + 1} of ${next.length}`);
      if (target === 0 || index === 0) show(`${CHANNEL_LABEL[next[0].channel]} is now your preferred way.`);
    }
  }

  async function remove(channel: Channel) {
    if (ways.length <= 1) return;
    const wasStar = ways[0].channel === channel;
    const next = ways.filter((way) => way.channel !== channel);
    setConfirmRemove(null);
    await saveWays(next, wasStar ? `${CHANNEL_LABEL[next[0].channel]} is now your preferred way.` : `${CHANNEL_LABEL[channel]} removed.`);
  }

  async function add() {
    if (!addValue.trim() || contactError(addChannel, addValue)) return;
    const ok = await saveWays([...ways, { channel: addChannel, value: addValue }], `${CHANNEL_LABEL[addChannel]} added.`);
    if (ok) setAddValue("");
  }

  const addInvalid = !addValue.trim() || Boolean(contactError(addChannel, addValue));

  if (editing && profile) {
    return (
      <main className="shell page-top">
        <div className="mb-3 flex items-center justify-between gap-3 pt-2">
          <h1 className="t-title">{CONTACTS_LABEL}</h1>
          <button type="button" className="btn btn-sm btn-ink" onClick={() => setEditing(false)}>
            Done
          </button>
        </div>
        <ul className="group" aria-label={CONTACTS_LABEL}>
          {ways.map((way, index) => {
            const isStar = index === 0;
            const last = ways.length === 1;
            return (
              <li key={way.channel} aria-roledescription="sortable" className="border-b-[0.5px] border-line last:border-b-0">
                <div className="contact-row !gap-2.5 !pl-3">
                  <button
                    type="button"
                    className="grid size-9 flex-none place-items-center text-hot disabled:text-faint"
                    aria-label={`Remove ${CHANNEL_LABEL[way.channel]}`}
                    aria-describedby={last ? "last-one" : undefined}
                    disabled={last || saving}
                    onClick={() => setConfirmRemove(way.channel)}
                  >
                    <Icon name="minus" className="rounded-full [&_path]:stroke-[2.2]" />
                  </button>
                  <span className="app-tile">
                    <Icon name={CHANNEL_ICON[way.channel]} />
                  </span>
                  <span className="contact-main">
                    <span className="block text-[17px] leading-[22px]">{CHANNEL_LABEL[way.channel]}</span>
                    <span className="block truncate text-[15px] text-muted">{shown(way)}</span>
                  </span>
                  <button
                    type="button"
                    className="star"
                    aria-pressed={isStar}
                    aria-label={isStar ? "Preferred" : `Make ${CHANNEL_LABEL[way.channel]} preferred`}
                    onClick={() => star(way.channel)}
                    disabled={saving}
                  >
                    <Icon name="star" className={isStar ? "[&_path]:fill-current" : undefined} />
                  </button>
                  <span className="flex flex-col">
                    <button
                      type="button"
                      className="grid h-6 w-8 place-items-center text-muted disabled:opacity-30"
                      aria-label={`Move ${CHANNEL_LABEL[way.channel]} up`}
                      disabled={index === 0 || saving}
                      onClick={() => void move(index, -1)}
                    >
                      <Icon name="chevDown" size={18} className="rotate-180" />
                    </button>
                    <button
                      type="button"
                      className="grid h-6 w-8 place-items-center text-muted disabled:opacity-30"
                      aria-label={`Move ${CHANNEL_LABEL[way.channel]} down`}
                      disabled={index === ways.length - 1 || saving}
                      onClick={() => void move(index, 1)}
                    >
                      <Icon name="chevDown" size={18} />
                    </button>
                  </span>
                </div>
                {confirmRemove === way.channel ? (
                  <div className="swap flex items-center gap-2 px-4 pb-3 outline-none" role="group" aria-label={`Remove ${CHANNEL_LABEL[way.channel]}?`} tabIndex={-1} autoFocus>
                    <span className="flex-1 text-[15px]">Remove {CHANNEL_LABEL[way.channel]}?</span>
                    <button type="button" className="btn btn-sm btn-fill" onClick={() => setConfirmRemove(null)}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-sm btn-hot" onClick={() => void remove(way.channel)} disabled={saving}>
                      Remove
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="mx-4 mt-2 text-[13px] leading-[18px] text-muted">
          {ways.length === 1 ? <span id="last-one">{CONTACTS_LAST_ONE}</span> : "Tap the star to choose your favourite. Use the arrows to reorder."}
        </p>

        {free.length ? (
          <>
            <h2 className="tag mx-4 mt-6 mb-0">Add another way</h2>
            <form
              className="field mt-2"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void add();
              }}
            >
              <ContactWay
                id="add-contact"
                channel={addChannel}
                value={addValue}
                taken={ways.map((way) => way.channel)}
                onChannel={(channel) => {
                  setAddChannel(channel);
                  setAddValue("");
                }}
                onValue={setAddValue}
              />
              <button type="submit" className="btn btn-lg btn-ink mt-3 w-full" disabled={addInvalid || saving} aria-busy={saving}>
                Add {CHANNEL_LABEL[addChannel]}
              </button>
            </form>
          </>
        ) : null}
        <p className="sr-only" role="status" aria-live="polite">
          {announce}
        </p>
        <Toast toast={toast} onDone={hide} />
      </main>
    );
  }

  return (
    <main className="shell page-top">
      <h1 className="t-display pt-2">My card</h1>

      {profile ? (
        <>
          <section className="panel mt-3 overflow-hidden rounded-[30px]" aria-label="Your card">
            <div className={`hue-${hueOf(profile.publicId)} hue-bg flex items-center gap-3.5 px-5 pt-[18px] pb-4`}>
              <Mark name={profile.name} seed={profile.publicId} size={64} onPlate />
              <div className="min-w-0">
                <h2 className="round truncate text-[24px] leading-[30px] font-black">{profile.name}</h2>
                {profile.answer ? <p className="mt-0.5 line-clamp-2 text-[14px] leading-5 opacity-80">“{profile.answer}”</p> : null}
                {profile.isDemo ? <p className="mt-1.5"><DemoTag className="on-plate !ml-0" /></p> : null}
              </div>
            </div>
            <div className="flex gap-2 p-4">
              <button type="button" className="btn btn-lg btn-ink flex-1" onClick={() => setQr(true)} aria-haspopup="dialog">
                <Icon name="qr" />
                Show my QR
              </button>
              <button type="button" className="btn btn-lg btn-fill" onClick={() => void share()}>
                Share
              </button>
            </div>
          </section>

          <InstallHint myCardToken={token} />

          <div className="mx-4 mt-6 mb-2 flex items-baseline justify-between">
            <h2 className="tag">{CONTACTS_LABEL}</h2>
            <button type="button" className="text-[16px] font-semibold" onClick={() => setEditing(true)}>
              Edit
            </button>
          </div>
          <ul className="group">
            {ways.map((way, index) => {
              const isStar = index === 0;
              return (
                <li key={way.channel} className="contact-row border-b-[0.5px] border-line last:border-b-0">
                  <span className="app-tile">
                    <Icon name={CHANNEL_ICON[way.channel]} />
                  </span>
                  <span className="contact-main">
                    <span className="block text-[17px] leading-[22px]">{CHANNEL_LABEL[way.channel]}</span>
                    <span className="block truncate text-[15px] text-muted">{shown(way)}</span>
                  </span>
                  <button
                    type="button"
                    className="star"
                    aria-pressed={isStar}
                    aria-label={isStar ? "Preferred" : `Make ${CHANNEL_LABEL[way.channel]} preferred`}
                    onClick={() => star(way.channel)}
                    disabled={saving}
                  >
                    <Icon name="star" className={isStar ? "[&_path]:fill-current" : undefined} />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mx-4 mt-2 text-[13px] leading-[18px] text-muted">{CONTACTS_HELP}</p>

          <div className="group mt-6">
            <Link href="/survey?edit=1" className="item flush items-center">
              <span className="t flex-1">Edit my card</span>
              <Icon name="chev" className="chev" />
            </Link>
            <div className="item flush items-center">
              <span className="flex-1">
                <span id="reminder-label" className="t block">
                  One gentle reminder
                </span>
                <span id="reminder-help" className="s block">
                  {profile.reminders
                    ? "At most once per person, never for anyone you mute. Turn it off any time."
                    : "Off. Turn it on for at most one nudge per person."}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={profile.reminders}
                aria-labelledby="reminder-label"
                aria-describedby="reminder-help"
                className="toggle"
                disabled={saving}
                onClick={() => void toggleReminder()}
              />
            </div>
            <AppearanceControl />
          </div>

          {/* Danger zone: far below everything else so it can't be hit by accident (v4.1b, per Tanvir). */}
          <section id="danger-zone" aria-labelledby="danger-title" className="danger-zone">
            <h2 id="danger-title" className="tag mx-4 mb-2">
              Danger zone
            </h2>
            <div className="group">
              <button type="button" className="item flush items-center" onClick={() => setDeleting(true)} aria-haspopup="dialog">
                <span className="t flex-1 text-hot">Delete my card</span>
              </button>
            </div>
            <p className="mx-4 mt-2 text-[13px] leading-[18px] text-muted">
              Removes your card, notes, events and connections for good. You&apos;ll be asked to confirm.
            </p>
          </section>
          <DeleteCardSheet token={token} name={profile.name} open={deleting} onClose={() => setDeleting(false)} />
        </>
      ) : (
        <div aria-busy="true">
          <div className="skeleton mt-3 h-[180px] w-full rounded-[30px]" />
          <div className="skeleton mt-6 h-[190px] w-full rounded-[22px]" />
        </div>
      )}

      <Sheet open={qr} onClose={() => setQr(false)} labelledBy="qr-title">
        <h2 id="qr-title" className="round text-center text-[20px] leading-6 font-black">
          Show this to someone you just met
        </h2>
        <div className="mt-4 text-center">
          <PersonalQr value={url} />
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn btn-fill flex-1" onClick={() => void copyLink()}>
            <Icon name="copy" />
            Copy link
          </button>
          <button type="button" className="btn btn-fill flex-1" onClick={() => void share()}>
            <Icon name="share" />
            Share
          </button>
        </div>
        <button type="button" className="btn btn-plain mt-1.5 w-full" onClick={() => setQr(false)}>
          Done
        </button>
      </Sheet>
      <Toast toast={toast} onDone={hide} />
    </main>
  );
}
