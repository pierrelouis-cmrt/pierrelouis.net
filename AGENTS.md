# Pierre‑Louis' Portfolio – Agent Guide

## 1  Project Snapshot

- **What it is:** A static personal website (HTML + CSS) with light Alpine.js for small interactions.
- **Why it matters:** Fast, no backend, easy to host, easy to edit.

## 2  Directory Map

```
/               root files, index.html, AGENTS.md, config
/about/          about/index.html
/projects/       projects/index.html
/posts/          blog posts (one folder per post)
/src/            styles.css  → compiled → output.css
/assets/         images, icons
/media/          fonts
```

## 3  Build & Preview

```bash
npm install      # first‑time setup
npm run build    # compile Tailwind into src/output.css (purges unused classes)
# open index.html (or use any static server) to preview
```

_`npm run dev`_\* watches **`styles.css`** and auto‑rebuilds.\*

## 4  Styling Rules

1. **Default to plain CSS** in `src/styles.css` (use variables, BEM‑ish classes).
2. **Use Tailwind only** when:

   - the component _already_ uses Tailwind, **or**
   - you are **explicitly asked** to use it.

3. Respect existing light/dark variables (e.g. `var(--bg)`), keep new colors theme‑aware.

## 5  JavaScript

_Alpine.js_ powers theme toggle, command palette, etc. Keep new JS inline and declarative (`x-data`, `x-show`, `@click`). No heavy frameworks.

## 6  Agent Workflow

1. **Follow the request exactly.** No scope creep.
2. **Small, atomic commits.** Build CSS and manually open the affected pages before each commit.
3. **Ask when unsure.** Better to clarify than guess.
4. **Consistency = success.** Match formatting, class order, naming and of course styling.
