'use client';

import { Children, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bank,
  Binoculars,
  Buildings,
  ChartLineUp,
  CheckCircle,
  CurrencyCircleDollar,
  ShieldCheck,
  Trophy,
} from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RankingScreen } from '@/components/ranking-screen';
import type { CareerApiPort, CareerView } from '@/lib/career-api';
import { formatGameDate } from '@/lib/inbox-product';
import type {
  ExpansionPlanId,
  MaintenancePlanId,
  MarketPlayerView,
  Phase4View,
  TransferKind,
} from '@/lib/phase4-model';
import { productPortsFor, type ProductPorts } from '@/lib/runtime-api';
import { type SeasonPort, worldHistoryFromSeason } from '@/lib/season-product';

interface Phase4ScreenProps {
  career: CareerView;
  api: CareerApiPort;
  onCareerChange(value: CareerView): void;
  reportError(value: string): void;
  /** Tab opened first when the shell routes straight to a sub-area. */
  initialTab?: string;
}

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);

function useCommand(props: Phase4ScreenProps) {
  const [notice, setNotice] = useState('');
  const run = async (command: () => Promise<CareerView>, success: string) => {
    try {
      props.reportError('');
      props.onCareerChange(await command());
      setNotice(success);
    } catch (caught) {
      setNotice('');
      props.reportError(
        caught instanceof Error ? caught.message : 'Não foi possível concluir.',
      );
    }
  };
  return { run, notice };
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-4">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">
        {eyebrow}
      </p>
      <h2 className="font-display text-xs font-bold uppercase sm:text-sm">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        {description}
      </p>
    </header>
  );
}

function LiveNotice({ children }: { children: string }) {
  return (
    <p aria-live="polite" className="min-h-5 text-sm font-medium text-primary">
      {children}
    </p>
  );
}

export function MarketScreen(props: Phase4ScreenProps) {
  const { run, notice } = useCommand(props);
  const [query, setQuery] = useState('');
  const [marketTab, setMarketTab] = useState('search');
  const [position, setPosition] = useState('all');
  const [availability, setAvailability] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [offerPlayer, setOfferPlayer] = useState(
    props.career.world.market[0]?.id ?? '',
  );
  const [offerAmount, setOfferAmount] = useState('8000000');
  const [offerKind, setOfferKind] = useState<TransferKind>('buy');
  const market = props.career.world.market;
  const filtered = useMemo(
    () =>
      market.filter(
        (player) =>
          player.name
            .toLocaleLowerCase('pt-BR')
            .includes(query.toLocaleLowerCase('pt-BR')) &&
          (position === 'all' || player.position === position) &&
          (availability === 'all' || player.availability === availability),
      ),
    [market, query, position, availability],
  );
  const compared = selected
    .map((id) => market.find((player) => player.id === id))
    .filter(Boolean) as MarketPlayerView[];
  const chosen = market.find((player) => player.id === offerPlayer);

  const toggleCompare = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < 2
          ? [...current, id]
          : [current[1]!, id],
    );
  };

  return (
    <div>
      <SectionHeading
        eyebrow="Janela aberta"
        title="Mercado"
        description="Busque, observe e negocie sem sair do fluxo da rodada. Valores e limites vêm do clube."
      />
      <LiveNotice>{notice}</LiveNotice>
      <Tabs value={marketTab} onValueChange={setMarketTab}>
        <TabsList className="grid w-full grid-cols-3 sm:w-fit">
          <TabsTrigger value="search">Buscar</TabsTrigger>
          <TabsTrigger value="offer">Oferta</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
        </TabsList>
        <TabsContent value="search" className="mt-4 flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-sm uppercase">
                Radar de atletas
              </CardTitle>
              <CardDescription>
                Agentes livres, compra e empréstimo no mesmo catálogo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="market-search">Nome</FieldLabel>
                  <Input
                    id="market-search"
                    type="search"
                    placeholder="Ex.: Scarpa"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="market-position">Posição</FieldLabel>
                  <select
                    id="market-position"
                    className="min-h-10 rounded-md border bg-background px-3 text-sm"
                    value={position}
                    onChange={(event) => setPosition(event.target.value)}
                  >
                    <option value="all">Todas</option>
                    <option value="GOL">GOL</option>
                    <option value="ZAG">ZAG</option>
                    <option value="LE">LE</option>
                    <option value="LD">LD</option>
                    <option value="MEI">MEI</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="market-kind">Disponibilidade</FieldLabel>
                  <select
                    id="market-kind"
                    className="min-h-10 rounded-md border bg-background px-3 text-sm"
                    value={availability}
                    onChange={(event) => setAvailability(event.target.value)}
                  >
                    <option value="all">Todas</option>
                    <option value="transfer">Compra</option>
                    <option value="loan">Empréstimo</option>
                    <option value="free-agent">Livre</option>
                  </select>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((player) => (
              <Card key={player.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="font-display text-sm uppercase">
                        {player.name}
                      </CardTitle>
                      <CardDescription>
                        {player.club} · {player.position} · {player.age} anos
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        player.availability === 'free-agent'
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {player.availability === 'free-agent'
                        ? 'Livre'
                        : player.availability === 'loan'
                          ? 'Empréstimo'
                          : 'À venda'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2 text-center">
                  <Metric label="Força" value={String(player.strength)} />
                  <Metric
                    label="Valor"
                    value={player.value ? money(player.value) : 'Sem taxa'}
                  />
                  <Metric label="Salário" value={money(player.salary)} />
                  {player.scouted && (
                    <p className="col-span-3 rounded-md bg-muted p-2 text-left text-xs">
                      Relatório: {player.potentialEstimate} ·{' '}
                      {player.adaptationEstimate}. Dimensões ocultas permanecem
                      estimativas.
                    </p>
                  )}
                </CardContent>
                <CardFooter className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      void run(
                        () => props.api.scoutMarketPlayer(player.id),
                        `Relatório de ${player.name} atualizado.`,
                      )
                    }
                  >
                    <Binoculars data-icon="inline-start" />
                    {player.scouted ? 'Rever relatório' : 'Observar'}
                  </Button>
                  <Button
                    variant={
                      selected.includes(player.id) ? 'secondary' : 'outline'
                    }
                    aria-pressed={selected.includes(player.id)}
                    onClick={() => toggleCompare(player.id)}
                  >
                    Comparar
                  </Button>
                  <Button
                    className="col-span-2"
                    onClick={() => {
                      setOfferPlayer(player.id);
                      setOfferAmount(String(player.value || player.salary * 4));
                      setMarketTab('offer');
                    }}
                  >
                    Negociar <ArrowRight data-icon="inline-end" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          {compared.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-sm uppercase">
                  Comparação ({compared.length}/2)
                </CardTitle>
                <CardDescription>
                  Atributos visíveis e estimativas do relatório.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Atleta</TableHead>
                      <TableHead>Força</TableHead>
                      <TableHead>Idade</TableHead>
                      <TableHead>Potencial</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compared.map((player) => (
                      <TableRow key={player.id}>
                        <TableCell>{player.name}</TableCell>
                        <TableCell>{player.strength}</TableCell>
                        <TableCell>{player.age}</TableCell>
                        <TableCell>
                          {player.scouted
                            ? player.potentialEstimate
                            : 'Observar primeiro'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="offer" className="mt-4">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="font-display text-base uppercase">
                Mesa de negociação
              </CardTitle>
              <CardDescription>
                Uma contraproposta não movimenta dinheiro. A transação aceita
                gera um lançamento identificado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="offer-player">Atleta</FieldLabel>
                  <select
                    id="offer-player"
                    className="min-h-10 rounded-md border bg-background px-3 text-sm"
                    value={offerPlayer}
                    onChange={(event) => setOfferPlayer(event.target.value)}
                  >
                    {market.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name} · {player.club}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="offer-type">Operação</FieldLabel>
                  <select
                    id="offer-type"
                    className="min-h-10 rounded-md border bg-background px-3 text-sm"
                    value={offerKind}
                    onChange={(event) =>
                      setOfferKind(event.target.value as TransferKind)
                    }
                  >
                    <option value="buy">Compra</option>
                    <option value="loan">Empréstimo</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="offer-amount">Valor total</FieldLabel>
                  <Input
                    id="offer-amount"
                    inputMode="numeric"
                    value={offerAmount}
                    onChange={(event) => setOfferAmount(event.target.value)}
                    aria-describedby="offer-limit"
                  />
                  <p id="offer-limit" className="text-xs text-muted-foreground">
                    Limite livre após reserva:{' '}
                    {money(
                      props.career.world.finances.cash -
                        props.career.world.finances.transferGate,
                    )}
                  </p>
                </Field>
              </FieldGroup>
              {chosen?.offerStatus === 'countered' && (
                <div className="mt-4 rounded-md border bg-muted p-3">
                  <p className="font-medium">
                    Contraproposta: {money(chosen.counterAmount ?? 0)}
                  </p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() =>
                      void run(
                        () => props.api.acceptTransferCounter(chosen.id),
                        `${chosen.name} contratado; caixa e ledger atualizados.`,
                      )
                    }
                  >
                    Aceitar contraproposta
                  </Button>
                </div>
              )}
              {chosen?.offerStatus === 'accepted' && (
                <p className="mt-4 flex items-center gap-2 text-sm text-primary">
                  <CheckCircle weight="fill" /> Negócio concluído e auditado no
                  ledger.
                </p>
              )}
            </CardContent>
            <CardFooter>
              <Button
                onClick={() =>
                  void run(
                    () =>
                      props.api.submitTransferOffer({
                        playerId: offerPlayer,
                        amount: Number(offerAmount),
                        kind: offerKind,
                      }),
                    'Oferta enviada. Veja a resposta do clube.',
                  )
                }
              >
                Enviar oferta
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="contracts" className="mt-4">
          <ContractsPanel {...props} run={run} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Contract renewals, refusals and terminations (reused by the Escritório). */
export function ContractsScreen(props: Phase4ScreenProps) {
  const { run, notice } = useCommand(props);
  return (
    <>
      {notice && <LiveNotice>{notice}</LiveNotice>}
      <ContractsPanel {...props} run={run} />
    </>
  );
}

function ContractsPanel(
  props: Phase4ScreenProps & {
    run(command: () => Promise<CareerView>, success: string): Promise<void>;
  },
) {
  return (
    <div className="flex flex-col gap-3">
      {props.career.world.contractAlerts.length > 0 && (
        <div
          role="status"
          className="rounded-md border border-accent/50 bg-accent/10 p-3 text-sm"
        >
          <strong>Alertas de vínculo</strong>
          <ul className="mt-2 list-inside list-disc">
            {props.career.world.contractAlerts.map((alert) => (
              <li key={alert}>{alert}</li>
            ))}
          </ul>
        </div>
      )}
      {props.career.world.contracts.map((contract) => (
        <Card key={contract.playerId}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="font-display text-sm uppercase">
                  {contract.playerName}
                </CardTitle>
                <CardDescription>
                  {contract.monthsRemaining} meses · {money(contract.salary)}
                  /mês
                </CardDescription>
              </div>
              <Badge
                variant={
                  contract.status === 'expiring' ? 'destructive' : 'secondary'
                }
              >
                {contract.status === 'expiring'
                  ? 'Vencendo'
                  : contract.status === 'renewed'
                    ? 'Renovado'
                    : contract.status === 'refused'
                      ? 'Saída acertada'
                      : 'Ativo'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Pedido para renovar:{' '}
              <strong>{money(contract.renewalDemand)}/mês</strong>. A folha
              passa pelo teto da diretoria.
            </p>
          </CardContent>
          <CardFooter className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button
              onClick={() =>
                void props.run(
                  () => props.api.renewContract(contract.playerId, 12),
                  `${contract.playerName} renovou por 12 meses.`,
                )
              }
            >
              Renovar
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void props.run(
                  () => props.api.refuseContract(contract.playerId),
                  `Renovação de ${contract.playerName} recusada.`,
                )
              }
            >
              Recusar
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void props.run(
                  () =>
                    props.api.setSquadMarketStatus(contract.playerId, 'listed'),
                  `${contract.playerName} colocado à venda.`,
                )
              }
            >
              Vender
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void props.run(
                  () =>
                    props.api.setSquadMarketStatus(
                      contract.playerId,
                      'loan-listed',
                    ),
                  `${contract.playerName} disponibilizado para empréstimo.`,
                )
              }
            >
              Emprestar
            </Button>
            <Button
              variant="destructive"
              className="col-span-2 sm:col-span-4"
              onClick={() =>
                void props.run(
                  () => props.api.terminateContract(contract.playerId),
                  `Contrato de ${contract.playerName} rescindido.`,
                )
              }
            >
              Rescindir contrato
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export function ClubScreen(props: Phase4ScreenProps) {
  const { run, notice } = useCommand(props);
  return (
    <div>
      <SectionHeading
        eyebrow="Gestão do clube"
        title="Clube"
        description="Caixa, patrimônio, base e confiança se encontram aqui — cada ação deixa uma origem rastreável."
      />
      <LiveNotice>{notice}</LiveNotice>
      <Tabs defaultValue={props.initialTab ?? 'finance'}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="finance">Finanças</TabsTrigger>
          <TabsTrigger value="stadium">Estádio</TabsTrigger>
          <TabsTrigger value="youth">Base</TabsTrigger>
          <TabsTrigger value="board">Diretoria</TabsTrigger>
        </TabsList>
        <TabsContent value="finance" className="mt-4 flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Summary
              icon={CurrencyCircleDollar}
              label="Caixa"
              value={money(props.career.world.finances.cash)}
              note={`Reserva mínima: ${money(props.career.world.finances.transferGate)}`}
            />
            <Summary
              icon={Bank}
              label="Folha por rodada"
              value={money(props.career.world.finances.wageBill)}
              note={`Teto: ${money(props.career.world.finances.wageBudget)}`}
            />
            <Summary
              icon={ChartLineUp}
              label="Patrocínio"
              value={props.career.world.finances.sponsor}
              note="Receita contratual identificada"
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-sm uppercase">
                Ledger imutável
              </CardTitle>
              <CardDescription>
                Histórico somente leitura. Cada valor nasce de uma fonte
                nomeada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.career.world.finances.ledger.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.date}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="mr-2">
                          {entry.category}
                        </Badge>
                        {entry.sourceLabel}
                      </TableCell>
                      <TableCell className="text-right">
                        {money(entry.amount)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {money(entry.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="stadium" className="mt-4">
          <StadiumTab {...props} run={run} />
        </TabsContent>
        <TabsContent value="youth" className="mt-4">
          <YouthTab {...props} run={run} />
        </TabsContent>
        <TabsContent
          value="board"
          className="mt-4 grid gap-4 lg:grid-cols-[1fr_.8fr]"
        >
          <BoardTab {...props} run={run} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Run = ReturnType<typeof useCommand>['run'];
type TabProps = Phase4ScreenProps & { run: Run };

const fullDate = (date: string) =>
  `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
const seats = (value: number) => value.toLocaleString('pt-BR');
const percent = (part: number, whole: number) =>
  whole <= 0 ? 0 : Math.min(100, Math.round((part / whole) * 100));

const EXPANSION_LABEL: Readonly<Record<ExpansionPlanId, string>> = {
  small: 'Arquibancada extra',
  medium: 'Novo setor',
  large: 'Grande reforma',
};
const MAINTENANCE_LABEL: Readonly<Record<MaintenancePlanId, string>> = {
  repairs: 'Reparos',
  renovation: 'Gramado e vestiários',
  modernization: 'Modernização',
};

function qualityLabel(quality: number): string {
  return quality >= 80
    ? 'Excelente'
    : quality >= 60
      ? 'Boa'
      : quality >= 40
        ? 'Regular'
        : 'Precária';
}

/** What the crowd numbers suggest about the ticket price. */
function crowdAdvice(stadium: Phase4View['stadium']): string {
  if (stadium.demand > stadium.capacity)
    return `A procura (${seats(stadium.demand)}) passa da capacidade: o estádio lota. Dá para subir o ingresso ou ampliar.`;
  if (percent(stadium.expectedCrowd, stadium.capacity) < 50)
    return 'Sobra lugar: um ingresso mais barato atrai mais torcedores (e a torcida esfria com estádio vazio).';
  return 'Público equilibrado com o preço atual.';
}

function StadiumTab(props: TabProps) {
  const stadium = props.career.world.stadium;
  const cash = props.career.world.finances.cash;
  const [ticket, setTicket] = useState(String(stadium.ticketPrice));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base uppercase">
            {stadium.name}
          </CardTitle>
          <CardDescription>
            Capacidade {seats(stadium.capacity)} lugares
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Público médio</dt>
              <dd className="font-medium">
                {stadium.homeMatches > 0
                  ? `${seats(stadium.averageCrowd)} · ${String(stadium.homeMatches)} jogo(s) em casa`
                  : 'Sem jogos em casa ainda'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Último público</dt>
              <dd className="font-medium">
                {stadium.lastCrowd === undefined
                  ? '—'
                  : seats(stadium.lastCrowd)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                Próximo jogo (estimativa)
              </dt>
              <dd className="font-medium">{seats(stadium.expectedCrowd)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Procura por ingressos</dt>
              <dd className="font-medium">{seats(stadium.demand)}</dd>
            </div>
          </dl>
          <div>
            <div className="flex justify-between text-sm">
              <span>Ocupação estimada</span>
              <strong>
                {percent(stadium.expectedCrowd, stadium.capacity)}%
              </strong>
            </div>
            <Progress
              className="mt-2"
              value={percent(stadium.expectedCrowd, stadium.capacity)}
              aria-label={`Ocupação estimada: ${String(percent(stadium.expectedCrowd, stadium.capacity))}%`}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {crowdAdvice(stadium)}
            </p>
          </div>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ticket-price">Preço do ingresso</FieldLabel>
              <Input
                id="ticket-price"
                inputMode="numeric"
                value={ticket}
                onChange={(event) => setTicket(event.target.value)}
                aria-describedby="ticket-hint"
              />
              <p id="ticket-hint" className="text-xs text-muted-foreground">
                Entre R$ 10 e R$ 250. A torcida compara com{' '}
                {money(stadium.referencePrice)}: acima disso o público cai.
                Clube maior tem mais torcida e aguenta ingresso mais caro.
              </p>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button
            onClick={() =>
              void props.run(
                () => props.api.setTicketPrice(Number(ticket)),
                'Preço do ingresso atualizado para a próxima partida.',
              )
            }
          >
            Salvar preço
          </Button>
        </CardFooter>
      </Card>
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <div className="flex justify-between gap-3">
              <div>
                <CardTitle className="font-display text-base uppercase">
                  Estrutura
                </CardTitle>
                <CardDescription>
                  {qualityLabel(stadium.quality)} · {stadium.quality}/100
                  {stadium.lastMaintenanceOn &&
                    ` · última manutenção em ${fullDate(stadium.lastMaintenanceOn)}`}
                </CardDescription>
              </div>
              <Buildings aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Progress
              value={stadium.quality}
              aria-label={`Estrutura do estádio: ${String(stadium.quality)} de 100`}
            />
            <p className="text-xs text-muted-foreground">
              Cada jogo em casa desgasta gramado e arquibancadas. Estrutura ruim
              afasta torcedores; a manutenção sai do caixa do clube.
            </p>
            {stadium.maintenancePlans.length === 0 ? (
              <p className="text-sm">Estádio em condição máxima.</p>
            ) : (
              <ul role="list" className="flex flex-col gap-2">
                {stadium.maintenancePlans.map((plan) => (
                  <li
                    key={plan.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
                  >
                    <span>
                      <strong>{MAINTENANCE_LABEL[plan.id]}</strong> · +
                      {plan.qualityGain} de estrutura
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cash < plan.cost}
                      aria-label={`${MAINTENANCE_LABEL[plan.id]} por ${money(plan.cost)}`}
                      onClick={() =>
                        void props.run(
                          () => props.api.maintainStadium(plan.id),
                          `${MAINTENANCE_LABEL[plan.id]} concluída: estrutura +${String(plan.qualityGain)}.`,
                        )
                      }
                    >
                      Pagar {money(plan.cost)}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base uppercase">
              Ampliação
            </CardTitle>
            <CardDescription>
              Até {seats(stadium.maxCapacity)} lugares. A obra é paga na
              contratação e os lugares abrem na data de conclusão.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {stadium.works ? (
              <p role="status" className="rounded-md bg-muted p-3 text-sm">
                <strong>Obra em andamento:</strong> +
                {seats(stadium.works.addedCapacity)} lugares, conclusão em{' '}
                {fullDate(stadium.works.completesOn)} (
                {money(stadium.works.cost)} pagos).
              </p>
            ) : stadium.expansionPlans.length === 0 ? (
              <p className="text-sm">O estádio já está no tamanho máximo.</p>
            ) : (
              <ul role="list" className="flex flex-col gap-2">
                {stadium.expansionPlans.map((plan) => (
                  <li
                    key={plan.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
                  >
                    <span>
                      <strong>{EXPANSION_LABEL[plan.id]}</strong> · +
                      {seats(plan.addedCapacity)} lugares · {plan.days} dias
                      (pronta em {fullDate(plan.completesOn)})
                    </span>
                    <Button
                      size="sm"
                      disabled={cash < plan.cost}
                      aria-label={`${EXPANSION_LABEL[plan.id]} por ${money(plan.cost)}`}
                      onClick={() =>
                        void props.run(
                          () => props.api.expandStadium(plan.id),
                          `Obra contratada: +${seats(plan.addedCapacity)} lugares, conclusão em ${fullDate(plan.completesOn)}.`,
                        )
                      }
                    >
                      Contratar {money(plan.cost)}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {!stadium.works && stadium.demand <= stadium.capacity && (
              <p className="text-xs text-muted-foreground">
                Hoje a procura cabe no estádio: ampliar só rende quando ele
                lota.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const READINESS_LABEL: Readonly<
  Record<Phase4View['youth'][number]['readiness'], string>
> = {
  ready: 'Pronto para o profissional',
  close: 'Quase pronto',
  developing: 'Em formação',
};

type YouthSort = 'highlight' | 'strength' | 'potential' | 'age';
const POTENTIAL_ORDER: Readonly<Record<string, number>> = {
  joia: 3,
  alto: 2,
  limitado: 1,
};

function YouthTab(props: TabProps) {
  const { youth, academy } = props.career.world;
  const [position, setPosition] = useState('all');
  const [sort, setSort] = useState<YouthSort>('highlight');
  const prospects = youth.filter(({ status }) => status === 'academy');
  const graduates = youth.filter(({ status }) => status === 'promoted');
  const positions = [...new Set(prospects.map((item) => item.position))];
  const needs = new Set(academy?.needs ?? []);
  const shown = prospects
    .filter((item) => position === 'all' || item.position === position)
    .sort((left, right) =>
      sort === 'strength'
        ? right.strength - left.strength
        : sort === 'potential'
          ? (POTENTIAL_ORDER[right.potentialEstimate] ?? 0) -
            (POTENTIAL_ORDER[left.potentialEstimate] ?? 0)
          : sort === 'age'
            ? right.age - left.age
            : Number(right.highlight) - Number(left.highlight) ||
              right.strength - left.strength,
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary
          icon={Trophy}
          label="Base"
          value={`${String(prospects.length)}/${String(academy?.capacity ?? 14)} jovens`}
          note={
            academy
              ? `Próxima peneira em ${fullDate(academy.nextIntakeOn)}`
              : 'Peneiras em fevereiro e agosto'
          }
        />
        <Summary
          icon={ShieldCheck}
          label="Elenco"
          value={
            academy
              ? `${String(academy.squadSize)}/${String(academy.maxSquadSize)}`
              : '—'
          }
          note={`Sobe ao profissional a partir dos ${String(academy?.minPromotionAge ?? 17)} anos`}
        />
        <Summary
          icon={Binoculars}
          label="Carência"
          value={needs.size > 0 ? [...needs].join(', ') : 'Elenco completo'}
          note="Posições em que o elenco tem menos jogadores"
        />
      </div>
      <p className="rounded-md border bg-muted p-3 text-sm">
        Os garotos treinam todo mês e ganham força até o potencial (estimado,
        nunca exato). Quem passa dos {academy?.maxAge ?? 20} anos sem subir
        deixa o clube na virada da temporada. Todos são{' '}
        <Badge variant="outline">gerados pelo universo</Badge>.
      </p>
      {prospects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          A base está vazia. A próxima peneira traz novos garotos.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm">
              Posição
              <select
                className="rounded-md border bg-background px-2 py-1"
                value={position}
                onChange={(event) => setPosition(event.target.value)}
              >
                <option value="all">Todas</option>
                {positions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              Ordenar por
              <select
                className="rounded-md border bg-background px-2 py-1"
                value={sort}
                onChange={(event) => setSort(event.target.value as YouthSort)}
              >
                <option value="highlight">Destaques</option>
                <option value="strength">Força</option>
                <option value="potential">Potencial</option>
                <option value="age">Idade</option>
              </select>
            </label>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {shown.map((kid) => (
              <Card
                key={kid.id}
                className={kid.highlight ? 'border-bulb' : undefined}
              >
                <CardHeader>
                  <div className="flex justify-between gap-2">
                    <div>
                      <CardTitle className="font-display text-sm uppercase">
                        {kid.name}
                      </CardTitle>
                      <CardDescription>
                        {kid.position} · {kid.age} anos
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {kid.highlight && <Badge variant="bulb">Destaque</Badge>}
                      {needs.has(kid.position) && (
                        <Badge variant="outline">Carência</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Força:</span>{' '}
                    <strong>{kid.strength}</strong>
                    {kid.initialStrength !== undefined &&
                      kid.strength > kid.initialStrength &&
                      ` (+${String(kid.strength - kid.initialStrength)} desde a chegada)`}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Potencial:</span>{' '}
                    {kid.potentialEstimate}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {kid.traits.map((trait) => (
                      <Badge key={trait} variant="secondary">
                        {trait}
                      </Badge>
                    ))}
                  </div>
                  <p>
                    <span className="text-muted-foreground">Prontidão:</span>{' '}
                    {READINESS_LABEL[kid.readiness]}
                  </p>
                </CardContent>
                <CardFooter className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    disabled={!kid.promotable}
                    title={
                      kid.promotable
                        ? undefined
                        : kid.age < (academy?.minPromotionAge ?? 17)
                          ? `Sobe a partir dos ${String(academy?.minPromotionAge ?? 17)} anos`
                          : 'Elenco cheio'
                    }
                    onClick={() =>
                      void props.run(
                        () => props.api.promoteYouth(kid.id),
                        `${kid.name} subiu ao profissional com contrato.`,
                      )
                    }
                  >
                    Promover
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      void props.run(
                        () => props.api.releaseYouth(kid.id),
                        `${kid.name} dispensado.`,
                      )
                    }
                  >
                    Dispensar
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </>
      )}
      {graduates.length > 0 && (
        <section aria-labelledby="formados" className="panel p-3">
          <h3 id="formados" className="font-pixel text-[.6rem] uppercase">
            Formados na base
          </h3>
          <ul role="list" className="mt-2 flex flex-wrap gap-2 text-xs">
            {graduates.map((kid) => (
              <li key={kid.id} className="bg-muted p-2">
                {kid.name} · {kid.position} · força {kid.strength}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const COMPARISON_LABEL: Readonly<
  Record<
    NonNullable<Phase4View['board']['proposals'][number]['comparison']>,
    string
  >
> = {
  bigger: 'Clube maior',
  similar: 'Mesmo porte',
  smaller: 'Clube menor',
};

function BoardTab(props: TabProps) {
  const board = props.career.world.board;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base uppercase">
            Termômetro do trabalho
          </CardTitle>
          <CardDescription>{board.status}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Confidence label="Diretoria" value={board.confidence} />
          <Confidence label="Torcida" value={board.fanConfidence} />
          <div className="rounded-md bg-muted p-3 text-sm">
            <strong>Objetivo</strong>
            <p className="mt-1">{board.objective}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Risco de demissão: {board.firingRisk}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base uppercase">
            Propostas de trabalho
          </CardTitle>
          <CardDescription>
            Os clubes ligam durante a temporada conforme o seu trabalho: bom
            desempenho atrai clubes maiores; fase ruim, só menores. Trocar de
            clube preserva treinador, prestígio e história da carreira.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {board.proposals.length ? (
            board.proposals.map((proposal) => (
              <div key={proposal.id} className="rounded-md border p-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{proposal.club}</strong>
                  <span className="flex gap-1">
                    {proposal.division && (
                      <Badge variant="outline">{proposal.division}</Badge>
                    )}
                    {proposal.comparison && (
                      <Badge
                        variant={
                          proposal.comparison === 'bigger'
                            ? 'bulb'
                            : 'secondary'
                        }
                      >
                        {COMPARISON_LABEL[proposal.comparison]}
                      </Badge>
                    )}
                  </span>
                </div>
                <p className="mt-2 text-sm">{proposal.objective}</p>
                {proposal.expiresOn && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Responda até {fullDate(proposal.expiresOn)}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    onClick={() =>
                      void props.run(
                        () => props.api.acceptJobProposal(proposal.id),
                        `Novo trabalho no ${proposal.club}; carreira preservada.`,
                      )
                    }
                  >
                    Aceitar e trocar de clube
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      void props.run(
                        () => props.api.rejectJobProposal(proposal.id),
                        `Proposta do ${proposal.club} recusada.`,
                      )
                    }
                  >
                    Recusar
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma proposta pendente.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/** Ports the Mundo screen reads besides the career (shared with the Central). */
export type WorldScreenPorts = Pick<ProductPorts, 'season' | 'ranking'>;

/**
 * Mundo (Caixa de entrada → "Ver todas", Histórico): every tab reads the
 * same persisted data the rest of the game uses. Notícias lists the inbox
 * the Central shows (plus career milestones), Histórico the season read
 * model, Ranking the server snapshots and Save the stored careers.
 */
export function WorldScreen(
  props: Phase4ScreenProps & { ports?: WorldScreenPorts },
) {
  const world = props.career.world;
  const ports = props.ports ?? productPortsFor(props.api);
  return (
    <div>
      <SectionHeading
        eyebrow="Memória da carreira"
        title="Mundo"
        description="Notícias, conquistas, recordes e rankings mostram o universo avançando sem esconder o estado técnico do save."
      />
      <Tabs defaultValue={props.initialTab ?? 'news'}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="news">Notícias</TabsTrigger>
          <TabsTrigger value="history">História</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="save">Save</TabsTrigger>
        </TabsList>
        <TabsContent value="news" className="mt-4">
          <NewsList news={world.news} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTab base={world.history} port={ports.season} />
        </TabsContent>
        <TabsContent value="ranking" className="mt-4 flex flex-col gap-4">
          <Card className="scoreboard">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge>Prestígio</Badge>
                  <CardTitle className="font-display text-base uppercase">
                    {world.prestige.points.toLocaleString('pt-BR')}
                  </CardTitle>
                  <CardDescription>{world.prestige.level}</CardDescription>
                </div>
                <Trophy className="size-10 text-accent" weight="fill" />
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Títulos" value={String(world.prestige.titles)} />
              <Metric
                label="Acessos"
                value={String(world.prestige.promotions)}
              />
              <Metric
                label="Temporadas"
                value={String(world.prestige.seasons)}
              />
            </CardContent>
          </Card>
          {/* Same snapshots as the Ranking screen (GET /v1/rankings). */}
          <RankingScreen port={ports.ranking} />
        </TabsContent>
        <TabsContent value="save" className="mt-4">
          <SaveTab career={props.career} api={props.api} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NewsList({ news }: { news: CareerView['world']['news'] }) {
  if (news.length === 0)
    return (
      <p className="panel p-4 text-sm text-muted-foreground">
        Nenhuma mensagem ainda. Relatórios de jogo, recados da diretoria e
        propostas chegam aqui assim que a rodada andar.
      </p>
    );
  return (
    <ul aria-label="Todas as mensagens" className="grid gap-3 lg:grid-cols-3">
      {news.map((item) => (
        <li key={item.id}>
          <Card className="h-full">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="w-fit">
                  {item.tag}
                </Badge>
                {item.date && (
                  <span className="font-pixel text-[.45rem] text-muted-foreground">
                    {formatGameDate(item.date)}
                  </span>
                )}
                {item.pending && (
                  <Badge className="w-fit">Decisão pendente</Badge>
                )}
              </div>
              <CardTitle className="font-display text-sm uppercase">
                {item.headline}
              </CardTitle>
              <CardDescription>{item.detail}</CardDescription>
              {item.pending && (
                <p className="text-xs text-muted-foreground">
                  Responda pela caixa de entrada da Central.
                </p>
              )}
            </CardHeader>
          </Card>
        </li>
      ))}
    </ul>
  );
}

type Loadable<T> =
  | { status: 'loading' }
  | { status: 'ready'; value: T }
  | { status: 'error'; message: string };

function useLoad<T>(load: () => Promise<T>, key: unknown): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    load()
      .then((value) => active && setState({ status: 'ready', value }))
      .catch(
        (caught: unknown) =>
          active &&
          setState({
            status: 'error',
            message:
              caught instanceof Error
                ? caught.message
                : 'Não foi possível carregar.',
          }),
      );
    return () => {
      active = false;
    };
    // `load` is rebuilt every render; `key` says when to fetch again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

function HistoryTab({
  base,
  port,
}: {
  base: CareerView['world']['history'];
  port: SeasonPort;
}) {
  const season = useLoad(() => port.load(), port);
  const history =
    season.status === 'ready'
      ? worldHistoryFromSeason(season.value, base)
      : base;
  return (
    <div className="grid gap-4">
      {season.status === 'loading' && (
        <p className="panel p-3 text-sm" role="status">
          Abrindo o arquivo das temporadas…
        </p>
      )}
      {season.status === 'error' && (
        <p className="panel p-3 text-sm" role="alert">
          {season.message}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <HistoryCard
          title="Temporadas"
          empty="A primeira temporada aparece aqui assim que o clube entrar em campo."
        >
          {history.seasons.map((item) => (
            <Row
              key={`${item.season}-${item.club}`}
              label={`${item.season} · ${item.club}`}
              value={`${item.finish} · ${item.topScorer}`}
            />
          ))}
        </HistoryCard>
        <HistoryCard
          title="Campeões"
          empty="Nenhuma competição decidida ainda nesta carreira."
        >
          {history.champions.map((item) => (
            <Row
              key={`${item.season}-${item.competition}`}
              label={`${item.season} · ${item.competition}`}
              value={item.club}
            />
          ))}
        </HistoryCard>
        <HistoryCard
          title="Recordes"
          empty="Artilharia, assistências e notas entram aqui com os jogos."
        >
          {history.records.map((item) => (
            <Row
              key={`${item.label}-${item.holder}`}
              label={item.label}
              value={`${item.value} · ${item.holder}`}
            />
          ))}
        </HistoryCard>
        <HistoryCard
          title="Ídolos"
          empty="Os goleadores do seu clube viram ídolos aqui."
        >
          {history.idols.map((item) => (
            <Row key={item.name} label={item.name} value={item.reason} />
          ))}
        </HistoryCard>
      </div>
    </div>
  );
}

function SaveTab({ career, api }: { career: CareerView; api: CareerApiPort }) {
  const world = career.world;
  const careers = useLoad(() => api.listCareers(), api);
  return (
    <div className="grid max-w-2xl gap-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between gap-3">
            <div>
              <CardTitle className="font-display text-base uppercase">
                Integridade do save
              </CardTitle>
              <CardDescription>
                Status visível de migração e arquivamento.
              </CardDescription>
            </div>
            <ShieldCheck className="text-primary" weight="fill" />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Row label="Versão" value={world.archive.saveVersion} />
          <Row label="Migração" value={world.archive.migrationStatus} />
          <Row label="Arquivo" value={world.archive.archiveStatus} />
          <Row
            label="Última compactação"
            value={world.archive.lastCompaction}
          />
          <Row label="Checksum" value={world.archive.checksum} />
          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            O cliente exibe este estado, mas não escreve no snapshot canônico.
            Migrações explícitas são executadas pelo backend.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-sm uppercase">
            O que este save guarda
          </CardTitle>
          <CardDescription>
            Tudo abaixo está gravado no servidor e volta igual quando você
            reabre a carreira.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Row label="Mensagens e notícias" value={String(world.news.length)} />
          <Row
            label="Decisões pendentes"
            value={String(world.news.filter((item) => item.pending).length)}
          />
          <Row
            label="Lançamentos no caixa"
            value={String(world.finances.ledger.length)}
          />
          <Row label="Contratos" value={String(world.contracts.length)} />
          <Row
            label="Temporadas concluídas"
            value={String(world.prestige.seasons)}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-sm uppercase">
            Carreiras salvas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {careers.status === 'loading' ? (
            <p className="text-sm text-muted-foreground" role="status">
              Conferindo os saves…
            </p>
          ) : careers.status === 'error' ? (
            <p className="text-sm" role="alert">
              {careers.message}
            </p>
          ) : careers.value.careers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma carreira salva.
            </p>
          ) : (
            <ul aria-label="Carreiras salvas" className="flex flex-col gap-3">
              {careers.value.careers.map((saved) => (
                <li
                  key={saved.id}
                  className="flex flex-col justify-between gap-1 border-b pb-3 text-sm last:border-0 last:pb-0 sm:flex-row"
                >
                  <strong className="flex flex-wrap items-center gap-2">
                    {saved.name ?? saved.coach}
                    {saved.id === career.careerId && <Badge>Em uso</Badge>}
                  </strong>
                  <span className="text-muted-foreground sm:text-right">
                    {[
                      saved.clubName ?? 'Sem clube',
                      saved.season ? `temporada ${String(saved.season)}` : '',
                      saved.currentDate
                        ? formatGameDate(saved.currentDate)
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[.65rem] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-xs font-bold uppercase">{value}</p>
    </div>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Bank;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant="outline">{label}</Badge>
          <Icon />
        </div>
        <CardTitle className="font-display text-base uppercase">
          {value}
        </CardTitle>
        <CardDescription>{note}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function Confidence({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span>{label}</span>
        <strong>{value}/100</strong>
      </div>
      <Progress
        value={value}
        aria-label={`Confiança da ${label}: ${value} de 100`}
      />
    </div>
  );
}

function HistoryCard({
  title,
  empty,
  children,
}: {
  title: string;
  /** Shown while the card has nothing recorded yet. */
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-sm uppercase">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {Children.count(children) === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-between gap-1 border-b pb-3 text-sm last:border-0 last:pb-0 sm:flex-row">
      <strong>{label}</strong>
      <span className="text-muted-foreground sm:text-right">{value}</span>
    </div>
  );
}
