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
  FREE_CAREER_LIMIT,
  InMemoryCareerApi,
  LICENSE_CAREER_LIMIT,
  isCareerLimitError,
} from '@/lib/career-api';
import {
  CareerPaywall,
  type CareerPaywallReason,
} from '@/components/career-paywall';
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
import {
  SchematicPitch,
  useReducedMotion,
} from '@/components/match-replay-viewer';
import { MatchStage } from '@/components/match-stage/match-stage';
import {
  describeReplayEvent,
  type MatchReplayInput,
} from '@/lib/match-replay-model';
import { ClubEmblem } from '@/components/club-emblem';
import { TickerProvider, useTicker } from '@/components/retro/ticker';
import { stopSounds } from '@/lib/retro/sound';
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
  // Career-slot paywall (free save taken, or a career locked by a refund).
  const [paywall, setPaywall] = useState<CareerPaywallReason | null>(null);
  // Remounts the saves list after a purchase so locks are re-read.
  const [listVersion, setListVersion] = useState(0);
  // Last known plan usage, to open the paywall before the wizard.
  const plan = useRef<{ used: number; limit: number } | null>(null);
  // The career the coach was creating when the plan refused it.
  const pendingCareer = useRef<NewCareerSubmission | null>(null);
  // Free plan starts in Série C; the career list tells whether the license
  // lets this coach pick any club (docs/05 §5).
  const [anyClub, setAnyClub] = useState(true);
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

  const FREE_LIMIT_NOTICE = `O plano grátis permite ${String(FREE_CAREER_LIMIT)} carreira. Exclua a atual ou ative a licença para ter até ${String(LICENSE_CAREER_LIMIT)}.`;

  const openWizard = () => {
    setError('');
    setLimitNotice('');
    createdCareer.current = false;
    setStage('new');
  };

  const startNewCareer = () => {
    const known = plan.current;
    // The free save is already taken: say it next to the list and offer
    // the license right away instead of a wizard the server will refuse.
    if (
      known &&
      known.limit === FREE_CAREER_LIMIT &&
      known.used >= known.limit
    ) {
      setError('');
      setLimitNotice(FREE_LIMIT_NOTICE);
      setStage('load');
      setPaywall('limit');
      return;
    }
    openWizard();
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
          // The plan refused another career: show it next to the list and
          // open the paywall; paying resumes this very career.
          if (!isCareerLimitError(caught)) throw caught;
          pendingCareer.current = submission;
          setLimitNotice(caught.message);
          setStage('load');
          setPaywall('limit');
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

  /** Paid inside a paywall: entitlements change now, the flow continues. */
  const licensed = () => {
    const reason = paywall;
    setPaywall(null);
    setAnyClub(true);
    setLimitNotice('');
    plan.current = plan.current && {
      ...plan.current,
      limit: LICENSE_CAREER_LIMIT,
    };
    setListVersion((version) => version + 1);
    if (reason !== 'limit') return;
    const pending = pendingCareer.current;
    pendingCareer.current = null;
    // Resume the career the plan refused; without one, open the wizard.
    if (pending) void createCareer(pending);
    else openWizard();
  };

  const paywallSheet = paywall && (
    <CareerPaywall
      reason={paywall}
      account={products.account}
      onClose={() => setPaywall(null)}
      onLicensed={licensed}
    />
  );

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
  const listCareers = useCallback(async () => {
    const list = await api.listCareers();
    setAnyClub(list.anyClub ?? true);
    plan.current =
      list.limit === undefined
        ? null
        : { used: list.careers.length, limit: list.limit };
    return list;
  }, [api]);
  // After an inbox decision the board/finances may have moved.
  const refreshCareer = useCallback(() => {
    void api
      .getCareer()
      .then((view) => view && setCareer(view))
      .catch(() => undefined);
  }, [api]);
  // Opening the inbox page reads its messages (MarkInboxRead), so the
  // badge clears and stays cleared on any device.
  const unreadMail = career?.world.news
    .filter(({ unread }) => unread === true)
    .map(({ id }) => id)
    .join('|');
  useEffect(() => {
    if (stage !== 'game' || screen !== 'inbox' || !unreadMail) return;
    void products.inbox
      .markRead(unreadMail.split('|'))
      .then(refreshCareer)
      .catch(() => undefined);
  }, [stage, screen, unreadMail, products.inbox, refreshCareer]);
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
        {paywallSheet}
      </>
    );

  if (stage === 'load')
    return (
      <>
        <PwaRuntime />
        <LoadCareerScreen
          key={listVersion}
          load={listCareers}
          remove={removeCareer}
          notice={limitNotice}
          error={error}
          onOpen={(summary) => void openCareer(summary.id)}
          onUnlock={() => setPaywall('locked')}
          onNewCareer={startNewCareer}
          onBack={goStart}
          onSignOut={onSignOut}
        />
        {paywallSheet}
      </>
    );

  if (stage === 'new')
    return (
      <>
        <PwaRuntime />
        <NewCareerWizard
          anyClub={anyClub}
          account={products.account}
          avatarUrl={session?.avatarUrl}
          onLicensed={() => setAnyClub(true)}
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
        immersive={stage === 'match'}
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
            onReplan={setMatchUpdate}
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
        <div className="mb-8 flex flex-col items-center text-center">
          <Brand size="lg" />
          <p className="mt-3 text-sm font-semibold text-chalk drop-shadow-[0_1px_0_rgb(0_0_0/0.6)]">
            Sua carreira, sua história
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

/** Real time of one match minute and of one narrated play at 1× (decision 18). */
const LIVE_MINUTE_MS = 650;
const LIVE_EVENT_MS = 900;
const LIVE_SPEEDS: readonly MatchSpeed[] = [0.5, 1, 2, 4];

function liveStatistics(replay: MatchReplayInput | undefined, minute: number) {
  const empty = { shots: 0, xg: 0, cards: 0 };
  const totals = { home: { ...empty }, away: { ...empty } };
  for (const event of replay?.timeline ?? []) {
    if (event.minute > minute) break;
    if (event.type === 'chance') {
      totals[event.side].shots += 1;
      totals[event.side].xg += event.xg;
    } else if (event.type === 'card') totals[event.side].cards += 1;
  }
  return {
    possession: {
      home: replay?.finalStatistics.home.possession ?? 50,
      away: replay?.finalStatistics.away.possession ?? 50,
    },
    ...totals,
  };
}

function StatBar(props: {
  label: string;
  home: number;
  away: number;
  format?: (value: number) => string;
}) {
  const total = props.home + props.away;
  const share = total === 0 ? 50 : (props.home / total) * 100;
  const show = props.format ?? ((value: number) => String(value));
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 font-pixel">
        <span className="text-xl tabular-nums text-bulb sm:text-2xl">
          {show(props.home)}
        </span>
        <span className="truncate text-[.55rem] uppercase text-chalk/80">
          {props.label}
        </span>
        <span className="text-xl tabular-nums text-bulb sm:text-2xl">
          {show(props.away)}
        </span>
      </div>
      <div
        aria-label={`${props.label}: ${show(props.home)} a ${show(props.away)}`}
        className="mt-1 flex h-3 overflow-hidden border border-chalk/40 bg-board"
        role="img"
      >
        <span
          className="block h-full bg-primary"
          style={{ width: `${share}%` }}
        />
        <span className="block h-full flex-1 bg-destructive/80" />
      </div>
    </div>
  );
}

/**
 * Live match (decisions 18 and 19): big scoreboard with both emblems, the
 * narration line, then only the animated pitch driven by the feed clock. It
 * stops by itself only at half time and at the end; the manager may pause at
 * any minute to substitute or adjust, and the official timeline continues
 * from that minute (prefix-stable engine).
 */
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
  onReplan(value: MatchUpdate): void;
  reportError(value: string): void;
}) {
  const [speed, setSpeed] = useState<MatchSpeed>(1);
  const [manualPaused, setManualPaused] = useState(false);
  const [dismissedPauseId, setDismissedPauseId] = useState('');
  const [clock, setClock] = useState(props.update.minute);
  const [replay, setReplay] = useState(props.update.replay);
  const [outgoing, setOutgoing] = useState('');
  const [incoming, setIncoming] = useState('');
  const [liveMentality, setLiveMentality] = useState(
    props.career.tactics.mentality,
  );
  const reducedMotion = useReducedMotion(undefined);
  const { update } = props;
  if (update.replay !== undefined && update.replay !== replay)
    setReplay(update.replay);
  const starters = props.career.players.filter(
    (player) => player.role === 'starter',
  );
  const bench = props.career.players.filter(
    (player) =>
      player.role === 'bench' && !player.injuryRounds && !player.suspended,
  );
  const halfTimeStop = update.decisionPoint && dismissedPauseId !== update.id;
  const paused = manualPaused || halfTimeStop || update.done;
  // Pausing (by hand, at half time or at the end) cuts sounds in flight.
  useEffect(() => {
    if (paused) stopSounds();
  }, [paused]);
  const minute = Math.max(clock, update.minute);
  const advance = useEffectEvent(() => void props.onNext());
  // The final whistle stops the match and opens the summary (no 2D replay).
  const finish = useEffectEvent(() => props.onFinished());
  useEffect(() => {
    if (update.done) finish();
  }, [update.done]);

  // The clock walks minute by minute up to the next play, then reveals it.
  useEffect(() => {
    const target = update.nextMinute;
    if (paused || target === undefined) return;
    const timer =
      minute < target
        ? window.setTimeout(
            () => setClock(Math.min(target, minute + 1)),
            LIVE_MINUTE_MS / speed,
          )
        : window.setTimeout(advance, LIVE_EVENT_MS / speed);
    return () => window.clearTimeout(timer);
  }, [minute, paused, speed, update]);

  const perform = async (action: () => Promise<MatchUpdate>) => {
    try {
      props.reportError('');
      const next = await action();
      if (next.replay !== undefined) setReplay(next.replay);
      props.onReplan(next);
    } catch (caught) {
      props.reportError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível aplicar a mudança.',
      );
    }
  };

  const home = replay?.home.name ?? props.career.club;
  const away = replay?.away.name ?? props.career.opponent.club;
  const stats = liveStatistics(replay, update.minute);
  const status = update.done
    ? 'Fim de jogo'
    : halfTimeStop
      ? 'Intervalo'
      : paused
        ? `Pausado · ${String(minute)}'`
        : `Ao vivo · ${String(minute)}'`;

  return (
    <div
      className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-3 overflow-x-clip"
      data-testid="live-match"
    >
      <section
        aria-label="Placar ao vivo"
        className="panel-board min-w-0 px-3 py-3"
      >
        <div className="flex items-center justify-between gap-2">
          <Badge>{status}</Badge>
          <span className="font-pixel text-[.55rem] text-chalk/80">
            {update.progress}%
          </span>
        </div>
        <p
          aria-label={`${home} ${update.score.replace('×', 'a')} ${away}`}
          className="scoreboard-digits mt-2 whitespace-nowrap text-center text-[clamp(2rem,12vw,6rem)] leading-none text-bulb"
          data-testid="live-scoreboard"
        >
          {update.score}
        </p>
        <div
          className="mt-3 grid min-w-0 grid-cols-2 gap-3"
          data-testid="live-teams"
        >
          {[home, away].map((club) => (
            <div
              key={club}
              className="flex min-w-0 flex-col items-center gap-1 text-center"
            >
              <ClubEmblem name={club} size={64} decorative />
              <span className="w-full truncate font-pixel text-[.55rem] text-chalk">
                {club}
              </span>
            </div>
          ))}
        </div>
        <p
          aria-live="polite"
          aria-atomic="true"
          className="mt-3 min-h-[3.25rem] text-balance border-t border-chalk/20 pt-2 text-center text-sm font-medium text-chalk"
          data-testid="live-narration"
        >
          {update.message}
        </p>
      </section>

      <div className="w-full min-w-0 max-w-full" data-testid="live-pitch">
        {replay && !update.done ? (
          <MatchStage
            bare
            fallback={
              <SchematicPitch
                caption={false}
                match={replay}
                minute={minute}
                reducedMotion={reducedMotion}
              />
            }
            match={replay}
            minute={minute}
            playing={!paused}
            reducedMotion={reducedMotion}
            speed={speed}
          />
        ) : null}
      </div>

      <div
        className="flex min-w-0 flex-wrap items-center gap-2"
        data-testid="live-controls"
      >
        {!update.done && (
          <>
            <Button
              size="sm"
              variant="outline"
              aria-label={paused ? 'Retomar partida' : 'Pausar partida'}
              onClick={() => {
                if (halfTimeStop) setDismissedPauseId(update.id);
                setManualPaused(halfTimeStop ? false : !manualPaused);
              }}
            >
              {paused ? <Play /> : <Pause />}
            </Button>
            <ToggleGroup
              aria-label="Velocidade da partida"
              type="single"
              value={String(speed)}
              onValueChange={(value) =>
                value && setSpeed(Number(value) as MatchSpeed)
              }
            >
              {LIVE_SPEEDS.map((value) => (
                <ToggleGroupItem
                  key={value}
                  value={String(value)}
                  aria-label={`Velocidade ${String(value).replace('.', ',')} vezes`}
                >
                  {String(value).replace('.', ',')}×
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </>
        )}
        {update.done ? (
          <Button className="min-h-12 w-full" onClick={props.onFinished}>
            Ver resumo da partida
            <Trophy data-icon="inline-end" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            onClick={props.onSkip}
          >
            Pular para o resultado
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </div>

      {halfTimeStop && (
        <div className="panel min-w-0 p-3 text-center" role="status">
          <p className="text-sm font-medium">
            Intervalo. Faça substituições e ajustes ou siga para o segundo
            tempo.
          </p>
          <Button
            size="sm"
            className="mt-2"
            onClick={() => {
              setDismissedPauseId(update.id);
              setManualPaused(false);
            }}
          >
            Começar o segundo tempo
            <Play data-icon="inline-end" />
          </Button>
        </div>
      )}

      {paused && !update.done && (
        <Card className="min-w-0" data-testid="live-interventions">
          <CardHeader>
            <CardTitle className="font-display text-sm uppercase">
              Ajustes aos {minute}&apos;
            </CardTitle>
            <CardDescription>
              O que já aconteceu não muda; a mudança vale a partir daqui.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="outgoing">Sai</FieldLabel>
                <select
                  id="outgoing"
                  className="min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm"
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
                  className="min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm"
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
              onClick={() =>
                perform(async () => {
                  const next = await props.api.makeSubstitution({
                    outgoingId: outgoing,
                    incomingId: incoming,
                    minute,
                  });
                  setOutgoing('');
                  setIncoming('');
                  return next;
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
                className="min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm"
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
              onClick={() =>
                perform(async () => {
                  const next = await props.api.changeMatchTactics(
                    { mentality: liveMentality },
                    minute,
                  );
                  const career = await props.api.getCareer();
                  if (career) props.onCareerChange(career);
                  return next;
                })
              }
            >
              <Strategy data-icon="inline-start" />
              Aplicar ajuste
            </Button>
          </CardContent>
        </Card>
      )}

      <section
        aria-label="Estatísticas da partida"
        className="panel-board grid min-w-0 gap-4 p-4"
        data-testid="live-stats"
      >
        <StatBar
          label="Posse"
          home={stats.possession.home}
          away={stats.possession.away}
          format={(value) => `${String(Math.round(value))}%`}
        />
        <StatBar
          label="Finalizações"
          home={stats.home.shots}
          away={stats.away.shots}
        />
        <StatBar
          label="xG"
          home={stats.home.xg}
          away={stats.away.xg}
          format={(value) => value.toFixed(1)}
        />
        <StatBar
          label="Cartões"
          home={stats.home.cards}
          away={stats.away.cards}
        />
      </section>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="font-display text-sm uppercase">
            Lance a lance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol
            aria-label="Feed da partida"
            className="match-feed flex max-h-72 flex-col gap-3 overflow-y-auto"
            data-testid="live-feed"
          >
            {props.feed
              .slice()
              .reverse()
              .map((event) => (
                <li
                  key={event.id}
                  className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2 text-sm"
                >
                  <strong className="font-display text-primary">
                    {event.minute}&apos;
                  </strong>
                  <span className="min-w-0 break-words">{event.message}</span>
                </li>
              ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

/** Timeline entries worth a line in the summary (no chances or tactics). */
const SUMMARY_EVENTS = new Set(['goal', 'card', 'injury', 'substitution']);

/**
 * End of the match: the match stops, the big scoreboard stays on top with the
 * next-round button, and a short summary follows. No 2D replay here.
 */
function Result({
  career,
  onContinue,
}: {
  career: CareerView;
  onContinue(): void;
}) {
  const result = career.lastResult;
  const next = (
    <Button className="min-h-12 w-full" onClick={onContinue}>
      Preparar próxima rodada
      <ArrowRight data-icon="inline-end" />
    </Button>
  );
  if (!result) return <div className="mx-auto max-w-2xl">{next}</div>;
  const { replay } = result;
  const score = parseScore(result.score);
  const side = replay?.away.name === career.club ? 'away' : 'home';
  const own = side === 'home' ? score.home : score.away;
  const rival = side === 'home' ? score.away : score.home;
  const outcome =
    own > rival
      ? { verdict: `${career.club} venceu`, summary: '+3 pontos' }
      : own === rival
        ? { verdict: 'Empate', summary: '+1 ponto' }
        : { verdict: `${career.club} perdeu`, summary: 'sem pontos' };
  const stats = replay ? liveStatistics(replay, Infinity) : undefined;
  const moments =
    replay?.timeline.filter((event) => SUMMARY_EVENTS.has(event.type)) ?? [];
  return (
    <div
      className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-3 overflow-x-clip"
      data-testid="match-result"
    >
      <section
        aria-label="Placar final"
        className="panel-board min-w-0 px-3 py-3"
      >
        <div className="flex items-center justify-between gap-2">
          <Badge>Fim de jogo</Badge>
          <span className="font-pixel text-[.55rem] text-chalk/80">
            {outcome.summary}
          </span>
        </div>
        <p
          className="scoreboard-digits mt-2 whitespace-nowrap text-center text-[clamp(2rem,12vw,6rem)] leading-none text-bulb"
          data-testid="final-scoreboard"
        >
          {result.score}
        </p>
        {replay && (
          <div className="mt-3 grid min-w-0 grid-cols-2 gap-3">
            {[replay.home.name, replay.away.name].map((club) => (
              <div
                key={club}
                className="flex min-w-0 flex-col items-center gap-1 text-center"
              >
                <ClubEmblem name={club} size={64} decorative />
                <span className="w-full truncate font-pixel text-[.55rem] text-chalk">
                  {club}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 border-t border-chalk/20 pt-2 text-center text-sm font-medium text-chalk">
          {outcome.verdict}
        </p>
      </section>

      {next}

      <Card className="min-w-0" data-testid="match-summary">
        <CardHeader>
          <CardTitle className="font-display text-sm uppercase">
            Resumo da partida
          </CardTitle>
          <CardDescription>{result.headline}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {stats && (
            <div className="panel-board grid min-w-0 gap-4 p-4">
              <StatBar
                label="Posse"
                home={stats.possession.home}
                away={stats.possession.away}
                format={(value) => `${String(Math.round(value))}%`}
              />
              <StatBar
                label="Finalizações"
                home={stats.home.shots}
                away={stats.away.shots}
              />
              <StatBar
                label="Cartões"
                home={stats.home.cards}
                away={stats.away.cards}
              />
            </div>
          )}
          {replay && moments.length > 0 && (
            <ol
              aria-label="Principais lances"
              className="flex flex-col gap-2 text-sm"
            >
              {moments.map((event, index) => (
                <li
                  key={`${event.minute}-${event.type}-${index}`}
                  className="min-w-0 break-words"
                >
                  {describeReplayEvent(replay, event)}
                </li>
              ))}
            </ol>
          )}
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
      </Card>
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
