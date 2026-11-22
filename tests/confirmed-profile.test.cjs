const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "kinqsy-core.js"), "utf8");
const uid = "aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb";

function fixture({ guest, existing, taken, selectError } = {}) {
  let row = existing;
  const writes = [];
  const client = {
    auth: { getSession: async () => ({ data: { session: guest ? null :
      { user: { id: uid, user_metadata: { display_name: "second" } } } } }) },
    from(table) {
      assert.equal(table, "profiles");
      return {
        select() { return this; },
        eq(column, value) { assert.equal(column, "id"); assert.equal(value, uid); return this; },
        maybeSingle: async () => ({ data: row, error: selectError }),
        upsert: async (input, options) => {
          assert.equal(options.onConflict, "id");
          assert.equal(options.ignoreDuplicates, true);
          writes.push(input);
          if (taken && input.user_id === "second") return { error: { code: "23505" } };
          row ??= input;
          return {};
        }
      };
    }
  };
  const window = { __kinqsy_sb: client };
  vm.runInNewContext(source, { window, location: { hash: "" }, URLSearchParams });
  return { resolve: () => window.Kinqsy.resolveViewedProfile("me", "id"), writes };
}

test("a missing profile gets the session UID, its own username and a friend code", async () => {
  const f = fixture();
  const { data } = await f.resolve();
  assert.equal(data.id, uid);
  assert.equal(data.user_id, "second");
  assert.equal(data.display_name, "second");
  assert.match(data.friend_code, /^KQ-[A-Z0-9]{6}$/);
  await f.resolve();
  assert.equal(f.writes.length, 1);
});
test("a taken username gets a distinct fallback for the same account", async () => {
  const { data } = await fixture({ taken: true }).resolve();
  assert.equal(data.id, uid);
  assert.match(data.user_id, /^user-[a-f0-9]{20}$/);
});
test("guest, existing profile and failed lookup never trigger an insert", async () => {
  for (const options of [{ guest: true }, { existing: { id: uid } }, { selectError: { code: "42501" } }]) {
    const f = fixture(options);
    await f.resolve();
    assert.equal(f.writes.length, 0);
  }
});
