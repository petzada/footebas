import { parseCatalog, type ContentCatalog } from './catalog.js';
import { CATALOG_SOURCE } from './generated/catalog-source.js';

export * from './catalog.js';
export { buildCatalog, slug, type CatalogBuildInput } from './build.js';

let cached: ContentCatalog | undefined;

/** The launch catalog generated from `dados/elencos/` (see scripts/). */
export function loadCatalog(): ContentCatalog {
  cached ??= parseCatalog(JSON.parse(CATALOG_SOURCE) as unknown);
  return cached;
}
