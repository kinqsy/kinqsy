/* Gossip topics, thread, and newspaper board. Loaded after gossip.html inline script. */
(function () {
  var sb = window.__kinqsy_sb;
  var activeTopic = null;
  var boardItems = [];
  var drag = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function host() {
    return document.getElementById("g-personal");
  }

  function paintTopics(rows, q) {
    var box = document.getElementById("g-topic-list");
    if (!box) return;
    var list = (rows || []).filter(function (t) {
      return !q || String(t.name).toLowerCase().indexOf(q) >= 0;
    });
    if (!list.length) {
      box.innerHTML = '<div class="soft">тем нет</div>';
      return;
    }
    box.innerHTML = list.map(function (t) {
      return '<button type="button" class="g-item topic-open" data-id="' + esc(t.id) + '" data-name="' + esc(t.name) + '">' + esc(t.name) + "</button>";
    }).join("");
  }

  async function loadTopics(q) {
    if (!sb) return;
    var res = await sb.from("gossip_topics").select("id, name, created_at").order("name");
    var box = document.getElementById("g-topic-list");
    if (res.error) {
      if (box) box.innerHTML = '<div class="soft">темы появятся после SQL-миграции</div>';
      return;
    }
    paintTopics(res.data || [], (q || "").toLowerCase());
  }

  function openTopic(id, name) {
    activeTopic = { id: id, name: name };
    var banner = document.getElementById("g-thread");
    if (banner) {
      banner.style.display = "block";
      banner.innerHTML = '<button type="button" class="pill" id="g-thread-back">общая лента</button> <span>тема: ' + esc(name) + "</span>";
      document.getElementById("g-thread-back").onclick = function () {
        activeTopic = null;
        banner.style.display = "none";
        if (window.loadFeed) window.loadFeed();
      };
    }
    if (window.loadFeed) window.loadFeed();
  }

  window.gossipActiveTopic = function () { return activeTopic; };

  async function createTopic() {
    var name = (document.getElementById("g-topic-name").value || "").trim();
    var err = document.getElementById("g-topic-err");
    if (name.length < 2) { err.textContent = "минимум 2 символа"; return; }
    var session = await sb.auth.getSession();
    var uid = session.data && session.data.session && session.data.session.user.id;
    if (!uid) { err.textContent = "нужен вход"; return; }
    var res = await sb.from("gossip_topics").insert({ name: name, created_by: uid }).select("id, name").single();
    if (res.error) {
      err.textContent = /unique|duplicate/i.test(res.error.message || "") ? "такая тема уже есть" : "не сохранилось";
      return;
    }
    document.getElementById("g-topic-form").style.display = "none";
    document.getElementById("g-topic-name").value = "";
    err.textContent = "";
    await loadTopics("");
    openTopic(res.data.id, res.data.name);
    if (window.openCompose) window.openCompose();
    var hid = document.getElementById("g-topic-id");
    if (hid) hid.value = res.data.id;
  }

  function mountTopics() {
    var el = host();
    if (!el || el.getAttribute("data-live")) return;
    el.setAttribute("data-live", "1");
    el.innerHTML =
      '<h2><span>Personal topics</span> <button type="button" class="pill" id="g-topic-add">+</button></h2>' +
      '<input id="g-topic-search" placeholder="найти тему" maxlength="48">' +
      '<div id="g-topic-form" style="display:none">' +
      '<input id="g-topic-name" maxlength="48" placeholder="название темы">' +
      '<div class="row"><button type="button" class="ghost" id="g-topic-save">сохранить</button></div>' +
      '<div id="g-topic-err" class="soft"></div></div>' +
      '<div id="g-topic-list"></div>';
    document.getElementById("g-topic-add").onclick = function () {
      var f = document.getElementById("g-topic-form");
      f.style.display = f.style.display === "none" ? "block" : "none";
    };
    document.getElementById("g-topic-save").onclick = createTopic;
    document.getElementById("g-topic-search").oninput = function () { loadTopics(this.value); };
    el.onclick = function (e) {
      var b = e.target.closest(".topic-open");
      if (!b) return;
      openTopic(b.getAttribute("data-id"), b.getAttribute("data-name"));
    };
    loadTopics("");
  }

  function boardEl() { return document.getElementById("g-board"); }

  function renderBoard() {
    var el = boardEl();
    if (!el) return;
    el.innerHTML = "";
    boardItems.slice().sort(function (a, b) { return a.z - b.z; }).forEach(function (it) {
      var n = document.createElement("div");
      n.className = "g-obj";
      n.style.left = it.x + "px";
      n.style.top = it.y + "px";
      n.style.width = it.w + "px";
      n.style.height = it.h + "px";
      n.style.zIndex = String(it.z);
      if (it.type === "text" || it.type === "title") {
        n.contentEditable = "true";
        n.textContent = it.text || "";
        n.style.fontFamily = it.font || "Georgia, serif";
        n.style.color = it.color || "#f6dce8";
        n.style.fontSize = (it.size || (it.type === "title" ? 28 : 16)) + "px";
        n.oninput = function () { it.text = n.textContent; };
      } else {
        var img = document.createElement("img");
        img.src = it.src || "";
        img.alt = "";
        img.draggable = false;
        n.appendChild(img);
      }
      var h = document.createElement("i");
      h.className = "g-handle";
      n.appendChild(h);
      n.onpointerdown = function (e) {
        if (e.target === h) {
          drag = { it: it, mode: "size", x: e.clientX, y: e.clientY, w: it.w, h: it.h };
        } else {
          drag = { it: it, mode: "move", x: e.clientX, y: e.clientY, ox: it.x, oy: it.y };
        }
        n.setPointerCapture(e.pointerId);
      };
      n.onpointermove = function (e) {
        if (!drag || drag.it !== it) return;
        if (drag.mode === "move") {
          it.x = Math.max(0, drag.ox + e.clientX - drag.x);
          it.y = Math.max(0, drag.oy + e.clientY - drag.y);
        } else {
          it.w = Math.max(40, drag.w + e.clientX - drag.x);
          it.h = Math.max(24, drag.h + e.clientY - drag.y);
        }
        n.style.left = it.x + "px";
        n.style.top = it.y + "px";
        n.style.width = it.w + "px";
        n.style.height = it.h + "px";
      };
      n.onpointerup = function () { drag = null; };
      el.appendChild(n);
    });
  }

  function addItem(type, extra) {
    var n = boardItems.length + 1;
    boardItems.push(Object.assign({
      id: "o" + Date.now(), type: type, x: 12 + n * 8, y: 12 + n * 8,
      w: type === "title" ? 220 : 160, h: type === "text" ? 80 : 120, z: n,
      text: type === "title" ? "заголовок" : "текст", font: "Georgia, serif",
      color: "#f6dce8", size: type === "title" ? 28 : 16
    }, extra || {}));
    renderBoard();
  }

  window.gossipDecor = function () {
    return { layout: boardItems };
  };
  window.gossipSetDecor = function (d) {
    boardItems = (d && d.layout) ? d.layout.slice() : [];
    renderBoard();
  };

  function mountBoard() {
    var compose = document.getElementById("compose");
    if (!compose || document.getElementById("g-board")) return;
    var bar = document.createElement("div");
    bar.className = "row";
    bar.innerHTML =
      '<button type="button" class="pill" id="g-add-title">заголовок</button>' +
      '<button type="button" class="pill" id="g-add-text">текст</button>' +
      '<button type="button" class="pill" id="g-add-img">фото/gif</button>' +
      '<input type="hidden" id="g-topic-id">';
    compose.insertBefore(bar, compose.querySelector(".row"));
    var board = document.createElement("div");
    board.id = "g-board";
    compose.insertBefore(board, bar.nextSibling);
    document.getElementById("g-add-title").onclick = function () { addItem("title"); };
    document.getElementById("g-add-text").onclick = function () { addItem("text"); };
    document.getElementById("g-add-img").onclick = function () {
      var inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "image/png,image/jpeg,image/gif,image/webp";
      inp.onchange = async function () {
        var f = inp.files && inp.files[0];
        if (!f || !sb) return;
        var session = await sb.auth.getSession();
        var uid = session.data && session.data.session && session.data.session.user.id;
        if (!uid) return;
        var path = "gossip/" + uid + "/" + Date.now() + "-" + Math.random().toString(36).slice(2) + (/\.gif$/i.test(f.name) ? ".gif" : ".img");
        var up = await sb.storage.from("media").upload(path, f, { contentType: f.type || "image/jpeg" });
        if (up.error) { document.getElementById("g-err").textContent = "файл не загрузился"; return; }
        var signed = await sb.storage.from("media").createSignedUrl(path, 60 * 60 * 24 * 7);
        addItem("image", { src: signed.data && signed.data.signedUrl, path: path, w: 180, h: 140 });
      };
      inp.click();
    };
  }

  var oldPublish = null;
  function wrapPublish() {
    var btn = document.getElementById("g-publish");
    if (!btn || btn.getAttribute("data-wrap")) return;
    btn.setAttribute("data-wrap", "1");
    oldPublish = btn.onclick;
    btn.onclick = async function () {
      if (oldPublish) await oldPublish.call(btn);
    };
  }

  document.addEventListener("DOMContentLoaded", function () {
    mountTopics();
    mountBoard();
    var banner = document.createElement("div");
    banner.id = "g-thread";
    banner.className = "soft";
    banner.style.display = "none";
    var feed = document.getElementById("feed");
    if (feed && feed.parentNode) feed.parentNode.insertBefore(banner, feed);
  });

  var orig = window.loadFeed;
  window.loadFeed = async function () {
    if (orig) await orig();
    var topic = activeTopic;
    if (!topic || !sb) return;
    var labels = await sb.from("gossip_topic_labels").select("post_id, topic_id, topic_name").eq("topic_id", topic.id);
    var allow = {};
    (labels.data || []).forEach(function (r) { allow[r.post_id] = r.topic_name; });
    document.querySelectorAll("#feed .card").forEach(function (card) {
      var id = Number(String(card.id).replace("g-", ""));
      if (!allow[id]) card.style.display = "none";
      else {
        var meta = card.querySelector(".meta");
        if (meta && meta.textContent.indexOf(allow[id]) < 0) meta.textContent += " · " + allow[id];
      }
    });
  };
})();
