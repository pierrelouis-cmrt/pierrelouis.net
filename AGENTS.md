# Repository Guidelines for pierrelouis.net

This repository contains a static portfolio site built with HTML, Tailwind CSS and Alpine.js. JavaScript helpers live in `src/`. HTML pages are organised at the repository root or under folders like `about/`, `projects/`, etc. CSS is compiled from `src/styles.css` to `src/output.css`.

## Working with the command palette
- The palette configuration is centralised in `src/script.js`. Update `COMMAND_ITEMS_DATA`, `COMMAND_ACTION_MAP` and `SHORTCUT_MAP` there when adding new pages or commands.
- HTML pages only include minimal Alpine `x-data` setup and do not repeat shortcut definitions.

## Building the site
- Run `npm install` once to install dependencies.
- Use `npm run build` to generate `src/output.css` from Tailwind. Commit the updated CSS along with your changes.

## Style notes
- Use two spaces for indentation in HTML and JavaScript files.
- `src/output.css` is generated – avoid manual edits.

