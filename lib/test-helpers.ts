import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFileStore } from "./store";
import type { Submission } from "./survey";

export function tempStore(label = "afterflow") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${label}-`));
  return createFileStore(path.join(dir, "flow.sqlite"));
}

export function card(name: string, partial: Partial<Submission> = {}): Submission {
  const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, ".");
  return {
    name,
    contact: `discord:${handle}.secret`,
    answer: `${name} is into something specific right now`,
    ...partial,
  };
}
