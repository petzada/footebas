import '@fontsource/press-start-2p/latin-400.css';
import './globals.css';
import { RumRuntime } from '@/components/rum-runtime';

const OG_IMAGE = {
  url: 'https://lp.footebas.com.br/og.png',
  width: 1200,
  height: 630,
  alt: 'Footebas: manager de futebol brasileiro em pixel art, grátis e no celular',
};

export const metadata = {
  metadataBase: new URL('https://lp.footebas.com.br'),
  title: 'Footebas — Sua carreira, sua história',
  description: 'Manager de futebol rápido, brasileiro e feito para o celular.',
  manifest: '/manifest.webmanifest',
  openGraph: {
    siteName: 'Footebas',
    title: 'Footebas — Sua carreira, sua história',
    description:
      'Manager de futebol brasileiro: Séries A, B e C reais, Copa do Brasil e Libertadores. Grátis, no celular, com partida ao vivo em pixel art.',
    locale: 'pt_BR',
    type: 'website',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Footebas — Sua carreira, sua história',
    description:
      'Manager de futebol brasileiro, grátis e no celular. Clubes reais, mercado com IA, ranking global.',
    images: [OG_IMAGE.url],
  },
};

// One retro theme (ADR 0012): the browser chrome matches the grass.
export const viewport = { themeColor: '#2f7d3a', colorScheme: 'light' };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <RumRuntime />
      </body>
    </html>
  );
}
