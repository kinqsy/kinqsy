(function (global) {
  "use strict";
  var sending = false;
  var reasons = ["spam", "abuse", "danger", "privacy", "other"];
  function validId(value) { return /^[1-9][0-9]*$/.test(String(value)) && Number.isSafeInteger(Number(value)); }
  async function send(postId, reason, note) {
    if (!validId(postId) || reasons.indexOf(reason) < 0 || Array.from(note).length > 1000) throw new Error("Проверь данные жалобы");
    var client = global.__kinqsy_sb;
    if (!client) throw new Error("Нет подключения");
    var session = await client.auth.getSession();
    if (session.error) throw session.error;
    var uid = session.data && session.data.session && session.data.session.user.id;
    if (!uid) throw new Error("Для отправки жалобы войди в аккаунт");
    var result = await client.from("gossip_reports").insert({ post_id: Number(postId), user_id: uid, reason: reason, note: note || null });
    if (result.error) {
      if (result.error.code === "23505") return "Жалоба на этот пост уже отправлена";
      throw result.error;
    }
    return "Жалоба отправлена в админку";
  }
  function modal() {
    var overlay = document.getElementById("kq-report-modal");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "kq-report-modal"; overlay.className = "auth-overlay";
    overlay.innerHTML = '<div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="kq-report-title"><h2 id="kq-report-title">Жалоба на пост</h2><label for="kq-report-reason">Причина</label><select id="kq-report-reason"><option value="spam">спам</option><option value="abuse">травля</option><option value="danger">опасный контент / 18+</option><option value="privacy">нарушение приватности</option><option value="other">другое</option></select><label for="kq-report-note">Пояснение</label><textarea id="kq-report-note" maxlength="1000"></textarea><div class="auth-error" id="kq-report-error" role="status"></div><div class="auth-actions"><button type="button" id="kq-report-send">отправить</button><button type="button" id="kq-report-close">закрыть</button></div></div>';
    document.body.appendChild(overlay);
    document.getElementById("kq-report-close").onclick = function () { if (!sending) overlay.classList.remove("open"); };
    document.getElementById("kq-report-send").onclick = async function () {
      if (sending) return;
      sending = true; this.disabled = true;
      var err = document.getElementById("kq-report-error"); err.textContent = "Отправляем…";
      try {
        err.textContent = await send(overlay.dataset.postId, document.getElementById("kq-report-reason").value, document.getElementById("kq-report-note").value.trim());
        overlay.dataset.sent = "1";
      } catch (error) {
        err.textContent = error.message && /войд|данные|подключения/.test(error.message) ? error.message : "Отправка не подтверждена. Проверь соединение перед повторной попыткой.";
      } finally {
        sending = false; this.disabled = overlay.dataset.sent === "1";
      }
    };
    return overlay;
  }
  function open(postId) {
    if (!validId(postId) || sending) return;
    var overlay = modal(); overlay.dataset.postId = String(postId); overlay.dataset.sent = "";
    document.getElementById("kq-report-reason").value = "spam";
    document.getElementById("kq-report-note").value = "";
    document.getElementById("kq-report-error").textContent = "";
    document.getElementById("kq-report-send").disabled = false;
    overlay.classList.add("open");
    document.getElementById("kq-report-reason").focus();
  }
  function configureMenu(menu, postId, editable) {
    if (!menu || !validId(postId)) return;
    ["post-menu-edit", "post-menu-delete"].forEach(function (id) {
      var item = document.getElementById(id);
      if (item) { item.hidden = !editable; item.style.display = editable ? "" : "none"; }
    });
    var report = menu.querySelector(".kq-report-post");
    if (!report) {
      report = document.createElement("button"); report.type = "button";
      report.className = "kq-report-post"; report.textContent = "пожаловаться";
      menu.appendChild(report);
    }
    report.onclick = function () { menu.classList.remove("open"); open(postId); };
  }
  function attach(root) {
    var match = /^post-([1-9][0-9]*)$/.exec(root.id || "");
    var postId = match && match[1];
    var home = root.matches && root.matches("a.home-card");
    if (!postId && home) {
      match = /#post-([1-9][0-9]*)$/.exec(root.getAttribute("href") || "");
      if (match) postId = match[1];
    }
    if (!validId(postId) || root.dataset.kqReportAttached) return;
    root.dataset.kqReportAttached = "1";
    if (!home && root.querySelector(".post-owner-btn,.pin-menu-btn")) return;
    var button = document.createElement("button"); button.type = "button";
    button.className = "kq-report-more"; button.textContent = "⋯";
    button.style.cssText = "border:0;background:transparent;color:inherit;cursor:pointer;font-size:20px;padding:4px 10px";
    button.setAttribute("aria-label", "Меню поста"); button.setAttribute("aria-expanded", "false");
    button.onclick = function (event) {
      event.preventDefault(); event.stopPropagation();
      var menu = document.getElementById("kq-post-report-menu");
      if (!menu) {
        menu = document.createElement("div"); menu.id = "kq-post-report-menu";
        menu.className = "post-menu";
        menu.style.cssText = "position:fixed;z-index:100002;min-width:150px;padding:6px;border-radius:12px;background:rgba(255,245,250,.97);color:#2a1822;box-shadow:0 8px 24px #0003";
        var item = document.createElement("button"); item.type = "button"; item.textContent = "пожаловаться";
        item.style.cssText = "border:0;background:transparent;color:inherit;padding:10px 12px;cursor:pointer";
        menu.appendChild(item); document.body.appendChild(menu);
      }
      menu.firstElementChild.onclick = function () { menu.style.display = "none"; button.setAttribute("aria-expanded", "false"); open(postId); };
      var rect = button.getBoundingClientRect();
      menu.style.left = Math.max(8, Math.min(rect.left, global.innerWidth - 170)) + "px";
      menu.style.top = Math.max(8, Math.min(rect.bottom + 4, global.innerHeight - 60)) + "px";
      menu.style.display = "block"; button.setAttribute("aria-expanded", "true");
    };
    if (home) {
      var wrapper = document.createElement("div"); wrapper.className = "home-card";
      root.classList.remove("home-card"); root.style.color = "inherit"; root.style.textDecoration = "none";
      root.parentNode.insertBefore(wrapper, root); wrapper.appendChild(root); wrapper.appendChild(button);
    } else root.appendChild(button);
  }
  function scan() {
    document.querySelectorAll('[id^="post-"],a.home-card').forEach(attach);
  }
  function boot() {
    scan();
    document.addEventListener("click", function (event) {
      var menu = document.getElementById("kq-post-report-menu");
      if (menu && !menu.contains(event.target)) menu.style.display = "none";
    });
    var observer = new MutationObserver(function (changes) {
      if (changes.some(function (change) { return change.addedNodes.length; })) scan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  global.KQReports = { send: send, open: open, configureMenu: configureMenu };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(window);

