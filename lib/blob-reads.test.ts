import assert from "node:assert/strict";
import test from "node:test";
import { guardReads } from "./netlify-blob-store";

// On Netlify's runtime a get() of a missing key never resolves, but getMetadata() answers null
// right away. Every page load reads a missing key (an event book nobody has made yet), so this
// used to cost ~5s per request. Reads must now come back fast either way.
function fakeClient(data: Record<string, string>, metaDelay = 5) {
  const never = new Promise<never>(() => undefined);
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  return {
    async get(key: string) {
      if (!(key in data)) return never;
      await wait(10);
      return data[key];
    },
    async getWithMetadata(key: string) {
      if (!(key in data)) return never;
      await wait(10);
      return { data: JSON.parse(data[key]), etag: "e1" };
    },
    async getMetadata(key: string) {
      await wait(metaDelay);
      return key in data ? { etag: "e1", metadata: {} } : null;
    },
    set: async () => ({ modified: true }),
    setJSON: async () => ({ modified: true }),
    delete: async () => undefined,
    deleteAll: async () => ({ deletedBlobs: 0 }),
    list: () => ({ async *[Symbol.asyncIterator]() {} }),
  };
}

test("a missing key reads as null in milliseconds instead of waiting out the caps", async () => {
  const real = fakeClient({ "tokens/a": "id-a", "eventbooks/x": '{"events":[]}' });
  const client = guardReads(real, fakeClient({}), 2000);
  const started = Date.now();
  assert.equal(await client.get("eventbooks/nobody", { type: "json", consistency: "strong" }), null);
  assert.equal(await client.getWithMetadata("eventbooks/nobody", { type: "json", consistency: "strong" }), null);
  assert.ok(Date.now() - started < 500, `took ${Date.now() - started}ms`);
});

test("existing keys still read normally, even when the metadata check is slower", async () => {
  const real = fakeClient({ "tokens/a": "id-a", "eventbooks/x": '{"events":[]}' }, 50);
  const client = guardReads(real, fakeClient({}), 2000);
  assert.equal(await client.get("tokens/a", { consistency: "strong" }), "id-a");
  assert.deepEqual(await client.getWithMetadata("eventbooks/x", { type: "json", consistency: "strong" }), { data: { events: [] }, etag: "e1" });
});
