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
  function attach(root) {
    var match = /^post-([1-9][0-9]*)$/.exec(root.id || "");
    var postId = match && match[1];
    if (!postId && root.matches && root.matches("a.home-card")) {
      match = /#post-([1-9][0-9]*)$/.exec(root.getAttribute("href") || "");
      if (match) postId = match[1];
    }
    if (!validId(postId) || root.dataset.kqReportAttached) return;
    root.dataset.kqReportAttached = "1";
    var button = document.createElement("button"); button.type = "button";
    button.className = "ghost-btn kq-report-post"; button.textContent = "жалоба";
    button.setAttribute("aria-label", "Пожаловаться на пост " + postId);
    button.onclick = function (event) { event.preventDefault(); event.stopPropagation(); open(postId); };
    if (root.matches && root.matches("a.home-card")) {
      // Keep interactive controls outside the link while preserving the card container.
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
    var observer = new MutationObserver(function (changes) {
      if (changes.some(function (change) { return change.addedNodes.length; })) scan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  global.KQReports = { send: send, open: open };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(window);

