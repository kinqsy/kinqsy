/* Album search: Deezer (no key) → iTunes fallback.
   Search in RU ok. Profile stores original album title. No audio hosted. */
(function (global) {
  var GENRES = [
    { id: "", name: "все жанры" },
    { id: "132", name: "pop", itunes: "pop" },
    { id: "152", name: "rock", itunes: "rock" },
    { id: "85", name: "indie / alternative", itunes: "alternative" },
    { id: "165", name: "metal", itunes: "metal" },
    { id: "116", name: "rap / hip-hop", itunes: "hip-hop" },
    { id: "169", name: "r&b / soul", itunes: "r&b" },
    { id: "106", name: "electronic", itunes: "electronic" },
    { id: "113", name: "dance", itunes: "dance" },
    { id: "129", name: "jazz", itunes: "jazz" },
    { id: "98", name: "classical", itunes: "classical" },
    { id: "466", name: "folk", itunes: "folk" },
    { id: "144", name: "reggae", itunes: "reggae" },
    { id: "153", name: "blues", itunes: "blues" },
    { id: "173", name: "soundtrack", itunes: "soundtrack" },
    { id: "84", name: "country", itunes: "country" }
  ];

  function genreMeta(id) {
    var i;
    for (i = 0; i < GENRES.length; i++) {
      if (GENRES[i].id && GENRES[i].id === String(id)) return GENRES[i];
    }
    return null;
  }

  function mapDeezer(it) {
    return {
      source: "deezer",
      id: "dz-" + it.id,
      title: it.title || "",
      artist: (it.artist && it.artist.name) || "",
      year: (it.release_date || "").slice(0, 4),
      poster: it.cover_medium || it.cover || "",
      url: it.link || ("https://www.deezer.com/album/" + it.id),
      genre_id: it.genre_id ? String(it.genre_id) : ""
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
      url: it.collectionViewUrl || "",
      genre: it.primaryGenreName || ""
    };
  }

  function inYearRange(item, yearFrom, yearTo) {
    var y = parseInt(item.year, 10);
    if (!y) return !yearFrom && !yearTo;
    if (yearFrom && y < yearFrom) return false;
    if (yearTo && y > yearTo) return false;
    return true;
  }

  function matchGenre(item, genreId) {
    if (!genreId) return true;
    if (item.genre_id && String(item.genre_id) === String(genreId)) return true;
    var meta = genreMeta(genreId);
    if (!meta) return true;
    var g = String(item.genre || "").toLowerCase();
    if (!g) return !item.genre_id;
    return g.indexOf(meta.itunes) !== -1 || g.indexOf(meta.name.split(" / ")[0]) !== -1;
  }

  async function searchDeezer(q) {
    var r = await fetch("https://api.deezer.com/search/album?q=" + encodeURIComponent(q) + "&limit=25");
    if (!r.ok) throw new Error("deezer " + r.status);
    var j = await r.json();
    return (j.data || []).map(mapDeezer);
  }

  async function searchItunes(q) {
    var r = await fetch("https://itunes.apple.com/search?term=" + encodeURIComponent(q) +
      "&entity=album&limit=25&country=ru");
    if (!r.ok) throw new Error("itunes " + r.status);
    var j = await r.json();
    return (j.results || []).map(mapItunes);
  }

  async function chartDeezer(genreId) {
    var path = genreId
      ? "https://api.deezer.com/chart/" + encodeURIComponent(genreId) + "/albums"
      : "https://api.deezer.com/chart/0/albums";
    var r = await fetch(path);
    if (!r.ok) throw new Error("deezer chart " + r.status);
    var j = await r.json();
    return (j.data || []).map(mapDeezer);
  }

  function merge(a, b) {
    var seen = {};
    var out = [];
    function add(item) {
      var k = (item.title + "|" + item.artist).toLowerCase();
      if (seen[k]) return;
      seen[k] = true;
      out.push(item);
    }
    a.forEach(add);
    b.forEach(add);
    return out;
  }

  async function search(opts) {
    opts = opts || {};
    var q = String(opts.q || "").trim();
    var artist = String(opts.artist || "").trim();
    var genre = String(opts.genre || "");
    var yearFrom = opts.yearFrom ? Number(opts.yearFrom) : 0;
    var yearTo = opts.yearTo ? Number(opts.yearTo) : 0;
    if (!q && !artist && !genre && !yearFrom && !yearTo) {
      throw new Error("введи название, исполнителя или жанр / год");
    }

    var meta = genreMeta(genre);
    var term = q || artist || (meta ? meta.name.split(" / ")[0] : "") || String(yearFrom || "album");
    var deezer = [];
    var itunes = [];

    try {
      deezer = (q || artist) ? await searchDeezer(term) : await chartDeezer(genre);
    } catch (e) {}
    try {
      itunes = await searchItunes(term);
    } catch (e) {}

    var list = merge(deezer, itunes).filter(function (m) {
      if (!matchGenre(m, genre) || !inYearRange(m, yearFrom, yearTo)) return false;
      if (!artist) return true;
      var a = String(m.artist || "").toLowerCase();
      var want = artist.toLowerCase();
      return a.indexOf(want) !== -1 || want.indexOf(a) !== -1;
    });
    return list.slice(0, 16);
  }

  function fillYearSelect(el, placeholder) {
    if (!el) return;
    var html = '<option value="">' + placeholder + "</option>";
    var y;
    for (y = 2026; y >= 1950; y--) {
      html += '<option value="' + y + '">' + y + "</option>";
    }
    el.innerHTML = html;
  }

  function fillFilters(genreEl, fromEl, toEl) {
    if (genreEl) {
      genreEl.innerHTML = GENRES.map(function (g) {
        return '<option value="' + g.id + '">' + g.name + "</option>";
      }).join("");
    }
    fillYearSelect(fromEl, "год от");
    fillYearSelect(toEl, "год до");
  }

  async function byArtist(artist, excludeTitle) {
    artist = String(artist || "").trim();
    if (!artist) return [];
    var list = await search({ artist: artist });
    var skip = String(excludeTitle || "").toLowerCase();
    return list.filter(function (m) {
      return String(m.title || "").toLowerCase() !== skip;
    }).slice(0, 8);
  }

  global.KinqsyMusic = { search: search, byArtist: byArtist, fillFilters: fillFilters };
})(window);
