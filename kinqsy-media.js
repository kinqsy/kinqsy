(function (g) {
  "use strict";
  var cache = new Map(), generation = 0;
  var host = "https://rgkfegdtxaojceknnzlr.supabase.co";
  function pathOf(value) {
    try {
      var u = new URL(value);
      if (u.origin !== host) return null;
      var m = u.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/media\/(.+)$/);
      if (!m) return null;
      var path = decodeURIComponent(m[1]);
      if (path.split("/").some(function (s) { return !s || s === "." || s === ".."; })) return null;
      return path;
    } catch (_) { return null; }
  }
  function canonical(value) {
    var path = pathOf(value);
    return path === null ? value : host + "/storage/v1/object/public/media/" + path.split("/").map(encodeURIComponent).join("/");
  }
  function canonicalize(value) {
    if (typeof value === "string") return canonical(value);
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === "object") {
      var result = {};
      Object.keys(value).forEach(function (key) { result[key] = canonicalize(value[key]); });
      return result;
    }
    return value;
  }
  async function resolve(value) {
    var path = pathOf(value);
    if (path === null) return value;
    var sb = g.__kinqsy_sb;
    if (!sb) return "";
    var version = generation;
    var session = await sb.auth.getSession();
    if (version !== generation || session.error || !session.data.session) return "";
    var uid = session.data.session.user.id, key = uid + ":" + path;
    var found = cache.get(key);
    if (found && found.expires > Date.now()) return found.url;
    var signed = await sb.storage.from("media").createSignedUrl(path, 300);
    if (version !== generation || signed.error || !signed.data) return "";
    var url = signed.data.signedUrl || "";
    if (url) cache.set(key, { url: url, expires: Date.now() + 240000 });
    return url;
  }
  async function hydrate(img) {
    var value = img.getAttribute("src") || img.dataset.kqMediaSource || "";
    if (pathOf(value) === null) return;
    var original = canonical(value), marker = {};
    img.__kqMediaRequest = marker;
    img.dataset.kqMediaSource = original;
    var url = await resolve(original);
    if (img.__kqMediaRequest !== marker || canonical(img.getAttribute("src") || img.dataset.kqMediaSource || "") !== original) return;
    if (url) { if (img.getAttribute("src") !== url) img.setAttribute("src", url); }
    else { img.removeAttribute("src"); img.dataset.kqMediaDenied = "1"; }
  }
  function scan(node) {
    if (node.nodeType !== 1) return;
    if (node.tagName === "IMG") hydrate(node);
    node.querySelectorAll("img").forEach(hydrate);
  }
  function start() {
    scan(document.documentElement);
    new MutationObserver(function (changes) {
      changes.forEach(function (change) {
        if (change.type === "attributes") hydrate(change.target);
        else change.addedNodes.forEach(scan);
      });
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["src"] });
    var sb = g.__kinqsy_sb;
    if (sb) sb.auth.onAuthStateChange(function () {
      generation++; cache.clear();
      document.querySelectorAll("img[data-kq-media-source]").forEach(function (img) {
        img.__kqMediaRequest = null;
        img.setAttribute("src", img.dataset.kqMediaSource);
      });
    });
    setInterval(function () { scan(document.documentElement); }, 60000);
  }
  g.KQMedia = { resolve: resolve, canonical: canonical, pathOf: pathOf, canonicalize: canonicalize };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})(window);

