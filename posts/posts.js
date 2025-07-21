/* posts.js — generate timeline for /posts/ *and* “latest” block on /index/ */
const DATA_URL = "/posts/posts.json";

/* ------------ Tag → SVG icon map ------------ */
const SVG_ICONS = {
  Notes: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/>
      <path d="M15 3v4a2 2 0 0 0 2 2h4"/>
    </svg>`,
  Articles: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" 
         fill="none" stroke="currentColor" stroke-width="2" 
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
      <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
      <path d="M10 9H8"/><path d="M16 13H8"/>
      <path d="M16 17H8"/>
    </svg>`,
};

/* ------------ Helpers ------------ */
function groupBy(arr, key) {
  return arr.reduce((map, obj) => {
    const k = obj[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(obj);
    return map;
  }, new Map());
}

function el(tag, attrs = {}, ...kids) {
  const { dataset: ds, ...rest } = attrs;
  const n = Object.assign(document.createElement(tag), rest);
  if (ds) Object.assign(n.dataset, ds);
  n.append(...kids.flat());
  return n;
}

function svgEl(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  return tpl.content.firstChild;
}

function monthAbbr(monthName) {
  /* Turn “July” → “Jul”, “September” → “Sep”… */
  return monthName.slice(0, 3);
}

/* ------------ DOM refs ------------ */
const filters = document.querySelector(".post-filters");
const clearBtn = document.getElementById("clear-filter");
const timeline = document.getElementById("posts-timeline");
const latestContainer = document.getElementById("latest-posts");

let noResultMsg;
if (timeline) {
  noResultMsg = el(
    "p",
    {
      id: "no-result",
      className: "no-result",
      style:
        "display:none;text-align:center;margin-top:2rem;color:var(--caption);",
    },
    "No result"
  );
  timeline.after(noResultMsg);
}

let activeTag = "";

/* ------------ Fetch & Render ------------ */
fetch(DATA_URL)
  .then((r) => r.json())
  .then((items) => {
    /* Newest first once for everyone */
    items.sort(
      (a, b) =>
        b.year - a.year ||
        new Date(`${b.month} 1 2000`) - new Date(`${a.month} 1 2000`) ||
        b.day - a.day
    );

    if (timeline) renderTimeline(items);
    if (latestContainer) renderLatestPosts(items.slice(0, 3)); // top-3 only
  })
  .catch((err) => console.error("JSON load failed:", err));

/* ------------ TIMELINE (posts page) ------------ */
function renderTimeline(items) {
  const byYear = groupBy(items, "year");
  const frag = document.createDocumentFragment();

  for (const [year, list] of byYear) {
    frag.appendChild(makeYearSection(year, list));
  }
  timeline.appendChild(frag);
}

function makeYearSection(year, items) {
  const box = el("div", { className: "timeline-header" });
  box.append(
    el("div", { className: "timeline-year" }, el("h2", {}, year)),
    makeMonthColumn(items)
  );
  return box;
}

function makeMonthColumn(items) {
  const col = el("div", { className: "timeline-content" });
  const byMonth = groupBy(items, "month");

  for (const [month, list] of byMonth) {
    list.sort((a, b) => b.day - a.day); // newest day first
    const monthDiv = el("div", { className: "timeline-month" });
    monthDiv.append(
      el(
        "div",
        { className: "month-header" },
        el(
          "h3",
          {},
          `${month}`,
          el("span", { className: "full-year" }, ` ${list[0].year}`)
        )
      ),
      el("div", { className: "month-items" }, ...list.map(makeItem))
    );
    col.appendChild(monthDiv);
  }
  return col;
}

function makeItem(p) {
  const item = el("div", {
    className: "post-item",
    dataset: { tag: p.tag },
  });

  const a = el("a", {
    href: p.link,
    target: "_blank",
    rel: "noopener noreferrer",
  });

  /* title + icon */
  const title = el(
    "div",
    { className: "post-title" },
    svgEl(SVG_ICONS[p.tag] || ""),
    el("span", { className: "link-text" }, p.title),
    el("span", { className: "external-icon", ariaHidden: "true" }, "↗")
  );
  a.append(title);

  /* description */
  if (p.description) {
    a.append(el("div", { className: "post-description" }, p.description));
  }

  /* preview image */
  if (p.image) {
    a.append(
      el(
        "div",
        { className: "post-preview" },
        el(
          "figure",
          {},
          el("img", {
            src: p.image,
            loading: "lazy",
            alt: `${p.title} preview`,
          })
        )
      )
    );
  }

  item.appendChild(a);
  return item;
}

/* ------------ FILTERING (posts page) ------------ */
if (filters && clearBtn) {
  filters.addEventListener("click", (e) => {
    const btn = e.target.closest(".post-filter");
    if (!btn) return;

    if (btn.id === "clear-filter" || btn.dataset.tag === activeTag) {
      activeTag = "";
    } else {
      activeTag = btn.dataset.tag;
    }
    applyFilter();
  });

  clearBtn.addEventListener("click", () => {
    activeTag = "";
    applyFilter();
  });
}

function applyFilter() {
  /* button UI */
  [...filters.children].forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.tag === activeTag)
  );

  /* show / hide items */
  timeline.querySelectorAll(".post-item").forEach((it) => {
    it.style.display = !activeTag || it.dataset.tag === activeTag ? "" : "none";
  });

  /* hide empty months */
  timeline.querySelectorAll(".timeline-month").forEach((month) => {
    const hasVisible = month.querySelector(
      '.post-item:not([style*="display: none"])'
    );
    month.style.display = hasVisible ? "" : "none";
  });

  /* hide empty years */
  let anyVisible = false;
  timeline.querySelectorAll(".timeline-header").forEach((yearBlock) => {
    const hasVisibleMonth = yearBlock.querySelector(
      '.timeline-month:not([style*="display: none"])'
    );
    yearBlock.style.display = hasVisibleMonth ? "" : "none";
    if (hasVisibleMonth) anyVisible = true;
  });

  /* no-result message */
  noResultMsg.style.display = anyVisible ? "none" : "";

  /* clear-filter button */
  clearBtn.style.display = activeTag ? "" : "none";
}

/* ------------ LATEST POSTS (home page) ------------ */
function renderLatestPosts(latest) {
  /* Clear any placeholder markup */
  latestContainer.innerHTML = "";

  latest.forEach((p) => latestContainer.appendChild(makeLatestItem(p)));
}

function makeLatestItem(p) {
  /* <div class="post__item">… */
  const wrapper = el("div", { className: "post__item" });

  /* <a class="inline-icon post__link" … > */
  const a = el("a", {
    className: "inline-icon post__link",
    href: p.link,
    target: "_blank",
    rel: "noopener noreferrer",
  });

  /* ----- Title block ----- */
  const title = el(
    "div",
    { className: "post-title" },
    svgEl(SVG_ICONS[p.tag] || ""),
    el("span", { className: "link-text" }, p.title),
    el("span", { className: "external-icon", ariaHidden: "true" }, "↗")
  );

  /* Separator & date */
  const separator = el("div", { className: "post__separator" });
  const date = el(
    "div",
    { className: "post__date" },
    `${monthAbbr(p.month)} ${p.year}`
  );

  a.append(title, separator, date);
  wrapper.appendChild(a);
  return wrapper;
}
