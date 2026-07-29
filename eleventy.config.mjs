import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  renderSiteFooter,
  renderSiteHeader,
} from "./scripts/shared-components.mjs";
import {
  extractPostSection,
  createPostMarkdown,
} from "./scripts/lib/post-markdown.mjs";
import {
  POST_ARTICLES_DIR,
  POST_TYPES,
  loadPostManifest,
  normalizePostTags,
  postDateIso,
} from "./scripts/lib/posts.mjs";
import { POST_COMPONENTS } from "./posts/components/registry.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SITE_URL = "https://pierrelouis.net";

const isPostInput = (data) =>
  data?.page?.inputPath &&
  path.resolve(data.page.inputPath).startsWith(`${POST_ARTICLES_DIR}${path.sep}`) &&
  data.page.inputPath.endsWith(".md");

const typeLabel = (type) =>
  ({
    article: "Article",
    experiment: "Experiment",
    note: "Note",
  })[type] || type;

const dateValue = (value) => {
  const iso = postDateIso(value);
  const date = new Date(`${iso}T00:00:00Z`);

  if (Number.isNaN(date.valueOf())) {
    throw new Error(`Invalid post date: ${value}`);
  }

  return date;
};

const postAssetUrl = (reference, inputPath) => {
  const value = String(reference || "").trim();

  if (!value || /^(?:https?:)?\/\//i.test(value) || value.startsWith("/")) {
    return value;
  }

  const absolute = path.resolve(path.dirname(inputPath), value);
  const relative = path.relative(POST_ARTICLES_DIR, absolute);
  return `../${relative.split(path.sep).join("/")}`;
};

const postOgAssetUrl = (reference, inputPath) => {
  const publicUrl = postAssetUrl(reference, inputPath);

  if (/^https?:\/\//i.test(publicUrl)) {
    return publicUrl;
  }

  if (publicUrl.startsWith("/")) {
    return `${SITE_URL}${publicUrl}`;
  }

  return `${SITE_URL}/posts/${publicUrl.replace(/^\.\.\//, "")}`;
};

const archiveGroups = (items) => {
  const sorted = [...items].sort(
    (first, second) =>
      dateValue(second.data.date) - dateValue(first.data.date) ||
      first.data.title.localeCompare(second.data.title),
  );
  const years = [];

  for (const item of sorted) {
    const date = dateValue(item.data.date);
    const yearValue = date.getUTCFullYear();
    const monthValue = date.getUTCMonth();
    let year = years.at(-1);

    if (!year || year.value !== yearValue) {
      year = { months: [], value: yearValue };
      years.push(year);
    }

    let month = year.months.at(-1);

    if (!month || month.value !== monthValue) {
      month = {
        label: new Intl.DateTimeFormat("en", {
          month: "short",
          timeZone: "UTC",
        }).format(date),
        posts: [],
        value: monthValue,
        yearMonth: `${yearValue}-${String(monthValue + 1).padStart(2, "0")}`,
      };
      year.months.push(month);
    }

    month.posts.push(item);
  }

  return years;
};

export default async function configureEleventy(eleventyConfig) {
  const manifest = await loadPostManifest();
  const featuredPost = manifest.posts.find(
    (post) => post.data.slug === "was-maths-invented-or-discovered",
  );
  const markdown = createPostMarkdown({ manifest });
  const normalizedFor = (data) =>
    manifest.byInputPath.get(path.resolve(data.page.inputPath))?.data;

  manifest.warnings.forEach((warning) => {
    console.warn(`Post warning: ${warning}`);
  });

  eleventyConfig.setLibrary("md", markdown);
  eleventyConfig.ignores.add("content/posts/README.md");
  eleventyConfig.ignores.add("content/posts/EXAMPLE_POST.md");
  eleventyConfig.addPassthroughCopy({
    "content/posts/articles/assets": "assets",
  });
  eleventyConfig.addWatchTarget("./posts/post.css");
  eleventyConfig.addWatchTarget("./posts/post.js");
  eleventyConfig.addWatchTarget("./posts/headers");
  eleventyConfig.addWatchTarget("./posts/components");

  eleventyConfig.addGlobalData("siteUrl", SITE_URL);
  eleventyConfig.addGlobalData("featuredPost", featuredPost?.data);
  eleventyConfig.addGlobalData(
    "postSiteHeader",
    renderSiteHeader({
      back: {
        href: "../",
        label: "Back to posts",
        shortLabel: "Back",
      },
      root: "../../",
    }),
  );
  eleventyConfig.addGlobalData(
    "postSiteFooter",
    renderSiteFooter({ active: null, root: "../../" }),
  );
  eleventyConfig.addGlobalData(
    "postsSiteHeader",
    renderSiteHeader({ active: "posts", root: "../" }),
  );
  eleventyConfig.addGlobalData(
    "postsSiteFooter",
    renderSiteFooter({ active: null, root: "../" }),
  );
  eleventyConfig.addGlobalData("eleventyComputed", {
    layout(data) {
      return isPostInput(data) ? "post.njk" : undefined;
    },
    permalink(data) {
      if (!isPostInput(data)) {
        return undefined;
      }

      return `${normalizedFor(data).slug}/index.html`;
    },
    slug(data) {
      return isPostInput(data) ? normalizedFor(data).slug : data.slug;
    },
    type(data) {
      return isPostInput(data) ? normalizedFor(data).type : data.type;
    },
    lang(data) {
      return isPostInput(data) ? normalizedFor(data).lang : data.lang;
    },
    toc(data) {
      return isPostInput(data) ? normalizedFor(data).toc : data.toc;
    },
    headerBackdrop(data) {
      return isPostInput(data)
        ? normalizedFor(data)["header-backdrop"] || ""
        : "";
    },
    headerNav(data) {
      return isPostInput(data)
        ? normalizedFor(data)["header-nav"] || "dark"
        : "dark";
    },
    headerTagColor(data) {
      return isPostInput(data)
        ? normalizedFor(data)["header-tag-color"] || ""
        : "";
    },
    heroImage(data) {
      return isPostInput(data)
        ? normalizedFor(data)["hero-image"] || ""
        : "";
    },
    heroAlt(data) {
      return isPostInput(data)
        ? normalizedFor(data)["hero-alt"] || ""
        : "";
    },
    heroCaption(data) {
      return isPostInput(data)
        ? normalizedFor(data)["hero-caption"] || ""
        : "";
    },
  });

  eleventyConfig.addCollection("publishedPosts", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("./content/posts/articles/*.md")
      .sort(
        (first, second) =>
          dateValue(second.data.date) - dateValue(first.data.date),
      ),
  );

  eleventyConfig.addFilter("archiveGroups", archiveGroups);
  eleventyConfig.addFilter("dateIso", postDateIso);
  eleventyConfig.addFilter("dateLong", (value, lang = "en") =>
    new Intl.DateTimeFormat(lang, {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
      year: "numeric",
    }).format(dateValue(value)),
  );
  eleventyConfig.addFilter("dateYear", (value) =>
    String(dateValue(value).getUTCFullYear()),
  );
  eleventyConfig.addFilter("json", (value) => JSON.stringify(value));
  eleventyConfig.addFilter("postAsset", postAssetUrl);
  eleventyConfig.addFilter("postOgAsset", postOgAssetUrl);
  eleventyConfig.addFilter("postBody", (content) =>
    extractPostSection(content, "body"),
  );
  eleventyConfig.addFilter("postFootnotes", (content) =>
    extractPostSection(content, "footnotes"),
  );
  eleventyConfig.addFilter("postSources", (content) =>
    extractPostSection(content, "sources"),
  );
  eleventyConfig.addFilter("postTags", (tags, type) =>
    normalizePostTags(tags).filter(
      (tag) =>
        !POST_TYPES.includes(tag.toLowerCase()) &&
        tag.toLowerCase() !== String(type || "").toLowerCase(),
    ),
  );
  eleventyConfig.addFilter("postComponents", (content) => {
    const tags = new Set(
      [...String(content).matchAll(/<(pl-[a-z0-9-]+)\b/g)].map(
        (match) => match[1],
      ),
    );
    const assets = new Set();

    return [...tags]
      .map((tag) => ({ tag, ...POST_COMPONENTS[tag] }))
      .filter((component) => {
        const key = `${component.script || ""}\0${component.style || ""}`;

        if (assets.has(key)) {
          return false;
        }

        assets.add(key);
        return true;
      });
  });
  eleventyConfig.addFilter("searchText", (post) =>
    [
      post.data.title,
      post.data.description,
      post.data.type,
      ...normalizePostTags(post.data.tags),
    ]
      .join(" ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""),
  );
  eleventyConfig.addFilter("typeLabel", typeLabel);

  return {
    dir: {
      includes: "_includes",
      input: "content/posts",
      output: "posts",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: false,
    templateFormats: ["md", "njk"],
  };
}
