import matter from "gray-matter";
import MarkdownIt from "markdown-it";

const stripObsidianComments = (source) => source.replace(/%%[\s\S]*?%%/g, "");

const markdown = new MarkdownIt({
  breaks: false,
  html: true,
  linkify: true,
  typographer: true,
});

markdown.core.ruler.after("inline", "list-sheet-entries", (state) => {
  for (const token of state.tokens) {
    if (token.type === "bullet_list_open" && token.level === 0) {
      token.attrJoin("class", "list-sheet__entry-list");
    }

    if (token.type === "list_item_open" && token.level === 1) {
      token.attrSet("data-list-entry", "");
    }

    if (token.type === "inline" && token.children) {
      for (const child of token.children) {
        if (child.type !== "link_open") continue;

        const href = child.attrGet("href");
        if (/^(?:https?:)?\/\//i.test(href ?? "")) {
          child.attrJoin("class", "external-link");
          child.attrSet("target", "_blank");
          child.attrSet("rel", "noopener noreferrer");
        }
      }
    }
  }
});

export const renderListMarkdown = (source) => {
  const parsed = matter(String(source ?? ""));
  return markdown.render(stripObsidianComments(parsed.content)).trim();
};
