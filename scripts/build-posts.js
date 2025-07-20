const fs = require('fs/promises');
const path = require('path');

async function build() {
  const tplPath = path.resolve(__dirname, '../template/index.html');
  let tpl;
  try {
    tpl = await fs.readFile(tplPath, 'utf8');
  } catch (err) {
    console.error('Template missing:', tplPath);
    return;
  }

  const postRoots = ['articles', 'notes'].map((p) => path.resolve(__dirname, '../posts', p));
  for (const dir of postRoots) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const folder = path.join(dir, entry.name);
        const mdPath = path.join(folder, 'index.md');
        try {
          const md = await fs.readFile(mdPath, 'utf8');
          const html = tpl.replace('{{ content }}', md);
          await fs.writeFile(path.join(folder, 'index.html'), html);
        } catch {
          // ignore folders without markdown
        }
      }
    } catch {
      // directory may not exist
    }
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
