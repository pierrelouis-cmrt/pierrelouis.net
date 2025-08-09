// Signature animation for the about page

const signature = document.querySelector("#signature");
const letterBank = document.querySelector(".signature-letter-templates");
const name = "Pierre Louis";

// ─────────────────────────────────────────────────────────
//  Trigger only when signature enters viewport
// ─────────────────────────────────────────────────────────
let hasAnimated = false;

function setupViewportTrigger() {
  if (!signature) return;

  // If IntersectionObserver is available, use it to animate on enter
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasAnimated) {
            hasAnimated = true;
            generateSignature(name, true);
            observer.unobserve(entry.target);
            break;
          }
        }
      },
      {
        root: null,
        threshold: 0, // as soon as any pixel is visible
      }
    );
    observer.observe(signature);
  } else {
    // Fallback: animate shortly after DOM is ready
    window.addEventListener("load", () => {
      if (!hasAnimated) {
        hasAnimated = true;
        generateSignature(name, true);
      }
    });
  }
}

setupViewportTrigger();

// Replay animation on hover
if (signature) {
  signature.addEventListener("mouseenter", replayAnimation);
}

// ─────────────────────────────────────────────────────────
//  Signature builder
// ─────────────────────────────────────────────────────────
function generateSignature(text, animate = false) {
  signature.innerHTML = "";

  text.split("").forEach((char, index) => {
    if (char === " ") {
      signature.appendChild(
        Object.assign(document.createElement("div"), {
          className: "signature-word-space",
        })
      );
      return;
    }

    const letterEl = createLetterElement(char);
    if (!letterEl) return;

    signature.appendChild(letterEl);
    initPathAnimation(letterEl, animate, index);
  });
}

// Clone a template letter from the hidden "bank"
function createLetterElement(char) {
  const isUppercase = char === char.toUpperCase();
  const letterClass = char.toLowerCase();
  const selector = `.signature-letter-${letterClass}.${
    isUppercase ? "signature-letter-uppercase" : "signature-letter-lowercase"
  }`;
  const template = letterBank.querySelector(selector);

  if (!template) {
    console.warn(`Template not found for: ${char} (${selector})`);
    return null;
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = template.innerHTML;
  wrapper.classList.add(
    `signature-letter-${letterClass}`,
    isUppercase ? "signature-letter-uppercase" : "signature-letter-lowercase"
  );
  return wrapper;
}

// Measure the path, set dash values, and (optionally) animate
function initPathAnimation(letterEl, animate, index) {
  const path = letterEl.querySelector("svg path");
  if (!path) return;

  const len = path.getTotalLength();
  path.dataset.len = len;
  path.style.strokeDasharray = len;

  if (animate) {
    /* 1. Start hidden with NO transition, so there's no visible flash */
    path.style.transition = "none";
    path.style.strokeDashoffset = len;

    /* 2. Force the browser to acknowledge the style change */
    path.getBoundingClientRect(); // <-- reflow

    /* 3. Now turn the transition back on and draw the stroke */
    setTimeout(() => {
      path.style.transition = "stroke-dashoffset 0.8s ease";
      path.style.strokeDashoffset = 0;
    }, index * 200);
  } else {
    path.style.strokeDashoffset = 0; // static version (e.g. after hover replay)
  }
}

// ─────────────────────────────────────────────────────────
//  Hover replay
// ─────────────────────────────────────────────────────────
function replayAnimation() {
  const paths = signature.querySelectorAll("svg path");

  // 1. Quick "fade out" by resetting dashoffset to the full length
  paths.forEach((path) => {
    const len = parseFloat(path.dataset.len) || path.getTotalLength();
    path.style.transition = "stroke-dashoffset 0.15s ease-out";
    path.style.strokeDashoffset = len;
  });

  // 2. Draw each letter back in, one after another
  setTimeout(() => {
    paths.forEach((path, idx) => {
      path.style.transition = "stroke-dashoffset 0.8s ease";
      setTimeout(() => (path.style.strokeDashoffset = 0), idx * 200);
    });
  }, 150);
}
