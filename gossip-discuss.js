(function () {
  var sb = window.__kinqsy_sb;
  var STICK = ["✦", "♡", "⋆", "—", "✿", "✧", "· · ·", "♪"];
  function dock() {
    var b = document.getElementById("g-add-sticker");
    if (!b || b.getAttribute("data-kin")) return;
    b.setAttribute("data-kin", "1");
    b.onclick = function () {
      var box = document.getElementById("g-sticker-dock");
      if (!box) {
        box = document.createElement("div");
        box.id = "g-sticker-dock";
        box.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin:8px 0";
        var board = document.getElementById("g-board");
        if (board) board.before(box);
      }
      box.innerHTML = "";
      STICK.forEach(function (s) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pill";
        btn.textContent = s;
        btn.onclick = function () {
          if (window.gossipDecor) {
            var cur = window.gossipDecor().layout || [];
            cur.push({ id: "s" + Date.now(), type: "text", text: s, x: 20, y: 20, w: 64, h: 36, z: cur.length + 1, size: 22, color: "#f0c9d6" });
            if (window.gossipSetDecor) window.gossipSetDecor({ layout: cur });
          }
        };
        box.appendChild(btn);
      });
    };
  }
  function menu() {
    document.addEventListener("click", function (e) {
      var card = e.target.closest && e.target.closest("#feed .card");
      if (e.target.classList && e.target.classList.contains("g-more")) {
        var id = e.target.getAttribute("data-id");
        var box = document.getElementById("g-more-" + id);
        if (box) box.style.display = box.style.display === "block" ? "none" : "block";
      }
    });
  }
  function ensureMore() {
    document.querySelectorAll("#feed .card").forEach(function (card) {
      if (card.querySelector(".g-more")) return;
      var id = String(card.id).replace("g-", "");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "pill g-more";
      b.setAttribute("data-id", id);
      b.textContent = "⋯";
      var row = card.querySelector(".row");
      if (row) row.appendChild(b);
      var panel = document.createElement("div");
      panel.id = "g-more-" + id;
      panel.style.display = "none";
      panel.innerHTML = '<button type="button" class="pill g-report" data-id="' + id + '">жалоба</button> <button type="button" class="pill g-send" data-id="' + id + '">другу</button>';
      card.appendChild(panel);
    });
  }
  document.addEventListener("click", async function (e) {
    var r = e.target.closest && e.target.closest(".g-report");
    if (r && sb) {
      var reason = window.prompt ? "spam" : "spam";
      var note = "";
      var overlay = document.getElementById("g-report-modal");
      if (!overlay) return;
      overlay.style.display = "flex";
      overlay.setAttribute("data-id", r.getAttribute("data-id"));
      document.getElementById("g-rep-error").textContent = "";
      document.getElementById("g-rep-note").value = "";
    }
    var s = e.target.closest && e.target.closest(".g-send");
    if (s && sb) {
      if (s.disabled) return;
      s.disabled = true;
      try {
        var session = await sb.auth.getSession();
        if (session.error) throw session.error;
        var uid = session.data && session.data.session && session.data.session.user.id;
        if (!uid) throw new Error("Сначала войди в аккаунт");
        var outgoing = await sb.from("friendships").select("addressee_id").eq("requester_id", uid).eq("status", "accepted");
        var incoming = await sb.from("friendships").select("requester_id").eq("addressee_id", uid).eq("status", "accepted");
        if (outgoing.error || incoming.error) throw outgoing.error || incoming.error;
        var ids = Array.from(new Set((outgoing.data || []).map(function (r) { return r.addressee_id; }).concat((incoming.data || []).map(function (r) { return r.requester_id; }))));
        if (!ids.length) throw new Error("Нет друзей для пересылки");
        var profiles = await sb.from("profiles").select("id,display_name").in("id", ids);
        if (profiles.error) throw profiles.error;
        var choices = ids.map(function (id) {
          var profile = (profiles.data || []).find(function (p) { return p.id === id; });
          return { id: id, name: profile && profile.display_name || id };
        });
        var answer = window.prompt("Кому отправить? Введи номер:\n" + choices.map(function (f, i) { return (i + 1) + ". " + f.name; }).join("\n"));
        if (answer === null) return;
        if (!/^\d+$/.test(answer.trim()) || !choices[Number(answer) - 1]) throw new Error("Выбери номер друга из списка");
        var friend = choices[Number(answer) - 1].id;
        var pair = [uid, friend].sort();
        async function findSession() {
          return sb.from("chat_sessions").select("id").eq("user_a", pair[0]).eq("user_b", pair[1]).eq("status", "open").maybeSingle();
        }
        var chat = await findSession();
        if (chat.error) throw chat.error;
        if (!chat.data) {
          chat = await sb.from("chat_sessions").insert({ user_a: pair[0], user_b: pair[1], a_present: pair[0] === uid, b_present: pair[1] === uid }).select("id").single();
          if (chat.error && chat.error.code === "23505") chat = await findSession();
          if (chat.error) throw chat.error;
        }
        if (!chat.data) throw new Error("Не удалось открыть диалог");
        var sent = await sb.from("messages").insert({ session_id: chat.data.id, sender_id: uid, body: "gossip:" + s.getAttribute("data-id") });
        if (sent.error) throw sent.error;
        window.alert("Отправлено другу");
      } catch (error) {
        window.alert("Не удалось переслать: " + (error.message || "ошибка соединения"));
      } finally {
        s.disabled = false;
      }
    }
    var del = e.target.closest && e.target.closest(".g-topic-del");
    if (del && sb) {
      await sb.rpc("gossip_delete_topic", { p_id: del.getAttribute("data-id") });
      if (window.loadFeed) window.loadFeed();
    }
  });
  function modal() {
    if (document.getElementById("g-report-modal")) return;
    var d = document.createElement("div");
    d.id = "g-report-modal";
    d.style.cssText = "display:none;position:fixed;inset:0;z-index:90;align-items:center;justify-content:center;background:rgba(12,5,8,.55)";
    d.innerHTML = '<div style="background:#1a0f14;color:#f6dce8;padding:16px;border-radius:16px;width:min(360px,92vw)"><p>жалоба</p><select id="g-rep-reason"><option value="spam">спам</option><option value="abuse">травля</option><option value="danger">опасный контент</option><option value="privacy">приватность</option><option value="other">другое</option></select><input id="g-rep-note" placeholder="пояснение"><div><button type="button" id="g-rep-ok">отправить</button> <button type="button" id="g-rep-no">отмена</button></div></div>';
    document.body.appendChild(d);
    document.getElementById("g-rep-no").onclick = function () { d.style.display = "none"; };
    var reportError = document.createElement("p");
    reportError.id = "g-rep-error"; reportError.setAttribute("role", "status");
    d.firstElementChild.appendChild(reportError);
    document.getElementById("g-rep-ok").onclick = async function () {
      var button = this;
      if (button.disabled) return;
      button.disabled = true; reportError.textContent = "";
      try {
        var session = await sb.auth.getSession();
        if (session.error) throw session.error;
        var uid = session.data && session.data.session && session.data.session.user.id;
        if (!uid) { reportError.textContent = "Для отправки жалобы войди в аккаунт"; return; }
        var postId = d.getAttribute("data-id");
        var note = document.getElementById("g-rep-note").value.trim();
        if (!/^[1-9][0-9]*$/.test(postId) || !Number.isSafeInteger(Number(postId)) || Array.from(note).length > 1000) {
          reportError.textContent = "Проверь пост и пояснение (до 1000 символов)"; return;
        }
        var result = await sb.from("gossip_reports").insert({
          post_id: Number(postId), user_id: uid,
          reason: document.getElementById("g-rep-reason").value, note: note || null
        });
        if (result.error && result.error.code !== "23505") throw result.error;
        reportError.textContent = result.error ? "Жалоба на этот пост уже отправлена" : "Жалоба отправлена в админку";
      } catch (error) {
        reportError.textContent = "Отправка не подтверждена. Проверь соединение перед повторной попыткой.";
      } finally { button.disabled = false; }
    };
  }
  var orig = window.loadFeed;
  window.loadFeed = async function () {
    if (orig) await orig();
    ensureMore();
  };
  document.addEventListener("DOMContentLoaded", function () {
    dock();
    modal();
    var filters = document.getElementById("filters");
    if (filters && !document.getElementById("g-hot")) {
      var b = document.createElement("button");
      b.type = "button";
      b.id = "g-hot";
      b.className = "pill";
      b.textContent = "популярное";
      b.onclick = function () { window.gossipSort = "hot"; if (window.loadFeed) window.loadFeed(); };
      filters.appendChild(b);
    }
  });
})();


