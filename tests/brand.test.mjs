import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
test('PINCODE IT editorial identity is present', () => {
  const css = read('src/app/globals.css');
  const layout = read('src/app/layout.tsx');
  assert.match(css, /#008f64/i);
  assert.match(css, /backdrop-filter/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(layout, /PINCODE IT/);
});
test('project remains separate from the original website', () => {
  assert.equal(JSON.parse(read('package.json')).name, 'pincode-headless-wordpress');
  assert.match(read('docs/ORIGINAL_SITE_PROTECTION.md'), /no files from this repository are written/);
});
