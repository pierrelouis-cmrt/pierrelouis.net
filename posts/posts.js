/* posts.js — filtering + dynamic borders on /posts/ */

(() => {
  const filters = document.querySelector(".timeline-filters");
  const clearBtn = document.getElementById("clear-filter");
  const timeline = document.getElementById("content-timeline");
  if (!filters || !timeline) return; // not on this page

  /* ensure “no result” node */
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

  /* ---------------- EVENTS ---------------- */
  filters.addEventListener("click", (e) => {
    const btn = e.target.closest(".timeline-filter");
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
    timeline.querySelectorAll(".timeline-item").forEach((it) => {
      it.style.display =
        !activeTag || it.dataset.tag === activeTag ? "" : "none";
    });

    /* 3. hide months with zero visible items */
    timeline.querySelectorAll(".content-timeline-month").forEach((month) => {
      const visibleItem = month.querySelector(
        '.timeline-item:not([style*="display: none"])'
      );
      month.style.display = visibleItem ? "" : "none";
    });

    /* 4. hide years with zero visible months */
    let anyVisible = false;
    timeline
      .querySelectorAll(".content-timeline-header")
      .forEach((yearBlock) => {
        const visibleMonth = yearBlock.querySelector(
          '.content-timeline-month:not([style*="display: none"])'
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
    timeline.querySelectorAll(".timeline-item").forEach((it) => {
      it.style.borderBottom = ""; // revert to stylesheet value
    });
    timeline.querySelectorAll(".content-timeline-month").forEach((m) => {
      m.style.borderBottom = "";
    });

    /* per-month: last visible item loses border */
    timeline.querySelectorAll(".content-timeline-month").forEach((month) => {
      if (month.style.display === "none") return;
      const vis = [...month.querySelectorAll(".timeline-item")].filter(
        (it) => it.style.display !== "none"
      );
      if (vis.length) {
        vis[vis.length - 1].style.borderBottom = "none";
      }
    });

    /* per-year: last visible month loses border */
    timeline.querySelectorAll(".content-timeline-header").forEach((year) => {
      if (year.style.display === "none") return;
      const months = [
        ...year.querySelectorAll(":scope .content-timeline-month"),
      ].filter((m) => m.style.display !== "none");
      if (months.length) {
        months[months.length - 1].style.borderBottom = "none";
      }
    });
  }

  /* initial pass */
  applyFilter();
})();
