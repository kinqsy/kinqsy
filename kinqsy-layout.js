/* Kinqsy · Notes · общая раскладка поста.
   ОДИН механизм показа (KQL.render) используется и в предпросмотре при создании, и в опубликованном посте — поэтому они совпадают.
   Модель decor v3: { v:3, canvas?, height?, titleSize, bodySize, titleAlign, bodyAlign, pad, objs:[ ... ] }.
   Notes создаёт свободный холст; существующие v3-макеты сохраняют режим обтекания до явного перевода.
   Объекты text поддерживают role:title/body (текст из posts), собственные font/color/size/align/bold/italic.
   Для всех объектов сохраняются locked и z; X/Y/ширина измеряются в долях ширины карточки.
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
    var type = oneOf(r.type, ["media", "image", "sticker", "plate", "text"], null);
    if (!type) return null;
    var o = {
      id: String(r.id || "").replace(/[^\w\-]/g, "").slice(0, 40) || ("o" + Math.random().toString(36).slice(2, 8)),
      type: type,
      mode: oneOf(r.mode, MODES, "square"),
      side: oneOf(r.side, SIDES, "right"),
      anchor: Math.round(num(r.anchor, 0, 0, 5000)),
      x: r2(num(r.x, 5, 0, 100)), y: r2(num(r.y, 5, 0, 1000)),
      w: r2(num(r.w, type === "plate" ? 40 : 30, 5, 100)),
      pad: r2(num(r.pad, 2, 0, 8)),
      locked: r.locked === true, z: Math.round(num(r.z, 0, 0, 1000))
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
    } else if (type === "text") {
      o.text = String(r.text == null ? "" : r.text).slice(0, 50000);
      o.role = oneOf(r.role, ["title", "body"], "");
      o.font = safeFont(r.font); o.color = safeColor(r.color, "#1a0f14");
      o.size = num(r.size, 16, 10, 80); o.align = oneOf(r.align, ["left","center","right","justify"], "left");
      o.bold = r.bold === true; o.italic = r.italic === true;
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
      objs: objs, canvas: d.canvas === true, height: num(d.height, 70, 0, 1200),
      // 70 was the generated workspace default, not an explicit publication size.
      heightMode: d.heightMode === "fixed" || (!d.heightMode && d.height != null && Number(d.height) !== 70) ? "fixed" : "auto"
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
    e.style.zIndex = String(o.z);
    e.classList.toggle("locked", o.locked);
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
    } else if (o.type === "text") {
      e.textContent = o.role === "title" ? L.title : o.role === "body" ? L.text : o.text;
      if (!e.textContent && opt.edit) e.textContent = o.role === "title" ? "заголовок…" : "текст…";
      if (!e.textContent && !opt.edit) e.hidden = true;
      e.style.fontFamily = o.role === "title" ? L.titleFont : o.role === "body" ? L.bodyFont : o.font;
      e.style.color = o.role === "title" ? L.titleColor : o.role === "body" ? L.bodyColor : o.color;
      e.style.fontSize = ((o.role === "title" ? L.ts : o.role === "body" ? L.bs : o.size / REF)) + "cqw";
      e.style.textAlign = o.role === "title" ? L.titleAlign : o.role === "body" ? L.bodyAlign : o.align;
      e.style.fontWeight = o.bold ? "bold" : "normal"; e.style.fontStyle = o.italic ? "italic" : "normal";
    } else {
      e.classList.add(o.plate.bg);
      e.style.setProperty("--pbg", o.plate.color);
      e.style.color = o.plate.fg;
      e.style.fontFamily = L.bodyFont;
      e.textContent = o.text || (opt.edit ? "текст плашки…" : "");
    }
    if (!opt.edit && o.type === "text" && !e.textContent) e.hidden = true;
    if (opt.edit) {
      var hnd = el("div", "kql-h", "✥"); hnd.title = "перетащить";
      hnd.addEventListener("pointerdown", function (ev) { opt.onDown(ev, o, true); });
      e.appendChild(hnd);
      var resize = el("button", "kql-resize", "↘"); resize.type = "button"; resize.title = "изменить размер";
      resize.setAttribute("aria-label", "Изменить размер объекта");
      resize.addEventListener("pointerdown", function(ev) { ev.stopPropagation(); opt.onResize(ev, o); });
      e.appendChild(resize);
      e.addEventListener("pointerdown", function (ev) { if (ev.target === hnd || ev.target === resize) return; opt.onDown(ev, o, false); });
    }
    return e;
  }

  function clampFree(host) {
    var card = host.querySelector(".kql-card");
    if (!card || !card.clientWidth) return;
    var unit = card.clientWidth / 100;
    // Measure natural flow first, so shrinking text also shrinks the publication.
    card.style.minHeight = "0px";
    var cardRect = card.getBoundingClientRect(), bottom = card.offsetHeight;
    host.querySelectorAll(".kql-o").forEach(function(e) {
      if (!e.getClientRects().length || e.hidden) return;
      var rect = e.getBoundingClientRect();
      bottom = Math.max(bottom, rect.bottom - cardRect.top + Number(card.dataset.pad) * unit);
      // The transformed ASCII pre can extend beyond its unrotated wrapper.
      var pre = e.querySelector("pre");
      if (pre) bottom = Math.max(bottom, pre.getBoundingClientRect().bottom - cardRect.top + Number(card.dataset.pad) * unit);
    });
    var explicit = card.dataset.heightMode === "fixed" ? Number(card.dataset.height) * unit : 0;
    var workspace = host.classList.contains("kql-edit") && card.classList.contains("kql-canvas") ? 70 * unit : 0;
    card.style.minHeight = Math.ceil(Math.max(bottom, explicit, workspace)) + "px";
  }

  function render(host, L, opt) {
    opt = opt || {};
    host.innerHTML = "";
    host.classList.add("kql");
    host.classList.toggle("kql-edit", !!opt.edit);
    var card = el("div", "kql-card");
    card.classList.toggle("kql-canvas", L.canvas);
    card.dataset.height = String(L.height);
    card.dataset.heightMode = L.heightMode; card.dataset.pad = String(L.kp);
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
    if (L.objs.some(function(o) { return o.role === "title"; })) title.hidden = true;
    if (L.objs.some(function(o) { return o.role === "body"; })) body.querySelectorAll(".kql-p").forEach(function(p) { p.hidden = true; });
    card.appendChild(title); card.appendChild(body); card.appendChild(back); card.appendChild(front);
    host.appendChild(card);
    var again = function () { clampFree(host); };
    if (opt.afterLoad === undefined) opt.afterLoad = again;
    again();
    if (document.fonts) document.fonts.ready.then(function(){ if(host.isConnected) again(); });
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
    box.classList.remove("kq-board", "kq-flow", "kq-sticker-canvas");
    box.classList.add("kql-box");
    var sbc = function () { return g.__kinqsy_sb || null; };
    var objs = [], sel = null, uidSeq = 0;
    var notesCanvas = !!document.querySelector("#compose-overlay[data-kql-free]");
    var prefs = { titleAlign: "left", bodyAlign: "left", pad: 3, canvas: notesCanvas, height: 70, heightMode: "auto" };

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
    function appendObject(o) { o.z=objs.reduce(function(z,p){return Math.max(z,Number(p.z)||0);},0)+1; objs.push(o); }

    /* панель инструментов */
    var tools = el("div", "kql-tools");
    var bText = el("button", null, "+ текст"); bText.type = "button";
    var bCanvas = el("button", null, "свободный холст"); bCanvas.type = "button";
    var bCatalog = el("button", null, "каталог"); bCatalog.type = "button";
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
    tools.appendChild(bCanvas); tools.appendChild(bText); tools.appendChild(bCatalog); tools.appendChild(bPlate); tools.appendChild(bImg); tools.appendChild(file);
    var objectPicker = sel2([["", "выбрать объект"]], ""); objectPicker.className="kql-object-picker";
    objectPicker.setAttribute("aria-label","Выбрать объект композиции"); tools.appendChild(objectPicker);
    objectPicker.onchange=function(){sel=objectPicker.value || null;refresh();};
    tools.appendChild(el("span", "lab", "заголовок")); tools.appendChild(ta);
    tools.appendChild(el("span", "lab", "текст")); tools.appendChild(ba);
    tools.appendChild(el("span", "lab", "поля")); tools.appendChild(pr);
    var note = el("div", "kql-note"); note.style.width = "100%";
    tools.appendChild(note);

    var documentOptions = el("details", "kql-document-options");
    documentOptions.appendChild(el("summary", null, "параметры композиции"));
    [bCanvas,ta.previousSibling,ta,ba.previousSibling,ba,pr.previousSibling,pr].forEach(function(e){ documentOptions.appendChild(e); });
    var heightMode = sel2([["auto","высота по содержимому"],["fixed","минимальная высота"]],"auto");
    heightMode.setAttribute("aria-label","Режим высоты композиции");
    var heightValue = document.createElement("input"); heightValue.type="number";heightValue.min="0";heightValue.max="1200";heightValue.step="1";heightValue.value="70";
    heightValue.setAttribute("aria-label","Минимальная высота в процентах ширины");
    documentOptions.appendChild(heightMode);documentOptions.appendChild(heightValue);tools.appendChild(documentOptions);
    heightMode.onchange=function(){prefs.heightMode=heightMode.value;refresh();};
    heightValue.onchange=function(){prefs.height=num(heightValue.value,70,0,1200);prefs.heightMode="fixed";refresh();};
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
    var bFront = el("button", null, "на передний план"), bBack = el("button", null, "на задний план"), bLock = el("button", null, "заблокировать");
    [bFront,bBack,bLock].forEach(function(b) { b.type = "button"; st.appendChild(b); });
    function coord(label, max) {
      var lab = el("label", "kql-coordinate", label), input = document.createElement("input");
      input.type = "number"; input.min = "0"; input.max = String(max); input.step = "0.1";
      input.setAttribute("aria-label", label); lab.appendChild(input); st.appendChild(lab); return input;
    }
    var cx = coord("X",100), cy = coord("Y",1000), cw = coord("ширина",100);
    var textEdit = document.createElement("textarea"); textEdit.setAttribute("aria-label", "Текст объекта"); textEdit.maxLength = 50000;
    var textFont = sel2([["Georgia, serif","Georgia"],["Arial, sans-serif","Arial"],["ui-monospace, monospace","моноширинный"]],"Georgia, serif");
    textFont.setAttribute("aria-label","Шрифт объекта");
    var textSize = document.createElement("input"); textSize.type = "number"; textSize.min = "10"; textSize.max = "80"; textSize.setAttribute("aria-label","Размер текста");
    var textAlign = sel2([["left","слева"],["center","центр"],["right","справа"],["justify","по ширине"]],"left");
    var textColor = document.createElement("input"); textColor.type="color"; textColor.setAttribute("aria-label","Цвет текста");
    var bBold = el("button",null,"жирный"), bItalic = el("button",null,"курсив"); bBold.type=bItalic.type="button";
    [textEdit,textFont,textSize,textAlign,textColor,bBold,bItalic].forEach(function(e){ st.appendChild(e); });
    st.appendChild(stLab); st.appendChild(mSel); sideBtns.forEach(function (b) { st.appendChild(b); });
    st.appendChild(bSm); st.appendChild(bPl); st.appendChild(padLab); st.appendChild(padR);
    [bRl, bRr, bFx, bFy].forEach(function (b) { st.appendChild(b); });
    st.appendChild(plText); st.appendChild(plBg); st.appendChild(plCol); st.appendChild(plFg); st.appendChild(bDel);
    var advanced = el("details", "kql-advanced"); advanced.appendChild(el("summary", null, "расширенные настройки"));
    var advancedBody = el("div", "kql-advanced-body"); advanced.appendChild(advancedBody);
    [].slice.call(st.children).forEach(function(e){ if([stLab,bSm,bPl,bDel,textEdit].indexOf(e)<0) advancedBody.appendChild(e); });
    st.appendChild(advanced);
    bSm.title="уменьшить объект";bPl.title="увеличить объект";
    var advancedSelection = null;
    box.parentNode.insertBefore(tools, box);
    box.parentNode.insertBefore(st, box);

    function say(t) { note.textContent = t || ""; }
    function imgCount() { return objs.filter(function (o) { return o.type === "image" || o.type === "media"; }).length; }

    function syncTools() {
      heightMode.value=prefs.heightMode; heightValue.value=prefs.height; heightValue.hidden=prefs.heightMode!=="fixed";
      if(advancedSelection!==sel){advanced.open=false;advancedSelection=sel;}
      objectPicker.innerHTML=""; var placeholder=el("option",null,"выбрать объект"); placeholder.value="";objectPicker.appendChild(placeholder);
      objs.forEach(function(o,i){var option=el("option",null,(i+1)+" · "+(o.role || o.type)+(o.locked ? " · заблокирован" : ""));option.value=o.id;objectPicker.appendChild(option);});objectPicker.value=sel || "";
      bCanvas.hidden = prefs.canvas; bText.hidden = false; bCatalog.hidden = false;
      var o = selObj();
      st.classList.toggle("on", !!o);
      if (!o) return;
      st.querySelectorAll("button,input,select,textarea").forEach(function(e){ e.disabled = false; });
      stLab.textContent = ({ media: "фото / GIF", image: "фото / GIF", sticker: "стикер", plate: "плашка", text: "текст" })[o.type];
      mSel.value = o.mode;
      bLock.textContent = o.locked ? "разблокировать" : "заблокировать";
      bLock.setAttribute("aria-pressed", String(o.locked));
      cx.value = o.x; cy.value = o.y; cw.value = o.w;
      cx.disabled = cy.disabled = !isFree(o);
      var txt = o.type === "text";
      [textEdit,textFont,textSize,textAlign,textColor,bBold,bItalic].forEach(function(e){e.style.display=txt ? "" : "none";});
      if (txt) {
        var M=meta(), S=sizes();
        textEdit.value=o.role === "title" ? M.title : o.role === "body" ? M.text : o.text;
        textFont.value=o.role === "title" ? M.titleFont : o.role === "body" ? M.bodyFont : o.font;
        textSize.value=o.role === "title" ? S.titleSize : o.role === "body" ? S.bodySize : o.size;
        textColor.value=o.role === "title" ? M.titleColor : o.role === "body" ? M.bodyColor : o.color;
        textAlign.value=o.role === "title" ? prefs.titleAlign : o.role === "body" ? prefs.bodyAlign : o.align;
        bBold.classList.toggle("on",o.bold); bItalic.classList.toggle("on",o.italic);
      }
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
      st.querySelectorAll("button,input,select,textarea").forEach(function(e) { if (e !== bLock && o.locked) e.disabled = true; });
      bCanvas.hidden = prefs.canvas; bText.hidden = false;
      bCatalog.hidden = false;
    }

    function currentLayout() {
      var s = sizes();
      return buildLayout(meta(), { titleSize: s.titleSize, bodySize: s.bodySize, titleAlign: prefs.titleAlign, bodyAlign: prefs.bodyAlign, pad: prefs.pad, canvas: prefs.canvas, height: prefs.height, heightMode: prefs.heightMode, objs: objs });
    }

    function ensureMedia() {
      var url = meta().mediaUrl;
      var m = byId("m0");
      if (url && !m) {
        m = { id: "m0", type: "media", mode: prefs.canvas ? "front" : "square", side: "right", anchor: 0, x: 60, y: 6, w: 34, pad: 2, src: url, ar: 1.5 };
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
      render(box, L, { edit: true, onDown: startDrag, onResize: startResize, afterLoad: function () { clampFree(box); } });
      var e = sel && box.querySelector('.kql-o[data-id="' + sel + '"]');
      if (e) e.classList.add("sel"); else if (sel && !byId(sel)) sel = null;
      clampFree(box);
      syncTools();
      document.dispatchEvent(new CustomEvent("kq-compose-change"));
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
      o = byId(o.id); if (!o) return;
      if (ev.button != null && ev.button !== 0) return;
      if (o.locked) { sel=o.id; refresh(); return; }
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
          var w = node.offsetWidth / u, h = node.offsetHeight / u, H = prefs.canvas ? 1000 + h : cardR.height / u;
          o.x = r2(Math.max(0, Math.min(100 - w, (e.clientX - offX - cardR.left) / u)));
          o.y = r2(Math.max(0, Math.min(H - h, (e.clientY - offY - cardR.top) / u)));
          node.style.setProperty("--x", String(o.x)); node.style.setProperty("--y", String(o.y));
          clampFree(box);
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

    function startResize(ev, obj) {
      var o=byId(obj.id); if (!o || o.locked || (ev.button != null && ev.button !== 0)) return;
      ev.preventDefault(); sel=o.id;
      var node=box.querySelector('[data-id="'+o.id+'"]'), unit=box.querySelector(".kql-card").clientWidth/100;
      var start=ev.clientX, width=o.w, font=o.fs;
      function move(e) {
        o.w=r2(num(width+(e.clientX-start)/unit,width,5,100-o.x));
        if (o.type === "sticker") o.fs=r2(num(font*o.w/width,font,0.8,12));
        node.style.setProperty("--w",o.w); if (o.type === "sticker") node.style.setProperty("--fs",o.fs);
        clampFree(box);
      }
      function done(){ window.removeEventListener("pointermove",move); window.removeEventListener("pointerup",done); window.removeEventListener("pointercancel",done); refresh(); }
      window.addEventListener("pointermove",move); window.addEventListener("pointerup",done); window.addEventListener("pointercancel",done);
    }
    function textObject(role, x, y, w) {
      return cleanObj({id:nid(),type:"text",role:role,text:"текст",mode:"front",x:x,y:y,w:w,z:objs.length+1});
    }
    function seedText() { objs.push(textObject("title",3,3,94),textObject("body",3,12,94)); }
    function convertCanvas() {
      if (prefs.canvas) return;
      if (objs.length > MAX_OBJS-2) { say("Для перевода на холст нужны два свободных места для заголовка и текста"); return; }
      var positions={};
      objs.forEach(function(o) { var n=box.querySelector('[data-id="'+o.id+'"]'); if(n) positions[o.id]=relPos(n); });
      var t=box.querySelector(".kql-title"), b=box.querySelector(".kql-body"), tp=t && relPos(t), bp=b && relPos(b);
      objs.forEach(function(o,i){ var p=positions[o.id]; if(p){o.x=r2(p.x);o.y=r2(p.y);} o.mode="front";o.z=i+1; });
      prefs.height=Math.max(70,box.querySelector(".kql-card").clientHeight/(box.clientWidth/100)); prefs.canvas=true;
      seedText(); if(tp){objs[objs.length-2].x=tp.x;objs[objs.length-2].y=tp.y;} if(bp){objs[objs.length-1].x=bp.x;objs[objs.length-1].y=bp.y;}
    }
    bCanvas.onclick=function(){ if(objs.length>MAX_OBJS-2){say("Нет места для двух текстовых блоков");return;} convertCanvas();refresh(); };
    bText.onclick=function(){ if(objs.length>=(prefs.canvas ? MAX_OBJS : MAX_OBJS-2)){say("слишком много объектов");return;} if(!prefs.canvas) convertCanvas(); if(objs.length>=MAX_OBJS)return; var o=textObject("",8,20,45);appendObject(o);sel=o.id;refresh(); };
    bCatalog.onclick=function(){ var dock=document.getElementById("kq-sticker-pop"); if(dock && dock.style.display !== "none"){dock.style.display="none";bCatalog.setAttribute("aria-expanded","false");}else if(g.kqOpenStickerTray){g.kqOpenStickerTray();bCatalog.setAttribute("aria-expanded","true");} };
    bLock.onclick=function(){var o=selObj();if(o){o.locked=!o.locked;refresh();}};
    function layer(mode){ var o=selObj();if(!o||o.locked)return;setMode(o,mode);objs.forEach(function(p,i){p.z=i+1;});objs.splice(objs.indexOf(o),1); if(mode==="front")objs.push(o);else objs.unshift(o);objs.forEach(function(p,i){p.z=i+1;});refresh(); }
    bFront.onclick=function(){layer("front");}; bBack.onclick=function(){layer("behind");};
    [[cx,"x",0,100],[cy,"y",0,1000],[cw,"w",5,100]].forEach(function(p){p[0].onchange=function(){var o=selObj();if(!o||o.locked)return;var v=num(p[0].value,o[p[1]],p[2],p[3]);if(p[1]==="w"&&o.type==="sticker")o.fs=num(o.fs*v/o.w,o.fs,0.8,12);o[p[1]]=r2(v);refresh();};});
    function editText(field,value){var o=selObj();if(!o||o.type!=="text"||o.locked)return;
      if(o.role && ["text","font","size","color","align"].indexOf(field)>=0){
        var prefix=o.role==="title"?"title":"body", ids={text:o.role==="title"?"compose-title":"compose-content",font:"compose-"+prefix+"-font",size:"compose-"+prefix+"-size",color:"compose-"+prefix+"-color"};
        if(field==="align")prefs[prefix+"Align"]=value;else {var e=document.getElementById(ids[field]);if(e)e.value=value;}
      }else o[field]=value;refresh();}
    textEdit.onchange=function(){editText("text",textEdit.value);}; textFont.onchange=function(){editText("font",textFont.value);};
    textSize.onchange=function(){editText("size",num(textSize.value,16,10,80));};textAlign.onchange=function(){editText("align",textAlign.value);};textColor.onchange=function(){editText("color",textColor.value);};
    bBold.onclick=function(){var o=selObj();if(o)editText("bold",!o.bold);};bItalic.onclick=function(){var o=selObj();if(o)editText("italic",!o.italic);};
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
      var o = { id: nid(), type: "plate", mode: prefs.canvas ? "front" : "square", side: "left", anchor: 0, x: 8, y: 8, w: 40, pad: 2, text: "Текст плашки", plate: { bg: "solid", color: "#f0c9d6", fg: "#1a0f14" } };
      appendObject(o); sel = o.id; refresh();
    };
    bImg.onclick = function () { file.click(); };
    file.onchange = async function () {
      if (file.disabled) return;
      var f = file.files && file.files[0]; file.value = ""; say("");
      if (!f) return;
      if (!EXT[f.type]) { say("допустимы JPG, PNG, GIF и WebP"); return; }
      if (!f.size) { say("файл пуст"); return; }
      if (f.size > MAX_BYTES) { say("файл больше 8 МБ"); return; }
      if (imgCount() >= MAX_IMG || objs.length >= MAX_OBJS) { say("достигнут лимит объектов"); return; }
      file.disabled = true;
      try {
      var sb = sbc(); if (!sb) { say("нет подключения"); return; }
      var s = await sb.auth.getSession(); var sess = s && s.data && s.data.session;
      if (!sess) { say("нужен вход"); return; }
      say("загрузка…");
      var path = sess.user.id + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + "." + EXT[f.type];
      var up = await sb.storage.from("media").upload(path, f, { upsert: false, contentType: f.type });
      if (up.error) { say("не удалось загрузить файл"); return; }
      var url = sb.storage.from("media").getPublicUrl(path).data.publicUrl;
      var o = { id: nid(), type: "image", mode: prefs.canvas ? "front" : "square", side: "left", anchor: 0, x: 8, y: 8, w: 34, pad: 2, src: url, ar: 1.5 };
      appendObject(o); sel = o.id; say(""); measureImage(url, o); refresh();
      } catch (error) {
        say("Не удалось загрузить изображение. Проверь соединение и повтори.");
      } finally {
        file.disabled = false;
      }
    };

    function addSticker(id, text) {
      if (objs.length >= MAX_OBJS || !text) return;
      var o = { id: nid(), type: "sticker", sid: id != null ? String(id) : "", text: String(text).slice(0, 2000), mode: prefs.canvas ? "front" : "square", side: "right", anchor: 0, x: 60, y: 8, w: 30, pad: 2, fs: 3, rot: 0, fx: 1, fy: 1 };
      appendObject(o); sel = o.id; refresh();
    }
    function decor() {
      var s = sizes();
      ensureMedia();
      return g.KQMedia ? g.KQMedia.canonicalize({ v: 3, titleSize: s.titleSize, bodySize: s.bodySize, titleAlign: prefs.titleAlign, bodyAlign: prefs.bodyAlign, pad: prefs.pad, canvas: prefs.canvas, height: prefs.height, heightMode: prefs.heightMode, objs: currentLayout().objs }) : { v: 3, titleSize: s.titleSize, bodySize: s.bodySize, titleAlign: prefs.titleAlign, bodyAlign: prefs.bodyAlign, pad: prefs.pad, canvas: prefs.canvas, height: prefs.height, heightMode: prefs.heightMode, objs: currentLayout().objs };
    }
    function reset() { objs = []; sel = null; prefs = { titleAlign: "left", bodyAlign: "left", pad: 3, canvas: notesCanvas, height: 70, heightMode: "auto" }; if(notesCanvas)seedText(); if (ta) ta.value = "left"; if (ba) ba.value = "left"; if (pr) pr.value = "3"; refresh(); }
    function load(d) {
      prefs = {titleAlign:"left",bodyAlign:"left",pad:3,canvas:notesCanvas,height:70,heightMode:"auto"};
      try { if (typeof d === "string") d = JSON.parse(d); } catch (e) { d = null; }
      objs = []; sel = null;
      if (d && d.v === 3) {
        prefs.titleAlign = oneOf(d.titleAlign, ["left", "center", "right"], "left");
        prefs.bodyAlign = oneOf(d.bodyAlign, ["left", "center", "right", "justify"], "left");
        prefs.pad = num(d.pad, 3, 0, 8); prefs.canvas=d.canvas === true; prefs.height=num(d.height,70,0,1200); prefs.heightMode=buildLayout(meta(),d).heightMode;
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

    if(notesCanvas) seedText();
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
    g.kqPaintStickersOnBoard = viaCompose;
    g.kqSyncBoard = viaCompose; g.kqInitBoard = viaCompose; g.kqUpdateBoardText = viaCompose; g.kqPaintStickers = viaCompose;
    g.kqAddSticker = function (id, text) { if (g.KQL.compose) g.KQL.compose.addSticker(id, text); };
    g.kqDecorPayload = function () { return g.KQL.compose ? g.KQL.compose.decor() : []; };
  }
  function boot() { installOverrides(); attachCompose(); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
