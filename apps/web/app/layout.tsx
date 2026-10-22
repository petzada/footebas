import '@fontsource-variable/archivo';
import '@fontsource/rajdhani/600.css';
import './globals.css';

export const metadata = {
  title: 'Footebas — Sua carreira, sua história',
  description: 'Manager de futebol rápido, brasileiro e feito para o celular.',
  manifest: '/manifest.webmanifest',
};

// Applies the saved theme before paint so light mode never flashes dark.
const themeBootstrap = `try{if(localStorage.getItem('footebas-theme')==='light')document.documentElement.classList.remove('dark')}catch{}`;

export const viewport = { themeColor: '#10251b' };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
