/* Kinqsy · Notes · общая раскладка поста.
   ОДИН механизм показа (KQL.render) используется и в предпросмотре при создании, и в опубликованном посте — поэтому они совпадают.
   Модель (decor v3, лежит в posts.decor): { v:3, titleSize, bodySize, titleAlign, bodyAlign, pad, objs:[ ... ] }.
   Заголовок и текст берутся из posts.title / posts.content (шрифты и цвета — из существующих колонок), поэтому правка текста
   не ломает расположение объектов. Объект: { id, type: media|image|sticker|plate, mode, side, anchor, x, y, w, pad, ... }.
   Режимы: inline (в тексте), square (квадрат), contour (по контуру), tb (сверху и снизу), front (перед текстом), behind (за текстом).
   Объекты «в потоке» привязаны к номеру абзаца (anchor), а не к пикселям; free-объекты (front/behind) — к доле ширины карточки (cqw).
   Старые посты (decor без v:3) этим модулем не затрагиваются и показываются прежним кодом. */
(function (g) {
  "use strict";

  var MODES = ["inline", "square", "contour", "tb", "front", "behind"];
  var MODE_LABELS = { inline: "в тексте", square: "квадрат", contour: "по контуру", tb: "сверху и снизу", front: "перед текстом", behind: "за текстом" };
  var SIDES = ["left", "center", "right"];
  var REF = 8.6;                       // 1 cqw = 8.6 px при ширине 860 px: ползунки размера те же (заголовок 16–64, текст 12–28)
  var HEX = /^#[0-9a-fA-F]{6}$/;
  var URL_RE = /^https?:\/\/[^\s"'<>]+$/i;
  var FONT_RE = /^[\w\s,'"\-]{1,120}$/;
  var MAX_OBJS = 24, MAX_IMG = 6, MAX_BYTES = 8 * 1024 * 1024;
  var EXT = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp" };
  var FREE = { front: 1, behind: 1 };

  function num(v, d, a, b) { v = Number(v); if (!isFinite(v)) v = d; return Math.min(b, Math.max(a, v)); }
  function r2(v) { return Math.round(v * 100) / 100; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function oneOf(v, list, d) { return list.indexOf(v) >= 0 ? v : d; }
  function safeFont(f) { return typeof f === "string" && FONT_RE.test(f) ? f : "Georgia, serif"; }
  function safeColor(c, d) { return typeof c === "string" && HEX.test(c) ? c : d; }
  function isFree(o) { return !!FREE[o.mode]; }

  /* ---------- проверка и очистка данных объекта (чтение из БД никогда не бросает исключений) ---------- */
  function cleanObj(r) {
    if (!r || typeof r !== "object") return null;
    var type = oneOf(r.type, ["media", "image", "sticker", "plate"], null);
    if (!type) return null;
    var o = {
      id: String(r.id || "").replace(/[^\w\-]/g, "").slice(0, 40) || ("o" + Math.random().toString(36).slice(2, 8)),
      type: type,
      mode: oneOf(r.mode, MODES, "square"),
      side: oneOf(r.side, SIDES, "right"),
      anchor: Math.round(num(r.anchor, 0, 0, 5000)),
      x: r2(num(r.x, 5, 0, 100)), y: r2(num(r.y, 5, 0, 1000)),
      w: r2(num(r.w, type === "plate" ? 40 : 30, 5, 100)),
      pad: r2(num(r.pad, 2, 0, 8))
    };
    if (type === "media" || type === "image") {
      o.src = typeof r.src === "string" && URL_RE.test(r.src) ? r.src : "";
      o.ar = r2(num(r.ar, 1.5, 0.1, 10));
    } else if (type === "sticker") {
      o.text = String(r.text == null ? "" : r.text).slice(0, 2000);
      if (!o.text) return null;
      o.sid = r.sid != null ? String(r.sid).slice(0, 40) : "";
      o.fs = r2(num(r.fs, 3, 0.8, 12));
      o.rot = r2(num(r.rot, 0, -360, 360));
      o.fx = r.fx === -1 ? -1 : 1; o.fy = r.fy === -1 ? -1 : 1;
    } else {
      o.text = String(r.text == null ? "" : r.text).slice(0, 600);
      var p = r.plate && typeof r.plate === "object" ? r.plate : {};
      o.plate = { bg: oneOf(p.bg, ["solid", "glass", "gradient"], "solid"), color: safeColor(p.color, "#f0c9d6"), fg: safeColor(p.fg, "#1a0f14") };
    }
    return o;
  }

  function buildLayout(meta, d) {
    d = d && typeof d === "object" ? d : {};
    var objs = (Array.isArray(d.objs) ? d.objs : []).slice(0, MAX_OBJS).map(cleanObj).filter(Boolean);
    return {
      title: String(meta.title == null ? "" : meta.title),
      text: String(meta.text == null ? "" : meta.text),
      titleFont: safeFont(meta.titleFont), bodyFont: safeFont(meta.bodyFont),
      titleColor: safeColor(meta.titleColor, "#1a0f14"), bodyColor: safeColor(meta.bodyColor, "#1a0f14"),
      mediaUrl: typeof meta.mediaUrl === "string" && URL_RE.test(meta.mediaUrl) ? meta.mediaUrl : "",
      ts: r2(num(d.titleSize, 28, 10, 80) / REF), bs: r2(num(d.bodySize, 16, 10, 40) / REF),
      titleAlign: oneOf(d.titleAlign, ["left", "center", "right"], "left"),
      bodyAlign: oneOf(d.bodyAlign, ["left", "center", "right", "justify"], "left"),
      kp: r2(num(d.pad, 3, 0, 8)),
      objs: objs
    };
  }

  // опубликованный пост → раскладка v3 или null (тогда работает прежний код для старых постов)
  function fromPost(post) {
    try {
      var d = post && post.decor;
      if (typeof d === "string") d = JSON.parse(d);
      if (!d || d.v !== 3 || !Array.isArray(d.objs)) return null;
      return buildLayout({
        title: post.title, text: post.content, titleFont: post.title_font, bodyFont: post.body_font,
        titleColor: post.title_color, bodyColor: post.body_color, mediaUrl: post.media_url
      }, d);
    } catch (e) { return null; }
  }

  /* ---------- общий показ ---------- */
  function makeObj(o, L, opt) {
    var e = el("div", "kql-o " + o.type + " kql-m-" + o.mode + " kql-s-" + o.side);
    e.setAttribute("data-id", o.id);
    e.style.setProperty("--pad", String(o.pad));
    e.style.setProperty("--w", String(o.w));
    e.style.setProperty("--x", String(o.x));
    e.style.setProperty("--y", String(o.y));
    if (o.type === "media" || o.type === "image") {
      var url = o.type === "media" ? (L.mediaUrl || o.src) : o.src;
      e.style.setProperty("--ar", String(o.ar));
      if (url) {
        var img = document.createElement("img");
        img.alt = ""; img.decoding = "async"; img.draggable = false; img.src = url;
        if (o.mode === "contour") { e.style.shapeOutside = 'url("' + url + '")'; e.style.shapeImageThreshold = "0.4"; e.style.shapeMargin = o.pad + "cqw"; }
        img.addEventListener("load", function () { if (opt.afterLoad) opt.afterLoad(); });
        e.appendChild(img);
      } else e.appendChild(el("div", "kql-miss"));
    } else if (o.type === "sticker") {
      e.style.setProperty("--fs", String(o.fs)); e.style.setProperty("--rot", o.rot + "deg");
      e.style.setProperty("--fx", String(o.fx)); e.style.setProperty("--fy", String(o.fy));
      e.appendChild(el("pre", null, o.text));
    } else {
      e.classList.add(o.plate.bg);
      e.style.setProperty("--pbg", o.plate.color);
      e.style.color = o.plate.fg;
      e.style.fontFamily = L.bodyFont;
      e.textContent = o.text || (opt.edit ? "текст плашки…" : "");
    }
    if (opt.edit) {
      var hnd = el("div", "kql-h", "✥"); hnd.title = "перетащить";
      hnd.addEventListener("pointerdown", function (ev) { opt.onDown(ev, o, true); });
      e.appendChild(hnd);
      e.addEventListener("pointerdown", function (ev) { if (ev.target === hnd) return; opt.onDown(ev, o, false); });
    }
    return e;
  }

  function clampFree(host) {
    var card = host.querySelector(".kql-card");
    if (!card || !card.clientWidth) return;
    var u = card.clientWidth / 100, Hu = card.clientHeight / u;
    host.querySelectorAll(".kql-m-front, .kql-m-behind").forEach(function (e) {
      var w = e.offsetWidth / u, h = e.offsetHeight / u;
      var x = parseFloat(e.style.getPropertyValue("--x")) || 0, y = parseFloat(e.style.getPropertyValue("--y")) || 0;
      var nx = Math.max(0, Math.min(x, 100 - w)), ny = Math.max(0, Math.min(y, Hu - h));
      if (Math.abs(nx - x) > 0.01) e.style.setProperty("--x", String(r2(nx)));
      if (Math.abs(ny - y) > 0.01) e.style.setProperty("--y", String(r2(ny)));
    });
  }

  function render(host, L, opt) {
    opt = opt || {};
    host.innerHTML = "";
    host.classList.add("kql");
    host.classList.toggle("kql-edit", !!opt.edit);
    var card = el("div", "kql-card");
    card.style.setProperty("--kp", String(L.kp));
    var title = el("h2", "kql-title", L.title || (opt.edit ? "заголовок…" : ""));
    title.style.setProperty("--ts", String(L.ts));
    title.style.fontFamily = L.titleFont; title.style.color = L.titleColor; title.style.textAlign = L.titleAlign;
    if (!L.title && !opt.edit) title.style.display = "none";
    var body = el("div", "kql-body");
    body.style.setProperty("--bs", String(L.bs));
    body.style.fontFamily = L.bodyFont; body.style.color = L.bodyColor; body.style.textAlign = L.bodyAlign;
    var lines = L.text ? L.text.split("\n") : (opt.edit ? ["текст…"] : []);
    var n = lines.length;
    var back = el("div", "kql-free back"), front = el("div", "kql-free front");
    var by = {};
    L.objs.forEach(function (o) {
      if (o.mode === "behind") back.appendChild(makeObj(o, L, opt));
      else if (o.mode === "front") front.appendChild(makeObj(o, L, opt));
      else { var a = Math.min(o.anchor, n); (by[a] = by[a] || []).push(o); }
    });
    for (var i = 0; i <= n; i++) {
      (by[i] || []).forEach(function (o) { body.appendChild(makeObj(o, L, opt)); });
      if (i < n) {
        var p = el("p", "kql-p");
        if (lines[i] === "") p.appendChild(document.createElement("br")); else p.textContent = lines[i];
        if (!L.text && opt.edit) p.style.opacity = ".5";
        body.appendChild(p);
      }
    }
    card.appendChild(title); card.appendChild(body); card.appendChild(back); card.appendChild(front);
    host.appendChild(card);
    var again = function () { clampFree(host); };
    if (opt.afterLoad === undefined) opt.afterLoad = again;
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(again);
    if (typeof ResizeObserver === "function" && !host._kqRO) {
      host._kqRO = new ResizeObserver(function () { clampFree(host); });
      host._kqRO.observe(host);
    }
    return card;
  }

  /* ---------- редактор: предпросмотр = тот же render ---------- */
  var compose = null;

  function attachCompose() {
    var box = document.querySelector("#compose-overlay .compose-preview-box");
    if (!box || compose) return;
    box.classList.add("kql-box");
    var sbc = function () { return g.__kinqsy_sb || null; };
    var objs = [], sel = null, uidSeq = 0;
    var prefs = { titleAlign: "left", bodyAlign: "left", pad: 3 };

    function val(id, d) { var e = document.getElementById(id); return e && e.value !== "" ? e.value : d; }
    function meta() {
      return { title: val("compose-title", ""), text: val("compose-content", ""),
        titleFont: val("compose-title-font"), bodyFont: val("compose-body-font"),
        titleColor: val("compose-title-color"), bodyColor: val("compose-body-color"),
        mediaUrl: String(val("compose-media-url", "")).trim() };
    }
    function sizes() { return { titleSize: Number(val("compose-title-size", 28)), bodySize: Number(val("compose-body-size", 16)) }; }
    function nid() { uidSeq++; return "o" + Date.now().toString(36) + uidSeq; }
    function byId(id) { for (var i = 0; i < objs.length; i++) if (objs[i].id === id) return objs[i]; return null; }
    function selObj() { return sel ? byId(sel) : null; }

    /* панель инструментов */
    var tools = el("div", "kql-tools");
    var bPlate = el("button", null, "+ плашка"); bPlate.type = "button";
    var bImg = el("button", null, "+ фото / GIF"); bImg.type = "button";
    var file = document.createElement("input"); file.type = "file"; file.accept = "image/jpeg,image/png,image/gif,image/webp"; file.style.display = "none";
    function sel2(opts, cur) {
      var s = document.createElement("select"); s._o = {};
      opts.forEach(function (p) { var o = el("option", null, p[1]); o.value = p[0]; s.appendChild(o); s._o[p[0]] = o; });
      s.value = cur; return s;
    }
    var ta = sel2([["left", "слева"], ["center", "по центру"], ["right", "справа"]], "left");
    var ba = sel2([["left", "слева"], ["center", "по центру"], ["right", "справа"], ["justify", "по ширине"]], "left");
    var pr = document.createElement("input"); pr.type = "range"; pr.min = "0"; pr.max = "8"; pr.step = "0.5"; pr.value = "3";
    tools.appendChild(bPlate); tools.appendChild(bImg); tools.appendChild(file);
    tools.appendChild(el("span", "lab", "заголовок")); tools.appendChild(ta);
    tools.appendChild(el("span", "lab", "текст")); tools.appendChild(ba);
    tools.appendChild(el("span", "lab", "поля")); tools.appendChild(pr);
    var note = el("div", "kql-note"); note.style.width = "100%";
    tools.appendChild(note);

    var st = el("div", "kql-tools-sel");
    var stLab = el("span", "lab", "");
    var mSel = sel2(MODES.map(function (m) { return [m, MODE_LABELS[m]]; }), "square");
    var sideBtns = SIDES.map(function (s) { var b = el("button", null, s === "left" ? "⟵" : (s === "right" ? "⟶" : "⇔")); b.type = "button"; b.title = s === "left" ? "слева" : (s === "right" ? "справа" : "по центру"); b.setAttribute("data-side", s); return b; });
    var bSm = el("button", null, "−"), bPl = el("button", null, "+");
    var padLab = el("span", "lab", "отступ");
    var padR = document.createElement("input"); padR.type = "range"; padR.min = "0"; padR.max = "8"; padR.step = "0.5";
    var bRl = el("button", null, "↺"), bRr = el("button", null, "↻"), bFx = el("button", null, "↔"), bFy = el("button", null, "↕");
    var plText = document.createElement("input"); plText.type = "text"; plText.maxLength = 600; plText.placeholder = "текст плашки";
    var plBg = sel2([["solid", "сплошной"], ["glass", "стекло"], ["gradient", "градиент"]], "solid");
    var plCol = document.createElement("input"); plCol.type = "color"; plCol.value = "#f0c9d6";
    var plFg = document.createElement("input"); plFg.type = "color"; plFg.value = "#1a0f14";
    var bDel = el("button", null, "✕ удалить");
    [bSm, bPl, bRl, bRr, bFx, bFy, bDel].forEach(function (b) { b.type = "button"; });
    st.appendChild(stLab); st.appendChild(mSel); sideBtns.forEach(function (b) { st.appendChild(b); });
    st.appendChild(bSm); st.appendChild(bPl); st.appendChild(padLab); st.appendChild(padR);
    [bRl, bRr, bFx, bFy].forEach(function (b) { st.appendChild(b); });
    st.appendChild(plText); st.appendChild(plBg); st.appendChild(plCol); st.appendChild(plFg); st.appendChild(bDel);
    box.parentNode.insertBefore(tools, box);
    box.parentNode.insertBefore(st, box);

    function say(t) { note.textContent = t || ""; }
    function imgCount() { return objs.filter(function (o) { return o.type === "image" || o.type === "media"; }).length; }

    function syncTools() {
      var o = selObj();
      st.classList.toggle("on", !!o);
      if (!o) return;
      stLab.textContent = ({ media: "фото / GIF", image: "фото / GIF", sticker: "стикер", plate: "плашка" })[o.type];
      mSel.value = o.mode;
      var floatMode = o.mode === "square" || o.mode === "contour";
      sideBtns.forEach(function (b) {
        var s = b.getAttribute("data-side");
        b.classList.toggle("on", o.side === s);
        b.disabled = isFree(o) || (floatMode && s === "center");
      });
      padR.value = String(o.pad); padR.disabled = isFree(o);
      var stk = o.type === "sticker", pl = o.type === "plate";
      [bRl, bRr, bFx, bFy].forEach(function (b) { b.style.display = stk ? "" : "none"; });
      [plText, plBg, plCol, plFg].forEach(function (b) { b.style.display = pl ? "" : "none"; });
      if (pl) { plText.value = o.text || ""; plBg.value = o.plate.bg; plCol.value = o.plate.color; plFg.value = o.plate.fg; }
      mSel._o.contour.disabled = !(o.type === "media" || o.type === "image");
    }

    function currentLayout() {
      var s = sizes();
      return buildLayout(meta(), { titleSize: s.titleSize, bodySize: s.bodySize, titleAlign: prefs.titleAlign, bodyAlign: prefs.bodyAlign, pad: prefs.pad, objs: objs });
    }

    function ensureMedia() {
      var url = meta().mediaUrl;
      var m = byId("m0");
      if (url && !m) {
        m = { id: "m0", type: "media", mode: "square", side: "right", anchor: 0, x: 60, y: 6, w: 34, pad: 2, src: url, ar: 1.5 };
        objs.unshift(m);
        measureImage(url, m);
      } else if (!url && m) { objs.splice(objs.indexOf(m), 1); if (sel === "m0") sel = null; }
      else if (m && m.src !== url) { m.src = url; measureImage(url, m); }
    }
    function measureImage(url, o) {
      var im = new Image();
      im.onload = function () { if (im.naturalWidth && im.naturalHeight) { o.ar = r2(Math.max(0.1, Math.min(10, im.naturalWidth / im.naturalHeight))); refresh(); } };
      if (g.KQMedia) g.KQMedia.resolve(url).then(function (resolved) { if (resolved) im.src = resolved; });
      else im.src = url;
    }

    function refresh() {
      if (!box.isConnected) return;
      ensureMedia();
      var L = currentLayout();
      render(box, L, { edit: true, onDown: startDrag, afterLoad: function () { clampFree(box); } });
      var e = sel && box.querySelector('.kql-o[data-id="' + sel + '"]');
      if (e) e.classList.add("sel"); else if (sel && !byId(sel)) sel = null;
      syncTools();
    }

    function relPos(e) {
      var card = box.querySelector(".kql-card"), cr = card.getBoundingClientRect(), r = e.getBoundingClientRect(), u = cr.width / 100;
      return { x: (r.left - cr.left) / u, y: (r.top - cr.top) / u };
    }
    function nearestAnchor(clientY) {
      var ps = [].slice.call(box.querySelectorAll(".kql-p")), a = ps.length, ty = null;
      for (var i = 0; i < ps.length; i++) {
        var r = ps[i].getBoundingClientRect();
        if (clientY < r.top + r.height / 2) { a = i; ty = r.top; break; }
        ty = r.bottom;
      }
      return { anchor: a, y: ty };
    }
    function sideFor(o, clientX) {
      var r = box.getBoundingClientRect(), f = (clientX - r.left) / r.width;
      if (o.mode === "square" || o.mode === "contour") return f < 0.5 ? "left" : "right";
      return f < 0.33 ? "left" : (f > 0.66 ? "right" : "center");
    }

    function startDrag(ev, o, viaHandle) {
      if (ev.pointerType !== "mouse" && !viaHandle) { sel = o.id; refresh(); return; }   // на сенсорных — перетаскивание за ручку ✥
      ev.preventDefault();
      sel = o.id;
      var node = box.querySelector('.kql-o[data-id="' + o.id + '"]');
      if (!node) return;
      var cardR = box.querySelector(".kql-card").getBoundingClientRect(), u = cardR.width / 100;
      var er = node.getBoundingClientRect(), offX = ev.clientX - er.left, offY = ev.clientY - er.top;
      var sx = ev.clientX, sy = ev.clientY, moved = false, mark = null, tgt = null;
      node.classList.add("sel");
      function mv(e) {
        if (!moved && Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) < 4) return;
        moved = true;
        if (isFree(o)) {
          var w = node.offsetWidth / u, h = node.offsetHeight / u, H = cardR.height / u;
          o.x = r2(Math.max(0, Math.min(100 - w, (e.clientX - offX - cardR.left) / u)));
          o.y = r2(Math.max(0, Math.min(H - h, (e.clientY - offY - cardR.top) / u)));
          node.style.setProperty("--x", String(o.x)); node.style.setProperty("--y", String(o.y));
        } else {
          tgt = nearestAnchor(e.clientY); tgt.side = sideFor(o, e.clientX);
          if (!mark) { mark = el("div", "kql-mark"); box.querySelector(".kql-card").appendChild(mark); }
          var top = (tgt.y == null ? box.querySelector(".kql-body").getBoundingClientRect().top : tgt.y) - box.querySelector(".kql-card").getBoundingClientRect().top;
          mark.style.top = Math.max(0, top) + "px";
        }
      }
      function up() {
        window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
        if (moved && tgt && !isFree(o)) { o.anchor = tgt.anchor; o.side = tgt.side; }
        refresh();    // результат сразу виден так, как будет в опубликованном посте
      }
      window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    }

    /* действия панели */
    function setMode(o, mode) {
      var wasFree = isFree(o), node = box.querySelector('.kql-o[data-id="' + o.id + '"]');
      if (mode === "contour" && !(o.type === "media" || o.type === "image")) mode = "square";
      if (!wasFree && FREE[mode] && node) { var p = relPos(node); o.x = r2(Math.max(0, Math.min(95, p.x))); o.y = r2(Math.max(0, p.y)); }
      if (wasFree && !FREE[mode] && node) {
        var r = node.getBoundingClientRect(); var a = nearestAnchor(r.top + r.height / 2); o.anchor = a.anchor;
        o.side = sideFor(o, r.left + r.width / 2);
      }
      if ((mode === "square" || mode === "contour") && o.side === "center") o.side = "right";
      o.mode = mode;
    }
    mSel.onchange = function () { var o = selObj(); if (o) { setMode(o, mSel.value); refresh(); } };
    sideBtns.forEach(function (b) { b.onclick = function () { var o = selObj(); if (o && !b.disabled) { o.side = b.getAttribute("data-side"); refresh(); } }; });
    function scale(dir) {
      var o = selObj(); if (!o) return;
      if (o.type === "sticker") o.fs = r2(Math.max(0.8, Math.min(12, o.fs * (dir > 0 ? 1.15 : 1 / 1.15))));
      else o.w = r2(Math.max(8, Math.min(100, o.w + dir * 4)));
      refresh();
    }
    bSm.onclick = function () { scale(-1); }; bPl.onclick = function () { scale(1); };
    padR.oninput = function () { var o = selObj(); if (o) { o.pad = Number(padR.value); refresh(); } };
    bRl.onclick = function () { var o = selObj(); if (o) { o.rot = (o.rot || 0) - 15; refresh(); } };
    bRr.onclick = function () { var o = selObj(); if (o) { o.rot = (o.rot || 0) + 15; refresh(); } };
    bFx.onclick = function () { var o = selObj(); if (o) { o.fx = -(o.fx || 1); refresh(); } };
    bFy.onclick = function () { var o = selObj(); if (o) { o.fy = -(o.fy || 1); refresh(); } };
    plText.oninput = function () { var o = selObj(); if (o && o.plate) { o.text = plText.value; refresh(); } };
    plBg.onchange = function () { var o = selObj(); if (o && o.plate) { o.plate.bg = plBg.value; refresh(); } };
    plCol.oninput = function () { var o = selObj(); if (o && o.plate) { o.plate.color = plCol.value; refresh(); } };
    plFg.oninput = function () { var o = selObj(); if (o && o.plate) { o.plate.fg = plFg.value; refresh(); } };
    bDel.onclick = function () {
      var o = selObj(); if (!o) return;
      if (o.id === "m0") { var u = document.getElementById("compose-media-url"); if (u) { u.value = ""; u.dispatchEvent(new Event("input")); } }
      objs.splice(objs.indexOf(o), 1); sel = null; refresh();
    };
    ta.onchange = function () { prefs.titleAlign = ta.value; refresh(); };
    ba.onchange = function () { prefs.bodyAlign = ba.value; refresh(); };
    pr.oninput = function () { prefs.pad = Number(pr.value); refresh(); };
    box.addEventListener("pointerdown", function (e) { if (e.target === box || e.target.classList.contains("kql-card") || e.target.classList.contains("kql-body")) { sel = null; refresh(); } });

    bPlate.onclick = function () {
      if (objs.length >= MAX_OBJS) { say("слишком много объектов"); return; }
      var o = { id: nid(), type: "plate", mode: "square", side: "left", anchor: 0, x: 8, y: 8, w: 40, pad: 2, text: "Текст плашки", plate: { bg: "solid", color: "#f0c9d6", fg: "#1a0f14" } };
      objs.push(o); sel = o.id; refresh();
    };
    bImg.onclick = function () { file.click(); };
    file.onchange = async function () {
      var f = file.files && file.files[0]; file.value = ""; say("");
      if (!f) return;
      if (!EXT[f.type]) { say("допустимы JPG, PNG, GIF и WebP"); return; }
      if (f.size > MAX_BYTES) { say("файл больше 8 МБ"); return; }
      if (imgCount() >= MAX_IMG || objs.length >= MAX_OBJS) { say("достигнут лимит объектов"); return; }
      var sb = sbc(); if (!sb) { say("нет подключения"); return; }
      var s = await sb.auth.getSession(); var sess = s && s.data && s.data.session;
      if (!sess) { say("нужен вход"); return; }
      say("загрузка…");
      var path = sess.user.id + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + "." + EXT[f.type];
      var up = await sb.storage.from("media").upload(path, f, { upsert: false, contentType: f.type });
      if (up.error) { say("не удалось загрузить файл"); return; }
      var url = sb.storage.from("media").getPublicUrl(path).data.publicUrl;
      var o = { id: nid(), type: "image", mode: "square", side: "left", anchor: 0, x: 8, y: 8, w: 34, pad: 2, src: url, ar: 1.5 };
      objs.push(o); sel = o.id; say(""); measureImage(url, o); refresh();
    };

    function addSticker(id, text) {
      if (objs.length >= MAX_OBJS || !text) return;
      var o = { id: nid(), type: "sticker", sid: id != null ? String(id) : "", text: String(text).slice(0, 2000), mode: "square", side: "right", anchor: 0, x: 60, y: 8, w: 0, pad: 2, fs: 3, rot: 0, fx: 1, fy: 1 };
      objs.push(o); sel = o.id; refresh();
    }
    function decor() {
      var s = sizes();
      ensureMedia();
      return g.KQMedia ? g.KQMedia.canonicalize({ v: 3, titleSize: s.titleSize, bodySize: s.bodySize, titleAlign: prefs.titleAlign, bodyAlign: prefs.bodyAlign, pad: prefs.pad, objs: currentLayout().objs }) : { v: 3, titleSize: s.titleSize, bodySize: s.bodySize, titleAlign: prefs.titleAlign, bodyAlign: prefs.bodyAlign, pad: prefs.pad, objs: currentLayout().objs };
    }
    function reset() { objs = []; sel = null; prefs = { titleAlign: "left", bodyAlign: "left", pad: 3 }; if (ta) ta.value = "left"; if (ba) ba.value = "left"; if (pr) pr.value = "3"; refresh(); }
    function load(d) {
      try { if (typeof d === "string") d = JSON.parse(d); } catch (e) { d = null; }
      objs = []; sel = null;
      if (d && d.v === 3) {
        prefs.titleAlign = oneOf(d.titleAlign, ["left", "center", "right"], "left");
        prefs.bodyAlign = oneOf(d.bodyAlign, ["left", "center", "right", "justify"], "left");
        prefs.pad = num(d.pad, 3, 0, 8);
        if (ta) ta.value = prefs.titleAlign;
        if (ba) ba.value = prefs.bodyAlign;
        if (pr) pr.value = String(prefs.pad);
        var ts = document.getElementById("compose-title-size");
        var bs = document.getElementById("compose-body-size");
        if (ts && d.titleSize != null) ts.value = d.titleSize;
        if (bs && d.bodySize != null) bs.value = d.bodySize;
        objs = (Array.isArray(d.objs) ? d.objs : []).slice(0, MAX_OBJS).map(cleanObj).filter(Boolean);
      }
      refresh();
    }

    compose = { refresh: refresh, addSticker: addSticker, decor: decor, reset: reset, load: load, _objs: function () { return objs; } };
    g.KQL.compose = compose;
    ["compose-title", "compose-content", "compose-title-font", "compose-body-font", "compose-title-color", "compose-body-color", "compose-media-url", "compose-title-size", "compose-body-size"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) { e.addEventListener("input", refresh); e.addEventListener("change", refresh); }
    });
    // ползунки размера notes.html создаёт динамически — подпишемся и на них, когда появятся
    var tries = 0;
    (function late() {
      ["compose-title-size", "compose-body-size"].forEach(function (id) {
        var e = document.getElementById(id);
        if (e && !e._kql) { e._kql = 1; e.addEventListener("input", refresh); }
      });
      if (++tries < 20) setTimeout(late, 250);
    })();
    refresh();
  }

  g.KQL = { render: render, fromPost: fromPost, hasLayout: function (p) { return !!fromPost(p); }, attachCompose: attachCompose, compose: null,
    _test: { cleanObj: cleanObj, buildLayout: buildLayout, MODES: MODES } };

  /* прежние глобальные вызовы редактора стикеров/доски перенаправляются на новый механизм (старая «доска» фиксированной высоты отключена).
     Делается на DOMContentLoaded — когда все скрипты страницы (в т.ч. kinqsy-stickers.js, который задаёт эти функции) уже выполнены. */
  function viaCompose() { if (g.KQL.compose) g.KQL.compose.refresh(); }
  function installOverrides() {
    g.kqSyncBoard = viaCompose; g.kqInitBoard = viaCompose; g.kqUpdateBoardText = viaCompose; g.kqPaintStickers = viaCompose;
    g.kqAddSticker = function (id, text) { if (g.KQL.compose) g.KQL.compose.addSticker(id, text); };
    g.kqDecorPayload = function () { return g.KQL.compose ? g.KQL.compose.decor() : []; };
  }
  function boot() { installOverrides(); attachCompose(); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);

