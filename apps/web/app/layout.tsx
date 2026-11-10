import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import './globals.css';
import { RumRuntime } from '@/components/rum-runtime';

const OG_IMAGE = {
  url: 'https://lp.footebas.com.br/og.png',
  width: 1200,
  height: 630,
  alt: 'Footebas: manager de futebol brasileiro com partidas em 3D, grátis e no navegador',
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
      'Manager de futebol brasileiro: Séries A, B e C reais, Copa do Brasil e Libertadores. Grátis, no navegador, com partida ao vivo em 3D.',
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

// One dark theme (ADR 0018): the browser chrome matches the night sky.
export const viewport = { themeColor: '#090d13', colorScheme: 'dark' };

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
