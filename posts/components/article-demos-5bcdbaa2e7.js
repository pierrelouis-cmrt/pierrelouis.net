import { POST_COMPONENTS } from "./registry-9f75ddfacf.js";

const DEMOS = Object.freeze(
  Object.fromEntries(
    Object.entries(POST_COMPONENTS).filter(([, component]) => component.app),
  ),
);

class ArticleDemo extends HTMLElement {
  connectedCallback() {
    if (this.dataset.componentState) {
      return;
    }

    const demo = DEMOS[this.localName];

    if (!demo) {
      this.dataset.componentState = "error";
      return;
    }

    const source = new URL(demo.app, import.meta.url);
    const frame = document.createElement("iframe");

    frame.className = "article-demo__frame";
    frame.src = source.href;
    frame.title = demo.label;
    frame.loading = "lazy";
    frame.referrerPolicy = "no-referrer";
    frame.setAttribute("allow", "fullscreen");
    frame.setAttribute("sandbox", "allow-scripts allow-downloads");

    frame.addEventListener(
      "load",
      () => {
        this.dataset.componentState = "ready";
      },
      { once: true },
    );

    this.replaceChildren(frame);
    this.dataset.componentState = "loading";
    this.setAttribute("role", "group");
    this.setAttribute("aria-label", demo.label);
  }
}

for (const tag of Object.keys(DEMOS)) {
  if (!customElements.get(tag)) {
    customElements.define(tag, class extends ArticleDemo {});
  }
}
