"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PersonalQr } from "@/components/personal-qr";
import { CircleLink, Toast, TopBar, useToast } from "@/components/ui/chrome";
import { Icon } from "@/components/ui/icons";
import { hueOf, Mark } from "@/components/ui/mark";
import { Unavailable } from "@/components/unavailable";
import { api, rememberToken } from "@/lib/api";
import type { HomeResult } from "@/lib/connections";

export default function MyCard() {
  const { token } = useParams<{ token: string }>();
  const [profile, setProfile] = useState<HomeResult["profile"] | null>(null);
  const [missing, setMissing] = useState(false);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
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
    const result = await api<{ profile: HomeResult["profile"] }>(`/api/profiles/${token}`, { method: "PATCH", body: { reminders: next } });
    setSaving(false);
    if (!result.ok) {
      setProfile({ ...profile, reminders: !next });
      show("Couldn't save that. Try again.");
    }
  }

  return (
    <main className="shell page-top pb-16">
      <TopBar left={<CircleLink href={`/m/${token}`} icon="back" label="Back to Your people" />} center={<span className="bar-title">My card</span>} />

      {profile ? (
        <>
          <section className="panel overflow-hidden rounded-[36px]" aria-label="Your card">
            <div className={`hue-${hueOf(profile.publicId)} hue-bg flex items-center gap-3.5 px-5 pt-[18px] pb-4`}>
              <Mark name={profile.name} seed={profile.publicId} size={64} onPlate />
              <div className="min-w-0">
                <h1 className="round truncate text-[24px] leading-[30px] font-black">{profile.name}</h1>
                {profile.answer ? <p className="mt-0.5 line-clamp-2 text-[14px] leading-5 opacity-80">“{profile.answer}”</p> : null}
                {profile.isDemo ? <p className="mt-1 text-[12px] font-semibold">Demo card</p> : null}
              </div>
            </div>
            <div className="px-5 pt-4 pb-[18px] text-center">
              <p className="round text-[16px] font-extrabold">Show this to someone you just met</p>
              <div className="mt-3">
                <PersonalQr value={url} />
              </div>
              <div className="mt-3.5 flex gap-2">
                <button type="button" className="btn btn-fill flex-1" onClick={() => void copyLink()}>
                  <Icon name="copy" />
                  Copy link
                </button>
                <button type="button" className="btn btn-fill flex-1" onClick={() => void share()}>
                  <Icon name="share" />
                  Share
                </button>
              </div>
            </div>
          </section>

          <div className="group mt-3.5">
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
                  At most once per person. Off unless you turn it on.
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
            <Link href={`/m/${token}/delete`} className="item flush items-center hot">
              <span className="t flex-1">Delete my card</span>
            </Link>
          </div>
        </>
      ) : (
        <div aria-busy="true">
          <div className="skeleton h-[460px] w-full rounded-[36px]" />
          <div className="skeleton mt-3.5 h-[190px] w-full rounded-[22px]" />
        </div>
      )}
      <Toast toast={toast} onDone={hide} />
    </main>
  );
}
