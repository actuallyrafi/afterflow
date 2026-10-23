"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { StepList, useInstallState } from "@/components/install-guide";
import { promptInstall } from "@/components/pwa";
import { Spinner } from "@/components/ui/chrome";
import { rememberToken } from "@/lib/api";
import { INSTALL_OPENS, INSTALL_STEP_SIGNED_IN, INSTALL_STEP_TITLE, installSteps } from "@/lib/install-guide";

const SEEN_KEY = "afterflow.install.step";

/**
 * D24: the step right after making a card, before Your people. Only this device's steps, a primary
 * Done and a quiet Not now. Already running from the home screen (or on a computer): skipped.
 */
export default function InstallStep() {
  const { token } = useParams<{ token: string }>();
  const { ready, standalone, platform, canPrompt } = useInstallState();
  const home = `/m/${token}`;
  const skip = ready && (standalone || platform === "other");

  useEffect(() => {
    rememberToken(token);
  }, [token]);

  useEffect(() => {
    if (skip) window.location.replace(home);
  }, [skip, home]);

  useEffect(() => {
    document.title = `${INSTALL_STEP_TITLE} · Afterflow`;
  }, []);

  function leave(answer: "done" | "later") {
    try {
      localStorage.setItem(SEEN_KEY, answer);
    } catch {
      // Private mode: nothing to remember.
    }
    window.location.assign(home);
  }

  if (!ready || skip) {
    return (
      <main className="shell grid min-h-dvh place-items-center" aria-busy="true">
        <Spinner />
      </main>
    );
  }

  const steps = installSteps(platform, canPrompt);
  return (
    <main className="shell flex min-h-dvh flex-col pt-[max(env(safe-area-inset-top),20px)] pb-[max(env(safe-area-inset-bottom),20px)]" data-platform={platform}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Image src="/icons/icon-192.png" alt="" width={84} height={84} className="rounded-[22%] shadow-[0_6px_24px_rgba(0,0,0,0.12)]" priority />
        <h1 className="round mt-6 max-w-[320px] text-[28px] leading-[34px] font-black text-balance">{INSTALL_STEP_TITLE}</h1>
        <p className="mt-2 max-w-[310px] text-[16px] leading-[22px] text-muted">{INSTALL_OPENS}</p>
        <section className="panel mt-6 w-full max-w-[400px] p-4 text-left" aria-labelledby="install-step-device">
          <h2 id="install-step-device" className="tag mb-3">
            {platform === "ios" ? "On this iPhone · Safari" : "On this phone · Chrome"}
          </h2>
          <StepList steps={steps} />
          {platform === "android" && canPrompt ? (
            <button
              type="button"
              className="btn btn-fill mt-4 w-full"
              onClick={async () => {
                if ((await promptInstall()) === "accepted") leave("done");
              }}
            >
              Install
            </button>
          ) : null}
        </section>
        <p className="mt-3 max-w-[310px] text-[13px] leading-[18px] text-muted">{INSTALL_STEP_SIGNED_IN}</p>
      </div>
      <div className="mx-auto flex w-full max-w-[400px] flex-col gap-1 pt-6">
        <button type="button" className="btn btn-lg btn-ink w-full" onClick={() => leave("done")}>
          Done
        </button>
        <button type="button" className="min-h-[48px] w-full text-[16px] font-semibold text-muted" onClick={() => leave("later")}>
          Not now
        </button>
      </div>
    </main>
  );
}
