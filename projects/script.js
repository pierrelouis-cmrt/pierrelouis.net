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

// Content interaction

document.addEventListener("DOMContentLoaded", function () {
  // Set up scroll animations
  const observerOptions = {
    root: null,
    rootMargin: "0px",
    threshold: 0.1,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll(".animate-on-scroll").forEach((element) => {
    observer.observe(element);
  });

  // Initialize floating tags
  document.querySelectorAll(".tag").forEach((tag, index) => {
    tag.style.setProperty("--delay", index);
  });
});

// Simple lightbox functionality
function openLightbox(src) {
  document.getElementById("lightbox-img").src = src;
  document.getElementById("lightbox").style.display = "flex";
  document.body.style.overflow = "hidden"; // Prevent scrolling
}

function closeLightbox() {
  document.getElementById("lightbox").style.display = "none";
  document.body.style.overflow = "auto"; // Re-enable scrolling
}

// Close lightbox when clicking outside the image
window.onclick = function (event) {
  if (event.target === document.getElementById("lightbox")) {
    closeLightbox();
  }
};

// Close lightbox with ESC key
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeLightbox();
  }
});
