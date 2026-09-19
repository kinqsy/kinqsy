/* Kinqsy shared singleton: one Supabase client, ?u=, menu, auth, chip */
(function (global) {
  var SUPABASE_URL = "https://rgkfegdtxaojceknnzlr.supabase.co";
  var SUPABASE_KEY = "sb_publishable_uK7zrVyq8AlHpoj13pGQ6g_q3L47Akw";
  var OWNER_SLUG = "kinqsy";
  var OWNER_ID = "4923abc5-5c86-48c2-904b-a267c2e21703";

  function getClient() {
    if (global.__kinqsy_sb) return global.__kinqsy_sb;
    if (!global.supabase || !global.supabase.createClient) {
      console.error("supabase-js not loaded before kinqsy-core.js");
      return null;
    }
    global.__kinqsy_sb = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, storageKey: "kinqsy-auth" }
    });
    return global.__kinqsy_sb;
  }

  var sb = getClient();

  function getU() {
    var u = new URLSearchParams(location.search).get("u");
    return (u && u.trim()) ? u.trim() : OWNER_SLUG;
  }

  function menuUrl(page) {
    return page + "?u=" + encodeURIComponent(getU());
  }

  function fixMenu() {
    var map = {
      "nav-home": "index.html",
      "nav-notes": "notes.html",
      "nav-dreams": "dreams.html",
      "nav-quotes": "quotes.html",
      "nav-about": "about.html"
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.href = menuUrl(map[id]);
    });
  }

  async function currentUserId() {
    sb = getClient();
    if (!sb) return null;
    var res = await sb.auth.getSession();
    var session = res.data && res.data.session;
    return session ? session.user.id : null;
  }

  async function currentProfile() {
    var uid = await currentUserId();
    if (!uid) return null;
    var { data } = await sb.from("profiles").select("id, display_name, friend_code").eq("id", uid).maybeSingle();
    return data || { id: uid };
  }

  function ensureChip() {
    var chip = document.getElementById("auth-chip");
    if (chip) return chip;
    chip = document.createElement("div");
    chip.id = "auth-chip";
    chip.className = "auth-chip";
    chip.innerHTML = '<span id="auth-chip-text"></span><button type="button" id="auth-logout">выйти</button>';
    document.body.appendChild(chip);
    if (!document.getElementById("kinqsy-chip-style")) {
      var st = document.createElement("style");
      st.id = "kinqsy-chip-style";
      st.textContent = ".auth-chip{position:fixed;top:50px;right:12px;z-index:1001;max-width:min(92vw,340px);padding:8px 12px;border-radius:14px;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.35);backdrop-filter:blur(12px);font-size:12px;font-family:Arial,sans-serif;color:#2a1822;display:none;align-items:center;gap:8px;flex-wrap:wrap}.auth-chip.show{display:flex}.auth-chip button{border:0;background:rgba(240,201,214,.9);border-radius:999px;padding:6px 10px;font-size:11px;font-weight:bold;color:#3a2030;min-height:36px}";
      document.head.appendChild(st);
    }
    return chip;
  }

  async function refreshChip() {
    var chip = ensureChip();
    var text = document.getElementById("auth-chip-text");
    var uid = await currentUserId();
    if (!uid) {
      chip.classList.remove("show");
      return;
    }
    var prof = await currentProfile();
    var name = (prof && prof.display_name) ? prof.display_name : "user";
    var code = (prof && prof.friend_code) ? (" · " + prof.friend_code) : "";
    if (text) text.textContent = "вы: @" + name + code;
    chip.classList.add("show");
    var btn = document.getElementById("auth-logout");
    if (btn && !btn._wired) {
      btn._wired = true;
      btn.onclick = async function () {
        await getClient().auth.signOut();
        await refreshChip();
      };
    }
  }

  function ensureAuthStyles() {
    if (document.getElementById("kinqsy-auth-style")) return;
    var st = document.createElement("style");
    st.id = "kinqsy-auth-style";
    st.textContent = [
      ".auth-overlay{display:none;position:fixed;inset:0;z-index:2000;background:rgba(20,10,16,.45);align-items:center;justify-content:center;padding:16px}",
      ".auth-overlay.open{display:flex}",
      ".auth-modal{width:min(94vw,420px);max-height:90vh;overflow-y:auto;padding:22px;border-radius:20px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.22);backdrop-filter:blur(16px);color:#2a1822;text-align:left}",
      ".auth-modal h2{margin:0 0 12px;font-weight:normal}",
      ".auth-modal label{display:block;font-size:12px;font-weight:bold;margin:10px 0 4px;font-family:Arial,sans-serif}",
      ".auth-modal input{width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.5);background:rgba(255,255,255,.35);font-family:Georgia,serif;font-size:16px;min-height:44px;box-sizing:border-box}",
      ".auth-actions{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}",
      ".auth-actions button{flex:1;min-width:90px;min-height:48px;padding:10px 12px;border:0;border-radius:999px;background:#f0c9d6;color:#3a2030;font-weight:bold;font-family:Arial,sans-serif;font-size:16px}",
      ".auth-actions button.secondary{background:rgba(255,255,255,.4)}",
      ".auth-error{margin-top:10px;font-size:13px;color:#7a2030;min-height:1.2em}",
      ".auth-mode-tabs{display:flex;gap:8px;margin:0 0 14px}",
      ".auth-mode{flex:1;padding:12px 10px;border:0;border-radius:999px;background:rgba(255,255,255,.3);color:#2a1822;font-family:Arial,sans-serif;font-weight:bold;font-size:14px}",
      ".auth-mode.active{background:#f0c9d6}",
      ".auth-link{display:block;margin-top:12px;text-align:center;font-size:13px;font-family:Arial,sans-serif;color:#5a3040;text-decoration:underline;background:none;border:0;cursor:pointer;width:100%}",
      ".auth-hint{margin:8px 0 0;font-size:12px;opacity:.75;font-family:Arial,sans-serif;line-height:1.35}"
    ].join("");
    document.head.appendChild(st);
  }

  function ensureAuthModal() {
    ensureAuthStyles();
    var overlay = document.getElementById("auth-overlay");
    if (overlay && document.getElementById("auth-submit")) return overlay;
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.id = "auth-overlay";
    overlay.className = "auth-overlay";
    overlay.innerHTML = [
      '<div class="auth-modal" id="auth-modal">',
      '<h2 id="auth-title">вход</h2>',
      '<div class="auth-mode-tabs" id="auth-tabs">',
      '<button type="button" class="auth-mode active" id="mode-login">вход</button>',
      '<button type="button" class="auth-mode" id="mode-signup">регистрация</button>',
      "</div>",
      '<p class="auth-hint" id="auth-hint"></p>',
      '<div id="signup-only" style="display:none">',
      '<label for="auth-nick">юз (латиница)</label>',
      '<input id="auth-nick" type="text" maxlength="32" placeholder="можно пусто — сделаем сами" autocomplete="username">',
      "</div>",
      '<div id="auth-email-wrap">',
      '<label for="auth-email">почта</label>',
      '<input id="auth-email" type="email" inputmode="email" autocomplete="email" placeholder="you@mail.com">',
      "</div>",
      '<div id="auth-pass-wrap">',
      '<label for="auth-password" id="auth-pass-label">пароль</label>',
      '<input id="auth-password" type="password" autocomplete="current-password" placeholder="минимум 6 символов">',
      "</div>",
      '<div id="auth-pass2-wrap" style="display:none">',
      '<label for="auth-password2">повторите пароль</label>',
      '<input id="auth-password2" type="password" autocomplete="new-password" placeholder="ещё раз">',
      "</div>",
      '<div class="auth-actions">',
      '<button type="button" id="auth-submit">войти</button>',
      '<button type="button" id="auth-close" class="secondary">закрыть</button>',
      "</div>",
      '<button type="button" class="auth-link" id="auth-forgot">забыла пароль?</button>',
      '<div class="auth-error" id="auth-error"></div>',
      "</div>"
    ].join("");
    document.body.appendChild(overlay);
    return overlay;
  }

  var authMode = "login";
  var onLoginSuccess = null;
  var wired = false;

  function siteOrigin() {
    try {
      var o = location.origin || "";
      if (o.indexOf("github.io") !== -1 || o.indexOf("kinqsy.lol") !== -1 || o.indexOf("localhost") !== -1) {
        // project pages path: /kinqsy/ or /
        var path = location.pathname || "/";
        var base = path.replace(/\/[^/]*$/, "/");
        if (base.indexOf("/kinqsy") === -1 && o.indexOf("github.io") !== -1) base = "/kinqsy/";
        return o + (base || "/");
      }
    } catch (e) {}
    return "https://kinqsy.github.io/kinqsy/";
  }

  function redirectTo() {
    return siteOrigin().replace(/\/?$/, "/") + "about.html";
  }

  function setAuthMode(mode) {
    authMode = mode || "login";
    var isSignup = authMode === "signup";
    var isForgot = authMode === "forgot";
    var isNewPass = authMode === "newpass";
    var title = document.getElementById("auth-title");
    var only = document.getElementById("signup-only");
    var submit = document.getElementById("auth-submit");
    var err = document.getElementById("auth-error");
    var tabs = document.getElementById("auth-tabs");
    var hint = document.getElementById("auth-hint");
    var passWrap = document.getElementById("auth-pass-wrap");
    var pass2 = document.getElementById("auth-pass2-wrap");
    var emailWrap = document.getElementById("auth-email-wrap");
    var forgot = document.getElementById("auth-forgot");
    var passLabel = document.getElementById("auth-pass-label");
    if (title) {
      title.textContent = isNewPass ? "новый пароль" : isForgot ? "сброс пароля" : isSignup ? "регистрация" : "вход";
    }
    if (tabs) tabs.style.display = (isForgot || isNewPass) ? "none" : "flex";
    if (only) only.style.display = isSignup ? "block" : "none";
    if (passWrap) passWrap.style.display = isForgot ? "none" : "block";
    if (pass2) pass2.style.display = isNewPass ? "block" : "none";
    if (emailWrap) emailWrap.style.display = isNewPass ? "none" : "block";
    if (passLabel) passLabel.textContent = isNewPass ? "новый пароль" : "пароль";
    if (submit) {
      submit.textContent = isNewPass ? "сохранить пароль" : isForgot ? "выслать ссылку" : isSignup ? "создать" : "войти";
    }
    if (forgot) {
      forgot.style.display = (isForgot || isNewPass) ? "none" : "block";
      forgot.textContent = isSignup ? "уже есть аккаунт? войди" : "забыла пароль?";
    }
    if (hint) {
      if (isForgot) hint.textContent = "Пришлём письмо со ссылкой. Открой его на телефоне и задай новый пароль.";
      else if (isNewPass) hint.textContent = "Придумай новый пароль (минимум 6 символов).";
      else if (isSignup) hint.textContent = "Почта + пароль. Юз можно не заполнять — сделаем из почты.";
      else hint.textContent = "";
    }
    var ml = document.getElementById("mode-login");
    var ms = document.getElementById("mode-signup");
    if (ml) ml.classList.toggle("active", authMode === "login");
    if (ms) ms.classList.toggle("active", isSignup);
    if (err) err.textContent = "";
  }

  function openAuth(mode) {
    ensureAuthModal();
    wireAuthOnce();
    setAuthMode(mode || "login");
    document.getElementById("auth-overlay").classList.add("open");
  }

  function closeAuth() {
    var o = document.getElementById("auth-overlay");
    if (o) o.classList.remove("open");
  }

  function wireAuthOnce() {
    if (wired) return;
    wired = true;
    ensureAuthModal();
    var ml = document.getElementById("mode-login");
    var ms = document.getElementById("mode-signup");
    if (ml) ml.onclick = function (e) { e.preventDefault(); setAuthMode("login"); };
    if (ms) ms.onclick = function (e) { e.preventDefault(); setAuthMode("signup"); };
    var close = document.getElementById("auth-close");
    if (close) close.onclick = function (e) { e.preventDefault(); closeAuth(); };
    var forgot = document.getElementById("auth-forgot");
    if (forgot) {
      forgot.onclick = function (e) {
        e.preventDefault();
        if (authMode === "signup") setAuthMode("login");
        else setAuthMode("forgot");
      };
    }
    var overlay = document.getElementById("auth-overlay");
    if (overlay) {
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closeAuth();
      });
    }
    var modal = document.getElementById("auth-modal");
    if (modal) modal.addEventListener("click", function (e) { e.stopPropagation(); });

    var submit = document.getElementById("auth-submit");
    if (!submit) return;
    submit.onclick = async function (e) {
      e.preventDefault();
      var err = document.getElementById("auth-error");
      if (!err) return;
      err.textContent = "";
      sb = getClient();
      if (!sb) { err.textContent = "нет подключения к серверу"; return; }

      var emailEl = document.getElementById("auth-email");
      var passEl = document.getElementById("auth-password");
      var pass2El = document.getElementById("auth-password2");
      var email = emailEl ? emailEl.value.trim() : "";
      var password = passEl ? passEl.value : "";

      if (authMode === "forgot") {
        if (!email) { err.textContent = "введи почту"; return; }
        err.textContent = "отправляем…";
        var fr = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
        if (fr.error) { err.textContent = fr.error.message; return; }
        err.textContent = "письмо отправлено. открой ссылку из письма (проверь «спам»).";
        return;
      }

      if (authMode === "newpass") {
        if (!password || password.length < 6) { err.textContent = "пароль минимум 6 символов"; return; }
        var p2 = pass2El ? pass2El.value : "";
        if (password !== p2) { err.textContent = "пароли не совпадают"; return; }
        err.textContent = "сохраняем…";
        var up = await sb.auth.updateUser({ password: password });
        if (up.error) { err.textContent = up.error.message; return; }
        err.textContent = "пароль обновлён — можно пользоваться сайтом";
        setTimeout(function () {
          closeAuth();
          if (typeof onLoginSuccess === "function") onLoginSuccess();
          else location.reload();
        }, 800);
        return;
      }

      if (!email || !password) { err.textContent = "введи почту и пароль"; return; }
      if (password.length < 6) { err.textContent = "пароль минимум 6 символов"; return; }

      if (authMode === "login") {
        err.textContent = "вход…";
        var res = await sb.auth.signInWithPassword({ email: email, password: password });
        if (res.error) {
          var m = res.error.message || "";
          if (/invalid login/i.test(m)) err.textContent = "неверная почта или пароль";
          else if (/email not confirmed/i.test(m)) err.textContent = "подтверди почту по письму или попроси админа подтвердить в Supabase";
          else err.textContent = m;
          return;
        }
        closeAuth();
        if (typeof onLoginSuccess === "function") await onLoginSuccess();
        else location.reload();
        return;
      }

      // signup — simplified
      var nickEl = document.getElementById("auth-nick");
      var nick = nickEl ? nickEl.value.trim().slice(0, 32) : "";
      if (!nick) {
        nick = (email.split("@")[0] || "user").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 24);
        if (nick.length < 2) nick = "user" + String(Date.now()).slice(-6);
      }
      if (!/^[a-zA-Z0-9._-]{2,32}$/.test(nick)) {
        err.textContent = "юз: только латиница, цифры, . _ - (2–32)";
        return;
      }
      err.textContent = "создаём…";
      var signed = await sb.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: redirectTo(),
          data: { display_name: nick }
        }
      });
      if (signed.error) {
        var em = signed.error.message || "";
        if (/already/i.test(em)) err.textContent = "эта почта уже есть — нажми «вход» или «забыла пароль»";
        else if (/database/i.test(em)) err.textContent = "ошибка профиля на сервере — напиши админу (триггер profiles)";
        else err.textContent = em;
        return;
      }
      var user = signed.data && signed.data.user;
      if (user) {
        var code = "KQ-" + Math.random().toString(36).slice(2, 8).toUpperCase();
        while (code.length < 9) code += "X";
        var up = await sb.from("profiles").upsert({
          id: user.id,
          display_name: nick,
          friend_code: code.slice(0, 16),
          updated_at: new Date().toISOString()
        }, { onConflict: "id" });
        if (up.error) {
          err.textContent = "аккаунт создан, профиль: " + up.error.message + " — можно войти; юз поправим позже";
        } else if (signed.data.session) {
          err.textContent = "готово! @" + nick + " · код " + code;
          setTimeout(async function () {
            closeAuth();
            if (typeof onLoginSuccess === "function") await onLoginSuccess();
            else location.reload();
          }, 600);
          return;
        } else {
          err.textContent = "аккаунт создан. если просят письмо — подтверди почту, потом «вход»";
        }
      } else {
        err.textContent = "проверь почту, потом войди";
      }
      setAuthMode("login");
    };
  }

  async function handleRecoveryLink() {
    try {
      var hash = (location.hash || "").replace(/^#/, "");
      var q = new URLSearchParams(hash);
      var type = q.get("type");
      if (type === "recovery" || type === "signup") {
        openAuth(type === "recovery" ? "newpass" : "login");
        if (type === "recovery") {
          var err = document.getElementById("auth-error");
          if (err) err.textContent = "ссылка из письма принята — задай новый пароль";
        }
      }
    } catch (e) {}
  }

  var DEFAULT_PRIVACY = {
    home: "public",
    about: "public",
    notes: "friends",
    dreams: "friends",
    quotes: "friends"
  };

  var privacyCache = {};

  async function areFriends(a, b) {
    if (!a || !b) return false;
    if (String(a) === String(b)) return true;
    sb = getClient();
    if (!sb) return false;
    try {
      var q1 = await sb.from("friendships").select("id,status")
        .eq("requester_id", a).eq("addressee_id", b).eq("status", "accepted").maybeSingle();
      if (q1.data) return true;
      var q2 = await sb.from("friendships").select("id,status")
        .eq("requester_id", b).eq("addressee_id", a).eq("status", "accepted").maybeSingle();
      return !!q2.data;
    } catch (e) {
      return false;
    }
  }

  async function privacyFor(viewedId) {
    var key = String(viewedId || "");
    if (privacyCache[key]) return privacyCache[key];
    var out = Object.assign({}, DEFAULT_PRIVACY);
    if (!viewedId) {
      privacyCache[key] = out;
      return out;
    }
    sb = getClient();
    try {
      var { data } = await sb.from("profiles").select("privacy").eq("id", viewedId).maybeSingle();
      if (data && data.privacy && typeof data.privacy === "object") {
        Object.keys(DEFAULT_PRIVACY).forEach(function (k) {
          if (data.privacy[k]) out[k] = data.privacy[k];
        });
      }
    } catch (e) {}
    privacyCache[key] = out;
    return out;
  }

  async function checkAccess(page, viewedId) {
    var uid = await currentUserId();
    if (viewedId && uid && String(viewedId) === String(uid)) {
      return { ok: true, reason: "owner", guest: false };
    }
    var priv = await privacyFor(viewedId);
    var rule = priv[page] || "friends";
    if (rule === "public") return { ok: true, reason: "public", guest: !uid, rule: rule };
    if (!uid) return { ok: false, reason: "guest", guest: true, rule: rule };
    if (rule === "friends") {
      var ok = await areFriends(uid, viewedId);
      return { ok: ok, reason: ok ? "friend" : "friends", guest: false, rule: rule };
    }
    return { ok: false, reason: rule, guest: !uid, rule: rule };
  }

  function ensureGateStyles() {
    if (document.getElementById("kinqsy-gate-style")) return;
    var st = document.createElement("style");
    st.id = "kinqsy-gate-style";
    st.textContent = [
      "@keyframes kqAurora{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}",
      ".kq-gate{display:none;z-index:1400;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}",
      ".kq-gate.open{display:flex}",
      ".kq-gate.guest{position:fixed;inset:0;top:42px}",
      ".kq-gate.friends{position:absolute;left:0;right:0;top:0;min-height:70vh;width:100%;border-radius:24px}",
      ".kq-gate-grad{position:absolute;inset:-8%;background:linear-gradient(120deg,#1a0f14,#5a3048,#f0c9d6,#7a4a60,#2a1520,#d4a0b8,#3a2030);background-size:400% 400%;animation:kqAurora 16s ease infinite;filter:blur(48px);transform:scale(1.2);pointer-events:none}",
      ".kq-gate.friends .kq-gate-grad{display:none}",
      ".kq-gate.friends{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.32);backdrop-filter:blur(28px) saturate(140%);-webkit-backdrop-filter:blur(28px) saturate(140%);box-shadow:0 20px 50px rgba(0,0,0,.18)}",
      ".kq-gate-card{position:relative;z-index:2;width:min(92vw,420px);padding:28px 24px;border-radius:22px;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.4);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);color:#1a0f14;text-align:center}",
      ".kq-gate-lock{width:54px;height:54px;margin:0 auto 14px;border-radius:16px;background:rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center}",
      ".kq-gate-lock svg{width:28px;height:28px;fill:#3a2030}",
      ".kq-gate-card h2{margin:0 0 8px;font-family:Georgia,serif;font-weight:normal;font-size:26px}",
      ".kq-gate-card p{margin:0 0 18px;font-size:15px;line-height:1.45;opacity:.82}",
      ".kq-gate-actions{display:flex;flex-direction:column;gap:8px}",
      ".kq-gate-actions button,.kq-gate-actions a.kq-gate-btn{display:block;width:100%;box-sizing:border-box;min-height:48px;padding:12px 14px;border:0;border-radius:999px;background:#f0c9d6;color:#3a2030;font-weight:bold;font-family:Arial,sans-serif;font-size:15px;text-decoration:none;line-height:24px}",
      ".kq-gate-actions button.secondary,.kq-gate-actions a.secondary{background:rgba(255,255,255,.42);font-weight:normal}",
      "#feed{position:relative}",
      ".kq-feed-wrap{position:relative;min-height:70vh}"
    ].join("");
    document.head.appendChild(st);
  }

  function ensureGate() {
    ensureGateStyles();
    var gate = document.getElementById("kq-gate");
    if (gate) return gate;
    gate = document.createElement("div");
    gate.id = "kq-gate";
    gate.className = "kq-gate";
    gate.innerHTML = [
      '<div class="kq-gate-grad" aria-hidden="true"></div>',
      '<div class="kq-gate-card">',
      '<div class="kq-gate-lock"><svg viewBox="0 0 24 24"><path d="M17 8V7a5 5 0 0 0-10 0v1H5v14h14V8h-2zm-8-1a3 3 0 0 1 6 0v1H9V7zm3 6a2 2 0 0 1 1 3.7V18h-2v-2.3A2 2 0 0 1 12 13z"/></svg></div>',
      '<h2 id="kq-gate-title">только для друзей</h2>',
      '<p id="kq-gate-text">смотреть эту ленту могут только друзья.</p>',
      '<div class="kq-gate-actions">',
      '<button type="button" id="kq-gate-signup">зарегистрироваться</button>',
      '<button type="button" id="kq-gate-login" class="secondary">уже есть аккаунт? войти</button>',
      '<a class="kq-gate-btn secondary" id="kq-gate-about" href="about.html">профиль</a>',
      "</div></div>"
    ].join("");
    document.body.appendChild(gate);
    var su = document.getElementById("kq-gate-signup");
    var li = document.getElementById("kq-gate-login");
    if (su) su.onclick = function (e) { e.preventDefault(); openAuth("signup"); };
    if (li) li.onclick = function (e) { e.preventDefault(); openAuth("login"); };
    return gate;
  }

  function hideGate() {
    var g = document.getElementById("kq-gate");
    if (g) g.classList.remove("open", "guest", "friends");
  }

  function showGate(opts) {
    opts = opts || {};
    var gate = ensureGate();
    var mode = opts.mode === "guest" ? "guest" : "friends";
    var title = document.getElementById("kq-gate-title");
    var text = document.getElementById("kq-gate-text");
    var su = document.getElementById("kq-gate-signup");
    var li = document.getElementById("kq-gate-login");
    var ab = document.getElementById("kq-gate-about");
    var slug = getU();
    if (ab) ab.href = "about.html?u=" + encodeURIComponent(slug);

    gate.className = "kq-gate open " + mode;

    if (mode === "guest") {
      if (title) title.textContent = "добро пожаловать в kinqsy";
      if (text) text.textContent = "зарегистрируйтесь, чтобы вести дневник и читать закрытые записи. уже есть аккаунт — войдите.";
      if (su) su.style.display = "block";
      if (li) li.style.display = "block";
      document.body.appendChild(gate);
    } else {
      if (title) title.textContent = "только для друзей";
      if (text) text.textContent = "смотреть notes и dreams могут только друзья. about открыт, а в quotation — общая лента.";
      if (su) su.style.display = opts.guest ? "block" : "none";
      if (li) {
        li.style.display = "block";
        li.textContent = opts.guest ? "уже есть аккаунт? войти" : "открыть профиль / друзья";
        li.onclick = function (e) {
          e.preventDefault();
          if (opts.guest) openAuth("login");
          else location.href = "about.html?u=" + encodeURIComponent(slug);
        };
      }
      var host = document.getElementById("feed") || document.querySelector(".kq-inner");
      if (host) {
        host.style.position = "relative";
        host.style.minHeight = "70vh";
        host.appendChild(gate);
      } else {
        document.body.appendChild(gate);
      }
    }
    return gate;
  }

  function init(options) {
    options = options || {};
    onLoginSuccess = options.onLoginSuccess || null;
    sb = getClient();
    fixMenu();
    ensureChip();
    refreshChip();
    if (sb && sb.auth && sb.auth.onAuthStateChange) {
      sb.auth.onAuthStateChange(function () { refreshChip(); });
    }
    wireAuthOnce();

    if (!options.skipDefaultStar) {
      var star = document.getElementById("admin-star");
      if (star) {
        star.onclick = async function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          var uid = await currentUserId();
          if (!uid) {
            openAuth("login");
            return;
          }
          if (typeof options.onStarLoggedIn === "function") {
            var prof = await currentProfile();
            await options.onStarLoggedIn(uid, prof);
          }
        };
      }
    }
  }

  global.Kinqsy = {
    sb: getClient,
    OWNER_ID: OWNER_ID,
    OWNER_SLUG: OWNER_SLUG,
    getU: getU,
    menuUrl: menuUrl,
    fixMenu: fixMenu,
    currentUserId: currentUserId,
    currentProfile: currentProfile,
    openAuth: openAuth,
    closeAuth: closeAuth,
    refreshChip: refreshChip,
    init: init,
    areFriends: areFriends,
    checkAccess: checkAccess,
    showGate: showGate,
    hideGate: hideGate,
    privacyFor: privacyFor
  };
})(window);
