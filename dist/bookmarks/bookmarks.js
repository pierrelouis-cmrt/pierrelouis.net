/* bookmarks.js — filtering + dynamic borders on /bookmarks/ */

(() => {
  const filters =
    document.querySelector(".timeline-filters") ||
    document.querySelector(".post-filters");

  const clearBtn = document.getElementById("clear-filter");

  const timeline =
    document.getElementById("content-timeline") ||
    document.getElementById("posts-timeline") ||
    document.querySelector(".content-timeline");

  if (!filters || !timeline) return;

  let noResultMsg = document.getElementById("no-result");
  if (!noResultMsg) {
    noResultMsg = Object.assign(document.createElement("p"), {
      id: "no-result",
      className: "no-result",
      style:
        "display:none;text-align:center;margin-top:2rem;color:var(--text-muted);",
      textContent: "No result",
    });
    timeline.after(noResultMsg);
  }

  let activeTag = "";

  filters.addEventListener("click", (e) => {
    const btn = e.target.closest(".timeline-filter, .post-filter");
    if (!btn) return;

    activeTag =
      btn.id === "clear-filter" || btn.dataset.tag === activeTag
        ? ""
        : btn.dataset.tag;

    applyFilter();
  });

  clearBtn?.addEventListener("click", () => {
    activeTag = "";
    applyFilter();
  });

  function applyFilter() {
    filters
      .querySelectorAll(".timeline-filter, .post-filter")
      .forEach((btn) =>
        btn.classList.toggle("active", btn.dataset.tag === activeTag)
      );

    timeline.querySelectorAll(".timeline-item").forEach((it) => {
      it.style.display =
        !activeTag || it.dataset.tag === activeTag ? "" : "none";
    });

    const monthSel = ".content-timeline-month, .timeline-month";
    timeline.querySelectorAll(monthSel).forEach((month) => {
      const visibleItem = month.querySelector(
        '.timeline-item:not([style*="display: none"])'
      );
      month.style.display = visibleItem ? "" : "none";
    });

    const yearSel = ".content-timeline-header, .timeline-header";
    let anyVisible = false;
    timeline.querySelectorAll(yearSel).forEach((yearBlock) => {
      const visibleMonth = yearBlock.querySelector(
        `${monthSel}:not([style*="display: none"])`
      );
      yearBlock.style.display = visibleMonth ? "" : "none";
      if (visibleMonth) anyVisible = true;
    });

    adjustBorders();

    noResultMsg.style.display = anyVisible ? "none" : "";
    if (clearBtn) clearBtn.style.display = activeTag ? "" : "none";
  }

  function adjustBorders() {
    const monthSel = ".content-timeline-month, .timeline-month";
    const yearSel = ".content-timeline-header, .timeline-header";

    timeline.querySelectorAll(".timeline-item").forEach((it) => {
      it.style.borderBottom = "";
    });
    timeline.querySelectorAll(monthSel).forEach((m) => {
      m.style.borderBottom = "";
    });

    timeline.querySelectorAll(monthSel).forEach((month) => {
      if (month.style.display === "none") return;
      const vis = [...month.querySelectorAll(".timeline-item")].filter(
        (it) => it.style.display !== "none"
      );
      if (vis.length) {
        vis[vis.length - 1].style.borderBottom = "none";
      }
    });

    timeline.querySelectorAll(yearSel).forEach((year) => {
      if (year.style.display === "none") return;
      const months = [...year.querySelectorAll(`:scope ${monthSel}`)].filter(
        (m) => m.style.display !== "none"
      );
      if (months.length) {
        months[months.length - 1].style.borderBottom = "none";
      }
    });
  }

  applyFilter();
})();
