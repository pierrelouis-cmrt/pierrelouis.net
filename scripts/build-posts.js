const fs = require('fs/promises');
const path = require('path');
const MarkdownIt = require('markdown-it');
const mathjax = require('markdown-it-mathjax3');

async function build() {
  const postsPath = path.join(__dirname, '..', 'posts', 'posts.json');
  const posts = JSON.parse(await fs.readFile(postsPath, 'utf8'));
  const templatePath = path.join(__dirname, '..', 'template', 'index.html');
  const template = await fs.readFile(templatePath, 'utf8');

  const md = new MarkdownIt({ html: true }).use(mathjax);

  for (const item of posts) {
    const slug = item.link.split('/').filter(Boolean).pop();
    const section = item.tag === 'Articles' ? 'articles' : 'notes';
    const mdFile = path.join('posts', section, 'md', `${slug}.md`);

    let source;
    try {
      source = await fs.readFile(mdFile, 'utf8');
    } catch (err) {
      console.error(`Missing markdown for ${slug}`);
      continue;
    }

    const html = md.render(source);
    const dateStr = `${item.month} ${item.day}, ${item.year}`;
    const content = `<h1>${item.title}</h1>\n<p>${item.description}</p>\n<p>${dateStr}</p>\n${html}`;

    const page = template.replace(/<main>[\s\S]*?<\/main>/i, `<main>\n${content}\n</main>`);

    const outDir = path.join('posts', section, slug);
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, 'index.html'), page);
  }
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
