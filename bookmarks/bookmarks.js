/* bookmarks.js — generate timeline from /bookmarks/bookmarks.json  */
const DATA_URL = "/bookmarks/bookmarks.json";

const filters = document.querySelector(".post-filters");
const clearBtn = document.getElementById("clear-filter");
const timeline = document.getElementById("posts-timeline");

const noResultMsg = el(
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

let activeTag = "";

fetch(DATA_URL)
  .then((r) => r.json())
  .then(renderTimeline)
  .catch((err) => console.error("JSON load failed:", err));

/* ---------------- EVENTS ---------------- */
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

/* ---------------- RENDER ---------------- */
function renderTimeline(items) {
  /* newest first */
  items.sort(
    (a, b) =>
      b.year - a.year ||
      new Date(`${b.month} 1 2000`) - new Date(`${a.month} 1 2000`)
  );

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
    const monthDiv = el("div", { className: "timeline-month" });
    monthDiv.append(
      el(
        "div",
        { className: "month-header" },
        el("h3", {
          innerHTML: `${month}<span class="full-year"> ${list[0].year}</span>`,
        })
      ),
      el("div", { className: "month-items" }, ...list.map(makeItem))
    );
    col.appendChild(monthDiv);
  }
  return col;
}

function makeItem(b) {
  const item = el("div", {
    className: "post-item",
    dataset: { tag: b.tag },
  });
  const a = el("a", {
    href: b.link,
    target: "_blank",
    rel: "noopener noreferrer",
  });

  /* title + icon */
  a.append(
    el(
      "div",
      { className: "post-title" },
      el("span", { className: "link-text" }, b.title),
      el("span", { className: "external-icon" }, "↗")
    ),
    /* meta */
    el(
      "div",
      { className: "post-meta" },
      el("img", { src: b.meta.icon, width: 16, height: 16, alt: "" }),
      el("span", {}, b.meta.text)
    )
  );

  if (b.description) {
    a.append(el("div", { className: "post-description" }, b.description));
  }

  if (b.image) {
    a.append(
      el(
        "div",
        { className: "post-preview" },
        el(
          "figure",
          {},
          el("img", {
            src: b.image,
            loading: "lazy",
            alt: `${b.title} preview`,
          })
        )
      )
    );
  }

  item.appendChild(a);
  return item;
}

/* ---------------- FILTER ---------------- */
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

/* ---------------- UTIL ---------------- */
function groupBy(arr, key) {
  return arr.reduce((map, obj) => {
    const k = obj[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(obj);
    return map;
  }, new Map());
}

function el(tag, attrs = {}, ...kids) {
  const { dataset: ds, ...rest } = attrs; // separate dataset
  const n = Object.assign(document.createElement(tag), rest);
  if (ds) Object.assign(n.dataset, ds); // mutate fields only
  n.append(...kids.flat());
  return n;
}
