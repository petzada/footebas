'use client';

import { useMemo, useState } from 'react';
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
import type { CareerApiPort, CareerView } from '@/lib/career-api';
import type {
  MarketPlayerView,
  RankingRowView,
  TransferKind,
} from '@/lib/phase4-model';
import { cn } from '@/lib/utils';

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
  const [ticket, setTicket] = useState(
    String(props.career.world.stadium.ticketPrice),
  );
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
        <TabsContent value="stadium" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base uppercase">
                {props.career.world.stadium.name}
              </CardTitle>
              <CardDescription>
                Público médio{' '}
                {props.career.world.stadium.averageCrowd.toLocaleString(
                  'pt-BR',
                )}{' '}
                · capacidade{' '}
                {props.career.world.stadium.capacity.toLocaleString('pt-BR')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="ticket-price">
                    Preço do ingresso
                  </FieldLabel>
                  <Input
                    id="ticket-price"
                    inputMode="numeric"
                    value={ticket}
                    onChange={(event) => setTicket(event.target.value)}
                    aria-describedby="ticket-hint"
                  />
                  <p id="ticket-hint" className="text-xs text-muted-foreground">
                    Entre R$ 10 e R$ 250. Preço maior tende a reduzir público.
                  </p>
                </Field>
              </FieldGroup>
              <div className="mt-4">
                <div className="flex justify-between text-sm">
                  <span>Ocupação média</span>
                  <strong>
                    {Math.round(
                      (props.career.world.stadium.averageCrowd /
                        props.career.world.stadium.capacity) *
                        100,
                    )}
                    %
                  </strong>
                </div>
                <Progress
                  className="mt-2"
                  value={
                    (props.career.world.stadium.averageCrowd /
                      props.career.world.stadium.capacity) *
                    100
                  }
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={() =>
                  void run(
                    () => props.api.setTicketPrice(Number(ticket)),
                    'Preço do ingresso atualizado para a próxima partida.',
                  )
                }
              >
                Salvar preço
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex justify-between gap-3">
                <div>
                  <CardTitle className="font-display text-base uppercase">
                    Estrutura
                  </CardTitle>
                  <CardDescription>
                    Manutenção {props.career.world.stadium.maintenance}
                  </CardDescription>
                </div>
                <Buildings />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm">
                Ampliação planejada: +5.000 lugares por{' '}
                <strong>
                  {money(props.career.world.stadium.expansionCost)}
                </strong>
                .
              </p>
              <p className="text-xs text-muted-foreground">
                A obra é bloqueada se consumir a reserva financeira mínima.
              </p>
            </CardContent>
            <CardFooter className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  void run(
                    () => props.api.maintainStadium(),
                    'Manutenção registrada no ledger.',
                  )
                }
              >
                Fazer manutenção
              </Button>
              <Button
                onClick={() =>
                  void run(
                    () => props.api.expandStadium(),
                    'Ampliação concluída e registrada no ledger.',
                  )
                }
              >
                Ampliar estádio
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="youth" className="mt-4">
          <div className="mb-3 rounded-md border bg-muted p-3 text-sm">
            <strong>Identidade do conteúdo:</strong> todos os atletas abaixo são{' '}
            <Badge variant="outline">gerados pelo universo</Badge>. Força e
            dimensões ocultas aparecem apenas como estimativas textuais.
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {props.career.world.youth.map((youth) => (
              <Card key={youth.id}>
                <CardHeader>
                  <div className="flex justify-between gap-2">
                    <div>
                      <CardTitle className="font-display text-sm uppercase">
                        {youth.name}
                      </CardTitle>
                      <CardDescription>
                        {youth.position} · {youth.age} anos
                      </CardDescription>
                    </div>
                    <Badge>
                      {youth.status === 'academy'
                        ? 'Base · gerado'
                        : youth.status === 'promoted'
                          ? 'Promovido'
                          : 'Dispensado'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">
                      Força estimada:
                    </span>{' '}
                    {youth.strengthEstimate}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Potencial:</span>{' '}
                    {youth.potentialEstimate}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Prontidão:</span>{' '}
                    {youth.readiness}
                  </p>
                </CardContent>
                <CardFooter className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={youth.status !== 'academy'}
                    onClick={() =>
                      void run(
                        () => props.api.developYouth(youth.id),
                        `Plano de ${youth.name} atualizado.`,
                      )
                    }
                  >
                    Desenvolver
                  </Button>
                  <Button
                    size="sm"
                    disabled={youth.status !== 'academy'}
                    onClick={() =>
                      void run(
                        () => props.api.promoteYouth(youth.id),
                        `${youth.name} promovido ao principal.`,
                      )
                    }
                  >
                    Promover
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={youth.status !== 'academy'}
                    onClick={() =>
                      void run(
                        () => props.api.releaseYouth(youth.id),
                        `${youth.name} dispensado.`,
                      )
                    }
                  >
                    Dispensar
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent
          value="board"
          className="mt-4 grid gap-4 lg:grid-cols-[1fr_.8fr]"
        >
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base uppercase">
                Termômetro do trabalho
              </CardTitle>
              <CardDescription>
                {props.career.world.board.status}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <Confidence
                label="Diretoria"
                value={props.career.world.board.confidence}
              />
              <Confidence
                label="Torcida"
                value={props.career.world.board.fanConfidence}
              />
              <div className="rounded-md bg-muted p-3 text-sm">
                <strong>Objetivo</strong>
                <p className="mt-1">{props.career.world.board.objective}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Risco de demissão: {props.career.world.board.firingRisk}
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
                Trocar de clube preserva treinador, prestígio e história da
                carreira.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {props.career.world.board.proposals.length ? (
                props.career.world.board.proposals.map((proposal) => (
                  <div key={proposal.id} className="rounded-md border p-3">
                    <div className="flex justify-between gap-2">
                      <strong>{proposal.club}</strong>
                      <Badge variant="outline">{proposal.division}</Badge>
                    </div>
                    <p className="mt-2 text-sm">{proposal.objective}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Salário: {money(proposal.salary)}/mês
                    </p>
                    <Button
                      className="mt-3 w-full"
                      onClick={() =>
                        void run(
                          () => props.api.acceptJobProposal(proposal.id),
                          `Novo trabalho no ${proposal.club}; carreira preservada.`,
                        )
                      }
                    >
                      Aceitar e trocar de clube
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma proposta pendente.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function WorldScreen(props: Phase4ScreenProps) {
  const world = props.career.world;
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
        <TabsContent value="news" className="mt-4 grid gap-3 lg:grid-cols-3">
          {world.news.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <Badge variant="outline" className="w-fit">
                  {item.tag}
                </Badge>
                <CardTitle className="font-display text-sm uppercase">
                  {item.headline}
                </CardTitle>
                <CardDescription>{item.detail}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="history" className="mt-4 grid gap-4 lg:grid-cols-2">
          <HistoryCard title="Temporadas">
            {world.history.seasons.map((item) => (
              <Row
                key={`${item.season}-${item.club}`}
                label={`${item.season} · ${item.club}`}
                value={`${item.finish} · ${item.topScorer}`}
              />
            ))}
          </HistoryCard>
          <HistoryCard title="Campeões">
            {world.history.champions.map((item) => (
              <Row
                key={`${item.season}-${item.competition}`}
                label={`${item.season} · ${item.competition}`}
                value={item.club}
              />
            ))}
          </HistoryCard>
          <HistoryCard title="Recordes">
            {world.history.records.map((item) => (
              <Row
                key={item.label}
                label={item.label}
                value={`${item.value} · ${item.holder}`}
              />
            ))}
          </HistoryCard>
          <HistoryCard title="Ídolos">
            {world.history.idols.map((item) => (
              <Row key={item.name} label={item.name} value={item.reason} />
            ))}
          </HistoryCard>
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
          <Tabs defaultValue="global">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="global">Global</TabsTrigger>
              <TabsTrigger value="underdog">Ascensão</TabsTrigger>
              <TabsTrigger value="monthly">Do mês</TabsTrigger>
            </TabsList>
            <TabsContent value="global">
              <RankingTable rows={world.leaderboards.global} />
            </TabsContent>
            <TabsContent value="underdog">
              <RankingTable rows={world.leaderboards.underdog} />
            </TabsContent>
            <TabsContent value="monthly">
              <RankingTable rows={world.leaderboards.monthly} />
            </TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="save" className="mt-4">
          <Card className="max-w-2xl">
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
                O cliente exibe este estado, mas não escreve no snapshot
                canônico. Migrações explícitas são executadas pelo backend.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-sm uppercase">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
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

function RankingTable({ rows }: { rows: readonly RankingRowView[] }) {
  return (
    <Card className="mt-3">
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Treinador</TableHead>
              <TableHead>Clube</TableHead>
              <TableHead className="text-right">Prestígio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={`${row.position}-${row.coach}`}
                className={cn(row.highlight && 'bg-primary/10')}
              >
                <TableCell className="font-display text-xs font-bold">
                  {row.position}
                </TableCell>
                <TableCell>
                  {row.coach}
                  {row.highlight && <Badge className="ml-2">Você</Badge>}
                </TableCell>
                <TableCell>{row.club}</TableCell>
                <TableCell className="text-right font-medium">
                  {row.points.toLocaleString('pt-BR')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
