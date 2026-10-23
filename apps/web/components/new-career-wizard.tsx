'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Globe,
  Lock,
  MapPin,
  Play,
  SignOut,
  Star,
  Trash,
  UploadSimple,
  WarningCircle,
  UserCircle,
} from '@phosphor-icons/react';
import { Brand } from '@/components/brand';
import { ClubEmblem } from '@/components/club-emblem';
import { CoachAvatar, avatarNumber } from '@/components/coach-avatar';
import { LicenseUpsell } from '@/components/license-checkout';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/retro/bottom-sheet';
import { MuteButton } from '@/components/retro/mute-button';
import { ScreenTransition } from '@/components/retro/screen-transition';
import { PixelStar } from '@/components/retro/sprites';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  avatarFileError,
  createFakeAccountPort,
  type AccountPort,
} from '@/lib/account-product';
import {
  POSITION_GROUP_LABEL,
  clubPreviews,
  DIVISION_LABEL,
  FREE_PLAN_DIVISION,
  type ClubDivision,
  positionLabel,
  type ClubPreview,
} from '@/lib/club-preview';
import {
  CAREER_NAME_MAX,
  COACH_AVATARS,
  COACH_PERSONALITY_GUIDE,
  careerNameError,
  coachNameError,
  countryName,
  defaultCareerName,
  flagEmoji,
  isAvatarUrl,
  personalityLabel,
  searchCountries,
  type CoachAvatarRef,
  type CoachPersonality,
  type CoachProfile,
} from '@/lib/coach-profile';
import { useSound } from '@/lib/retro/use-sound';
import { cn } from '@/lib/utils';

/** Hydration-safe "is on the client" flag with no setState in effects. */
const subscribeNothing = () => () => {};

export interface NewCareerSubmission {
  readonly club: string;
  readonly coach: string;
  readonly careerName: string;
  readonly coachProfile: CoachProfile;
}

const STEPS = [
  { id: 'mode', label: 'Modo', title: 'Como você quer jogar?' },
  { id: 'universe', label: 'Universo', title: 'Onde vai ser a sua carreira?' },
  { id: 'club', label: 'Clube', title: 'Escolha seu clube' },
  { id: 'coach', label: 'Treinador', title: 'Quem é o treinador?' },
  {
    id: 'personality',
    label: 'Estilo',
    title: 'Qual é o estilo do treinador?',
  },
  { id: 'name', label: 'Carreira', title: 'Dê um nome à carreira' },
] as const;

type Errors = Partial<
  Record<'club' | 'coachName' | 'personality' | 'careerName', string>
>;

/**
 * Nova Carreira em seis etapas (docs/09): modo → universo → clube →
 * treinador → estilo → nome. Nothing is sent until the last step. The club
 * step has no fixed bar: each club opens a sheet whose CTA advances.
 */
export function NewCareerWizard({
  clubs = clubPreviews(),
  anyClub = true,
  account,
  avatarUrl,
  initialCoach = '',
  pending = false,
  error = '',
  pollMs = 4000,
  now = () => new Date(),
  onCancel,
  onSubmit,
  onSignOut,
  onLicensed,
}: {
  clubs?: readonly ClubPreview[];
  /** License: any club; free plan only Série C (docs/05 §5). */
  anyClub?: boolean;
  /** Billing and avatar upload; the offline fake when absent. */
  account?: AccountPort;
  /** Google picture of the signed-in user: preselected avatar. */
  avatarUrl?: string | undefined;
  initialCoach?: string;
  pending?: boolean;
  /** Refusal from the server (shown on the last step). */
  error?: string;
  pollMs?: number;
  now?: () => Date;
  onCancel(): void;
  onSubmit(submission: NewCareerSubmission): void;
  onSignOut?: (() => void) | undefined;
  /** The license was paid inside the wizard. */
  onLicensed?: (() => void) | undefined;
}) {
  const [fallbackAccount] = useState(() => createFakeAccountPort());
  const port = account ?? fallbackAccount;
  const [step, setStep] = useState(0);
  const [club, setClub] = useState('');
  const [licensed, setLicensed] = useState(false);
  const [coach, setCoach] = useState(initialCoach);
  const [nationality, setNationality] = useState('BR');
  const [avatar, setAvatar] = useState<CoachAvatarRef>(
    avatarUrl && isAvatarUrl(avatarUrl) ? avatarUrl : 'avatar-01',
  );
  const [personality, setPersonality] = useState<CoachPersonality | ''>('');
  const [careerName, setCareerName] = useState('');
  const [careerNameTouched, setCareerNameTouched] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const formId = useId();
  // Fixed bars and sheets are portaled to <body>: the screen transition
  // animates `transform`, which would turn `position: fixed` into relative.
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const { play } = useSound();
  const canPickAny = anyClub || licensed;

  useEffect(() => {
    // Moves focus to the new step title; skipped on the first render.
    if (moved.current) heading.current?.focus();
  }, [step]);

  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;

  const validate = (): Errors => {
    if (current.id === 'club')
      return club ? {} : { club: 'Escolha um clube para continuar.' };
    if (current.id === 'coach') {
      const nameError = coachNameError(coach);
      return nameError ? { coachName: nameError } : {};
    }
    if (current.id === 'personality')
      return personality
        ? {}
        : { personality: 'Escolha a personalidade do treinador.' };
    if (current.id === 'name') {
      const nameError = careerNameError(careerName);
      return nameError ? { careerName: nameError } : {};
    }
    return {};
  };

  const goTo = (target: number) => {
    moved.current = true;
    setErrors({});
    setStep(target);
  };

  const advance = () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      play('error');
      return;
    }
    if (!last) {
      play('click');
      if (STEPS[step + 1]!.id === 'name' && !careerNameTouched)
        setCareerName(defaultCareerName(coach));
      goTo(step + 1);
      return;
    }
    play('whistle');
    onSubmit({
      club,
      coach: coach.trim(),
      careerName: careerName.trim(),
      coachProfile: {
        nationality,
        avatar,
        personality: personality as CoachPersonality,
      },
    });
  };

  const back = () => (step === 0 ? onCancel() : goTo(step - 1));
  const clubStep = current.id === 'club';

  return (
    <main
      className={cn(
        'min-h-dvh min-w-0 overflow-x-hidden px-4 pt-4 sm:px-6',
        clubStep ? 'pb-10' : 'pb-40',
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <Brand />
        <div className="flex items-center gap-2">
          <MuteButton />
          {onSignOut && (
            <Button variant="outline" className="min-h-10" onClick={onSignOut}>
              <SignOut data-icon="inline-start" />
              Sair
            </Button>
          )}
        </div>
      </div>
      <ScreenTransition
        id={`nova-carreira-${current.id}`}
        className="mx-auto mt-6 grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]"
      >
        <nav aria-label="Etapas da nova carreira" className="hidden lg:block">
          <ol className="grid gap-2">
            {STEPS.map((item, index) => (
              <li
                key={item.id}
                aria-current={index === step ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 font-pixel text-[.6rem]',
                  index === step ? 'panel text-ink' : 'text-chalk/80',
                )}
              >
                <span
                  className={cn(
                    'grid size-7 place-items-center border-2 border-ink text-[.6rem]',
                    index < step
                      ? 'bg-primary text-primary-foreground'
                      : index === step
                        ? 'bg-bulb text-bulb-foreground'
                        : 'bg-chalk text-ink',
                  )}
                  aria-hidden="true"
                >
                  {index < step ? <CheckCircle weight="bold" /> : index + 1}
                </span>
                {item.label}
              </li>
            ))}
          </ol>
        </nav>

        <section
          aria-labelledby="nova-carreira-titulo"
          className="panel grid min-w-0 gap-5 p-4 sm:p-6"
        >
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3 font-pixel text-[.55rem] text-muted-foreground">
              <span>
                Nova carreira · {step + 1} de {STEPS.length}
              </span>
              <span>{current.label}</span>
            </div>
            <Progress
              value={((step + 1) / STEPS.length) * 100}
              aria-label={`Etapa ${step + 1} de ${STEPS.length}: ${current.label}`}
            />
          </div>
          <div className="flex items-start gap-3">
            {clubStep && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Voltar"
                className="size-11 shrink-0"
                onClick={back}
              >
                <ArrowLeft weight="bold" aria-hidden="true" />
              </Button>
            )}
            <h1
              id="nova-carreira-titulo"
              ref={heading}
              tabIndex={-1}
              className="min-w-0 font-pixel text-sm leading-relaxed break-words sm:text-lg"
            >
              {current.title}
            </h1>
          </div>

          <form
            id={formId}
            noValidate
            className="grid min-w-0 gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!pending && !clubStep) advance();
            }}
          >
            {current.id === 'mode' && <ModeStep />}
            {current.id === 'universe' && <UniverseStep />}
            {clubStep && (
              <ClubStep
                clubs={clubs}
                anyClub={canPickAny}
                account={port}
                pollMs={pollMs}
                now={now}
                value={club}
                error={errors.club}
                onLicensed={() => {
                  setLicensed(true);
                  onLicensed?.();
                }}
                onChoose={(value) => {
                  setClub(value);
                  setErrors((found) => ({ ...found, club: '' }));
                  play('click');
                  goTo(step + 1);
                }}
              />
            )}
            {current.id === 'coach' && (
              <CoachStep
                coach={coach}
                nationality={nationality}
                avatar={avatar}
                account={port}
                errors={errors}
                setCoach={setCoach}
                setNationality={setNationality}
                setAvatar={setAvatar}
              />
            )}
            {current.id === 'personality' && (
              <PersonalityStep
                value={personality}
                error={errors.personality}
                onChange={(value) => {
                  setPersonality(value);
                  setErrors((found) => ({ ...found, personality: '' }));
                }}
              />
            )}
            {current.id === 'name' && (
              <NameStep
                value={careerName}
                error={errors.careerName}
                onChange={(value) => {
                  setCareerName(value);
                  setCareerNameTouched(true);
                }}
                summary={{
                  club,
                  coach: coach.trim(),
                  nationality,
                  avatar,
                  personality: personality || 'estrategista',
                }}
              />
            )}

            {error && last && (
              <p
                role="alert"
                className="flex items-start gap-2 border-2 border-destructive bg-popover px-3 py-2 text-sm"
              >
                <WarningCircle
                  className="mt-0.5 shrink-0 text-destructive"
                  weight="fill"
                  aria-hidden="true"
                />
                {error}
              </p>
            )}

            {!clubStep &&
              mounted &&
              createPortal(
                <div
                  data-testid="wizard-footer"
                  className="fixed inset-x-0 bottom-0 z-30 border-t-4 border-ink bg-card px-4 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))] text-card-foreground"
                >
                  <div className="mx-auto flex w-full max-w-xs flex-col items-stretch gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 whitespace-normal"
                      onClick={back}
                    >
                      <ArrowLeft data-icon="inline-start" />
                      {step === 0 ? 'Voltar ao início' : 'Voltar'}
                    </Button>
                    {last ? (
                      <Button
                        type="submit"
                        form={formId}
                        variant="coral"
                        className="min-h-12 whitespace-normal px-6 text-base font-extrabold"
                        disabled={pending}
                      >
                        <Play data-icon="inline-start" weight="fill" />
                        {pending ? 'Criando carreira…' : 'Começar carreira'}
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        form={formId}
                        className="min-h-12 whitespace-normal px-6 text-base"
                      >
                        Continuar
                        <ArrowRight data-icon="inline-end" />
                      </Button>
                    )}
                  </div>
                </div>,
                document.body,
              )}
          </form>
        </section>
      </ScreenTransition>
    </main>
  );
}

function OptionCard({
  name,
  value,
  checked,
  disabled = false,
  onChange,
  children,
  className,
  describedBy,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  onChange?(input: HTMLInputElement): void;
  children: React.ReactNode;
  className?: string;
  describedBy?: string;
}) {
  return (
    <label
      className={cn(
        'panel relative grid min-w-0 cursor-pointer gap-1 p-4 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
        checked && 'outline outline-4 outline-bulb',
        disabled && 'cursor-not-allowed bg-muted opacity-80',
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.currentTarget)}
        className="sr-only"
        {...(describedBy ? { 'aria-describedby': describedBy } : {})}
      />
      {checked && (
        <CheckCircle
          weight="fill"
          aria-hidden="true"
          className="absolute right-3 top-3 size-5 text-primary"
        />
      )}
      {checked && <PixelStar size={14} className="absolute -left-2 -top-2" />}
      {children}
    </label>
  );
}

function ModeStep() {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-2 text-sm text-muted-foreground">
        O Footebas começa pela carreira de treinador: você monta o time,
        conversa com a diretoria e decide cada rodada.
      </legend>
      <OptionCard name="modo" value="treinador" checked>
        <span className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
            <UserCircle
              weight="duotone"
              className="size-6"
              aria-hidden="true"
            />
          </span>
          <span className="min-w-0">
            <strong className="block text-lg">Modo treinador</strong>
            <span className="text-sm text-muted-foreground">
              Escalação, táticas, mercado e a pressão da torcida.
            </span>
          </span>
        </span>
      </OptionCard>
    </fieldset>
  );
}

function UniverseStep() {
  const soonId = useId();
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="mb-2 text-sm text-muted-foreground">
        O universo define quais competições e clubes entram no jogo.
      </legend>
      <OptionCard name="universo" value="brasil" checked>
        <span className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
            <MapPin weight="duotone" className="size-6" aria-hidden="true" />
          </span>
          <strong className="text-lg">Só Brasil</strong>
        </span>
        <span className="text-sm text-muted-foreground">
          Séries A, B e C, estaduais, Copa do Brasil e Libertadores.
        </span>
      </OptionCard>
      <OptionCard
        name="universo"
        value="continente"
        checked={false}
        disabled
        describedBy={soonId}
      >
        <span className="flex flex-wrap items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Globe weight="duotone" className="size-6" aria-hidden="true" />
          </span>
          <strong className="text-lg">Continente inteiro</strong>
          <Badge variant="coral" className="ml-auto shrink-0 whitespace-nowrap">
            <Lock className="mr-1 size-3" aria-hidden="true" />
            Em breve
          </Badge>
        </span>
        <span id={soonId} className="text-sm text-muted-foreground">
          Em breve: ligas de toda a América do Sul. Por enquanto, bloqueado.
        </span>
      </OptionCard>
    </fieldset>
  );
}

const DIVISIONS: readonly ClubDivision[] = ['serie-a', 'serie-b', 'serie-c'];

function ClubStep({
  clubs,
  anyClub,
  account,
  pollMs,
  now,
  value,
  error,
  onLicensed,
  onChoose,
}: {
  clubs: readonly ClubPreview[];
  anyClub: boolean;
  account: AccountPort;
  pollMs: number;
  now(): Date;
  value: string;
  error: string | undefined;
  onLicensed(): void;
  onChoose(value: string): void;
}) {
  const errorId = useId();
  const lockId = useId();
  const searchId = useId();
  const selected = clubs.find((item) => item.name === value);
  const [division, setDivision] = useState<ClubDivision>(
    selected?.division ?? (anyClub ? 'serie-a' : FREE_PLAN_DIVISION),
  );
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<ClubPreview | null>(null);
  const normalize = (text: string) =>
    text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const visible = useMemo(() => {
    const needle = normalize(query.trim());
    return clubs.filter((item) =>
      needle
        ? normalize(`${item.name} ${item.note}`).includes(needle)
        : item.division === division,
    );
  }, [clubs, division, query]);
  const locked = (item: ClubPreview) =>
    !anyClub && item.division !== FREE_PLAN_DIVISION;
  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid gap-3">
        <div
          role="group"
          aria-label="Série"
          className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2"
        >
          {DIVISIONS.map((item) => {
            const count = clubs.filter((club) => club.division === item).length;
            return (
              <Button
                key={item}
                type="button"
                variant={division === item && !query ? 'default' : 'outline'}
                aria-pressed={division === item && !query}
                className="min-h-11 min-w-0 px-2"
                onClick={() => {
                  setQuery('');
                  setDivision(item);
                }}
              >
                {DIVISION_LABEL[item]}
                <span className="sr-only"> ({count} clubes)</span>
              </Button>
            );
          })}
        </div>
        <label htmlFor={searchId} className="sr-only">
          Buscar clube
        </label>
        <Input
          id={searchId}
          type="search"
          value={query}
          placeholder="Buscar clube ou cidade"
          onChange={(event) => setQuery(event.target.value)}
        />
        {!anyClub && (
          <p id={lockId} className="text-sm text-muted-foreground">
            No plano grátis a carreira começa de baixo, na Série C. Com a
            licença você escolhe qualquer clube.
          </p>
        )}
      </div>
      <fieldset
        data-testid="club-grid"
        className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))]"
        {...(error ? { 'aria-describedby': errorId } : {})}
      >
        <legend className="mb-2 text-sm text-muted-foreground">
          {query
            ? `${visible.length} clube(s) encontrado(s)`
            : `${DIVISION_LABEL[division]}: ${visible.length} clubes`}
        </legend>
        {visible.map((item) => {
          const blocked = locked(item);
          return (
            <OptionCard
              key={item.id}
              name="clube"
              value={item.name}
              checked={value === item.name}
              {...(blocked ? { describedBy: lockId } : {})}
              onChange={(input) => {
                input.focus();
                setPreview(item);
              }}
              className="min-w-0 overflow-hidden p-3 text-center"
            >
              <span className="flex min-w-0 flex-col items-center gap-2 pt-1">
                <ClubEmblem
                  name={item.name}
                  id={item.id}
                  size={56}
                  decorative
                />
                <strong className="block w-full min-w-0 font-pixel text-[.55rem] leading-relaxed break-words [overflow-wrap:anywhere]">
                  {item.name}
                </strong>
              </span>
              <span className="block min-w-0 truncate text-xs text-muted-foreground">
                {item.note}
              </span>
              <span className="mx-auto mt-1 flex max-w-full flex-wrap items-center justify-center gap-x-1.5 bg-board px-2 py-1 font-pixel text-[.5rem] text-chalk">
                <span className="sr-only">Força </span>
                <span className="led text-sm" aria-hidden="true">
                  {item.strength}
                </span>
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap">
                  <span className="sr-only">{item.strength} · </span>
                  {item.squadSize} atletas
                </span>
              </span>
              {blocked && (
                <span className="mx-auto mt-1 bg-bulb px-2 py-0.5 font-pixel text-[.5rem] text-bulb-foreground">
                  Licença
                </span>
              )}
            </OptionCard>
          );
        })}
      </fieldset>
      {error && <FieldError id={errorId} message={error} />}
      {preview && (
        <ClubSheet
          club={preview}
          locked={locked(preview)}
          account={account}
          pollMs={pollMs}
          now={now}
          onClose={() => setPreview(null)}
          onChoose={() => {
            const name = preview.name;
            setPreview(null);
            onChoose(name);
          }}
          onLicensed={onLicensed}
          onPickFree={() => {
            setPreview(null);
            setQuery('');
            setDivision(FREE_PLAN_DIVISION);
          }}
        />
      )}
    </div>
  );
}

/**
 * Squad sheet for a tapped club. Free clubs get "Escolher este clube";
 * locked ones turn the footer into the license upsell (docs/05 §5).
 */
function ClubSheet({
  club,
  locked,
  account,
  pollMs,
  now,
  onClose,
  onChoose,
  onLicensed,
  onPickFree,
}: {
  club: ClubPreview;
  locked: boolean;
  account: AccountPort;
  pollMs: number;
  now(): Date;
  onClose(): void;
  onChoose(): void;
  onLicensed(): void;
  onPickFree(): void;
}) {
  const [upsell, setUpsell] = useState(false);
  const [paid, setPaid] = useState(false);
  const unlocked = !locked || paid;
  return (
    <BottomSheet
      testId="club-sheet"
      title={
        <span className="flex min-w-0 items-center gap-2">
          <ClubEmblem name={club.name} id={club.id} size={28} decorative />
          <span className="min-w-0 break-words">Elenco do {club.name}</span>
        </span>
      }
      onClose={onClose}
      footer={
        upsell ? undefined : unlocked ? (
          <>
            <Button
              type="button"
              variant="play"
              className="min-h-12 w-full whitespace-normal"
              onClick={onChoose}
            >
              <CheckCircle data-icon="inline-start" weight="fill" />
              Escolher este clube
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              onClick={onClose}
            >
              Voltar
            </Button>
          </>
        ) : (
          <>
            <p className="flex items-start gap-2 text-xs text-chalk/80">
              <Lock
                className="mt-0.5 size-4 shrink-0 text-bulb"
                weight="fill"
                aria-hidden
              />
              Este clube entra só com a licença. No plano grátis a carreira
              começa na Série C.
            </p>
            <Button
              type="button"
              variant="play"
              className="min-h-12 w-full whitespace-normal"
              onClick={() => setUpsell(true)}
            >
              <PixelStar size={16} />
              Assinar licença
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full whitespace-normal"
              onClick={onPickFree}
            >
              Escolher um clube da Série C
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full"
              onClick={onClose}
            >
              Voltar
            </Button>
          </>
        )
      }
    >
      {upsell ? (
        <LicenseUpsell
          account={account}
          clubName={club.name}
          pollMs={pollMs}
          now={now}
          onPaid={() => {
            setPaid(true);
            onLicensed();
          }}
          onDone={onChoose}
          onBack={() => setUpsell(false)}
        />
      ) : (
        <SquadPreview club={club} />
      )}
    </BottomSheet>
  );
}

function SquadPreview({ club }: { club: ClubPreview }) {
  return (
    <section
      aria-labelledby="elenco-previa"
      className="grid min-w-0 gap-3 py-2"
    >
      <h3 id="elenco-previa" className="sr-only">
        Elenco do {club.name}
      </h3>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-chalk/80">
        <span>{club.note}</span>
        <span className="font-pixel text-[.5rem]">
          Força <span className="led text-sm">{club.strength}</span>
        </span>
        <span>{club.squadSize} atletas</span>
      </p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
        {club.groups.map((group) => (
          <div key={group.group} className="grid min-w-0 gap-1">
            <h4 className="flex items-baseline justify-between font-pixel text-[.5rem] text-chalk/70">
              {POSITION_GROUP_LABEL[group.group]}
              <span>{group.count}</span>
            </h4>
            <ul className="grid min-w-0 gap-1">
              {group.highlights.map((player) => (
                <li
                  key={player.name}
                  className="flex min-w-0 items-center justify-between gap-2 border-b border-wood-deep px-1 py-1.5 text-sm"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="w-9 shrink-0 font-pixel text-[.5rem] text-chalk/70">
                      {positionLabel(player.position)}
                    </span>
                    <span className="min-w-0 truncate font-semibold">
                      {player.name}
                    </span>
                    {player.level && (
                      <Badge
                        variant={
                          player.level === 'craque' ? 'coral' : 'secondary'
                        }
                        className="shrink-0"
                      >
                        <Star
                          weight="fill"
                          className="mr-1 size-3"
                          aria-hidden="true"
                        />
                        {player.level === 'craque' ? 'Craque' : 'Destaque'}
                      </Badge>
                    )}
                  </span>
                  <span className="led shrink-0 text-xs">
                    <span className="sr-only">Força </span>
                    {player.strength}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function CoachStep({
  coach,
  nationality,
  avatar,
  account,
  errors,
  setCoach,
  setNationality,
  setAvatar,
}: {
  coach: string;
  nationality: string;
  avatar: CoachAvatarRef;
  account: AccountPort;
  errors: Errors;
  setCoach(value: string): void;
  setNationality(value: string): void;
  setAvatar(value: CoachAvatarRef): void;
}) {
  const nameId = useId();
  const nameError = useId();
  return (
    <div className="grid min-w-0 gap-6">
      <div className="grid gap-2">
        <label htmlFor={nameId} className="text-sm font-bold">
          Nome do treinador
        </label>
        <Input
          id={nameId}
          value={coach}
          autoComplete="name"
          aria-invalid={errors.coachName ? true : undefined}
          {...(errors.coachName ? { 'aria-describedby': nameError } : {})}
          onChange={(event) => setCoach(event.target.value)}
        />
        {errors.coachName && (
          <FieldError id={nameError} message={errors.coachName} />
        )}
      </div>

      <NationalityPicker value={nationality} onChange={setNationality} />

      <AvatarPicker value={avatar} account={account} onChange={setAvatar} />
    </div>
  );
}

function AvatarPicker({
  value,
  account,
  onChange,
}: {
  value: CoachAvatarRef;
  account: AccountPort;
  onChange(value: CoachAvatarRef): void;
}) {
  const fileId = useId();
  const statusId = useId();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const custom = isAvatarUrl(value);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const problem = avatarFileError(file);
    if (problem) {
      setMessage(problem);
      return;
    }
    setMessage('');
    setUploading(true);
    try {
      const { url } = await account.uploadAvatar(file);
      onChange(url as CoachAvatarRef);
      setMessage('Imagem enviada.');
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível enviar a imagem.',
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <fieldset className="grid min-w-0 gap-3">
      <legend className="mb-1 text-sm font-bold">Avatar</legend>
      <div className="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-2 sm:grid-cols-[repeat(6,minmax(0,1fr))]">
        {COACH_AVATARS.map((id) => (
          <label
            key={id}
            className={cn(
              'relative grid min-w-0 cursor-pointer place-items-center bg-chalk-deep p-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
              value === id && 'outline outline-4 outline-bulb',
            )}
          >
            <input
              type="radio"
              name="avatar"
              value={id}
              checked={value === id}
              onChange={() => onChange(id)}
              className="sr-only"
            />
            <span className="sr-only">Avatar {avatarNumber(id)}</span>
            <CoachAvatar avatar={id} size={48} />
          </label>
        ))}
      </div>
      <div
        className={cn(
          'panel grid min-w-0 gap-3 p-3',
          custom && 'outline outline-4 outline-bulb',
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {custom ? (
            <CoachAvatar
              avatar={value}
              size={56}
              label="Prévia da sua imagem"
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-14 shrink-0 place-items-center bg-chalk-deep text-muted-foreground"
            >
              <UploadSimple className="size-6" />
            </span>
          )}
          <div className="grid min-w-0 flex-1 gap-1">
            <strong className="text-sm">
              {custom ? 'Sua imagem está selecionada' : 'Usar minha imagem'}
            </strong>
            <span className="text-xs text-muted-foreground">
              PNG, JPEG ou WebP até 2 MB. Recortada em quadrado.
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <label
            htmlFor={fileId}
            className={cn(
              'btn-px btn-chalk inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 px-3 text-sm',
              uploading && 'pointer-events-none opacity-70',
            )}
          >
            <UploadSimple aria-hidden="true" />
            {uploading
              ? 'Enviando…'
              : custom
                ? 'Trocar imagem'
                : 'Usar minha imagem'}
          </label>
          <input
            id={fileId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={uploading}
            aria-describedby={statusId}
            onChange={(event) => {
              void upload(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          {custom && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                onChange('avatar-01');
                setMessage('Imagem removida.');
              }}
            >
              <Trash data-icon="inline-start" />
              Remover imagem
            </Button>
          )}
        </div>
        <p
          id={statusId}
          role="status"
          aria-live="polite"
          className={cn(
            'text-xs',
            message && !/enviada|removida/.test(message)
              ? 'font-semibold text-destructive'
              : 'text-muted-foreground',
          )}
        >
          {message}
        </p>
      </div>
    </fieldset>
  );
}

function PersonalityStep({
  value,
  error,
  onChange,
}: {
  value: CoachPersonality | '';
  error: string | undefined;
  onChange(value: CoachPersonality): void;
}) {
  const errorId = useId();
  return (
    <fieldset
      className="grid min-w-0 gap-2"
      {...(error ? { 'aria-describedby': errorId } : {})}
    >
      <legend className="mb-1 text-sm font-bold">Personalidade</legend>
      <p className="text-sm text-muted-foreground">
        A personalidade muda o jogo de verdade: cada estilo tem efeitos próprios
        e um tom diferente nos e-mails e nas notícias.
      </p>
      <div className="grid gap-2 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
        {COACH_PERSONALITY_GUIDE.map((guide) => (
          <OptionCard
            key={guide.id}
            name="personalidade"
            value={guide.id}
            checked={value === guide.id}
            onChange={() => onChange(guide.id)}
          >
            <strong className="pr-6 text-base">{guide.label}</strong>
            <span className="text-sm text-muted-foreground">
              {guide.tagline}
            </span>
            <ul className="mt-1 grid gap-1 text-xs">
              {guide.effects.map((effect) => (
                <li key={effect.key} className="flex gap-2">
                  <span
                    className={cn(
                      'shrink-0 font-bold',
                      effect.favorable ? 'text-primary' : 'text-accent',
                    )}
                  >
                    {effect.percent > 0 ? '+' : '−'}
                    {Math.abs(effect.percent)}%
                  </span>
                  <span>
                    {effect.label}
                    <span className="sr-only">
                      {effect.favorable ? ' (vantagem)' : ' (contrapeso)'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </OptionCard>
        ))}
      </div>
      {error && <FieldError id={errorId} message={error} />}
    </fieldset>
  );
}

/** Pixel flags shipped in `public/flags`; the emoji covers the rest. */
const PIXEL_FLAGS = new Set([
  'ar',
  'au',
  'br',
  'ca',
  'cn',
  'de',
  'fr',
  'gb',
  'id',
  'in',
  'it',
  'jp',
  'kr',
  'mx',
  'ru',
  'sa',
  'tr',
  'us',
  'ye',
  'za',
]);

function CountryFlagIcon({ code, size = 28 }: { code: string; size?: number }) {
  const iso = code.toLowerCase();
  if (PIXEL_FLAGS.has(iso))
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tiny pixel PNG
      <img
        src={`/flags/${iso}.png`}
        alt=""
        aria-hidden="true"
        width={size}
        height={Math.round(size * 0.75)}
        className="pixelated shrink-0 border-2 border-ink"
        style={{ width: size, height: Math.round(size * 0.75) }}
      />
    );
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center border-2 border-ink bg-chalk-deep font-pixel text-[.5rem] text-ink"
      style={{ width: size, height: Math.round(size * 0.75) }}
    >
      {code}
    </span>
  );
}

function NationalityPicker({
  value,
  onChange,
}: {
  value: string;
  onChange(value: string): void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchId = useId();
  const listId = useId();
  const countId = useId();
  const search = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchCountries(query), [query]);
  const options = results.some(({ code }) => code === value)
    ? results
    : [
        { code: value, name: countryName(value), flag: flagEmoji(value) },
        ...results,
      ];
  useEffect(() => {
    if (open) search.current?.focus();
  }, [open]);
  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery('');
  };
  return (
    <div className="grid min-w-0 gap-2">
      <span className="text-sm font-bold">Nacionalidade</span>
      <div className="panel flex min-w-0 flex-wrap items-center gap-3 p-3">
        <CountryFlagIcon code={value} />
        <p className="min-w-0 flex-1 basis-32 truncate text-base font-semibold">
          <span className="sr-only">Selecionada: </span>
          {countryName(value)}
        </p>
        <Button
          type="button"
          variant="outline"
          className="ml-auto min-h-11 shrink-0"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((state) => !state)}
        >
          {open ? 'Fechar' : 'Trocar país'}
        </Button>
      </div>
      {open && (
        <div className="grid min-w-0 gap-2">
          <label htmlFor={searchId} className="text-sm text-muted-foreground">
            Buscar país pelo nome
          </label>
          <Input
            id={searchId}
            ref={search}
            type="search"
            value={query}
            placeholder="Ex.: Portugal, Argentina…"
            aria-controls={listId}
            aria-describedby={countId}
            onChange={(event) => setQuery(event.target.value)}
          />
          <p id={countId} className="sr-only" aria-live="polite">
            {results.length === 0
              ? 'Nenhum país encontrado.'
              : `${results.length} ${results.length === 1 ? 'país encontrado' : 'países encontrados'}.`}
          </p>
          <label htmlFor={listId} className="sr-only">
            País
          </label>
          <select
            id={listId}
            size={6}
            value={value}
            onChange={(event) => pick(event.target.value)}
            className="w-full min-w-0 border-2 border-ink bg-popover p-1 text-base text-popover-foreground"
          >
            {options.map((country) => (
              <option key={country.code} value={country.code}>
                {country.flag} {country.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function NameStep({
  value,
  error,
  onChange,
  summary,
}: {
  value: string;
  error: string | undefined;
  onChange(value: string): void;
  summary: {
    club: string;
    coach: string;
    nationality: string;
    avatar: CoachAvatarRef;
    personality: CoachPersonality;
  };
}) {
  const inputId = useId();
  const errorId = useId();
  const counterId = useId();
  const length = value.trim().length;
  return (
    <div className="grid min-w-0 gap-5">
      <div className="grid gap-2">
        <label htmlFor={inputId} className="text-sm font-bold">
          Nome da carreira
        </label>
        <Input
          id={inputId}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${errorId} ${counterId}` : counterId}
          onChange={(event) => onChange(event.target.value)}
        />
        <p
          id={counterId}
          className={cn(
            'text-xs text-muted-foreground',
            length > CAREER_NAME_MAX && 'font-bold text-destructive',
          )}
        >
          {length}/{CAREER_NAME_MAX} caracteres. Aparece no Carregar carreira.
        </p>
        {error && <FieldError id={errorId} message={error} />}
      </div>
      <section
        aria-labelledby="resumo-carreira"
        className="panel-board grid min-w-0 gap-3 p-4"
      >
        <h2 id="resumo-carreira" className="font-pixel text-[.65rem] text-bulb">
          Resumo
        </h2>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
          <CoachAvatar avatar={summary.avatar} size={72} />
          <dl className="grid min-w-0 gap-1 text-sm [&_dt]:text-chalk/70">
            <div className="flex gap-2">
              <dt>Treinador</dt>
              <dd className="min-w-0 font-bold break-words">{summary.coach}</dd>
            </div>
            <div className="flex gap-2">
              <dt>Nacionalidade</dt>
              <dd className="font-bold">{countryName(summary.nationality)}</dd>
            </div>
            <div className="flex gap-2">
              <dt>Personalidade</dt>
              <dd className="font-bold">
                {personalityLabel(summary.personality)}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt>Clube</dt>
              <dd className="min-w-0 font-bold break-words">{summary.club}</dd>
            </div>
            <div className="flex gap-2">
              <dt>Universo</dt>
              <dd className="font-bold">Só Brasil</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p
      id={id}
      role="alert"
      className="flex items-center gap-1.5 text-sm font-semibold text-destructive"
    >
      <WarningCircle weight="fill" aria-hidden="true" />
      {message}
    </p>
  );
}
