window.kqStickersOnPost = [];

function kqSb() {
  return window.__kinqsy_sb || null;
}

window.kqLoadCatalog = async function () {
  var sb = kqSb();
  if (!sb) return [];
  var r = await sb.from("stickers").select("id,text").order("created_at", { ascending: false });
  return r.data || [];
};

window.kqOpenStickerTray = async function () {
  var host = document.getElementById("kq-sticker-pop");
  if (!host) {
    host = document.createElement("div");
    host.id = "kq-sticker-pop";
    host.className = "kq-sticker-pop";
    document.body.appendChild(host);
  }
  host.innerHTML = '<div class="kq-sticker-card"><p>загрузка каталога…</p></div>';
  host.style.display = "flex";
  var mine = await window.kqLoadCatalog();
  var cards = mine.length
    ? mine.map(function (s) {
        return '<button type="button" class="kq-sticker-pick" data-id="' + s.id + '" data-text="' +
          encodeURIComponent(s.text) + '"><pre>' + s.text + "</pre></button>";
      }).join("")
    : "<p>каталог пуст</p>";
  host.innerHTML =
    '<div class="kq-sticker-card">' +
    "<p>общий каталог — видно всем</p>" +
    cards +
    '<textarea id="kq-sticker-new" rows="6" placeholder="вставь смайл, рамку или рисунок из точек"></textarea>' +
    '<button type="button" id="kq-sticker-add">добавить в общий каталог</button> ' +
    '<button type="button" id="kq-sticker-close">закрыть</button>' +
    '<p id="kq-sticker-err"></p></div>';
  host.onclick = async function (e) {
    if (e.target.id === "kq-sticker-pop" || e.target.id === "kq-sticker-close") {
      host.style.display = "none";
      return;
    }
    if (e.target.id === "kq-sticker-add") {
      var raw = (document.getElementById("kq-sticker-new").value || "").replace(/\s+$/, "");
      var err = document.getElementById("kq-sticker-err");
      if (!raw) return;
      var sb = kqSb();
      if (!sb) { err.textContent = "нет supabase"; return; }
      var sess = await sb.auth.getSession();
      var uid = sess.data && sess.data.session && sess.data.session.user && sess.data.session.user.id;
      var ins = await sb.from("stickers").insert({ text: raw, user_id: uid }).select("id");
      if (ins.error) { err.textContent = ins.error.message; return; }
      window.kqOpenStickerTray();
      return;
    }
    var btn = e.target.closest("[data-text]");
    if (!btn) return;
    window.kqAddSticker(btn.getAttribute("data-id"), decodeURIComponent(btn.getAttribute("data-text")));
    host.style.display = "none";
  };
};

window.kqAddSticker = function (id, text) {
  window.kqStickersOnPost.push({
    uid: "s" + Date.now(),
    id: id,
    text: text,
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
    var el = document.createElement("pre");
    el.className = "kq-sticker-node";
    el.textContent = node.text;
    el.style.left = node.x + "%";
    el.style.top = node.y + "%";
    canvas.appendChild(el);
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
    el.addEventListener("mousedown", function (ev) {
      dragging = true;
      ev.preventDefault();
      document.addEventListener("mousemove", move, { passive: false });
      document.addEventListener("mouseup", up);
    });
    el.addEventListener("touchstart", function (ev) {
      dragging = true;
      ev.preventDefault();
      document.addEventListener("touchmove", move, { passive: false });
      document.addEventListener("touchend", up);
    }, { passive: false });
    el.addEventListener("dblclick", function () {
      window.kqStickersOnPost = window.kqStickersOnPost.filter(function (x) { return x.uid !== node.uid; });
      window.kqPaintStickers();
    });
  });
};

window.kqDecorPayload = function () {
  return window.kqStickersOnPost || [];
};
