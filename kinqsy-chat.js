(function () {
  var sb = function () { return window.__kinqsy_sb; };
  var openWins = {};
  var meId = null;
  var friends = [];

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }
  function pair(a, b) { return a < b ? [a, b] : [b, a]; }

  async function me() {
    if (!sb()) return null;
    var s = await sb().auth.getSession();
    meId = s.data && s.data.session && s.data.session.user && s.data.session.user.id;
    return meId;
  }

  async function loadFriends() {
    var uid = await me();
    if (!uid) { friends = []; return; }
    var r1 = await sb().from("friendships").select("requester_id,addressee_id,status").eq("requester_id", uid).eq("status", "accepted");
    var r2 = await sb().from("friendships").select("requester_id,addressee_id,status").eq("addressee_id", uid).eq("status", "accepted");
    var ids = {};
    (r1.data || []).concat(r2.data || []).forEach(function (r) {
      var o = r.requester_id === uid ? r.addressee_id : r.requester_id;
      if (o) ids[o] = true;
    });
    var list = Object.keys(ids).slice(0, 5);
    friends = [];
    if (!list.length) return;
    var { data } = await sb().from("profiles").select("id, display_name").in("id", list);
    friends = data || [];
  }

  async function unreadFor(other) {
    var uid = await me();
    if (!uid) return 0;
    var ids = pair(uid, other);
    var sess = await sb().from("chat_sessions").select("id,a_seen,b_seen,user_a").eq("user_a", ids[0]).eq("user_b", ids[1]).eq("status", "open").maybeSingle();
    if (!sess.data) return 0;
    var seen = sess.data.user_a === uid ? sess.data.a_seen : sess.data.b_seen;
    var q = sb().from("messages").select("id", { count: "exact", head: true }).eq("session_id", sess.data.id).neq("sender_id", uid);
    if (seen) q = q.gt("created_at", seen);
    var { count } = await q;
    return count || 0;
  }

  function mount() {
    if (document.getElementById("kq-msgr")) return;
    if (!document.getElementById("kinqsy-chat-css")) {
      var l = document.createElement("link");
      l.id = "kinqsy-chat-css";
      l.rel = "stylesheet";
      l.href = "kinqsy-chat.css";
      document.head.appendChild(l);
    }
    var host = document.getElementById("profile-side") || document.body;
    var box = document.createElement("section");
    box.id = "kq-msgr";
    box.className = "profile-module";
    box.innerHTML = '<h3>messages</h3><input type="search" id="kq-msgr-q" placeholder="поиск друга"><div id="kq-msgr-list"></div><p id="kq-msgr-empty"></p><p id="kq-msgr-err"></p>';
    if (host.id === "profile-side") host.appendChild(box);
    else { box.style.cssText = "position:fixed;right:16px;bottom:16px;width:240px;z-index:70"; document.body.appendChild(box); }
    document.getElementById("kq-msgr-q").oninput = paint;
  }

  async function paint() {
    var list = document.getElementById("kq-msgr-list");
    var empty = document.getElementById("kq-msgr-empty");
    if (!list) return;
    var q = (document.getElementById("kq-msgr-q").value || "").toLowerCase();
    list.innerHTML = "";
    var shown = friends.filter(function (f) { return !q || String(f.display_name || "").toLowerCase().indexOf(q) >= 0; });
    if (!shown.length) { empty.textContent = friends.length ? "нет совпадений" : "нет друзей"; return; }
    empty.textContent = "";
    for (var i = 0; i < shown.length; i++) {
      var f = shown[i];
      var n = await unreadFor(f.id);
      var b = document.createElement("button");
      b.type = "button";
      b.className = "kq-msgr-row";
      b.innerHTML = "<b>" + esc(f.display_name || "друг") + "</b>" + (n ? '<span class="kq-msgr-badge">' + n + "</span>" : "");
      b.onclick = (function (id, name) { return function () { window.kqOpenChat(id, name); }; })(f.id, f.display_name || "друг");
      list.appendChild(b);
    }
  }

  window.kqOpenChat = async function (otherId, name) {
    var uid = await me();
    var err = document.getElementById("kq-msgr-err");
    if (!uid) { if (err) err.textContent = "нужен вход"; return; }
    var ok = await sb().rpc("are_friends", { a: uid, b: otherId });
    if (!ok.data) { if (err) err.textContent = "писать можно только другу"; return; }
    if (err) err.textContent = "";
    var ids = pair(uid, otherId);
    var found = await sb().from("chat_sessions").select("id").eq("user_a", ids[0]).eq("user_b", ids[1]).eq("status", "open").maybeSingle();
    var sid = found.data && found.data.id;
    if (!sid) {
      var ins = await sb().from("chat_sessions").insert({
        user_a: ids[0], user_b: ids[1],
        a_present: ids[0] === uid, b_present: ids[1] === uid
      }).select("id").single();
      if (ins.error) { if (err) err.textContent = ins.error.message; return; }
      sid = ins.data.id;
    }
    drawWin(sid, otherId, name || "друг");
    listen(sid, otherId);
    await sb().rpc("mark_chat_seen", { sid: sid });
  };

  function drawWin(sid, otherId, name) {
    if (openWins[sid]) { openWins[sid].classList.remove("min"); openWins[sid].style.display = "flex"; return; }
    var w = document.createElement("div");
    w.className = "kq-chat-win";
    w.style.right = "24px";
    w.style.bottom = "24px";
    w.innerHTML =
      '<header data-drag><span>' + esc(name) + '</span>' +
      '<button type="button" data-min title="свернуть">–</button>' +
      '<button type="button" data-end title="завершить для обоих">✕</button></header>' +
      '<div class="kq-chat-log"></div><p class="kq-chat-err"></p>' +
      '<form><textarea maxlength="2000" placeholder="сообщение"></textarea><button type="submit">→</button></form>';
    document.body.appendChild(w);
    openWins[sid] = w;
    drag(w);
    w.querySelector("[data-min]").onclick = function () { w.classList.toggle("min"); };
    w.querySelector("[data-end]").onclick = async function () {
      if (!confirm("Завершить переписку для обоих? Сообщения исчезнут.")) return;
      var r = await sb().rpc("close_chat", { sid: sid });
      if (r.error) { w.querySelector(".kq-chat-err").textContent = r.error.message; return; }
      w.remove();
      delete openWins[sid];
    };
    var ta = w.querySelector("textarea");
    ta.onkeydown = function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); w.querySelector("form").requestSubmit(); }
    };
    w.querySelector("form").onsubmit = async function (e) {
      e.preventDefault();
      var body = (ta.value || "").trim();
      if (!body) return;
      var uid = await me();
      var r = await sb().from("messages").insert({ session_id: sid, sender_id: uid, body: body });
      if (r.error) { w.querySelector(".kq-chat-err").textContent = r.error.message; return; }
      w.querySelector(".kq-chat-err").textContent = "";
      ta.value = "";
      addLine(w.querySelector(".kq-chat-log"), { sender_id: uid, body: body, created_at: new Date().toISOString() }, otherId);
    };
    loadLog(sid, otherId);
  }

  async function loadLog(sid, otherId) {
    var w = openWins[sid];
    if (!w) return;
    var { data, error } = await sb().from("messages").select("sender_id,body,created_at").eq("session_id", sid).order("created_at");
    if (error) { w.querySelector(".kq-chat-err").textContent = error.message; return; }
    var log = w.querySelector(".kq-chat-log");
    log.innerHTML = "";
    (data || []).forEach(function (m) { addLine(log, m, otherId); });
  }

  function addLine(log, m, otherId) {
    if (log.querySelector('[data-t="' + m.created_at + '"][data-s="' + m.sender_id + '"]')) return;
    var p = document.createElement("p");
    p.className = m.sender_id === otherId ? "them" : "me";
    p.dataset.t = m.created_at;
    p.dataset.s = m.sender_id;
    p.textContent = m.body;
    var t = document.createElement("time");
    t.textContent = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    p.appendChild(t);
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  function listen(sid, otherId) {
    if (openWins[sid] && openWins[sid].dataset.live) return;
    if (openWins[sid]) openWins[sid].dataset.live = "1";
    try {
      sb().channel("chat-" + sid)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "session_id=eq." + sid }, function (row) {
          var w = openWins[sid];
          if (w && row.new) addLine(w.querySelector(".kq-chat-log"), row.new, otherId);
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_sessions", filter: "id=eq." + sid }, function (row) {
          if (row.new && row.new.status === "ended") {
            var w = openWins[sid];
            if (w) { w.remove(); delete openWins[sid]; }
          }
        })
        .subscribe();
    } catch (e) {}
    setInterval(function () {
      if (openWins[sid]) loadLog(sid, otherId);
    }, 4000);
  }

  function drag(w) {
    var h = w.querySelector("[data-drag]");
    h.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button")) return;
      h.setPointerCapture(e.pointerId);
      var r = w.getBoundingClientRect();
      var ox = e.clientX - r.left, oy = e.clientY - r.top;
      function move(ev) {
        var x = Math.max(8, Math.min(window.innerWidth - w.offsetWidth - 8, ev.clientX - ox));
        var y = Math.max(8, Math.min(window.innerHeight - 48, ev.clientY - oy));
        w.style.left = x + "px"; w.style.top = y + "px"; w.style.right = "auto"; w.style.bottom = "auto";
      }
      function up() { h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); }
      h.addEventListener("pointermove", move);
      h.addEventListener("pointerup", up);
    });
  }

  async function boot() {
    var uid = await me();
    if (!uid) return;
    mount();
    await loadFriends();
    await paint();
    setInterval(function () { paint(); }, 15000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
