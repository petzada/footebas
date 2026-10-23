import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  async redirects() {
    // www.footebas.com.br → footebas.com.br (apex é o domínio canônico).
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.footebas.com.br' }],
        destination: 'https://footebas.com.br/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

// Expõe bindings do Cloudflare (getCloudflareContext) durante `next dev`.
initOpenNextCloudflareForDev();
