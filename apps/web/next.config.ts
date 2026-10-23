import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

/*
 * Hosts (one Worker serves all of them, see wrangler.jsonc):
 *   lp.footebas.com.br    → landing page (app/landing) at "/"
 *   game.footebas.com.br  → the game
 *   footebas.com.br / www → redirected to the landing
 */
const LANDING_HOST = 'lp.footebas.com.br';
const GAME_HOST = 'game.footebas.com.br';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Sign-in callbacks registered on the old hosts keep working on the game.
      ...['footebas.com.br', 'www.footebas.com.br'].map((host) => ({
        source: '/auth/:path*',
        has: [{ type: 'host' as const, value: host }],
        destination: `https://${GAME_HOST}/auth/:path*`,
        permanent: false,
      })),
      // Apex and www send visitors to the landing.
      ...['footebas.com.br', 'www.footebas.com.br'].map((host) => ({
        source: '/:path*',
        has: [{ type: 'host' as const, value: host }],
        destination: `https://${LANDING_HOST}/:path*`,
        permanent: true,
      })),
      // The landing lives at the root of its host; the old path forwards.
      {
        source: '/landing',
        has: [{ type: 'host' as const, value: LANDING_HOST }],
        destination: `https://${LANDING_HOST}/`,
        permanent: true,
      },
      {
        source: '/landing',
        has: [{ type: 'host' as const, value: GAME_HOST }],
        destination: `https://${LANDING_HOST}/`,
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/',
        has: [{ type: 'host' as const, value: LANDING_HOST }],
        destination: '/landing',
      },
    ];
  },
};

export default nextConfig;

// Expõe bindings do Cloudflare (getCloudflareContext) durante `next dev`.
initOpenNextCloudflareForDev();
