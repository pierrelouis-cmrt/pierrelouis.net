// Enhanced carousel functionality
document.addEventListener("DOMContentLoaded", () => {
  const track = document.querySelector(".carousel-track");
  if (!track) return;

  const baseItems = Array.from(track.children);

  function ensureLoop() {
    const item = track.querySelector(".item");
    if (!item) return;

    const style = getComputedStyle(track);
    const gap = parseFloat(style.gap) || 0;
    const itemWidth = item.getBoundingClientRect().width + gap;
    const minItems = Math.ceil(window.innerWidth / itemWidth) + 1;

    while (track.children.length < minItems) {
      baseItems.forEach((el) => track.appendChild(el.cloneNode(true)));
    }
  }

  ensureLoop();
  window.addEventListener("resize", ensureLoop);

  let isDragging = false;
  let startX = 0;
  let scrollLeft = 0;

  track.addEventListener("pointerdown", (e) => {
    isDragging = true;
    startX = e.clientX;
    scrollLeft = track.scrollLeft;
    track.classList.add("dragging");
    track.setPointerCapture(e.pointerId);
  });

  track.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const walk = e.clientX - startX;
    track.scrollLeft = scrollLeft - walk;
  });

  const endDrag = () => {
    isDragging = false;
    track.classList.remove("dragging");
  };

  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);

  track.addEventListener(
    "wheel",
    (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
        track.scrollLeft += e.deltaX || e.deltaY;
        e.preventDefault();
      }
    },
    { passive: false }
  );
});
