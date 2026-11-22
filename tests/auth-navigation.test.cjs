const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const player = readFileSync(join(__dirname, "..", "kinqsy-player.js"), "utf8");
function redirectedTo(search, hash) {
  let destination;
  const window = {};
  window.top = window;
  const location = { pathname: "/about.html", search, hash, replace(url) { destination = url; } };
  vm.runInNewContext(player, { window, location, URLSearchParams });
  return destination;
}
test("email recovery callbacks remain on their landing page", () => {
  assert.equal(redirectedTo("", "#access_token=fixture&type=recovery"), undefined);
  assert.equal(redirectedTo("?code=fixture", ""), undefined);
  assert.equal(redirectedTo("", "#error=access_denied"), undefined);
});
test("ordinary profile navigation still enters the player shell", () => {
  assert.equal(redirectedTo("?u=me", ""), "kinqsy-keep.html?p=about.html%3Fu%3Dme");
});
