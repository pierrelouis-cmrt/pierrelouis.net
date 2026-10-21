(() => {
  const signature = document.querySelector("[data-signature]");

  if (!signature) {
    return;
  }

  const strokes = Array.from(
    signature.querySelectorAll("[data-signature-stroke]"),
  );
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const supportsAnimation = typeof strokes[0]?.animate === "function";
  const animations = new Set();
  let replayTimer;
  let runId = 0;

  const cancelAnimations = () => {
    window.clearTimeout(replayTimer);
    animations.forEach((animation) => animation.cancel());
    animations.clear();
  };

  const showStatic = () => {
    cancelAnimations();
    signature.dataset.signatureState = "drawn";

    strokes.forEach((stroke) => {
      stroke.style.opacity = "1";
      stroke.style.strokeDasharray = "1";
      stroke.style.strokeDashoffset = "0";
    });
  };

  const draw = () => {
    if (reducedMotion.matches || !supportsAnimation) {
      showStatic();
      return;
    }

    cancelAnimations();
    const currentRun = ++runId;
    signature.dataset.signatureState = "drawing";

    let finalAnimation;

    strokes.forEach((stroke) => {
      const delay = Number(stroke.dataset.delay) || 0;
      const duration = Number(stroke.dataset.duration) || 450;

      stroke.style.strokeDasharray = "1";
      stroke.style.strokeDashoffset = "1";
      stroke.style.opacity = "0";

      const animation = stroke.animate(
        [
          { opacity: 0, strokeDashoffset: 1 },
          { opacity: 1, offset: 0.08, strokeDashoffset: 0.96 },
          { opacity: 1, strokeDashoffset: 0 },
        ],
        {
          delay,
          duration,
          easing: "cubic-bezier(0.65, 0, 0.35, 1)",
          fill: "forwards",
        },
      );

      animations.add(animation);
      finalAnimation = animation;
    });

    finalAnimation?.finished
      .then(() => {
        if (currentRun === runId) {
          signature.dataset.signatureState = "drawn";
        }
      })
      .catch(() => {});
  };

  const replay = () => {
    if (reducedMotion.matches || !supportsAnimation) {
      return;
    }

    cancelAnimations();
    ++runId;
    signature.dataset.signatureState = "rewinding";

    strokes.forEach((stroke) => {
      const animation = stroke.animate(
        [
          { opacity: 1, strokeDashoffset: 0 },
          { opacity: 0.16, strokeDashoffset: 1 },
        ],
        {
          duration: 130,
          easing: "cubic-bezier(0.4, 0, 1, 1)",
          fill: "forwards",
        },
      );

      animations.add(animation);
    });

    replayTimer = window.setTimeout(draw, 145);
  };

  if (reducedMotion.matches || !supportsAnimation) {
    showStatic();
  } else {
    signature.dataset.signatureState = "waiting";
    strokes.forEach((stroke) => {
      stroke.style.opacity = "0";
      stroke.style.strokeDasharray = "1";
      stroke.style.strokeDashoffset = "1";
    });

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) {
            return;
          }

          observer.disconnect();
          draw();
        },
        {
          rootMargin: "0px 0px -4% 0px",
          threshold: 0.65,
        },
      );

      observer.observe(signature);
    } else {
      draw();
    }
  }

  signature.addEventListener("pointerover", (event) => {
    if (!signature.contains(event.relatedTarget)) {
      replay();
    }
  });

  reducedMotion.addEventListener?.("change", ({ matches }) => {
    if (matches) {
      showStatic();
    }
  });
})();
