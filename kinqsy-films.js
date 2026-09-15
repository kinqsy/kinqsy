/* TMDB movie search for kinqsy vitrine.
   Search language: ru-RU. Profile stores original_title. */
(function (global) {
  var IMG = "https://image.tmdb.org/t/p/w342";
  var API = "https://api.themoviedb.org/3";

  var GENRES = [
    { id: "", name: "все жанры" },
    { id: "28", name: "боевик" },
    { id: "12", name: "приключения" },
    { id: "16", name: "мультфильм" },
    { id: "35", name: "комедия" },
    { id: "80", name: "криминал" },
    { id: "99", name: "документальный" },
    { id: "18", name: "драма" },
    { id: "10751", name: "семейный" },
    { id: "14", name: "фэнтези" },
    { id: "36", name: "история" },
    { id: "27", name: "ужасы" },
    { id: "10402", name: "музыка" },
    { id: "9648", name: "детектив" },
    { id: "10749", name: "мелодрама" },
    { id: "878", name: "фантастика" },
    { id: "10770", name: "телевизионный" },
    { id: "53", name: "триллер" },
    { id: "10752", name: "военный" },
    { id: "37", name: "вестерн" }
  ];

  function apiKey() {
    return String(global.KINQSY_TMDB_KEY || "").trim();
  }

  function qs(params) {
    return Object.keys(params)
      .filter(function (k) { return params[k] !== "" && params[k] != null; })
      .map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); })
      .join("&");
  }

  function mapMovie(it) {
    var original = (it.original_title || it.title || "").trim();
    var localized = (it.title || "").trim();
    var year = (it.release_date || "").slice(0, 4);
    return {
      source: "tmdb",
      id: String(it.id),
      title: original,
      title_ru: localized && localized !== original ? localized : "",
      year: year,
      poster: it.poster_path ? (IMG + it.poster_path) : "",
      url: "https://www.themoviedb.org/movie/" + it.id,
      genre_ids: it.genre_ids || []
    };
  }

  function inYearRange(movie, yearFrom, yearTo) {
    var y = parseInt(movie.year, 10);
    if (!y) return !yearFrom && !yearTo;
    if (yearFrom && y < yearFrom) return false;
    if (yearTo && y > yearTo) return false;
    return true;
  }

  function hasGenre(movie, genreId) {
    if (!genreId) return true;
    var id = Number(genreId);
    return (movie.genre_ids || []).indexOf(id) !== -1;
  }

  async function tmdb(path, params) {
    var key = apiKey();
    if (!key) throw new Error("Нет ключа TMDB. Впиши его в kinqsy-keys.js");
    params = params || {};
    params.api_key = key;
    params.language = "ru-RU";
    params.include_adult = "false";
    var r = await fetch(API + path + "?" + qs(params));
    if (!r.ok) throw new Error("TMDB: " + r.status);
    return r.json();
  }

  async function search(opts) {
    opts = opts || {};
    var q = String(opts.q || "").trim();
    var genre = String(opts.genre || "");
    var yearFrom = opts.yearFrom ? Number(opts.yearFrom) : 0;
    var yearTo = opts.yearTo ? Number(opts.yearTo) : 0;
    var list = [];

    if (q) {
      var data = await tmdb("/search/movie", { query: q, page: "1" });
      list = (data.results || []).map(mapMovie);
      list = list.filter(function (m) {
        return hasGenre(m, genre) && inYearRange(m, yearFrom, yearTo);
      });
    } else {
      var disc = {
        sort_by: "popularity.desc",
        page: "1"
      };
      if (genre) disc.with_genres = genre;
      if (yearFrom) disc["primary_release_date.gte"] = yearFrom + "-01-01";
      if (yearTo) disc["primary_release_date.lte"] = yearTo + "-12-31";
      if (!genre && !yearFrom && !yearTo) {
        throw new Error("введи название или выбери жанр / год");
      }
      var found = await tmdb("/discover/movie", disc);
      list = (found.results || []).map(mapMovie);
    }

    return list.slice(0, 16);
  }

  function fillYearSelect(el, placeholder) {
    if (!el) return;
    var html = '<option value="">' + placeholder + "</option>";
    var y;
    for (y = 2026; y >= 1920; y--) {
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

  global.KinqsyFilms = {
    search: search,
    fillFilters: fillFilters,
    hasKey: function () { return !!apiKey(); }
  };
})(window);
