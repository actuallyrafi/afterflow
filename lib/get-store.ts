import { createNetlifyBlobStore } from "./netlify-blob-store";
import { createSupabaseStore } from "./supabase-store";
import { createFileStore, STORE_VERSION, type Store } from "./store";

const globalStore = globalThis as unknown as { __afterflow?: Store };

export type StorageMode = "netlify-blobs" | "supabase" | "file";

export function storageMode(): StorageMode {
  const choice = process.env.STORAGE?.trim();
  if (choice === "netlify-blobs") return "netlify-blobs";
  if (choice === "supabase") return "supabase";
  if (choice === "sqlite" || choice === "file" || choice === "json") return "file";
  if (process.env.NETLIFY === "true" || process.env.NETLIFY === "1" || process.env.NETLIFY_BLOBS_CONTEXT) {
    return "netlify-blobs";
  }
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  return "file";
}

function matches(current: Store, mode: StorageMode) {
  if (current.version !== STORE_VERSION) return false;
  if (mode === "netlify-blobs") return current.kind === "netlify-blobs";
  if (mode === "supabase") return current.kind === "supabase";
  return current.kind === "sqlite" || current.kind === "json";
}

export function getStore(): Store {
  const mode = storageMode();
  const current = globalStore.__afterflow;
  if (!current || !matches(current, mode)) {
    if (mode === "netlify-blobs") {
      globalStore.__afterflow = createNetlifyBlobStore();
      console.log("[afterflow] netlify blobs storage");
    } else if (mode === "supabase") {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error("Supabase storage needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
      globalStore.__afterflow = createSupabaseStore(url, key);
      console.log("[afterflow] supabase storage");
    } else {
      globalStore.__afterflow = createFileStore();
    }
  }
  const store = globalStore.__afterflow;
  if (!store) throw new Error("Afterflow storage did not start.");
  return store;
}
