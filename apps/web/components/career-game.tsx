'use client';

import React, {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import {
  ArrowRight,
  ArrowsClockwise,
  Pause,
  Play,
  SignOut,
  SoccerBall,
  Strategy,
  Trophy,
  UserSwitch,
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  type CareerApiPort,
  type CareerView,
  type MatchSpeed,
  type MatchUpdate,
  type Mentality,
  type Screen,
  InMemoryCareerApi,
  isCareerLimitError,
} from '@/lib/career-api';
import type { AuthPort, AuthUser } from '@/lib/auth';
import { SessionExpiredError } from '@/lib/http-career-api';
import { Brand } from '@/components/brand';
import { AuthPending, SignInScreen } from '@/components/sign-in-screen';
import { cn } from '@/lib/utils';
import { ClubScreen, WorldScreen } from '@/components/phase4-screens';
import { SquadScreen } from '@/components/squad-screen';
import { TACTIC_LABEL } from '@/lib/management-model';
import { MarketScreen } from '@/components/market-screen';
import { OfficeScreen } from '@/components/office-screen';
import { CompetitionScreens } from '@/components/competition-screens';
import { Phase6Shell, PwaRuntime } from '@/components/phase6-shell';
import { MatchReplayViewer } from '@/components/match-replay-viewer';
import { ClubEmblem } from '@/components/club-emblem';
import { TickerProvider, useTicker } from '@/components/retro/ticker';
import { useSound } from '@/lib/retro/use-sound';
import { CentralScreen } from '@/components/central-screen';
import { ClubMapScreen } from '@/components/club-map';
import {
  LoadCareerScreen,
  StartScreen,
  type PlayerIdentity,
} from '@/components/start-screens';
import {
  NewCareerWizard,
  type NewCareerSubmission,
} from '@/components/new-career-wizard';
import { createFakeCompetitionProductPort } from '@/lib/competition-product';
import { parseScore } from '@/lib/match-replay-adapter';
import {
  competitionPortFor,
  createCareerRuntime,
  productPortsFor,
  type CareerRuntime,
} from '@/lib/runtime-api';
import { SeasonScreen } from '@/components/season-screen';
import { RankingScreen } from '@/components/ranking-screen';
import { ProfileScreen } from '@/components/profile-screen';

type Stage =
  'login' | 'start' | 'load' | 'new' | 'club' | 'game' | 'match' | 'result';

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
  return (
    <TickerProvider>
      {runtime.auth ? (
        <AuthGate auth={runtime.auth} api={runtime.api} />
      ) : (
        <CareerFlow api={runtime.api} />
      )}
    </TickerProvider>
  );
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
  const [products] = useState(() => productPortsFor(api));
  const [stage, setStage] = useState<Stage>('login');
  const [screen, setScreen] = useState<Screen>('central');
  const [limitNotice, setLimitNotice] = useState('');
  const [career, setCareer] = useState<CareerView | null>(null);
  const [email, setEmail] = useState('torcedor@footebas.com');
  const [matchUpdate, setMatchUpdate] = useState<MatchUpdate | null>(null);
  const [matchFeed, setMatchFeed] = useState<MatchUpdate[]>([]);
  const [error, setError] = useState('');
  const [commandState, setCommandState] = useState<
    'idle' | 'pending' | 'duplicate' | 'success'
  >('idle');
  // Blocks repeated taps of the same command while it is in flight; different
  // commands (e.g. skipping during the narrated feed) are never blocked.
  const inFlight = useRef(new Set<string>());
  // Set once CreateCareer succeeds, so retrying a failed SelectClub never
  // creates a second career.
  const createdCareer = useRef(false);
  const ticker = useTicker();
  const { play } = useSound();

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
      play('confirm');
      return result;
    } catch (caught) {
      setCommandState('idle');
      if (caught instanceof SessionExpiredError && onSessionExpired) {
        onSessionExpired();
        return undefined;
      }
      const message =
        caught instanceof Error ? caught.message : 'Tente novamente.';
      setError(message);
      ticker.announce(message, 'error');
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

  const startNewCareer = () => {
    setError('');
    setLimitNotice('');
    createdCareer.current = false;
    setStage('new');
  };

  const createCareer = (submission: NewCareerSubmission) =>
    attempt('create-career', async () => {
      if (!createdCareer.current) {
        try {
          await api.createCareer({
            coach: submission.coach,
            careerName: submission.careerName,
            coachProfile: submission.coachProfile,
          });
        } catch (caught) {
          // The plan refused another career: show it next to the list.
          if (!isCareerLimitError(caught)) throw caught;
          setLimitNotice(caught.message);
          setStage('load');
          return;
        }
        createdCareer.current = true;
      }
      await api.selectClub(submission.club);
      createdCareer.current = false;
      setCareer(await api.getCareer());
      setScreen('central');
      setStage('game');
    });

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
  // Free plan starts in Série C; the career list tells whether the license
  // lets this coach pick any club (docs/05 §5).
  const [anyClub, setAnyClub] = useState(true);
  const listCareers = useCallback(async () => {
    const list = await api.listCareers();
    setAnyClub(list.anyClub ?? true);
    return list;
  }, [api]);
  // After an inbox decision the board/finances may have moved.
  const refreshCareer = useCallback(() => {
    void api
      .getCareer()
      .then((view) => view && setCareer(view))
      .catch(() => undefined);
  }, [api]);
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
          loadCareers={listCareers}
          onContinue={(summary) => void openCareer(summary.id)}
          onNewCareer={startNewCareer}
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
          onNewCareer={startNewCareer}
          onBack={goStart}
          onSignOut={onSignOut}
        />
      </>
    );

  if (stage === 'new')
    return (
      <>
        <PwaRuntime />
        <NewCareerWizard
          anyClub={anyClub}
          initialCoach={session?.name ?? ''}
          pending={commandState === 'pending'}
          error={error}
          onCancel={goStart}
          onSubmit={(submission) => void createCareer(submission)}
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
          error={error}
          setEmail={setEmail}
          onLogin={() => void login()}
          {...(onSignOut ? { onSignOut } : {})}
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
            inbox={products.inbox}
            onInboxResolved={refreshCareer}
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
        ) : screen === 'squad' || screen === 'tactics' ? (
          <SquadScreen
            key={screen}
            career={career}
            api={api}
            onCareerChange={setCareer}
            reportError={setError}
            initialTab={screen === 'tactics' ? 'tactics' : 'board'}
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
          <SeasonScreen port={products.season} clubName={career.club} />
        ) : screen === 'ranking' ? (
          <RankingScreen port={products.ranking} />
        ) : screen === 'profile' ? (
          <ProfileScreen
            account={products.account}
            player={player}
            loadCareers={listCareers}
            onSignOut={onSignOut}
          />
        ) : screen === 'office' || screen === 'finance' ? (
          <OfficeScreen
            key={screen}
            career={career}
            api={api}
            onCareerChange={setCareer}
            reportError={setError}
            initialTab={screen === 'finance' ? 'finance' : 'proposals'}
          />
        ) : screen === 'stadium' ? (
          <ClubScreen
            career={career}
            api={api}
            onCareerChange={setCareer}
            reportError={setError}
            key={screen}
            initialTab="stadium"
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
        ) : (
          // history
          <WorldScreen
            career={career}
            api={api}
            onCareerChange={setCareer}
            reportError={setError}
            key={screen}
            initialTab="history"
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
  error: string;
  setEmail(value: string): void;
  onLogin(): void;
  onClub(value: string): void;
  onSignOut?: () => void;
}) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Brand />
          <p className="mt-3 text-sm font-semibold text-chalk drop-shadow-[0_1px_0_rgb(0_0_0/0.6)]">
            Sua carreira, sua história. A rodada cabe no intervalo.
          </p>
        </div>
        <Card>
          {props.stage === 'login' && props.signedIn ? (
            <>
              <CardHeader>
                <CardTitle className="font-display text-xs uppercase">
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
                <CardTitle className="font-display text-xs uppercase">
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
          ) : (
            <>
              <CardHeader>
                <Badge variant="secondary" className="w-fit">
                  Falta o clube
                </Badge>
                <CardTitle className="font-display text-xs uppercase">
                  Escolha seu desafio
                </CardTitle>
                <CardDescription>
                  Esta carreira ainda não tem clube. Comece com um elenco
                  brasileiro real.
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
          <CardTitle className="scoreboard-digits pt-3 text-center text-6xl font-bold sm:text-8xl">
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
            <p className="font-display text-sm font-bold uppercase">
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
            <CardTitle className="font-display text-sm uppercase">
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
                {Object.entries(TACTIC_LABEL.mentality).map(
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
            <CardTitle className="font-display text-sm uppercase">
              Narração
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol
              aria-label="Feed da partida"
              className="match-feed flex max-h-56 flex-col gap-3 overflow-y-auto"
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
          <CardTitle className="scoreboard-digits text-6xl font-bold">
            {result.score}
          </CardTitle>
          <CardDescription>{outcome.verdict}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-center">
          <div>
            <h2 className="font-display text-base font-bold uppercase">
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
        <CardTitle className="font-display text-base uppercase">
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
                  <TableCell className="font-display text-xs font-bold">
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
                  <TableCell className="text-right font-display text-xs font-bold">
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
