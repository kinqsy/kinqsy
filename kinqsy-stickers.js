window.KQ_STICKERS = [
  { id: "kao-uwu", type: "kaomoji", name: "(>.<)", text: "(>.<)" },
  { id: "kao-spark", type: "kaomoji", name: "☆", text: "☆(>ᴗ•)☆" },
  { id: "frm-starline", type: "frame", name: "звёзды", text: "｡☆✼★━━━━━━━━━━━━★✼☆｡" },
  { id: "frm-wave", type: "frame", name: "волна", text: "︵‿︵‿୨♡୧‿︵‿︵" },
  { id: "ascii-cat", type: "ascii", name: "кот", text:
"⠀⠀⠀⠀⠀⠀⢀⣰⣀⠀⠀⠀⠀⠀⠀⠀⠀\n⢀⣀⠀⠀⠀⢀⣄⠘⠀⠀⣶⡿⣷⣦⣾⣿⣧\n⢺⣾⣶⣦⣰⡟⣿⡇⠀⠀⠻⣧⠀⠛⠀⡘⠏\n⠈⢿⡆⠉⠛⠁⡷⠁⠀⠀⠀⠉⠳⣦⣮⠁⠀\n⠀⠀⠛⢷⣄⣼⠃⠀⠀⠀⠀⠀⠀⠉⠀⠠⡧\n⠀⠀⠀⠀⠉⠋⠀⠀⠀⠠⡥⠄⠀⠀⠀⠀⠀" }
];

window.kqStickersOnPost = [];

function kqStickerById(id) {
  var list = window.KQ_STICKERS || [];
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

window.kqOpenStickerTray = function () {
  var host = document.getElementById("kq-sticker-pop");
  if (!host) {
    host = document.createElement("div");
    host.id = "kq-sticker-pop";
    host.className = "kq-sticker-pop";
    document.body.appendChild(host);
  }
  var list = window.KQ_STICKERS || [];
  host.innerHTML = '<div class="kq-sticker-card"><p>нажми — появится на посте, потом тащи мышью</p>' +
    list.map(function (s) {
      return '<button type="button" class="kq-sticker-pick" data-id="' + s.id + '"><b>' + s.name +
        '</b><pre>' + s.text + '</pre></button>';
    }).join("") +
    '<button type="button" id="kq-sticker-close">закрыть</button></div>';
  host.style.display = "flex";
  host.onclick = function (e) {
    if (e.target.id === "kq-sticker-pop" || e.target.id === "kq-sticker-close") {
      host.style.display = "none";
      return;
    }
    var btn = e.target.closest("[data-id]");
    if (!btn) return;
    window.kqAddSticker(btn.getAttribute("data-id"));
    host.style.display = "none";
  };
};

window.kqAddSticker = function (id) {
  var item = kqStickerById(id);
  if (!item) return;
  window.kqStickersOnPost.push({
    uid: "s" + Date.now() + Math.random().toString(16).slice(2),
    id: item.id,
    x: 8,
    y: 8
  });
  window.kqPaintStickers();
};

window.kqPaintStickers = function () {
  var canvas = document.getElementById("kq-sticker-canvas") || document.getElementById("compose-preview");
  if (!canvas) return;
  canvas.classList.add("kq-sticker-canvas");
  canvas.querySelectorAll(".kq-sticker-node").forEach(function (n) { n.remove(); });
  (window.kqStickersOnPost || []).forEach(function (node) {
    var item = kqStickerById(node.id);
    if (!item) return;
    var el = document.createElement("pre");
    el.className = "kq-sticker-node";
    el.textContent = item.text;
    el.style.left = node.x + "%";
    el.style.top = node.y + "%";
    el.setAttribute("data-uid", node.uid);
    canvas.appendChild(el);
    kqBindDrag(el, node, canvas);
  });
};

function kqBindDrag(el, node, canvas) {
  var dragging = false;
  function point(ev) {
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
    var p = point(ev);
    node.x = Math.max(0, Math.min(88, p.x));
    node.y = Math.max(0, Math.min(88, p.y));
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
  function down(ev) {
    dragging = true;
    ev.preventDefault();
    document.addEventListener("mousemove", move, { passive: false });
    document.addEventListener("mouseup", up);
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", up);
  }
  el.addEventListener("mousedown", down);
  el.addEventListener("touchstart", down, { passive: false });
  el.addEventListener("dblclick", function () {
    window.kqStickersOnPost = window.kqStickersOnPost.filter(function (x) { return x.uid !== node.uid; });
    window.kqPaintStickers();
  });
}

window.kqDecorPayload = function () {
  return window.kqStickersOnPost || [];
};
