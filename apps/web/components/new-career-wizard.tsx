'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
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
  WarningCircle,
  UserCircle,
} from '@phosphor-icons/react';
import { Brand } from '@/components/brand';
import { ClubEmblem } from '@/components/club-emblem';
import { CoachAvatar, avatarNumber } from '@/components/coach-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Glass } from '@/components/ui/glass';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  POSITION_GROUP_LABEL,
  clubPreviews,
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
  personalityLabel,
  searchCountries,
  type CoachAvatarId,
  type CoachPersonality,
  type CoachProfile,
} from '@/lib/coach-profile';
import { cn } from '@/lib/utils';

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
  { id: 'name', label: 'Carreira', title: 'Dê um nome à carreira' },
] as const;

type Errors = Partial<
  Record<'club' | 'coachName' | 'personality' | 'careerName', string>
>;

/**
 * Nova Carreira em cinco etapas (docs/09): modo → universo → clube →
 * treinador → nome. Nothing is sent until the last step.
 */
export function NewCareerWizard({
  clubs = clubPreviews(),
  initialCoach = '',
  pending = false,
  error = '',
  onCancel,
  onSubmit,
  onSignOut,
}: {
  clubs?: readonly ClubPreview[];
  initialCoach?: string;
  pending?: boolean;
  /** Refusal from the server (shown on the last step). */
  error?: string;
  onCancel(): void;
  onSubmit(submission: NewCareerSubmission): void;
  onSignOut?: (() => void) | undefined;
}) {
  const [step, setStep] = useState(0);
  const [club, setClub] = useState('');
  const [coach, setCoach] = useState(initialCoach);
  const [nationality, setNationality] = useState('BR');
  const [avatar, setAvatar] = useState<CoachAvatarId>('avatar-01');
  const [personality, setPersonality] = useState<CoachPersonality | ''>('');
  const [careerName, setCareerName] = useState('');
  const [careerNameTouched, setCareerNameTouched] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

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
      const next: Errors = {};
      const nameError = coachNameError(coach);
      if (nameError) next.coachName = nameError;
      if (!personality)
        next.personality = 'Escolha a personalidade do treinador.';
      return next;
    }
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
    if (Object.keys(found).length > 0) return;
    if (!last) {
      if (STEPS[step + 1]!.id === 'name' && !careerNameTouched)
        setCareerName(defaultCareerName(coach));
      goTo(step + 1);
      return;
    }
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

  return (
    <main className="min-h-dvh px-4 pb-10 pt-4 sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <Brand />
        {onSignOut && (
          <Button variant="ghost" className="min-h-11" onClick={onSignOut}>
            <SignOut data-icon="inline-start" />
            Sair
          </Button>
        )}
      </div>
      <div className="mx-auto mt-6 grid max-w-5xl gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Etapas da nova carreira" className="hidden lg:block">
          <ol className="grid gap-2">
            {STEPS.map((item, index) => (
              <li
                key={item.id}
                aria-current={index === step ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold',
                  index === step
                    ? 'glass-strong text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'grid size-7 place-items-center rounded-full text-xs font-bold',
                    index < step
                      ? 'bg-primary text-primary-foreground'
                      : index === step
                        ? 'bg-coral text-coral-foreground'
                        : 'bg-popover/70',
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

        <Glass
          as="section"
          strong
          aria-labelledby="nova-carreira-titulo"
          className="grid gap-5 p-4 sm:p-6"
        >
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">
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
          <h1
            id="nova-carreira-titulo"
            ref={heading}
            tabIndex={-1}
            className="text-2xl font-extrabold leading-tight sm:text-3xl"
          >
            {current.title}
          </h1>

          <form
            noValidate
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!pending) advance();
            }}
          >
            {current.id === 'mode' && <ModeStep />}
            {current.id === 'universe' && <UniverseStep />}
            {current.id === 'club' && (
              <ClubStep
                clubs={clubs}
                value={club}
                error={errors.club}
                onChange={(value) => {
                  setClub(value);
                  setErrors((found) => ({ ...found, club: '' }));
                }}
              />
            )}
            {current.id === 'coach' && (
              <CoachStep
                coach={coach}
                nationality={nationality}
                avatar={avatar}
                personality={personality}
                errors={errors}
                setCoach={setCoach}
                setNationality={setNationality}
                setAvatar={setAvatar}
                setPersonality={(value) => {
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
                className="flex items-start gap-2 rounded-xl border border-destructive/50 bg-popover px-3 py-2 text-sm"
              >
                <WarningCircle
                  className="mt-0.5 shrink-0 text-destructive"
                  weight="fill"
                  aria-hidden="true"
                />
                {error}
              </p>
            )}

            <div className="grid grid-cols-[auto_1fr] gap-3 sm:flex sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="min-h-12"
                onClick={back}
              >
                <ArrowLeft data-icon="inline-start" />
                {step === 0 ? 'Voltar ao início' : 'Voltar'}
              </Button>
              {last ? (
                <Button
                  type="submit"
                  variant="coral"
                  className="min-h-12 px-6 text-base font-extrabold"
                  disabled={pending}
                >
                  <Play data-icon="inline-start" weight="fill" />
                  {pending ? 'Criando carreira…' : 'Começar carreira'}
                </Button>
              ) : (
                <Button type="submit" className="min-h-12 px-6 text-base">
                  Continuar
                  <ArrowRight data-icon="inline-end" />
                </Button>
              )}
            </div>
          </form>
        </Glass>
      </div>
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
  onChange?(): void;
  children: React.ReactNode;
  className?: string;
  describedBy?: string;
}) {
  return (
    <label
      className={cn(
        'surface relative grid cursor-pointer gap-1 rounded-2xl p-4 transition-shadow has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
        checked && 'ring-2 ring-primary',
        disabled &&
          'cursor-not-allowed border-dashed border-input bg-muted/80 shadow-none',
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange?.()}
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
          <span className="grid size-11 place-items-center rounded-xl bg-secondary text-primary">
            <UserCircle
              weight="duotone"
              className="size-6"
              aria-hidden="true"
            />
          </span>
          <span>
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
          <span className="grid size-11 place-items-center rounded-xl bg-secondary text-primary">
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
        <span className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
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

function ClubStep({
  clubs,
  value,
  error,
  onChange,
}: {
  clubs: readonly ClubPreview[];
  value: string;
  error: string | undefined;
  onChange(value: string): void;
}) {
  const errorId = useId();
  const selected = clubs.find((item) => item.name === value);
  return (
    <div className="grid gap-4">
      <fieldset
        className="grid gap-3 sm:grid-cols-3"
        {...(error ? { 'aria-describedby': errorId } : {})}
      >
        <legend className="mb-2 text-sm text-muted-foreground">
          Os emblemas são genéricos, gerados pelo jogo. A força vem do catálogo
          da temporada.
        </legend>
        {clubs.map((item) => (
          <OptionCard
            key={item.name}
            name="clube"
            value={item.name}
            checked={value === item.name}
            onChange={() => onChange(item.name)}
          >
            <span className="flex items-center gap-3 pr-5">
              <ClubEmblem name={item.name} size={48} decorative />
              <strong className="text-lg leading-tight">{item.name}</strong>
            </span>
            <span className="text-sm text-muted-foreground">{item.note}</span>
            <span className="text-sm font-semibold">
              Força {item.strength} · {item.squadSize} atletas
            </span>
          </OptionCard>
        ))}
      </fieldset>
      {error && <FieldError id={errorId} message={error} />}
      {selected && <SquadPreview club={selected} />}
    </div>
  );
}

function SquadPreview({ club }: { club: ClubPreview }) {
  return (
    <section
      aria-labelledby="elenco-previa"
      className="surface grid gap-3 rounded-2xl p-4"
    >
      <h2 id="elenco-previa" className="text-lg font-extrabold">
        Elenco do {club.name}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {club.groups.map((group) => (
          <div key={group.group} className="grid gap-1">
            <h3 className="flex items-baseline justify-between text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">
              {POSITION_GROUP_LABEL[group.group]}
              <span>{group.count}</span>
            </h3>
            <ul className="grid gap-1">
              {group.highlights.map((player) => (
                <li
                  key={player.name}
                  className="flex items-center justify-between gap-2 rounded-lg bg-popover/70 px-2 py-1.5 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-9 shrink-0 text-xs font-bold text-muted-foreground">
                      {positionLabel(player.position)}
                    </span>
                    <span className="truncate font-semibold">
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
                  <span className="shrink-0 font-bold">
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
  personality,
  errors,
  setCoach,
  setNationality,
  setAvatar,
  setPersonality,
}: {
  coach: string;
  nationality: string;
  avatar: CoachAvatarId;
  personality: CoachPersonality | '';
  errors: Errors;
  setCoach(value: string): void;
  setNationality(value: string): void;
  setAvatar(value: CoachAvatarId): void;
  setPersonality(value: CoachPersonality): void;
}) {
  const nameId = useId();
  const nameError = useId();
  const personalityError = useId();
  return (
    <div className="grid gap-6">
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

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-bold">Avatar</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {COACH_AVATARS.map((id) => (
            <label
              key={id}
              className={cn(
                'relative grid cursor-pointer place-items-center rounded-2xl bg-popover/70 p-1.5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                avatar === id && 'ring-3 ring-primary',
              )}
            >
              <input
                type="radio"
                name="avatar"
                value={id}
                checked={avatar === id}
                onChange={() => setAvatar(id)}
                className="sr-only"
              />
              <span className="sr-only">Avatar {avatarNumber(id)}</span>
              <CoachAvatar avatar={id} size={60} className="w-full h-auto" />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset
        className="grid gap-2"
        {...(errors.personality
          ? { 'aria-describedby': personalityError }
          : {})}
      >
        <legend className="mb-1 text-sm font-bold">Personalidade</legend>
        <p className="text-sm text-muted-foreground">
          A personalidade muda o jogo de verdade: cada estilo tem efeitos
          próprios e um tom diferente nos e-mails e nas notícias.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {COACH_PERSONALITY_GUIDE.map((guide) => (
            <OptionCard
              key={guide.id}
              name="personalidade"
              value={guide.id}
              checked={personality === guide.id}
              onChange={() => setPersonality(guide.id)}
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
        {errors.personality && (
          <FieldError id={personalityError} message={errors.personality} />
        )}
      </fieldset>
    </div>
  );
}

function NationalityPicker({
  value,
  onChange,
}: {
  value: string;
  onChange(value: string): void;
}) {
  const [query, setQuery] = useState('');
  const searchId = useId();
  const listId = useId();
  const countId = useId();
  const results = useMemo(() => searchCountries(query), [query]);
  const options = results.some(({ code }) => code === value)
    ? results
    : [
        { code: value, name: countryName(value), flag: flagEmoji(value) },
        ...results,
      ];
  return (
    <div className="grid gap-2">
      <span className="text-sm font-bold">Nacionalidade</span>
      <p className="flex items-center gap-2 text-base font-semibold">
        <span aria-hidden="true" className="text-2xl">
          {flagEmoji(value)}
        </span>
        <span>
          <span className="sr-only">Selecionada: </span>
          {countryName(value)}
        </span>
      </p>
      <label htmlFor={searchId} className="text-sm text-muted-foreground">
        Buscar país pelo nome
      </label>
      <Input
        id={searchId}
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
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-input bg-popover p-1 text-base text-foreground"
      >
        {options.map((country) => (
          <option key={country.code} value={country.code}>
            {country.flag} {country.name}
          </option>
        ))}
      </select>
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
    avatar: CoachAvatarId;
    personality: CoachPersonality;
  };
}) {
  const inputId = useId();
  const errorId = useId();
  const counterId = useId();
  const length = value.trim().length;
  return (
    <div className="grid gap-5">
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
        className="surface grid gap-3 rounded-2xl p-4"
      >
        <h2 id="resumo-carreira" className="text-lg font-extrabold">
          Resumo
        </h2>
        <div className="grid grid-cols-[auto_1fr] items-center gap-4">
          <CoachAvatar avatar={summary.avatar} size={72} />
          <dl className="grid gap-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Treinador</dt>
              <dd className="font-bold">{summary.coach}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Nacionalidade</dt>
              <dd className="font-bold">
                <span aria-hidden="true">
                  {flagEmoji(summary.nationality)}{' '}
                </span>
                {countryName(summary.nationality)}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Personalidade</dt>
              <dd className="font-bold">
                {personalityLabel(summary.personality)}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-muted-foreground">Clube</dt>
              <dd className="flex items-center gap-1.5 font-bold">
                <ClubEmblem name={summary.club} size={20} decorative />
                {summary.club}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Universo</dt>
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
