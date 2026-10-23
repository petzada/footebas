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
const OLD_HOSTS = ['footebas.com.br', 'www.footebas.com.br'];

// OpenNext tests `has.host` as an unanchored regex, so "footebas.com.br" would
// also match lp./game.; anchor and escape every host.
const host = (name: string) => ({
  type: 'host' as const,
  value: `^${name.replaceAll('.', '\.')}$`,
});

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Sign-in callbacks registered on the old hosts keep working on the game.
      ...OLD_HOSTS.map((name) => ({
        source: '/auth/:path*',
        has: [host(name)],
        destination: `https://${GAME_HOST}/auth/:path*`,
        permanent: false,
      })),
      // Apex and www send visitors to the landing. OpenNext leaves ":path*"
      // unfilled when it matches nothing, so the root gets its own rule.
      ...OLD_HOSTS.flatMap((name) => [
        {
          source: '/',
          has: [host(name)],
          destination: `https://${LANDING_HOST}/`,
          permanent: true,
        },
        {
          source: '/:path+',
          has: [host(name)],
          destination: `https://${LANDING_HOST}/:path+`,
          permanent: true,
        },
      ]),
      // The landing lives at the root of its host; the old path forwards.
      ...[LANDING_HOST, GAME_HOST].map((name) => ({
        source: '/landing',
        has: [host(name)],
        destination: `https://${LANDING_HOST}/`,
        permanent: true,
      })),
    ];
  },
  async rewrites() {
    return [
      {
        source: '/',
        has: [host(LANDING_HOST)],
        destination: '/landing',
      },
    ];
  },
};

export default nextConfig;

// Expõe bindings do Cloudflare (getCloudflareContext) durante `next dev`.
initOpenNextCloudflareForDev();
