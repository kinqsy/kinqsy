(function () {
  var sb = function () { return window.__kinqsy_sb; };
  var openWins = {};
  var liveChats = {};
  var unreadTimer = null;

  function disposeChat(sid) {
    var live = liveChats[sid];
    delete liveChats[sid];
    if (live) {
      clearInterval(live.timer);
      if (live.channel) Promise.resolve(sb().removeChannel(live.channel)).catch(function () {});
    }
    if (openWins[sid]) openWins[sid].remove();
    delete openWins[sid];
  }
  function disposeAll() {
    Object.keys(openWins).forEach(disposeChat);
    clearInterval(unreadTimer);
    unreadTimer = null;
    friends = [];
    unreadMap = {};
    var list = document.getElementById("kq-msgr");
    if (list) list.remove();
    var badge = document.getElementById("kq-env-badge");
    if (badge) badge.hidden = true;
  }
  var meId = null;
  var friends = [];
  var unreadMap = {};

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

  function ensureCss() {
    if (document.getElementById("kinqsy-chat-css")) return;
    var l = document.createElement("link");
    l.id = "kinqsy-chat-css";
    l.rel = "stylesheet";
    l.href = "kinqsy-chat.css";
    document.head.appendChild(l);
  }

  function mountEnvelope() {
    if (document.getElementById("kq-env")) return;
    var star = document.getElementById("admin-star");
    if (!star || !star.parentNode) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "kq-env";
    btn.title = "сообщения";
    btn.innerHTML = '✉<span class="kq-env-badge" id="kq-env-badge" hidden></span>';
    star.parentNode.insertBefore(btn, star);
    btn.onclick = toggleList;
  }

  async function loadFriends() {
    var uid = await me();
    friends = [];
    if (!uid) return;
    var r1 = await sb().from("friendships").select("requester_id,addressee_id,status").eq("requester_id", uid).eq("status", "accepted");
    var r2 = await sb().from("friendships").select("requester_id,addressee_id,status").eq("addressee_id", uid).eq("status", "accepted");
    var ids = {};
    (r1.data || []).concat(r2.data || []).forEach(function (r) {
      var o = r.requester_id === uid ? r.addressee_id : r.requester_id;
      if (o) ids[o] = true;
    });
    var list = Object.keys(ids).slice(0, 5);
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

  async function refreshUnread() {
    unreadMap = {};
    var total = 0;
    for (var i = 0; i < friends.length; i++) {
      var n = await unreadFor(friends[i].id);
      unreadMap[friends[i].id] = n;
      total += n;
    }
    var badge = document.getElementById("kq-env-badge");
    if (badge) {
      if (total > 0) { badge.hidden = false; badge.textContent = total > 9 ? "9+" : String(total); }
      else badge.hidden = true;
    }
    if (document.getElementById("kq-msgr")) paintList();
  }

  function toggleList() {
    var box = document.getElementById("kq-msgr");
    if (box) { box.remove(); return; }
    openList();
  }

  function openList() {
    ensureCss();
    if (document.getElementById("kq-msgr")) return;
    var box = document.createElement("section");
    box.id = "kq-msgr";
    box.innerHTML = '<h3><span>messages</span><button type="button" data-close title="закрыть">×</button></h3><div id="kq-msgr-list"></div><p id="kq-msgr-empty"></p><p id="kq-msgr-err"></p>';
    document.body.appendChild(box);
    box.querySelector("[data-close]").onclick = function () { box.remove(); };
    paintList();
  }

  function paintList() {
    var list = document.getElementById("kq-msgr-list");
    var empty = document.getElementById("kq-msgr-empty");
    if (!list) return;
    list.innerHTML = "";
    if (!friends.length) { empty.textContent = "нет друзей"; return; }
    empty.textContent = "";
    friends.forEach(function (f) {
      var n = unreadMap[f.id] || 0;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "kq-msgr-row";
      b.innerHTML = "<b>" + esc(f.display_name || "друг") + "</b>" + (n ? '<span class="kq-msgr-badge">' + n + "</span>" : "");
      b.onclick = function () { window.kqOpenChat(f.id, f.display_name || "друг"); };
      list.appendChild(b);
    });
  }

  window.kqOpenChat = async function (otherId, name) {
    var uid = await me();
    var err = document.getElementById("kq-msgr-err");
    if (!uid) { if (err) err.textContent = "нужен вход"; return; }
    var ok = await sb().rpc("are_friends", { a: uid, b: otherId });
    if (!ok.data) { if (err) err.textContent = "писать можно только другу"; return; }
    if (err) err.textContent = "";
    var ids = pair(uid, otherId);
    async function findSession() {
      return sb().from("chat_sessions").select("id").eq("user_a", ids[0]).eq("user_b", ids[1]).eq("status", "open").maybeSingle();
    }
    var found = await findSession();
    if (found.error) { if (err) err.textContent = "Не удалось открыть переписку. Повтори попытку."; return; }
    var sid = found.data && found.data.id;
    if (!sid) {
      var ins = await sb().from("chat_sessions").insert({
        user_a: ids[0], user_b: ids[1],
        a_present: ids[0] === uid, b_present: ids[1] === uid
      }).select("id").single();
      if (ins.error && ins.error.code === "23505") ins = await findSession();
      if (ins.error || !ins.data) { if (err) err.textContent = "Не удалось открыть переписку. Повтори попытку."; return; }
      sid = ins.data.id;
    }
    drawWin(sid, otherId, name || "друг");
    listen(sid, otherId);
    await sb().rpc("mark_chat_seen", { sid: sid });
    await sb().from("notifications").update({ read: true }).eq("user_id", uid).eq("kind", "chat").filter("payload->>session_id", "eq", sid);
    unreadMap[otherId] = 0;
    refreshUnread();
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
      '<button type="button" data-end title="завершить">×</button></header>' +
      '<div class="kq-chat-log"></div><p class="kq-chat-err"></p>' +
      '<form><textarea maxlength="2000" placeholder="сообщение"></textarea><button type="submit">→</button></form>';
    document.body.appendChild(w);
    openWins[sid] = w;
    drag(w);
    w.querySelector("[data-min]").onclick = function () { w.classList.toggle("min"); };
    w.querySelector("[data-end]").onclick = function () { askEnd(sid, w); };
    var ta = w.querySelector("textarea");
    ta.onkeydown = function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); w.querySelector("form").requestSubmit(); }
    };
    var sending = false;
    w.querySelector("form").onsubmit = async function (e) {
      e.preventDefault();
      if (sending) return;
      var original = ta.value || "";
      var body = original.trim();
      if (!body) return;
      sending = true;
      try {
        var uid = await me();
        if (!uid) throw new Error("Для отправки нужен вход.");
        var r = await sb().from("messages").insert({ session_id: sid, sender_id: uid, body: body });
        if (r.error) throw r.error;
        if (openWins[sid] !== w) return;
        w.querySelector(".kq-chat-err").textContent = "";
        if (ta.value === original) ta.value = "";
        await loadLog(sid, otherId);
      } catch (error) {
        if (openWins[sid] === w) w.querySelector(".kq-chat-err").textContent = "Не удалось отправить сообщение. Проверь соединение перед повторной отправкой.";
      } finally {
        sending = false;
      }
    };
    loadLog(sid, otherId);
  }

  function askEnd(sid, w) {
    var overlay = document.createElement("div");
    overlay.className = "kq-end-overlay";
    overlay.innerHTML =
      '<div class="kq-end-card" role="dialog" aria-modal="true">' +
      '<h3>Завершить переписку?</h3>' +
      '<p>Переписка закроется для вас обоих. Сообщения этой переписки будут удалены и станут недоступны обоим участникам.</p>' +
      '<div class="row"><button type="button" data-stay>Остаться</button><button type="button" data-end>Завершить</button></div>' +
      '</div>';
    document.body.appendChild(overlay);
    function close() { overlay.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    overlay.querySelector("[data-stay]").onclick = close;
    overlay.querySelector("[data-end]").onclick = async function () {
      var r = await sb().rpc("close_chat", { sid: sid });
      if (r.error) {
        if (w.querySelector(".kq-chat-err")) w.querySelector(".kq-chat-err").textContent = r.error.message;
        close();
        return;
      }
      close();
      disposeChat(sid);
    };
  }

  async function loadLog(sid, otherId) {
    var w = openWins[sid];
    if (!w) return;
    var { data, error } = await sb().from("messages").select("id,sender_id,body,created_at").eq("session_id", sid).order("created_at");
    if (error) { w.querySelector(".kq-chat-err").textContent = error.message; return; }
    var log = w.querySelector(".kq-chat-log");
    if (openWins[sid] !== w) return;
    var top = log.scrollTop;
    var atBottom = log.scrollHeight - log.clientHeight - top < 40;
    log.innerHTML = "";
    (data || []).forEach(function (m) { addLine(log, m, otherId); });
    if (!atBottom) log.scrollTop = top;
  }

  function addLine(log, m, otherId) {
    if (m.id != null && Array.prototype.some.call(log.children, function (row) { return row.dataset.id === String(m.id); })) return;
    var atBottom = log.scrollHeight - log.clientHeight - log.scrollTop < 40;
    var p = document.createElement("p");
    p.className = m.sender_id === otherId ? "them" : "me";
    if (m.id != null) p.dataset.id = String(m.id);
    p.dataset.t = m.created_at;
    p.dataset.s = m.sender_id;
    p.textContent = m.body;
    var t = document.createElement("time");
    t.textContent = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    p.appendChild(t);
    log.appendChild(p);
    if (atBottom) log.scrollTop = log.scrollHeight;
  }

  function listen(sid, otherId) {
    if (liveChats[sid] || !openWins[sid]) return;
    var live = liveChats[sid] = { channel: null, timer: null, loading: false };
    try {
      live.channel = sb().channel("chat-" + sid)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "session_id=eq." + sid }, function (row) {
          var w = openWins[sid];
          if (w && row.new) addLine(w.querySelector(".kq-chat-log"), row.new, otherId);
          refreshUnread();
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_sessions", filter: "id=eq." + sid }, function (row) {
          if (row.new && row.new.status === "ended") {
            var w = openWins[sid];
            if (w) disposeChat(sid);
          }
        })
        .subscribe();
    } catch (e) {}
    live.timer = setInterval(async function () {
      if (!openWins[sid] || live.loading) return;
      live.loading = true;
      try {
        var state = await sb().from("chat_sessions").select("status").eq("id", sid).maybeSingle();
        if (!openWins[sid] || liveChats[sid] !== live) return;
        if (!state.error && (!state.data || state.data.status === "ended")) { disposeChat(sid); return; }
        await loadLog(sid, otherId);
      } finally { live.loading = false; }
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
        var x = Math.max(8, Math.min(window.innerWidth - 80, ev.clientX - ox));
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
    ensureCss();
    mountEnvelope();
    await loadFriends();
    await refreshUnread();
    clearInterval(unreadTimer);
    unreadTimer = setInterval(refreshUnread, 15000);
  }

  window.addEventListener("pagehide", disposeAll);
  window.addEventListener("pageshow", function (event) { if (event.persisted) boot(); });
  if (sb()) sb().auth.onAuthStateChange(function (event, session) {
    var uid = session && session.user && session.user.id;
    if (uid !== meId) {
      disposeAll();
      meId = uid || null;
      if (uid) setTimeout(boot, 0);
    }
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
