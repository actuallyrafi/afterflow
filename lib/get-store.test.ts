import assert from "node:assert/strict";
import test from "node:test";
import { storageMode } from "./get-store";

function withEnv(values: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test("storage mode follows Netlify, an explicit choice, then the local file", () => {
  withEnv(
    { STORAGE: undefined, NETLIFY: undefined, NETLIFY_BLOBS_CONTEXT: undefined, SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined },
    () => {
      assert.equal(storageMode(), "file");
    },
  );
  withEnv({ STORAGE: undefined, NETLIFY: "true" }, () => {
    assert.equal(storageMode(), "netlify-blobs");
  });
  withEnv({ STORAGE: "netlify-blobs", NETLIFY: undefined, NETLIFY_BLOBS_CONTEXT: undefined }, () => {
    assert.equal(storageMode(), "netlify-blobs");
  });
  withEnv({ STORAGE: "sqlite", NETLIFY: "true" }, () => {
    assert.equal(storageMode(), "file");
  });
});
