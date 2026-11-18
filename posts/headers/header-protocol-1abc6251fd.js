(() => {
  const state = {
    paused: false,
    progress: null,
    renderer: "webgl",
  };
  const listeners = new Set();
  const capabilities = ["pause", "scrub", "renderer"];

  const publish = () => {
    window.parent.postMessage(
      {
        capabilities,
        type: "post-header:ready",
      },
      "*",
    );
  };

  const update = (patch) => {
    Object.assign(state, patch);
    listeners.forEach((listener) => listener({ ...state }));
  };

  window.addEventListener("message", (event) => {
    const message = event.data;

    if (!message || typeof message.type !== "string") {
      return;
    }

    if (message.type === "post-header:get-state") {
      publish();
      return;
    }

    if (message.type === "post-header:set-paused") {
      update({ paused: Boolean(message.paused) });
      return;
    }

    if (message.type === "post-header:set-progress") {
      const progress = Number(message.progress);

      if (Number.isFinite(progress)) {
        update({ progress: Math.min(1, Math.max(0, progress)) });
      }
      return;
    }

    if (
      message.type === "post-header:set-renderer" &&
      ["css", "webgl"].includes(message.renderer)
    ) {
      update({ renderer: message.renderer });
    }
  });

  window.PostHeaderProtocol = Object.freeze({
    capabilities,
    getState: () => ({ ...state }),
    subscribe(listener) {
      listeners.add(listener);
      listener({ ...state });
      return () => listeners.delete(listener);
    },
  });

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", publish, { once: true });
  } else {
    publish();
  }
})();
