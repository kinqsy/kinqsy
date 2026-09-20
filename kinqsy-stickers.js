window.kqStickersOnPost = [];
window.kqStickerFilter = "all";

function kqSb() { return window.__kinqsy_sb || null; }

async function kqIsOwner() {
  var sb = kqSb();
  if (!sb) return false;
  var sess = await sb.auth.getSession();
  return !!(sess.data && sess.data.session && sess.data.session.user);
}

window.kqLoadCatalog = async function (kind) {
  var sb = kqSb();
  if (!sb) return [];
  var q = sb.from("stickers").select("id,text,kind").order("created_at", { ascending: false });
  if (kind && kind !== "all") q = q.eq("kind", kind);
  var r = await q;
  return r.data || [];
};

window.kqOpenStickerTray = async function () {
  var host = document.getElementById("kq-sticker-pop");
  if (!host) {
    host = document.createElement("div");
    host.id = "kq-sticker-pop";
    document.body.appendChild(host);
  }
  host.className = "kq-sticker-dock";
  host.innerHTML = '<div class="kq-sticker-card"><p>загрузка…</p></div>';
  host.style.display = "block";
  var owner = await kqIsOwner();
  var list = await window.kqLoadCatalog(window.kqStickerFilter);
  var tabs = ["all", "kaomoji", "frame", "ascii"].map(function (k) {
    var label = { all: "все", kaomoji: "смайлы", frame: "рамки", ascii: "рисунки" }[k];
    var on = window.kqStickerFilter === k ? " on" : "";
    return '<button type="button" class="kq-chip' + on + '" data-kind="' + k + '">' + label + "</button>";
  }).join("");
  var cards = list.length
    ? list.map(function (s) {
        return '<button type="button" class="kq-sticker-pick" data-id="' + s.id +
          '" data-text="' + encodeURIComponent(s.text) + '"><i>' + (s.kind || "") +
          "</i><pre>" + s.text + "</pre></button>";
      }).join("")
    : '<p class="kq-empty">пусто в этой категории</p>';
  var add = owner
    ? '<div class="kq-add">' +
      '<textarea id="kq-sticker-new" rows="5" placeholder="вставь смайл, рамку или рисунок"></textarea>' +
      '<div class="kq-add-row">' +
        '<button type="button" class="kq-chip" data-newkind="kaomoji">смайл</button>' +
        '<button type="button" class="kq-chip" data-newkind="frame">рамка</button>' +
        '<button type="button" class="kq-chip" data-newkind="ascii">рисунок</button>' +
      "</div>" +
      '<button type="button" class="kq-go" id="kq-sticker-add">добавить в каталог</button>' +
      '<p id="kq-sticker-err"></p></div>'
    : "";
  host.innerHTML =
    '<div class="kq-sticker-card">' +
    '<div class="kq-sticker-head"><span>каталог</span>' +
    '<button type="button" class="kq-x" id="kq-sticker-close">✕</button></div>' +
    '<div class="kq-tabs">' + tabs + "</div>" +
    '<div class="kq-sticker-list">' + cards + "</div>" +
    add +
    "</div>";

  var addBtn = document.getElementById("kq-sticker-add");
  if (addBtn) {
    addBtn.onclick = async function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var err = document.getElementById("kq-sticker-err");
      var box = document.getElementById("kq-sticker-new");
      var raw = box ? String(box.value || "").replace(/\s+$/, "") : "";
      if (err) err.textContent = "сохраняю…";
      if (!raw) { if (err) err.textContent = "пустое поле"; return; }
      var sb = kqSb();
      if (!sb) { if (err) err.textContent = "нет подключения supabase"; return; }
      var sess = await sb.auth.getSession();
      var uid = sess.data && sess.data.session && sess.data.session.user && sess.data.session.user.id;
      var kind = host.dataset.newkind || "kaomoji";
      var ins = await sb.from("stickers").insert({ text: raw, user_id: uid, kind: kind }).select("id");
      if (ins.error) ins = await sb.from("stickers").insert({ text: raw, kind: kind }).select("id");
      if (ins.error) ins = await sb.from("stickers").insert({ text: raw }).select("id");
      if (ins.error) { if (err) err.textContent = ins.error.message; return; }
      if (err) err.textContent = "добавлено";
      box.value = "";
      window.kqOpenStickerTray();
    };
  }

  host.onclick = async function (e) {
    var kindBtn = e.target.closest("[data-kind]");
    if (kindBtn) {
      window.kqStickerFilter = kindBtn.getAttribute("data-kind");
      window.kqOpenStickerTray();
      return;
    }
    var nk = e.target.closest("[data-newkind]");
    if (nk) {
      host.querySelectorAll("[data-newkind]").forEach(function (b) { b.classList.remove("on"); });
      nk.classList.add("on");
      host.dataset.newkind = nk.getAttribute("data-newkind");
      return;
    }
    if (e.target.id === "kq-sticker-close") {
      host.style.display = "none";
      return;
    }
    if (e.target.id === "kq-sticker-add") {
      var raw = (document.getElementById("kq-sticker-new").value || "").replace(/\s+$/, "");
      var err = document.getElementById("kq-sticker-err");
      if (!raw) return;
      var sb = kqSb();
      var sess = await sb.auth.getSession();
      var uid = sess.data.session && sess.data.session.user.id;
      var kind = host.dataset.newkind || "kaomoji";
      var ins = await sb.from("stickers").insert({ text: raw, user_id: uid, kind: kind }).select("id");
      if (ins.error) ins = await sb.from("stickers").insert({ text: raw, kind: kind }).select("id");
      if (ins.error) ins = await sb.from("stickers").insert({ text: raw }).select("id");
      if (ins.error) { err.textContent = ins.error.message; return; }
      document.getElementById("kq-sticker-new").value = "";
      window.kqOpenStickerTray();
      return;
    }
    var pick = e.target.closest("[data-text]");
    if (!pick) return;
    window.kqAddSticker(pick.getAttribute("data-id"), decodeURIComponent(pick.getAttribute("data-text")));
  };
};

window.kqAddSticker = function (id, text) {
  window.kqStickersOnPost.push({
    uid: "s" + Date.now(),
    id: id,
    text: text,
    x: 12,
    y: 40,
    rot: 0,
    flipX: 1,
    flipY: 1
  });
  window.kqPaintStickers();
};

function kqCanvas() {
  return document.querySelector(".compose-preview-box") ||
    document.getElementById("kq-sticker-canvas") ||
    document.getElementById("compose-preview");
}

window.kqPaintStickers = function () {
  var canvas = kqCanvas();
  if (!canvas) return;
  canvas.classList.add("kq-sticker-canvas");
  if (getComputedStyle(canvas).position === "static") canvas.style.position = "relative";
  canvas.querySelectorAll(".kq-sticker-node,.kq-sticker-tools").forEach(function (n) { n.remove(); });
  (window.kqStickersOnPost || []).forEach(function (node) {
    var el = document.createElement("pre");
    el.className = "kq-sticker-node";
    el.textContent = node.text;
    el.style.left = node.x + "%";
    el.style.top = node.y + "%";
    el.style.transform = "rotate(" + (node.rot || 0) + "deg) scale(" + (node.flipX || 1) + "," + (node.flipY || 1) + ")";
    canvas.appendChild(el);
    kqDrag(el, node, canvas);
    el.addEventListener("click", function (ev) {
      ev.stopPropagation();
      window.kqSelectSticker(node.uid);
    });
  });
};

window.kqSelectSticker = function (uid) {
  var canvas = kqCanvas();
  if (!canvas) return;
  canvas.querySelectorAll(".kq-sticker-tools").forEach(function (n) { n.remove(); });
  var node = (window.kqStickersOnPost || []).filter(function (x) { return x.uid === uid; })[0];
  if (!node) return;
  var bar = document.createElement("div");
  bar.className = "kq-sticker-tools";
  bar.innerHTML =
    '<button type="button" data-act="rl">↺</button>' +
    '<button type="button" data-act="rr">↻</button>' +
    '<button type="button" data-act="fx">↔</button>' +
    '<button type="button" data-act="fy">↕</button>' +
    '<button type="button" data-act="del">✕</button>';
  canvas.appendChild(bar);
  bar.style.left = node.x + "%";
  bar.style.top = "calc(" + node.y + "% - 28px)";
  bar.onclick = function (e) {
    var act = e.target.getAttribute("data-act");
    if (!act) return;
    if (act === "rl") node.rot = (node.rot || 0) - 15;
    if (act === "rr") node.rot = (node.rot || 0) + 15;
    if (act === "fx") node.flipX = (node.flipX || 1) * -1;
    if (act === "fy") node.flipY = (node.flipY || 1) * -1;
    if (act === "del") {
      window.kqStickersOnPost = window.kqStickersOnPost.filter(function (x) { return x.uid !== uid; });
    }
    window.kqPaintStickers();
    if (act !== "del") window.kqSelectSticker(uid);
  };
};

function kqDrag(el, node, canvas) {
  var dragging = false;
  function pos(ev) {
    var p = ev.touches ? ev.touches[0] : ev;
    var box = canvas.getBoundingClientRect();
    return {
      x: ((p.clientX - box.left) / box.width) * 100,
      y: ((p.clientY - box.top) / box.height) * 100
    };
  }
  function move(ev) {
    if (!dragging) return;
    ev.preventDefault();
    var p = pos(ev);
    node.x = Math.max(0, Math.min(85, p.x));
    node.y = Math.max(0, Math.min(85, p.y));
    el.style.left = node.x + "%";
    el.style.top = node.y + "%";
  }
  function up() {
    dragging = false;
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
    document.removeEventListener("touchmove", move);
    document.removeEventListener("touchend", up);
  }
  el.addEventListener("mousedown", function (ev) {
    dragging = true; ev.preventDefault();
    document.addEventListener("mousemove", move, { passive: false });
    document.addEventListener("mouseup", up);
  });
  el.addEventListener("touchstart", function (ev) {
    dragging = true; ev.preventDefault();
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", up);
  }, { passive: false });
}

window.kqDecorPayload = function () { return window.kqStickersOnPost || []; };

window.kqMountDecor = function (article, decor) {
  if (!article || !decor || !decor.length) return;
  article.classList.add("kq-sticker-canvas");
  if (getComputedStyle(article).position === "static") article.style.position = "relative";
  decor.forEach(function (node) {
    var el = document.createElement("pre");
    el.className = "kq-sticker-node";
    el.textContent = node.text || "";
    el.style.left = (node.x || 0) + "%";
    el.style.top = (node.y || 0) + "%";
    el.style.transform = "rotate(" + (node.rot || 0) + "deg) scale(" + (node.flipX || 1) + "," + (node.flipY || 1) + ")";
    el.style.pointerEvents = "none";
    article.appendChild(el);
  });
};
