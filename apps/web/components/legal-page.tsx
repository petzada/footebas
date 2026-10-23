import type { ReactNode } from 'react';
import Link from 'next/link';
import { Brand } from '@/components/brand';

export const LEGAL_DRAFT_NOTICE =
  'Versão preliminar — sujeita a revisão jurídica';

/** Placeholders the responsible person fills before launch (checklist). */
export const LEGAL_PLACEHOLDER = {
  company: '[preencher: razão social]',
  cnpj: '[preencher: CNPJ]',
  address: '[preencher: endereço]',
  email: '[preencher: e-mail de contato]',
  dpo: '[preencher: encarregado de dados (DPO)]',
  updatedOn: '[preencher: data da última atualização]',
} as const;

/** Small text link with a 44px tall tap area (WCAG 2.5.5). */
const legalLink =
  'inline-flex min-h-11 items-center underline underline-offset-4';

/** Public static page frame for Termos de uso and Política de privacidade. */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Brand />
        <Link
          href="/"
          className="inline-flex min-h-11 items-center font-pixel text-[.5rem] uppercase text-chalk underline underline-offset-4 drop-shadow-[0_1px_0_rgb(0_0_0/0.6)]"
        >
          Voltar ao jogo
        </Link>
      </div>
      <article className="panel mt-6 p-5 sm:p-8">
        <p
          role="note"
          className="inline-block border-2 border-ink bg-bulb px-2 py-1 font-pixel text-[.5rem] uppercase text-bulb-foreground"
        >
          {LEGAL_DRAFT_NOTICE}
        </p>
        <h1 className="mt-4 font-pixel text-base leading-relaxed sm:text-xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{intro}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Última atualização: {LEGAL_PLACEHOLDER.updatedOn}
        </p>
        <div className="legal mt-6 flex flex-col gap-6 text-sm leading-relaxed [&_h2]:font-pixel [&_h2]:text-[.65rem] [&_h2]:leading-relaxed [&_li]:mt-1 [&_p+p]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
        <footer className="mt-8 border-t-2 border-ink pt-4 text-xs text-muted-foreground">
          <nav aria-label="Documentos legais" className="flex flex-wrap gap-4">
            <a className={legalLink} href="/termos">
              Termos de uso
            </a>
            <a className={legalLink} href="/privacidade">
              Política de privacidade
            </a>
          </nav>
          <p className="mt-2">
            {LEGAL_PLACEHOLDER.company} · {LEGAL_PLACEHOLDER.cnpj} ·{' '}
            {LEGAL_PLACEHOLDER.email}
          </p>
        </footer>
      </article>
    </main>
  );
}

/** Footer links for public screens (entry page). */
export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <nav
      aria-label="Documentos legais"
      className={`flex flex-wrap justify-center gap-4 text-xs ${className}`}
    >
      <a className={legalLink} href="/termos">
        Termos de uso
      </a>
      <a className={legalLink} href="/privacidade">
        Política de privacidade
      </a>
    </nav>
  );
}
