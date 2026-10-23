'use client';

import { useEffect, useState } from 'react';
import { ArrowsLeftRight, Check, X } from '@phosphor-icons/react';
import { ScreenSkeleton } from '@/components/retro/skeleton';
import { CoachAvatar } from '@/components/coach-avatar';
import { ContractsScreen } from '@/components/phase4-screens';
import { PixelCoin, PixelTrophy } from '@/components/retro/sprites';
import { useTicker } from '@/components/retro/ticker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { CareerApiPort, CareerView } from '@/lib/career-api';
import { personalityLabel } from '@/lib/coach-profile';
import {
  EXPENSE_LABEL,
  formatBrl,
  formatDate,
  formatMonth,
  INCOME_LABEL,
  MEMBERSHIP_TIER_LABEL,
  type FinanceCategories,
  type MembershipTier,
  type OfficeView,
  type SponsorOfferView,
} from '@/lib/management-model';
import { useSound } from '@/lib/retro/use-sound';
import { cn } from '@/lib/utils';

export type OfficeTab =
  'proposals' | 'sponsor' | 'membership' | 'finance' | 'contracts' | 'coach';

interface OfficeScreenProps {
  career: CareerView;
  api: CareerApiPort;
  onCareerChange(value: CareerView): void;
  reportError(message: string): void;
  initialTab?: OfficeTab;
}

/**
 * Escritório (docs/09 decision 8, ADR 0011): proposals (sponsorship with a
 * single counter, jobs, offers for the club's players), the running sponsor
 * contract, fan membership, finances by category, squad contracts and the
 * coach's career.
 */
export function OfficeScreen({
  career,
  api,
  onCareerChange,
  reportError,
  initialTab = 'proposals',
}: OfficeScreenProps) {
  const { play } = useSound();
  const ticker = useTicker();
  const [office, setOffice] = useState<OfficeView | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    api
      .getOffice()
      .then((value) => active && setOffice(value))
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
    action: () => Promise<OfficeView>,
    refreshCareer = false,
  ) => {
    if (busy) return false;
    setBusy(true);
    try {
      reportError('');
      setOffice(await action());
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

  if (!office) return <ScreenSkeleton label="Abrindo o escritório…" />;

  const pending = office.proposals.sponsorship.filter(
    (offer) => offer.status === 'pending',
  ).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="sr-only" role="status" aria-live="polite">
        {notice}
      </p>
      {/* Pixel digits shrink on phones and wrap only at the space ("R$ 38,6"
          / "mi"); "Patrocínio/mês" (14 glyphs) may break after the word so
          it never runs into the next column. */}
      <header className="panel-board grid grid-cols-3 gap-2 p-3 text-center">
        <div className="min-w-0">
          <p className="font-pixel text-[.5rem] uppercase text-chalk/80">
            Caixa
          </p>
          <p
            className={cn(
              'led text-[.65rem] break-normal min-[400px]:text-sm sm:text-base',
              (office.club?.cash ?? 0) < 0 && 'text-destructive',
            )}
          >
            {formatBrl(office.club?.cash ?? 0)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="font-pixel text-[.5rem] uppercase text-chalk/80">
            Patrocínio
            <wbr />
            /mês
          </p>
          <p className="led text-[.65rem] break-normal min-[400px]:text-sm sm:text-base">
            {formatBrl(
              office.sponsorship.contract?.monthlyValue ??
                office.sponsorship.fallbackMonthly,
            )}
          </p>
        </div>
        <div className="min-w-0">
          <p className="font-pixel text-[.5rem] uppercase text-chalk/80">
            Sócios
          </p>
          <p className="led text-[.65rem] break-normal min-[400px]:text-sm sm:text-base">
            {(office.membership?.members ?? 0).toLocaleString('pt-BR')}
          </p>
        </div>
      </header>

      <Tabs defaultValue={initialTab}>
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="proposals">
            Propostas{pending > 0 && ` (${String(pending)})`}
          </TabsTrigger>
          <TabsTrigger value="sponsor">Patrocínio</TabsTrigger>
          <TabsTrigger value="membership">Sócio</TabsTrigger>
          <TabsTrigger value="finance">Finanças</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
          <TabsTrigger value="coach">Treinador</TabsTrigger>
        </TabsList>

        <TabsContent value="proposals">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
            <section
              aria-labelledby="patrocinios"
              className="flex flex-col gap-2"
            >
              <h3
                id="patrocinios"
                className="font-pixel text-[.6rem] uppercase text-chalk"
              >
                Patrocínio · {String(pending)} proposta(s) em aberto
              </h3>
              {office.proposals.sponsorship.length === 0 && (
                <p className="panel p-3 text-xs text-muted-foreground">
                  Nenhuma proposta nesta temporada.
                </p>
              )}
              {office.proposals.sponsorship.map((offer) => (
                <SponsorOfferCard
                  key={offer.id}
                  offer={offer}
                  busy={busy}
                  onDecide={(decision) =>
                    run(
                      decision === 'accept'
                        ? `Contrato assinado com ${offer.sponsorName}.`
                        : `Proposta de ${offer.sponsorName} recusada.`,
                      () => api.decideSponsorship(offer.id, decision),
                      true,
                    )
                  }
                  onCounter={(value) =>
                    run(
                      'Contraproposta enviada. O patrocinador já respondeu.',
                      () => api.counterSponsorship(offer.id, value),
                      true,
                    )
                  }
                />
              ))}
            </section>
            <div className="flex flex-col gap-3">
              <section aria-labelledby="empregos" className="panel p-3">
                <h3 id="empregos" className="font-pixel text-[.6rem] uppercase">
                  Empregos
                </h3>
                {office.proposals.jobs.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Nenhum clube procurou você.
                  </p>
                )}
                <ul role="list" className="mt-2 flex flex-col gap-1 text-xs">
                  {office.proposals.jobs.map((job) => (
                    <li
                      key={job.id}
                      className="flex items-center justify-between bg-muted p-2"
                    >
                      <span>
                        <strong>{job.clubName}</strong> · até{' '}
                        {formatDate(job.expiresOn)}
                      </span>
                      <Badge
                        variant={job.status === 'open' ? 'bulb' : 'secondary'}
                      >
                        {job.status === 'open' ? 'Aberta' : job.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[.6rem] text-muted-foreground">
                  Aceitar um convite fica na Diretoria (Estádio › Diretoria).
                </p>
              </section>
              <section aria-labelledby="por-atletas" className="panel p-3">
                <h3
                  id="por-atletas"
                  className="font-pixel text-[.6rem] uppercase"
                >
                  Propostas por atletas
                </h3>
                {office.proposals.transfers.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Nenhuma proposta aguardando você.
                  </p>
                )}
                <ul role="list" className="mt-2 flex flex-col gap-1 text-xs">
                  {office.proposals.transfers.map((offer) => (
                    <li key={offer.id} className="bg-muted p-2">
                      <strong>{offer.playerName}</strong> ·{' '}
                      {offer.counterpartClubName ?? 'Clube'} oferece{' '}
                      <span className="led bg-board px-1">
                        {formatBrl(offer.fee)}
                      </span>{' '}
                      ({offer.kind === 'loan' ? 'empréstimo' : 'compra'}) · até{' '}
                      {formatDate(offer.expiresOn)}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[.6rem] text-muted-foreground">
                  Decida no Mercado › Propostas.
                </p>
              </section>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sponsor">
          <SponsorContractPanel office={office} />
        </TabsContent>

        <TabsContent value="membership">
          {office.membership ? (
            <MembershipPanel
              membership={office.membership}
              busy={busy}
              onSave={(input) =>
                run('Sócio-torcedor atualizado.', () =>
                  api.configureMembership(input),
                )
              }
            />
          ) : (
            <p className="panel p-3 text-sm">Sem clube para configurar.</p>
          )}
        </TabsContent>

        <TabsContent value="finance">
          <div className="grid gap-3 lg:grid-cols-2">
            <FinancePanel
              title={`Último mês fechado · ${formatMonth(office.finances.month.period)}`}
              finances={office.finances.month}
              pendingGate={office.finances.pendingGate}
            />
            <FinancePanel
              title={`Temporada ${String(office.finances.season.year)}`}
              finances={office.finances.season}
            />
          </div>
        </TabsContent>

        <TabsContent value="contracts">
          <section aria-labelledby="contratos" className="panel p-3">
            <h3 id="contratos" className="font-pixel text-[.6rem] uppercase">
              Contratos do elenco
            </h3>
            <table className="mt-2 w-full text-left text-xs">
              <thead>
                <tr className="font-pixel text-[.45rem] uppercase text-muted-foreground">
                  <th className="py-1">Atleta</th>
                  <th>Termina</th>
                  <th className="text-right">Salário</th>
                  <th className="text-right">Situação</th>
                </tr>
              </thead>
              <tbody>
                {office.contracts.map((contract) => (
                  <tr
                    key={contract.contractId}
                    className="border-t border-ink/20"
                  >
                    <td className="py-1.5 font-semibold">
                      {contract.playerName}
                    </td>
                    <td>{formatDate(contract.endsOn)}</td>
                    <td className="text-right">{formatBrl(contract.wage)}</td>
                    <td className="text-right">
                      <Badge
                        variant={
                          contract.status === 'expiring' ? 'bulb' : 'outline'
                        }
                      >
                        {contract.status === 'expiring'
                          ? 'Vencendo'
                          : contract.status === 'active'
                            ? 'Ativo'
                            : contract.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <div className="mt-3">
            <ContractsScreen
              career={career}
              api={api}
              onCareerChange={onCareerChange}
              reportError={reportError}
            />
          </div>
        </TabsContent>

        <TabsContent value="coach">
          <CoachPanel office={office} career={career} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const SPONSOR_STATUS: Record<SponsorOfferView['status'], string> = {
  pending: 'Em aberto',
  accepted: 'Assinada',
  rejected: 'Recusada',
  withdrawn: 'Patrocinador desistiu',
  expired: 'Expirada',
  superseded: 'Encerrada',
};

function SponsorOfferCard({
  offer,
  busy,
  onDecide,
  onCounter,
}: {
  offer: SponsorOfferView;
  busy: boolean;
  onDecide(decision: 'accept' | 'reject'): Promise<boolean>;
  onCounter(value: number): Promise<boolean>;
}) {
  const [countering, setCountering] = useState(false);
  const [value, setValue] = useState(
    String(Math.round(offer.monthlyValue * 1.08)),
  );
  const open = offer.status === 'pending';
  const canCounter = open && !offer.counter && offer.counterRange;
  return (
    <article
      aria-label={`Proposta de ${offer.sponsorName}`}
      className={cn('panel grid gap-2 p-3', !open && 'opacity-75')}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-pixel text-[.6rem] uppercase">
            {offer.sponsorName}
          </h4>
          <p className="text-xs text-muted-foreground">
            {offer.durationMonths} meses · até {formatDate(offer.expiresOn)}
          </p>
        </div>
        <Badge
          variant={
            open
              ? 'bulb'
              : offer.status === 'accepted'
                ? 'default'
                : 'secondary'
          }
        >
          {SPONSOR_STATUS[offer.status]}
        </Badge>
      </div>
      <p className="flex items-baseline gap-2">
        <span className="led bg-board px-1.5 py-1 text-lg">
          {formatBrl(offer.monthlyValue)}
        </span>
        <span className="text-xs">por mês</span>
      </p>
      <dl className="grid grid-cols-3 gap-1 text-[.65rem]">
        <div className="bg-muted p-1">
          <dt className="font-pixel text-[.45rem] uppercase">Título</dt>
          <dd>{formatBrl(offer.bonuses.title)}</dd>
        </div>
        <div className="bg-muted p-1">
          <dt className="font-pixel text-[.45rem] uppercase">Continental</dt>
          <dd>{formatBrl(offer.bonuses.continental)}</dd>
        </div>
        <div className="bg-muted p-1">
          <dt className="font-pixel text-[.45rem] uppercase">Multa</dt>
          <dd>{formatBrl(offer.terminationFee)}</dd>
        </div>
      </dl>
      {offer.counter && (
        <p className="text-xs">
          Você pediu {formatBrl(offer.counter.monthlyValue)}:{' '}
          {offer.counter.outcome === 'accepted'
            ? 'o patrocinador aceitou.'
            : 'o patrocinador desistiu.'}
        </p>
      )}
      {open && (
        // Three pixel-font labels never fit side by side on a phone: stacked
        // there, one row from `sm` up. Names carry the sponsor so three
        // cards never announce three identical "Aceitar" buttons.
        <div className="grid gap-1 sm:grid-cols-3">
          <Button
            size="sm"
            disabled={busy}
            aria-label={`Aceitar proposta de ${offer.sponsorName}`}
            onClick={() => void onDecide('accept')}
          >
            <Check data-icon="inline-start" />
            Aceitar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            aria-label={`Recusar proposta de ${offer.sponsorName}`}
            onClick={() => void onDecide('reject')}
          >
            <X data-icon="inline-start" />
            Recusar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !canCounter}
            aria-expanded={countering}
            aria-label={`Contrapropor a ${offer.sponsorName}`}
            onClick={() => setCountering((current) => !current)}
            title={
              !canCounter
                ? 'Só uma contraproposta por patrocinador.'
                : undefined
            }
          >
            <ArrowsLeftRight data-icon="inline-start" />
            Contrapropor
          </Button>
        </div>
      )}
      {open && countering && offer.counterRange && (
        <form
          className="grid grid-cols-[1fr_auto] items-end gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            void onCounter(Number(value)).then(
              (ok) => ok && setCountering(false),
            );
          }}
        >
          <label className="grid gap-1 text-xs">
            Mensalidade pedida (R$)
            <Input
              type="number"
              min={offer.counterRange.min}
              max={offer.counterRange.max}
              step="any"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <span className="text-muted-foreground">
              Entre {formatBrl(offer.counterRange.min)} e{' '}
              {formatBrl(offer.counterRange.max)}. Só uma vez.
            </span>
          </label>
          <Button type="submit" size="sm" disabled={busy}>
            Enviar
          </Button>
        </form>
      )}
    </article>
  );
}

function SponsorContractPanel({ office }: { office: OfficeView }) {
  const contract = office.sponsorship.contract;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section aria-labelledby="contrato-vigente" className="panel p-3">
        <h3 id="contrato-vigente" className="font-pixel text-[.6rem] uppercase">
          Contrato vigente
        </h3>
        {contract ? (
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="col-span-2">
              <dt className="text-muted-foreground">Patrocinador</dt>
              <dd className="text-base font-bold">{contract.sponsorName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Mensalidade</dt>
              <dd className="led bg-board px-1 text-sm">
                {formatBrl(contract.monthlyValue)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Vigência</dt>
              <dd>
                {formatMonth(contract.startMonth)} →{' '}
                {formatMonth(contract.endMonth)} · {contract.monthsRemaining}{' '}
                meses restantes
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                Bônus título / continental
              </dt>
              <dd>
                {formatBrl(contract.bonuses.title)} /{' '}
                {formatBrl(contract.bonuses.continental)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Multa de rescisão</dt>
              <dd>{formatBrl(contract.terminationFee)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-xs">
            Sem contrato: o clube recebe patrocínio avulso de{' '}
            <strong>{formatBrl(office.sponsorship.fallbackMonthly)}</strong> por
            mês, metade do que um contrato pagaria. Responda às propostas.
          </p>
        )}
      </section>
      <section aria-labelledby="historico-patrocinio" className="panel p-3">
        <h3
          id="historico-patrocinio"
          className="font-pixel text-[.6rem] uppercase"
        >
          Histórico
        </h3>
        {office.sponsorship.history.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Nenhum contrato anterior.
          </p>
        )}
        <ul role="list" className="mt-2 flex flex-col gap-1 text-xs">
          {office.sponsorship.history.map((item) => (
            <li key={item.id} className="bg-muted p-2">
              <strong>{item.sponsorName}</strong> ·{' '}
              {formatBrl(item.monthlyValue)}/mês ·{' '}
              {formatMonth(item.startMonth)} → {formatMonth(item.endMonth)} ·{' '}
              {item.status === 'terminated' ? 'rescindido' : 'encerrado'}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MembershipPanel({
  membership,
  busy,
  onSave,
}: {
  membership: NonNullable<OfficeView['membership']>;
  busy: boolean;
  onSave(input: {
    monthlyPrice: number;
    tier: MembershipTier;
  }): Promise<boolean>;
}) {
  const [price, setPrice] = useState(membership.monthlyPrice);
  const [tier, setTier] = useState<MembershipTier>(membership.tier);
  const changed = price !== membership.monthlyPrice || tier !== membership.tier;
  const share = membership.potential
    ? Math.round((membership.members / membership.potential) * 100)
    : 0;
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,.7fr)]">
      <form
        className="panel grid gap-3 p-3"
        aria-label="Configurar sócio-torcedor"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({ monthlyPrice: price, tier });
        }}
      >
        <h3 className="font-pixel text-[.6rem] uppercase">Sócio-torcedor</h3>
        <label className="grid gap-1 text-xs">
          <span className="flex justify-between">
            Mensalidade
            <strong className="led bg-board px-1">{formatBrl(price)}</strong>
          </span>
          <input
            type="range"
            min={membership.priceRange.min}
            max={membership.priceRange.max}
            step={1}
            value={price}
            aria-valuetext={`${formatBrl(price)} por mês`}
            onChange={(event) => setPrice(Number(event.target.value))}
            className="accent-bulb"
          />
          <span className="text-muted-foreground">
            Entre {formatBrl(membership.priceRange.min)} e{' '}
            {formatBrl(membership.priceRange.max)}. Referência do clube:{' '}
            {formatBrl(membership.referencePrice)}.
          </span>
        </label>
        <div className="grid gap-1 text-xs">
          <span id="nivel-socio">Nível de benefícios</span>
          <ToggleGroup
            type="single"
            aria-labelledby="nivel-socio"
            value={tier}
            onValueChange={(value) => value && setTier(value as MembershipTier)}
            className="grid grid-cols-3"
          >
            {membership.tiers.map((item) => (
              <ToggleGroupItem
                key={item.tier}
                value={item.tier}
                className="min-h-12 flex-col gap-0 px-1"
              >
                <span>{MEMBERSHIP_TIER_LABEL[item.tier]}</span>
                <span className="font-sans text-[.55rem] normal-case">
                  custo {formatBrl(item.costPerMember)}/sócio
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <Button type="submit" className="min-h-11" disabled={busy || !changed}>
          <PixelCoin size={12} />
          Salvar sócio-torcedor
        </Button>
      </form>
      <section
        aria-labelledby="socios-hoje"
        className="panel-board grid content-start gap-2 p-3 text-chalk"
      >
        <h3 id="socios-hoje" className="font-pixel text-[.6rem] uppercase">
          Com a configuração atual
        </h3>
        <p className="led text-2xl">
          {membership.members.toLocaleString('pt-BR')}
        </p>
        <p className="text-xs">
          sócios de {membership.potential.toLocaleString('pt-BR')} possíveis (
          {share}%)
        </p>
        <Progress
          value={share}
          tone="bulb"
          aria-label={`Adesão ${String(share)}%`}
        />
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-chalk/70">Receita/mês</dt>
            <dd className="led text-sm">
              {formatBrl(membership.monthlyRevenue)}
            </dd>
          </div>
          <div>
            <dt className="text-chalk/70">Custo/mês</dt>
            <dd className="led text-sm">{formatBrl(membership.monthlyCost)}</dd>
          </div>
          <div>
            <dt className="text-chalk/70">Público extra</dt>
            <dd>
              +{membership.attendanceBonus.toLocaleString('pt-BR')} por jogo
            </dd>
          </div>
          <div>
            <dt className="text-chalk/70">Torcida no fim do ano</dt>
            <dd>
              {membership.fanConfidenceEffect > 0 ? '+' : ''}
              {membership.fanConfidenceEffect} pontos
            </dd>
          </div>
        </dl>
        <p className="text-[.6rem] text-chalk/70">
          Os números mudam depois de salvar; preço maior nunca aumenta sócios.
        </p>
      </section>
    </div>
  );
}

function FinancePanel({
  title,
  finances,
  pendingGate,
}: {
  title: string;
  finances: FinanceCategories;
  pendingGate?: number;
}) {
  const max = Math.max(
    1,
    ...Object.values(finances.income),
    ...Object.values(finances.expenses),
  );
  const bar = (label: string, value: number, tone: 'grass' | 'red') => (
    <li
      key={`${tone}-${label}`}
      className="grid grid-cols-[6rem_1fr_5rem] items-center gap-2 text-xs"
    >
      <span className="truncate">{label}</span>
      <span
        className="bar-px"
        data-tone={tone === 'grass' ? undefined : 'red'}
        aria-hidden="true"
      >
        <span
          style={{ width: `${String(Math.round((value / max) * 100))}%` }}
        />
      </span>
      <span className="text-right tabular-nums">{formatBrl(value)}</span>
    </li>
  );
  return (
    <section aria-label={title} className="panel grid gap-2 p-3">
      <h3 className="font-pixel text-[.6rem] uppercase">{title}</h3>
      <h4 className="font-pixel text-[.5rem] uppercase text-primary">
        Receitas
      </h4>
      <ul role="list" className="grid gap-1">
        {(Object.keys(INCOME_LABEL) as (keyof typeof INCOME_LABEL)[]).map(
          (key) => bar(INCOME_LABEL[key], finances.income[key], 'grass'),
        )}
      </ul>
      <h4 className="font-pixel text-[.5rem] uppercase text-destructive">
        Despesas
      </h4>
      <ul role="list" className="grid gap-1">
        {(Object.keys(EXPENSE_LABEL) as (keyof typeof EXPENSE_LABEL)[]).map(
          (key) => bar(EXPENSE_LABEL[key], finances.expenses[key], 'red'),
        )}
      </ul>
      <dl className="grid grid-cols-3 gap-1 text-center text-xs">
        <div className="bg-muted p-1">
          <dt className="font-pixel text-[.45rem] uppercase">Receitas</dt>
          <dd className="font-bold">{formatBrl(finances.totalIncome)}</dd>
        </div>
        <div className="bg-muted p-1">
          <dt className="font-pixel text-[.45rem] uppercase">Despesas</dt>
          <dd className="font-bold">{formatBrl(finances.totalExpenses)}</dd>
        </div>
        <div
          className={cn(
            'p-1',
            finances.net >= 0
              ? 'bg-primary text-chalk'
              : 'bg-destructive text-chalk',
          )}
        >
          <dt className="font-pixel text-[.45rem] uppercase">Saldo</dt>
          <dd className="led">{formatBrl(finances.net)}</dd>
        </div>
      </dl>
      {pendingGate !== undefined && (
        <p className="text-[.6rem] text-muted-foreground">
          Bilheteria do mês aberto ainda não fechada: {formatBrl(pendingGate)}.
        </p>
      )}
    </section>
  );
}

const ACHIEVEMENT_LABEL: Record<string, string> = {
  league_title: 'Títulos de liga',
  cup_title: 'Copas',
  continental_title: 'Títulos continentais',
  promotion: 'Acessos',
  season_completed: 'Temporadas completas',
};

function CoachPanel({
  office,
  career,
}: {
  office: OfficeView;
  career: CareerView;
}) {
  const coach = office.coach;
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section
        aria-labelledby="carreira-treinador"
        className="panel grid gap-3 p-3"
      >
        <div className="flex items-center gap-3">
          {career.coachProfile && (
            <CoachAvatar avatar={career.coachProfile.avatar} size={56} />
          )}
          <div>
            <h3
              id="carreira-treinador"
              className="font-pixel text-[.6rem] uppercase"
            >
              {coach.managerName}
            </h3>
            <p className="text-xs text-muted-foreground">
              {career.coachProfile
                ? personalityLabel(career.coachProfile.personality)
                : 'Treinador'}{' '}
              ·{' '}
              {coach.employmentStatus === 'employed'
                ? 'Empregado'
                : coach.employmentStatus === 'available'
                  ? 'Disponível'
                  : 'Aposentado'}{' '}
              · {coach.seasons} temporada(s)
            </p>
          </div>
          <span className="ml-auto grid text-center">
            <span className="font-pixel text-[.45rem] uppercase">
              Prestígio
            </span>
            <span className="led bg-board px-1 text-base">
              {Math.round(coach.prestige)}
            </span>
          </span>
        </div>
        {[
          ['Confiança da diretoria', coach.boardConfidence],
          ['Confiança da torcida', coach.fanConfidence],
        ].map(([label, value]) => (
          <div key={label} className="text-xs">
            <div className="mb-0.5 flex justify-between">
              <span>{label}</span>
              <strong>{Math.round(Number(value))}%</strong>
            </div>
            <Progress
              value={Number(value)}
              tone={Number(value) < 40 ? 'red' : 'grass'}
              aria-label={`${String(label)}: ${String(Math.round(Number(value)))}%`}
            />
          </div>
        ))}
        {office.chemistry && (
          <p className="text-xs">
            Entrosamento do time: <strong>{office.chemistry.value}</strong> (+
            {office.chemistry.bonusPercent.toFixed(1)}% de força)
          </p>
        )}
      </section>
      <div className="flex flex-col gap-3">
        <section aria-labelledby="conquistas" className="panel p-3">
          <h3 id="conquistas" className="font-pixel text-[.6rem] uppercase">
            Conquistas
          </h3>
          {coach.achievements.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              A galeria ainda está vazia.
            </p>
          )}
          <ul role="list" className="mt-2 flex flex-wrap gap-1">
            {coach.achievements.map((item) => (
              <li key={item.type}>
                <Badge variant="bulb">
                  <PixelTrophy size={10} />
                  {ACHIEVEMENT_LABEL[item.type] ?? item.type}: {item.count}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="passagens" className="panel p-3">
          <h3 id="passagens" className="font-pixel text-[.6rem] uppercase">
            Passagens
          </h3>
          <ul role="list" className="mt-2 flex flex-col gap-1 text-xs">
            {coach.appointments.map((item) => (
              <li
                key={`${item.clubName}-${item.joinedOn}`}
                className="bg-muted p-2"
              >
                <strong>{item.clubName}</strong> · desde{' '}
                {formatDate(item.joinedOn)}
                {item.leftOn && ` até ${formatDate(item.leftOn)}`}
                {item.reason &&
                  ` · ${item.reason === 'fired' ? 'demitido' : item.reason === 'resigned' ? 'pediu demissão' : 'aceitou convite'}`}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
