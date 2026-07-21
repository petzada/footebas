'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  CalendarDots,
  ChartBar,
  CheckCircle,
  ClipboardText,
  House,
  Lightning,
  ListChecks,
  SoccerBall,
  Strategy,
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  CareerApiPort,
  CareerView,
  Formation,
  InMemoryCareerApi,
  MatchUpdate,
  Screen,
  Tactic,
} from '@/lib/career-api';
import { cn } from '@/lib/utils';

type Stage = 'login' | 'coach' | 'club' | 'game' | 'match' | 'result';
const defaultApi = new InMemoryCareerApi();

export function CareerGame({ api = defaultApi }: { api?: CareerApiPort }) {
  const [stage, setStage] = useState<Stage>('login');
  const [screen, setScreen] = useState<Screen>('home');
  const [career, setCareer] = useState<CareerView | null>(null);
  const [email, setEmail] = useState('torcedor@footebas.com');
  const [coach, setCoach] = useState('Márcio');
  const [formation, setFormation] = useState<Formation>('4-3-3');
  const [tactic, setTactic] = useState<Tactic>('equilibrio');
  const [update, setUpdate] = useState<MatchUpdate | null>(null);
  const [error, setError] = useState('');
  const attempt = async (action: () => Promise<void>) => {
    try {
      setError('');
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tente novamente.');
    }
  };
  if (stage !== 'game' && stage !== 'match' && stage !== 'result')
    return (
      <Onboarding
        stage={stage}
        email={email}
        coach={coach}
        error={error}
        setEmail={setEmail}
        setCoach={setCoach}
        onLogin={() =>
          attempt(async () => {
            await api.login(email);
            const saved = await api.getCareer();
            if (saved) {
              setCareer(saved);
              setStage('game');
            } else setStage('coach');
          })
        }
        onCoach={() =>
          attempt(async () => {
            await api.createCareer({ coach });
            setStage('club');
          })
        }
        onClub={(club) =>
          attempt(async () => {
            await api.selectClub(club);
            setCareer(await api.getCareer());
            setStage('game');
          })
        }
      />
    );
  if (!career) return null;
  const saveTactics = () =>
    attempt(async () => {
      setCareer(await api.setTactics({ formation, tactic }));
      setScreen('home');
    });
  const play = () =>
    attempt(async () => {
      setStage('match');
      const next = await api.advanceMatch(setUpdate);
      setCareer(next);
      setStage('result');
    });
  return (
    <div className="mx-auto min-h-dvh max-w-7xl pb-24 lg:grid lg:grid-cols-[15rem_1fr] lg:pb-0">
      <Sidebar screen={screen} setScreen={setScreen} career={career} />
      <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-9 lg:py-8">
        <Topbar career={career} />
        {stage === 'match' ? (
          <Matchday
            career={career}
            update={update}
            onSkip={() => setStage('result')}
          />
        ) : stage === 'result' ? (
          <Result
            career={career}
            onContinue={() => {
              setStage('game');
              setScreen('table');
            }}
          />
        ) : screen === 'home' ? (
          <Home career={career} onPlay={play} setScreen={setScreen} />
        ) : screen === 'squad' ? (
          <Squad
            career={career}
            onToggle={(id) =>
              attempt(async () => setCareer(await api.setLineup(id)))
            }
          />
        ) : screen === 'tactics' ? (
          <Tactics
            formation={formation}
            tactic={tactic}
            setFormation={setFormation}
            setTactic={setTactic}
            onSave={saveTactics}
          />
        ) : (
          <Standings career={career} />
        )}
      </main>
      <BottomNav screen={screen} setScreen={setScreen} />
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
        <SoccerBall weight="fill" />
      </span>
      <span className="font-display text-2xl font-bold uppercase tracking-tight">
        Footebas
      </span>
    </div>
  );
}
function Onboarding(props: {
  stage: Stage;
  email: string;
  coach: string;
  error: string;
  setEmail(v: string): void;
  setCoach(v: string): void;
  onLogin(): void;
  onCoach(): void;
  onClub(v: string): void;
}) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Brand />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Sua carreira, sua história. A rodada cabe no intervalo.
          </p>
        </div>
        <Card>
          {props.stage === 'login' ? (
            <>
              <CardHeader>
                <Badge className="w-fit">Acesso antecipado</Badge>
                <CardTitle className="font-display text-3xl uppercase">
                  Volte para a beira do campo
                </CardTitle>
                <CardDescription>
                  Entre com o e-mail. A autenticação desta versão é local.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="email">Seu e-mail</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      value={props.email}
                      onChange={(e) => props.setEmail(e.target.value)}
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter>
                <Button className="min-h-11 w-full" onClick={props.onLogin}>
                  Entrar no vestiário
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </CardFooter>
            </>
          ) : props.stage === 'coach' ? (
            <>
              <CardHeader>
                <Badge variant="secondary" className="w-fit">
                  1 de 2
                </Badge>
                <CardTitle className="font-display text-3xl uppercase">
                  Como vão te chamar?
                </CardTitle>
                <CardDescription>
                  Esse nome aparece nas manchetes e na prancheta.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="coach">Nome do treinador</FieldLabel>
                    <Input
                      id="coach"
                      value={props.coach}
                      onChange={(e) => props.setCoach(e.target.value)}
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter>
                <Button className="min-h-11 w-full" onClick={props.onCoach}>
                  Conhecer os clubes
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </CardFooter>
            </>
          ) : (
            <>
              <CardHeader>
                <Badge variant="secondary" className="w-fit">
                  2 de 2
                </Badge>
                <CardTitle className="font-display text-3xl uppercase">
                  Escolha seu desafio
                </CardTitle>
                <CardDescription>
                  Três camisas, três histórias para começar agora.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {[
                  ['Atlético Aurora', 'Elenco técnico · pressão por acesso'],
                  ['Esporte Litorâneo', 'Torcida quente · contra-ataque'],
                  [
                    'Ferroviário Central',
                    'Base forte · projeto de longo prazo',
                  ],
                ].map(([club, note]) => (
                  <Button
                    key={club}
                    variant="outline"
                    className="h-auto min-h-14 justify-between py-3"
                    onClick={() => props.onClub(club)}
                  >
                    <span className="text-left">
                      <strong className="block">{club}</strong>
                      <small className="text-muted-foreground">{note}</small>
                    </span>
                    <ArrowRight />
                  </Button>
                ))}
              </CardContent>
            </>
          )}
          {props.error && (
            <p role="alert" className="px-6 pb-5 text-sm text-destructive">
              {props.error}
            </p>
          )}
        </Card>
      </div>
    </main>
  );
}
function Topbar({ career }: { career: CareerView }) {
  return (
    <header className="mb-6 flex items-end justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-muted-foreground">
          Rodada {career.round} · Série Prata
        </p>
        <h1 className="font-display text-3xl font-bold uppercase sm:text-4xl">
          Olá, {career.coach}
        </h1>
      </div>
      <Badge variant="outline">{career.club}</Badge>
    </header>
  );
}
function Sidebar({
  screen,
  setScreen,
  career,
}: {
  screen: Screen;
  setScreen(v: Screen): void;
  career: CareerView;
}) {
  return (
    <aside className="hidden min-h-dvh border-r bg-card/60 p-5 lg:flex lg:flex-col">
      <Brand />
      <nav aria-label="Principal" className="mt-10 flex flex-col gap-2">
        {navItems.map(([id, label, Icon]) => (
          <Button
            key={id}
            variant={screen === id ? 'secondary' : 'ghost'}
            className="min-h-11 justify-start"
            onClick={() => setScreen(id)}
          >
            <Icon data-icon="inline-start" />
            {label}
          </Button>
        ))}
      </nav>
      <div className="mt-auto">
        <p className="text-xs text-muted-foreground">Próximo jogo</p>
        <p className="mt-1 font-display text-lg font-bold uppercase">
          vs. {career.nextOpponent}
        </p>
      </div>
    </aside>
  );
}
const navItems = [
  ['home', 'Início', House],
  ['squad', 'Elenco', ListChecks],
  ['tactics', 'Táticas', Strategy],
  ['table', 'Tabela', ChartBar],
] as const;
function BottomNav({
  screen,
  setScreen,
}: {
  screen: Screen;
  setScreen(v: Screen): void;
}) {
  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 grid grid-cols-4 border-t bg-background/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden"
    >
      {navItems.map(([id, label, Icon]) => (
        <button
          key={id}
          aria-current={screen === id ? 'page' : undefined}
          className={cn(
            'flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[.68rem] font-bold uppercase tracking-wide',
            screen === id
              ? 'bg-secondary text-primary'
              : 'text-muted-foreground',
          )}
          onClick={() => setScreen(id)}
        >
          <Icon
            className="size-5"
            weight={screen === id ? 'fill' : 'regular'}
          />
          {label}
        </button>
      ))}
    </nav>
  );
}
function Home({
  career,
  onPlay,
  setScreen,
}: {
  career: CareerView;
  onPlay(): void;
  setScreen(v: Screen): void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Badge>Próxima rodada</Badge>
            <CalendarDots className="size-6 text-muted-foreground" />
          </div>
          <CardTitle className="font-display text-4xl uppercase sm:text-5xl">
            {career.club}
            <span className="mx-3 text-muted-foreground">×</span>
            {career.nextOpponent}
          </CardTitle>
          <CardDescription>Hoje · 20:30 · Campo do Povo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted p-4 text-center">
            <Stat label="Formação" value={career.formation} />
            <Stat label="Postura" value={tacticLabel[career.tactic]} />
            <Stat label="Moral" value="Boa" />
          </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-2 sm:flex-row">
          <Button className="min-h-12 flex-1" onClick={onPlay}>
            <Lightning weight="fill" data-icon="inline-start" />
            Avançar partida
          </Button>
          <Button
            variant="outline"
            className="min-h-12"
            onClick={() => setScreen('tactics')}
          >
            <ClipboardText data-icon="inline-start" />
            Revisar tática
          </Button>
        </CardFooter>
      </Card>
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl uppercase">
              Pulso do clube
            </CardTitle>
            <CardDescription>
              O que pede atenção antes da bola rolar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Metric label="Confiança da diretoria" value={76} />
            <Metric label="Entrosamento" value={68} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl uppercase">
              Recado da arquibancada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              “Hoje é dia de impor nosso ritmo. Sem medo de jogar!”
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[.65rem] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-bold uppercase">{value}</p>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <Progress value={value} aria-label={`${label}: ${value}%`} />
    </div>
  );
}
const tacticLabel: Record<Tactic, string> = {
  equilibrio: 'Equilíbrio',
  pressao: 'Pressão alta',
  'contra-ataque': 'Contra-ataque',
};
function Squad({
  career,
  onToggle,
}: {
  career: CareerView;
  onToggle(id: string): void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-display text-2xl uppercase">
              Elenco principal
            </CardTitle>
            <CardDescription>
              Toque em um atleta para alternar a escalação.
            </CardDescription>
          </div>
          <Badge variant="secondary">11 titulares</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jogador</TableHead>
                <TableHead>Pos.</TableHead>
                <TableHead className="text-right">Força</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {career.players.map((player) => (
                <TableRow key={player.id}>
                  <TableCell>
                    <button
                      className="min-h-11 text-left font-medium"
                      onClick={() => onToggle(player.id)}
                    >
                      {player.name}
                    </button>
                  </TableCell>
                  <TableCell>{player.position}</TableCell>
                  <TableCell className="text-right font-display text-lg font-bold">
                    {player.rating}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={player.starter ? 'default' : 'outline'}>
                      {player.starter ? 'Titular' : 'Banco'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
function Tactics(props: {
  formation: Formation;
  tactic: Tactic;
  setFormation(v: Formation): void;
  setTactic(v: Tactic): void;
  onSave(): void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_.65fr]">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl uppercase">
            Prancheta
          </CardTitle>
          <CardDescription>
            Três escolhas claras. Ajuste e volte ao jogo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel id="formation-label">Formação</FieldLabel>
              <ToggleGroup
                aria-labelledby="formation-label"
                type="single"
                value={props.formation}
                onValueChange={(v) => v && props.setFormation(v as Formation)}
                className="grid grid-cols-3"
              >
                <ToggleGroupItem className="min-h-11" value="4-3-3">
                  4-3-3
                </ToggleGroupItem>
                <ToggleGroupItem className="min-h-11" value="4-4-2">
                  4-4-2
                </ToggleGroupItem>
                <ToggleGroupItem className="min-h-11" value="3-5-2">
                  3-5-2
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field>
              <FieldLabel id="tactic-label">Plano de jogo</FieldLabel>
              <ToggleGroup
                aria-labelledby="tactic-label"
                type="single"
                value={props.tactic}
                onValueChange={(v) => v && props.setTactic(v as Tactic)}
                className="grid grid-cols-3"
              >
                <ToggleGroupItem className="min-h-14" value="equilibrio">
                  Equilíbrio
                </ToggleGroupItem>
                <ToggleGroupItem className="min-h-14" value="pressao">
                  Pressão
                </ToggleGroupItem>
                <ToggleGroupItem className="min-h-14" value="contra-ataque">
                  Contra
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button className="min-h-11 w-full sm:w-auto" onClick={props.onSave}>
            <CheckCircle data-icon="inline-start" />
            Salvar tática
          </Button>
        </CardFooter>
      </Card>
      <Pitch formation={props.formation} />
    </div>
  );
}
function Pitch({ formation }: { formation: Formation }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl uppercase">
          Desenho em campo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative aspect-[3/4] overflow-hidden rounded-lg border-2 border-primary/35 bg-primary/10">
          <div className="absolute inset-x-0 top-1/2 border-t border-primary/25" />
          <div className="absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/25" />
          <div className="relative grid h-full grid-rows-4 place-items-center py-8">
            {formation
              .split('-')
              .concat('1')
              .map((count, row) => (
                <div key={row} className="flex w-full justify-evenly">
                  {Array.from({ length: Number(count) }).map((_, i) => (
                    <span
                      key={i}
                      className="size-5 rounded-full border-2 border-background bg-primary shadow-md"
                    />
                  ))}
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
function Matchday({
  career,
  update,
  onSkip,
}: {
  career: CareerView;
  update: MatchUpdate | null;
  onSkip(): void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge>Ao vivo · {update?.minute ?? 0}&apos;</Badge>
          <Button variant="outline" className="min-h-11" onClick={onSkip}>
            Pular para o resultado
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
        <CardTitle className="pt-5 text-center font-display text-5xl uppercase sm:text-7xl">
          {update?.score ?? '0 × 0'}
        </CardTitle>
        <CardDescription className="text-center">
          {career.club} × {career.nextOpponent}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mx-auto max-w-2xl">
          <Progress
            value={update?.progress ?? 4}
            aria-label="Progresso da partida"
          />
          <div
            aria-live="polite"
            className="mt-6 rounded-lg bg-muted p-5 text-center"
          >
            <SoccerBall
              className="mx-auto mb-3 size-7 text-primary"
              weight="fill"
            />
            <p className="font-display text-xl font-bold uppercase">
              {update?.message ?? 'Os times entram em campo'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
function Result({
  career,
  onContinue,
}: {
  career: CareerView;
  onContinue(): void;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader className="items-center text-center">
          <Trophy className="size-10 text-accent" weight="fill" />
          <Badge>Fim de jogo</Badge>
          <CardTitle className="font-display text-6xl uppercase">
            {career.lastResult?.score ?? '1 × 0'}
          </CardTitle>
          <CardDescription>
            {career.club} venceu {career.nextOpponent}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <h2 className="font-display text-2xl font-bold uppercase">
            {career.lastResult?.headline ?? 'Vitória confirmada'}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            +3 pontos · moral do elenco em alta · próxima rodada liberada
          </p>
        </CardContent>
        <CardFooter>
          <Button className="min-h-12 w-full" onClick={onContinue}>
            Ver classificação
            <ChartBar data-icon="inline-end" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
function Standings({ career }: { career: CareerView }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-2xl uppercase">
          Classificação
        </CardTitle>
        <CardDescription>
          Série Prata · após a rodada {career.round - 1}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="geral">
          <TabsList>
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="forma">Últimos jogos</TabsTrigger>
          </TabsList>
          <TabsContent value="geral">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Clube</TableHead>
                  <TableHead className="text-right">J</TableHead>
                  <TableHead className="text-right">Pts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {career.standings
                  .slice()
                  .sort((a, b) => b.points - a.points)
                  .map((row, index) => (
                    <TableRow
                      key={row.club}
                      data-current={row.club === career.club}
                    >
                      <TableCell className="font-display text-lg font-bold">
                        {index + 1}
                      </TableCell>
                      <TableCell
                        className={cn(
                          row.club === career.club && 'font-bold text-primary',
                        )}
                      >
                        {row.club}
                      </TableCell>
                      <TableCell className="text-right">{row.played}</TableCell>
                      <TableCell className="text-right font-display text-lg font-bold">
                        {row.points}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TabsContent>
          <TabsContent value="forma">
            <p className="py-8 text-center text-sm text-muted-foreground">
              A sequência aparece após três rodadas.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
