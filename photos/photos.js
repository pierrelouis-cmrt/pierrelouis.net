(() => {
  const root = document.querySelector("[data-photo-filters]");

  if (!root) {
    return;
  }

  const buttons = [...root.querySelectorAll("[data-country-filter]")];
  const searchInput = root.querySelector("[data-photo-search]");
  const emptyState = root.querySelector("[data-photo-empty]");
  const albums = [...document.querySelectorAll(".photo-album")];

  const state = {
    country: "all",
    query: "",
  };

  const normalize = (value) => {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  };

  const getAlbumCards = (album) => {
    return [...album.querySelectorAll(".photo-card")];
  };

  const getCardSearchText = (card, album) => {
    return normalize(`${album.dataset.search || ""} ${card.dataset.search || ""}`);
  };

  const updateButton = (button, counts) => {
    const country = button.dataset.countryFilter;
    const isActive = country === state.country;
    const count = button.querySelector("[data-filter-count]");

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));

    if (count) {
      count.hidden = !isActive;
      count.textContent = counts.get(country) || 0;
    }
  };

  const applyFilters = () => {
    const query = normalize(state.query);
    const counts = new Map();
    let visibleTotal = 0;

    counts.set("all", 0);

    for (const album of albums) {
      const albumCountry = album.dataset.country || "";
      const matchesCountry =
        state.country === "all" || albumCountry === state.country;
      let visibleInAlbum = 0;

      for (const card of getAlbumCards(album)) {
        const matchesSearch = !query || getCardSearchText(card, album).includes(query);
        const isVisible = matchesCountry && matchesSearch;

        card.hidden = !isVisible;

        if (matchesSearch) {
          counts.set("all", (counts.get("all") || 0) + 1);
          counts.set(albumCountry, (counts.get(albumCountry) || 0) + 1);
        }

        if (isVisible) {
          visibleInAlbum += 1;
          visibleTotal += 1;
        }
      }

      album.hidden = visibleInAlbum === 0;
    }

    for (const button of buttons) {
      updateButton(button, counts);
    }

    if (emptyState) {
      emptyState.hidden = visibleTotal !== 0;
    }
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      state.country = button.dataset.countryFilter || "all";
      applyFilters();
    });
  }

  searchInput?.addEventListener("input", () => {
    state.query = searchInput.value;
    applyFilters();
  });

  applyFilters();
})();
