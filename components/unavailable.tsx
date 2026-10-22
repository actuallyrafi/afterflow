import Link from "next/link";

/** Neutral, for a deleted card or an unknown link. Nothing says why. */
export function Unavailable() {
  return (
    <main className="shell flex min-h-dvh flex-col items-center justify-center px-9 text-center">
      <h1 className="t-title">This card isn&apos;t available</h1>
      <p className="mt-2 text-[16px] leading-[23px] text-muted">It may have been deleted. You can make a new card anytime.</p>
      <Link href="/survey" className="btn btn-lg btn-ink mt-6 w-[220px]">
        Make a card
      </Link>
    </main>
  );
}
