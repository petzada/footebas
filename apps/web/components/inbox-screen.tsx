'use client';

import { useState } from 'react';
import { Newspaper, Trash } from '@phosphor-icons/react';
import { InboxDecisions } from '@/components/inbox-decisions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CareerApiPort, CareerView, Screen } from '@/lib/career-api';
import { formatGameDate, type InboxPort } from '@/lib/inbox-product';

type NewsItem = CareerView['world']['news'][number];

/**
 * Caixa de entrada as a screen of its own (docs/design revisão mobile, D6):
 * decisions and messages at the top (answered in place, trash once nothing
 * waits), then the Notícias of the career that are not inbox messages.
 * Opening it marks the messages read (`MarkInboxRead`, in `career-game`),
 * so the badge of the bar and menu clears.
 */
export function InboxScreen({
  career,
  api,
  port,
  navigate,
  onCareerChange,
  reportError,
}: {
  career: CareerView;
  api: CareerApiPort;
  port: InboxPort;
  navigate(value: Screen): void;
  onCareerChange(value: CareerView): void;
  reportError(value: string): void;
}) {
  // Ids of the inbox messages, so the Notícias list does not repeat them.
  const [inboxIds, setInboxIds] = useState<ReadonlySet<string> | null>(null);
  const news = career.world.news.filter(
    (item) => inboxIds === null || !inboxIds.has(item.id),
  );
  const refresh = async () => {
    const next = await api.getCareer();
    if (next) onCareerChange(next);
  };
  return (
    <div className="grid gap-4">
      {/* On the grass, not on a panel: chalk tones keep AA contrast. */}
      <header className="text-chalk drop-shadow-[0_1px_0_rgb(0_0_0/0.6)]">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-chalk/90">
          Carreira
        </p>
        <h2 className="font-display text-xs font-bold uppercase sm:text-sm">
          Caixa de entrada
        </h2>
        <p className="mt-1 max-w-2xl text-sm">
          Decisões, recados e relatórios. O que espera resposta fica no topo e
          só pode ser excluído depois de decidido.
        </p>
      </header>
      <InboxDecisions
        port={port}
        navigate={navigate}
        variant="full"
        onView={(view) =>
          setInboxIds(new Set(view.messages.map((message) => message.id)))
        }
        onResolved={() => void refresh().catch(() => undefined)}
      />
      {(inboxIds !== null || career.world.news.length > 0) && (
        <NewsList
          news={news}
          onDelete={async (id) => {
            try {
              await port.remove(id);
              await refresh();
            } catch (caught) {
              reportError(
                caught instanceof Error
                  ? caught.message
                  : 'Não foi possível excluir a mensagem.',
              );
            }
          }}
        />
      )}
    </div>
  );
}

/** Career news (milestones) outside the inbox messages, newest first. */
export function NewsList({
  news,
  onDelete,
}: {
  news: readonly NewsItem[];
  onDelete?: (id: string) => Promise<void>;
}) {
  const [removing, setRemoving] = useState<string | null>(null);
  return (
    <section aria-labelledby="inbox-noticias" className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2
          id="inbox-noticias"
          className="flex items-center gap-2 font-pixel text-[.65rem]"
        >
          <Newspaper aria-hidden="true" />
          Notícias
        </h2>
        <Badge variant="secondary">{news.length}</Badge>
      </div>
      {news.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhuma notícia além das mensagens acima. Marcos da carreira (acessos,
          títulos, mudanças de clube) chegam aqui.
        </p>
      ) : (
        <ul aria-label="Notícias da carreira" className="mt-3 grid gap-2">
          {news.map((item) => (
            <li
              key={item.id}
              className="grid gap-1 border-2 border-ink border-l-8 border-l-sky bg-popover p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{item.tag}</Badge>
                {item.date && (
                  <span className="font-pixel text-[.45rem] text-muted-foreground">
                    {formatGameDate(item.date)}
                  </span>
                )}
                {item.pending && <Badge>Decisão pendente</Badge>}
                {item.deletable && !item.pending && onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-11"
                    aria-label={`Excluir: ${item.headline}`}
                    disabled={removing !== null}
                    onClick={() => {
                      setRemoving(item.id);
                      void onDelete(item.id).finally(() => setRemoving(null));
                    }}
                  >
                    <Trash aria-hidden="true" />
                  </Button>
                )}
              </div>
              <h3 className="text-sm font-extrabold leading-snug">
                {item.headline}
              </h3>
              <p className="text-sm text-muted-foreground">{item.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
