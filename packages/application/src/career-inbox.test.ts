/* eslint-disable @typescript-eslint/no-non-null-assertion -- the launch catalog guarantees the selected club and its squad */
import type { CanonicalValue } from '@footebas/domain';
import { InMemoryUnitOfWork } from '@footebas/database';
import { describe, expect, it } from 'vitest';
import {
  FakeBearerAuth,
  FakeClock,
  FootebasApplication,
  INBOX_VOICE,
  InMemoryJobQueue,
  InMemoryStorage,
  MAX_CONFIDENCE_EFFECT,
  MAX_MORALE_EFFECT,
  NoopTelemetry,
  SequentialIdGenerator,
  resolveInboxDecision,
  type CareerSnapshot,
  type InboxVoiceKey,
  careerSaveRepository,
} from './index.js';

type Personality = CareerSnapshot['coach']['personality'];

function setup() {
  const clock = new FakeClock();
  const auth = new FakeBearerAuth();
  const unitOfWork = new InMemoryUnitOfWork(clock);
  const app = new FootebasApplication({
    auth,
    clock,
    ids: new SequentialIdGenerator(),
    jobs: new InMemoryJobQueue(),
    storage: new InMemoryStorage(),
    telemetry: new NoopTelemetry(),
    unitOfWork,
  });
  const token = auth.issue({
    userId: 'user_owner',
    email: 'owner@example.com',
    displayName: 'Owner',
  });
  return { app, token, unitOfWork };
}

let sequence = 0;
const command = (type: string, expectedVersion: number, payload: object) => {
  sequence += 1;
  return {
    version: 1,
    type,
    commandId: `command_inbox_${String(sequence)}`,
    idempotencyKey: `idem-inbox-${String(sequence)}`,
    expectedVersion,
    payload,
  };
};

async function start(
  app: FootebasApplication,
  token: string,
  personality: Personality = 'estrategista',
) {
  const created = await app.execute(
    token,
    command('CreateCareer', 0, {
      managerName: 'Marcio',
      startDate: '2026-01-01',
      coach: { nationality: 'BR', avatar: 'avatar-01', personality },
    }),
  );
  await app.execute(
    token,
    command('SelectClub', 1, {
      careerId: created.careerId,
      clubId: 'club_flamengo',
    }),
  );
  return created.careerId;
}

const version = async (app: FootebasApplication, token: string, id: string) =>
  (await app.home(token, id)).aggregateVersion;

async function playMatch(
  app: FootebasApplication,
  token: string,
  careerId: string,
) {
  await app.execute(
    token,
    command('AutoPickLineup', await version(app, token, careerId), {
      careerId,
      clubId: 'club_flamengo',
      formation: '4-4-2',
      mode: 'best',
    }),
  );
  await app.execute(
    token,
    command('AdvanceDate', await version(app, token, careerId), { careerId }),
  );
  expect((await app.runNextJob())?.state).toBe('succeeded');
}

async function stored(unitOfWork: InMemoryUnitOfWork, careerId: string) {
  const save = (await careerSaveRepository(
    unitOfWork.repositories().saves,
  ).peek(careerId))!;
  return { save, snapshot: save.snapshot as unknown as CareerSnapshot };
}

async function pressConference(
  app: FootebasApplication,
  token: string,
  careerId: string,
) {
  const mail = (await app.home(token, careerId)).inbox.find(
    ({ topic }) => topic === 'press_conference',
  );
  expect(mail?.kind).toBe('press_conference');
  return mail!;
}

describe('caixa de entrada com decisões', () => {
  it('gera avisos e coletiva no tom da personalidade, com os mesmos efeitos', async () => {
    const { app, token } = setup();
    const motivador = await start(app, token, 'motivador');
    await playMatch(app, token, motivador);
    const other = setup();
    const disciplinador = await start(other.app, other.token, 'disciplinador');
    await playMatch(other.app, other.token, disciplinador);

    // Results may differ (personalities tilt the match), so each answer is
    // checked against its own personality's line for the same situation.
    for (const [mail, personality, rival] of [
      [
        await pressConference(app, token, motivador),
        'motivador',
        'disciplinador',
      ],
      [
        await pressConference(other.app, other.token, disciplinador),
        'disciplinador',
        'motivador',
      ],
    ] as const) {
      expect(mail.choice?.status).toBe('pending');
      const ids = mail.choice!.options.map(({ id }) => id);
      const situation = ids.includes('praise_group')
        ? 'win'
        : ids.includes('see_positives')
          ? 'draw'
          : 'loss';
      for (const option of mail.choice!.options) {
        const key = `press_${situation}.${option.id}` as InboxVoiceKey;
        expect(option.label).toBe(
          INBOX_VOICE[personality][key].replaceAll('{club}', 'Flamengo'),
        );
        expect(option.label).not.toBe(
          INBOX_VOICE[rival][key].replaceAll('{club}', 'Flamengo'),
        );
        expect(option.effects.length).toBeGreaterThan(0);
      }
    }
    // The pre-season window is open on the first match date.
    const window = async (
      application: FootebasApplication,
      bearer: string,
      id: string,
    ) =>
      (await application.home(bearer, id)).inbox.find(
        ({ topic }) => topic === 'notice_window_open',
      );
    const warm = await window(app, token, motivador);
    const strict = await window(other.app, other.token, disciplinador);
    expect(warm).toMatchObject({ kind: 'notice' });
    expect(warm?.choice).toBeUndefined();
    expect(warm?.body).toContain(
      `Marcio: ${INBOX_VOICE.motivador['note.window_open']}`,
    );
    expect(strict?.body).toContain(
      `Marcio: ${INBOX_VOICE.disciplinador['note.window_open']}`,
    );
  });

  it('resolve uma vez, aplica o efeito guardado e é idempotente', async () => {
    const { app, token, unitOfWork } = setup();
    const careerId = await start(app, token);
    await playMatch(app, token, careerId);
    const mail = await pressConference(app, token, careerId);
    const before = await stored(unitOfWork, careerId);
    const message = before.snapshot.inbox!.messages.find(
      ({ id }) => id === mail.id,
    )!;
    const chosen = message.options[0]!;
    for (const option of message.options) {
      expect(Math.abs(option.effect.board ?? 0)).toBeLessThanOrEqual(
        MAX_CONFIDENCE_EFFECT,
      );
      expect(Math.abs(option.effect.fans ?? 0)).toBeLessThanOrEqual(
        MAX_CONFIDENCE_EFFECT,
      );
      expect(Math.abs(option.effect.squadMorale ?? 0)).toBeLessThanOrEqual(
        MAX_MORALE_EFFECT,
      );
    }
    const resolve = (optionId: string, expectedVersion: number) =>
      command('ResolveInboxDecision', expectedVersion, {
        careerId,
        messageId: mail.id,
        optionId,
      });
    const first = resolve(chosen.id, before.save.version);
    await app.execute(token, first);
    // Same command again: idempotent receipt, no new version.
    expect((await app.execute(token, first)).aggregateVersion).toBe(
      before.save.version + 1,
    );
    const after = await stored(unitOfWork, careerId);
    const clamp = (value: number) => Math.max(0, Math.min(100, value));
    expect(after.snapshot.world.manager.boardConfidence).toBe(
      clamp(
        before.snapshot.world.manager.boardConfidence +
          (chosen.effect.board ?? 0),
      ),
    );
    expect(after.snapshot.world.manager.fanConfidence).toBe(
      clamp(
        before.snapshot.world.manager.fanConfidence + (chosen.effect.fans ?? 0),
      ),
    );
    const morale = (snapshot: CareerSnapshot) =>
      snapshot.players
        .filter(({ clubId }) => clubId === 'club_flamengo')
        .map(({ id, morale: value }) => [id, Number(value)] as const);
    const moraleBefore = new Map(morale(before.snapshot));
    for (const [id, value] of morale(after.snapshot))
      expect(value).toBe(
        clamp(moraleBefore.get(id)! + (chosen.effect.squadMorale ?? 0)),
      );
    const resolved = (await app.home(token, careerId)).inbox.find(
      ({ id }) => id === mail.id,
    );
    expect(resolved?.choice).toMatchObject({
      status: 'resolved',
      chosenOptionId: chosen.id,
    });

    // A new command with the same option changes nothing but the version.
    await app.execute(token, resolve(chosen.id, after.save.version));
    const again = await stored(unitOfWork, careerId);
    expect(again.snapshot.world.manager).toEqual(after.snapshot.world.manager);
    expect(morale(again.snapshot)).toEqual(morale(after.snapshot));
    // Another option on a resolved message is refused.
    await expect(
      app.execute(token, resolve(message.options[1]!.id, again.save.version)),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      app.execute(
        token,
        command('ResolveInboxDecision', again.save.version, {
          careerId,
          messageId: 'mail_unknown',
          optionId: chosen.id,
        }),
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('mensagens expiram e deixam de aceitar resposta', async () => {
    const { app, token, unitOfWork } = setup();
    const careerId = await start(app, token);
    await playMatch(app, token, careerId);
    const mail = await pressConference(app, token, careerId);
    for (let step = 0; step < 10; step++) {
      if (
        (await app.home(token, careerId)).currentDate > mail.choice!.expiresOn
      )
        break;
      await playMatch(app, token, careerId);
    }
    const home = await app.home(token, careerId);
    expect(home.currentDate > mail.choice!.expiresOn).toBe(true);
    const listed = home.inbox.find(({ id }) => id === mail.id);
    if (listed !== undefined) expect(listed.choice?.status).toBe('expired');
    const { snapshot } = await stored(unitOfWork, careerId);
    expect(
      snapshot.inbox!.messages.find(({ id }) => id === mail.id)?.status,
    ).toBe('expired');
    await expect(
      app.execute(
        token,
        command('ResolveInboxDecision', home.aggregateVersion, {
          careerId,
          messageId: mail.id,
          optionId: mail.choice!.options[0]!.id,
        }),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('renovação e venda pedidas por e-mail mexem no contrato e na lista', async () => {
    const { app, token, unitOfWork } = setup();
    const careerId = await start(app, token);
    const { snapshot } = await stored(unitOfWork, careerId);
    const [renewed, listed] = snapshot.players.filter(
      ({ clubId }) => clubId === 'club_flamengo',
    );
    const contract = snapshot.world.contracts.find(
      ({ playerId }) => playerId === renewed!.id,
    )!;
    snapshot.inbox = {
      version: 'career-inbox-v1',
      keys: [],
      messages: [
        {
          id: 'mail_test_renewal',
          kind: 'player_request',
          topic: 'player_renewal',
          subject: 'Renovação',
          body: 'Pedido',
          occurredOn: snapshot.currentDate,
          expiresOn: '2026-12-31',
          playerId: renewed!.id,
          status: 'pending',
          options: [
            {
              id: 'accept',
              label: 'Sim',
              effect: {
                renewal: {
                  wage: Number(contract.wage) + 1,
                  endsOn: '2031-12-31',
                },
                playerMorale: 5,
              },
            },
            { id: 'deny', label: 'Não', effect: { playerMorale: -10 } },
          ],
        },
        {
          id: 'mail_test_sale',
          kind: 'board_message',
          topic: 'board_sale',
          subject: 'Venda',
          body: 'Pedido',
          occurredOn: snapshot.currentDate,
          expiresOn: '2026-12-31',
          playerId: listed!.id,
          status: 'pending',
          options: [
            {
              id: 'list_player',
              label: 'Vender',
              effect: { listPlayer: true, board: 3 },
            },
            { id: 'refuse', label: 'Não', effect: { board: -4 } },
          ],
        },
      ],
    };
    expect(resolveInboxDecision(snapshot, 'mail_test_renewal', 'accept')).toBe(
      'applied',
    );
    expect(resolveInboxDecision(snapshot, 'mail_test_renewal', 'accept')).toBe(
      'unchanged',
    );
    expect(
      resolveInboxDecision(snapshot, 'mail_test_sale', 'list_player'),
    ).toBe('applied');
    const after = snapshot.world.contracts.find(
      ({ playerId }) => playerId === renewed!.id,
    )!;
    expect(after).toMatchObject({
      endsOn: '2031-12-31',
      wage: Number(contract.wage) + 1,
      revision: contract.revision + 1,
    });
    expect(
      Number(snapshot.players.find(({ id }) => id === renewed!.id)!.morale),
    ).toBe(Math.min(100, Number(renewed!.morale) + 5));
    expect(snapshot.world.market?.listings).toContainEqual(
      expect.objectContaining({
        playerId: listed!.id,
        mode: 'sale',
        askingPrice: listed!.value,
      }),
    );
  });

  it('saves sem caixa de entrada nem estatísticas carregam e passam a gravá-las', async () => {
    const { app, token, unitOfWork } = setup();
    const careerId = await start(app, token);
    await playMatch(app, token, careerId);
    const repos = {
      saves: careerSaveRepository(unitOfWork.repositories().saves),
    };
    const save = (await repos.saves.peek(careerId))!;
    const legacy = structuredClone(save.snapshot) as Record<string, unknown>;
    delete legacy.inbox;
    delete legacy.stats;
    await repos.saves.update(save.id, save.userId, save.version, {
      snapshot: legacy as CanonicalValue,
      seed: save.seed,
      versions: save.versions,
    });
    const home = await app.home(token, careerId);
    expect(
      home.inbox.filter(({ kind }) => kind === 'match_report'),
    ).toHaveLength(1);
    const season = await app.careerSeason(token, careerId);
    // Season 1 is rebuilt from career totals; positions start now.
    expect(season.topScorers.length).toBeGreaterThanOrEqual(0);
    await playMatch(app, token, careerId);
    const { snapshot } = await stored(unitOfWork, careerId);
    expect(snapshot.inbox?.version).toBe('career-inbox-v1');
    expect(snapshot.stats?.version).toBe('career-stats-v1');
    expect(snapshot.stats?.complete).toBe(false);
    expect((await app.careerSeason(token, careerId)).coverage).toBe('partial');
  });
});
