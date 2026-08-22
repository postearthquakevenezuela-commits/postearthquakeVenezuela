/* ============================================================
   Post-earthquake Venezuela — site logic (multi-page)
   Set the values in CONFIG and everything else works on its own.
   ============================================================ */

const CONFIG = {
  currency: "USD",
  // Google Sheet PUBLISHED as CSV (File → Share → Publish to web → CSV).
  // Leave empty to use demo data.
  sheetCsvUrl: "",
  // Expected headers (any order, EN or ES): date/fecha | description/concepto | destination/destino | amount/monto
};

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* ---------- Intro (home page only) ---------- */
(function initIntro() {
  const intro = $("#intro");
  if (!intro) return;
  let revealed = false;

  function reveal() {
    if (revealed) return;
    revealed = true;
    intro.classList.add("is-revealed");
    const hint = $("#introHint");
    if (hint) hint.textContent = "";
  }
  function dismiss(e) {
    if (e) e.preventDefault();
    intro.classList.add("is-hidden");
    document.body.style.overflow = "";
    setTimeout(() => intro.remove(), 700);
  }

  // Lock scrolling while the intro is visible.
  document.body.style.overflow = "hidden";

  // First click/touch: reveal the subtitle. (Don't trigger from the buttons.)
  intro.addEventListener("click", (e) => {
    if (e.target.closest(".intro__actions")) return;
    reveal();
  });
  intro.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") reveal(); });

  $("#introEnter") && $("#introEnter").addEventListener("click", (e) => {
    if (!revealed) { reveal(); e.preventDefault(); return; }
    dismiss(e);
  });
  $("#introSkip") && $("#introSkip").addEventListener("click", dismiss);
})();

/* ---------- Mobile menu ---------- */
(function initNav() {
  const toggle = $("#navToggle");
  const nav = $("#siteNav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
})();

/* ---------- Art Fair (Art Fair page only) ---------- */
// One city = one Google Sheet. Each section reads its sheet live on every load.
// To add a city, paste its sheet id below (Share → Anyone with the link).
const ARTFAIR_CITIES = [
  {
    name: "Houston",
    sheetId: "1Xv2k4e3i6gE-GGTPPZBznLVKzNvgObJs1FwBu3Wio78",
    submitUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfIkl9H9oeomfBjAgEEoeUf5m7kJX3dpUdYHxo1UTAmlhiU2Q/viewform?pli=1",
    announceHtml: 'Art League Houston will host a fundraising pop up art fair for Venezuelan earthquake victims on <strong>Saturday, August 22, from 6&ndash;9 pm</strong>, at its Montrose art space, <strong>1953 Montrose Blvd, Houston, TX 77006</strong>. The fair is organized by Violette Bule, with Beatriz Bellorín, Luisa Duarte, Nicolás Gerardi, Gabriela Magaña, Rosa Ana Orlando and Eleanora Rodriguez. For more information or to donate, <a href="polyrithm.html">click here</a>.',
  },
  { // live gallery + submissions still open
    name: "Miami",
    sheetId: "1reaSPn1zwLc6TGJfCTdcXBlnbb1cfVemHg8rLDqx10w",
    submitUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfiVPnxenVfPQuLdfRk2k8fFcZheYWGapP68jFjw_RoDUjEjg/viewform",
  },
  { name: "Pittsburgh", sheetId: "" },  // paste the Pittsburgh sheet id here
];

(function initArtFair() {
  const root = document.querySelector("#artFair");
  if (!root) return;
  const esc = (s) => (s || "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // lh3 public-content CDN loads in the browser; drive.google.com/thumbnail redirects to sign-in for Workspace files.
  const driveImg = (id, w = 1200) => `https://lh3.googleusercontent.com/d/${id}=w${w}`;
  const driveView = (id) => `https://drive.google.com/file/d/${id}/view`;
  const driveIds = (s) => [...(s || "").matchAll(/(?:id=|\/d\/)([A-Za-z0-9_-]{20,})/g)].map((m) => m[1]);
  const firstId = (s) => driveIds(s)[0] || "";
  const instaOf = (s) => {
    s = (s || "").trim();
    if (!s) return ["", ""];
    if (/^https?:\/\//i.test(s)) { const h = s.replace(/\/+$/,"").split("/").pop().replace(/^@/,""); return ["@" + h, s]; }
    const h = s.replace(/^@/, "").split(/\s+/)[0];
    return h ? ["@" + h, "https://instagram.com/" + h] : ["", ""];
  };

  // Map a sheet header (long form-question text) to a short field key.
  function indexColumns(header) {
    const n = (x) => (x || "").toString().toLowerCase();
    const find = (kw) => header.findIndex((h) => kw.every((k) => n(h).includes(k)));
    return {
      name: find(["name"]),
      insta: find(["instagram"]),
      bio: find(["artist", "bio"]),
      donate: find(["percentage"]) >= 0 ? find(["percentage"]) : find(["donate"]),
      art: find(["art", "works"]),
      ilist: find(["image", "list"]),
      // "price" also appears in the donation question and the image-list column's description; exclude both.
      price: header.findIndex((h) => n(h).includes("price") && !n(h).includes("percentage") && !n(h).includes("image")),
      based: find(["based"]),
      catalog: find(["added", "catalog"]),
      sold: find(["sold"]) >= 0 ? find(["sold"]) : find(["vendido"]),
    };
  }

  // "Sold" cell holds piece numbers matching the "Piece N of M" the buyer sees
  // (e.g. "1" or "1,3"), or "ALL" if every piece from this artist is gone.
  //
  // A single photo standing in for a multi-copy edition (10 identical prints
  // of the same image) can write "copiesSold/copiesTotal" instead, e.g. "6/10".
  //
  // When an artist has SEVERAL different editions — two books, each with its
  // own page/photo AND its own copy count — give each piece its own fraction
  // with the same "N:" numbering used for per-piece pricing:
  // "1: 3/10, 2: 5/20" (book 1 has 3 of 10 sold, book 2 has 5 of 20 sold).
  // A per-piece segment can also just be "N: ALL" for one edition fully gone.
  function parseSold(raw) {
    const str = raw || "";
    const all = /\ball\b/i.test(str) && !/:/.test(str);
    const perPiece = new Map();
    const perPieceRe = /(?:^|,)\s*(\d+)\s*:\s*([^,]+)/g;
    let pm;
    while ((pm = perPieceRe.exec(str))) {
      const val = pm[2].trim();
      const frac = val.match(/(\d+)\s*\/\s*(\d+)/);
      perPiece.set(parseInt(pm[1], 10), frac
        ? { copiesSold: parseInt(frac[1], 10), copiesTotal: parseInt(frac[2], 10) }
        : { sold: true });
    }
    const rest = str.replace(perPieceRe, "");
    const copies = rest.match(/(\d+)\s*\/\s*(\d+)/);
    const copiesSold = copies ? parseInt(copies[1], 10) : null;
    const copiesTotal = copies ? parseInt(copies[2], 10) : null;
    const pieces = new Set(rest.replace(/\d+\s*\/\s*\d+/, "").split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n)));
    return { all, pieces, copiesSold, copiesTotal, perPiece };
  }

  // Resolves one piece's sold state: per-piece entry first, else the
  // whole-artist copies/pieces/ALL fields.
  function pieceStatus(sold, pieceNum) {
    if (!sold) return { sold: false, remaining: null, total: null };
    const pp = sold.perPiece.get(pieceNum);
    if (pp) {
      if (pp.sold) return { sold: true, remaining: null, total: null };
      const remaining = pp.copiesTotal - (pp.copiesSold || 0);
      return { sold: remaining <= 0, remaining, total: pp.copiesTotal };
    }
    if (sold.all || sold.pieces.has(pieceNum)) return { sold: true, remaining: null, total: null };
    if (sold.copiesTotal != null) {
      const remaining = sold.copiesTotal - (sold.copiesSold || 0);
      return { sold: remaining <= 0, remaining, total: sold.copiesTotal };
    }
    return { sold: false, remaining: null, total: null };
  }

  // Per-piece pricing: "1: $300, 2: $450, 3: $600" maps piece numbers (same
  // "Piece N of M" numbering as Sold) to their own price text. A price cell
  // with no "N:" segments is left alone — every existing artist's plain price
  // ("$500", "Retail $500, Sale $300"…) keeps working exactly as before.
  function parsePriceMap(raw) {
    const map = new Map();
    const re = /(?:^|,)\s*(\d+)\s*:\s*([^,]+)/g;
    let m;
    while ((m = re.exec(raw || ""))) map.set(parseInt(m[1], 10), m[2].trim());
    return map.size ? map : null;
  }

  // Price shown for one specific piece (buy button, carousel) — falls back to
  // the flat price when this artist doesn't use per-piece pricing.
  function priceForPiece(a, pieceNum) {
    const map = parsePriceMap(a.price);
    return map ? (map.get(pieceNum) || "") : a.price;
  }

  function rowsToArtworks(rows) {
    if (!rows.length) return [];
    const c = indexColumns(rows[0]);
    const get = (r, i) => (i >= 0 && i < r.length ? (r[i] || "").trim() : "");
    return rows.slice(1).map((r) => {
      const [handle, iurl] = instaOf(get(r, c.insta));
      const bioCell = get(r, c.bio);
      const bioIds = driveIds(bioCell);
      return {
        name: get(r, c.name), instagram: handle, instagramUrl: iurl,
        based: get(r, c.based), price: get(r, c.price), donate: get(r, c.donate),
        imageIds: driveIds(get(r, c.art)),
        bioId: bioIds[0] || "", bioText: bioIds.length ? "" : bioCell, // Miami bios come as inline text
        imageListId: firstId(get(r, c.ilist)),
        soldRaw: get(r, c.sold),
      };
    }).filter((a) => a.name || a.imageIds.length);
  }

  // Merge rows by artist: one artist = one entry holding ALL their pieces.
  function groupByArtist(list) {
    const map = new Map();
    for (const a of list) {
      const key = (a.name || "").trim().toLowerCase();
      if (!key) { map.set("_" + map.size, { ...a, imageIds: [...a.imageIds] }); continue; }
      if (!map.has(key)) map.set(key, { ...a, imageIds: [...a.imageIds] });
      else {
        const g = map.get(key);
        for (const id of a.imageIds) if (!g.imageIds.includes(id)) g.imageIds.push(id);
        for (const k of ["instagram", "instagramUrl", "based", "price", "donate", "bioId", "bioText", "imageListId"])
          if (!g[k] && a[k]) g[k] = a[k];
        if (a.soldRaw) g.soldRaw = [g.soldRaw, a.soldRaw].filter(Boolean).join(",");
      }
    }
    for (const g of map.values()) g.sold = parseSold(g.soldRaw);
    return [...map.values()];
  }

  // Guards against stray links or long text landing in the price cell (messy sheet data).
  const realPrice = (p) => (p && !/^https?:\/\//i.test(p) && p.length <= 40) ? p : "";

  // Summary price for the artist header: a plain price as-is, or (with
  // per-piece pricing) the first piece's price prefixed "From" if pieces differ.
  function priceSummary(a) {
    const map = parsePriceMap(a.price);
    if (!map) return realPrice(a.price);
    const vals = [...map.values()].map(realPrice).filter(Boolean);
    if (!vals.length) return "";
    return new Set(vals).size === 1 ? vals[0] : `From ${vals[0]}`;
  }

  function metaHtml(a) {
    const p = [];
    if (a.instagram) p.push(`<a href="${esc(a.instagramUrl)}" target="_blank" rel="noopener">${esc(a.instagram)}</a>`);
    if (a.based) p.push(`<span>${esc(a.based)}</span>`);
    const price = priceSummary(a);
    if (price) p.push(`<span class="badge">${esc(price)}</span>`);
    if (a.donate) p.push(`<span class="badge">Donates ${esc(a.donate)}</span>`);
    return p.join("");
  }

  // No per-artwork checkout — send buyers to the Buy page (payment info + a form that emails us the details,
  // pre-filled with artist, piece, and a reference image so nobody has to type it from memory).
  function buyHtml(a, slideIdx) {
    const status = pieceStatus(a.sold, slideIdx + 1);
    if (status.sold) return `<p class="detail__buy"><span class="btn btn--sold" aria-disabled="true">Sold — Vendido</span></p>`;
    const price = realPrice(priceForPiece(a, slideIdx + 1));
    const total = a.imageIds.length;
    const piece = total > 1 ? `Piece ${slideIdx + 1} of ${total}` : "";
    const img = total ? a.imageIds[slideIdx] || a.imageIds[0] : "";
    const params = new URLSearchParams({ artist: a.name, city: a.city || "", piece, img });
    const left = status.remaining !== null ? ` (${status.remaining} of ${status.total} left)` : "";
    const label = price ? `Buy this piece — ${esc(price)}${left} →` : `Buy this piece${left} →`;
    return `<p class="detail__buy"><a class="btn" href="buy.html?${params.toString()}">${label}</a></p>`;
  }

  // Light clean for bios typed directly into the sheet cell (strip leading name / ABOUT label).
  function cleanInlineBio(t, name) {
    const lines = t.replace(/\r/g, "\n").replace(/ /g, " ").split("\n").map((l) => l.trim());
    const surname = (name || "").split(/\s+/).pop().toLowerCase();
    while (lines.length) {
      const l0 = lines[0];
      if (!l0) { lines.shift(); continue; }
      const low = l0.toLowerCase().replace(/[:.\-–—\s]+$/, "");
      if (/^(about|bio|biography|artist(?:'s)? statement|statement)$/.test(low)) { lines.shift(); continue; }
      if (name && (low === name.toLowerCase() || (l0.split(/\s+/).length <= 5 && surname && low.includes(surname)))) { lines.shift(); continue; }
      break;
    }
    return lines.join(" ").replace(/\s{2,}/g, " ").trim();
  }

  // Bio block: clean prose, capped at a sentence boundary, rendered as paragraphs.
  function bioHtml(a) {
    const inline = (a.bioText && a.bioText.trim()) ? cleanInlineBio(a.bioText, a.name) : "";
    const raw = inline || ((a.bioId ? BIOS[a.bioId] : "") || "");
    const link = a.bioId ? driveView(a.bioId) : "";
    if (raw.trim()) {
      let t = raw.trim(), truncated = false;
      if (t.length > 800) {
        let cut = t.slice(0, 800);
        const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
        t = stop > 400 ? cut.slice(0, stop + 1) : cut.trim() + "…";
        truncated = true;
      }
      const paras = t.split(/\n{2,}/).map((p) => `<p>${esc(p.trim()).replace(/\n+/g, " ")}</p>`).join("");
      const more = truncated && link ? `<p class="detail__link"><a href="${link}" target="_blank" rel="noopener">Read full bio ↗</a></p>` : "";
      return `<div class="detail__bio">${paras}${more}</div>`;
    }
    if (link) return `<p class="detail__link">Artist bio: <a href="${link}" target="_blank" rel="noopener">open ↗</a></p>`;
    return "";
  }

  function detailLinks(a) {
    return a.imageListId
      ? `<p class="detail__link">Artwork details (titles, medium, dimensions, price): <a href="${driveView(a.imageListId)}" target="_blank" rel="noopener">open ↗</a></p>`
      : "";
  }

  let ALL = []; // global registry of artists across all cities (detail uses ALL[i])
  let BIOS = {}; // bioId -> extracted bio text (from data/bios.json)
  fetch("data/bios.json", { cache: "no-store" }).then((r) => r.json()).then((b) => { BIOS = b || {}; }).catch(() => {});

  function allSold(a) {
    if (!a.sold) return false;
    const total = a.imageIds.length;
    if (!total) return a.sold.all;
    for (let n = 1; n <= total; n++) if (!pieceStatus(a.sold, n).sold) return false;
    return true;
  }

  function cardHtml(a, gi) {
    const first = a.imageIds[0];
    const img = first
      ? `<img src="${driveImg(first, 800)}" alt="Work by ${esc(a.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();this.closest('.art-card__img').classList.add('is-empty')">`
      : "";
    // A single "N left" badge only makes sense when the whole artist is one edition
    // (no per-piece copy counts to disambiguate) — open the piece for per-book status.
    const status0 = a.sold && !a.sold.perPiece.size ? pieceStatus(a.sold, 1) : null;
    const count = status0 && status0.remaining !== null
      ? (status0.remaining > 0 ? `<span class="art-card__count">${status0.remaining} of ${status0.total} left</span>` : "")
      : (a.imageIds.length > 1 ? `<span class="art-card__count">${a.imageIds.length} works</span>` : "");
    const based = a.based ? `<span>${esc(a.based)}</span>` : "";
    const donate = a.donate ? `<span class="badge">${esc(a.donate)}</span>` : "";
    const sold = allSold(a) ? `<span class="art-card__sold">Sold — Vendido</span>` : "";
    return `<button class="art-card" data-i="${gi}" aria-label="View works by ${esc(a.name)}">
      <span class="art-card__img${first ? "" : " is-empty"}">${img}<span class="art-card__ph">Image on Google Drive</span>${count}${sold}</span>
      <span class="art-card__body">
        <span class="art-card__name">${esc(a.name)}</span>
        <span class="art-card__meta">${based}${donate}</span>
      </span>
    </button>`;
  }

  // Render one city's artists into its grid, registering them in the global ALL list.
  function renderCity(artists, gridEl, cityName) {
    artists.forEach((a) => { a.city = cityName || a.city || ""; });
    // Artists with images first; those without any image go to the end (stable).
    artists.sort((a, b) => (b.imageIds.length ? 1 : 0) - (a.imageIds.length ? 1 : 0));
    const start = ALL.length;
    ALL.push(...artists);
    gridEl.innerHTML = artists.map((a, k) => cardHtml(a, start + k)).join("") || '<p class="muted">No works yet.</p>';
    gridEl.querySelectorAll(".art-card").forEach((b) => b.addEventListener("click", () => openDetail(+b.dataset.i)));
    runSearch(); // re-apply an active search now that more artists just loaded
  }

  // Search across every loaded city (name, technique/medium, price, location, bio…).
  function matchesQuery(a, q) {
    const hay = [a.name, a.based, a.price, a.donate, a.instagram, a.city, a.bioText, a.bioId ? BIOS[a.bioId] : ""]
      .filter(Boolean).join(" ").toLowerCase();
    return q.split(/\s+/).filter(Boolean).every((term) => hay.includes(term));
  }

  function runSearch() {
    const input = document.querySelector("#artFairSearch");
    const resultsEl = document.querySelector("#artFairResults");
    const hint = document.querySelector("#artFairSearchHint");
    const listEl = document.querySelector("#artFair");
    if (!input || !resultsEl || !listEl) return;
    const q = input.value.trim().toLowerCase();
    if (!q) {
      resultsEl.hidden = true;
      listEl.hidden = false;
      if (hint) hint.hidden = true;
      return;
    }
    listEl.hidden = true;
    resultsEl.hidden = false;
    const matches = ALL.map((a, i) => ({ a, i })).filter(({ a }) => matchesQuery(a, q));
    resultsEl.innerHTML = matches.length
      ? `<div class="artfair-grid">${matches.map(({ a, i }) => cardHtml(a, i)).join("")}</div>`
      : `<p class="muted">No matches yet — try a different name, technique, or price.</p>`;
    resultsEl.querySelectorAll(".art-card").forEach((b) => b.addEventListener("click", () => openDetail(+b.dataset.i)));
    if (hint) {
      hint.hidden = false;
      hint.textContent = `${matches.length} artist${matches.length === 1 ? "" : "s"} found across Houston, Miami, and Pittsburgh.`;
    }
  }

  document.querySelector("#artFairSearch")?.addEventListener("input", runSearch);

  // ----- Detail screen with photo carousel -----
  const detail = document.querySelector("#artDetail");
  let cur = null, idx = 0;

  function showSlide(n) {
    const imgs = cur.imageIds;
    const total = imgs.length || 1;
    idx = ((n % total) + total) % total;
    const imgEl = document.querySelector("#carImg");
    const ph = document.querySelector("#carPh");
    if (imgs.length) {
      imgEl.style.display = ""; ph.style.display = "none";
      imgEl.onerror = () => { imgEl.style.display = "none"; ph.style.display = "grid"; };
      imgEl.src = driveImg(imgs[idx], 1600); imgEl.alt = cur.name;
    } else { imgEl.style.display = "none"; ph.style.display = "grid"; }
    document.querySelectorAll("#carDots button").forEach((d, k) => d.setAttribute("aria-current", String(k === idx)));
    const multi = imgs.length > 1;
    document.querySelector("#carPrev").style.display = multi ? "" : "none";
    document.querySelector("#carNext").style.display = multi ? "" : "none";
    document.querySelector("#carDots").style.display = multi ? "" : "none";
    document.querySelector("#dBuy").innerHTML = buyHtml(cur, idx);
  }

  function openDetail(i) {
    if (!detail) return;
    cur = ALL[i]; idx = 0;
    document.querySelector("#dName").textContent = cur.name;
    document.querySelector("#dMeta").innerHTML = metaHtml(cur);
    document.querySelector("#dLinks").innerHTML = bioHtml(cur) + detailLinks(cur);
    document.querySelector("#carDots").innerHTML = cur.imageIds.map((_, k) => `<button data-k="${k}" aria-label="Image ${k + 1}"></button>`).join("");
    document.querySelectorAll("#carDots button").forEach((d) => d.addEventListener("click", () => showSlide(+d.dataset.k)));
    showSlide(0);
    detail.classList.add("is-open");
    detail.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeDetail() {
    detail.classList.remove("is-open");
    detail.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  if (detail) {
    document.querySelector("#detailClose").addEventListener("click", closeDetail);
    document.querySelector("#carPrev").addEventListener("click", () => showSlide(idx - 1));
    document.querySelector("#carNext").addEventListener("click", () => showSlide(idx + 1));
    detail.addEventListener("click", (e) => { if (e.target === detail) closeDetail(); });
    document.addEventListener("keydown", (e) => {
      if (!detail.classList.contains("is-open")) return;
      if (e.key === "Escape") closeDetail();
      else if (e.key === "ArrowLeft") showSlide(idx - 1);
      else if (e.key === "ArrowRight") showSlide(idx + 1);
    });
  }

  const csvUrl = (id) => `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`;

  // Build a section per city, then load each city's sheet live and fill its grid.
  root.innerHTML = ARTFAIR_CITIES.map((c, i) => {
    let body;
    // Always-visible header info (date/time/venue) — kept OUTSIDE the <details> so it
    // reads and shares without needing to expand the accordion.
    const eventInfo = c.announceHtml
      ? `<p class="event-info">${c.announceHtml}</p>`
      : (c.date || c.venue)
      ? `<p class="event-info">${[c.date, c.venue].filter(Boolean).map(esc).join(" — ")}</p>`
      : "";
    if (c.sheetId) {
      const banner = c.submitUrl ? `<p class="open-banner"><strong>Submissions now open</strong> — <a href="${esc(c.submitUrl)}" target="_blank" rel="noopener">Fill the form, be part of our fair ↗</a></p>` : "";
      body = banner + `<div class="artfair-grid" id="city-${i}"><p class="muted">Loading catalog from Google…</p></div>`;
    } else if (c.formEmbed) {
      body = `<div class="open-call">
        <p class="open-call__status">Submissions now open</p>
        <p class="open-call__text">We warmly encourage artists to take part. Donate an artwork, artist book, zine, or fanzine to help raise funds for emergency medical relief in Venezuela.</p>
        <div class="form-embed"><iframe src="${esc(c.formEmbed)}" title="${esc(c.name)} submission form" loading="lazy">Loading…</iframe></div>
        <p class="detail__link"><a href="${esc(c.submitUrl)}" target="_blank" rel="noopener">Fill the form, be part of our fair ↗</a></p>
      </div>`;
    } else if (c.submitUrl) {
      body = `<div class="open-call">
        <p class="open-call__status">Submissions now open</p>
        <p class="open-call__text">We warmly encourage artists to take part. Donate an artwork, artist book, zine, or fanzine to help raise funds for emergency medical relief in Venezuela.</p>
        <a class="btn" href="${esc(c.submitUrl)}" target="_blank" rel="noopener">Fill the form, be part of our fair →</a>
      </div>`;
    } else {
      body = `<p class="muted city-soon">Coming soon.</p>`;
    }
    const announceBlock = eventInfo ? `<div class="city-announce">${eventInfo}</div>` : "";
    return `${announceBlock}<details class="city-acc">
      <summary class="city-tab"><span>${esc(c.name)}</span><span class="city-tab__sign">+</span></summary>
      <div class="city-acc__body">${body}</div>
    </details>`;
  }).join("");

  ARTFAIR_CITIES.forEach((c, i) => {
    const gridEl = document.querySelector(`#city-${i}`);
    if (!c.sheetId) return; // city without a sheet yet → keep the placeholder
    fetch(csvUrl(c.sheetId), { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then((text) => {
        const artists = groupByArtist(rowsToArtworks(parseCSV(text)));
        if (!artists.length) { gridEl.innerHTML = '<p class="muted">No works yet.</p>'; return; }
        renderCity(artists, gridEl, c.name);
      })
      .catch((err) => {
        console.warn("Art Fair " + c.name + " fetch failed:", err);
        if (i === 0) { // the bundled copy is the first city's catalog
          fetch("data/artfair.json", { cache: "no-store" })
            .then((r) => r.json()).then((l) => renderCity(groupByArtist(l), gridEl, c.name))
            .catch(() => { gridEl.innerHTML = '<p class="muted">Could not load the catalog.</p>'; });
        } else {
          gridEl.innerHTML = '<p class="muted">Could not load this catalog.</p>';
        }
      });
  });
})();

/* ---------- Courses calendar (Courses page only) ---------- */
(function initCourses() {
  const wrap = document.querySelector("#courseCalendar");
  if (!wrap) return;

  // Upcoming courses. Edit here to add/remove/change dates.
  const COURSES = [
    { date: "2026-07-20", instructor: "Violette Bule",    topic: "Interactive Installation" },
    { date: "2026-07-25", instructor: "Teresa Mullet",    topic: "Artist Book" },
    { date: "2026-07-28", instructor: "Mu Blanco",        topic: "Sound Art" },
    { date: "2026-09-05", instructor: "Yucef Merhi",      topic: "Creative Code" },
    { date: "2026-09-15", instructor: "Ana Alenso",       topic: "Assemblage" },
    { date: "2026-09-26", instructor: "Ruben D'Hers",     topic: "Sound Installation" },
    { date: "2026-09-28", instructor: "Jaime Reyes",      topic: "Code & Video Mapping" },
    { date: "2026-09-30", instructor: "Ionee Waterhouse", topic: "VJing" },
    { date: "2026-10-02", instructor: "Miyo Van Stenis",  topic: "3D & Sedition" },
  ];

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const esc = (s) => (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const parts = (iso) => { const [y, m, d] = iso.split("-").map(Number); return { y, m, d }; };
  const longDate = (iso) => { const p = parts(iso); return `${MONTHS[p.m - 1]} ${p.d}, ${p.y}`; };

  // Group by "Month Year", preserving order.
  let html = "", currentKey = "";
  COURSES.forEach((c, i) => {
    const p = parts(c.date);
    const key = `${MONTHS[p.m - 1]} ${p.y}`;
    if (key !== currentKey) { html += `<h2 class="cal-month">${key}</h2>`; currentKey = key; }
    html += `<button class="cal-item" data-i="${i}">
      <span class="cal-item__date"><span class="cal-item__day">${String(p.d).padStart(2, "0")}</span><span class="cal-item__mon">${MONTHS[p.m - 1].slice(0, 3)}</span></span>
      <span><span class="cal-item__name">${esc(c.instructor)}</span><span class="cal-item__topic">${esc(c.topic)}</span></span>
      <span class="cal-item__go">Support / Book →</span>
    </button>`;
  });
  wrap.innerHTML = html;

  // Modal wiring
  const modal = document.querySelector("#courseModal");
  const mDate = document.querySelector("#modalDate");
  const mName = document.querySelector("#modalName");
  const mTopic = document.querySelector("#modalTopic");
  const mBook = document.querySelector("#modalBook");
  const bookEmail = (document.querySelector("#bookAll")?.getAttribute("href") || "mailto:hello@example.com").split("?")[0];

  function open(c) {
    mDate.textContent = longDate(c.date);
    mName.textContent = c.instructor;
    mTopic.textContent = c.topic;
    mBook.setAttribute("href", `${bookEmail}?subject=${encodeURIComponent("Booking — " + c.instructor + " · " + c.topic)}`);
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }
  function close() { modal.classList.remove("is-open"); modal.setAttribute("aria-hidden", "true"); }

  wrap.querySelectorAll(".cal-item").forEach((btn) =>
    btn.addEventListener("click", () => open(COURSES[+btn.dataset.i]))
  );
  document.querySelector("#modalClose")?.addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
})();

/* ---------- Buy a piece (Buy page only) ---------- */
(function initBuyForm() {
  const form = document.querySelector("#buyForm");
  if (!form) return;

  const params = new URLSearchParams(location.search);
  const artist = params.get("artist") || "";
  const city = params.get("city") || "";
  const piece = params.get("piece") || "";
  const img = params.get("img") || "";
  const imgView = img ? `https://drive.google.com/file/d/${img}/view` : "";

  const artistField = document.querySelector("#bfArtist");
  if (artist && artistField) artistField.value = artist;
  const pieceField = document.querySelector("#bfPiece");
  if (pieceField) pieceField.value = piece || (artist ? `Work by ${artist}` : "");

  const intro = document.querySelector("#buyIntro");
  if (intro && artist) {
    intro.textContent = `We've filled in the piece and artist below — just add your name and email so we can confirm your purchase${city ? " (" + city + ")" : ""}.`;
  }

  const ref = document.querySelector("#buyRef");
  if (ref && img) {
    ref.hidden = false;
    document.querySelector("#buyRefImg").src = `https://lh3.googleusercontent.com/d/${img}=w200`;
    document.querySelector("#buyRefTitle").textContent = piece || artist;
    document.querySelector("#buyRefSub").textContent = artist && piece ? `by ${artist}` : "";
  }

  // Payment-memo reminders: tell buyers what to write in each method's note/memo
  // so an incoming Zelle/PayPal/Venmo payment can be matched to a purchase.
  const esc = (s) => (s || "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const refLabel = [artist, piece].filter(Boolean).join(" — ");
  if (refLabel) {
    const memoHtml = (method) => `<strong>${esc(method)} note:</strong> write "${esc(refLabel)}". <em>Nota del ${esc(method)}: escribe "${esc(refLabel)}".</em>`;
    const setMemo = (id, method) => { const el = document.querySelector(id); if (el) el.innerHTML = memoHtml(method); };
    setMemo("#memoPaypal", "PayPal");
    setMemo("#memoVenmo", "Venmo");
    setMemo("#memoZelle", "Zelle");
    const generic = document.querySelector("#memoGeneric");
    if (generic) generic.hidden = true;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = (id) => (document.querySelector(id)?.value || "").trim();
    const to = city.toLowerCase() === "houston" ? "artistsforvenezuela@gmail.com" : "artistsforvenezuelamiami@gmail.com";
    const subject = `Purchase — ${val("#bfArtist")} — ${val("#bfPiece")}`;
    const body = [
      `Artist: ${val("#bfArtist")}`,
      `Piece: ${val("#bfPiece")}`,
      city ? `City: ${city}` : "",
      imgView ? `Reference image: ${imgView}` : "",
      "",
      `From: ${val("#bfName")} (${val("#bfEmail")})`,
      `Shipping address: ${val("#bfShipping")}`,
      "",
      val("#bfMessage"),
    ].filter(Boolean).join("\n");
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
})();

/* ---------- Donate confirmation form (Zelle/PayPal/Venmo donate pages) ---------- */
(function initDonateForm() {
  const form = document.querySelector("#donateForm");
  if (!form) return;
  const method = form.dataset.method || "Donation";

  const dateField = document.querySelector("#zfDate");
  const today = new Date();
  if (dateField) {
    dateField.value = today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = (id) => (document.querySelector(id)?.value || "").trim();
    const to = "artistsforvenezuelamiami@gmail.com";
    const subject = `${method} donation — ${val("#zfFirstName")} ${val("#zfLastName")}`;
    const body = [
      `Método: ${method}`,
      `Nombre: ${val("#zfFirstName")}`,
      `Apellido: ${val("#zfLastName")}`,
      `Monto Abonado: ${val("#zfAmount")}`,
      `Fecha: ${val("#zfDate")}`,
    ].join("\n");
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
})();

/* ---------- Transparency (Polyrithm page only) ---------- */
function formatMoney(n) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: CONFIG.currency, maximumFractionDigits: 0 }).format(n);
  } catch { return "$" + Math.round(n).toLocaleString("en-US"); }
}

function parseCSV(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let k = 0; k < text.length; k++) {
    const c = text[k], n = text[k + 1];
    if (q) {
      if (c === '"' && n === '"') { field += '"'; k++; }
      else if (c === '"') { q = false; }
      else field += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c !== "\r") field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

const norm = (s) => (s || "").toString().trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// Handles both "1,800" (thousands comma) and "12,50" (decimal comma), plus
// mixed formats like "1,234.56" or "1.234,56" — whichever separator comes
// last is the decimal point; the other is stripped as a thousands separator.
const parseAmount = (s) => {
  let str = (s || "").toString().trim().replace(/[^\d.,-]/g, "");
  if (!str) return 0;
  const lastComma = str.lastIndexOf(","), lastDot = str.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    str = lastComma > lastDot ? str.replace(/\./g, "").replace(",", ".") : str.replace(/,/g, "");
  } else if (lastComma > -1) {
    const parts = str.split(",");
    str = (parts.length === 2 && parts[1].length <= 2) ? str.replace(",", ".") : str.replace(/,/g, "");
  }
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
};

function rowsToRecords(rows) {
  if (!rows.length) return [];
  const h = rows[0].map(norm);
  const idx = (names) => h.findIndex((x) => names.includes(x));
  const iF = idx(["fecha", "date"]), iC = idx(["concepto", "concept", "detalle", "descripcion"]),
        iD = idx(["destino", "destination", "beneficiario"]), iM = idx(["monto", "amount", "cantidad", "valor"]);
  return rows.slice(1).map((r) => ({
    fecha: iF >= 0 ? r[iF] : "", concepto: iC >= 0 ? r[iC] : "",
    destino: iD >= 0 ? r[iD] : "Medical relief", monto: parseAmount(iM >= 0 ? r[iM] : "0"),
  }));
}

// "Venezuelan Auction List" spreadsheet is the SOLE source of sale/donation
// money for Transparency — the in-person sales/donation ledger used at the
// fair itself. Each room's internal sales list plus the cash donation log
// flow in automatically. (The "Sold"/"Sold Amount" columns on the Art Fair
// city sheets are catalog-only — they drive the "Sold" badge/button, but are
// deliberately NOT summed here, because the same sale ends up recorded in
// both places and would be double-counted.)
const AUCTION_LIST_SHEET_ID = "1g9KJnHsUBlU_HzlAl2sSzXhOEcWqTb3Hw4Fw1cri6RY";
const AUCTION_LIST_ROOMS = [
  { gid: "1909031784", room: "Room A" },
  { gid: "1019884490", room: "Room B" },
  { gid: "2080770292", room: "Room C" },
];
const AUCTION_LIST_CASH_GID = "812683634";

async function fetchGidCsv(sheetId, gid) {
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return parseCSV(await res.text());
}

async function computeAuctionListRecords() {
  const records = [];
  // Internal Sales List Room A/B/C: Artist Name | Artwork Title | Sale Price |
  // Donation Percentage | Total or Rounded Donation Amount (if applicable) | Buyer | Paid to | Payment Method
  for (const { gid, room } of AUCTION_LIST_ROOMS) {
    try {
      const rows = await fetchGidCsv(AUCTION_LIST_SHEET_ID, gid);
      for (const r of rows.slice(1)) {
        const artist = (r[0] || "").trim(), title = (r[1] || "").trim();
        if (!artist && !title) continue;
        const salePrice = parseAmount(r[2] || "");
        const pct = parseAmount(r[3] || "");
        const donationAmt = parseAmount(r[4] || "");
        const amount = donationAmt > 0 ? donationAmt : salePrice * ((pct || 100) / 100);
        if (amount > 0) {
          records.push({
            fecha: new Date().toISOString().slice(0, 10),
            concepto: `Art sale — ${artist}${title ? " — " + title : ""}`,
            destino: `Art Fair Houston (${room})`,
            monto: amount,
          });
        }
      }
    } catch (err) {
      console.warn("Could not load auction list " + room, err);
    }
  }
  // Cash Donation: Date | Name | Donation Amount | Via | Recipient
  try {
    const rows = await fetchGidCsv(AUCTION_LIST_SHEET_ID, AUCTION_LIST_CASH_GID);
    for (const r of rows.slice(1)) {
      const amount = parseAmount(r[2] || "");
      if (amount > 0) {
        records.push({
          fecha: (r[0] || "").trim() || new Date().toISOString().slice(0, 10),
          concepto: `Donation — ${(r[1] || "").trim() || "Anonymous"}`,
          destino: (r[3] || "Cash donation").trim(),
          monto: amount,
        });
      }
    }
  } catch (err) {
    console.warn("Could not load cash donations", err);
  }
  return records;
}

function escapeHtml(s) {
  return (s || "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderData(records) {
  const total = records.reduce((a, r) => a + (r.monto || 0), 0);
  $("#progressRaised") && ($("#progressRaised").textContent = formatMoney(total));
  const body = $("#ledgerBody");
  if (!body) return;
  body.innerHTML = records.length
    ? records.map((r) => `<tr><td>${escapeHtml(r.fecha)}</td><td>${escapeHtml(r.concepto)}</td><td>${escapeHtml(r.destino || "Medical relief")}</td><td class="num">${formatMoney(r.monto)}</td></tr>`).join("")
    : '<tr><td colspan="4" class="muted">No transfers recorded yet.</td></tr>';
}

async function loadData() {
  if (!$("#ledgerBody")) return; // not on the Polyrithm page
  const extra = await computeAuctionListRecords();
  if (!CONFIG.sheetCsvUrl) { renderData(extra); return; }
  try {
    const res = await fetch(CONFIG.sheetCsvUrl, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const records = rowsToRecords(parseCSV(await res.text()));
    renderData([...records, ...extra]);
  } catch (err) {
    console.warn("Could not load the sheet:", err);
    renderData(extra);
  }
}
loadData();
