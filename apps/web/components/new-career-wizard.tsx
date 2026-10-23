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
import { MuteButton } from '@/components/retro/mute-button';
import { ScreenTransition } from '@/components/retro/screen-transition';
import { PixelStar } from '@/components/retro/sprites';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
  personalityLabel,
  searchCountries,
  type CoachAvatarId,
  type CoachPersonality,
  type CoachProfile,
} from '@/lib/coach-profile';
import { useSound } from '@/lib/retro/use-sound';
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
  anyClub = true,
  initialCoach = '',
  pending = false,
  error = '',
  onCancel,
  onSubmit,
  onSignOut,
}: {
  clubs?: readonly ClubPreview[];
  /** License: any club; free plan only Série C (docs/05 §5). */
  anyClub?: boolean;
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
  const { play } = useSound();

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

  return (
    <main className="min-h-dvh px-4 pb-10 pt-4 sm:px-6">
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
          className="panel grid gap-5 p-4 sm:p-6"
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
          <h1
            id="nova-carreira-titulo"
            ref={heading}
            tabIndex={-1}
            className="font-pixel text-sm leading-relaxed sm:text-lg"
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
                anyClub={anyClub}
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

            <div className="grid gap-3 sm:flex sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="min-h-12 whitespace-normal"
                onClick={back}
              >
                <ArrowLeft data-icon="inline-start" />
                {step === 0 ? 'Voltar ao início' : 'Voltar'}
              </Button>
              {last ? (
                <Button
                  type="submit"
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
                  className="min-h-12 whitespace-normal px-6 text-base"
                >
                  Continuar
                  <ArrowRight data-icon="inline-end" />
                </Button>
              )}
            </div>
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
  onChange?(): void;
  children: React.ReactNode;
  className?: string;
  describedBy?: string;
}) {
  return (
    <label
      className={cn(
        'panel relative grid cursor-pointer gap-1 p-4 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
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

const DIVISIONS: readonly ClubDivision[] = ['serie-a', 'serie-b', 'serie-c'];

function ClubStep({
  clubs,
  anyClub,
  value,
  error,
  onChange,
}: {
  clubs: readonly ClubPreview[];
  anyClub: boolean;
  value: string;
  error: string | undefined;
  onChange(value: string): void;
}) {
  const errorId = useId();
  const lockId = useId();
  const searchId = useId();
  const selected = clubs.find((item) => item.name === value);
  const [division, setDivision] = useState<ClubDivision>(
    selected?.division ?? (anyClub ? 'serie-a' : FREE_PLAN_DIVISION),
  );
  const [query, setQuery] = useState('');
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
    <div className="grid gap-4">
      <div className="grid gap-3">
        <div role="group" aria-label="Série" className="grid grid-cols-3 gap-2">
          {DIVISIONS.map((item) => {
            const count = clubs.filter((club) => club.division === item).length;
            return (
              <Button
                key={item}
                type="button"
                variant={division === item && !query ? 'default' : 'outline'}
                aria-pressed={division === item && !query}
                className="min-h-11"
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
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
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
              disabled={blocked}
              {...(blocked ? { describedBy: lockId } : {})}
              onChange={() => onChange(item.name)}
              className="min-w-0 text-center"
            >
              <span className="flex flex-col items-center gap-2 pt-1">
                <ClubEmblem
                  name={item.name}
                  id={item.id}
                  size={64}
                  decorative
                />
                <strong className="font-pixel text-[.6rem] leading-relaxed break-words">
                  {item.name}
                </strong>
              </span>
              <span className="text-xs text-muted-foreground">{item.note}</span>
              <span className="mx-auto mt-1 flex items-center gap-2 bg-board px-2 py-1 font-pixel text-[.55rem] text-chalk">
                <span className="sr-only">Força </span>
                <span className="led text-sm" aria-hidden="true">
                  {item.strength}
                </span>
                <span aria-hidden="true">·</span>
                <span>
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
      {selected && <SquadPreview club={selected} />}
    </div>
  );
}

function SquadPreview({ club }: { club: ClubPreview }) {
  return (
    <section
      aria-labelledby="elenco-previa"
      className="panel-board grid gap-3 p-4"
    >
      <h2 id="elenco-previa" className="font-pixel text-[.65rem] text-bulb">
        Elenco do {club.name}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {club.groups.map((group) => (
          <div key={group.group} className="grid gap-1">
            <h3 className="flex items-baseline justify-between font-pixel text-[.5rem] text-chalk/70">
              {POSITION_GROUP_LABEL[group.group]}
              <span>{group.count}</span>
            </h3>
            <ul className="grid gap-1">
              {group.highlights.map((player) => (
                <li
                  key={player.name}
                  className="flex items-center justify-between gap-2 border-b border-wood-deep px-1 py-1.5 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-9 shrink-0 font-pixel text-[.5rem] text-chalk/70">
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
                'relative grid cursor-pointer place-items-center bg-chalk-deep p-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                avatar === id && 'outline outline-4 outline-bulb',
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
              <CoachAvatar avatar={id} size={56} />
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
        className="w-full border-2 border-ink bg-popover p-1 text-base text-popover-foreground"
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
        className="panel-board grid gap-3 p-4"
      >
        <h2 id="resumo-carreira" className="font-pixel text-[.65rem] text-bulb">
          Resumo
        </h2>
        <div className="grid grid-cols-[auto_1fr] items-center gap-4">
          <CoachAvatar avatar={summary.avatar} size={72} />
          <dl className="grid gap-1 text-sm [&_dt]:text-chalk/70">
            <div className="flex gap-2">
              <dt>Treinador</dt>
              <dd className="font-bold">{summary.coach}</dd>
            </div>
            <div className="flex gap-2">
              <dt>Nacionalidade</dt>
              <dd className="font-bold">
                <span aria-hidden="true">
                  {flagEmoji(summary.nationality)}{' '}
                </span>
                {countryName(summary.nationality)}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt>Personalidade</dt>
              <dd className="font-bold">
                {personalityLabel(summary.personality)}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt>Clube</dt>
              <dd className="flex items-center gap-1.5 font-bold">
                <ClubEmblem name={summary.club} size={20} decorative />
                {summary.club}
              </dd>
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
