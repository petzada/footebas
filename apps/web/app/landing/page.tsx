import { LandingPage } from '@/components/landing/landing-page';
import './landing.css';

export const metadata = {
  title: 'Footebas — Manager de futebol brasileiro, grátis e no celular',
  description:
    'Comece uma carreira de treinador com clubes brasileiros de verdade: Séries A, B e C, Copa do Brasil, estaduais e Libertadores. Grátis no navegador; licença única de R$ 49,90 via PIX.',
  openGraph: {
    title: 'Footebas — Sua carreira, sua história',
    description:
      'Manager de futebol rápido, brasileiro e feito para o celular. Rodada em poucos toques, partida ao vivo em pixel art.',
    locale: 'pt_BR',
    type: 'website',
  },
};

export default function Page() {
  return <LandingPage />;
}
