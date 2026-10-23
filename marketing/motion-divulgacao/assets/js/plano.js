/*
 * The film's plan: absolute times (s, 120 BPM grid: one beat = 0.5 s) and
 * frame coordinates (px) shared by the scenes and the cursor, so a click and
 * the UI it changes always land on the same frame and the same pixel.
 */
window.PLANO = {
  bpm: 120,
  beat: 0.5,
  inicio: {
    placar: 0,
    tatica: 2,
    apito: 5.9,
    letreiro: 0.7,
    estadio: 7.85,
    tabela: 14,
    clube: 18,
    campeao: 22,
    escudos: 24,
    marca: 26.2,
  },
  /* Click = the fingertip of the pixel hand; `t` is when the press lands. */
  cliques: {
    ofensiva: { t: 3.0, x: 902, y: 578 },
    f433: { t: 3.5, x: 610, y: 388 },
    pegaGaroto: { t: 4.5, x: 400, y: 340 },
    soltaGaroto: { t: 5.4, x: 1480, y: 421 },
    segundoTempo: { t: 7.0, x: 1430, y: 618 },
    vel4x: { t: 10.85, x: 925, y: 966 },
    vel1x: { t: 11.55, x: 665, y: 966 },
    preparar: { t: 13.95, x: 1010, y: 500 },
    aceitar: { t: 18.5, x: 600, y: 742 },
    proposta: { t: 19.5, x: 1360, y: 742 },
    chamada: { t: 28.0, x: 1452, y: 612 },
  },
  /* Arc (px, negative = up) of the drag from the sticker to the board. */
  arcoArraste: -90,
  /* Layout of the tactics board shared by the "tatica" scene. */
  campo: { x: 1180, y: 90, w: 600, h: 720 },
};
