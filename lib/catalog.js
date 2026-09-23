// Reads catalog.json once per function instance (bundled via vercel.json includeFiles).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let cache = null;

export function loadCatalog() {
  if (cache) return cache;
  try {
    const c = JSON.parse(readFileSync(join(process.cwd(), 'catalog.json'), 'utf8'));
    cache = {
      series: Array.isArray(c.series) ? c.series : [],
      archiveBlocklist: Array.isArray(c.archiveBlocklist) ? c.archiveBlocklist : []
    };
  } catch (e) {
    cache = { series: [], archiveBlocklist: [] };
  }
  return cache;
}

// Used by tests
export function _resetCatalog() { cache = null; }
