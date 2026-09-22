import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { site } from '../src/config.mjs';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const manifest=JSON.parse(await readFile(join(root,'build-manifest.json'),'utf8'));
assert.ok(manifest.articles.length>=36,'Expected at least 36 distinct guides');
for(const article of manifest.articles)assert.ok(article.words>=350,`${article.path}: article too thin`);
const paths=[];
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())await walk(path);else if(path.endsWith('.html'))paths.push(path);}}
await walk(root);
const titles=new Set();const descriptions=new Set();const canonicals=new Set();
for(const file of paths){
 const html=await readFile(file,'utf8');
 const title=html.match(/<title>(.*?)<\/title>/s)?.[1];
 const description=html.match(/<meta name="description" content="([^"]+)"/s)?.[1];
 const canonical=html.match(/<link rel="canonical" href="([^"]+)"/s)?.[1];
 assert.ok(title&&description&&canonical,`Missing SEO metadata: ${file}`);
 assert.ok(!titles.has(title),`Duplicate title: ${title}`);titles.add(title);
 assert.ok(!descriptions.has(description),`Duplicate description: ${file}`);descriptions.add(description);
 assert.ok(!canonicals.has(canonical),`Duplicate canonical: ${file}`);canonicals.add(canonical);
 assert.ok(canonical.startsWith(site.origin+'/'));
 assert.equal([...html.matchAll(/<h1(?:\s|>)/g)].length,1,`Expected one h1: ${file}`);
 assert.ok(html.includes('lang="en"')&&html.includes('name="viewport"'));
 for(const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)){
  const data=JSON.parse(match[1]);assert.equal(data['@context'],'https://schema.org');
 }
 for(const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[?#][^"]*)?"/g)){
  if(match[1].startsWith('//'))continue;
  const target=resolve(root,`.${decodeURIComponent(match[1])}`);
  let found=false;try{const s=await stat(target);found=s.isFile()||(s.isDirectory()&&(await stat(join(target,'index.html'))).isFile());}catch{}
  assert.ok(found,`Broken local URL ${match[1]} in ${file}`);
 }
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 for(const match of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.has(match[1]),`Missing anchor ${match[1]} in ${file}`);
 assert.ok(!/TYPESAFE_API_KEY\s*=\s*["']?(?:ts_|sk_|npm_)/.test(html),'Unexpected credential-like value');
}
const sitemap=await readFile(join(root,'sitemap.xml'),'utf8');
for(const route of manifest.routes)assert.ok(sitemap.includes(`<loc>${site.origin}${route}</loc>`),`Sitemap missing ${route}`);
assert.equal([...sitemap.matchAll(/<loc>/g)].length,manifest.routes.length);
assert.ok((await readFile(join(root,'robots.txt'),'utf8')).includes(`${site.origin}/sitemap.xml`));
console.log(`Checked ${paths.length} HTML files: unique metadata, JSON-LD, one H1, local links, anchors, content length, and sitemap coverage.`);
