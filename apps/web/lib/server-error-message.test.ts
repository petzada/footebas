import { describe, expect, it } from 'vitest';
import { serverErrorMessage } from '@/lib/server-error-message';

describe('serverErrorMessage', () => {
  it('traduz a recusa de lesionados ou suspensos do domínio', () => {
    expect(
      serverErrorMessage(
        'VALIDATION_ERROR',
        'injured or suspended players cannot be selected for matchday',
      ),
    ).toMatch(/lesionados ou suspensos/);
  });

  it('traduz as demais recusas de escalação e partida', () => {
    for (const message of [
      'club has fewer than eleven available players',
      'the goalkeeper slot requires a goalkeeper',
      'lineup slots do not match the selected formation',
      'lineup contains a player outside the selected club',
      'a simulation is already pending',
      'next managed fixture not found',
    ]) {
      const shown = serverErrorMessage('VALIDATION_ERROR', message);
      expect(shown).not.toBe(message);
      expect(shown).not.toMatch(/^O servidor recusou/);
      expect(shown).toMatch(/[áàâãéêíóôõúç]/i);
    }
  });

  it('mantém recusas já escritas em português pelo servidor', () => {
    const message =
      'Só 10 jogadores do elenco estão aptos (os demais estão lesionados ou suspensos).';
    expect(serverErrorMessage('VALIDATION_ERROR', message)).toBe(message);
    expect(
      serverErrorMessage(
        'CAREER_LIMIT_REACHED',
        'Seu plano permite 1 carreira.',
      ),
    ).toBe('Seu plano permite 1 carreira.');
  });

  it('nunca mostra inglês desconhecido: cai na mensagem do código', () => {
    expect(serverErrorMessage('FORBIDDEN', 'some new english refusal')).toBe(
      'Essa operação não é permitida nesta carreira.',
    );
    expect(serverErrorMessage('SOMETHING_ELSE', 'boom')).toMatch(
      /^O servidor recusou a operação/,
    );
    expect(serverErrorMessage(undefined, undefined)).toBe(
      'Não foi possível falar com o servidor.',
    );
    expect(
      serverErrorMessage('UPLOAD_FAILED', 'bad', 'Não foi possível enviar.'),
    ).toBe('Não foi possível enviar.');
  });
});
