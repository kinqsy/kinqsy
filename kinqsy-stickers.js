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
    w: 32,
    wrap: "square",
    align: "left",
    gap: 8,
    rot: 0,
    flipX: 1,
    flipY: 1,
    scale: 1
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
    '<button type="button" data-act="sm">−</button>' +
    '<button type="button" data-act="sp">+</button>' +
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
    if (act === "sm") node.scale = Math.max(0.4, (node.scale || 1) - 0.15);
    if (act === "sp") node.scale = Math.min(2.4, (node.scale || 1) + 0.15);
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
    var c = window.kqClamp ? window.kqClamp(p.x, p.y) : p;
    node.x = c.x;
    node.y = c.y;
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


window.kqBoard = window.kqBoard || {
  title: { x: 6, y: 6, w: 88, size: 28 },
  body: { x: 6, y: 22, w: 55, size: 16 },
  media: { x: 64, y: 22, w: 30 },
  stickers: []
};

function kqBoardEl() {
  return document.querySelector(".compose-preview-box");
}

window.kqSyncBoard = function () {
  var box = kqBoardEl();
  if (!box) return;
  box.classList.add("kq-board");
  var title = (document.getElementById("compose-title") || {}).value || "заголовок…";
  var body = (document.getElementById("compose-content") || {}).value || "текст…";
  var img = document.getElementById("compose-preview");
  var src = img && img.style.display !== "none" ? img.src : ((document.getElementById("compose-media-url") || {}).value || "");
  var B = window.kqBoard;
  box.innerHTML =
    '<div class="kq-piece" data-piece="title" style="left:'+B.title.x+'%;top:'+B.title.y+'%;width:'+B.title.w+'%;font-size:'+B.title.size+'px">'+
      title.replace(/</g,"")+'</div>'+
    '<div class="kq-piece" data-piece="body" style="left:'+B.body.x+'%;top:'+B.body.y+'%;width:'+B.body.w+'%;font-size:'+B.body.size+'px;white-space:pre-wrap">'+
      body.replace(/</g,"")+'</div>'+
    (src ? '<img class="kq-piece" data-piece="media" src="'+src+'" style="left:'+B.media.x+'%;top:'+B.media.y+'%;width:'+B.media.w+'%">' : '');
  (window.kqStickersOnPost || []).forEach(function (node) {
    var el = document.createElement("pre");
    el.className = "kq-sticker-node kq-piece";
    el.textContent = node.text;
    el.style.left = node.x + "%";
    el.style.top = node.y + "%";
    el.style.background = "transparent";
    var sc = node.scale || 1;
    el.style.transform = "rotate("+(node.rot||0)+"deg) scale("+(sc*(node.flipX||1))+","+(sc*(node.flipY||1))+")";
    box.appendChild(el);
    kqDrag(el, node, box);
    el.onclick = function (ev) { ev.stopPropagation(); window.kqSelectSticker(node.uid); };
  });
  box.querySelectorAll(".kq-piece[data-piece]").forEach(function (el) {
    var key = el.getAttribute("data-piece");
    kqDrag(el, B[key], box);
  });
};

var _paint = window.kqPaintStickers;
window.kqPaintStickers = function () {
  if (kqBoardEl()) window.kqSyncBoard();
  else if (_paint) _paint();
};

window.kqDecorPayload = function () {
  return {
    board: window.kqBoard,
    stickers: window.kqStickersOnPost || []
  };
};

window.kqMountDecor = function (article, decor) {
  if (!article || !decor) return;
  var stickers = Array.isArray(decor) ? decor : (decor.stickers || []);
  var board = !Array.isArray(decor) && decor.board;
  if (board) {
    article.classList.add("kq-board");
    var title = article.querySelector(".post-title");
    var content = article.querySelector(".post-content");
    var media = article.querySelector(".post-media");
    function place(el, spec, extra) {
      if (!el || !spec) return;
      el.classList.add("kq-piece");
      el.style.left = spec.x + "%";
      el.style.top = spec.y + "%";
      el.style.width = spec.w + "%";
      if (spec.size) el.style.fontSize = spec.size + "px";
      if (extra) el.style.whiteSpace = extra;
    }
    place(title, board.title);
    place(content, board.body, "pre-wrap");
    if (media) place(media, board.media);
  }
  article.classList.add("kq-sticker-canvas");
  if (getComputedStyle(article).position === "static") article.style.position = "relative";
  stickers.forEach(function (node) {
    var el = document.createElement("pre");
    el.className = "kq-sticker-node";
    el.textContent = node.text || "";
    el.style.left = (node.x || 0) + "%";
    el.style.top = (node.y || 0) + "%";
    el.style.background = "transparent";
    var sc = node.scale || 1;
    el.style.transform = "rotate("+(node.rot||0)+"deg) scale("+(sc*(node.flipX||1))+","+(sc*(node.flipY||1))+")";
    el.style.pointerEvents = "none";
    article.appendChild(el);
  });
};


window.kqInitBoard = function () {
  var box = document.querySelector("#compose-overlay .compose-preview-box");
  if (!box) return;
  box.classList.add("kq-board");
  if (!box.querySelector('[data-piece="title"]')) {
    box.innerHTML =
      '<div class="kq-reserved">20/09/2026 · ♥ 0 · 0</div>' +
      '<div class="kq-piece" data-piece="title">заголовок…</div>' +
      '<div class="kq-piece" data-piece="body">текст…</div>' +
      '<img class="kq-piece" data-piece="media" alt="">';
    var B = window.kqBoard;
    var map = { title: B.title, body: B.body, media: B.media };
    box.querySelectorAll(".kq-piece").forEach(function (el) {
      var key = el.getAttribute("data-piece");
      var spec = map[key];
      if (!spec) return;
      el.style.left = spec.x + "%";
      el.style.top = spec.y + "%";
      el.style.width = spec.w + "%";
      if (spec.size) el.style.fontSize = spec.size + "px";
      kqDrag(el, spec, box);
    });
  }
  window.kqUpdateBoardText();
};

window.kqUpdateBoardText = function () {
  var box = document.querySelector("#compose-overlay .compose-preview-box");
  if (!box) return;
  var t = box.querySelector('[data-piece="title"]');
  var b = box.querySelector('[data-piece="body"]');
  var m = box.querySelector('[data-piece="media"]');
  var title = document.getElementById("compose-title");
  var body = document.getElementById("compose-content");
  var fontT = document.getElementById("compose-title-font");
  var fontB = document.getElementById("compose-body-font");
  var colT = document.getElementById("compose-title-color");
  var colB = document.getElementById("compose-body-color");
  var url = document.getElementById("compose-media-url");
  var fileImg = document.getElementById("compose-preview");
  if (t) {
    t.textContent = (title && title.value) ? title.value : "заголовок…";
    if (fontT) t.style.fontFamily = fontT.value;
    if (colT) t.style.color = colT.value;
    if (window.kqBoard && window.kqBoard.title.size) t.style.fontSize = window.kqBoard.title.size + "px";
  }
  if (b) {
    b.textContent = (body && body.value) ? body.value : "текст…";
    if (fontB) b.style.fontFamily = fontB.value;
    if (colB) b.style.color = colB.value;
    b.style.whiteSpace = "pre-wrap";
  }
  if (m) {
    var src = (fileImg && fileImg.src && fileImg.style.display !== "none") ? fileImg.src : ((url && url.value) || "");
    if (src) { m.src = src; m.style.display = "block"; }
    else { m.removeAttribute("src"); m.style.display = "none"; }
  }
};

window.kqSyncBoard = function () {
  window.kqInitBoard();
  window.kqPaintStickersOnBoard && window.kqPaintStickersOnBoard();
};

window.kqPaintStickersOnBoard = function () {
  var box = document.querySelector("#compose-overlay .compose-preview-box");
  if (!box) return;
  box.querySelectorAll(".kq-sticker-node").forEach(function (n) { n.remove(); });
  (window.kqStickersOnPost || []).forEach(function (node) {
    var el = document.createElement("pre");
    el.className = "kq-sticker-node";
    el.textContent = node.text;
    el.style.left = node.x + "%";
    el.style.top = node.y + "%";
    el.style.background = "transparent";
    var sc = node.scale || 1;
    el.style.transform = "rotate("+(node.rot||0)+"deg) scale("+(sc*(node.flipX||1))+","+(sc*(node.flipY||1))+")";
    box.appendChild(el);
    kqDrag(el, node, box);
    el.onclick = function (ev) { ev.stopPropagation(); window.kqSelectSticker(node.uid); };
  });
};

var _oldAdd = window.kqAddSticker;
window.kqAddSticker = function (id, text) {
  if (_oldAdd) _oldAdd(id, text);
  window.kqPaintStickersOnBoard();
};


window.kqClamp = function (x, y) {
  var minY = 18;
  return {
    x: Math.max(1, Math.min(70, x)),
    y: Math.max(8, Math.min(70, y))
  };
};


window.kqMountDecor = function (host, decor) {
  if (!host || !decor) return;
  var stickers = Array.isArray(decor) ? decor : (decor.stickers || []);
  host.classList.add("kq-sticker-canvas");
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  stickers.forEach(function (node) {
    var el = document.createElement("pre");
    el.className = "kq-sticker-node";
    el.textContent = node.text || "";
    el.style.left = (node.x || 8) + "%";
    el.style.top = (node.y || 35) + "%";
    el.style.background = "transparent";
    var sc = node.scale || 1;
    el.style.transform = "rotate("+(node.rot||0)+"deg) scale("+(sc*(node.flipX||1))+","+(sc*(node.flipY||1))+")";
    el.style.pointerEvents = "none";
    host.appendChild(el);
  });
};

/* Flow layout: objects belong to the card, not to the text height. */
window.kqBoard = window.kqBoard || {
  title: { x: 6, y: 6, w: 88, size: 28 },
  body: { x: 6, y: 22, w: 100, size: 16 },
  media: { x: 64, y: 22, w: 36, wrap: "square", align: "right", gap: 10 }
};

function kqWrapSpec(spec) {
  spec = spec || {};
  return {
    wrap: spec.wrap || "square",
    align: spec.align || ((spec.x || 0) > 50 ? "right" : "left"),
    w: spec.w || 36,
    gap: spec.gap != null ? spec.gap : 10,
    x: spec.x != null ? spec.x : 8,
    y: spec.y != null ? spec.y : 24
  };
}

function kqStyleObj(el, spec) {
  spec = spec || {};
  var hasWrap = !!spec.wrap;
  var s = kqWrapSpec(spec);
  el.classList.add("kq-obj");
  if (!hasWrap) {
    el.dataset.wrap = "behind";
    el.style.setProperty("--obj-x", (spec.x != null ? spec.x : 8) + "%");
    el.style.setProperty("--obj-y", Math.round((spec.y != null ? spec.y : 24) / 100 * 360) + "px");
    el.style.setProperty("--obj-w", (spec.w || 32) + "%");
    return;
  }
  el.dataset.wrap = s.wrap === "contour" ? "contour" : s.wrap;
  el.dataset.align = s.align;
  el.style.setProperty("--obj-w", s.w + "%");
  el.style.setProperty("--obj-gap", s.gap + "px");
  if (s.wrap === "front" || s.wrap === "behind") {
    el.style.setProperty("--obj-x", s.x + "%");
    el.style.setProperty("--obj-y", Math.round(s.y / 100 * 360) + "px");
  }
}

window.kqReadWrap = function () {
  var wrap = document.getElementById("compose-wrap");
  var align = document.getElementById("compose-align");
  var gap = document.getElementById("compose-gap");
  if (!window.kqBoard.media) window.kqBoard.media = {};
  if (wrap) window.kqBoard.media.wrap = wrap.value;
  if (align) window.kqBoard.media.align = align.value;
  if (gap) window.kqBoard.media.gap = Number(gap.value) || 0;
};

function kqPlaceBlock(el, spec) {
  if (!el || !spec) return;
  var x = Math.max(0, Math.min(80, Number(spec.x) || 0));
  var w = Math.max(20, Math.min(100 - x, Number(spec.w) || (100 - x)));
  el.style.marginLeft = x + "%";
  el.style.width = w + "%";
  el.style.maxWidth = (100 - x) + "%";
  el.style.boxSizing = "border-box";
  if (spec.y != null) el.style.marginTop = Math.round(Number(spec.y) / 100 * 280) + "px";
}

window.kqRenderFlow = function (host, opts) {
  if (!host) return;
  opts = opts || {};
  host.classList.add("kq-flow");
  host.innerHTML = "";
  var title = document.createElement("div");
  title.className = "kq-flow-title";
  title.textContent = opts.title || "";
  if (opts.titleStyle) title.setAttribute("style", opts.titleStyle);
  kqPlaceBlock(title, opts.titleSpec);
  if (opts.titleSpec && opts.titleSpec.size) title.style.fontSize = opts.titleSpec.size + "px";
  host.appendChild(title);
  var body = document.createElement("div");
  body.className = "kq-flow-body";
  kqPlaceBlock(body, opts.bodySpec);
  if (opts.mediaSrc) {
    var img = document.createElement("img");
    img.alt = "";
    img.src = opts.mediaSrc;
    kqStyleObj(img, opts.media || { wrap: "square", align: "right", w: 36, gap: 10 });
    body.appendChild(img);
  }
  (opts.stickers || []).forEach(function (node) {
    var el = document.createElement("pre");
    el.className = "kq-sticker-node";
    el.textContent = node.text || "";
    var sc = node.scale || 1;
    el.style.transform = "rotate("+(node.rot||0)+"deg) scale("+(sc*(node.flipX||1))+","+(sc*(node.flipY||1))+")";
    kqStyleObj(el, node);
    body.appendChild(el);
    if (opts.interactive) {
      kqDrag(el, node, host);
      el.onclick = function (ev) { ev.stopPropagation(); window.kqSelectSticker(node.uid); };
    }
  });
  var text = document.createElement("div");
  text.className = "kq-body";
  text.textContent = opts.body || "";
  if (opts.bodyStyle) text.setAttribute("style", opts.bodyStyle);
  body.appendChild(text);
  host.appendChild(body);
  if (opts.interactive) {
    kqDragBlock(title, window.kqBoard.title, host);
    kqDragBlock(body, window.kqBoard.body, host);
  }
};

function kqDragBlock(el, spec, host) {
  if (!el || !spec) return;
  el.style.cursor = "grab";
  var dragging = false;
  function pos(ev) {
    var p = ev.touches ? ev.touches[0] : ev;
    var box = host.getBoundingClientRect();
    return {
      x: ((p.clientX - box.left) / box.width) * 100,
      y: ((p.clientY - box.top) / box.height) * 100
    };
  }
  function move(ev) {
    if (!dragging) return;
    ev.preventDefault();
    var p = pos(ev);
    spec.x = Math.max(0, Math.min(70, p.x));
    spec.y = Math.max(0, Math.min(80, p.y));
    kqPlaceBlock(el, spec);
  }
  function up() {
    dragging = false;
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
    document.removeEventListener("touchmove", move);
    document.removeEventListener("touchend", up);
  }
  el.addEventListener("mousedown", function (ev) {
    if (ev.target.closest && ev.target.closest(".kq-obj")) return;
    dragging = true;
    document.addEventListener("mousemove", move, { passive: false });
    document.addEventListener("mouseup", up);
  });
  el.addEventListener("touchstart", function (ev) {
    dragging = true;
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", up);
  }, { passive: false });
}

window.kqSyncBoard = function () {
  var box = document.querySelector("#compose-overlay .compose-preview-box");
  if (!box) return;
  window.kqReadWrap && window.kqReadWrap();
  var title = (document.getElementById("compose-title") || {}).value || "заголовок…";
  var body = (document.getElementById("compose-content") || {}).value || "текст…";
  var img = document.getElementById("compose-preview");
  var src = img && img.style.display !== "none" ? img.src : ((document.getElementById("compose-media-url") || {}).value || "");
  var fontT = (document.getElementById("compose-title-font") || {}).value || "Georgia, serif";
  var fontB = (document.getElementById("compose-body-font") || {}).value || "Georgia, serif";
  var colT = (document.getElementById("compose-title-color") || {}).value || "#1a0f14";
  var colB = (document.getElementById("compose-body-color") || {}).value || "#1a0f14";
  var ts = window.kqBoard.title.size || 28;
  var bs = window.kqBoard.body.size || 16;
  window.kqRenderFlow(box, {
    title: title,
    body: body,
    mediaSrc: src,
    media: window.kqBoard.media,
    titleSpec: window.kqBoard.title,
    bodySpec: window.kqBoard.body,
    stickers: window.kqStickersOnPost || [],
    interactive: true,
    titleStyle: "font-family:"+fontT+";color:"+colT+";font-size:"+ts+"px",
    bodyStyle: "font-family:"+fontB+";color:"+colB+";font-size:"+bs+"px;white-space:pre-wrap"
  });
};

window.kqInitBoard = function () { window.kqSyncBoard(); };
window.kqUpdateBoardText = function () { window.kqSyncBoard(); };
window.kqPaintStickers = function () { window.kqSyncBoard(); };
window.kqPaintStickersOnBoard = function () { window.kqSyncBoard(); };

window.kqDecorPayload = function () {
  window.kqReadWrap && window.kqReadWrap();
  return { board: window.kqBoard, stickers: window.kqStickersOnPost || [] };
};

window.kqMountDecor = function (host, decor) {
  if (!host || !decor) return;
  var stickers = [];
  var board = null;
  if (Array.isArray(decor)) stickers = decor;
  else if (decor) {
    stickers = decor.stickers || [];
    board = decor.board || null;
  }
  var titleEl = host.querySelector(".post-title");
  var bodyEl = host.querySelector(".post-content");
  var mediaEl = host.querySelector(".post-media img");
  var titleStyle = titleEl ? (titleEl.getAttribute("style") || "") : "";
  if (board && board.title && board.title.size && titleStyle.indexOf("font-size") < 0) {
    titleStyle += ";font-size:" + board.title.size + "px";
  }
  window.kqRenderFlow(host, {
    title: titleEl ? titleEl.textContent : "",
    body: bodyEl ? bodyEl.textContent : "",
    mediaSrc: mediaEl ? mediaEl.src : "",
    media: (board && board.media) || null,
    titleSpec: board && board.title,
    bodySpec: board && board.body,
    stickers: stickers,
    titleStyle: titleStyle,
    bodyStyle: bodyEl ? bodyEl.getAttribute("style") : ""
  });
};

