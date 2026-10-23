/**
 * Server refusals in Portuguese. The domain and application speak English
 * internally ("injured or suspended players cannot be selected for
 * matchday"); the player never sees that text. Known refusals get their own
 * message, a refusal the server already wrote in Portuguese passes through,
 * and anything else falls back to a message for its error code.
 */
const KNOWN: readonly (readonly [RegExp, string])[] = [
  [
    /injured or suspended players cannot be selected/i,
    'Há jogadores lesionados ou suspensos na escalação. Troque-os por atletas disponíveis e tente de novo.',
  ],
  [
    /fewer than eleven available players/i,
    'Não há 11 jogadores disponíveis no elenco: lesionados e suspensos não podem entrar em campo.',
  ],
  [
    /goalkeeper slot requires a goalkeeper|lineup has no goalkeeper|exactly one starting goalkeeper|cannot fill GK/i,
    'A escalação precisa de um goleiro disponível no gol.',
  ],
  [/exactly 11 starters/i, 'A escalação precisa de exatamente 11 titulares.'],
  [/bench cannot exceed/i, 'O banco passou do limite de reservas.'],
  [
    /lineup players must be unique/i,
    'Um mesmo jogador aparece duas vezes na escalação.',
  ],
  [/captain must be a starter/i, 'O capitão precisa estar entre os titulares.'],
  [
    /slots do not match the selected formation/i,
    'As posições da escalação não batem com a formação escolhida.',
  ],
  [
    /outside the (?:selected club|club snapshot)|absent from snapshot|belongs to another club/i,
    'A escalação tem um jogador que não está mais no elenco. Atualize a tela e escale de novo.',
  ],
  [
    /confirm lineup\/tactics first/i,
    'Escolha o clube e confirme escalação e tática antes da partida.',
  ],
  [
    /simulation is already pending/i,
    'Já há uma partida sendo simulada. Aguarde o resultado.',
  ],
  [
    /fixture not found|throughDate does not reach/i,
    'A próxima partida não foi encontrada. Atualize a tela e tente de novo.',
  ],
  [
    /match instructions can only target the managed club/i,
    'As instruções da partida só valem para o seu time.',
  ],
];

const BY_CODE: Readonly<Record<string, string>> = {
  VALIDATION_ERROR: 'O servidor recusou a operação. Revise e tente de novo.',
  NOT_FOUND: 'Não encontramos o que foi pedido. Atualize a tela.',
  FORBIDDEN: 'Essa operação não é permitida nesta carreira.',
  VERSION_CONFLICT:
    'A carreira mudou em outro lugar. Os dados foram recarregados; tente de novo.',
  UNAUTHORIZED: 'Sua sessão expirou. Entre novamente.',
};

/** Accents or words English refusals never use ("Seu plano permite 1 carreira."). */
const PORTUGUESE =
  /[áàâãéêíóôõúç]|\b(?:seu|sua|seus|suas|uma|um|da|dos|das|na|nos|nas|em|para|pelo|pela|com|que|carreiras?|plano|clube|jogador(?:es)?|partida|elenco)\b/i;

/**
 * The message the player sees for a failed request. `fallback` covers a
 * refusal with an unknown code; without one the generic refusal is used.
 */
export function serverErrorMessage(
  code: string | undefined,
  message: string | undefined,
  fallback?: string,
): string {
  if (message) {
    const known = KNOWN.find(([pattern]) => pattern.test(message));
    if (known) return known[1];
    if (PORTUGUESE.test(message)) return message;
  }
  if (code && BY_CODE[code]) return BY_CODE[code];
  if (fallback) return fallback;
  return code || message
    ? 'O servidor recusou a operação. Revise e tente de novo.'
    : 'Não foi possível falar com o servidor.';
}
