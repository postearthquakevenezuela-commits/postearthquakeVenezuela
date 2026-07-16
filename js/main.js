/* ============================================================
   Post-earthquake Venezuela — site logic (multi-page)
   Set the values in CONFIG and everything else works on its own.
   ============================================================ */

const CONFIG = {
  goal: 10000,
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
  { name: "Houston", sheetId: "1Xv2k4e3i6gE-GGTPPZBznLVKzNvgObJs1FwBu3Wio78" },
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
      // "price" also appears in the donation question ("...sale price..."); exclude it.
      price: header.findIndex((h) => n(h).includes("price") && !n(h).includes("percentage")),
      based: find(["based"]),
      catalog: find(["added", "catalog"]),
    };
  }

  function rowsToArtworks(rows) {
    if (!rows.length) return [];
    const c = indexColumns(rows[0]);
    const get = (r, i) => (i >= 0 && i < r.length ? (r[i] || "").trim() : "");
    return rows.slice(1).map((r) => {
      const [handle, iurl] = instaOf(get(r, c.insta));
      return {
        name: get(r, c.name), instagram: handle, instagramUrl: iurl,
        based: get(r, c.based), price: get(r, c.price), donate: get(r, c.donate),
        imageIds: driveIds(get(r, c.art)), bioId: firstId(get(r, c.bio)), imageListId: firstId(get(r, c.ilist)),
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
        for (const k of ["instagram", "instagramUrl", "based", "price", "donate", "bioId", "imageListId"])
          if (!g[k] && a[k]) g[k] = a[k];
      }
    }
    return [...map.values()];
  }

  function metaHtml(a) {
    const p = [];
    if (a.instagram) p.push(`<a href="${esc(a.instagramUrl)}" target="_blank" rel="noopener">${esc(a.instagram)}</a>`);
    if (a.based) p.push(`<span>${esc(a.based)}</span>`);
    if (a.donate) p.push(`<span class="badge">Donates ${esc(a.donate)}</span>`);
    return p.join("");
  }

  // Bio block: clean prose, capped at a sentence boundary, rendered as paragraphs.
  function bioHtml(a) {
    const raw = (a.bioId ? BIOS[a.bioId] : "") || "";
    const link = a.bioId ? driveView(a.bioId) : "";
    if (raw.trim()) {
      let t = raw.trim(), truncated = false;
      if (t.length > 560) {
        let cut = t.slice(0, 560);
        const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
        t = stop > 300 ? cut.slice(0, stop + 1) : cut.trim() + "…";
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

  function cardHtml(a, gi) {
    const first = a.imageIds[0];
    const img = first
      ? `<img src="${driveImg(first, 800)}" alt="Work by ${esc(a.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();this.closest('.art-card__img').classList.add('is-empty')">`
      : "";
    const count = a.imageIds.length > 1 ? `<span class="art-card__count">${a.imageIds.length} works</span>` : "";
    const based = a.based ? `<span>${esc(a.based)}</span>` : "";
    const donate = a.donate ? `<span class="badge">${esc(a.donate)}</span>` : "";
    return `<button class="art-card" data-i="${gi}" aria-label="View works by ${esc(a.name)}">
      <span class="art-card__img${first ? "" : " is-empty"}">${img}<span class="art-card__ph">Image on Google Drive</span>${count}</span>
      <span class="art-card__body">
        <span class="art-card__name">${esc(a.name)}</span>
        <span class="art-card__meta">${based}${donate}</span>
      </span>
    </button>`;
  }

  // Render one city's artists into its grid, registering them in the global ALL list.
  function renderCity(artists, gridEl) {
    // Artists with images first; those without any image go to the end (stable).
    artists.sort((a, b) => (b.imageIds.length ? 1 : 0) - (a.imageIds.length ? 1 : 0));
    const start = ALL.length;
    ALL.push(...artists);
    gridEl.innerHTML = artists.map((a, k) => cardHtml(a, start + k)).join("") || '<p class="muted">No works yet.</p>';
    gridEl.querySelectorAll(".art-card").forEach((b) => b.addEventListener("click", () => openDetail(+b.dataset.i)));
  }

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
    if (c.sheetId) {
      const banner = c.submitUrl ? `<p class="open-banner"><strong>Submissions now open</strong> — <a href="${esc(c.submitUrl)}" target="_blank" rel="noopener">submit your work ↗</a></p>` : "";
      body = banner + `<div class="artfair-grid" id="city-${i}"><p class="muted">Loading catalog from Google…</p></div>`;
    } else if (c.formEmbed) {
      body = `<div class="open-call">
        <p class="open-call__status">Submissions now open</p>
        <p class="open-call__text">We warmly encourage artists to take part. Donate an artwork, artist book, zine, or fanzine to help raise funds for emergency medical relief in Venezuela.</p>
        <div class="form-embed"><iframe src="${esc(c.formEmbed)}" title="${esc(c.name)} submission form" loading="lazy">Loading…</iframe></div>
        <p class="detail__link"><a href="${esc(c.submitUrl)}" target="_blank" rel="noopener">Or open the form in a new tab ↗</a></p>
      </div>`;
    } else if (c.submitUrl) {
      body = `<div class="open-call">
        <p class="open-call__status">Submissions now open</p>
        <p class="open-call__text">We warmly encourage artists to take part. Donate an artwork, artist book, zine, or fanzine to help raise funds for emergency medical relief in Venezuela.</p>
        <a class="btn" href="${esc(c.submitUrl)}" target="_blank" rel="noopener">Submit your work →</a>
      </div>`;
    } else {
      body = `<p class="muted city-soon">Coming soon.</p>`;
    }
    const open = i === 0 ? " open" : "";
    return `<details class="city-acc"${open}>
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
        renderCity(artists, gridEl);
      })
      .catch((err) => {
        console.warn("Art Fair " + c.name + " fetch failed:", err);
        if (i === 0) { // the bundled copy is the first city's catalog
          fetch("data/artfair.json", { cache: "no-store" })
            .then((r) => r.json()).then((l) => renderCity(groupByArtist(l), gridEl))
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
const parseAmount = (s) => {
  const n = parseFloat((s || "").toString().replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
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

const DEMO = [
  { fecha: "2026-06-28", concepto: "Weekly donations", destino: "Medical relief", monto: 1850 },
  { fecha: "2026-06-21", concepto: "Charity raffle", destino: "Medical relief", monto: 1200 },
  { fecha: "2026-06-14", concepto: "Individual contributions", destino: "Medical relief", monto: 2450 },
  { fecha: "2026-06-07", concepto: "Benefit concert", destino: "Medical relief", monto: 3100 },
];

function escapeHtml(s) {
  return (s || "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderData(records, isDemo) {
  const total = records.reduce((a, r) => a + (r.monto || 0), 0);
  const pct = Math.min(100, CONFIG.goal ? (total / CONFIG.goal) * 100 : 0);
  $("#progressRaised") && ($("#progressRaised").textContent = formatMoney(total));
  $("#progressGoal") && ($("#progressGoal").textContent = "Goal: " + formatMoney(CONFIG.goal));
  $("#progressFill") && ($("#progressFill").style.width = pct.toFixed(1) + "%");
  const note = $("#dataNote");
  if (note) note.textContent = isDemo
    ? "Demo data. Connect your Google Sheet in js/main.js (CONFIG.sheetCsvUrl) to show live figures."
    : "Live data from the spreadsheet. Updates on page reload.";
  const body = $("#ledgerBody");
  if (!body) return;
  body.innerHTML = records.length
    ? records.map((r) => `<tr><td>${escapeHtml(r.fecha)}</td><td>${escapeHtml(r.concepto)}</td><td>${escapeHtml(r.destino || "Medical relief")}</td><td class="num">${formatMoney(r.monto)}</td></tr>`).join("")
    : '<tr><td colspan="4" class="muted">No transfers recorded yet.</td></tr>';
}

async function loadData() {
  if (!$("#ledgerBody")) return; // not on the Polyrithm page
  if (!CONFIG.sheetCsvUrl) { renderData(DEMO, true); return; }
  try {
    const res = await fetch(CONFIG.sheetCsvUrl, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const records = rowsToRecords(parseCSV(await res.text()));
    renderData(records.length ? records : DEMO, records.length === 0);
  } catch (err) {
    console.warn("Could not load the sheet, using demo data:", err);
    renderData(DEMO, true);
  }
}
loadData();
