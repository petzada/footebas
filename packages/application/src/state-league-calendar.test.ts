/* eslint-disable @typescript-eslint/no-non-null-assertion -- every configured estadual has fixtures */
import type { ClubId } from '@footebas/domain';
import {
  careerSeasonSystem,
  createCareerSeason,
  validateCompetitionCalendar,
} from '@footebas/engine';
import { describe, expect, it } from 'vitest';
import { catalogCareerContent } from './index.js';

const DAY = 86_400_000;
const dayOf = (date: string) =>
  Math.round(
    (Date.parse(`${date}T00:00:00.000Z`) -
      Date.parse(`${date.slice(0, 4)}-01-01T00:00:00.000Z`)) /
      DAY,
  );

function firstSeason(year: number) {
  const content = catalogCareerContent.load();
  const state = createCareerSeason(content.competitions, {
    season: 1,
    year,
    seed: `career-seed:calendar-${String(year)}`,
    divisions: content.divisions,
    continentalDirect: content.continentalDirect,
    continentalPreliminary: content.continentalPreliminary,
  });
  return { content, state };
}

describe('calendário dos estaduais (docs/03)', () => {
  it('cada estadual se espalha até perto do dia 45 e termina antes do Brasileirão', () => {
    const { content, state } = firstSeason(2026);
    const states = content.competitions.stateLeagues;
    expect(states.length).toBeGreaterThan(0);
    for (const league of states) {
      const days = state.fixtures
        .filter(
          ({ competitionId }) =>
            competitionId === league.id.replaceAll('-', '_'),
        )
        .map(({ date }) => dayOf(date))
        .sort((left, right) => left - right);
      expect([league.id, days.length > 0]).toEqual([league.id, true]);
      const last = days.at(-1)!;
      expect([league.id, last >= 40 && last <= 47]).toEqual([league.id, true]);
      // Spread over the window, not crammed into the first fortnight.
      expect([league.id, days[0]! <= 14]).toEqual([league.id, true]);
    }
    const brasileirao = Math.min(
      ...content.competitions.nationalLeagues.map(
        ({ firstMatchDay }) => firstMatchDay,
      ),
    );
    expect(brasileirao).toBe(48);
  });

  it('nenhum clube tem dois jogos no mesmo dia nem sem descanso (Libertadores e Copa incluídas)', () => {
    for (const year of [2026, 2027]) {
      const { content, state } = firstSeason(year);
      const participants: Record<string, Record<string, ClubId[]>> = {};
      for (const fixture of state.fixtures) {
        const byStage = (participants[fixture.competitionId] ??= {});
        const clubs = new Set(byStage[fixture.stageId] ?? []);
        clubs.add(fixture.homeClubId).add(fixture.awayClubId);
        byStage[fixture.stageId] = [...clubs];
      }
      const system = careerSeasonSystem(content.competitions, state);
      const validation = validateCompetitionCalendar({
        fixtures: state.fixtures,
        competitions: system.definitions,
        stageParticipants: participants,
        minimumIntervalDays: system.minimumIntervalDays,
        reservedDates: system.reservedDates,
      });
      expect(validation.violations).toEqual([]);
    }
  });

  it('estadual nunca cai perto da Pré-Libertadores, que muda de clubes a cada ano', () => {
    const { content, state } = firstSeason(2026);
    const preliminary = content.competitions.continental.preliminaryMatchDays;
    const stateIds = new Set(
      content.competitions.stateLeagues.map(({ id }) =>
        id.replaceAll('-', '_'),
      ),
    );
    const rest = content.competitions.minimumRestDays + 1;
    for (const fixture of state.fixtures.filter(({ competitionId }) =>
      stateIds.has(competitionId),
    ))
      for (const day of preliminary)
        expect(Math.abs(dayOf(fixture.date) - day)).toBeGreaterThanOrEqual(
          rest,
        );
  });
});
