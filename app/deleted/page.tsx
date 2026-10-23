import Link from "next/link";
import { Icon } from "@/components/ui/icons";

export const dynamic = "force-static";

/** Where you land after deleting your card from My card. Nothing personal here. */
export default function CardDeleted() {
  return (
    <main className="shell flex min-h-dvh flex-col items-center justify-center px-9 text-center">
      <div className="tile tile-ok pop size-[72px]">
        <Icon name="check" size={34} />
      </div>
      <h1 className="round mt-[18px] text-[28px] leading-[34px] font-black">Your card is deleted</h1>
      <p className="mt-2 text-[16px] leading-[23px] text-muted">
        Thanks for coming along. If you meet people at the next one, you can make a new card anytime.
      </p>
      <Link href="/" className="btn btn-lg btn-ink mt-[26px] w-[220px]">
        Done
      </Link>
    </main>
  );
}
