import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

/**
 * Cloudflare Workers build (OpenNext). Every page is prerendered, so the read-only static assets
 * cache serves them; the API routes run in the Worker. No R2, KV or D1 resources are needed.
 */
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
