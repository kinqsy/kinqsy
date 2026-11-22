(function (global) {
  // Public site key. Configure it alongside server-side CAPTCHA in Supabase Auth.
  const siteKey = "";
  const apiUrl = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  const retryMessage = "Не удалось пройти проверку. Повтори попытку.";
  const pending = new WeakMap();
  let loading;

  function loadTurnstile() {
    if (global.turnstile) return Promise.resolve(global.turnstile);
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = apiUrl;
        script.async = true;
        const timer = setTimeout(fail, 15000);
        function fail() {
          clearTimeout(timer);
          script.remove();
          reject(new Error(retryMessage));
        }
        script.onerror = fail;
        script.onload = function () {
          if (!global.turnstile) return fail();
          clearTimeout(timer);
          resolve(global.turnstile);
        };
        document.head.appendChild(script);
      }).catch(error => {
        loading = undefined;
        throw error;
      });
    }
    return loading;
  }

  async function getToken(anchor, attempt) {
    const turnstile = await loadTurnstile();
    if (attempt.cancelled) throw new Error(retryMessage);
    const container = document.createElement("div");
    anchor.before(container);
    let widget;
    try {
      return await new Promise((resolve, reject) => {
        const fail = () => reject(new Error(retryMessage));
        const timer = setTimeout(fail, 120000);
        attempt.cancel = fail;
        attempt.clearTimer = () => clearTimeout(timer);
        widget = turnstile.render(container, {
          sitekey: siteKey,
          language: "ru",
          retry: "never",
          "refresh-expired": "never",
          "refresh-timeout": "never",
          callback: token => token ? resolve(token) : fail(),
          "error-callback": () => { fail(); return true; },
          "expired-callback": fail,
          "timeout-callback": fail
        });
      });
    } finally {
      attempt.clearTimer?.();
      attempt.cancel = undefined;
      if (widget != null) turnstile.remove(widget);
      container.remove();
    }
  }

  function presentError(error) {
    if (!error) return error;
    if (error.status === 429 || ["over_request_rate_limit", "over_email_send_rate_limit",
      "over_sms_send_rate_limit"].includes(error.code)) {
      return { message: "Слишком много запросов. Подожди немного и попробуй снова." };
    }
    if (error.code === "captcha_failed") return { message: retryMessage };
    return error;
  }

  async function run(anchor, request) {
    if (pending.has(anchor)) {
      return { error: { message: "Проверка или запрос уже выполняется." } };
    }
    const attempt = { cancelled: false };
    pending.set(anchor, attempt);
    try {
      const options = siteKey ? { captchaToken: await getToken(anchor, attempt) } : {};
      if (attempt.cancelled) return { error: { message: retryMessage } };
      const result = await request(options);
      return { ...result, error: presentError(result.error) };
    } catch (error) {
      return { error: { message: error.message === retryMessage
        ? retryMessage : "Не удалось выполнить запрос. Проверь соединение и повтори." } };
    } finally {
      pending.delete(anchor);
    }
  }

  function cancel(anchor) {
    const attempt = pending.get(anchor);
    if (attempt) {
      attempt.cancelled = true;
      attempt.cancel?.();
    }
  }

  global.KQAuthCaptcha = { run, cancel };
})(window);
