import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Footebas',
    short_name: 'Footebas',
    description: 'Sua carreira, sua história.',
    start_url: '/',
    display: 'standalone',
    background_color: '#10251b',
    theme_color: '#62c873',
    orientation: 'portrait',
    lang: 'pt-BR',
    categories: ['games', 'sports'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
