// Pixel-art crests cut from the owner's Série A/B/C and Libertadores sheets
// (docs/09 decision 3, revised 2026-10-23). Clubs without one keep the
// generated emblem. Real crests are trademarks: see FINALIZATION-CHECKLIST.md.
const AVAILABLE = new Set<string>([
  'club_amazonas',
  'club_america_mineiro',
  'club_anapolis',
  'club_athletico_paranaense',
  'club_atletico_goianiense',
  'club_atletico_mineiro',
  'club_avai',
  'club_bahia',
  'club_barra_sc',
  'club_botafogo',
  'club_botafogo_pb',
  'club_botafogo_sp',
  'club_brusque',
  'club_caxias',
  'club_ceara',
  'club_chapecoense',
  'club_confianca',
  'club_coquimbo_unido',
  'club_corinthians',
  'club_coritiba',
  'club_crb',
  'club_criciuma',
  'club_cruzeiro',
  'club_cuiaba',
  'club_deportes_tolima',
  'club_estudiantes',
  'club_ferroviaria',
  'club_figueirense',
  'club_flamengo',
  'club_floresta',
  'club_fluminense',
  'club_fortaleza',
  'club_goias',
  'club_gremio',
  'club_guarani',
  'club_independiente_del_valle',
  'club_independiente_rivadavia',
  'club_inter_de_limeira',
  'club_internacional',
  'club_itabaiana',
  'club_ituano',
  'club_juventude',
  'club_ldu_quito',
  'club_londrina',
  'club_maranhao',
  'club_maringa',
  'club_mirassol',
  'club_nautico',
  'club_novorizontino',
  'club_operario_pr',
  'club_palmeiras',
  'club_paysandu',
  'club_platense',
  'club_ponte_preta',
  'club_red_bull_bragantino',
  'club_rosario_central',
  'club_santa_cruz',
  'club_santos',
  'club_sao_bernardo',
  'club_sao_paulo',
  'club_sport',
  'club_universidad_catolica',
  'club_vila_nova',
  'club_vitoria',
  'club_volta_redonda',
  'club_ypiranga_rs',
]);

/** `club_<slug>` from a catalog id or a display name ("São Paulo" → club_sao_paulo). */
export function crestIdFor(name: string, id?: string): string {
  if (id) return id.startsWith('club_') ? id : `club_${id}`;
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `club_${slug}`;
}

/** Public path of the crest, or undefined when the club has none. */
export function crestFor(name: string, id?: string): string | undefined {
  const key = crestIdFor(name, id);
  return AVAILABLE.has(key) ? `/crests/${key}.png` : undefined;
}
