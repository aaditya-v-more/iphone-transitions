import { copyFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Only the namespaced production build is public. Keep the upstream root redirect
// separate so Studio can proxy /shape/ without a redirect loop.
await copyFile('public/robots.txt', 'vercel-dist/robots.txt');
const html = await readFile('vercel-dist/shape/index.html', 'utf8');
assert(html.includes('href="https://studio.aadityamore.com/shape/"'));
assert(html.includes('src="/shape/assets/'));
const sitemap = await readFile('vercel-dist/shape/sitemap.xml', 'utf8');
assert(sitemap.includes('<loc>https://studio.aadityamore.com/shape/</loc>'));
console.log('Shape: namespaced assets, canonical URL and sitemap checks passed.');
