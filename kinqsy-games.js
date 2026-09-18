/* Game search: CheapShark (no key) + Steam library art. No binaries hosted. */
(function (global) {
  function steamPoster(appId) {
    if (!appId) return "";
    return "https://cdn.cloudflare.steamstatic.com/steam/apps/" + appId + "/library_600x900.jpg";
  }

  function mapCheap(it) {
    var appId = it.steamAppID || "";
    return {
      source: "steam",
      id: "st-" + (appId || it.gameID || it.external),
      title: it.external || it.internalName || "",
      year: "",
      poster: appId ? steamPoster(appId) : (it.thumb || ""),
      url: appId
        ? ("https://store.steampowered.com/app/" + appId)
        : "https://store.steampowered.com/"
    };
  }

  async function search(opts) {
    opts = opts || {};
    var q = String(opts.q || "").trim();
    if (q.length < 2) throw new Error("введи название игры");
    var r = await fetch("https://www.cheapshark.com/api/1.0/games?title=" + encodeURIComponent(q) + "&limit=16");
    if (!r.ok) throw new Error("поиск игр: " + r.status);
    var j = await r.json();
    var seen = {};
    return (j || []).map(mapCheap).filter(function (g) {
      var k = g.title.toLowerCase();
      if (!g.title || seen[k]) return false;
      seen[k] = true;
      return true;
    }).slice(0, 16);
  }

  async function similar(title) {
    title = String(title || "").trim();
    if (title.length < 2) return [];
    var list = await search({ q: title });
    var skip = title.toLowerCase();
    return list.filter(function (g) {
      return String(g.title || "").toLowerCase() !== skip;
    }).slice(0, 8);
  }

  global.KinqsyGames = { search: search, similar: similar };
})(window);
