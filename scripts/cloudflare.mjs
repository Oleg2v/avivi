#!/usr/bin/env node
/**
 * Cloudflare Workers helper for the OpenNext build (macOS, Linux and Windows).
 *
 *   npm run build:cf     build for Workers into .open-next (no deploy)
 *   npm run preview:cf   build, then serve it locally in workerd at http://localhost:8787
 *   npm run deploy:cf    build, then deploy with Wrangler to the account and domain in wrangler.jsonc
 *
 * NEXT_PUBLIC_SITE_URL sets the absolute address used by canonical, hreflang, Open Graph and the sitemap
 * (default: https://avivi.kikkey.com). Deploying needs CLOUDFLARE_API_TOKEN in the environment or `npx wrangler login`.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const mode = ['build', 'preview', 'deploy'].includes(process.argv[2]) ? process.argv[2] : 'deploy';
const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://avivi.kikkey.com';

// The token can see more than one account: always target the one pinned in wrangler.jsonc.
const wrangler = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const account = wrangler.match(/"account_id"\s*:\s*"([0-9a-f]{32})"/)?.[1];

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      env: { ...process.env, ...env },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`))));
  });
}

const env = {
  DEPLOY_TARGET: 'cloudflare',
  NEXT_PUBLIC_SITE_URL: site,
  NEXT_TELEMETRY_DISABLED: '1',
  WRANGLER_SEND_METRICS: 'false',
  ...(account ? { CLOUDFLARE_ACCOUNT_ID: account } : {}),
};

try {
  await run('npx', ['opennextjs-cloudflare', 'build'], env);
  // Copies the prerendered pages into the static assets (read-only cache); no remote calls.
  await run('npx', ['opennextjs-cloudflare', 'populateCache', 'local'], env);
  if (mode === 'preview') await run('npx', ['wrangler', 'dev'], env);
  if (mode === 'deploy') {
    await run('npx', ['wrangler', 'deploy'], env);
    console.log(`\nLive: ${site}\n`);
  }
} catch (err) {
  console.error(`\n${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
