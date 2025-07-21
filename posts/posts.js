/* postsFilter.js — filtering + dynamic borders on /posts/ */

(() => {
  const filters = document.querySelector(".post-filters");
  const clearBtn = document.getElementById("clear-filter");
  const timeline = document.getElementById("posts-timeline");
  if (!filters || !timeline) return; // not on this page

  /* ensure “no result” node */
  let noResultMsg = document.getElementById("no-result");
  if (!noResultMsg) {
    noResultMsg = Object.assign(document.createElement("p"), {
      id: "no-result",
      className: "no-result",
      style:
        "display:none;text-align:center;margin-top:2rem;color:var(--caption);",
      textContent: "No result",
    });
    timeline.after(noResultMsg);
  }

  let activeTag = "";

  /* ---------------- EVENTS ---------------- */
  filters.addEventListener("click", (e) => {
    const btn = e.target.closest(".post-filter");
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

  /* ---------------- CORE ---------------- */
  function applyFilter() {
    /* 1. toggle button highlight */
    [...filters.children].forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.tag === activeTag)
    );

    /* 2. show / hide individual items */
    timeline.querySelectorAll(".post-item").forEach((it) => {
      it.style.display =
        !activeTag || it.dataset.tag === activeTag ? "" : "none";
    });

    /* 3. hide months with zero visible items */
    timeline.querySelectorAll(".timeline-month").forEach((month) => {
      const visibleItem = month.querySelector(
        '.post-item:not([style*="display: none"])'
      );
      month.style.display = visibleItem ? "" : "none";
    });

    /* 4. hide years with zero visible months */
    let anyVisible = false;
    timeline.querySelectorAll(".timeline-header").forEach((yearBlock) => {
      const visibleMonth = yearBlock.querySelector(
        '.timeline-month:not([style*="display: none"])'
      );
      yearBlock.style.display = visibleMonth ? "" : "none";
      if (visibleMonth) anyVisible = true;
    });

    /* 5. adjust borders so last visible month/item has none */
    adjustBorders();

    /* 6. aux UI */
    noResultMsg.style.display = anyVisible ? "none" : "";
    if (clearBtn) clearBtn.style.display = activeTag ? "" : "none";
  }

  /* ---------------- BORDERS ---------------- */
  function adjustBorders() {
    /* reset everything first */
    timeline.querySelectorAll(".post-item").forEach((it) => {
      it.style.borderBottom = ""; // revert to stylesheet value
    });
    timeline.querySelectorAll(".timeline-month").forEach((m) => {
      m.style.borderBottom = "";
    });

    /* per-month: last visible item loses border */
    timeline.querySelectorAll(".timeline-month").forEach((month) => {
      if (month.style.display === "none") return;
      const vis = [...month.querySelectorAll(".post-item")].filter(
        (it) => it.style.display !== "none"
      );
      if (vis.length) {
        vis[vis.length - 1].style.borderBottom = "none";
      }
    });

    /* per-year: last visible month loses border */
    timeline.querySelectorAll(".timeline-header").forEach((year) => {
      if (year.style.display === "none") return;
      const months = [
        ...year.querySelectorAll(":scope .timeline-month"),
      ].filter((m) => m.style.display !== "none");
      if (months.length) {
        months[months.length - 1].style.borderBottom = "none";
      }
    });
  }

  /* initial pass */
  applyFilter();
})();
