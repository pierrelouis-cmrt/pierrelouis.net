// Theme

document.addEventListener("alpine:init", () => {
  Alpine.store("theme", {
    mode: "system",

    init() {
      // Check for saved theme preference
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "dark") {
        this.dark();
      } else if (savedTheme === "light") {
        this.light();
      } else {
        this.system();
      }

      // Watch for system theme changes
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", () => {
          if (this.mode === "system") {
            this.applySystemTheme();
          }
        });
    },

    toggle() {
      if (this.mode === "system") {
        this.light();
      } else if (this.mode === "light") {
        this.dark();
      } else {
        this.system();
      }
    },

    dark() {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      this.mode = "dark";
    },

    light() {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      this.mode = "light";
    },

    system() {
      localStorage.removeItem("theme");
      this.mode = "system";
      this.applySystemTheme();
    },

    applySystemTheme() {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    },
  });
});
