"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { savedToken } from "@/lib/api";
import {
  ANDROID_MENU_STEPS,
  INSTALL_FROM_MY_CARD,
  INSTALL_ON_MY_CARD,
  INSTALL_OPENS,
  INSTALL_TITLE,
  IOS_STEPS,
  installSteps,
  platformOf,
  type InstallPlatform,
  type InstallStep,
} from "@/lib/install-guide";
import { canPromptInstall, isStandalone, onInstallChange, promptInstall } from "./pwa";
import { Sheet } from "./ui/chrome";

/** Device + install state, read after mount (never during SSR). */
export function useInstallState() {
  const [state, setState] = useState<{ ready: boolean; standalone: boolean; platform: InstallPlatform; canPrompt: boolean }>({
    ready: false,
    standalone: false,
    platform: "other",
    canPrompt: false,
  });
  useEffect(() => {
    const read = () =>
      setState({ ready: true, standalone: isStandalone(), platform: platformOf(navigator.userAgent, navigator.maxTouchPoints), canPrompt: canPromptInstall() });
    read();
    return onInstallChange(read);
  }, []);
  return state;
}

export function StepList({ steps, start = 1 }: { steps: InstallStep[]; start?: number }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-3">
          <span className="round flex size-7 shrink-0 items-center justify-center rounded-full bg-fill text-[14px] font-black" aria-hidden>
            {index + start}
          </span>
          <span className="min-w-0 pt-0.5">
            <span className="block text-[16px] leading-[22px] font-semibold">{step.title}</span>
            {step.detail ? <span className="block text-[14px] leading-5 text-muted">{step.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The "Use it like an app" sheet. `myCardToken` is set on your own My card page; elsewhere, if this
 * phone has a saved card, it points you to My card so the home-screen app opens signed in.
 */
export function InstallGuideSheet({ open, onClose, myCardToken = null }: { open: boolean; onClose: () => void; myCardToken?: string | null }) {
  const { platform, canPrompt } = useInstallState();
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => {
    if (open) setSaved(savedToken());
  }, [open]);
  const steps = installSteps(platform, canPrompt);
  const where = myCardToken ? "mycard" : saved ? "elsewhere" : "none";

  return (
    <Sheet open={open} onClose={onClose} labelledBy="install-title" describedBy="install-opens">
      <div className="swap" data-platform={platform}>
        <h2 id="install-title" className="round text-center text-[22px] leading-7 font-black">
          {INSTALL_TITLE}
        </h2>
        <p id="install-opens" className="mx-auto mt-1.5 max-w-[300px] text-center text-[15px] leading-[21px] text-muted">
          {INSTALL_OPENS}
        </p>
        <div className="group mt-4 p-4">
          {platform === "other" ? (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="tag mb-2">iPhone · Safari</h3>
                <StepList steps={IOS_STEPS} />
              </div>
              <div>
                <h3 className="tag mb-2">Android · Chrome</h3>
                <StepList steps={ANDROID_MENU_STEPS} />
              </div>
            </div>
          ) : (
            <>
              <h3 className="tag mb-2">{platform === "ios" ? "On this iPhone · Safari" : "On this phone · Chrome"}</h3>
              <StepList steps={steps} />
            </>
          )}
        </div>
        {where === "mycard" ? (
          <p className="mt-3 px-2 text-center text-[13px] leading-[18px] text-muted">{INSTALL_ON_MY_CARD}</p>
        ) : where === "elsewhere" ? (
          <p className="mt-3 px-2 text-center text-[13px] leading-[18px] text-muted">
            {INSTALL_FROM_MY_CARD}{" "}
            <Link href={`/m/${saved}/card`} className="font-semibold text-ink underline underline-offset-2" onClick={onClose}>
              Open My card
            </Link>
          </p>
        ) : null}
        {platform !== "ios" && canPrompt ? (
          <button
            type="button"
            className="btn btn-lg btn-ink mt-4 w-full"
            data-autofocus
            onClick={async () => {
              const outcome = await promptInstall();
              if (outcome === "accepted") onClose();
            }}
          >
            Install
          </button>
        ) : null}
        <button type="button" className="group mt-2.5 block min-h-[54px] w-full text-[17px] font-semibold" onClick={onClose} data-autofocus={platform === "ios" || !canPrompt ? true : undefined}>
          Done
        </button>
      </div>
    </Sheet>
  );
}

/** Small text button that opens the guide; hidden when already running from the home screen. */
export function InstallGuideLink({ className = "", children = INSTALL_TITLE }: { className?: string; children?: React.ReactNode }) {
  const { ready, standalone } = useInstallState();
  const [open, setOpen] = useState(false);
  if (!ready || standalone) return null;
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {children}
      </button>
      <InstallGuideSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Landing section: the same steps for both phones, quiet. Hidden when already installed. */
export function InstallGuideSection() {
  const { ready, standalone } = useInstallState();
  const [open, setOpen] = useState(false);
  if (ready && standalone) return null;
  return (
    <section className="mt-12 max-w-2xl" aria-labelledby="install-section-title" id="use-it-like-an-app">
      <h2 id="install-section-title" className="round text-[26px] leading-8 font-black tracking-[-0.01em]">
        {INSTALL_TITLE}
      </h2>
      <p className="mt-2 text-[15px] leading-[22px] text-muted">
        Add Afterflow to your home screen. {INSTALL_OPENS} {INSTALL_FROM_MY_CARD}
      </p>
      <div className="mt-4 grid gap-2.5 md:grid-cols-2">
        <div className="panel p-4">
          <h3 className="tag mb-3">iPhone · Safari</h3>
          <StepList steps={IOS_STEPS} />
        </div>
        <div className="panel p-4">
          <h3 className="tag mb-3">Android · Chrome</h3>
          <StepList steps={ANDROID_MENU_STEPS} />
        </div>
      </div>
      <button type="button" className="btn btn-fill mt-4" onClick={() => setOpen(true)} aria-haspopup="dialog">
        Show me on this phone
      </button>
      <InstallGuideSheet open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
