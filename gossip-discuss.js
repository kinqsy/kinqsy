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
    }
    var s = e.target.closest && e.target.closest(".g-send");
    if (s && sb) {
      var session = await sb.auth.getSession();
      var uid = session.data && session.data.session && session.data.session.user.id;
      if (!uid) return;
      var a1 = await sb.from("friendships").select("addressee_id").eq("requester_id", uid).eq("status", "accepted");
      var friend = (a1.data && a1.data[0] && a1.data[0].addressee_id) || null;
      if (!friend) return;
      await sb.from("messages").insert({ sender_id: uid, recipient_id: friend, body: "gossip:" + s.getAttribute("data-id") });
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
    document.getElementById("g-rep-ok").onclick = async function () {
      var session = await sb.auth.getSession();
      var uid = session.data && session.data.session && session.data.session.user.id;
      await sb.from("gossip_reports").insert({
        post_id: Number(d.getAttribute("data-id")),
        user_id: uid,
        reason: document.getElementById("g-rep-reason").value,
        note: document.getElementById("g-rep-note").value || null
      });
      d.style.display = "none";
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
