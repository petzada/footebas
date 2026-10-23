'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  ArrowsLeftRight,
  Check,
  MagnifyingGlass,
  Tag,
  X,
} from '@phosphor-icons/react';
import { ScreenSkeleton } from '@/components/retro/skeleton';
import { PixelAvatar } from '@/components/retro/pixel-avatar';
import { PixelCoin, PixelFlag } from '@/components/retro/sprites';
import { useTicker } from '@/components/retro/ticker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { CareerApiPort, CareerView } from '@/lib/career-api';
import {
  formatBrl,
  formatDate,
  marketRefusalMessage,
  type ListingInput,
  type MarketOfferView,
  type MarketOrigin,
  type MarketQuery,
  type MarketResultView,
  type MarketView,
  type PositionCode,
} from '@/lib/management-model';
import { useSound } from '@/lib/retro/use-sound';
import { cn } from '@/lib/utils';

const POSITIONS: readonly PositionCode[] = [
  'GOL',
  'LD',
  'ZAG',
  'LE',
  'VOL',
  'MC',
  'MEI',
  'PD',
  'PE',
  'ATA',
];

interface MarketScreenProps {
  career: CareerView;
  api: CareerApiPort;
  onCareerChange(value: CareerView): void;
  reportError(message: string): void;
}

/**
 * Mercado (docs/09 decision 7, ADR 0008): cash and wage bill, window status,
 * catalog search with filters, offers with counter-proposals, own listings
 * and loans. Deals between clubs are refused outside the window with a
 * Portuguese message; free agents stay open.
 */
export function MarketScreen({
  career,
  api,
  onCareerChange,
  reportError,
}: MarketScreenProps) {
  const { play } = useSound();
  const ticker = useTicker();
  const [market, setMarket] = useState<MarketView | null>(null);
  const [query, setQuery] = useState<MarketQuery>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [target, setTarget] = useState<MarketResultView | null>(null);
  const targetPanel = useRef<HTMLDivElement>(null);
  // Offers waiting for the manager come first (docs/09: proposals matter most).
  const byUrgency = <T extends { awaiting?: string }>(offers: readonly T[]) =>
    [...offers].sort(
      (left, right) =>
        Number(right.awaiting === 'manager') -
        Number(left.awaiting === 'manager'),
    );

  const load = useCallback(
    async (next: MarketQuery) => {
      try {
        setMarket(await api.getMarket(next));
      } catch (caught) {
        reportError(caught instanceof Error ? caught.message : 'Falhou.');
      }
    },
    [api, reportError],
  );
  useEffect(() => {
    let active = true;
    api
      .getMarket({})
      .then((value) => active && setMarket(value))
      .catch(
        (caught: unknown) =>
          active &&
          reportError(caught instanceof Error ? caught.message : 'Falhou.'),
      );
    return () => {
      active = false;
    };
  }, [api, reportError]);

  const run = async (
    label: string,
    action: () => Promise<MarketView>,
    refreshCareer = false,
  ) => {
    if (busy) return false;
    setBusy(true);
    try {
      reportError('');
      setNotice('');
      setMarket(await action());
      if (refreshCareer) {
        const view = await api.getCareer();
        if (view) onCareerChange(view);
      }
      play('coin');
      setNotice(label);
      ticker.announce(label, 'success');
      return true;
    } catch (caught) {
      play('error');
      const message =
        caught instanceof Error ? caught.message : 'Tente novamente.';
      reportError(message);
      setNotice(message);
      ticker.announce(message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const search = (event: FormEvent) => {
    event.preventDefault();
    play('click');
    void load(query);
  };

  if (!market) return <ScreenSkeleton label="Abrindo o mercado…" />;

  const windowOpen = market.window.status === 'open';
  const closedMessage =
    marketRefusalMessage('TRANSFER_WINDOW_CLOSED', market.window) ?? '';
  const squadFull =
    market.club !== undefined &&
    market.club.squadSize >= market.club.maxSquadSize;
  const awaitingMe = [...market.offersReceived, ...market.offersSent].filter(
    (offer) => offer.awaiting === 'manager',
  ).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="sr-only" role="status" aria-live="polite">
        {notice}
      </p>
      <header className="panel-board grid gap-2 p-3 sm:grid-cols-[1fr_auto]">
        {/* "R$ 38,6 mi" is 10 pixel glyphs: the digits shrink on phones and
            wrap only at the space ("R$ 38,6" / "mi"), never mid-word. */}
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="min-w-0">
            <dt className="font-pixel text-[.5rem] uppercase text-chalk/80">
              Caixa
            </dt>
            <dd className="led text-[.65rem] break-normal min-[400px]:text-sm sm:text-base">
              {formatBrl(market.club?.cash ?? 0)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-pixel text-[.5rem] uppercase text-chalk/80">
              Folha/mês
            </dt>
            <dd className="led text-[.65rem] break-normal min-[400px]:text-sm sm:text-base">
              {formatBrl(market.club?.monthlyWageBill ?? 0)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-pixel text-[.5rem] uppercase text-chalk/80">
              Elenco
            </dt>
            <dd
              className={cn(
                'led text-[.65rem] break-normal min-[400px]:text-sm sm:text-base',
                squadFull && 'text-destructive',
              )}
            >
              {market.club?.squadSize ?? 0}/{market.club?.maxSquadSize ?? 35}
            </dd>
          </div>
        </dl>
        <div
          className={cn(
            'px-border grid content-center gap-0.5 px-3 py-2 text-center',
            windowOpen ? 'bg-primary text-chalk' : 'bg-destructive text-chalk',
          )}
          role="status"
          aria-label={
            windowOpen
              ? `Janela aberta: ${market.window.name ?? ''}, fecha em ${String(market.window.daysRemaining ?? 0)} dias`
              : `Janela fechada. ${market.window.nextName} abre em ${formatDate(market.window.nextOpensOn)}`
          }
        >
          <span className="font-pixel text-[.55rem] uppercase">
            {windowOpen ? 'Janela aberta' : 'Janela fechada'}
          </span>
          <span className="led text-lg">
            {windowOpen
              ? `${String(market.window.daysRemaining ?? 0)}d`
              : `${String(market.window.daysUntilNext)}d`}
          </span>
          <span className="text-xs">
            {windowOpen
              ? `fecha em ${formatDate(market.window.closesOn ?? '')}`
              : `${market.window.nextName.replace('Janela ', '')} · ${formatDate(market.window.nextOpensOn)}`}
          </span>
        </div>
      </header>
      {!windowOpen && (
        <p className="panel flex items-center gap-2 p-2 text-xs" role="note">
          <PixelFlag size={12} />
          {closedMessage} Agentes livres continuam disponíveis.
        </p>
      )}

      <Tabs defaultValue="offers">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="offers">
            Propostas{awaitingMe > 0 && ` (${String(awaitingMe)})`}
          </TabsTrigger>
          <TabsTrigger value="search">Buscar</TabsTrigger>
          <TabsTrigger value="mine">Meu elenco</TabsTrigger>
        </TabsList>

        <TabsContent value="search">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.7fr)]">
            <div className="flex min-w-0 flex-col gap-2">
              <form
                className="panel grid gap-2 p-3"
                onSubmit={search}
                aria-label="Filtros de busca"
              >
                <div className="flex items-end gap-2">
                  <label className="grid min-w-0 flex-1 gap-1 text-xs">
                    Nome
                    <Input
                      value={query.text ?? ''}
                      onChange={(event) =>
                        setQuery({ ...query, text: event.target.value })
                      }
                      placeholder="Buscar atleta"
                    />
                  </label>
                  <Button
                    type="submit"
                    className="min-h-10"
                    aria-label="Buscar"
                  >
                    <MagnifyingGlass />
                  </Button>
                </div>
                <details className="group">
                  <summary className="flex min-h-11 cursor-pointer items-center font-pixel text-[.55rem]">
                    Mais filtros
                  </summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs">
                      Posição
                      <select
                        className="min-h-10 border-2 border-ink bg-popover px-2 text-sm"
                        value={query.position ?? ''}
                        onChange={(event) =>
                          setQuery({
                            ...query,
                            position: (event.target.value || undefined) as
                              PositionCode | undefined,
                          })
                        }
                      >
                        <option value="">Todas</option>
                        {POSITIONS.map((position) => (
                          <option key={position} value={position}>
                            {position}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs">
                      Força mínima
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={query.minStrength ?? ''}
                        onChange={(event) =>
                          setQuery({
                            ...query,
                            minStrength: event.target.value
                              ? Number(event.target.value)
                              : undefined,
                          })
                        }
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      Idade máxima
                      <Input
                        type="number"
                        min={15}
                        max={45}
                        value={query.maxAge ?? ''}
                        onChange={(event) =>
                          setQuery({
                            ...query,
                            maxAge: event.target.value
                              ? Number(event.target.value)
                              : undefined,
                          })
                        }
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      Valor máximo (R$)
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={query.maxValue ?? ''}
                        onChange={(event) =>
                          setQuery({
                            ...query,
                            maxValue: event.target.value
                              ? Number(event.target.value)
                              : undefined,
                          })
                        }
                      />
                    </label>
                    <div className="grid gap-1 text-xs sm:col-span-2">
                      <span id="origem">Origem</span>
                      <ToggleGroup
                        type="single"
                        aria-labelledby="origem"
                        value={query.origin ?? 'all'}
                        onValueChange={(value) =>
                          value &&
                          setQuery({ ...query, origin: value as MarketOrigin })
                        }
                        className="grid grid-cols-3"
                      >
                        <ToggleGroupItem value="all" className="min-h-10">
                          Todos
                        </ToggleGroupItem>
                        <ToggleGroupItem value="national" className="min-h-10">
                          Nacionais
                        </ToggleGroupItem>
                        <ToggleGroupItem value="foreign" className="min-h-10">
                          Estrangeiros
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={query.freeAgentsOnly ?? false}
                        onChange={(event) =>
                          setQuery({
                            ...query,
                            freeAgentsOnly: event.target.checked,
                          })
                        }
                      />
                      Só agentes livres
                    </label>
                    <Button type="submit" className="min-h-10">
                      <MagnifyingGlass data-icon="inline-start" />
                      Aplicar filtros
                    </Button>
                  </div>
                </details>
              </form>
              <p className="px-1 text-xs text-chalk">
                {market.search.total} atleta(s) encontrados.
              </p>
              <ul
                role="list"
                aria-label="Resultados"
                className="grid gap-2 sm:grid-cols-2"
              >
                {market.search.results.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      aria-pressed={target?.id === result.id}
                      onClick={() => {
                        setTarget(result);
                        play('click');
                        // The chosen athlete's card opens at the top (docs/09).
                        requestAnimationFrame(() =>
                          targetPanel.current?.scrollIntoView?.({
                            block: 'start',
                          }),
                        );
                      }}
                      className={cn(
                        'sticker grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 p-2 text-left',
                        target?.id === result.id &&
                          'outline outline-4 outline-bulb',
                      )}
                    >
                      <PixelAvatar seed={`atleta-${result.id}`} size={40} />
                      <span className="min-w-0">
                        <strong className="block truncate text-sm">
                          {result.name}
                        </strong>
                        <small className="block truncate text-muted-foreground">
                          {result.position} · {result.age} anos ·{' '}
                          {result.freeAgent ? 'Sem clube' : result.clubName}
                        </small>
                        <span className="mt-0.5 flex flex-wrap gap-1">
                          <Badge
                            variant={
                              result.origin === 'foreign' ? 'board' : 'outline'
                            }
                          >
                            {result.origin === 'foreign'
                              ? 'Estrangeiro'
                              : 'Nacional'}
                          </Badge>
                          {result.listed && (
                            <Badge variant="bulb">À venda</Badge>
                          )}
                          {result.freeAgent && (
                            <Badge variant="secondary">Livre</Badge>
                          )}
                        </span>
                      </span>
                      <span className="grid justify-items-end gap-0.5">
                        <span className="led bg-board px-1.5 py-1 text-base">
                          {result.strength}
                        </span>
                        <span className="font-pixel text-[.45rem]">
                          {formatBrl(result.value)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div
              ref={targetPanel}
              className="order-first scroll-mt-20 lg:order-none lg:sticky lg:top-20 lg:self-start"
            >
              {target ? (
                <OfferForm
                  key={target.id}
                  target={target}
                  market={market}
                  busy={busy}
                  blocked={
                    !target.freeAgent && !windowOpen
                      ? closedMessage
                      : squadFull
                        ? (marketRefusalMessage('SQUAD_LIMIT_REACHED') ?? '')
                        : ''
                  }
                  onSubmit={(input) =>
                    run(
                      'Proposta enviada. O clube respondeu na hora: veja em Propostas.',
                      () => api.submitMarketOffer(input),
                      true,
                    )
                  }
                  onClose={() => setTarget(null)}
                />
              ) : (
                <p className="panel p-3 text-sm text-muted-foreground">
                  Toque num atleta para propor compra ou empréstimo.
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="offers">
          <div className="grid gap-3 lg:grid-cols-2">
            <OfferList
              title="Recebidas"
              offers={byUrgency(market.offersReceived)}
              busy={busy}
              windowOpen={windowOpen}
              closedMessage={closedMessage}
              onDecide={(id, decision) =>
                run(
                  decision === 'accept'
                    ? 'Proposta aceita.'
                    : 'Proposta recusada.',
                  () => api.decideMarketOffer(id, decision),
                  true,
                )
              }
              onCounter={(id, terms) =>
                run(
                  'Contraproposta enviada. O clube já respondeu.',
                  () => api.counterMarketOffer(id, terms),
                  true,
                )
              }
            />
            <OfferList
              title="Enviadas"
              offers={byUrgency(market.offersSent)}
              busy={busy}
              windowOpen={windowOpen}
              closedMessage={closedMessage}
              onDecide={(id, decision) =>
                run(
                  decision === 'accept'
                    ? 'Contraproposta aceita: negócio fechado.'
                    : 'Contraproposta recusada.',
                  () => api.decideMarketOffer(id, decision),
                  true,
                )
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="mine">
          <OwnSquadPanel
            career={career}
            market={market}
            busy={busy}
            onList={(input) =>
              run('Atleta anunciado no mercado.', () =>
                api.listForTransfer(input),
              )
            }
            onWithdraw={(playerId) =>
              run('Anúncio retirado.', () => api.withdrawListing(playerId))
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OfferForm({
  target,
  market,
  busy,
  blocked,
  onSubmit,
  onClose,
}: {
  target: MarketResultView;
  market: MarketView;
  busy: boolean;
  blocked: string;
  onSubmit(input: {
    playerId: string;
    kind: 'buy' | 'loan';
    fee: number;
    wage: number;
    loan?: { endsOn: string; wageSharePercentage: number };
  }): Promise<boolean>;
  onClose(): void;
}) {
  const [kind, setKind] = useState<'buy' | 'loan'>('buy');
  const [fee, setFee] = useState(String(target.value));
  const [wage, setWage] = useState(String(target.wage));
  const [share, setShare] = useState('50');
  const year = market.currentDate.slice(0, 4);
  return (
    <form
      className="panel grid content-start gap-2 p-3 lg:sticky lg:top-4"
      aria-label={`Proposta por ${target.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          playerId: target.id,
          kind,
          fee: Number(fee),
          wage: Number(wage),
          ...(kind === 'loan'
            ? {
                loan: {
                  endsOn: `${year}-12-31`,
                  wageSharePercentage: Number(share),
                },
              }
            : {}),
        });
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-pixel text-[.6rem] uppercase">{target.name}</h3>
          <p className="text-xs text-muted-foreground">
            {target.position} · força {target.strength} · valor{' '}
            {formatBrl(target.value)} · salário {formatBrl(target.wage)}/mês
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Fechar proposta"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      {!target.freeAgent && (
        <ToggleGroup
          type="single"
          aria-label="Tipo de negócio"
          value={kind}
          onValueChange={(value) => value && setKind(value as 'buy' | 'loan')}
          className="grid grid-cols-2"
        >
          <ToggleGroupItem value="buy" className="min-h-10">
            Comprar
          </ToggleGroupItem>
          <ToggleGroupItem value="loan" className="min-h-10">
            Emprestar
          </ToggleGroupItem>
        </ToggleGroup>
      )}
      <label className="grid gap-1 text-xs">
        {kind === 'loan' ? 'Taxa de empréstimo (R$)' : 'Valor da proposta (R$)'}
        <Input
          type="number"
          min={0}
          step="any"
          value={fee}
          onChange={(event) => setFee(event.target.value)}
          required
        />
      </label>
      <label className="grid gap-1 text-xs">
        Salário mensal (R$)
        <Input
          type="number"
          min={0}
          step="any"
          value={wage}
          onChange={(event) => setWage(event.target.value)}
          required
        />
      </label>
      {kind === 'loan' && (
        <label className="grid gap-1 text-xs">
          Parte do salário que você paga (%)
          <Input
            type="number"
            min={0}
            max={100}
            value={share}
            onChange={(event) => setShare(event.target.value)}
          />
          <span className="text-muted-foreground">
            Até o fim da temporada ({year}).
          </span>
        </label>
      )}
      {blocked && (
        <p
          className="bg-destructive/10 p-2 text-xs text-destructive"
          role="note"
        >
          {blocked}
        </p>
      )}
      <Button
        type="submit"
        className="min-h-11"
        disabled={busy || Boolean(blocked)}
      >
        <PixelCoin size={12} />
        {kind === 'loan' ? 'Propor empréstimo' : 'Enviar proposta'}
      </Button>
    </form>
  );
}

const STATUS_LABEL: Record<MarketOfferView['status'], string> = {
  pending: 'Pendente',
  countered: 'Contraproposta feita',
  accepted: 'Aceita',
  rejected: 'Recusada',
  cancelled: 'Cancelada',
};

function OfferList({
  title,
  offers,
  busy,
  windowOpen,
  closedMessage,
  onDecide,
  onCounter,
}: {
  title: string;
  offers: readonly MarketOfferView[];
  busy: boolean;
  windowOpen: boolean;
  closedMessage: string;
  onDecide(id: string, decision: 'accept' | 'reject'): Promise<boolean>;
  onCounter?(
    id: string,
    terms: { fee: number; wage: number },
  ): Promise<boolean>;
}) {
  const [countering, setCountering] = useState<string | null>(null);
  const [fee, setFee] = useState('');
  return (
    <section aria-labelledby={`propostas-${title}`} className="panel p-3">
      <h3
        id={`propostas-${title}`}
        className="font-pixel text-[.6rem] uppercase"
      >
        {title}
      </h3>
      {offers.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">Nenhuma proposta.</p>
      )}
      <ul role="list" className="mt-2 flex flex-col gap-2">
        {offers.map((offer) => (
          <li
            key={offer.id}
            className={cn(
              'grid gap-1 border-2 border-ink p-2 text-xs',
              offer.awaiting === 'manager' ? 'bg-bulb/30' : 'bg-popover',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <strong className="text-sm">{offer.playerName}</strong>
                <p className="text-muted-foreground">
                  {offer.kind === 'loan' ? 'Empréstimo' : 'Compra'} ·{' '}
                  {offer.counterpartClubName ?? 'Sem clube'} · até{' '}
                  {formatDate(offer.expiresOn)}
                </p>
              </div>
              <Badge
                variant={
                  offer.status === 'accepted'
                    ? 'default'
                    : offer.status === 'pending'
                      ? 'bulb'
                      : offer.status === 'rejected' ||
                          offer.status === 'cancelled'
                        ? 'destructive'
                        : 'secondary'
                }
              >
                {STATUS_LABEL[offer.status]}
              </Badge>
            </div>
            <p>
              <span className="led bg-board px-1 text-sm">
                {formatBrl(offer.fee)}
              </span>{' '}
              + {formatBrl(offer.wage)}/mês
              {offer.counterOf && ' · contraproposta'}
            </p>
            <p className="font-pixel text-[.5rem] uppercase">
              {offer.awaiting === 'manager'
                ? 'Você decide'
                : offer.awaiting === 'counterpart'
                  ? 'Aguardando o outro clube'
                  : 'Encerrada'}
            </p>
            {offer.awaiting === 'manager' && (
              // Three pixel-font labels never fit side by side on a phone:
              // stacked there, one row from `sm` up.
              <div className="grid gap-1 sm:grid-cols-3">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void onDecide(offer.id, 'accept')}
                  aria-label={`Aceitar proposta por ${offer.playerName}`}
                  title={!windowOpen ? closedMessage : undefined}
                >
                  <Check data-icon="inline-start" />
                  Aceitar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void onDecide(offer.id, 'reject')}
                  aria-label={`Recusar proposta por ${offer.playerName}`}
                >
                  Recusar
                </Button>
                {onCounter && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    aria-expanded={countering === offer.id}
                    onClick={() => {
                      setCountering(countering === offer.id ? null : offer.id);
                      setFee(String(Math.round(offer.fee * 1.15)));
                    }}
                    aria-label={`Contrapropor por ${offer.playerName}`}
                  >
                    <ArrowsLeftRight data-icon="inline-start" />
                    Contrapropor
                  </Button>
                )}
              </div>
            )}
            {onCounter && countering === offer.id && (
              <form
                className="grid grid-cols-[1fr_auto] items-end gap-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  void onCounter(offer.id, {
                    fee: Number(fee),
                    wage: offer.wage,
                  }).then((ok) => ok && setCountering(null));
                }}
              >
                <label className="grid gap-1">
                  Novo valor (R$)
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={fee}
                    onChange={(event) => setFee(event.target.value)}
                  />
                </label>
                <Button type="submit" size="sm" disabled={busy}>
                  Enviar contraproposta
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function OwnSquadPanel({
  career,
  market,
  busy,
  onList,
  onWithdraw,
}: {
  career: CareerView;
  market: MarketView;
  busy: boolean;
  onList(input: ListingInput): Promise<boolean>;
  onWithdraw(playerId: string): Promise<boolean>;
}) {
  const [playerId, setPlayerId] = useState(career.players[0]?.id ?? '');
  const [mode, setMode] = useState<'sale' | 'loan'>('sale');
  const [price, setPrice] = useState('');
  const [months, setMonths] = useState('6');
  const [share, setShare] = useState('50');
  const player = career.players.find((item) => item.id === playerId);
  const listed = new Set(market.listings.map((item) => item.playerId));
  const suggested = player ? player.strength * 180_000 : 0;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <form
        className="panel grid content-start gap-2 p-3"
        aria-label="Anunciar atleta"
        onSubmit={(event) => {
          event.preventDefault();
          if (!player) return;
          void onList(
            mode === 'sale'
              ? { playerId, mode, askingPrice: Number(price || suggested) }
              : {
                  playerId,
                  mode,
                  durationMonths: Number(months),
                  wageSharePercentage: Number(share),
                },
          );
        }}
      >
        <h3 className="font-pixel text-[.6rem] uppercase">Anunciar atleta</h3>
        <label className="grid gap-1 text-xs">
          Atleta
          <select
            className="min-h-10 border-2 border-ink bg-popover px-2 text-sm"
            value={playerId}
            onChange={(event) => {
              setPlayerId(event.target.value);
              setPrice('');
            }}
          >
            {career.players.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.primaryPosition} · {item.strength}
                {listed.has(item.id) ? ' (anunciado)' : ''}
              </option>
            ))}
          </select>
        </label>
        <ToggleGroup
          type="single"
          aria-label="Modo do anúncio"
          value={mode}
          onValueChange={(value) => value && setMode(value as 'sale' | 'loan')}
          className="grid grid-cols-2"
        >
          <ToggleGroupItem value="sale" className="min-h-10">
            Vender
          </ToggleGroupItem>
          <ToggleGroupItem value="loan" className="min-h-10">
            Emprestar
          </ToggleGroupItem>
        </ToggleGroup>
        {mode === 'sale' ? (
          <label className="grid gap-1 text-xs">
            Preço pedido (R$)
            <Input
              type="number"
              min={0}
              step="any"
              value={price}
              placeholder={String(suggested)}
              onChange={(event) => setPrice(event.target.value)}
            />
            <span className="text-muted-foreground">
              Sugestão: {formatBrl(suggested)}
            </span>
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs">
              Meses
              <Input
                type="number"
                min={1}
                max={12}
                value={months}
                onChange={(event) => setMonths(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs">
              Salário pago pelo tomador (%)
              <Input
                type="number"
                min={0}
                max={100}
                value={share}
                onChange={(event) => setShare(event.target.value)}
              />
            </label>
          </div>
        )}
        <Button type="submit" className="min-h-11" disabled={busy || !player}>
          <Tag data-icon="inline-start" />
          {mode === 'sale' ? 'Colocar à venda' : 'Oferecer por empréstimo'}
        </Button>
      </form>
      <div className="flex flex-col gap-3">
        <section aria-labelledby="anuncios" className="panel p-3">
          <h3 id="anuncios" className="font-pixel text-[.6rem] uppercase">
            Anunciados
          </h3>
          {market.listings.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Ninguém anunciado. Atletas na lista recebem mais propostas.
            </p>
          )}
          <ul role="list" className="mt-2 flex flex-col gap-1 text-xs">
            {market.listings.map((listing) => (
              <li
                key={listing.playerId}
                className="flex items-center justify-between gap-2 bg-muted p-2"
              >
                <span>
                  <strong>{listing.playerName}</strong> · {listing.position} ·{' '}
                  {listing.mode === 'sale'
                    ? `à venda por ${formatBrl(listing.askingPrice)}`
                    : `empréstimo ${String(listing.durationMonths)} meses, ${String(listing.wageSharePercentage)}% do salário`}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void onWithdraw(listing.playerId)}
                  aria-label={`Retirar anúncio de ${listing.playerName}`}
                >
                  Retirar
                </Button>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="emprestimos" className="panel p-3">
          <h3 id="emprestimos" className="font-pixel text-[.6rem] uppercase">
            Empréstimos ativos
          </h3>
          {market.loans.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Nenhum empréstimo.
            </p>
          )}
          <ul role="list" className="mt-2 flex flex-col gap-1 text-xs">
            {market.loans.map((loan) => (
              <li
                key={`${loan.playerId}-${loan.startsOn}`}
                className="bg-muted p-2"
              >
                <strong>{loan.playerName}</strong>{' '}
                {loan.direction === 'out' ? 'emprestado ao' : 'emprestado pelo'}{' '}
                {loan.counterpartClubName} · volta em {formatDate(loan.endsOn)}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
