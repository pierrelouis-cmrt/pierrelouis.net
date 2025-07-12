// Enhanced carousel functionality
document.addEventListener("DOMContentLoaded", () => {
  const track = document.querySelector(".carousel-track");
  if (!track) return;

  let isDown = false;
  let startX;
  let scrollLeft;

  // Mouse event listeners
  track.addEventListener("mousedown", (e) => {
    isDown = true;
    track.classList.add("active");
    startX = e.pageX - track.offsetLeft;
    scrollLeft = track.scrollLeft;
  });

  track.addEventListener("mouseleave", () => {
    isDown = false;
    track.classList.remove("active");
  });

  track.addEventListener("mouseup", () => {
    isDown = false;
    track.classList.remove("active");
  });

  track.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - track.offsetLeft;
    const walk = (x - startX) * 2; // Adjust multiplier for scroll speed
    track.scrollLeft = scrollLeft - walk;
  });

  // Touch event listeners
  track.addEventListener("touchstart", (e) => {
    isDown = true;
    startX = e.touches[0].pageX - track.offsetLeft;
    scrollLeft = track.scrollLeft;
  });

  track.addEventListener("touchend", () => {
    isDown = false;
  });

  track.addEventListener("touchmove", (e) => {
    if (!isDown) return;
    const x = e.touches[0].pageX - track.offsetLeft;
    const walk = (x - startX) * 2;
    track.scrollLeft = scrollLeft - walk;
  });

  // Horizontal scroll with Shift + Wheel
  track.addEventListener("wheel", (e) => {
    if (e.shiftKey) {
      track.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  });
});
