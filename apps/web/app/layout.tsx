import '@fontsource-variable/archivo';
import '@fontsource/rajdhani/600.css';
import './globals.css';

export const metadata = {
  title: 'Footebas — Sua carreira, sua história',
  description: 'Manager de futebol rápido, brasileiro e feito para o celular.',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="dark">
      <body>{children}</body>
    </html>
  );
}
