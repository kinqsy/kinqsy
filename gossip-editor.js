/* Kinqsy · Gossip · редактор публикаций (журнальная страница) и безопасный показ.
   Модель: самостоятельные объекты (title / text / image / sticker) с собственными координатами и размерами.
   Все числа в «cqw» — процентах ширины холста, поэтому макет одинаково масштабируется на любой ширине.
   Макет хранится в posts.decor: { v: 2, h, bg, objects: [...] }.  Старые записи (без decor v2) показываются как раньше. */
(function (global) {
  "use strict";

  var BUCKET = "gossip-media";
  var FONTS = [
    ["georgia", "Georgia", "Georgia, serif"],
    ["rubik-beastly", "Rubik Beastly", "'Rubik Beastly', system-ui"],
    ["poiret", "Poiret One", "'Poiret One', sans-serif"],
    ["kaisei", "Kaisei Decol", "'Kaisei Decol', serif"],
    ["bad-script", "Bad Script", "'Bad Script', cursive"],
    ["alumni", "Alumni Sans Collegiate One", "'Alumni Sans Collegiate One', sans-serif"],
    ["rubik-fade", "Rubik 80s Fade", "'Rubik 80s Fade', system-ui"],
    ["climate", "Climate Crisis", "'Climate Crisis', sans-serif"],
    ["press-start", "Press Start 2P", "'Press Start 2P', monospace"],
    ["amatic", "Amatic SC", "'Amatic SC', cursive"],
    ["shafarik", "Shafarik", "'Shafarik', serif"]
  ];
  var FONT_CSS = {};
  FONTS.forEach(function (f) { FONT_CSS[f[0]] = f[2]; });

  var GAP = 1.2;            // минимальный зазор между объектами, cqw
  var MINH = 50, MAXH = 300; // высота холста, cqw
  var MAX_OBJ = 14, MAX_IMG = 5, MAX_BYTES = 5 * 1024 * 1024;
  var EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp" };
  var LIGHT = "#f4e3ea", DARK = "#2a1520";
  var REF_W = 8.6;   // 1 cqw = 8.6 px при ширине ленты 860 px: ползунки размера те же, что в Notes (заголовок 16–64, текст 12–28)
  var BG_CSS = {
    glass: "", pink: "rgba(240,201,214,.45)", lilac: "rgba(200,180,220,.4)",
    dark: "rgba(30,20,28,.55)", cream: "rgba(255,248,240,.5)", clear: "rgba(255,255,255,.08)"
  };
  var BG_LABELS = [["glass", "glass (по умолчанию)"], ["pink", "пыльно-розовый"], ["lilac", "сирень"], ["dark", "тёмный"], ["cream", "крем"], ["clear", "почти прозрачный"]];
  var LIGHT_BG = { pink: 1, lilac: 1, cream: 1 };
  var HEX = /^#[0-9a-fA-F]{6}$/;
  var PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|gif|webp)$/;
  var FS = { title: [1.6, 8.5], text: [1.2, 3.6], sticker: [0.8, 10] };
  var KINDS = [["all", "все"], ["kaomoji", "смайлы"], ["frame", "рамки"], ["ascii", "рисунки"]];

  function num(v, d, min, max) { v = Number(v); if (!isFinite(v)) v = d; return Math.min(max, Math.max(min, v)); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  /* ---------------- геометрия (чистые функции) ---------------- */
  function hit(a, b, gap) {
    gap = gap == null ? GAP : gap;
    var E = 1e-6;
    return a.x < b.x + b.w + gap - E && a.x + a.w + gap > b.x + E && a.y < b.y + b.h + gap - E && a.y + a.h + gap > b.y + E;
  }
  function collides(objs, o, x, y) {
    var r = { x: x, y: y, w: o.w, h: o.h };
    for (var i = 0; i < objs.length; i++) { if (objs[i] !== o && hit(r, objs[i])) return objs[i]; }
    return null;
  }
  function clampPos(o, x, y) {
    return [Math.max(0, Math.min(100 - o.w, x)), Math.max(0, Math.min(MAXH - o.h, y))];
  }
  function bottomOf(objs, except) {
    var b = 0;
    objs.forEach(function (o) { if (o !== except) b = Math.max(b, o.y + o.h); });
    return b;
  }
  function canvasHeight(objs) { return r1(Math.min(MAXH, Math.max(MINH, bottomOf(objs) + 3))); }
  // ближайшее свободное место для o рядом с (dx, dy); всегда находит (в крайнем случае — под всеми)
  function findFree(objs, o, dx, dy) {
    var c = clampPos(o, dx, dy);
    if (!collides(objs, o, c[0], c[1])) return c;
    var cands = [];
    objs.forEach(function (p) {
      if (p === o) return;
      [[p.x + p.w + GAP, p.y], [p.x - o.w - GAP, p.y], [p.x, p.y + p.h + GAP], [p.x, p.y - o.h - GAP],
       [p.x + p.w + GAP, dy], [p.x - o.w - GAP, dy], [dx, p.y + p.h + GAP], [dx, p.y - o.h - GAP]
      ].forEach(function (q) { cands.push(clampPos(o, q[0], q[1])); });
    });
    cands.sort(function (a, b) {
      return Math.hypot(a[0] - dx, a[1] - dy) - Math.hypot(b[0] - dx, b[1] - dy);
    });
    for (var i = 0; i < cands.length; i++) {
      if (!collides(objs, o, cands[i][0], cands[i][1])) return cands[i];
    }
    return clampPos(o, dx, bottomOf(objs, o) + GAP);
  }

  /* ---------------- проверка и очистка сохранённого макета ---------------- */
  function sanitize(decor) {
    if (!decor || typeof decor !== "object" || decor.v !== 2 || !Array.isArray(decor.objects)) return null;
    var out = [];
    decor.objects.slice(0, MAX_OBJ).forEach(function (raw) {
      if (!raw || typeof raw !== "object") return;
      var t = raw.type;
      if (t !== "title" && t !== "text" && t !== "image" && t !== "sticker") return;
      var o = {
        type: t,
        x: num(raw.x, 0, 0, 100), y: num(raw.y, 0, 0, MAXH),
        w: num(raw.w, 20, 1, 100), h: num(raw.h, 5, 0, MAXH)
      };
      if (o.x + o.w > 100) o.x = Math.max(0, 100 - o.w);
      if (t === "title" || t === "text") {
        o.text = String(raw.text == null ? "" : raw.text).slice(0, t === "title" ? 120 : 6000);
        o.fs = num(raw.fs, t === "title" ? 3.3 : 1.9, FS[t][0], FS[t][1]);
        o.font = FONT_CSS[raw.font] ? raw.font : "georgia";
        o.color = HEX.test(raw.color) ? raw.color : LIGHT;
      } else if (t === "image") {
        if (!PATH_RE.test(String(raw.path || ""))) return;
        o.path = raw.path;
        o.ar = num(raw.ar, 1.5, 0.1, 10);
      } else {
        o.text = String(raw.text == null ? "" : raw.text).slice(0, 2000);
        if (!o.text) return;
        o.fs = num(raw.fs, 3, FS.sticker[0], FS.sticker[1]);
        o.sid = raw.sid != null ? String(raw.sid).slice(0, 40) : "";
      }
      out.push(o);
    });
    return {
      v: 2,
      h: num(decor.h, MINH, 20, MAXH),
      bg: Object.prototype.hasOwnProperty.call(BG_CSS, decor.bg) ? decor.bg : "",
      objects: out
    };
  }

  function mediaPaths(decor) {
    var d = sanitize(decor), list = [];
    if (!d) return list;
    d.objects.forEach(function (o) { if (o.type === "image") list.push(o.path); });
    return list;
  }

  /* ---------------- стили (редактор + показ) ---------------- */
  function ensureStyle() {
    if (document.getElementById("ge-style")) return;
    var st = document.createElement("style");
    st.id = "ge-style";
    st.textContent = [
      /* показ */
      ".ge-vwrap{container-type:inline-size;width:100%}",
      ".ge-vcanvas{position:relative;width:100%;height:calc(var(--h)*1cqw);border-radius:12px;overflow:hidden;background:var(--bg,transparent)}",
      ".ge-vo{position:absolute;left:calc(var(--x)*1cqw);top:calc(var(--y)*1cqw);width:calc(var(--w)*1cqw);box-sizing:border-box;min-width:0}",
      ".ge-vo.sticker{width:auto;max-width:calc(100cqw - var(--x)*1cqw)}",
      ".ge-vo.title,.ge-vo.text{font-size:calc(var(--fs)*1cqw);line-height:1.25;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}",
      ".ge-vo.image img{display:block;width:100%;height:auto;border-radius:6px}",
      ".ge-vo.image .ge-miss{aspect-ratio:var(--ar);display:flex;align-items:center;justify-content:center;font:12px Arial,sans-serif;opacity:.6;border:1px dashed currentColor;border-radius:6px;text-align:center}",
      ".ge-vo.sticker pre{margin:0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:calc(var(--fs)*1cqw);line-height:1.15;white-space:pre}",
      "@container (max-width:560px){",
      " .ge-vcanvas{height:auto;display:flex;flex-direction:column;gap:12px;padding:12px;overflow:visible}",
      " .ge-vo{position:static;width:auto;order:var(--o)}",
      " .ge-vo.title{font-size:max(calc(var(--fs)*1cqw),24px)}",
      " .ge-vo.text{font-size:max(calc(var(--fs)*1cqw),16px)}",
      " .ge-vo.image{width:max(calc(var(--w)*1cqw),60%);max-width:100%;align-self:center}",
      " .ge-vo.sticker{align-self:center;max-width:100%;overflow:hidden}",
      "}",
      /* редактор */
      ".ge-root{color:#f4e3ea;font-family:Georgia,serif}",
      ".ge-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px}",
      ".ge-btn{border:1px solid rgba(240,201,214,.35);background:rgba(240,201,214,.10);color:#f0c9d6;border-radius:999px;padding:5px 12px;font:13px Georgia,serif;cursor:pointer}",
      ".ge-btn:hover:not([disabled]){background:#f0c9d6;color:#3a2030}",
      ".ge-btn[disabled]{opacity:.4;cursor:default}",
      ".ge-lab{font:11px Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;opacity:.7;margin-right:2px}",
      ".ge-sw{width:20px;height:20px;border-radius:50%;border:1px solid rgba(255,255,255,.5);cursor:pointer;padding:0}",
      ".ge-sw.on{outline:2px solid #f0c9d6;outline-offset:1px}",
      ".ge-sw[disabled]{opacity:.35;cursor:default}",
      ".ge-bg{border-radius:999px;border:1px solid rgba(240,201,214,.35);background:transparent;color:#f0c9d6;padding:2px 9px;font:12px Georgia,serif;cursor:pointer}",
      ".ge-bg.on{background:#f0c9d6;color:#3a2030}",
      ".ge-sel{background:rgba(10,4,8,.6);color:#f4e3ea;border:1px solid rgba(240,201,214,.3);border-radius:10px;padding:4px 6px;font:13px Georgia,serif;max-width:170px}",
      ".ge-color{width:28px;height:24px;padding:0;border:0;background:none}",
      ".ge-note{min-height:1.2em;font:12px Arial,sans-serif;color:#ffb3c6;margin:4px 0}",
      ".ge-panel{display:none;border:1px solid rgba(240,201,214,.25);border-radius:12px;padding:8px;margin:0 0 8px;background:rgba(10,4,8,.45)}",
      ".ge-panel.open{display:block}",
      ".ge-kinds{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 6px}",
      ".ge-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:6px;max-height:190px;overflow:auto}",
      ".ge-pick{background:rgba(240,201,214,.08);border:1px solid rgba(240,201,214,.2);border-radius:10px;color:#f4e3ea;cursor:pointer;padding:4px;overflow:hidden;max-height:76px}",
      ".ge-pick pre{margin:0;font:10px/1.1 ui-monospace,Menlo,Consolas,monospace;white-space:pre;pointer-events:none}",
      ".ge-wrap{container-type:inline-size;width:100%}",
      ".ge-canvas{position:relative;width:100%;border:1px dashed rgba(240,201,214,.35);border-radius:12px;overflow:hidden;background:var(--bg,rgba(10,4,8,.35))}",
      ".ge-obj{position:absolute;box-sizing:border-box;min-width:0}",
      ".ge-obj.sel{outline:1px solid #f0c9d6}",
      ".ge-obj.bad{outline:2px solid #ff6b8a;background:rgba(255,107,138,.12)}",
      ".ge-ta{display:block;width:100%;box-sizing:border-box;border:0;background:transparent;resize:none;outline:none;padding:.3cqw;margin:0;overflow:hidden;line-height:1.25}",
      ".ge-ta::placeholder{opacity:.45}",
      ".ge-img{display:block;width:100%;height:auto;border-radius:6px;pointer-events:none;user-select:none}",
      ".ge-pre{margin:0;font-family:ui-monospace,Menlo,Consolas,monospace;line-height:1.15;white-space:pre;pointer-events:none;user-select:none}",
      ".ge-h{position:absolute;display:none;width:24px;height:24px;border-radius:50%;background:#f0c9d6;color:#3a2030;font:13px/24px Arial,sans-serif;text-align:center;touch-action:none;user-select:none;z-index:3;cursor:grab}",
      ".ge-move{left:2px;top:2px}",
      ".ge-size{right:2px;bottom:2px;cursor:nwse-resize}",
      ".ge-obj.sel .ge-h{display:block}",
      ".ge-field{margin:0 0 8px;min-width:0}",
      ".ge-field label{display:block;font:11px Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;opacity:.75;margin:0 0 3px}",
      ".ge-in{width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:8px 10px;border-radius:10px;border:1px solid rgba(240,201,214,.28);background:rgba(10,4,8,.55);color:#f4e3ea;font:15px Georgia,serif}",
      ".ge-in option{background:#1a0f14;color:#f4e3ea}",
      "textarea.ge-body{resize:vertical;min-height:90px;max-height:420px;display:block}",
      ".ge-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:2px 12px;margin:2px 0 6px}",
      ".ge-root input.ge-color{width:48px;height:30px;padding:0;border:1px solid rgba(240,201,214,.28);border-radius:8px;background:none}",
      ".ge-root input.ge-range{width:100%;padding:0;accent-color:#e8a0b8}",
      ".ge-txt{margin:0;line-height:1.25;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;pointer-events:none;user-select:none}",
      ".ge-txt.empty{opacity:.45}"
    ].join("\n");
    document.head.appendChild(st);
  }

  /* ---------------- показ сохранённой композиции ---------------- */
  function render(decor, urls) {
    var d = sanitize(decor);
    if (!d) return null;
    ensureStyle();
    urls = urls || {};
    var wrap = h("div", "ge-vwrap");
    var cv = h("div", "ge-vcanvas");
    cv.style.setProperty("--h", String(d.h));
    if (d.bg && BG_CSS[d.bg]) cv.style.setProperty("--bg", BG_CSS[d.bg]);
    var order = d.objects.map(function (o, i) { return i; }).sort(function (a, b) {
      var A = d.objects[a], B = d.objects[b];
      return (A.y - B.y) || (A.x - B.x);
    });
    var pos = {};
    order.forEach(function (idx, n) { pos[idx] = n; });
    d.objects.forEach(function (o, i) {
      var el = h("div", "ge-vo " + o.type);
      el.style.setProperty("--x", String(o.x));
      el.style.setProperty("--y", String(o.y));
      el.style.setProperty("--w", String(o.w));
      el.style.setProperty("--o", String(pos[i]));
      if (o.type === "title" || o.type === "text") {
        el.style.setProperty("--fs", String(o.fs));
        el.style.fontFamily = FONT_CSS[o.font];
        el.style.color = o.color;
        el.textContent = o.text;
      } else if (o.type === "image") {
        var url = urls[o.path];
        if (url) {
          var img = document.createElement("img");
          img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.draggable = false;
          img.src = url;
          el.appendChild(img);
        } else {
          var miss = h("div", "ge-miss", "изображение недоступно");
          miss.style.setProperty("--ar", String(o.ar));
          el.appendChild(miss);
        }
      } else {
        el.style.setProperty("--fs", String(o.fs));
        var pre = h("pre", null, o.text);
        el.appendChild(pre);
      }
      cv.appendChild(el);
    });
    wrap.appendChild(cv);
    return wrap;
  }

  /* ---------------- редактор: модель Notes (поля заголовка и текста → живой холст с элементами) ---------------- */
  function mount(host, opts) {
    ensureStyle();
    opts = opts || {};
    var sb = opts.sb;
    var objs = [], els = {}, sel = null, seq = 0;
    var uploaded = {}, existing = {}, published = false, catalog = null, catKind = "all", busy = false;
    var tp = null, bp = null;    // заголовок и текст — постоянные элементы холста; их содержимое задают поля сверху
    var bg = "glass";

    host.innerHTML = "";
    var root = h("div", "ge-root");
    host.appendChild(root);

    function field(label, el) {
      var w = h("div", "ge-field");
      w.appendChild(h("label", null, label));
      w.appendChild(el);
      return w;
    }
    function fontSelect() {
      var s = h("select", "ge-in");
      FONTS.forEach(function (f) { var o = h("option", null, f[1]); o.value = f[0]; s.appendChild(o); });
      return s;
    }
    function colorInput(v) { var c = document.createElement("input"); c.type = "color"; c.className = "ge-color"; c.value = v; return c; }
    function range(min, max, v) { var r = document.createElement("input"); r.type = "range"; r.min = min; r.max = max; r.value = v; r.className = "ge-range"; return r; }

    var inTitle = document.createElement("input");
    inTitle.type = "text"; inTitle.maxLength = 120; inTitle.className = "ge-in";
    var inBody = document.createElement("textarea");
    inBody.rows = 5; inBody.maxLength = 6000; inBody.className = "ge-in ge-body";
    var fTitle = fontSelect(), fBody = fontSelect();
    var cTitle = colorInput(LIGHT), cBody = colorInput(LIGHT);
    var sTitle = range(16, 64, 28), sBody = range(12, 28, 16);
    var bgSel = h("select", "ge-in");
    BG_LABELS.forEach(function (p) { var o = h("option", null, p[1]); o.value = p[0]; bgSel.appendChild(o); });

    root.appendChild(field("заголовок", inTitle));
    root.appendChild(field("текст", inBody));
    var grid = h("div", "ge-grid2");
    grid.appendChild(field("шрифт заголовка", fTitle));
    grid.appendChild(field("шрифт текста", fBody));
    grid.appendChild(field("цвет заголовка", cTitle));
    grid.appendChild(field("цвет текста", cBody));
    grid.appendChild(field("размер заголовка", sTitle));
    grid.appendChild(field("размер текста", sBody));
    grid.appendChild(field("фон поста", bgSel));
    root.appendChild(grid);

    var bar = h("div", "ge-bar");
    var note = h("div", "ge-note");
    var panel = h("div", "ge-panel");
    var tools = h("div", "ge-bar ge-tools");
    var wrapEl = h("div", "ge-wrap");
    var canvas = h("div", "ge-canvas");
    wrapEl.appendChild(canvas);
    root.appendChild(bar); root.appendChild(note); root.appendChild(panel); root.appendChild(tools); root.appendChild(wrapEl);

    function say(msg) { note.textContent = msg || ""; }
    function btn(label, fn) { var b = h("button", "ge-btn", label); b.type = "button"; b.onclick = fn; return b; }
    function unit() { return (canvas.clientWidth || 800) / 100; }
    function uid() { seq++; return "o" + seq + Math.random().toString(36).slice(2, 6); }
    function byId(id) { for (var i = 0; i < objs.length; i++) if (objs[i].id === id) return objs[i]; return null; }
    function selected() { return sel ? byId(sel) : null; }
    function imgCount() { return objs.filter(function (o) { return o.type === "image"; }).length; }
    function isText(o) { return o && (o.type === "title" || o.type === "text"); }
    function defColor() { return LIGHT_BG[bg] ? DARK : LIGHT; }

    var file = document.createElement("input");
    file.type = "file"; file.accept = "image/jpeg,image/png,image/gif,image/webp"; file.style.display = "none";
    file.onchange = function () { var f = file.files && file.files[0]; file.value = ""; addImageFile(f); };
    var bImg = btn("+ Фото / GIF", function () { file.click(); });
    var bSt = btn("+ Стикер", function () { togglePanel(); });
    bar.appendChild(bImg); bar.appendChild(bSt); bar.appendChild(file);

    var selLab = h("span", "ge-lab", "выбери элемент на холсте");
    var bMinus = btn("−", function () { resize(-1); });
    var bPlus = btn("+", function () { resize(1); });
    var bDel = btn("✕ удалить", function () { removeSel(); });
    bMinus.title = "меньше"; bPlus.title = "больше";
    tools.appendChild(selLab); tools.appendChild(bMinus); tools.appendChild(bPlus); tools.appendChild(bDel);

    function syncTools() {
      var o = selected();
      selLab.textContent = o ? ({ title: "заголовок", text: "текст", image: "фото / GIF", sticker: "стикер" })[o.type] : "выбери элемент на холсте";
      bMinus.disabled = !o; bPlus.disabled = !o;
      bDel.disabled = !o || isText(o);
      bImg.disabled = busy || objs.length >= MAX_OBJ || imgCount() >= MAX_IMG;
      bSt.disabled = objs.length >= MAX_OBJ;
    }

    /* --- холст --- */
    function applyH() { canvas.style.height = canvasHeight(objs) + "cqw"; }
    function place(o) {
      var el = els[o.id].root;
      el.style.left = o.x + "cqw"; el.style.top = o.y + "cqw";
      if (o.type !== "sticker") el.style.width = o.w + "cqw";
    }
    function flagAll() {
      var bad = false;
      objs.forEach(function (o) {
        var c = !!collides(objs, o, o.x, o.y);
        bad = bad || c;
        els[o.id].root.classList.toggle("bad", c);
      });
      if (bad) say("элементы накладываются — раздвинь их на холсте"); else if (/накладываются|не хватило/.test(note.textContent)) say("");
    }
    function styleText(o) {
      var e = els[o.id];
      e.txt.style.fontFamily = FONT_CSS[o.font];
      e.txt.style.color = o.color;
      e.txt.style.fontSize = o.fs + "cqw";
      e.txt.textContent = o.text || o.ph;
      e.txt.classList.toggle("empty", !o.text);
    }
    function measure(o) {
      var e = els[o.id];
      if (isText(o)) {
        o.h = Math.max(1, r1(e.txt.getBoundingClientRect().height / unit()));
      } else if (o.type === "image") {
        o.h = r1(o.w / o.ar);
      } else {
        o.w = r1(o.wb * o.fs); o.h = r1(o.hb * o.fs);
        e.pre.style.fontSize = o.fs + "cqw";
      }
    }
    // заголовок и текст, которые пользователь не двигал вручную, идут друг под другом сами
    function reflow() {
      if (tp && bp && !bp.moved) {
        var c = findFree(objs, bp, bp.x, tp.y + tp.h + GAP);
        bp.x = c[0]; bp.y = c[1]; place(bp);
      }
    }
    function refreshText(o) {
      styleText(o); o.w = r1(Math.min(o.w, 100 - o.x)); place(o); measure(o);
      reflow(); applyH(); flagAll(); syncTools();
    }
    function afterChange(o) {
      measure(o);
      if (o.x + o.w > 100) o.x = Math.max(0, 100 - o.w);
      if (collides(objs, o, o.x, o.y)) { var c = findFree(objs, o, o.x, o.y); o.x = c[0]; o.y = c[1]; }
      place(o); reflow(); applyH(); flagAll(); syncTools();
    }

    /* --- выбор, перемещение, масштаб --- */
    function select(id) {
      sel = id;
      objs.forEach(function (o) { els[o.id].root.classList.toggle("sel", o.id === id); });
      syncTools();
    }
    function startDrag(ev, o, mode) {
      ev.preventDefault(); ev.stopPropagation();
      select(o.id);
      var u = unit(), sx = ev.clientX, sy = ev.clientY;
      var ox = o.x, oy = o.y, ow = o.w, oh = o.h, ofs = o.fs;
      function mv(e) {
        var dx = (e.clientX - sx) / u, dy = (e.clientY - sy) / u;
        if (mode === "move") { var c = clampPos(o, ox + dx, oy + dy); o.x = c[0]; o.y = c[1]; }
        else { setWidth(o, ow + dx, ow, ofs); }
        place(o); applyH(); flagAll();
      }
      function up() {
        window.removeEventListener("pointermove", mv);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        if (collides(objs, o, o.x, o.y)) {
          if (mode === "move") { var c = findFree(objs, o, o.x, o.y); o.x = c[0]; o.y = c[1]; }
          else {
            o.w = ow; o.h = oh; o.fs = ofs; o.x = ox; o.y = oy;
            if (isText(o)) styleText(o);
            measure(o); say("не хватило места для такого размера");
          }
        }
        if (mode === "move" && isText(o) && (o.x !== ox || o.y !== oy)) o.moved = true;
        place(o); reflow(); applyH(); flagAll(); syncTools();
      }
      window.addEventListener("pointermove", mv);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    }
    function setWidth(o, nw, w0, fs0) {
      if (o.type === "image") {
        o.w = r1(Math.max(8, Math.min(100 - o.x, nw))); o.h = r1(o.w / o.ar);
      } else if (o.type === "sticker") {
        var maxFs = Math.min(FS.sticker[1], (100 - o.x) / o.wb);
        o.fs = r1(Math.max(FS.sticker[0], Math.min(maxFs, fs0 * (nw / w0))) * 10) / 10;
        measure(o);
      } else {
        o.w = r1(Math.max(14, Math.min(100 - o.x, nw)));
        measure(o);
      }
    }
    function syncSliders() {
      if (tp) sTitle.value = String(Math.round(tp.fs * REF_W));
      if (bp) sBody.value = String(Math.round(bp.fs * REF_W));
    }
    function resize(dir) {
      var o = selected(); if (!o) return;
      var old = { w: o.w, h: o.h, fs: o.fs };
      if (o.type === "image") { setWidth(o, o.w + dir * 5, o.w, o.fs); }
      else if (o.type === "sticker") { setWidth(o, o.w * (dir > 0 ? 1.15 : 1 / 1.15), o.w, o.fs); }
      else {
        var lim = FS[o.type];
        o.fs = r1(Math.max(lim[0], Math.min(lim[1], o.fs + dir * (o.type === "title" ? 0.4 : 0.15))) * 100) / 100;
        styleText(o); measure(o); syncSliders();
      }
      afterChange(o);
      if (collides(objs, o, o.x, o.y)) {
        o.w = old.w; o.h = old.h; o.fs = old.fs;
        if (isText(o)) { styleText(o); syncSliders(); }
        measure(o); place(o); applyH(); flagAll();
      }
    }
    function setBg(key) {
      bg = Object.prototype.hasOwnProperty.call(BG_CSS, key) ? key : "glass";
      bgSel.value = bg;
      canvas.style.setProperty("--bg", BG_CSS[bg] || "rgba(10,4,8,.35)");
      [tp, bp].forEach(function (o) {
        if (o && (o.color === LIGHT || o.color === DARK)) { o.color = defColor(); if (els[o.id]) styleText(o); }
      });
      if (tp) cTitle.value = tp.color;
      if (bp) cBody.value = bp.color;
    }

    /* --- создание элементов --- */
    function register(o, rootEl, parts) {
      parts.root = rootEl; els[o.id] = parts;
      var mvH = h("div", "ge-h ge-move", "✥"), szH = h("div", "ge-h ge-size", "◢");
      mvH.title = "переместить"; szH.title = "изменить размер";
      mvH.addEventListener("pointerdown", function (e) { startDrag(e, o, "move"); });
      szH.addEventListener("pointerdown", function (e) { startDrag(e, o, "size"); });
      rootEl.appendChild(mvH); rootEl.appendChild(szH);
      rootEl.addEventListener("pointerdown", function (e) {
        if (e.target === mvH || e.target === szH) return;
        if (sel !== o.id) select(o.id);
        if (e.pointerType === "mouse") startDrag(e, o, "move");
      });
      canvas.appendChild(rootEl);
    }
    function dropIn(o, wantX, wantY) {
      var c = findFree(objs, o, wantX, wantY);
      o.x = c[0]; o.y = c[1];
      objs.push(o);
    }
    function makeTextPiece(kind, init) {
      var isT = kind === "title";
      var o = { id: isT ? "t" : "b", type: kind, text: "", ph: isT ? "заголовок…" : "текст…", x: 4, y: 3, w: 92, h: 4,
        fs: isT ? 3.3 : 1.9, font: "georgia", color: defColor(), moved: false };
      if (init) for (var k in init) o[k] = init[k];
      var rootEl = h("div", "ge-obj");
      var txt = h("div", "ge-txt");
      rootEl.appendChild(txt);
      register(o, rootEl, { txt: txt });
      rootEl.style.width = o.w + "cqw";
      styleText(o); measure(o);
      objs.push(o);
      place(o);
      return o;
    }
    function loadDims(url) {
      return new Promise(function (res, rej) {
        var im = new Image();
        im.onload = function () { res({ w: im.naturalWidth, h: im.naturalHeight }); };
        im.onerror = function () { rej(new Error("bad image")); };
        im.src = url;
      });
    }
    function newPath(type) {
      var id = (global.crypto && crypto.randomUUID) ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16);
      });
      return id.toLowerCase() + EXT[type];
    }
    function buildImage(o, src, local) {
      var rootEl = h("div", "ge-obj");
      var img = h("img", "ge-img"); if (src) img.src = src; img.alt = ""; img.draggable = false;
      rootEl.appendChild(img);
      register(o, rootEl, { img: img, local: local || null });
    }
    async function addImageFile(f) {
      if (!f) return;
      say("");
      if (!EXT[f.type]) { say("допустимы JPG, PNG, GIF и WebP"); return; }
      if (f.size > MAX_BYTES) { say("файл больше 5 МБ"); return; }
      if (objs.length >= MAX_OBJ || imgCount() >= MAX_IMG) { say("достигнут лимит элементов"); return; }
      if (!sb || !sb.storage) { say("хранилище недоступно"); return; }
      busy = true; syncTools(); say("загрузка…");
      var local = URL.createObjectURL(f), dims;
      try { dims = await loadDims(local); } catch (e) { URL.revokeObjectURL(local); busy = false; syncTools(); say("не удалось прочитать изображение"); return; }
      var path = newPath(f.type);
      var up = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type, upsert: false, cacheControl: "3600" });
      busy = false;
      if (up.error) {
        URL.revokeObjectURL(local); syncTools();
        say(/not found|bucket/i.test(String(up.error.message || "")) ? "хранилище для медиа ещё не настроено на сервере (нужна миграция 2B)" : "не удалось загрузить файл");
        return;
      }
      uploaded[path] = true;
      var ar = Math.max(0.1, Math.min(10, dims.w / dims.h));
      var w = 40;
      var o = { id: uid(), type: "image", path: path, ar: r1(ar * 100) / 100, x: 4, y: 3, w: w, h: r1(w / ar) };
      buildImage(o, local, local);
      dropIn(o, 4, bottomOf(objs) + GAP);
      place(o); applyH(); flagAll(); select(o.id);
      say("");
    }
    function buildSticker(o) {
      var rootEl = h("div", "ge-obj");
      var pre = h("pre", "ge-pre", o.text);
      rootEl.appendChild(pre);
      register(o, rootEl, { pre: pre });
      pre.style.fontSize = "10cqw";
      var rect = pre.getBoundingClientRect(), u = unit();
      o.wb = Math.max(0.05, rect.width / u / 10); o.hb = Math.max(0.05, rect.height / u / 10);
    }
    function addSticker(st) {
      if (objs.length >= MAX_OBJ || !st || !st.text) return;
      var o = { id: uid(), type: "sticker", sid: st.id != null ? String(st.id) : "", text: String(st.text).slice(0, 2000), x: 4, y: 3, fs: 3, w: 10, h: 5 };
      buildSticker(o);
      o.fs = Math.min(4, r1(Math.max(FS.sticker[0], Math.min(FS.sticker[1], 30 / o.wb)) * 10) / 10);
      measure(o);
      dropIn(o, 4, bottomOf(objs) + GAP);
      place(o); applyH(); flagAll(); select(o.id);
    }
    function removeSel() {
      var o = selected(); if (!o || isText(o)) return;
      if (o.type === "image") {
        if (uploaded[o.path] && sb && sb.storage) { sb.storage.from(BUCKET).remove([o.path]); delete uploaded[o.path]; }
        var e = els[o.id]; if (e && e.local) URL.revokeObjectURL(e.local);
      }
      els[o.id].root.remove(); delete els[o.id];
      objs.splice(objs.indexOf(o), 1);
      sel = null; applyH(); flagAll(); syncTools();
    }

    /* --- каталог стикеров: та же таблица и тот же запрос, что в Notes (kinqsy-stickers.js → kqLoadCatalog) --- */
    function togglePanel() {
      if (panel.classList.contains("open")) { panel.classList.remove("open"); return; }
      panel.classList.add("open");
      loadCatalog(catKind);
    }
    async function loadCatalog(kind) {
      catKind = kind || "all";
      panel.innerHTML = "";
      panel.appendChild(h("div", "ge-note", "загрузка стикеров…"));
      var q = sb ? sb.from("stickers").select("id,text,kind").order("created_at", { ascending: false }).limit(300) : null;
      if (q && catKind !== "all") q = q.eq("kind", catKind);
      var r = q ? await q : { error: true };
      panel.innerHTML = "";
      var tabs = h("div", "ge-kinds");
      KINDS.forEach(function (k) {
        var b = h("button", "ge-bg" + (k[0] === catKind ? " on" : ""), k[1]); b.type = "button";
        b.onclick = function () { loadCatalog(k[0]); };
        tabs.appendChild(b);
      });
      panel.appendChild(tabs);
      if (r.error || !r.data) { panel.appendChild(h("div", "ge-note", "каталог стикеров недоступен")); return; }
      var list = r.data.filter(function (s) { return s && s.text && String(s.text).length <= 2000; });
      if (!list.length) { panel.appendChild(h("div", "ge-note", catKind === "all" ? "в библиотеке стикеров пока пусто" : "пусто в этой категории")); return; }
      var gridEl = h("div", "ge-grid");
      list.forEach(function (s) {
        var b = h("button", "ge-pick"); b.type = "button";
        b.appendChild(h("pre", null, s.text));
        b.onclick = function () { addSticker(s); panel.classList.remove("open"); };
        gridEl.appendChild(b);
      });
      panel.appendChild(gridEl);
    }

    /* --- поля сверху управляют заголовком и текстом на холсте --- */
    inTitle.addEventListener("input", function () { tp.text = inTitle.value; refreshText(tp); });
    inBody.addEventListener("input", function () { bp.text = inBody.value; refreshText(bp); });
    fTitle.onchange = function () { tp.font = fTitle.value; refreshText(tp); };
    fBody.onchange = function () { bp.font = fBody.value; refreshText(bp); };
    cTitle.oninput = function () { if (HEX.test(cTitle.value)) { tp.color = cTitle.value.toLowerCase(); refreshText(tp); } };
    cBody.oninput = function () { if (HEX.test(cBody.value)) { bp.color = cBody.value.toLowerCase(); refreshText(bp); } };
    sTitle.oninput = function () { tp.fs = r1(num(Number(sTitle.value) / REF_W, 3.3, FS.title[0], FS.title[1]) * 100) / 100; refreshText(tp); };
    sBody.oninput = function () { bp.fs = r1(num(Number(sBody.value) / REF_W, 1.9, FS.text[0], FS.text[1]) * 100) / 100; refreshText(bp); };
    bgSel.onchange = function () { setBg(bgSel.value); refreshText(tp); refreshText(bp); };
    canvas.addEventListener("pointerdown", function (e) { if (e.target === canvas) select(null); });

    /* --- публичный интерфейс --- */
    function serialize() {
      var kept = objs.filter(function (o) { return !isText(o) || (o.type === "title" ? true : o.text.trim().length > 0); });
      var list = kept.map(function (o) {
        var b = { id: o.id, type: o.type, x: r1(o.x), y: r1(o.y), w: r1(o.w), h: r1(o.h) };
        if (isText(o)) { b.text = o.text.replace(/\s+$/, ""); b.fs = o.fs; b.font = o.font; b.color = o.color; }
        else if (o.type === "image") { b.path = o.path; b.ar = o.ar; }
        else { b.sid = o.sid; b.text = o.text; b.fs = o.fs; }
        return b;
      });
      return { v: 2, h: canvasHeight(kept), bg: bg === "glass" ? "" : bg, objects: list };
    }
    function getData() {
      [tp, bp].forEach(function (o) { if (o) measure(o); });
      flagAll();
      var problems = [];
      var tt = tp.text.trim();
      if (!tt) problems.push("напиши заголовок");
      var hasBody = bp.text.trim().length > 0;
      var media = objs.filter(function (o) { return o.type === "image" || o.type === "sticker"; });
      if (!hasBody && !media.length) problems.push("добавь текст, фото или стикер");
      if (objs.some(function (o) { return collides(objs, o, o.x, o.y); })) problems.push("элементы накладываются друг на друга — раздвинь их на холсте");
      var decor = serialize();
      if (JSON.stringify(decor).length > 60000) problems.push("композиция слишком большая");
      var paths = decor.objects.filter(function (o) { return o.type === "image"; }).map(function (o) { return o.path; });
      return {
        ok: problems.length === 0, problems: problems, decor: decor,
        title: tt, text: bp.text.trim(),
        titleFont: FONT_CSS[tp.font], titleColor: tp.color,
        bodyFont: FONT_CSS[bp.font], bodyColor: bp.color,
        bg: bg,
        paths: paths,
        removed: Object.keys(existing).filter(function (p) { return paths.indexOf(p) < 0; })
      };
    }
    function clearAll() {
      objs.forEach(function (o) { var e = els[o.id]; if (e && e.local) URL.revokeObjectURL(e.local); });
      objs = []; els = {}; sel = null; tp = null; bp = null; canvas.innerHTML = "";
    }
    function cleanup() {
      if (published) { uploaded = {}; return; }
      var list = Object.keys(uploaded);
      if (list.length && sb && sb.storage) sb.storage.from(BUCKET).remove(list);
      uploaded = {};
    }
    function fresh() {
      bg = "glass"; canvas.style.setProperty("--bg", "rgba(10,4,8,.35)"); bgSel.value = "glass";
      tp = makeTextPiece("title"); bp = makeTextPiece("text");
      inTitle.value = ""; inBody.value = "";
      fTitle.value = "georgia"; fBody.value = "georgia";
      cTitle.value = tp.color; cBody.value = bp.color;
      syncSliders();
      reflow(); applyH(); flagAll(); syncTools();
    }
    function reset() {
      cleanup(); published = false; existing = {}; clearAll(); say(""); fresh();
    }
    // загрузка существующей записи для редактирования
    function load(data) {
      cleanup(); published = false; existing = {}; clearAll(); say("");
      var d = data && data.decor ? sanitize(data.decor) : null;
      var urls = (data && data.urls) || {};
      bg = d ? (d.bg || "glass") : "glass";
      canvas.style.setProperty("--bg", BG_CSS[bg] || "rgba(10,4,8,.35)"); bgSel.value = bg;
      var t = d && d.objects.filter(function (o) { return o.type === "title"; })[0];
      var b = d && d.objects.filter(function (o) { return o.type === "text"; })[0];
      tp = makeTextPiece("title", t ? { text: t.text, x: t.x, y: t.y, w: t.w, fs: t.fs, font: t.font, color: t.color, moved: true } : { text: (data && data.title) || "" });
      bp = makeTextPiece("text", b ? { text: b.text, x: b.x, y: b.y, w: b.w, fs: b.fs, font: b.font, color: b.color, moved: true } : { text: (data && data.text) || "" });
      inTitle.value = tp.text; inBody.value = bp.text;
      fTitle.value = tp.font; fBody.value = bp.font; cTitle.value = tp.color; cBody.value = bp.color; syncSliders();
      if (d) d.objects.forEach(function (r) {
        if (r.type === "image") {
          var o = { id: uid(), type: "image", path: r.path, ar: r.ar, x: r.x, y: r.y, w: r.w, h: r.h };
          buildImage(o, urls[r.path] || "", null); objs.push(o); place(o); existing[r.path] = true;
        } else if (r.type === "sticker") {
          var s = { id: uid(), type: "sticker", sid: r.sid, text: r.text, x: r.x, y: r.y, fs: r.fs, w: r.w, h: r.h };
          buildSticker(s); measure(s); objs.push(s); place(s);
        }
      });
      refreshText(tp); refreshText(bp);
      applyH(); flagAll(); syncTools();
    }
    function markPublished() { published = true; uploaded = {}; }

    reset();
    return { getData: getData, reset: reset, load: load, cleanup: cleanup, markPublished: markPublished, say: say };
  }

  global.GossipEditor = {
    mount: mount, render: render, mediaPaths: mediaPaths, sanitize: sanitize, BG_CSS: BG_CSS,
    _geom: { hit: hit, collides: collides, findFree: findFree, clampPos: clampPos, bottomOf: bottomOf, canvasHeight: canvasHeight, GAP: GAP, MAXH: MAXH }
  };
})(typeof window !== "undefined" ? window : globalThis);
