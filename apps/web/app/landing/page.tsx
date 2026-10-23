import { LandingPage } from '@/components/landing/landing-page';
import './landing.css';

export const metadata = {
  title: 'Footebas — Manager de futebol brasileiro, grátis e no celular',
  description:
    'Comece uma carreira de treinador com clubes brasileiros de verdade: Séries A, B e C, Copa do Brasil, estaduais e Libertadores. Grátis no navegador; licença única de R$ 49,90 via PIX.',
  openGraph: {
    siteName: 'Footebas',
    url: 'https://lp.footebas.com.br/',
    title: 'Footebas — Sua carreira, sua história',
    description:
      'Manager de futebol brasileiro: Séries A, B e C reais, Copa do Brasil e Libertadores. Grátis, no celular, com partida ao vivo em pixel art. Licença única de R$ 49,90 via PIX.',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: 'https://lp.footebas.com.br/og.png',
        width: 1200,
        height: 630,
        alt: 'Footebas: manager de futebol brasileiro em pixel art, grátis e no celular',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Footebas — Manager de futebol brasileiro, grátis e no celular',
    description:
      'Clubes reais das Séries A, B e C, mercado com IA, partida ao vivo em pixel art e ranking global. Jogue grátis.',
    images: ['https://lp.footebas.com.br/og.png'],
  },
};

export default function Page() {
  return <LandingPage />;
}
