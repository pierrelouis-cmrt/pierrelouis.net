const extractHtmlClasses = (content) => {
  const matches = new Set();
  const addTokens = (value) => {
    value
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .forEach((token) => matches.add(token));
  };

  const classAttrRegex = /<[^>]*\sclass\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = classAttrRegex.exec(content))) {
    addTokens(match[2] || match[3] || "");
  }

  const bindClassAttrRegex =
    /<[^>]*\s(?:x-bind:class|:class)\s*=\s*("([^"]*)"|'([^']*)')/g;
  while ((match = bindClassAttrRegex.exec(content))) {
    const expr = match[2] || match[3] || "";
    const stringRegex = /(['"`])((?:\\.|(?!\1).)*)\1/g;
    let stringMatch;
    while ((stringMatch = stringRegex.exec(expr))) {
      addTokens(stringMatch[2]);
    }
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
