const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const renderPostHeaderLab = ({ pathname }) => {
  const articlePath = escapeHtml(pathname);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Post Header Lab</title>
    <style>
      :root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      * { box-sizing: border-box; }
      body { display: grid; grid-template-columns: 280px minmax(0, 1fr); min-height: 100vh; margin: 0; background: #111; color: #f5f5f5; }
      aside { position: sticky; top: 0; height: 100vh; padding: 20px; overflow: auto; border-right: 1px solid #333; }
      h1 { margin: 0 0 24px; font-size: 18px; }
      label, fieldset { display: grid; gap: 7px; margin: 0 0 18px; border: 0; padding: 0; font-size: 12px; }
      input, select, button { min-height: 36px; border: 1px solid #444; border-radius: 4px; background: #1b1b1b; color: inherit; font: inherit; }
      input[type="range"] { width: 100%; border: 0; }
      button { padding: 8px 10px; cursor: pointer; }
      button:hover, button:focus-visible { background: #2a2a2a; }
      .viewport-options { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .status { color: #aaa; line-height: 1.5; }
      main { display: grid; place-items: start center; min-width: 0; padding: 24px; overflow: auto; }
      iframe { width: min(1440px, 100%); height: calc(100vh - 48px); border: 0; background: white; transition: width 180ms ease; }
      iframe[data-viewport="mobile"] { width: 390px; }
      @media (max-width: 760px) {
        body { grid-template-columns: 1fr; }
        aside { position: relative; height: auto; border-right: 0; border-bottom: 1px solid #333; }
        main { padding: 12px; }
        iframe { height: 760px; }
      }
    </style>
  </head>
  <body>
    <aside>
      <h1>Post Header Lab</h1>
      <label>Navbar
        <select data-nav>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label>Tag color
        <input data-color value="oklch(79% 0.028 271 / 0.86)" />
      </label>
      <label>OKLCH lightness
        <input data-lightness type="range" min="0" max="100" value="79" />
      </label>
      <label>Alpha
        <input data-alpha type="range" min="0" max="1" step="0.01" value="0.86" />
      </label>
      <fieldset>
        <span>Viewport</span>
        <div class="viewport-options">
          <button type="button" data-viewport="desktop">1440px</button>
          <button type="button" data-viewport="mobile">390px</button>
        </div>
      </fieldset>
      <label>Timeline
        <input data-progress type="range" min="0" max="1" step="0.01" value="0.5" />
      </label>
      <label>
        <span><input data-paused type="checkbox" checked /> Pause animation</span>
      </label>
      <label>Renderer
        <select data-renderer>
          <option value="webgl">WebGL</option>
          <option value="css">CSS fallback</option>
        </select>
      </label>
      <button type="button" data-copy>Copy YAML configuration</button>
      <p class="status" data-status>Waiting for header…</p>
    </aside>
    <main>
      <iframe src="${articlePath}" title="Generated article preview" data-article></iframe>
    </main>
    <script>
      (() => {
        const article = document.querySelector("[data-article]");
        const nav = document.querySelector("[data-nav]");
        const color = document.querySelector("[data-color]");
        const lightness = document.querySelector("[data-lightness]");
        const alpha = document.querySelector("[data-alpha]");
        const progress = document.querySelector("[data-progress]");
        const paused = document.querySelector("[data-paused]");
        const renderer = document.querySelector("[data-renderer]");
        const status = document.querySelector("[data-status]");

        const articlePage = () =>
          article.contentDocument?.querySelector(".post-page");
        const headerFrame = () =>
          article.contentDocument?.querySelector("[data-post-hero-backdrop]");
        const send = (message) =>
          headerFrame()?.contentWindow?.postMessage(message, "*");

        const syncColorParts = () => {
          const match = color.value.match(
            /^oklch\\(\\s*([\\d.]+)%\\s+([^/\\)]+?)(?:\\s*\\/\\s*([\\d.]+))?\\s*\\)$/i,
          );

          if (!match) return;
          lightness.value = match[1];
          alpha.value = match[3] || "1";
        };

        const rebuildOklch = () => {
          const match = color.value.match(
            /^oklch\\(\\s*[\\d.]+%\\s+([^/\\)]+?)(?:\\s*\\/\\s*[\\d.]+)?\\s*\\)$/i,
          );
          const channels = match?.[1]?.trim() || "0.028 271";
          color.value =
            "oklch(" + lightness.value + "% " + channels + " / " + alpha.value + ")";
          apply();
        };

        const apply = () => {
          const page = articlePage();
          if (!page) return;
          page.classList.toggle("post-page--nav-light", nav.value === "light");
          page.dataset.headerNav = nav.value;
          page.style.setProperty("--post-hero-tag-color", color.value);
          send({ type: "post-header:set-paused", paused: paused.checked });
          send({ type: "post-header:set-progress", progress: Number(progress.value) });
          send({ type: "post-header:set-renderer", renderer: renderer.value });
        };

        article.addEventListener("load", () => {
          const page = articlePage();
          if (page) {
            nav.value = page.dataset.headerNav || "dark";
            const selected = getComputedStyle(page)
              .getPropertyValue("--post-hero-tag-color")
              .trim();
            if (selected) color.value = selected;
          }
          syncColorParts();
          apply();
          send({ type: "post-header:get-state" });
        });

        window.addEventListener("message", (event) => {
          if (event.data?.type === "post-header:ready") {
            status.textContent =
              "Ready: " + event.data.capabilities.join(", ");
            apply();
          }
        });

        nav.addEventListener("change", apply);
        color.addEventListener("input", () => {
          syncColorParts();
          apply();
        });
        lightness.addEventListener("input", rebuildOklch);
        alpha.addEventListener("input", rebuildOklch);
        progress.addEventListener("input", apply);
        paused.addEventListener("change", apply);
        renderer.addEventListener("change", apply);
        document.querySelectorAll("[data-viewport]").forEach((button) => {
          button.addEventListener("click", () => {
            article.dataset.viewport = button.dataset.viewport;
          });
        });
        document.querySelector("[data-copy]").addEventListener("click", async () => {
          const backdrop = articlePage()?.dataset.headerBackdrop || "";
          const yaml = [
            "header-backdrop: " + backdrop,
            "header-nav: " + nav.value,
            'header-tag-color: "' + color.value.replaceAll('"', '\\\\"') + '"',
          ].join("\\n");
          await navigator.clipboard.writeText(yaml);
          status.textContent = "YAML copied.";
        });
      })();
    </script>
  </body>
</html>`;
};
