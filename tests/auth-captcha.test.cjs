const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const root = resolve(__dirname, "..");
const read = file => readFileSync(resolve(root, file), "utf8");
const source = read("kinqsy-auth-captcha.js");
const siteKey = "1x00000000000000000000AA";

function fixture({ enabled = true, scriptFailure = false } = {}) {
  const widgets = [];
  const removed = [];
  const window = {};
  const turnstile = {
    render(container, options) {
      widgets.push(options);
      return widgets.length;
    },
    remove(id) { removed.push(id); }
  };
  if (!scriptFailure) window.turnstile = turnstile;
  const scripts = [];
  const document = {
    createElement: () => ({ remove() { this.removed = true; } }),
    head: { appendChild(script) { scripts.push(script); } }
  };
  const script = source.replace(/const siteKey = "[^"]*";/, `const siteKey = "${enabled ? siteKey : ""}";`);
  vm.runInNewContext(script, { window, document, setTimeout, clearTimeout });
  const anchor = { before() {} };
  return { api: window.KQAuthCaptcha, window, anchor, widgets, removed, scripts, turnstile };
}

async function tick() {
  await new Promise(resolve => setImmediate(resolve));
}

test("each Auth request receives a fresh token and removes the widget", async () => {
  const { api, anchor, widgets, removed } = fixture();
  const tokens = [];
  const request = options => {
    tokens.push(options.captchaToken);
    return { data: { session: "existing response" }, error: null };
  };
  for (const index of [0, 1]) {
    const result = api.run(anchor, request);
    await tick();
    assert.equal(widgets[index].sitekey, siteKey);
    widgets[index].callback("token-" + index);
    assert.equal((await result).data.session, "existing response");
  }
  assert.deepEqual(tokens, ["token-0", "token-1"]);
  assert.deepEqual(removed, [1, 2]);
});

for (const reason of ["error-callback", "expired-callback", "timeout-callback", "close"]) {
  test(reason + " prevents submission and permits retry", async () => {
    const { api, anchor, widgets, removed } = fixture();
    const first = api.run(anchor, () => assert.fail("Auth should not be called"));
    await tick();
    if (reason === "close") api.cancel(anchor);
    else widgets[0][reason]();
    assert.match((await first).error.message, /проверку/);
    assert.deepEqual(removed, [1]);
    const second = api.run(anchor, options => ({ data: options.captchaToken, error: null }));
    await tick();
    widgets[1].callback("retry-token");
    assert.equal((await second).data, "retry-token");
  });
}

test("a second click cannot submit a concurrent request", async () => {
  const { api, anchor, widgets } = fixture();
  const first = api.run(anchor, () => ({ error: null }));
  const second = await api.run(anchor, () => assert.fail("Duplicate request"));
  assert.match(second.error.message, /уже выполняется/);
  await tick();
  assert.equal(widgets.length, 1);
  widgets[0].callback("token");
  assert.equal((await first).error, null);
});

test("a script load failure allows a new script load on retry", async () => {
  const { api, anchor, scripts, window, turnstile, widgets } = fixture({ scriptFailure: true });
  const first = api.run(anchor, () => assert.fail("Auth should not be called"));
  assert.match(scripts[0].src, /^https:\/\/challenges\.cloudflare\.com\//);
  scripts[0].onerror();
  assert.match((await first).error.message, /проверку/);
  assert.equal(scripts[0].removed, true);
  const second = api.run(anchor, () => ({ error: null }));
  window.turnstile = turnstile;
  scripts[1].onload();
  await tick();
  widgets[0].callback("token");
  assert.equal((await second).error, null);
});

test("no configured site key preserves Auth and server errors are handled", async () => {
  const { api, anchor, widgets } = fixture({ enabled: false });
  const serverError = { code: "invalid_credentials", message: "Invalid login credentials" };
  const result = await api.run(anchor, options => {
    assert.deepEqual(Object.keys(options), []);
    return { error: serverError };
  });
  assert.equal(result.error, serverError);
  for (const error of [{ status: 429 }, { code: "over_request_rate_limit" },
    { code: "over_email_send_rate_limit" }]) {
    assert.match((await api.run(anchor, () => ({ error }))).error.message, /Слишком много запросов/);
  }
  assert.match((await api.run(anchor, () => ({ error: { code: "captcha_failed" } }))).error.message, /проверку/);
  assert.equal(widgets.length, 0);
});

test("all Auth call sites pass the CAPTCHA token and preserve signup and recovery options", async () => {
  for (const [file, count] of [["kinqsy-core.js", 3], ["about.html", 3], ["notes.html", 2], ["quotes.html", 2]]) {
    const code = read(file);
    const calls = [...code.matchAll(/await (window\.KQAuthCaptcha\.run\(err, captcha => sb\.auth\.(\w+)\([\s\S]*?\)\));/g)];
    assert.equal(calls.length, count, file);
    assert.equal([...code.matchAll(/\.auth\.(signUp|signInWithPassword|resetPasswordForEmail)\(/g)].length, count, file);
    for (const [, expression, method] of calls) {
      let captured;
      const context = {
        err: {}, email: "example@example.test", password: "password", nick: "Example",
        redirectTo: () => "https://example.test/callback",
        sb: { auth: { [method]: (...args) => { captured = args; } } },
        window: { KQAuthCaptcha: { run: (_, request) => request({ captchaToken: "test-token" }) } }
      };
      vm.runInNewContext(expression, context);
      const options = method === "resetPasswordForEmail" ? captured[1] : captured[0].options;
      assert.equal(options.captchaToken, "test-token", file);
      if (method === "resetPasswordForEmail") assert.equal(options.redirectTo, context.redirectTo());
      if (method === "signUp" && count === 3) {
        assert.equal(options.emailRedirectTo, context.redirectTo());
        assert.equal(options.data.display_name, context.nick);
      }
    }
  }
  for (const file of readdirSync(root).filter(name => name.endsWith(".html"))) {
    const html = read(file);
    const core = html.indexOf('<script src="kinqsy-core.js">');
    if (core === -1) continue;
    const captcha = html.indexOf('<script src="kinqsy-auth-captcha.js">');
    assert.ok(captcha >= 0 && captcha < core, file);
  }
});
