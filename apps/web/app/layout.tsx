import './globals.css';

export const metadata = {
  title: 'Footebas — Sua carreira, sua história',
  description: 'Manager de futebol rápido, brasileiro e feito para o celular.',
  manifest: '/manifest.webmanifest',
};

// ISOPOP is light-only (ADR 0009): the browser chrome matches the pastel sky.
export const viewport = { themeColor: '#bee3f0', colorScheme: 'light' };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
