/* Kinqsy shared: ?u=, menu, auth (login/signup with nick), session chip */
(function (global) {
  var SUPABASE_URL = "https://rgkfegdtxaojceknnzlr.supabase.co";
  var SUPABASE_KEY = "sb_publishable_uK7zrVyq8AlHpoj13pGQ6g_q3L47Akw";
  var OWNER_SLUG = "kinqsy";
  var OWNER_ID = "4923abc5-5c86-48c2-904b-a267c2e21703";

  var sb = null;
  if (global.supabase && global.supabase.createClient) {
    sb = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }

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
      st.textContent = [
        ".auth-chip{position:fixed;top:50px;right:12px;z-index:1001;max-width:min(92vw,340px);padding:8px 12px;border-radius:14px;",
        "background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.35);backdrop-filter:blur(12px);",
        "font-size:12px;font-family:Arial,sans-serif;color:#2a1822;display:none;align-items:center;gap:8px;flex-wrap:wrap}",
        ".auth-chip.show{display:flex}",
        ".auth-chip button{border:0;background:rgba(240,201,214,.9);border-radius:999px;padding:6px 10px;font-size:11px;font-weight:bold;color:#3a2030;",
        "min-height:36px;touch-action:manipulation;-webkit-tap-highlight-color:transparent}"
      ].join("");
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
    text.textContent = "вы: @" + name + code;
    chip.classList.add("show");
    var btn = document.getElementById("auth-logout");
    if (btn && !btn._wired) {
      btn._wired = true;
      btn.onclick = async function () {
        await sb.auth.signOut();
        await refreshChip();
      };
    }
  }

  function ensureAuthStyles() {
    if (document.getElementById("kinqsy-auth-style")) return;
    var st = document.createElement("style");
    st.id = "kinqsy-auth-style";
    st.textContent = [
      ".auth-mode-tabs{display:flex;gap:8px;margin:0 0 14px}",
      ".auth-mode{flex:1;padding:12px 10px;border:0;border-radius:999px;background:rgba(255,255,255,.3);color:#2a1822;",
      "font-family:Arial,sans-serif;font-weight:bold;font-size:14px;touch-action:manipulation;-webkit-tap-highlight-color:transparent}",
      ".auth-mode.active{background:#f0c9d6}",
      "#auth-overlay input{font-size:16px!important;min-height:44px}",
      "#auth-overlay .auth-actions button{min-height:48px;font-size:16px;touch-action:manipulation;-webkit-tap-highlight-color:transparent}"
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
      '  <h2 id="auth-title">вход</h2>',
      '  <div class="auth-mode-tabs">',
      '    <button type="button" class="auth-mode active" id="mode-login">вход</button>',
      '    <button type="button" class="auth-mode" id="mode-signup">регистрация</button>',
      "  </div>",
      '  <div id="signup-only" style="display:none">',
      '    <label for="auth-nick">ник</label>',
      '    <input id="auth-nick" type="text" maxlength="32" placeholder="например mary" autocomplete="nickname">',
      "  </div>",
      '  <label for="auth-email">почта</label>',
      '  <input id="auth-email" type="email" inputmode="email" autocomplete="email" placeholder="you@mail.com">',
      '  <label for="auth-password">пароль</label>',
      '  <input id="auth-password" type="password" autocomplete="current-password" placeholder="минимум 6 символов">',
      '  <div class="auth-actions">',
      '    <button type="button" id="auth-submit">войти</button>',
      '    <button type="button" id="auth-close" class="secondary">закрыть</button>',
      "  </div>",
      '  <div class="auth-error" id="auth-error"></div>',
      "</div>"
    ].join("");
    document.body.appendChild(overlay);

    // minimal overlay styles if page has none
    if (!document.getElementById("kinqsy-overlay-fallback")) {
      var st = document.createElement("style");
      st.id = "kinqsy-overlay-fallback";
      st.textContent = [
        ".auth-overlay{display:none;position:fixed;inset:0;z-index:2000;background:rgba(20,10,16,.45);align-items:center;justify-content:center;padding:16px}",
        ".auth-overlay.open{display:flex}",
        ".auth-modal{width:min(94vw,420px);max-height:90vh;overflow-y:auto;padding:22px;border-radius:20px;",
        "border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.22);backdrop-filter:blur(16px);color:#2a1822}",
        ".auth-modal h2{margin:0 0 12px;font-weight:normal}",
        ".auth-modal label{display:block;font-size:12px;font-weight:bold;margin:10px 0 4px;font-family:Arial,sans-serif}",
        ".auth-modal input{width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.5);background:rgba(255,255,255,.35);font-family:Georgia,serif}",
        ".auth-actions{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}",
        ".auth-actions button{flex:1;min-width:90px;padding:10px 12px;border:0;border-radius:999px;background:#f0c9d6;color:#3a2030;font-weight:bold;font-family:Arial,sans-serif}",
        ".auth-actions button.secondary{background:rgba(255,255,255,.4)}",
        ".auth-error{margin-top:10px;font-size:13px;color:#7a2030;min-height:1.2em}"
      ].join("");
      document.head.appendChild(st);
    }
    return overlay;
  }

  var authMode = "login";
  var onLoginSuccess = null;

  function setAuthMode(mode) {
    authMode = mode;
    var isSignup = mode === "signup";
    var title = document.getElementById("auth-title");
    var only = document.getElementById("signup-only");
    var submit = document.getElementById("auth-submit");
    var err = document.getElementById("auth-error");
    if (title) title.textContent = isSignup ? "регистрация" : "вход";
    if (only) only.style.display = isSignup ? "block" : "none";
    if (submit) submit.textContent = isSignup ? "создать аккаунт" : "войти";
    var ml = document.getElementById("mode-login");
    var ms = document.getElementById("mode-signup");
    if (ml) ml.classList.toggle("active", !isSignup);
    if (ms) ms.classList.toggle("active", isSignup);
    if (err) err.textContent = "";
    var pw = document.getElementById("auth-password");
    if (pw) pw.autocomplete = isSignup ? "new-password" : "current-password";
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

  var wired = false;
  function wireAuthOnce() {
    if (wired) return;
    ensureAuthModal();
    wired = true;

    var ml = document.getElementById("mode-login");
    var ms = document.getElementById("mode-signup");
    if (ml) ml.onclick = function (e) { e.preventDefault(); setAuthMode("login"); };
    if (ms) ms.onclick = function (e) { e.preventDefault(); setAuthMode("signup"); };

    var closeBtn = document.getElementById("auth-close");
    if (closeBtn) closeBtn.onclick = function (e) { e.preventDefault(); closeAuth(); };

    var modal = document.getElementById("auth-modal");
    if (modal) modal.addEventListener("click", function (e) { e.stopPropagation(); });

    var overlay = document.getElementById("auth-overlay");
    if (overlay) {
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closeAuth();
      });
    }

    var submit = document.getElementById("auth-submit");
    if (!submit) return;
    submit.onclick = async function (e) {
      e.preventDefault();
      e.stopPropagation();
      var err = document.getElementById("auth-error");
      err.textContent = "";
      var email = document.getElementById("auth-email").value.trim();
      var password = document.getElementById("auth-password").value;
      if (!email || !password) {
        err.textContent = "введи почту и пароль";
        return;
      }
      if (password.length < 6) {
        err.textContent = "пароль минимум 6 символов";
        return;
      }

      if (authMode === "login") {
        err.textContent = "входим…";
        var res = await sb.auth.signInWithPassword({ email: email, password: password });
        if (res.error) { err.textContent = res.error.message; return; }
        closeAuth();
        await refreshChip();
        if (typeof onLoginSuccess === "function") await onLoginSuccess();
        return;
      }

      var nick = (document.getElementById("auth-nick").value || "").trim().slice(0, 32);
      if (!nick) { err.textContent = "придумай ник"; return; }
      if (!/^[a-zA-Z0-9_\u0400-\u04FF.-]{2,32}$/.test(nick)) {
        err.textContent = "ник: 2–32 символа, буквы/цифры/_/.";
        return;
      }
      err.textContent = "создаём…";
      var signed = await sb.auth.signUp({ email: email, password: password });
      if (signed.error) { err.textContent = signed.error.message; return; }
      if (signed.data && signed.data.user) {
        var code = "KQ-" + Math.random().toString(36).slice(2, 8).toUpperCase();
        var up = await sb.from("profiles").upsert({
          id: signed.data.user.id,
          display_name: nick,
          friend_code: code,
          updated_at: new Date().toISOString()
        }, { onConflict: "id" });
        if (up.error) err.textContent = "аккаунт есть, профиль: " + up.error.message;
        else err.textContent = "готово @" + nick + " · код " + code + " · если нужно — подтверди почту, потом вход";
      } else {
        err.textContent = "проверь почту, потом войди";
      }
      setAuthMode("login");
    };
  }

  /**
   * page hooks:
   *  onLoginSuccess: async fn
   *  onStarLoggedIn: async fn(uid, profile) — called when ★ and already logged in
   *  skipDefaultStar: if true, don't bind ★
   */
  function init(options) {
    options = options || {};
    onLoginSuccess = options.onLoginSuccess || null;
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
    sb: function () { return sb; },
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
    init: init
  };
})(window);
