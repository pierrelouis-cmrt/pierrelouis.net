const DEFAULT_EXTRACTOR = /[^<>"'`\\s]*[^<>"'`\\s:]/g;

const extractHtmlClasses = (content) => {
  const matches = new Set();
  const addTokens = (value) => {
    value
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .forEach((token) => matches.add(token));
  };
  const addTokensFromBinding = (expr) => {
    const stringRegex = /(['"`])((?:\\.|(?!\1).)*)\1/g;
    let stringMatch;
    while ((stringMatch = stringRegex.exec(expr))) {
      addTokens(stringMatch[2]);
    }
  };

  let match;
  const classAttrRegex = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  while ((match = classAttrRegex.exec(content))) {
    addTokens(match[1] || match[2] || "");
  }

  const bindClassAttrRegex =
    /\b(?:x-bind:class|:class)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  while ((match = bindClassAttrRegex.exec(content))) {
    const expr = match[1] || match[2] || "";
    addTokensFromBinding(expr);
  }

  if (
    matches.size === 0 &&
    /(?:\bclass\s*=|\bx-bind:class\s*=|\s:class\s*=)/i.test(content)
  ) {
    return content.match(DEFAULT_EXTRACTOR) || [];
  }

  return Array.from(matches);
};

module.exports = {
  content: {
    files: [
      "./index.html",
      "./src/*.html",
      "./links/*.html",
      "./about/*.html",
      "./now/*.html",
      "./colophon/*.html",
      "./uses/*.html",
      "./projects/*.html",
      "./posts/*.html",
      "./posts/**/*.html",
      "./bookmarks/*.html",
    ],
    extract: {
      html: extractHtmlClasses,
    },
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
