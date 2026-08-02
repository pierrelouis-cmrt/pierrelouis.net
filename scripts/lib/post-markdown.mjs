import { existsSync } from "node:fs";
import path from "node:path";
import hljs from "highlight.js";
import katex from "katex";
import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import {
  POST_ARTICLES_DIR,
  isPostImage,
  isRemotePostAsset,
  normalizePostLanguage,
  resolvePostAssetPath,
  slugifyPost,
} from "./posts.mjs";

const BODY_START = "<!--post-body:start-->";
const BODY_END = "<!--post-body:end-->";
const FOOTNOTES_START = "<!--post-footnotes:start-->";
const FOOTNOTES_END = "<!--post-footnotes:end-->";
const SOURCES_START = "<!--post-sources:start-->";
const SOURCES_END = "<!--post-sources:end-->";

const MATH_OPTIONS = Object.freeze({
  macros: {
    "\\R": "\\mathbb{R}",
    "\\N": "\\mathbb{N}",
    "\\Z": "\\mathbb{Z}",
    "\\E": "\\mathbb{E}",
    "\\P": "\\mathbb{P}",
    "\\dif": "\\mathop{}\\!\\mathrm{d}",
  },
  output: "htmlAndMathml",
  strict: "error",
  throwOnError: true,
  trust: false,
});

const escapeAttribute = (md, value) => md.utils.escapeHtml(String(value || ""));

const inputLabel = (env) =>
  env?.page?.inputPath ? env.page.inputPath.replace(/^\.\//, "") : "post";

const splitSources = (source) => {
  const matches = [...source.matchAll(/^## Sources\s*$/gim)];

  if (matches.length === 0) {
    return { body: source, sources: "" };
  }

  const match = matches.at(-1);
  const afterHeading = source.slice(match.index + match[0].length);

  if (/^##\s+/m.test(afterHeading)) {
    throw new Error(
      "The optional `## Sources` section must be the final H2 section.",
    );
  }

  return {
    body: source.slice(0, match.index).trimEnd(),
    sources: afterHeading.trim(),
  };
};

const removeObsidianComments = (source) =>
  source.replace(/%%[\s\S]*?%%/g, "");

const publicAssetUrl = (reference, env) => {
  const value = String(reference || "").trim();

  if (!value || isRemotePostAsset(value) || value.startsWith("/")) {
    return value;
  }

  const inputPath = env?.page?.inputPath;

  if (!inputPath) {
    return value;
  }

  const absolute = resolvePostAssetPath(
    value,
    path.resolve(inputPath),
    POST_ARTICLES_DIR,
  );
  const relative = path.relative(POST_ARTICLES_DIR, absolute);
  return `../${relative.split(path.sep).join("/")}`;
};

const resolveWikiLink = (rawTarget, rawLabel, env, manifest) => {
  const target = rawTarget.trim();
  const [noteName, heading] = target.split("#", 2);
  const label = rawLabel?.trim() || heading || noteName;

  if (!noteName) {
    return `[${label}](#${slugifyPost(heading)})`;
  }

  const post = manifest.byWikiName.get(noteName.toLowerCase());

  if (!post) {
    throw new Error(
      `${inputLabel(env)}: Obsidian link \`[[${rawTarget}]]\` does not target a published post`,
    );
  }

  const hash = heading ? `#${slugifyPost(heading)}` : "";
  return `[${label}](../${post.data.slug}/${hash})`;
};

const preprocessObsidian = (source, env, manifest) => {
  let output = removeObsidianComments(source);

  output = output.replace(
    /!\[\[([^|\]#]+)(?:\|([^\]]+))?]]/g,
    (match, target, display) => {
      if (!isPostImage(target)) {
        throw new Error(
          `${inputLabel(env)}: note/PDF/audio embeds are not supported in published posts; replace \`${match}\` with a link or registered component`,
        );
      }

      const fallbackAlt = path
        .basename(target, path.extname(target))
        .replace(/[-_]+/g, " ");
      const alt =
        display && !/^\d+(?:x\d+)?$/.test(display)
          ? display
          : fallbackAlt;
      return `![${alt}](${target})`;
    },
  );

  output = output.replace(
    /(?<!!)\[\[([^|\]]+?)(?:\|([^\]]+))?]]/g,
    (_match, target, label) => resolveWikiLink(target, label, env, manifest),
  );

  // Obsidian highlight syntax. It deliberately stays single-line so equations
  // and larger block structures cannot be consumed accidentally.
  output = output.replace(/==([^\n=][^\n]*?)==/g, "<mark>$1</mark>");

  return output;
};

const installMath = (md) => {
  const renderMath = (content, displayMode, env, line) => {
    try {
      return katex.renderToString(content, {
        ...MATH_OPTIONS,
        displayMode,
      });
    } catch (error) {
      const location = line ? `:${line}` : "";
      throw new Error(
        `${inputLabel(env)}${location}: invalid math: ${error.message}`,
      );
    }
  };

  md.block.ruler.before(
    "fence",
    "post_math_block",
    (state, startLine, endLine, silent) => {
      const start = state.bMarks[startLine] + state.tShift[startLine];
      const end = state.eMarks[startLine];
      const firstLine = state.src.slice(start, end).trim();

      if (!firstLine.startsWith("$$")) {
        return false;
      }

      if (silent) {
        return true;
      }

      let content = "";
      let nextLine = startLine + 1;
      const sameLine = firstLine.slice(2);

      if (sameLine.endsWith("$$") && sameLine.length > 2) {
        content = sameLine.slice(0, -2).trim();
      } else {
        if (sameLine.trim()) {
          content = `${sameLine}\n`;
        }

        let foundClose = false;

        for (; nextLine < endLine; nextLine += 1) {
          const lineStart =
            state.bMarks[nextLine] + state.tShift[nextLine];
          const lineEnd = state.eMarks[nextLine];
          const line = state.src.slice(lineStart, lineEnd);

          if (line.trim() === "$$") {
            foundClose = true;
            nextLine += 1;
            break;
          }

          content += `${line}\n`;
        }

        if (!foundClose) {
          throw new Error(
            `${inputLabel(state.env)}:${startLine + 1}: unclosed display math block`,
          );
        }
      }

      const token = state.push("post_math_block", "div", 0);
      token.block = true;
      token.content = content.trim();
      token.map = [startLine, nextLine];
      state.line = nextLine;
      return true;
    },
    { alt: ["paragraph", "reference", "blockquote", "list"] },
  );

  md.inline.ruler.after("escape", "post_math_inline", (state, silent) => {
    const start = state.pos;

    if (
      state.src[start] !== "$" ||
      state.src[start + 1] === "$" ||
      /\s/.test(state.src[start + 1] || "")
    ) {
      return false;
    }

    let end = start + 1;

    while (end < state.posMax) {
      if (
        state.src[end] === "$" &&
        state.src[end - 1] !== "\\" &&
        !/\s/.test(state.src[end - 1] || "")
      ) {
        break;
      }
      end += 1;
    }

    if (end >= state.posMax) {
      return false;
    }

    if (!silent) {
      const token = state.push("post_math_inline", "math", 0);
      token.content = state.src.slice(start + 1, end);
    }

    state.pos = end + 1;
    return true;
  });

  md.renderer.rules.post_math_block = (tokens, index, _options, env) => {
    const token = tokens[index];
    return `<div class="post-math">${renderMath(
      token.content,
      true,
      env,
      (token.map?.[0] || 0) + 1,
    )}</div>\n`;
  };
  md.renderer.rules.post_math_inline = (tokens, index, _options, env) =>
    renderMath(tokens[index].content, false, env);
};

const installFootnotes = (md) => {
  const idFor = (token) => token.meta.id + 1;
  const refIdFor = (token) =>
    `${idFor(token)}${token.meta.subId > 0 ? `-${token.meta.subId + 1}` : ""}`;

  md.renderer.rules.footnote_ref = (tokens, index) => {
    const token = tokens[index];
    const id = idFor(token);
    const refId = refIdFor(token);
    return `<sup class="post-footnote-ref" id="footnote-ref-${refId}"><a href="#footnote-${id}" role="doc-noteref" aria-label="Read footnote ${id}">${id}</a></sup>`;
  };
  md.renderer.rules.footnote_block_open = () =>
    '<section class="post-footnotes-section"><ol class="post-footnotes">\n';
  md.renderer.rules.footnote_block_close = () => "</ol></section>\n";
  md.renderer.rules.footnote_open = (tokens, index) => {
    const id = idFor(tokens[index]);
    return `<li class="post-footnotes__item" id="footnote-${id}" role="doc-endnote">`;
  };
  md.renderer.rules.footnote_close = () => "</li>\n";
  md.renderer.rules.footnote_anchor = (tokens, index) => {
    const id = idFor(tokens[index]);
    return ` <a class="post-footnote-backref" href="#footnote-ref-${id}" aria-label="Return to footnote ${id} reference">↩</a>`;
  };
};

const installCode = (md) => {
  md.renderer.rules.fence = (tokens, index) => {
    const token = tokens[index];
    const info = token.info.trim().split(/\s+/).filter(Boolean);
    const requested = info[0] || "text";
    const language = normalizePostLanguage(requested);
    const shouldCopy = info.includes("copy");
    const source = token.content.replace(/\n$/, "");
    const escaped = md.utils.escapeHtml(source);
    const highlighted =
      ["text", "plaintext"].includes(language)
        ? escaped
        : hljs.highlight(source, {
            ignoreIllegals: true,
            language,
          }).value;
    const copyAttribute = shouldCopy ? " data-code-copy" : "";
    const className =
      language === "plaintext" ? "text" : escapeAttribute(md, language);

    return `<pre${copyAttribute}><code class="language-${className}">${highlighted}</code></pre>\n`;
  };
};

const getImageParagraph = (tokens, index) => {
  const open = tokens[index];
  const inline = tokens[index + 1];
  const close = tokens[index + 2];

  if (
    open?.type !== "paragraph_open" ||
    inline?.type !== "inline" ||
    close?.type !== "paragraph_close"
  ) {
    return null;
  }

  const meaningful = (inline.children || []).filter(
    (child) => child.type !== "text" || child.content.trim(),
  );

  if (meaningful[0]?.type !== "image") {
    return null;
  }

  if (meaningful.length === 1) {
    return { captionChildren: null, image: meaningful[0] };
  }

  if (meaningful[1]?.type === "softbreak") {
    return {
      captionChildren: meaningful.slice(2),
      image: meaningful[0],
    };
  }

  return null;
};

const getItalicCaption = (tokens, index) => {
  const open = tokens[index];
  const inline = tokens[index + 1];
  const close = tokens[index + 2];
  const children = inline?.children || [];

  if (
    open?.type !== "paragraph_open" ||
    inline?.type !== "inline" ||
    close?.type !== "paragraph_close" ||
    children[0]?.type !== "em_open" ||
    children.at(-1)?.type !== "em_close"
  ) {
    return null;
  }

  return children.slice(1, -1);
};

const renderMedia = ({
  alt,
  captionHtml,
  env,
  index,
  md,
  src,
}) => {
  const publicSrc = publicAssetUrl(src, env);
  const safeSrc = escapeAttribute(md, publicSrc);
  const safeAlt = escapeAttribute(md, alt);

  return `<figure class="post-media">
  <button class="post-media__frame post-lightbox__trigger" type="button" data-post-lightbox-item>
    <img class="post-media__asset" src="${safeSrc}" loading="lazy" decoding="async" alt="${safeAlt}" />
  </button>
  ${
    captionHtml
      ? `<figcaption class="post-caption"><span>${captionHtml}</span><span class="post-caption__index">Figure / ${String(index).padStart(2, "0")}</span></figcaption>`
      : ""
  }
</figure>\n`;
};

const installPostStructure = (md) => {
  md.core.ruler.after("inline", "post_headings_and_media", (state) => {
    const usedIds = new Set();
    let mediaIndex = 0;

    for (let index = 0; index < state.tokens.length; index += 1) {
      const token = state.tokens[index];

      if (token.type === "heading_open") {
        const inline = state.tokens[index + 1];
        const base = slugifyPost(inline?.content) || `section-${index + 1}`;
        let id = base;
        let suffix = 2;

        while (usedIds.has(id)) {
          id = `${base}-${suffix}`;
          suffix += 1;
        }

        token.attrSet("id", id);
        usedIds.add(id);
        continue;
      }

      const media = getImageParagraph(state.tokens, index);

      if (!media) {
        continue;
      }

      const trailingCaption = getItalicCaption(state.tokens, index + 3);
      const captionChildren = media.captionChildren || trailingCaption;
      const captionHtml = captionChildren
        ? md.renderer.renderInline(captionChildren, md.options, state.env)
        : "";
      mediaIndex += 1;
      const html = renderMedia({
        alt: md.renderer.renderInlineAsText(
          media.image.children || [],
          md.options,
          state.env,
        ),
        captionHtml,
        env: state.env,
        index: mediaIndex,
        md,
        src: media.image.attrGet("src"),
      });
      const replacement = new state.Token("html_block", "", 0);
      replacement.content = html;
      replacement.block = true;
      const removeCount = trailingCaption ? 6 : 3;
      state.tokens.splice(index, removeCount, replacement);
    }
  });
};

const installImages = (md) => {
  const defaultImage =
    md.renderer.rules.image ||
    ((tokens, index, options, _env, self) =>
      self.renderToken(tokens, index, options));

  md.renderer.rules.image = (tokens, index, options, env, self) => {
    const token = tokens[index];
    token.attrSet("src", publicAssetUrl(token.attrGet("src"), env));
    token.attrSet("loading", "lazy");
    return defaultImage(tokens, index, options, env, self);
  };
};

const installLinks = (md) => {
  const defaultLinkOpen =
    md.renderer.rules.link_open ||
    ((tokens, index, options, _env, self) =>
      self.renderToken(tokens, index, options));

  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index];
    let href = token.attrGet("href") || "";

    if (isRemotePostAsset(href)) {
      token.attrJoin("class", "external-link");
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noopener noreferrer");
    } else {
      token.attrJoin("class", "internal-link");

      const cleanHref = href.split(/[?#]/, 1)[0];

      if (
        cleanHref &&
        !cleanHref.startsWith("/") &&
        path.extname(cleanHref)
      ) {
        href = publicAssetUrl(href, env);
        token.attrSet("href", href);
      }

      if (cleanHref && !href.startsWith("#") && env?.page?.outputPath) {
        const resolved = href.startsWith("/")
          ? path.resolve(process.cwd(), `.${href}`)
          : path.resolve(path.dirname(env.page.outputPath), href);

        if (!existsSync(resolved)) {
          token.attrSet("href", "");
          token.attrSet("aria-disabled", "true");
          token.attrSet(
            "title",
            "This linked file is not available in the published site.",
          );
          token.attrJoin("class", "post-link-unavailable");
        }
      }
    }

    return defaultLinkOpen(tokens, index, options, env, self);
  };
};

const installCallouts = (md) => {
  md.core.ruler.after("inline", "post_callouts", (state) => {
    for (let index = 0; index < state.tokens.length; index += 1) {
      const open = state.tokens[index];
      const paragraphOpen = state.tokens[index + 1];
      const inline = state.tokens[index + 2];

      if (
        open.type !== "blockquote_open" ||
        paragraphOpen?.type !== "paragraph_open" ||
        inline?.type !== "inline"
      ) {
        continue;
      }

      const firstText = inline.children?.[0];
      const match = firstText?.content.match(
        /^\[!([a-z][a-z0-9-]*)]([+-])?\s*(.*)$/i,
      );

      if (!match) {
        continue;
      }

      const type = match[1].toLowerCase();
      const fold = match[2] || "";
      const title = match[3].trim() || `${type[0].toUpperCase()}${type.slice(1)}`;
      let depth = 0;
      let closeIndex = -1;

      for (let cursor = index; cursor < state.tokens.length; cursor += 1) {
        if (state.tokens[cursor].type === "blockquote_open") {
          depth += 1;
        } else if (state.tokens[cursor].type === "blockquote_close") {
          depth -= 1;

          if (depth === 0) {
            closeIndex = cursor;
            break;
          }
        }
      }

      if (closeIndex < 0) {
        continue;
      }

      open.type = fold ? "post_callout_details_open" : "post_callout_open";
      open.meta = { fold, title, type };
      state.tokens[closeIndex].type = fold
        ? "post_callout_details_close"
        : "post_callout_close";

      const hasBodyOnFirstParagraph =
        inline.children[1]?.type === "softbreak";

      if (hasBodyOnFirstParagraph) {
        inline.children.splice(0, 2);
        inline.content = inline.content.split("\n").slice(1).join("\n");
      } else {
        inline.children = [];
        inline.content = "";
        paragraphOpen.hidden = true;
        state.tokens[index + 3].hidden = true;
      }
    }
  });

  md.renderer.rules.post_callout_open = (tokens, index) => {
    const { title, type } = tokens[index].meta;
    return `<aside class="post-callout" data-callout="${escapeAttribute(md, type)}"><p class="post-callout__title">${escapeAttribute(md, title)}</p>\n`;
  };
  md.renderer.rules.post_callout_close = () => "</aside>\n";
  md.renderer.rules.post_callout_details_open = (tokens, index) => {
    const { fold, title, type } = tokens[index].meta;
    const open = fold === "+" ? " open" : "";
    return `<details class="post-callout post-callout--foldable" data-callout="${escapeAttribute(md, type)}"${open}><summary class="post-callout__title">${escapeAttribute(md, title)}</summary>\n`;
  };
  md.renderer.rules.post_callout_details_close = () => "</details>\n";
};

const extractFootnotes = (html) => {
  const match = html.match(
    /<section class="post-footnotes-section">([\s\S]*?)<\/section>\s*$/,
  );

  if (!match) {
    return { body: html, footnotes: "" };
  }

  return {
    body: html.slice(0, match.index).trimEnd(),
    footnotes: match[1].trim(),
  };
};

const replaceUnavailableIframes = (html, env) =>
  html.replace(
    /<iframe\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)><\/iframe>/gi,
    (iframe, before, source, after) => {
      if (isRemotePostAsset(source)) {
        return iframe;
      }

      let available = false;

      try {
        const resolved = resolvePostAssetPath(
          source,
          path.resolve(env.page.inputPath),
          POST_ARTICLES_DIR,
        );
        available = Boolean(resolved && existsSync(resolved));
      } catch {
        available = false;
      }

      if (available) {
        return `<iframe${before}src="${publicAssetUrl(source, env)}"${after}></iframe>`;
      }

      return `<aside class="post-embed-fallback" role="note">
  <p><strong>Interactive demo unavailable.</strong> Its standalone files are not included in this post source mirror.</p>
</aside>`;
    },
  );

const replaceUnavailableLocalLinks = (html, env) =>
  html.replace(
    /<a\b([^>]*?)\bhref=["']([^"']+)["']([^>]*)>/gi,
    (anchor, before, href, after) => {
      if (
        !href ||
        href.startsWith("#") ||
        isRemotePostAsset(href) ||
        !env?.page?.outputPath
      ) {
        return anchor;
      }

      const resolved = href.startsWith("/")
        ? path.resolve(process.cwd(), `.${href}`)
        : path.resolve(path.dirname(env.page.outputPath), href);

      if (existsSync(resolved)) {
        return anchor;
      }

      let attributes = `${before}${after}`;

      if (/\bclass=["'][^"']*["']/i.test(attributes)) {
        attributes = attributes.replace(
          /\bclass=(["'])([^"']*)\1/i,
          (_match, quote, classes) =>
            `class=${quote}${classes} post-link-unavailable${quote}`,
        );
      } else {
        attributes += ' class="post-link-unavailable"';
      }

      return `<a${attributes} aria-disabled="true" title="This linked file is not available in the published site.">`;
    },
  );

export const extractPostSection = (content, section) => {
  const markers = {
    body: [BODY_START, BODY_END],
    footnotes: [FOOTNOTES_START, FOOTNOTES_END],
    sources: [SOURCES_START, SOURCES_END],
  };
  const selected = markers[section];

  if (!selected) {
    return "";
  }

  const start = content.indexOf(selected[0]);
  const end = content.indexOf(selected[1]);

  if (start < 0 || end < 0 || end < start) {
    return "";
  }

  return content.slice(start + selected[0].length, end).trim();
};

export const createPostMarkdown = ({ manifest }) => {
  const md = new MarkdownIt({
    breaks: false,
    html: true,
    linkify: true,
    typographer: true,
  }).use(footnote);

  installMath(md);
  installFootnotes(md);
  installCode(md);
  installPostStructure(md);
  installImages(md);
  installLinks(md);
  installCallouts(md);

  const baseRender = md.render.bind(md);

  md.render = (rawSource, env = {}) => {
    let source;

    try {
      source = preprocessObsidian(rawSource, env, manifest);
    } catch (error) {
      throw new Error(error.message);
    }

    let sections;

    try {
      sections = splitSources(source);
    } catch (error) {
      throw new Error(`${inputLabel(env)}: ${error.message}`);
    }

    const renderedBody = replaceUnavailableLocalLinks(
      replaceUnavailableIframes(baseRender(sections.body, env), env),
      env,
    );
    const { body, footnotes } = extractFootnotes(renderedBody);
    const sources = sections.sources
      ? baseRender(sections.sources, {
          ...env,
          footnotes: undefined,
        })
      : "";

    return [
      BODY_START,
      body,
      BODY_END,
      FOOTNOTES_START,
      footnotes,
      FOOTNOTES_END,
      SOURCES_START,
      sources,
      SOURCES_END,
    ].join("\n");
  };

  return md;
};
