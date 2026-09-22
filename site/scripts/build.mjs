import { readFile, writeFile, mkdir, cp, readdir, access, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { Marked } from 'marked';
import { site, categories, articlePath } from '../src/config.mjs';
import { home, listing, articlePage, infoPage } from '../src/templates.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'dist');
// This fixed output directory is generated exclusively by this script.
await rm(output, {recursive:true, force:true});
await mkdir(output, {recursive:true});
try { await access(join(root,'public/og.png')); process.env.SITE_OG='true'; } catch { process.env.SITE_OG='false'; }
const articles = [];
for (const file of (await readdir(join(root,'content'))).filter(f=>f.endsWith('.json')).sort()) {
  articles.push(...JSON.parse(await readFile(join(root,'content',file),'utf8')));
}
const slugs = new Set();
for (const a of articles) {
  for (const field of ['slug','category','title','description','summary','body']) if (typeof a[field] !== 'string' || !a[field]) throw new Error(`Missing ${field} in ${a.slug}`);
  if (!categories[a.category] || !/^[a-z0-9-]+$/.test(a.slug) || slugs.has(a.slug)) throw new Error(`Invalid/duplicate article ${a.slug}`);
  if (!Array.isArray(a.sources) || !Array.isArray(a.related)) throw new Error(`Missing sources/related ${a.slug}`);
  slugs.add(a.slug);
  a.minutes = Math.max(2, Math.ceil(a.body.split(/\s+/).length/210));
}
for (const a of articles) for (const slug of a.related) if (!slugs.has(slug)) throw new Error(`Missing related article ${a.slug} -> ${slug}`);
const routes=[];
async function page(path, html) {
 const file = path==='404.html' ? join(output,path) : join(output,path,'index.html');
 await mkdir(join(file,'..'),{recursive:true});
 await writeFile(file,html);
 if(path!=='404.html')routes.push(path==='.'?'/':`/${path.replace(/\/$/,'')}/`);
}
await cp(join(root,'public'),output,{recursive:true});
await page('.',home(articles));
await page('articles',listing(articles));
for(const category of Object.keys(categories)) await page(category,listing(articles,category));
for(const kind of ['about','privacy']) await page(kind,infoPage(kind));
await page('404.html',infoPage('404'));
for (const article of articles) {
  const toc=[];const ids=new Set();
  const marked = new Marked({gfm:true});
  marked.use({renderer:{heading({tokens,depth}) {
    const inner=this.parser.parseInline(tokens);
    const text=inner.replace(/<[^>]*>/g,'').replace(/&[^;]+;/g,'');
    const base=text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'section';
    let id=base;let count=2;while(ids.has(id))id=`${base}-${count++}`;ids.add(id);
    if(depth===2)toc.push({id,text});
    return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
  }}});
  const html=marked.parse(article.body);
  await page(articlePath(article).slice(1),articlePage(article,html,toc,articles));
}
const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(path=>`<url><loc>${site.origin}${path}</loc><lastmod>${site.date}</lastmod></url>`).join('')}</urlset>\n`;
await writeFile(join(output,'sitemap.xml'),sitemap);
await writeFile(join(output,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${site.origin}/sitemap.xml\n`);
await writeFile(join(output,'build-manifest.json'),JSON.stringify({routes,articles:articles.map(a=>({path:articlePath(a),title:a.title,category:a.category,words:a.body.split(/\s+/).length}))},null,2));
console.log(`Built ${routes.length} crawlable pages, ${articles.length} articles, sitemap, robots.txt, and 404.html into site/dist.`);
