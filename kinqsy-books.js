/* Open Library search. Covers via covers.openlibrary.org. No API key. */
(function (global) {
  var SUBJECTS = [
    { id: "", name: "все жанры" },
    { id: "fiction", name: "fiction" },
    { id: "romance", name: "romance" },
    { id: "horror", name: "horror" },
    { id: "fantasy", name: "fantasy" },
    { id: "science_fiction", name: "sci-fi" },
    { id: "mystery", name: "mystery" },
    { id: "poetry", name: "poetry" },
    { id: "history", name: "history" },
    { id: "biography", name: "biography" },
    { id: "young_adult", name: "young adult" },
    { id: "classics", name: "classics" },
    { id: "thriller", name: "thriller" }
  ];

  function coverUrl(doc) {
    if (doc.cover_i) return "https://covers.openlibrary.org/b/id/" + doc.cover_i + "-M.jpg";
    if (doc.cover_edition_key) {
      return "https://covers.openlibrary.org/b/olid/" + doc.cover_edition_key + "-M.jpg";
    }
    return "";
  }

  function mapDoc(doc) {
    var authors = doc.author_name || [];
    return {
      source: "openlibrary",
      id: "ol-" + (doc.key || doc.cover_edition_key || doc.title),
      title: doc.title || "",
      author: authors[0] || "",
      year: doc.first_publish_year ? String(doc.first_publish_year) : "",
      poster: coverUrl(doc),
      url: doc.key ? ("https://openlibrary.org" + doc.key) : "https://openlibrary.org"
    };
  }

  async function search(opts) {
    opts = opts || {};
    var q = String(opts.q || "").trim();
    var subject = String(opts.genre || "");
    var yearFrom = opts.yearFrom ? Number(opts.yearFrom) : 0;
    var yearTo = opts.yearTo ? Number(opts.yearTo) : 0;
    var author = String(opts.author || "").trim();
    if (!q && !subject && !author) throw new Error("введи название, автора или жанр");

    var params = "limit=20";
    if (author) params += "&author=" + encodeURIComponent(author);
    if (q) params += "&q=" + encodeURIComponent(q);
    if (subject) params += "&subject=" + encodeURIComponent(subject.replace(/_/g, " "));
    if (!q && !author && subject) params += "&q=" + encodeURIComponent(subject.replace(/_/g, " "));

    var r = await fetch("https://openlibrary.org/search.json?" + params);
    if (!r.ok) throw new Error("Open Library: " + r.status);
    var j = await r.json();
    return (j.docs || []).map(mapDoc).filter(function (b) {
      var y = parseInt(b.year, 10);
      if (yearFrom && (!y || y < yearFrom)) return false;
      if (yearTo && (!y || y > yearTo)) return false;
      return true;
    }).slice(0, 16);
  }

  function fillFilters(genreEl, fromEl, toEl) {
    if (genreEl) {
      genreEl.innerHTML = SUBJECTS.map(function (g) {
        return '<option value="' + g.id + '">' + g.name + "</option>";
      }).join("");
    }
    function years(el, ph) {
      if (!el) return;
      var html = '<option value="">' + ph + "</option>";
      var y;
      for (y = 2026; y >= 1800; y--) html += '<option value="' + y + '">' + y + "</option>";
      el.innerHTML = html;
    }
    years(fromEl, "год от");
    years(toEl, "год до");
  }

  async function byAuthor(author, excludeTitle) {
    author = String(author || "").trim();
    if (!author) return [];
    var list = await search({ author: author });
    var skip = String(excludeTitle || "").toLowerCase();
    return list.filter(function (b) {
      return String(b.title || "").toLowerCase() !== skip;
    }).slice(0, 8);
  }

  global.KinqsyBooks = { search: search, byAuthor: byAuthor, fillFilters: fillFilters };
})(window);
