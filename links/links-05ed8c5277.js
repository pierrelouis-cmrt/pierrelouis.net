(() => {
  const carousel = document.querySelector("[data-links-carousel]");
  const track = carousel?.querySelector("[data-links-carousel-track]");
  const sourceGroup = track?.querySelector("[data-links-carousel-group]");

  if (!carousel || !track || !sourceGroup) {
    return;
  }

  const SPEED = 13;
  const STOP_DURATION = 180;
  const RESUME_DURATION = 320;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const clone = sourceGroup.cloneNode(true);

  clone.removeAttribute("data-links-carousel-group");
  clone.setAttribute("aria-hidden", "true");
  clone.querySelectorAll("a").forEach((link) => {
    link.tabIndex = -1;
  });
  track.append(clone);

  let cycleWidth = 0;
  let marqueeAnimation = null;
  let rateTransitionFrame = null;
  let pointerPaused = false;
  let focusPaused = false;

  const shouldPause = () =>
    reducedMotion.matches || pointerPaused || focusPaused;

  const setPlaybackRate = (rate) => {
    if (typeof marqueeAnimation?.updatePlaybackRate === "function") {
      marqueeAnimation.updatePlaybackRate(rate);
    } else if (marqueeAnimation) {
      marqueeAnimation.playbackRate = rate;
    }
  };

  const transitionToRate = (nextRate, { immediate = false } = {}) => {
    if (!marqueeAnimation) {
      return;
    }

    window.cancelAnimationFrame(rateTransitionFrame);

    const fromRate = marqueeAnimation.playbackRate;

    if (immediate || Math.abs(fromRate - nextRate) < 0.001) {
      setPlaybackRate(nextRate);
      return;
    }

    const duration = nextRate === 0 ? STOP_DURATION : RESUME_DURATION;
    const startedAt = performance.now();

    const updateRate = (time) => {
      const progress = Math.min((time - startedAt) / duration, 1);
      const easedProgress = progress * progress * (3 - 2 * progress);
      const rate = fromRate + (nextRate - fromRate) * easedProgress;

      setPlaybackRate(rate);

      if (progress < 1) {
        rateTransitionFrame = window.requestAnimationFrame(updateRate);
      } else {
        setPlaybackRate(nextRate);
        rateTransitionFrame = null;
      }
    };

    rateTransitionFrame = window.requestAnimationFrame(updateRate);
  };

  const updateSpeedTarget = () => {
    transitionToRate(shouldPause() ? 0 : 1);
  };

  const updateAnimationGeometry = () => {
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const nextCycleWidth = sourceGroup.getBoundingClientRect().width + gap;

    if (nextCycleWidth <= 0 || typeof track.animate !== "function") {
      return;
    }

    const oldDuration = Number(
      marqueeAnimation?.effect?.getTiming().duration,
    );
    const oldTime = Number(marqueeAnimation?.currentTime) || 0;
    const progress =
      oldDuration > 0 ? (oldTime % oldDuration) / oldDuration : 0;
    const duration = (nextCycleWidth / SPEED) * 1000;
    const keyframes = [
      { transform: "translate3d(0, 0, 0)" },
      { transform: `translate3d(${-nextCycleWidth}px, 0, 0)` },
    ];

    cycleWidth = nextCycleWidth;

    if (!marqueeAnimation) {
      marqueeAnimation = track.animate(keyframes, {
        duration,
        easing: "linear",
        iterations: Infinity,
      });
      setPlaybackRate(shouldPause() ? 0 : 1);

      if (reducedMotion.matches) {
        marqueeAnimation.currentTime = 0;
      }

      return;
    }

    marqueeAnimation.effect.setKeyframes(keyframes);
    marqueeAnimation.effect.updateTiming({ duration, iterations: Infinity });
    marqueeAnimation.currentTime = progress * duration;
  };

  carousel.addEventListener("pointerenter", () => {
    pointerPaused = true;
    updateSpeedTarget();
  });
  carousel.addEventListener("pointerleave", () => {
    pointerPaused = false;
    updateSpeedTarget();
  });
  carousel.addEventListener("focusin", () => {
    focusPaused = true;
    updateSpeedTarget();
  });
  carousel.addEventListener("focusout", (event) => {
    if (!carousel.contains(event.relatedTarget)) {
      focusPaused = false;
      updateSpeedTarget();
    }
  });

  reducedMotion.addEventListener?.("change", ({ matches }) => {
    window.cancelAnimationFrame(rateTransitionFrame);
    rateTransitionFrame = null;

    if (matches) {
      transitionToRate(0, { immediate: true });

      if (marqueeAnimation) {
        marqueeAnimation.currentTime = 0;
      }
    } else {
      updateSpeedTarget();
    }
  });

  const resizeObserver = new ResizeObserver(updateAnimationGeometry);
  resizeObserver.observe(sourceGroup);
  updateAnimationGeometry();
})();
