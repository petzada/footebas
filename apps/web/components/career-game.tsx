'use client';

import React, {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  CheckCircle,
  ChartLineUp,
  Pause,
  Play,
  SignOut,
  SoccerBall,
  Sparkle,
  Strategy,
  Trophy,
  UserSwitch,
  UsersThree,
  WarningCircle,
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
  type AutoPickStrategy,
  type BuildUp,
  type CareerApiPort,
  type CareerView,
  type DefensiveLine,
  type Focus,
  type Formation,
  type Marking,
  type MatchSpeed,
  type MatchUpdate,
  type Mentality,
  type PlayerView,
  type Press,
  type Screen,
  type SquadRole,
  type TacticsView,
  InMemoryCareerApi,
  isCareerLimitError,
} from '@/lib/career-api';
import type { AuthPort, AuthUser } from '@/lib/auth';
import { SessionExpiredError } from '@/lib/http-career-api';
import { Brand } from '@/components/brand';
import { AuthPending, SignInScreen } from '@/components/sign-in-screen';
import { cn } from '@/lib/utils';
import {
  ClubScreen,
  MarketScreen,
  WorldScreen,
} from '@/components/phase4-screens';
import { CompetitionScreens } from '@/components/competition-screens';
import { Phase6Shell, PwaRuntime } from '@/components/phase6-shell';
import { MatchReplayViewer } from '@/components/match-replay-viewer';
import { ClubEmblem } from '@/components/club-emblem';
import { CentralScreen } from '@/components/central-screen';
import { ClubMapScreen } from '@/components/club-map';
import {
  LoadCareerScreen,
  StartScreen,
  type PlayerIdentity,
} from '@/components/start-screens';
import { createFakeCompetitionProductPort } from '@/lib/competition-product';
import { parseScore } from '@/lib/match-replay-adapter';
import {
  competitionPortFor,
  createCareerRuntime,
  type CareerRuntime,
} from '@/lib/runtime-api';

type Stage =
  'login' | 'start' | 'load' | 'coach' | 'club' | 'game' | 'match' | 'result';

/** Offline demo calendar, same source the competition screens use. */
const demoCompetitionPort = createFakeCompetitionProductPort();

const SESSION_EXPIRED = 'Sua sessão expirou. Entre novamente.';

/**
 * Entry point. With an AuthPort (Supabase over HTTP) the game sits behind
 * the sign-in screen; without one (offline demo, dev session) it keeps the
 * local e-mail onboarding.
 */
export function CareerGame({
  api: provided,
  auth: providedAuth,
}: {
  api?: CareerApiPort;
  auth?: AuthPort | null;
}) {
  // Created once: a fresh port per render would drop the session.
  const [runtime] = useState<CareerRuntime>(() =>
    provided || providedAuth
      ? { api: provided ?? new InMemoryCareerApi(), auth: providedAuth ?? null }
      : createCareerRuntime(),
  );
  if (!runtime.auth) return <CareerFlow api={runtime.api} />;
  return <AuthGate auth={runtime.auth} api={runtime.api} />;
}

type GateState =
  | { status: 'checking' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: AuthUser };

function AuthGate({ auth, api }: { auth: AuthPort; api: CareerApiPort }) {
  const [state, setState] = useState<GateState>({ status: 'checking' });
  const [notice, setNotice] = useState('');

  useEffect(
    () =>
      auth.onChange((user) =>
        setState(
          user ? { status: 'signed-in', user } : { status: 'signed-out' },
        ),
      ),
    [auth],
  );

  const signOut = async (message = '') => {
    setNotice(message);
    await auth.signOut();
    setState({ status: 'signed-out' });
  };

  if (state.status === 'checking')
    return (
      <>
        <PwaRuntime />
        <AuthPending message="Conferindo sua sessão…" />
      </>
    );
  if (state.status === 'signed-out')
    return (
      <>
        <PwaRuntime />
        <SignInScreen auth={auth} notice={notice} />
      </>
    );
  return (
    <CareerFlow
      // A different player never inherits the previous career state.
      key={state.user.id}
      api={api}
      session={state.user}
      onSignOut={() => void signOut()}
      onSessionExpired={() => void signOut(SESSION_EXPIRED)}
    />
  );
}

function CareerFlow({
  api,
  session,
  onSignOut,
  onSessionExpired,
}: {
  api: CareerApiPort;
  /** Signed-in player; absent in the local e-mail flow. */
  session?: AuthUser;
  onSignOut?: () => void;
  onSessionExpired?: () => void;
}) {
  const [competitionPort] = useState(() => competitionPortFor(api));
  const [stage, setStage] = useState<Stage>('login');
  const [screen, setScreen] = useState<Screen>('central');
  const [limitNotice, setLimitNotice] = useState('');
  const [career, setCareer] = useState<CareerView | null>(null);
  const [email, setEmail] = useState('torcedor@footebas.com');
  const [coach, setCoach] = useState('Márcio');
  const [matchUpdate, setMatchUpdate] = useState<MatchUpdate | null>(null);
  const [matchFeed, setMatchFeed] = useState<MatchUpdate[]>([]);
  const [error, setError] = useState('');
  const [commandState, setCommandState] = useState<
    'idle' | 'pending' | 'duplicate' | 'success'
  >('idle');
  // Blocks repeated taps of the same command while it is in flight; different
  // commands (e.g. skipping during the narrated feed) are never blocked.
  const inFlight = useRef(new Set<string>());

  const attempt = async <T,>(key: string, action: () => Promise<T>) => {
    if (inFlight.current.has(key)) {
      setCommandState('duplicate');
      return undefined;
    }
    inFlight.current.add(key);
    setCommandState('pending');
    try {
      setError('');
      const result = await action();
      setCommandState('success');
      return result;
    } catch (caught) {
      setCommandState('idle');
      if (caught instanceof SessionExpiredError && onSessionExpired) {
        onSessionExpired();
        return undefined;
      }
      setError(caught instanceof Error ? caught.message : 'Tente novamente.');
      return undefined;
    } finally {
      inFlight.current.delete(key);
    }
  };

  const beginNarratedMatch = () =>
    attempt('narrate', async () => {
      const first = await api.beginMatch();
      setMatchUpdate(first);
      setMatchFeed([first]);
      setStage('match');
    });

  const nextEvent = async () => {
    const next = await attempt('next', () => api.nextMatchEvent());
    if (!next) return;
    setMatchUpdate(next);
    setMatchFeed((current) =>
      current.some((item) => item.id === next.id)
        ? current
        : [...current, next],
    );
  };

  const finishMatch = () =>
    attempt('finish', async () => {
      setCareer(await api.finishMatch());
      setStage('result');
    });

  const instantResult = () =>
    attempt('instant', async () => {
      setCareer(await api.instantResult());
      setStage('result');
    });

  const login = () =>
    attempt('login', async () => {
      // With a real session the identity comes from the bearer.
      await api.login(
        session ? (session.email ?? 'jogador@footebas.app') : email,
      );
      setStage('start');
    });

  const goStart = () => {
    setError('');
    setLimitNotice('');
    setStage('start');
  };

  const openCareer = (careerId: string) =>
    attempt(`open:${careerId}`, async () => {
      const opened = await api.openCareer(careerId);
      setLimitNotice('');
      if (!opened) {
        setStage('club');
        return;
      }
      setCareer(opened);
      setScreen('central');
      setStage('game');
    });

  const loadStats = useCallback(() => api.getPublicStats(), [api]);
  const listCareers = useCallback(() => api.listCareers(), [api]);
  const removeCareer = useCallback(
    async (careerId: string) => {
      try {
        await api.deleteCareer(careerId);
      } catch (caught) {
        if (caught instanceof SessionExpiredError && onSessionExpired)
          onSessionExpired();
        throw caught;
      }
    },
    [api, onSessionExpired],
  );

  const player: PlayerIdentity = {
    name:
      session?.name ??
      (session?.email ?? email).split('@')[0] ??
      career?.coach ??
      'Treinador',
    ...(session?.avatarUrl ? { avatarUrl: session.avatarUrl } : {}),
  };

  const resumeSession = useEffectEvent(() => void login());
  const userId = session?.id;
  useEffect(() => {
    if (!userId) return;
    // Deferred so a Strict Mode remount resumes the career only once.
    let active = true;
    void Promise.resolve().then(() => {
      if (active) resumeSession();
    });
    return () => {
      active = false;
    };
  }, [userId]);

  if (stage === 'start')
    return (
      <>
        <PwaRuntime />
        <StartScreen
          player={player}
          loadStats={loadStats}
          error={error}
          onNewCareer={() => {
            setError('');
            setStage('coach');
          }}
          onLoadCareer={() => {
            setError('');
            setStage('load');
          }}
          onSignOut={onSignOut}
        />
      </>
    );

  if (stage === 'load')
    return (
      <>
        <PwaRuntime />
        <LoadCareerScreen
          load={listCareers}
          remove={removeCareer}
          notice={limitNotice}
          error={error}
          onOpen={(summary) => void openCareer(summary.id)}
          onNewCareer={() => {
            setError('');
            setLimitNotice('');
            setStage('coach');
          }}
          onBack={goStart}
          onSignOut={onSignOut}
        />
      </>
    );

  if (!['game', 'match', 'result'].includes(stage)) {
    return (
      <>
        <PwaRuntime />
        <Onboarding
          stage={stage}
          signedIn={session !== undefined}
          email={email}
          coach={coach}
          error={error}
          setEmail={setEmail}
          setCoach={setCoach}
          onLogin={() => void login()}
          {...(onSignOut ? { onSignOut } : {})}
          onBack={goStart}
          onCoach={() =>
            attempt('coach', async () => {
              try {
                await api.createCareer({ coach });
              } catch (caught) {
                // The plan refused another career: show it next to the list.
                if (!isCareerLimitError(caught)) throw caught;
                setLimitNotice(caught.message);
                setStage('load');
                return;
              }
              setStage('club');
            })
          }
          onClub={(club) =>
            attempt('club', async () => {
              await api.selectClub(club);
              setCareer(await api.getCareer());
              setScreen('central');
              setStage('game');
            })
          }
        />
      </>
    );
  }

  if (!career) return null;

  const shared = { career, error };
  return (
    <>
      <PwaRuntime />
      <Phase6Shell
        screen={screen}
        setScreen={setScreen}
        career={career}
        commandState={commandState}
        {...(onSignOut ? { onSignOut } : {})}
        onHome={goStart}
      >
        {error && <InlineError message={error} />}
        {stage === 'match' && matchUpdate ? (
          <Matchday
            {...shared}
            api={api}
            update={matchUpdate}
            feed={matchFeed}
            onNext={nextEvent}
            onSkip={finishMatch}
            onFinished={finishMatch}
            onCareerChange={setCareer}
            reportError={setError}
          />
        ) : stage === 'result' ? (
          <Result
            career={career}
            onContinue={() => {
              setStage('game');
              setScreen('central');
            }}
          />
        ) : screen === 'central' ? (
          <CentralScreen
            career={career}
            calendar={competitionPort ?? demoCompetitionPort}
            onNarrate={beginNarratedMatch}
            onInstant={instantResult}
            navigate={setScreen}
          />
        ) : screen === 'map' ? (
          <ClubMapScreen
            career={career}
            navigate={setScreen}
            onNarrate={beginNarratedMatch}
            onInstant={instantResult}
          />
        ) : screen === 'squad' ? (
          <Squad
            career={career}
            onMove={(id, role) =>
              attempt(`role:${id}`, async () =>
                setCareer(await api.setPlayerRole(id, role)),
              )
            }
            onAuto={(strategy) =>
              attempt('auto-pick', async () =>
                setCareer(await api.autoPick(strategy)),
              )
            }
          />
        ) : screen === 'tactics' ? (
          <Tactics
            career={career}
            onSave={(formation, tactics) =>
              attempt('tactics', async () => {
                setCareer(await api.setTactics({ formation, tactics }));
                setScreen('central');
              })
            }
          />
        ) : screen === 'table' ? (
          <Standings career={career} />
        ) : screen === 'market' ? (
          <MarketScreen
            career={career}
            api={api}
            onCareerChange={setCareer}
            reportError={setError}
          />
        ) : screen === 'season' ? (
          <SeasonScreen career={career} navigate={setScreen} />
        ) : screen === 'office' || screen === 'stadium' ? (
          <ClubScreen
            career={career}
            api={api}
            onCareerChange={setCareer}
            reportError={setError}
            key={screen}
            initialTab={screen === 'office' ? 'board' : 'stadium'}
          />
        ) : screen === 'finance' ? (
          <ClubScreen
            career={career}
            api={api}
            onCareerChange={setCareer}
            reportError={setError}
            key={screen}
            initialTab="finance"
          />
        ) : screen === 'calendar' ? (
          <CompetitionScreens
            key={screen}
            initialTab="calendar"
            {...(competitionPort ? { port: competitionPort } : {})}
          />
        ) : screen === 'competitions' ? (
          <CompetitionScreens
            key={screen}
            initialTab="pyramid"
            {...(competitionPort ? { port: competitionPort } : {})}
          />
        ) : screen === 'inbox' ? (
          <WorldScreen
            career={career}
            api={api}
            onCareerChange={setCareer}
            reportError={setError}
            key={screen}
            initialTab="news"
          />
        ) : screen === 'history' ? (
          <WorldScreen
            career={career}
            api={api}
            onCareerChange={setCareer}
            reportError={setError}
            key={screen}
            initialTab="history"
          />
        ) : (
          // ranking
          <WorldScreen
            career={career}
            api={api}
            onCareerChange={setCareer}
            reportError={setError}
            key={screen}
            initialTab="ranking"
          />
        )}
      </Phase6Shell>
    </>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-foreground"
    >
      <WarningCircle
        className="mt-0.5 shrink-0 text-destructive"
        weight="fill"
      />
      <span>{message}</span>
    </div>
  );
}

function Onboarding(props: {
  stage: Stage;
  /** Real session: the login step only resumes the saved career. */
  signedIn: boolean;
  email: string;
  coach: string;
  error: string;
  setEmail(value: string): void;
  setCoach(value: string): void;
  onLogin(): void;
  onCoach(): void;
  onClub(value: string): void;
  onBack(): void;
  onSignOut?: () => void;
}) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Brand />
          <p className="mt-3 text-sm text-muted-foreground">
            Sua carreira, sua história. A rodada cabe no intervalo.
          </p>
        </div>
        <Card>
          {props.stage === 'login' && props.signedIn ? (
            <>
              <CardHeader>
                <CardTitle className="font-display text-3xl uppercase">
                  Abrindo o vestiário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  role="status"
                  aria-live="polite"
                  className="text-sm text-muted-foreground"
                >
                  {props.error
                    ? 'Não conseguimos carregar sua carreira.'
                    : 'Carregando sua carreira…'}
                </p>
              </CardContent>
              {props.error && (
                <CardFooter>
                  <Button className="min-h-11 w-full" onClick={props.onLogin}>
                    Tentar novamente
                    <ArrowsClockwise data-icon="inline-end" />
                  </Button>
                </CardFooter>
              )}
            </>
          ) : props.stage === 'login' ? (
            <>
              <CardHeader>
                <Badge className="w-fit">Acesso local</Badge>
                <CardTitle className="font-display text-3xl uppercase">
                  Volte para a beira do campo
                </CardTitle>
                <CardDescription>
                  Entre com seu e-mail para continuar.
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
                      onChange={(event) => props.setEmail(event.target.value)}
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
                <Button
                  variant="ghost"
                  className="-ml-3 min-h-11 w-fit"
                  onClick={props.onBack}
                >
                  <ArrowLeft data-icon="inline-start" />
                  Voltar ao início
                </Button>
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
                      onChange={(event) => props.setCoach(event.target.value)}
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
                  Comece com um elenco brasileiro real.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {[
                  ['Flamengo', 'Elenco técnico · pressão por títulos'],
                  ['Fluminense', 'Torcida exigente · jogo apoiado'],
                  ['Atlético Mineiro', 'Elenco experiente · intensidade alta'],
                ].map(([club, note]) => (
                  <Button
                    key={club}
                    variant="outline"
                    className="h-auto min-h-16 justify-between gap-3 py-3"
                    onClick={() => props.onClub(club)}
                  >
                    <span className="flex items-center gap-3 text-left">
                      <ClubEmblem name={club} size={40} decorative />
                      <span>
                        <strong className="block">{club}</strong>
                        <small className="text-muted-foreground">{note}</small>
                      </span>
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
        {props.onSignOut && (
          <Button
            variant="ghost"
            className="mt-4 min-h-11 w-full"
            onClick={props.onSignOut}
          >
            <SignOut data-icon="inline-start" />
            Sair da conta
          </Button>
        )}
      </div>
    </main>
  );
}

const roleLabel: Record<SquadRole, string> = {
  starter: 'Titulares',
  bench: 'Banco',
  reserve: 'Reservas',
};

function Squad({
  career,
  onMove,
  onAuto,
}: {
  career: CareerView;
  onMove(id: string, role: SquadRole): void;
  onAuto(strategy: AutoPickStrategy): void;
}) {
  const [selectedId, setSelectedId] = useState(career.players[0]?.id ?? '');
  const selected =
    career.players.find((player) => player.id === selectedId) ??
    career.players[0];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-display text-3xl font-bold uppercase">
            Vestiário
          </h2>
          <p className="text-sm text-muted-foreground">
            Selecione um jogador e use os botões. Arrastar não é necessário.
          </p>
        </div>
        <div
          role="group"
          aria-label="Escalações automáticas"
          className="grid grid-cols-3 gap-2"
        >
          <Button size="sm" variant="secondary" onClick={() => onAuto('best')}>
            <Sparkle data-icon="inline-start" />
            Melhor
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAuto('rest')}>
            <ArrowsClockwise data-icon="inline-start" />
            Poupar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAuto('develop')}>
            <UsersThree data-icon="inline-start" />
            Desenvolver
          </Button>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(19rem,.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl uppercase">
              Grupos do elenco
            </CardTitle>
            <CardDescription>
              Navegue com Tab e ative com Enter ou Espaço.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="starter">
              <TabsList className="grid w-full grid-cols-3">
                {(['starter', 'bench', 'reserve'] as const).map((role) => (
                  <TabsTrigger key={role} value={role}>
                    {roleLabel[role]} (
                    {
                      career.players.filter((player) => player.role === role)
                        .length
                    }
                    )
                  </TabsTrigger>
                ))}
              </TabsList>
              {(['starter', 'bench', 'reserve'] as const).map((role) => (
                <TabsContent key={role} value={role}>
                  <div
                    role="list"
                    aria-label={roleLabel[role]}
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    {career.players
                      .filter((player) => player.role === role)
                      .map((player) => (
                        <PlayerRow
                          key={player.id}
                          player={player}
                          selected={player.id === selected?.id}
                          onSelect={() => setSelectedId(player.id)}
                        />
                      ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
        {selected && (
          <PlayerDetail
            player={selected}
            onMove={(role) => onMove(selected.id, role)}
          />
        )}
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  selected,
  onSelect,
}: {
  player: PlayerView;
  selected: boolean;
  onSelect(): void;
}) {
  const unavailable = player.injuryRounds > 0 || player.suspended;
  return (
    <button
      aria-pressed={selected}
      className={cn(
        'grid min-h-16 w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border p-3 text-left transition-colors',
        selected
          ? 'border-primary bg-primary/10'
          : 'bg-background/35 hover:bg-muted',
      )}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect();
      }}
    >
      <span className="grid size-10 place-items-center rounded-md bg-secondary font-display text-lg font-bold">
        {player.shirt}
      </span>
      <span className="min-w-0">
        <strong className="block truncate text-sm">{player.name}</strong>
        <small className="text-muted-foreground">
          {player.primaryPosition} · {player.condition}% cond.
        </small>
        {unavailable && (
          <span className="mt-1 block text-xs text-accent">
            {player.injuryRounds ? 'Lesionado' : 'Suspenso'}
          </span>
        )}
      </span>
      <span
        className="font-display text-2xl font-bold text-primary"
        aria-label={`Força ${player.strength}`}
      >
        {player.strength}
      </span>
    </button>
  );
}

function PlayerDetail({
  player,
  onMove,
}: {
  player: PlayerView;
  onMove(role: SquadRole): void;
}) {
  return (
    <Card aria-label={`Detalhes de ${player.name}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="font-display text-2xl uppercase">
              {player.name}
            </CardTitle>
            <CardDescription>
              #{player.shirt} · {player.age} anos · {player.nationality}
            </CardDescription>
          </div>
          <span className="font-display text-5xl font-bold text-primary">
            {player.strength}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {player.traits.slice(0, 2).map((trait) => (
            <Badge key={trait} variant="secondary">
              {trait}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info
            label="Posições"
            value={[player.primaryPosition, ...player.secondaryPositions].join(
              ' · ',
            )}
          />
          <Info label="Lado" value={player.side} />
          <Info
            label="Cartões"
            value={`${player.yellowCards}A · ${player.redCards}V`}
          />
          <Info
            label="Última nota"
            value={player.lastRating?.toFixed(1) ?? 'Sem nota'}
          />
        </div>
        <div className="flex flex-col gap-3">
          <PlayerMetric label="Condição" value={player.condition} />
          <PlayerMetric label="Moral" value={player.morale} />
          <PlayerMetric label="Ritmo" value={player.sharpness} />
        </div>
        <div className="rounded-md bg-muted p-3 text-sm">
          <strong>
            {player.appearances} jogos · {player.goals} gols
          </strong>
          <p className="mt-1 text-muted-foreground">
            {player.injuryRounds
              ? `Lesionado por ${player.injuryRounds} rodada(s).`
              : player.suspended
                ? 'Suspenso para a próxima partida.'
                : 'Disponível para jogar.'}
          </p>
        </div>
        <section aria-labelledby={`scouting-${player.id}`}>
          <h3
            id={`scouting-${player.id}`}
            className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            Olho clínico · estimativas
          </h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <Estimate
              label="Potencial"
              value={player.scoutingEstimates.potential}
            />
            <Estimate
              label="Consistência"
              value={player.scoutingEstimates.consistency}
            />
            <Estimate
              label="Lesões"
              value={player.scoutingEstimates.injuryProneness}
            />
            <Estimate
              label="Adaptação"
              value={player.scoutingEstimates.adaptation}
            />
            <Estimate
              label="Profissionalismo"
              value={player.scoutingEstimates.professionalism}
            />
            <Estimate
              label="Jogo grande"
              value={player.scoutingEstimates.bigMatches}
            />
          </dl>
        </section>
      </CardContent>
      <CardFooter
        className="grid grid-cols-3 gap-2"
        role="group"
        aria-label={`Mover ${player.name}`}
      >
        {(['starter', 'bench', 'reserve'] as const).map((role) => (
          <Button
            key={role}
            size="sm"
            variant={player.role === role ? 'secondary' : 'outline'}
            disabled={player.role === role}
            onClick={() => onMove(role)}
          >
            {role === 'starter'
              ? 'Titular'
              : role === 'bench'
                ? 'Banco'
                : 'Reserva'}
          </Button>
        ))}
      </CardFooter>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium capitalize">{value}</p>
    </div>
  );
}

function Estimate({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium capitalize">{value}</dd>
    </div>
  );
}

function PlayerMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <Progress value={value} aria-label={`${label}: ${value}%`} />
    </div>
  );
}

const tacticsLabel = {
  mentality: {
    cautious: 'Cautela',
    balanced: 'Equilibrada',
    attacking: 'Ofensiva',
  },
  buildUp: { short: 'Curta', mixed: 'Mista', direct: 'Direta' },
  focus: { middle: 'Meio', wings: 'Laterais' },
  press: { low: 'Baixa', medium: 'Média', high: 'Alta' },
  defensiveLine: { deep: 'Recuada', standard: 'Normal', high: 'Alta' },
  marking: { light: 'Leve', strong: 'Forte', 'very-strong': 'Muito forte' },
} as const;

function Tactics({
  career,
  onSave,
}: {
  career: CareerView;
  onSave(formation: Formation, tactics: TacticsView): void;
}) {
  const [formation, setFormation] = useState(career.formation);
  const [tactics, setTactics] = useState(career.tactics);
  const change = <K extends keyof TacticsView>(key: K, value: TacticsView[K]) =>
    setTactics((current) => ({ ...current, [key]: value }));
  const starters = career.players.filter((player) => player.role === 'starter');
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,.72fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl uppercase">
            Prancheta compacta
          </CardTitle>
          <CardDescription>
            Sete decisões, sem menus escondidos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <TacticalChoice<Formation>
              label="Formação"
              value={formation}
              options={['4-3-3', '4-4-2', '3-5-2', '5-3-2']}
              labels={{
                '4-3-3': '4-3-3',
                '4-4-2': '4-4-2',
                '3-5-2': '3-5-2',
                '5-3-2': '5-3-2',
              }}
              onChange={setFormation}
            />
            <TacticalChoice
              label="Mentalidade"
              value={tactics.mentality}
              options={['cautious', 'balanced', 'attacking'] as Mentality[]}
              labels={tacticsLabel.mentality}
              onChange={(value) => change('mentality', value)}
            />
            <TacticalChoice
              label="Construção"
              value={tactics.buildUp}
              options={['short', 'mixed', 'direct'] as BuildUp[]}
              labels={tacticsLabel.buildUp}
              onChange={(value) => change('buildUp', value)}
            />
            <TacticalChoice
              label="Foco ofensivo"
              value={tactics.focus}
              options={['middle', 'wings'] as Focus[]}
              labels={tacticsLabel.focus}
              onChange={(value) => change('focus', value)}
            />
            <TacticalChoice
              label="Pressão"
              value={tactics.press}
              options={['low', 'medium', 'high'] as Press[]}
              labels={tacticsLabel.press}
              onChange={(value) => change('press', value)}
            />
            <TacticalChoice
              label="Linha defensiva"
              value={tactics.defensiveLine}
              options={['deep', 'standard', 'high'] as DefensiveLine[]}
              labels={tacticsLabel.defensiveLine}
              onChange={(value) => change('defensiveLine', value)}
            />
            <TacticalChoice
              label="Marcação"
              value={tactics.marking}
              options={['light', 'strong', 'very-strong'] as Marking[]}
              labels={tacticsLabel.marking}
              onChange={(value) => change('marking', value)}
            />
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button
            className="min-h-11 w-full sm:w-auto"
            onClick={() => onSave(formation, tactics)}
          >
            <CheckCircle data-icon="inline-start" />
            Salvar tática
          </Button>
        </CardFooter>
      </Card>
      <Pitch formation={formation} players={starters} />
    </div>
  );
}

function TacticalChoice<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange(value: T): void;
}) {
  const id = `choice-${label.toLowerCase().replaceAll(' ', '-')}`;
  return (
    <Field>
      <FieldLabel id={id}>{label}</FieldLabel>
      <ToggleGroup
        aria-labelledby={id}
        type="single"
        value={value}
        onValueChange={(next) => next && onChange(next as T)}
        className={cn(
          'grid',
          options.length === 2
            ? 'grid-cols-2'
            : options.length === 4
              ? 'grid-cols-4'
              : 'grid-cols-3',
        )}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option}
            className="min-h-11 px-2"
            value={option}
          >
            {labels[option]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  );
}

function Pitch({
  formation,
  players,
}: {
  formation: Formation;
  players: readonly PlayerView[];
}) {
  const rows = formation.split('-').map(Number).reverse().concat(1);
  let index = 0;
  return (
    <Card className="xl:sticky xl:top-6 xl:self-start">
      <CardHeader>
        <CardTitle className="font-display text-xl uppercase">
          {formation} em campo
        </CardTitle>
        <CardDescription>Os nomes refletem os 11 titulares.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="pitch relative aspect-[3/4] overflow-hidden rounded-lg border-2 border-primary/45">
          <div
            className="relative z-10 grid h-full place-items-center py-6"
            style={{
              gridTemplateRows: `repeat(${rows.length}, minmax(0, 1fr))`,
            }}
          >
            {rows.map((count, row) => (
              <div
                key={`${row}-${count}`}
                className="flex w-full justify-evenly"
              >
                {Array.from({ length: count }).map(() => {
                  const player = players[index++];
                  return (
                    <span
                      key={`${row}-${index}`}
                      className="flex w-16 flex-col items-center text-center"
                    >
                      <span className="grid size-8 place-items-center rounded-full border-2 border-background bg-primary font-display text-xs font-bold text-primary-foreground shadow">
                        {player?.shirt ?? '?'}
                      </span>
                      <small className="mt-1 w-full truncate text-[.62rem] font-bold">
                        {player?.name.split(' ').at(-1) ?? 'Vaga'}
                      </small>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Matchday(props: {
  career: CareerView;
  api: CareerApiPort;
  update: MatchUpdate;
  feed: readonly MatchUpdate[];
  error: string;
  onNext(): Promise<void>;
  onSkip(): void;
  onFinished(): void;
  onCareerChange(value: CareerView): void;
  reportError(value: string): void;
}) {
  const [speed, setSpeed] = useState<MatchSpeed>(2);
  const [manualPaused, setManualPaused] = useState(false);
  const [dismissedPauseId, setDismissedPauseId] = useState('');
  const [outgoing, setOutgoing] = useState('');
  const [incoming, setIncoming] = useState('');
  const [liveMentality, setLiveMentality] = useState(
    props.career.tactics.mentality,
  );
  const starters = props.career.players.filter(
    (player) => player.role === 'starter',
  );
  const bench = props.career.players.filter(
    (player) =>
      player.role === 'bench' && !player.injuryRounds && !player.suspended,
  );
  const { update, onNext } = props;
  const paused =
    manualPaused || (update.decisionPoint && dismissedPauseId !== update.id);

  useEffect(() => {
    if (update.decisionPoint || update.done || paused) return;
    const timer = window.setTimeout(() => void onNext(), 1300 / speed);
    return () => window.clearTimeout(timer);
  }, [onNext, paused, speed, update]);

  const perform = async (action: () => Promise<unknown>) => {
    try {
      props.reportError('');
      await action();
    } catch (caught) {
      props.reportError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível aplicar a mudança.',
      );
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,.8fr)]">
      <Card className="overflow-hidden">
        <CardHeader className="scoreboard">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge>Ao vivo · {props.update.minute}&apos;</Badge>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                aria-label={paused ? 'Retomar narração' : 'Pausar narração'}
                onClick={() => {
                  if (update.decisionPoint && dismissedPauseId !== update.id)
                    setDismissedPauseId(update.id);
                  else setManualPaused((value) => !value);
                }}
              >
                {paused ? <Play /> : <Pause />}
              </Button>
              <ToggleGroup
                aria-label="Velocidade da narração"
                type="single"
                value={String(speed)}
                onValueChange={(value) =>
                  value && setSpeed(Number(value) as MatchSpeed)
                }
              >
                {([1, 2, 4] as const).map((value) => (
                  <ToggleGroupItem
                    key={value}
                    value={String(value)}
                    aria-label={`Velocidade ${value} vezes`}
                  >
                    {value}×
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Button size="sm" variant="secondary" onClick={props.onSkip}>
                Pular resultado
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
          <CardTitle className="pt-3 text-center font-display text-6xl uppercase sm:text-8xl">
            {props.update.score}
          </CardTitle>
          <CardDescription className="text-center">
            {props.career.club} × {props.career.opponent.club}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-6">
          <Progress
            value={props.update.progress}
            aria-label={`Partida em ${props.update.progress}%`}
          />
          <div
            aria-live="polite"
            aria-atomic="true"
            className="rounded-md bg-muted p-5 text-center"
          >
            <SoccerBall
              className="mx-auto mb-3 size-7 text-primary"
              weight="fill"
            />
            <p className="font-display text-xl font-bold uppercase">
              {props.update.message}
            </p>
          </div>
          {props.update.decisionPoint && (
            <div className="rounded-md border border-accent/50 bg-accent/10 p-3 text-center">
              <p className="text-sm font-medium">
                Pausa tática aos {props.update.minute}&apos;. Faça um ajuste ou
                continue.
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => {
                  setDismissedPauseId(update.id);
                  setManualPaused(false);
                  void props.onNext();
                }}
              >
                Continuar partida
                <Play data-icon="inline-end" />
              </Button>
            </div>
          )}
          {props.update.done && (
            <Button className="min-h-12" onClick={props.onFinished}>
              Ver resultado
              <Trophy data-icon="inline-end" />
            </Button>
          )}
        </CardContent>
      </Card>
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl uppercase">
              Intervenções
            </CardTitle>
            <CardDescription>
              Disponíveis apenas nas pausas destacadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="outgoing">Sai</FieldLabel>
                <select
                  id="outgoing"
                  className="min-h-11 rounded-md border bg-background px-3 text-sm"
                  value={outgoing}
                  onChange={(event) => setOutgoing(event.target.value)}
                >
                  <option value="">Escolha um titular</option>
                  {starters.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="incoming">Entra</FieldLabel>
                <select
                  id="incoming"
                  className="min-h-11 rounded-md border bg-background px-3 text-sm"
                  value={incoming}
                  onChange={(event) => setIncoming(event.target.value)}
                >
                  <option value="">Escolha o banco</option>
                  {bench.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </Field>
            </FieldGroup>
            <Button
              variant="outline"
              disabled={!props.update.decisionPoint}
              onClick={() =>
                perform(async () => {
                  await props.api.makeSubstitution({
                    outgoingId: outgoing,
                    incomingId: incoming,
                  });
                  setOutgoing('');
                  setIncoming('');
                })
              }
            >
              <UserSwitch data-icon="inline-start" />
              Confirmar substituição
            </Button>
            <Field>
              <FieldLabel htmlFor="live-mentality">
                Mentalidade em jogo
              </FieldLabel>
              <select
                id="live-mentality"
                className="min-h-11 rounded-md border bg-background px-3 text-sm"
                value={liveMentality}
                onChange={(event) =>
                  setLiveMentality(event.target.value as Mentality)
                }
              >
                {Object.entries(tacticsLabel.mentality).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Button
              variant="outline"
              disabled={!props.update.decisionPoint}
              onClick={() =>
                perform(async () => {
                  await props.api.changeMatchTactics({
                    mentality: liveMentality,
                  });
                  const next = await props.api.getCareer();
                  if (next) props.onCareerChange(next);
                })
              }
            >
              <Strategy data-icon="inline-start" />
              Aplicar ajuste
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl uppercase">
              Narração
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol
              aria-label="Feed da partida"
              className="flex max-h-56 flex-col gap-3 overflow-y-auto"
            >
              {props.feed
                .slice()
                .reverse()
                .map((event) => (
                  <li
                    key={event.id}
                    className="grid grid-cols-[2.5rem_1fr] gap-2 text-sm"
                  >
                    <strong className="font-display text-primary">
                      {event.minute}&apos;
                    </strong>
                    <span>{event.message}</span>
                  </li>
                ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Result({
  career,
  onContinue,
}: {
  career: CareerView;
  onContinue(): void;
}) {
  const result = career.lastResult;
  if (!result)
    return (
      <div className="mx-auto max-w-2xl">
        <Button className="min-h-12 w-full" onClick={onContinue}>
          Preparar próxima rodada
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    );
  const score = parseScore(result.score);
  const outcome =
    score.home > score.away
      ? { verdict: `${career.club} venceu`, summary: '+3 pontos' }
      : score.home === score.away
        ? { verdict: 'Empate', summary: '+1 ponto' }
        : { verdict: `${career.club} perdeu`, summary: 'sem pontos' };
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader className="items-center text-center">
          <Trophy className="size-10 text-accent" weight="fill" />
          <Badge>Fim de jogo</Badge>
          <CardTitle className="font-display text-6xl uppercase">
            {result.score}
          </CardTitle>
          <CardDescription>{outcome.verdict}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-center">
          <div>
            <h2 className="font-display text-2xl font-bold uppercase">
              {result.headline}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {outcome.summary} · próxima rodada liberada
            </p>
          </div>
          {result.actions.length > 0 && (
            <div className="rounded-md bg-muted p-3 text-left">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Decisões registradas
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {result.actions.map((action, index) => (
                  <li key={`${action.minute}-${index}`}>
                    {action.minute}&apos; · {action.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button className="min-h-12 w-full" onClick={onContinue}>
            Preparar próxima rodada
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardFooter>
      </Card>
      {result.replay && <MatchReplayViewer match={result.replay} />}
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
          {career.division ?? 'Liga'} · rodada {career.round}
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                <TableRow key={row.club}>
                  <TableCell className="font-display text-lg font-bold">
                    {index + 1}
                  </TableCell>
                  <TableCell
                    className={cn(
                      row.club === career.club && 'font-bold text-primary',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <ClubEmblem name={row.club} size={24} decorative />
                      {row.club}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{row.played}</TableCell>
                  <TableCell className="text-right font-display text-lg font-bold">
                    {row.points}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * Temporada: read-only season screen. Charts (scorers, ratings, position by
 * round, champions) come with its own redesign; the table works today.
 */
function SeasonScreen({
  career,
  navigate,
}: {
  career: CareerView;
  navigate(value: Screen): void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="temporada-em-construcao"
        className="arcade-panel flex flex-col gap-3 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <ChartLineUp
            className="size-8 shrink-0 text-accent"
            weight="duotone"
            aria-hidden="true"
          />
          <div>
            <h2
              id="temporada-em-construcao"
              className="font-display text-2xl font-bold uppercase"
            >
              Em construção
            </h2>
            <p className="text-sm text-muted-foreground">
              Artilharia, notas, posição por rodada e campeões chegam nesta
              tela. Enquanto isso, a classificação e as competições seguem aqui.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => navigate('competitions')}
        >
          Ver competições
          <ArrowRight data-icon="inline-end" />
        </Button>
      </section>
      <Standings career={career} />
    </div>
  );
}
