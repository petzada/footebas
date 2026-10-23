'use client';

import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDots,
  CheckCircle,
  Medal,
  Trophy,
} from '@phosphor-icons/react';
import { ScreenSkeleton } from '@/components/retro/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  createFakeCompetitionProductPort,
  type CompetitionProductPort,
  type CompetitionProductView,
  type CompetitionView,
} from '@/lib/competition-product';

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

const defaultCompetitionPort = createFakeCompetitionProductPort();

export function CompetitionScreens({
  port = defaultCompetitionPort,
  initialTab = 'pyramid',
  onOpenTable,
}: {
  port?: CompetitionProductPort;
  initialTab?: 'pyramid' | 'calendar' | 'next';
  /** Opens the Classificação on that competition ("Ver tabela"). */
  onOpenTable?: ((competitionId: string) => void) | undefined;
}) {
  const [model, setModel] = useState<CompetitionProductView>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void port
      .load()
      .then((value) => active && setModel(value))
      .catch(
        () => active && setError('Não foi possível carregar as competições.'),
      );
    return () => {
      active = false;
    };
  }, [port]);

  if (error) return <p role="alert">{error}</p>;
  if (!model) return <ScreenSkeleton label="Carregando calendário…" />;

  return (
    <section aria-labelledby="competition-title">
      {/* On the grass, not on a panel: chalk tones keep AA contrast. */}
      <header className="mb-4 text-chalk drop-shadow-[0_1px_0_rgb(0_0_0/0.6)]">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-chalk/90">
          Temporada {model.season}
        </p>
        <h2
          id="competition-title"
          className="font-display text-xs font-bold uppercase sm:text-sm"
        >
          Competições
        </h2>
        <p className="mt-1 max-w-2xl text-sm">
          A pirâmide brasileira, as copas simultâneas e a passagem de temporada
          em uma visão rápida.
        </p>
      </header>
      <Tabs defaultValue={initialTab}>
        <TabsList className="grid w-full grid-cols-3 sm:w-fit">
          <TabsTrigger value="pyramid">Pirâmide</TabsTrigger>
          <TabsTrigger value="calendar">Calendário</TabsTrigger>
          <TabsTrigger value="next">2027</TabsTrigger>
        </TabsList>
        <TabsContent value="pyramid" className="mt-4 flex flex-col gap-5">
          <div className="grid gap-3 lg:grid-cols-3">
            {model.divisions.map((competition) => (
              <CompetitionCard
                key={competition.id}
                competition={competition}
                onOpenTable={onOpenTable}
              />
            ))}
          </div>
          <div>
            <h3 className="mb-3 font-display text-base font-bold uppercase">
              Copas e identidade brasileira
            </h3>
            <div className="grid gap-3 lg:grid-cols-3">
              {model.cups.map((competition) => (
                <CompetitionCard
                  key={competition.id}
                  competition={competition}
                  onOpenTable={onOpenTable}
                />
              ))}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="calendar" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="font-display text-base uppercase">
                    Datas que não se atropelam
                  </CardTitle>
                  <CardDescription>
                    Nacional, estadual, copa e continental reservam janelas no
                    mesmo calendário.
                  </CardDescription>
                </div>
                <Badge
                  variant={model.calendar.valid ? 'default' : 'destructive'}
                >
                  <CheckCircle data-icon="inline-start" weight="fill" />
                  {model.calendar.valid
                    ? 'Validado · sem conflitos'
                    : `${model.calendar.conflictCount} conflitos`}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Competição</TableHead>
                    <TableHead className="hidden sm:table-cell">Fase</TableHead>
                    <TableHead>Evento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.calendar.entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {new Intl.DateTimeFormat('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                        }).format(new Date(`${entry.date}T12:00:00Z`))}
                      </TableCell>
                      <TableCell>{entry.competitionName}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {entry.phaseName}
                      </TableCell>
                      <TableCell>{entry.label}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="next" className="mt-4 flex flex-col gap-4">
          <Card className="scoreboard">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge>Transição pronta</Badge>
                  <CardTitle>
                    <h3 className="font-display text-sm uppercase">
                      Temporada {model.nextSeason.season}
                    </h3>
                  </CardTitle>
                  <CardDescription>
                    Acessos, quedas e vagas já alimentam a nova configuração.
                  </CardDescription>
                </div>
                <CalendarDots weight="fill" />
              </div>
            </CardHeader>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-sm uppercase">
                  Acesso e rebaixamento
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {model.nextSeason.movements.map((movement) => (
                  <div
                    key={`${movement.clubName}-${movement.kind}`}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div>
                      <strong>{movement.clubName}</strong>
                      <p className="text-xs text-muted-foreground">
                        {movement.fromDivision} → {movement.toDivision}
                      </p>
                    </div>
                    <Badge
                      variant={
                        movement.kind === 'promoted' ? 'default' : 'secondary'
                      }
                    >
                      {movement.kind === 'promoted' ? (
                        <ArrowUp data-icon="inline-start" />
                      ) : (
                        <ArrowDown data-icon="inline-start" />
                      )}
                      {movement.kind === 'promoted' ? 'Acesso' : 'Rebaixado'}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-sm uppercase">
                  Vagas conquistadas
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {model.nextSeason.qualifiers.map((qualifier) => (
                  <div
                    key={`${qualifier.clubName}-${qualifier.competitionName}`}
                  >
                    <strong>{qualifier.clubName}</strong>
                    <p className="text-sm text-muted-foreground">
                      {qualifier.competitionName} · {qualifier.route}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-sm uppercase">
                Premiação e prestígio
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {model.nextSeason.awards.map((award) => (
                <div key={award.label} className="rounded-md bg-muted p-3">
                  <p className="flex items-center gap-2 font-medium">
                    <Medal weight="fill" /> {award.label}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {money(award.prize)} · +{award.prestige} prestígio
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function CompetitionCard({
  competition,
  onOpenTable,
}: {
  competition: CompetitionView;
  onOpenTable?: ((competitionId: string) => void) | undefined;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>
              <h3 className="font-display text-base uppercase">
                {competition.name}
              </h3>
            </CardTitle>
            <CardDescription>{competition.formatLabel}</CardDescription>
          </div>
          <Trophy weight={competition.tier === 1 ? 'fill' : 'regular'} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {competition.phases.map((phase) => (
            <Badge key={phase.name} variant="secondary">
              {phase.name}
            </Badge>
          ))}
        </div>
        <p>
          <span className="text-muted-foreground">Participantes:</span>{' '}
          {competition.participantCount}
        </p>
        {competition.qualifications.map((qualification) => (
          <p key={qualification.label}>
            <span className="text-muted-foreground">
              {qualification.label}:
            </span>{' '}
            {qualification.places} vagas
          </p>
        ))}
        <Separator />
        <p>
          {money(competition.prize)} · +{competition.prestige} prestígio
        </p>
        {onOpenTable && (
          <Button
            variant="ghost"
            className="min-h-11 justify-between"
            onClick={() => onOpenTable(competition.id)}
          >
            Ver tabela: {competition.name}
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
