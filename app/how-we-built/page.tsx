import { Markdown } from "@/components/markdown";
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function HowWeBuiltPage() {
  const source = fs.readFileSync(path.join(process.cwd(), "BUILD_LOG.md"), "utf8");
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 py-8">
      <Link href="/" className="text-sm uppercase tracking-[0.16em] text-muted">
        Afterflow
      </Link>
      <div className="mt-6">
        <Markdown source={source} />
      </div>
      <p className="mt-10 text-sm text-muted">Data deleted after the event</p>
    </main>
  );
}
