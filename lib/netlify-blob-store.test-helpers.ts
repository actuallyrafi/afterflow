type Entry = { value: string; etag: string };

/** An in-memory stand-in for the Netlify Blobs client, with etags and onlyIfNew/onlyIfMatch. */
export function memoryBlobs() {
  const data = new Map<string, Entry>();
  let n = 0;
  const next = () => `e${++n}`;

  return {
    keys: () => [...data.keys()],
    raw: (key: string, value: unknown) => data.set(key, { value: typeof value === "string" ? value : JSON.stringify(value), etag: next() }),
    async get(key: string, options?: { type?: "json" | "text" }) {
      const entry = data.get(key);
      if (!entry) return null;
      if (options?.type === "json") return JSON.parse(entry.value);
      return entry.value;
    },
    async getWithMetadata(key: string) {
      const entry = data.get(key);
      if (!entry) return null;
      return { data: JSON.parse(entry.value), etag: entry.etag };
    },
    async set(key: string, value: string, options?: { onlyIfNew?: boolean; onlyIfMatch?: string }) {
      const current = data.get(key);
      if (options?.onlyIfNew && current) return { modified: false };
      if (options?.onlyIfMatch && current?.etag !== options.onlyIfMatch) return { modified: false };
      const etag = next();
      data.set(key, { value, etag });
      return { modified: true, etag };
    },
    async setJSON(key: string, value: unknown, options?: { onlyIfNew?: boolean; onlyIfMatch?: string }) {
      return this.set(key, JSON.stringify(value), options);
    },
    async delete(key: string) {
      data.delete(key);
    },
    async deleteAll() {
      const deletedBlobs = data.size;
      data.clear();
      return { deletedBlobs };
    },
    list({ prefix }: { prefix?: string; paginate: true }) {
      const blobs = [...data.keys()].filter((key) => (prefix ? key.startsWith(prefix) : true)).map((key) => ({ key }));
      return (async function* () {
        yield { blobs };
      })();
    },
  };
}
