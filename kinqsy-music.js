/* Album search: Deezer (no key) → iTunes fallback.
   Profile stores original album title. No audio hosted. */
(function (global) {
  function mapDeezer(it) {
    return {
      source: "deezer",
      id: "dz-" + it.id,
      title: it.title || "",
      artist: (it.artist && it.artist.name) || "",
      year: (it.release_date || "").slice(0, 4),
      poster: it.cover_medium || it.cover || "",
      url: it.link || ("https://www.deezer.com/album/" + it.id)
    };
  }

  function mapItunes(it) {
    var art = it.artworkUrl100 ? String(it.artworkUrl100).replace("100x100bb", "300x300bb") : "";
    return {
      source: "itunes",
      id: "it-" + it.collectionId,
      title: it.collectionName || "",
      artist: it.artistName || "",
      year: (it.releaseDate || "").slice(0, 4),
      poster: art,
      url: it.collectionViewUrl || ""
    };
  }

  async function searchDeezer(q) {
    var r = await fetch("https://api.deezer.com/search/album?q=" + encodeURIComponent(q) + "&limit=16");
    if (!r.ok) throw new Error("deezer " + r.status);
    var j = await r.json();
    return (j.data || []).map(mapDeezer);
  }

  async function searchItunes(q) {
    var r = await fetch("https://itunes.apple.com/search?term=" + encodeURIComponent(q) +
      "&entity=album&limit=16&country=ru");
    if (!r.ok) throw new Error("itunes " + r.status);
    var j = await r.json();
    return (j.results || []).map(mapItunes);
  }

  async function search(q) {
    q = String(q || "").trim();
    if (q.length < 2) throw new Error("введи название или исполнителя");
    try {
      var a = await searchDeezer(q);
      if (a.length) return a;
    } catch (e) {}
    return searchItunes(q);
  }

  global.KinqsyMusic = { search: search };
})(window);
