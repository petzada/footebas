import '@fontsource/press-start-2p/latin-400.css';
import './globals.css';

export const metadata = {
  title: 'Footebas — Sua carreira, sua história',
  description: 'Manager de futebol rápido, brasileiro e feito para o celular.',
  manifest: '/manifest.webmanifest',
};

// One retro theme (ADR 0012): the browser chrome matches the grass.
export const viewport = { themeColor: '#2f7d3a', colorScheme: 'light' };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
