import type { CoachPersonality } from '@footebas/domain';

/**
 * Tone of the generated inbox (docs/09 decision 4, ADR 0007): the senders
 * write the same message, but the answers the coach can give, and the note
 * the coach adds to notices, follow the personality. Placeholders: {player},
 * {club}, {wage}, {until}.
 */
export type InboxVoiceKey =
  | 'board_objective.take_responsibility'
  | 'board_objective.demand_squad'
  | 'board_objective.ask_patience'
  | 'board_ultimatum.promise_results'
  | 'board_ultimatum.defend_project'
  | 'board_sale.list_player'
  | 'board_sale.refuse'
  | 'board_reinforcement.commit'
  | 'board_reinforcement.decline'
  | 'player_minutes.promise_minutes'
  | 'player_minutes.deny'
  | 'player_minutes.list_player'
  | 'player_renewal.accept'
  | 'player_renewal.deny'
  | 'press_win.praise_group'
  | 'press_win.stay_humble'
  | 'press_win.provoke'
  | 'press_draw.see_positives'
  | 'press_draw.demand_more'
  | 'press_draw.blame_referee'
  | 'press_loss.take_blame'
  | 'press_loss.criticize_squad'
  | 'press_loss.blame_referee'
  | 'notice_contract_end.renew'
  | 'notice_contract_end.release'
  | 'note.injury'
  | 'note.suspension'
  | 'note.window_open'
  | 'note.window_closing';

export const INBOX_VOICE: Readonly<
  Record<CoachPersonality, Readonly<Record<InboxVoiceKey, string>>>
> = Object.freeze({
  motivador: Object.freeze({
    'board_objective.take_responsibility':
      '"A responsabilidade é minha. Vamos virar isso juntos!"',
    'board_objective.demand_squad':
      '"O grupo sabe que precisa de mais entrega. Vou cobrar com carinho."',
    'board_objective.ask_patience':
      '"Peço paciência: esse elenco tem coração e vai reagir."',
    'board_ultimatum.promise_results':
      '"Vou tirar o melhor de cada um. Os resultados vêm."',
    'board_ultimatum.defend_project':
      '"A torcida está com a gente. Confiem no que estamos construindo."',
    'board_sale.list_player':
      '"Entendo o momento. Coloco {player} à venda, com respeito pela história dele."',
    'board_sale.refuse':
      '"Não dá para desmontar o grupo agora. Confiem em mim."',
    'board_reinforcement.commit':
      '"Ótimo! Um reforço vai levantar ainda mais o vestiário."',
    'board_reinforcement.decline':
      '"Eu acredito nesse elenco. Prefiro dar chance a quem já está aqui."',
    'player_minutes.promise_minutes':
      '"{player}, sua hora vai chegar. Conte com minutos em breve!"',
    'player_minutes.deny':
      '"{player}, entendo a vontade, mas hoje o time precisa de outra formação."',
    'player_minutes.list_player':
      '"{player}, se quiser jogar mais, vou ajudar a encontrar um clube."',
    'player_renewal.accept':
      '"{player}, você é parte dessa família. Renovamos até {until} ({wage}/mês)."',
    'player_renewal.deny':
      '"{player}, agora não é o momento de renovar. Seguimos conversando."',
    'press_win.praise_group':
      '"Esse grupo tem alma! A vitória é de cada um deles e da torcida."',
    'press_win.stay_humble':
      '"Foi um passo. Pé no chão e coração quente para o próximo jogo."',
    'press_win.provoke':
      '"Avisei que íamos ganhar. Quem duvidou do {club} vai ter que engolir."',
    'press_draw.see_positives':
      '"Teve muita garra em campo. Esse ponto vai valer muito."',
    'press_draw.demand_more':
      '"Dá para mais, e o grupo sabe disso. Vamos buscar a vitória."',
    'press_draw.blame_referee':
      '"Nos tiraram uma vitória no apito. A torcida viu."',
    'press_loss.take_blame':
      '"A derrota é minha. Os jogadores deram tudo; vamos levantar juntos."',
    'press_loss.criticize_squad':
      '"Faltou entrega hoje. Quero ver mais vontade em cada lance."',
    'press_loss.blame_referee':
      '"Fomos prejudicados pela arbitragem, e isso machuca o grupo."',
    'notice_contract_end.renew':
      '"Quero {player} com a gente: renovar até {until} ({wage}/mês)."',
    'notice_contract_end.release':
      '"Vou agradecer a {player} e deixar o contrato terminar."',
    'note.injury': 'Força, {player}! O grupo vai esperar sua volta.',
    'note.suspension': '{player} volta mais forte depois da suspensão.',
    'note.window_open': 'Janela aberta: hora de sonhar com reforços!',
    'note.window_closing': 'Últimos dias de janela. Vamos fechar bem!',
  }),
  disciplinador: Object.freeze({
    'board_objective.take_responsibility':
      '"Assumo. O padrão de trabalho vai subir a partir de amanhã."',
    'board_objective.demand_squad':
      '"Quem não render vai perder espaço. Vou cobrar o elenco."',
    'board_objective.ask_patience':
      '"O método precisa de tempo. Peço que mantenham o planejamento."',
    'board_ultimatum.promise_results':
      '"Treinos dobrados e cobrança total. O resultado vai aparecer."',
    'board_ultimatum.defend_project':
      '"O trabalho é sério e a torcida reconhece. Mantenham o rumo."',
    'board_sale.list_player':
      '"De acordo. {player} está na lista de transferências."',
    'board_sale.refuse': '"Não vendo peça do sistema no meio do trabalho."',
    'board_reinforcement.commit':
      '"Aceito, desde que o reforço se adapte às nossas regras."',
    'board_reinforcement.decline':
      '"O elenco atual cumpre o método. Não preciso de mais ninguém."',
    'player_minutes.promise_minutes':
      '"{player}, mostre no treino e terá minutos."',
    'player_minutes.deny':
      '"{player}, espaço se conquista no treino, não com pedido."',
    'player_minutes.list_player':
      '"{player}, quem não aceita a hierarquia pode procurar outro clube."',
    'player_renewal.accept':
      '"{player}, cumpre o que é pedido. Renovado até {until} ({wage}/mês)."',
    'player_renewal.deny':
      '"{player}, renovação só depois de mais regularidade."',
    'press_win.praise_group':
      '"O grupo cumpriu o plano de treino à risca. É isso que exijo."',
    'press_win.stay_humble':
      '"Venceu, mas ainda erramos muito. Amanhã tem treino cedo."',
    'press_win.provoke':
      '"Fomos superiores do início ao fim. O {club} impôs o padrão."',
    'press_draw.see_positives':
      '"A organização defensiva funcionou. Vamos ajustar o resto."',
    'press_draw.demand_more':
      '"Empate não é aceitável. Vai haver cobrança na semana."',
    'press_draw.blame_referee':
      '"A arbitragem errou e isso interferiu no resultado."',
    'press_loss.take_blame': '"O erro foi meu na preparação. Vou corrigir."',
    'press_loss.criticize_squad':
      '"Inaceitável. Quem não estiver no limite vai perder espaço."',
    'press_loss.blame_referee':
      '"Houve erros graves de arbitragem que decidiram o jogo."',
    'notice_contract_end.renew':
      '"{player} segue as regras: renovar até {until} ({wage}/mês)."',
    'notice_contract_end.release':
      '"Contrato de {player} termina e não será renovado."',
    'note.injury': '{player} segue o protocolo médico à risca até voltar.',
    'note.suspension':
      '{player} vai treinar em dobro enquanto cumpre a suspensão.',
    'note.window_open': 'Janela aberta. Só entra quem servir ao método.',
    'note.window_closing': 'Janela fechando. Prazos são para cumprir.',
  }),
  diplomata: Object.freeze({
    'board_objective.take_responsibility':
      '"Agradeço a franqueza. Assumo e sigo alinhado com a diretoria."',
    'board_objective.demand_squad':
      '"Vou conversar com o grupo para todos entenderem o momento."',
    'board_objective.ask_patience':
      '"Proponho uma conversa: com um pouco de paciência, chegamos lá."',
    'board_ultimatum.promise_results':
      '"Entendo a posição da diretoria e me comprometo com resultados."',
    'board_ultimatum.defend_project':
      '"Peço que avaliemos o projeto como um todo, com a torcida ao lado."',
    'board_sale.list_player':
      '"Compreendo a necessidade. Coloco {player} à venda, em bons termos."',
    'board_sale.refuse':
      '"Sugiro buscarmos outra solução antes de vender agora."',
    'board_reinforcement.commit':
      '"Agradeço o apoio. Vamos buscar o reforço juntos."',
    'board_reinforcement.decline':
      '"Agradeço, mas prefiro preservar as finanças do clube."',
    'player_minutes.promise_minutes':
      '"{player}, ouvi você. Vamos encontrar minutos em breve."',
    'player_minutes.deny':
      '"{player}, entendo, mas peço paciência por enquanto."',
    'player_minutes.list_player':
      '"{player}, se for melhor para você, ajudo a encontrar um bom destino."',
    'player_renewal.accept':
      '"{player}, acordo fechado: renovamos até {until} ({wage}/mês)."',
    'player_renewal.deny':
      '"{player}, agradeço o pedido. Voltamos a conversar mais adiante."',
    'press_win.praise_group':
      '"Vitória de todos: diretoria, atletas, funcionários e torcida."',
    'press_win.stay_humble':
      '"Respeito muito o adversário. Seguimos trabalhando com serenidade."',
    'press_win.provoke': '"O {club} mostrou hoje quem manda nesta casa."',
    'press_draw.see_positives':
      '"Um empate respeitoso contra um bom adversário."',
    'press_draw.demand_more':
      '"Já conversei com o grupo: queremos mais e vamos buscar."',
    'press_draw.blame_referee':
      '"Com todo respeito, a arbitragem nos prejudicou hoje."',
    'press_loss.take_blame':
      '"Assumo a derrota e já conversei com a diretoria e o grupo."',
    'press_loss.criticize_squad':
      '"Conversei com o elenco: precisamos de mais comprometimento."',
    'press_loss.blame_referee':
      '"Vamos encaminhar à federação os lances que nos prejudicaram."',
    'notice_contract_end.renew':
      '"Proponho renovar com {player} até {until} ({wage}/mês)."',
    'notice_contract_end.release':
      '"{player} sai em bons termos ao fim do contrato."',
    'note.injury': 'Todo o apoio a {player} na recuperação.',
    'note.suspension':
      'Vamos respeitar a decisão e preparar o time sem {player}.',
    'note.window_open': 'Janela aberta: boa hora para negociar com calma.',
    'note.window_closing': 'Janela fechando: vamos concluir as conversas.',
  }),
  estrategista: Object.freeze({
    'board_objective.take_responsibility':
      '"Os números apontam falhas no plano. Assumo e já tenho as correções."',
    'board_objective.demand_squad':
      '"A execução está abaixo do planejado. Vou cobrar o elenco."',
    'board_objective.ask_patience':
      '"Os indicadores melhoram; o resultado vem em poucas rodadas."',
    'board_ultimatum.promise_results':
      '"Revi todo o modelo de jogo. As próximas partidas terão outro plano."',
    'board_ultimatum.defend_project':
      '"O projeto tem dados sólidos. Peço que olhem além da tabela."',
    'board_sale.list_player':
      '"Faz sentido financeiro. {player} entra na lista de transferências."',
    'board_sale.refuse':
      '"{player} é peça do sistema. Vender agora custa pontos."',
    'board_reinforcement.commit':
      '"Já mapeei o setor que precisa de reforço. Vamos buscar."',
    'board_reinforcement.decline':
      '"O sistema atual não precisa de mudança. Prefiro guardar a verba."',
    'player_minutes.promise_minutes':
      '"{player}, você está no plano das próximas partidas."',
    'player_minutes.deny':
      '"{player}, o plano tático atual pede outro perfil."',
    'player_minutes.list_player':
      '"{player}, você não encaixa no modelo. Vamos buscar uma saída."',
    'player_renewal.accept':
      '"{player}, você está no planejamento: renovado até {until} ({wage}/mês)."',
    'player_renewal.deny':
      '"{player}, a renovação não cabe no planejamento agora."',
    'press_win.praise_group':
      '"O grupo executou o plano com perfeição. Os números confirmam."',
    'press_win.stay_humble':
      '"Venceu, mas os dados mostram pontos a corrigir."',
    'press_win.provoke':
      '"Lemos o adversário melhor do que ele se leu. O {club} foi superior."',
    'press_draw.see_positives':
      '"Controlamos os espaços. O resultado não reflete o volume."',
    'press_draw.demand_more':
      '"Faltou converter. Vamos ajustar a finalização."',
    'press_draw.blame_referee':
      '"Os lances revisados mostram erros que custaram a vitória."',
    'press_loss.take_blame':
      '"Errei na leitura do jogo. Já tenho as correções."',
    'press_loss.criticize_squad': '"O plano era claro e não foi executado."',
    'press_loss.blame_referee': '"Os números da arbitragem hoje não fecham."',
    'notice_contract_end.renew':
      '"{player} segue no planejamento: renovar até {until} ({wage}/mês)."',
    'notice_contract_end.release':
      '"{player} não está no planejamento; contrato termina."',
    'note.injury': 'Plano B ajustado enquanto {player} se recupera.',
    'note.suspension': 'Já preparei a alternativa tática sem {player}.',
    'note.window_open': 'Janela aberta: alvos já mapeados por posição.',
    'note.window_closing': 'Janela fechando: hora de executar os alvos.',
  }),
});
