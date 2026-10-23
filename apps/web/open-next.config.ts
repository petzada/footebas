import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

// O web não usa ISR/revalidate: páginas pré-renderidas no build são servidas
// direto dos static assets do Worker (cache somente leitura, sem R2/KV/D1).
// Se algum dia entrar ISR, troque por r2IncrementalCache + bucket no wrangler.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
