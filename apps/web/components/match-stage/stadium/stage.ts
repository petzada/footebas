/**
 * The 3D match stage: a real-time broadcast of the highlights the official
 * timeline produced, with open play in between. Render-only: it reads the
 * `StageController` clock and never feeds anything back into the score, the
 * events or the statistics.
 *
 * Three.js and its add-ons are imported here, on demand, so none of it ships
 * in the initial bundle.
 */
import type * as ThreeTypes from 'three';
import type { Kit } from '@/lib/club-kits';
import { luminance } from '@/lib/club-kits';
import type { MatchReplayInput, ReplaySide } from '@/lib/match-replay-model';
import {
  PHASES,
  hashSeed,
  sampleStageNormalized,
  type NormalizedStageFrame,
  type StageAction,
  type StageOverlay,
  type StageSegment,
} from '../choreography';
import { advanceController, type StageController } from '../controller';
import {
  GOAL_CUT,
  directionAt,
  isGoal,
  type DirectionMode,
} from '../direction';
import {
  cameraFor,
  dampCamera,
  isCut,
  pitchToWorld,
  type CameraRig,
  type CameraShot,
} from '../projection';
import { AGENTS, TEAM_SIZE, createAmbient } from './ambient';
import {
  ATHLETE_HEIGHT,
  createAthletes,
  physiqueFor,
  type AthleteLook,
} from './athletes';
import { ambienceFor, createEnvironment } from './environment';
import {
  ACTION_CONTACT,
  ACTION_SECONDS,
  actionPose,
  emptyPose,
  locomotionPose,
  mixPose,
  smooth,
  type ActionKind,
} from './pose';
import { QUALITY, type QualitySettings, type QualityTier } from './quality';

type Three = typeof ThreeTypes;

export const STAND_MODEL_URL = '/assets/stadium/stand.glb';

/** Things the stage tells the outside world so sound can follow the picture. */
export type StageCue = Readonly<{
  kind: 'kick' | 'tackle' | 'net' | 'save' | 'post' | 'whistle';
  power: number;
}>;

export interface StadiumStageOptions {
  readonly host: HTMLElement;
  readonly controller: StageController;
  readonly match: MatchReplayInput;
  readonly quality: QualityTier;
  readonly onReady: () => void;
  readonly onError: (error: unknown) => void;
  /** Fired only when the visible overlay changes (goal, card, sub...). */
  readonly onOverlay: (overlay: StageOverlay | null) => void;
  /** Live, celebration, slow-motion replay or back to open play. */
  readonly onMode?: (mode: DirectionMode) => void;
  readonly onCue?: (cue: StageCue) => void;
  /** 0..1: how loud the stands should be right now. */
  readonly onExcitement?: (level: number) => void;
  /** One call per rendered frame with the rAF timestamp (FPS probe). */
  readonly onFrame?: (now: number) => void;
}

export interface StadiumStageHandle {
  /** Restarts the render loop after React changed the controller. */
  wake(): void;
  /** Stops rendering (hidden tab); `wake` resumes. */
  sleep(): void;
  setQuality(tier: QualityTier): void;
  dispose(): void;
}

const REFEREE = AGENTS;
const BALL_RADIUS = 0.17;
const TRAIL = 9;
const CONFETTI = 320;

interface Runner {
  x: number;
  z: number;
  facing: number;
  speed: number;
  stride: number;
  visible: boolean;
  /** Identity on screen, to repaint the kit when a substitute comes on. */
  look: string;
  /** Open-play movement in flight: kind and the time it started. */
  move: { kind: ActionKind; at: number } | null;
}

function overlayKey(overlay: StageOverlay | null): string {
  if (!overlay) return '';
  const target = 'playerKey' in overlay ? overlay.playerKey : '';
  return `${overlay.kind}:${overlay.side}:${target}`;
}

function turn(from: number, to: number, amount: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * Math.min(1, amount);
}

function paintBall(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  context.fillStyle = '#f7f7f2';
  context.fillRect(0, 0, 256, 128);
  context.fillStyle = '#15181d';
  // Dark panels spread like the vertices of an icosahedron.
  const rows = [
    { v: 0.02, count: 1, shift: 0 },
    { v: 0.32, count: 5, shift: 0 },
    { v: 0.68, count: 5, shift: 0.1 },
    { v: 0.98, count: 1, shift: 0 },
  ];
  for (const row of rows)
    for (let index = 0; index < row.count; index += 1) {
      const u = (index / row.count + row.shift) % 1;
      const stretch = 1 / Math.max(0.25, Math.sin(Math.PI * row.v));
      for (const wrap of [-1, 0, 1]) {
        context.beginPath();
        context.ellipse(
          (u + wrap) * 256,
          row.v * 128,
          17 * stretch,
          15,
          0,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    }
  return canvas;
}

function lookOf(kit: Kit, id: string, number: number): AthleteLook {
  const physique = physiqueFor(id);
  return {
    shirt: kit.shirt,
    sleeve: kit.trim === kit.shirt ? kit.shirt : kit.shirt,
    shorts: kit.shorts,
    socks: kit.socks,
    boots: physique.boots,
    skin: physique.skin,
    hair: physique.hair,
    numberInk: kit.number,
    number,
  };
}

/** Real seconds per unit of choreography progress, for timing body moves. */
function secondsPerProgress(
  segment: StageSegment,
  mode: DirectionMode,
): number {
  const seconds = segment.durationMs / 1000;
  if (!isGoal(segment)) return seconds;
  if (mode === 'replay')
    return (
      (seconds * (GOAL_CUT.replay - GOAL_CUT.celebration)) /
      (GOAL_CUT.replayUntil - GOAL_CUT.replayFrom)
    );
  if (mode === 'celebration')
    return (
      (seconds * (GOAL_CUT.celebration - GOAL_CUT.live)) /
      (1 - GOAL_CUT.liveUntil)
    );
  return (seconds * GOAL_CUT.live) / GOAL_CUT.liveUntil;
}

/** Loads Three, builds the stadium and starts rendering. */
export async function createStadiumStage(
  options: StadiumStageOptions,
): Promise<StadiumStageHandle> {
  const THREE = (await import('three')) as Three;
  const { host, controller, match } = options;
  const seed = hashSeed(match.matchId);
  let settings: QualitySettings = QUALITY[options.quality];

  // --- Renderer. ------------------------------------------------------------
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    display: 'block',
    width: '100%',
    height: '100%',
  });
  host.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.enabled = settings.shadows;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 2000);
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // The stand model is a nicety: without it the stadium uses plain terraces.
  let stand: ThreeTypes.Object3D | null = null;
  try {
    const { GLTFLoader } =
      await import('three/examples/jsm/loaders/GLTFLoader.js');
    stand = await new Promise<ThreeTypes.Object3D>((resolve, reject) => {
      new GLTFLoader().load(
        STAND_MODEL_URL,
        (gltf) => resolve(gltf.scene),
        undefined,
        reject,
      );
    });
  } catch {
    stand = null;
  }

  const kits = controller.kits;
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const environment = createEnvironment(THREE, {
    scene,
    quality: settings,
    ambience: ambienceFor(seed),
    seed,
    anisotropy,
    homeColour: kits.home.shirt,
    homeTrim: kits.home.trim,
    awayColour: kits.away.shirt,
    homeName: match.home.name,
    stand,
  });
  renderer.toneMappingExposure = environment.exposure;

  const athletes = createAthletes(THREE, AGENTS + 1, {
    shadows: settings.shadows,
    anisotropy,
  });
  scene.add(athletes.group);

  // --- Ball, its shadow and the shot trail. -----------------------------------
  const ballTexture = track(new THREE.CanvasTexture(paintBall()));
  ballTexture.colorSpace = THREE.SRGBColorSpace;
  const ball = new THREE.Mesh(
    track(new THREE.SphereGeometry(BALL_RADIUS, 20, 14)),
    track(
      new THREE.MeshStandardMaterial({ map: ballTexture, roughness: 0.45 }),
    ),
  );
  ball.castShadow = true;
  scene.add(ball);
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 32;
  shadowCanvas.height = 32;
  const shadowContext = shadowCanvas.getContext('2d');
  if (shadowContext) {
    const gradient = shadowContext.createRadialGradient(16, 16, 1, 16, 16, 15);
    gradient.addColorStop(0, 'rgba(0,0,0,0.7)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    shadowContext.fillStyle = gradient;
    shadowContext.fillRect(0, 0, 32, 32);
  }
  const ballShadow = new THREE.Mesh(
    track(new THREE.PlaneGeometry(0.7, 0.7)),
    track(
      new THREE.MeshBasicMaterial({
        map: track(new THREE.CanvasTexture(shadowCanvas)),
        transparent: true,
        depthWrite: false,
      }),
    ),
  );
  ballShadow.rotation.x = -Math.PI / 2;
  ballShadow.renderOrder = 1;
  scene.add(ballShadow);
  const trailGeometry = track(
    new THREE.SphereGeometry(BALL_RADIUS * 0.9, 10, 8),
  );
  const trail = Array.from({ length: TRAIL }, (_, index) => {
    const mesh = new THREE.Mesh(
      trailGeometry,
      track(
        new THREE.MeshBasicMaterial({
          color: '#fff6c4',
          transparent: true,
          opacity: 0.42 * (1 - index / TRAIL),
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );
    mesh.scale.setScalar(1 - index / (TRAIL * 1.4));
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });
  const trailPoints: ThreeTypes.Vector3[] = [];

  // --- Marker under the athlete of the moment, card and confetti. -------------
  const marker = new THREE.Mesh(
    track(new THREE.RingGeometry(0.72, 0.9, 40)),
    track(
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    ),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.05;
  marker.visible = false;
  marker.renderOrder = 2;
  scene.add(marker);

  const cardMaterial = track(
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }),
  );
  const card = new THREE.Mesh(
    track(new THREE.PlaneGeometry(0.2, 0.28)),
    cardMaterial,
  );
  card.visible = false;
  scene.add(card);

  const confettiPositions = new Float32Array(CONFETTI * 3);
  const confettiColours = new Float32Array(CONFETTI * 3);
  const confettiGeometry = track(new THREE.BufferGeometry());
  confettiGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(confettiPositions, 3),
  );
  confettiGeometry.setAttribute(
    'color',
    new THREE.BufferAttribute(confettiColours, 3),
  );
  const confetti = new THREE.Points(
    confettiGeometry,
    track(
      new THREE.PointsMaterial({
        size: 0.22,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
      }),
    ),
  );
  confetti.visible = false;
  confetti.frustumCulled = false;
  scene.add(confetti);
  const confettiSeeds = Array.from({ length: CONFETTI }, (_, index) => {
    // Golden-angle spread: deterministic, no PRNG needed.
    const angle = index * 2.399963;
    const ring = (index % 9) / 9;
    return {
      vx: Math.cos(angle) * (2 + ring * 9),
      vz: Math.sin(angle) * (2 + ring * 9),
      vy: 9 + ((index * 13) % 11),
      palette: index % 4,
    };
  });
  let confettiSide: ReplaySide | null = null;
  const scratchColour = new THREE.Color();
  const paintConfetti = (side: ReplaySide) => {
    const kit = kits[side];
    const palette = [kit.shirt, kit.trim, '#ffffff', kit.shirt];
    confettiSeeds.forEach((particle, index) => {
      scratchColour.set(palette[particle.palette]!);
      confettiColours[index * 3] = scratchColour.r;
      confettiColours[index * 3 + 1] = scratchColour.g;
      confettiColours[index * 3 + 2] = scratchColour.b;
    });
    confettiGeometry.getAttribute('color').needsUpdate = true;
    confettiSide = side;
  };

  // --- Post-processing (bloom, vignette, grain). -------------------------------
  type Composer = {
    render(delta?: number): void;
    setSize(width: number, height: number): void;
    setPixelRatio(ratio: number): void;
    dispose(): void;
  };
  let composer: Composer | null = null;
  let composerRequested = false;
  const grainUniforms = { tDiffuse: { value: null }, uTime: { value: 0 } };
  let disposed = false;
  const buildComposer = async () => {
    if (composerRequested) return;
    composerRequested = true;
    try {
      const [
        { EffectComposer },
        { RenderPass },
        { UnrealBloomPass },
        { ShaderPass },
        { OutputPass },
      ] = await Promise.all([
        import('three/examples/jsm/postprocessing/EffectComposer.js'),
        import('three/examples/jsm/postprocessing/RenderPass.js'),
        import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
        import('three/examples/jsm/postprocessing/ShaderPass.js'),
        import('three/examples/jsm/postprocessing/OutputPass.js'),
      ]);
      if (disposed || !settings.post) return;
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      const target = new THREE.WebGLRenderTarget(size.x, size.y, {
        type: THREE.HalfFloatType,
        samples: settings.samples,
      });
      const built = new EffectComposer(renderer, target);
      built.addPass(new RenderPass(scene, camera));
      built.addPass(
        new UnrealBloomPass(
          new THREE.Vector2(size.x / 2, size.y / 2),
          0.32,
          0.7,
          0.92,
        ),
      );
      built.addPass(
        new ShaderPass({
          uniforms: grainUniforms,
          vertexShader:
            'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
            void main(){
              vec4 colour = texture2D(tDiffuse, vUv);
              float edge = smoothstep(0.92, 0.28, length(vUv - 0.5));
              colour.rgb *= mix(0.68, 1.0, edge);
              float noise = fract(sin(dot(vUv * vec2(1920.0, 1080.0) + uTime, vec2(12.9898, 78.233))) * 43758.5453);
              colour.rgb += (noise - 0.5) * 0.014;
              gl_FragColor = colour;
            }`,
        }),
      );
      built.addPass(new OutputPass());
      composer = built;
      resize();
    } catch {
      // Post-processing is optional: the plain renderer keeps the match on.
      composer = null;
    }
  };
  const dropComposer = () => {
    composer?.dispose();
    composer = null;
    composerRequested = false;
  };

  // --- Match state on screen. -------------------------------------------------
  const ambient = createAmbient(seed);
  const runners: Runner[] = Array.from({ length: AGENTS + 1 }, () => ({
    x: 0,
    z: 0,
    facing: 0,
    speed: 0,
    stride: 0,
    visible: true,
    look: '',
    move: null,
  }));
  const offsets = Array.from({ length: AGENTS }, () => ({ x: 0, z: 0 }));
  const ballOffset = new THREE.Vector3();
  const ballPosition = new THREE.Vector3(0, BALL_RADIUS, 0);
  const ballPrevious = new THREE.Vector3(0, BALL_RADIUS, 0);
  const spinAxis = new THREE.Vector3();
  const locomotion = emptyPose();
  const action = emptyPose();
  const pose = emptyPose();
  const winner: ReplaySide | null =
    match.finalScore.home === match.finalScore.away
      ? null
      : match.finalScore.home > match.finalScore.away
        ? 'home'
        : 'away';

  type Scene = 'pre' | 'highlight' | 'open' | 'post';
  let sceneState: Scene = 'pre';
  let lastStep = -1;
  let lastMode: DirectionMode = 'rest';
  let lastProgress = 0;
  let lastOverlay = '';
  let time = 0;
  let excitement = 0.1;
  let reportedExcitement = -1;
  let snapMotion = true;
  let rig: CameraRig = cameraFor({ kind: 'aerial', angle: Math.PI / 2 });
  let shotKind: CameraShot['kind'] = 'aerial';

  const frameAt = (step: number, p: number): NormalizedStageFrame =>
    sampleStageNormalized(controller.choreography, step, p);

  const identity = (segment: StageSegment, index: number, swapped: boolean) => {
    const side: ReplaySide = index < TEAM_SIZE ? 'home' : 'away';
    const slot = index % TEAM_SIZE;
    const before = segment.lineupBefore[side][slot] ?? null;
    const after = segment.lineupAfter[side][slot] ?? null;
    return { side, slot, player: swapped ? (after ?? before) : before };
  };

  const dress = (segment: StageSegment, swapped: boolean) => {
    for (let index = 0; index < AGENTS; index += 1) {
      const { side, slot, player } = identity(segment, index, swapped);
      if (!player) continue;
      const key = `${player.id}:${player.number}`;
      const runner = runners[index]!;
      if (runner.look === key) continue;
      runner.look = key;
      const kit =
        slot === 0
          ? side === 'home'
            ? kits.homeKeeper
            : kits.awayKeeper
          : kits[side];
      athletes.setLook(index, lookOf(kit, player.id, player.number));
    }
  };
  athletes.setLook(REFEREE, lookOf(kits.referee, 'referee', 0));
  runners[REFEREE]!.look = 'referee';

  /** Puts everybody where a choreography frame says, with no easing. */
  const snapTo = (frame: NormalizedStageFrame) => {
    frame.players.forEach((player, index) => {
      const world = pitchToWorld(player);
      const runner = runners[index]!;
      runner.x = world.x;
      runner.z = world.z;
      runner.visible = player.visible;
      runner.speed = 0;
      runner.move = null;
    });
    const world = pitchToWorld(frame.ball, frame.ball.height);
    ballPosition.set(world.x, world.y + BALL_RADIUS, world.z);
    ballPrevious.copy(ballPosition);
    snapMotion = true;
  };

  const startOpenPlay = (segment: StageSegment, mode: 'play' | 'kickoff') => {
    ambient.reset({
      positions: runners.slice(0, AGENTS),
      ball: ballPosition,
      active: runners.slice(0, AGENTS).map((_, index) => {
        const side: ReplaySide = index < TEAM_SIZE ? 'home' : 'away';
        return segment.lineupAfter[side][index % TEAM_SIZE] !== null;
      }),
      anchors: segment.anchors,
      mode,
      // The side that conceded restarts; the home side opens the match.
      side:
        segment.overlay?.kind === 'goal'
          ? segment.overlay.side === 'home'
            ? 'away'
            : 'home'
          : 'home',
    });
  };

  const emit = (kind: StageCue['kind'], power = 1) =>
    options.onCue?.({ kind, power });

  /** Body movement of an athlete during a highlight, from its actions. */
  const actedPose = (
    segment: StageSegment,
    key: string,
    p: number,
    perP: number,
    facing: number,
  ): number => {
    let best = 0;
    for (const item of segment.actions) {
      if (item.playerKey !== key) continue;
      const span = ACTION_SECONDS[item.kind] / perP;
      let weight: number;
      let t: number;
      if (item.until === undefined) {
        t = (p - (item.p - ACTION_CONTACT[item.kind] * span)) / span;
        if (t <= 0 || t >= 1) continue;
        weight = smooth(t / 0.14) * (1 - smooth((t - 0.82) / 0.18));
      } else {
        if (p < item.p) continue;
        t = (p - item.p) / span;
        weight =
          smooth(t / 0.25) *
          (item.until >= 1 ? 1 : 1 - smooth((p - item.until) / (span * 0.6)));
        if (weight <= 0) continue;
      }
      if (weight <= best) continue;
      best = weight;
      const side = sideOfDive(item, facing);
      actionPose(action, item.kind, t, time, side);
    }
    return best;
  };
  const sideOfDive = (item: StageAction, facing: number) => {
    if (item.kind !== 'dive') return 1;
    // `lean` is along the pitch width (world Z); express it in his own frame.
    const lateral = -Math.sin(facing) * (item.lean ?? 1);
    return lateral >= 0 ? 1 : -1;
  };

  // --- One frame. -------------------------------------------------------------
  const cameraPosition = new THREE.Vector3();
  const applyRig = () => {
    camera.position.set(rig.position.x, rig.position.y, rig.position.z);
    camera.lookAt(rig.target.x, rig.target.y, rig.target.z);
    if (Math.abs(camera.fov - rig.fov) > 0.001) {
      camera.fov = rig.fov;
      camera.updateProjectionMatrix();
    }
    cameraPosition.copy(camera.position);
  };

  const update = (dt: number) => {
    const paused = controller.paused;
    const wasPlaying = controller.progress < 1;
    advanceController(controller, dt * 1000);
    const step = controller.step;
    const last = controller.choreography.segments.length - 1;
    const segment = controller.choreography.segments[step]!;
    const stepChanged = step !== lastStep;
    const playing = controller.progress < 1 && step > 0;
    let overlay: StageOverlay | null = null;
    let direction = directionAt(segment, controller.progress);
    let shot: CameraShot;
    let wanted = 0.1;
    let involved = -1;
    let frame: NormalizedStageFrame | null = null;

    if (stepChanged && !playing) {
      // Skipped or rewound: jump straight to the rest pose of that minute.
      dress(segment, true);
      snapTo(frameAt(step, 1));
      if (step > 0 && step < last) startOpenPlay(segment, 'play');
      sceneState = step === 0 ? 'pre' : step >= last ? 'post' : 'open';
    } else if (stepChanged) {
      // A highlight begins from wherever open play left everybody.
      const start = frameAt(step, 0);
      start.players.forEach((player, index) => {
        const world = pitchToWorld(player);
        const runner = runners[index]!;
        offsets[index]!.x = runner.x - world.x;
        offsets[index]!.z = runner.z - world.z;
        runner.move = null;
      });
      const world = pitchToWorld(start.ball, start.ball.height);
      ballOffset.set(
        ballPosition.x - world.x,
        ballPosition.y - (world.y + BALL_RADIUS),
        ballPosition.z - world.z,
      );
      sceneState = 'highlight';
      lastMode = 'live';
      lastProgress = 0;
    } else if (sceneState === 'highlight' && !playing && wasPlaying) {
      // The highlight is over: hand the pitch back to open play.
      if (step >= last) sceneState = 'post';
      else {
        startOpenPlay(segment, isGoal(segment) ? 'kickoff' : 'play');
        sceneState = 'open';
        snapMotion = isGoal(segment);
        if (isGoal(segment)) {
          ballPosition.set(0, BALL_RADIUS, 0);
          ballPrevious.copy(ballPosition);
        }
      }
    } else if (
      sceneState === 'pre' &&
      step === 0 &&
      !paused &&
      controller.progress >= 1
    ) {
      // Kickoff.
      dress(segment, true);
      snapTo(frameAt(0, 1));
      startOpenPlay(segment, 'kickoff');
      sceneState = 'open';
      emit('whistle');
    }
    lastStep = step;

    if (sceneState === 'highlight') {
      direction = directionAt(segment, controller.progress);
      const p = direction.p;
      frame = frameAt(step, p);
      dress(segment, p >= PHASES.action);
      if (direction.mode !== lastMode) {
        if (direction.mode === 'replay' || lastMode === 'replay')
          snapMotion = true;
        options.onMode?.(direction.mode);
      }
      const blend = direction.mode === 'live' ? 1 - smooth(p / 0.24) : 0;
      frame.players.forEach((player, index) => {
        const world = pitchToWorld(player);
        const runner = runners[index]!;
        runner.x = world.x + offsets[index]!.x * blend;
        runner.z = world.z + offsets[index]!.z * blend;
        runner.visible = player.visible;
        if (player.involved) involved = index;
      });
      const world = pitchToWorld(frame.ball, frame.ball.height);
      ballPosition.set(
        world.x + ballOffset.x * blend,
        world.y + BALL_RADIUS + ballOffset.y * blend,
        world.z + ballOffset.z * blend,
      );
      overlay = direction.mode === 'replay' ? null : frame.overlay;

      // Sound follows the picture: contacts, the net, the save.
      if (direction.mode === 'live' && !paused) {
        for (const item of segment.actions)
          if (
            item.until === undefined &&
            lastProgress < item.p &&
            p >= item.p &&
            (item.kind === 'pass' ||
              item.kind === 'shot' ||
              item.kind === 'header')
          )
            emit('kick', item.kind === 'pass' ? 0.5 : 1);
        if (lastProgress < PHASES.action && p >= PHASES.action) {
          if (segment.overlay?.kind === 'goal') {
            environment.shakeNet(segment.overlay.side);
            emit('net');
          } else if (segment.overlay?.kind === 'chance') {
            const outcome = segment.overlay.outcome;
            if (outcome === 'saved' || outcome === 'blocked') emit('save');
            else if (outcome === 'post') emit('post');
          } else if (segment.overlay?.kind === 'card') emit('whistle');
        }
      }
      lastProgress = p;
      lastMode = direction.mode;

      // Crowd and camera.
      const shooting = segment.shot !== null;
      if (segment.overlay?.kind === 'goal' && p >= PHASES.action) wanted = 1;
      else if (shooting) wanted = 0.18 + 0.5 * smooth((p - PHASES.carry) / 0.3);
      else wanted = 0.16;
      const focus = { x: ballPosition.x, y: 0, z: ballPosition.z };
      const hero = involved >= 0 ? runners[involved]! : undefined;
      if (direction.mode === 'replay' && segment.overlay)
        shot = { kind: 'replay', side: segment.overlay.side, focus };
      else if (direction.mode === 'celebration' && hero)
        shot = {
          kind: 'hero',
          focus: { x: hero.x, y: 0, z: hero.z },
          // From outside the pitch looking in: his face, the game behind.
          angle:
            Math.atan2(hero.z, hero.x - Math.sign(hero.x) * 30) +
            (p - GOAL_CUT.liveUntil) * 1.6,
        };
      else if (segment.overlay?.kind === 'goal' && p >= PHASES.action)
        shot = {
          kind: 'goal',
          side: segment.overlay.side,
          intensity: (p - PHASES.action) / (GOAL_CUT.liveUntil - PHASES.action),
        };
      else if (
        hero &&
        p >= PHASES.build &&
        (segment.primary?.type === 'card' ||
          segment.primary?.type === 'injury' ||
          segment.primary?.type === 'substitution')
      )
        shot = { kind: 'close', focus: { x: hero.x, y: 0, z: hero.z } };
      else
        shot = {
          kind: 'follow',
          focus,
          zoom: shooting ? smooth((p - PHASES.open) / 0.3) : 0.15,
        };
    } else if (sceneState === 'open') {
      const events = ambient.step(
        paused ? 0 : dt * Math.min(controller.speed, 2.5),
      );
      ambient.agents.forEach((agent, index) => {
        const runner = runners[index]!;
        runner.x = agent.x;
        runner.z = agent.z;
        runner.visible = agent.active;
      });
      ballPosition.set(ambient.ball.x, ambient.ball.y + 0.01, ambient.ball.z);
      for (const event of events) {
        runners[event.index]!.move = {
          kind: event.kind === 'tackle' ? 'tackle' : 'pass',
          at:
            time -
            (event.kind === 'tackle'
              ? 0.25
              : ACTION_SECONDS.pass * ACTION_CONTACT.pass),
        };
        emit(event.kind, event.power);
      }
      wanted = ambient.settingUp ? 0.3 : 0.12;
      shot = {
        kind: 'follow',
        focus: { x: ballPosition.x, y: 0, z: ballPosition.z },
        zoom: 0.08,
      };
    } else {
      // Before kickoff and after the final whistle: the stadium from above.
      wanted = sceneState === 'post' ? 0.45 : 0.14;
      shot = { kind: 'aerial', angle: Math.PI / 2 + time * 0.05 };
    }

    // --- Referee: trails the play, books whoever needs booking. --------------
    const referee = runners[REFEREE]!;
    const booked =
      overlay?.kind === 'card' && involved >= 0 ? runners[involved]! : null;
    const refereeX = booked ? booked.x + 1.3 : ballPosition.x * 0.82 - 5;
    const refereeZ = booked ? booked.z + 0.9 : ballPosition.z * 0.6 + 7;
    if (snapMotion && sceneState !== 'highlight') {
      referee.x = refereeX;
      referee.z = refereeZ;
    } else if (!paused) {
      const ease = Math.min(1, dt * (booked ? 3 : 1.1));
      referee.x += (refereeX - referee.x) * ease;
      referee.z += (refereeZ - referee.z) * ease;
    }
    referee.visible = sceneState !== 'pre';
    if (booked && overlay?.kind === 'card') {
      cardMaterial.color.set(overlay.card === 'red' ? '#e3262b' : '#f5cf17');
      card.position.set(referee.x, ATHLETE_HEIGHT + 0.42, referee.z);
      card.quaternion.copy(camera.quaternion);
      card.visible = true;
    } else card.visible = false;

    // --- Bodies. ---------------------------------------------------------------
    const perP =
      sceneState === 'highlight'
        ? secondsPerProgress(segment, direction.mode)
        : 1;
    runners.forEach((runner, index) => {
      const previous = previousPositions[index]!;
      if (snapMotion) {
        previous.x = runner.x;
        previous.z = runner.z;
      }
      if (!paused && dt > 0) {
        const dx = runner.x - previous.x;
        const dz = runner.z - previous.z;
        const moved = Math.hypot(dx, dz);
        const speed = moved / dt;
        runner.speed +=
          (Math.min(9, speed) - runner.speed) * Math.min(1, dt * 9);
        runner.stride += moved * 2.35;
        const heading =
          runner.speed > 0.7 && moved > 0.0005
            ? Math.atan2(dx, dz)
            : Math.atan2(ballPosition.x - runner.x, ballPosition.z - runner.z);
        runner.facing = snapMotion
          ? heading
          : turn(runner.facing, heading, dt * (runner.speed > 0.7 ? 9 : 4));
        previous.x = runner.x;
        previous.z = runner.z;
      }
      if (!runner.visible) {
        athletes.place(index, 0, 0, 0, pose, false);
        return;
      }
      locomotionPose(
        locomotion,
        runner.stride,
        runner.speed / 7.2,
        time + index,
      );
      let weight = 0;
      if (index < AGENTS && sceneState === 'highlight') {
        const side = index < TEAM_SIZE ? 'home' : 'away';
        weight = actedPose(
          segment,
          `${side}-${index % TEAM_SIZE}`,
          direction.p,
          perP,
          runner.facing,
        );
      } else if (runner.move) {
        const t = (time - runner.move.at) / ACTION_SECONDS[runner.move.kind];
        if (t >= 1) runner.move = null;
        else if (t > 0) {
          weight = smooth(t / 0.14) * (1 - smooth((t - 0.82) / 0.18));
          actionPose(action, runner.move.kind, t, time);
        }
      } else if (sceneState === 'post' && winner && index < AGENTS) {
        if (index < TEAM_SIZE === (winner === 'home')) {
          weight = 1;
          actionPose(action, 'celebrate', 1, time + index * 0.37);
        }
      }
      mixPose(pose, locomotion, action, weight);
      if (index === REFEREE && booked) {
        pose.shoulderR = 2.95;
        pose.elbowR = 0.1;
        pose.armOutR = 0.15;
      }
      athletes.place(index, runner.x, runner.z, runner.facing, pose, true);
    });
    athletes.commit();

    // --- Ball. -------------------------------------------------------------------
    if (snapMotion) ballPrevious.copy(ballPosition);
    const rolled = ballPosition.distanceTo(ballPrevious);
    if (rolled > 0.0005 && !paused) {
      spinAxis
        .set(
          ballPosition.z - ballPrevious.z,
          0,
          -(ballPosition.x - ballPrevious.x),
        )
        .normalize();
      if (spinAxis.lengthSq() > 0)
        ball.rotateOnWorldAxis(spinAxis, rolled / BALL_RADIUS);
    }
    ball.position.copy(ballPosition);
    const lift = Math.max(0, ballPosition.y - BALL_RADIUS);
    ballShadow.position.set(ballPosition.x, 0.04, ballPosition.z);
    ballShadow.scale.setScalar(1 + lift * 0.35);
    (ballShadow.material as ThreeTypes.MeshBasicMaterial).opacity = Math.max(
      0.15,
      0.8 - lift * 0.12,
    );
    const flying = frame?.shotFrom !== null && frame !== null;
    if (flying && !paused) {
      trailPoints.unshift(ballPosition.clone());
      if (trailPoints.length > TRAIL) trailPoints.length = TRAIL;
    } else if (trailPoints.length > 0 && !paused) trailPoints.pop();
    trail.forEach((mesh, index) => {
      const at = trailPoints[index];
      mesh.visible = at !== undefined && index > 0;
      if (at) mesh.position.copy(at);
    });
    ballPrevious.copy(ballPosition);

    // --- Marker and confetti. ------------------------------------------------------
    const marked = involved >= 0 ? runners[involved] : undefined;
    if (marked?.visible && direction.mode !== 'replay') {
      const kit = kits[involved < TEAM_SIZE ? 'home' : 'away'];
      (marker.material as ThreeTypes.MeshBasicMaterial).color.set(
        luminance(kit.shirt) > 0.18 ? kit.shirt : kit.trim,
      );
      marker.position.set(marked.x, 0.05, marked.z);
      marker.scale.setScalar(1 + Math.sin(time * 6) * 0.07);
      marker.visible = true;
    } else marker.visible = false;

    const celebration =
      frame && segment.overlay?.kind === 'goal' && direction.mode !== 'replay'
        ? frame.celebration
        : 0;
    if (celebration > 0 && marked && segment.overlay?.kind === 'goal') {
      if (confettiSide !== segment.overlay.side)
        paintConfetti(segment.overlay.side);
      const t = celebration * 2.1;
      confettiSeeds.forEach((particle, index) => {
        confettiPositions[index * 3] = marked.x + particle.vx * t;
        confettiPositions[index * 3 + 1] = Math.max(
          0.08,
          1.6 + particle.vy * t - 4.9 * t * t,
        );
        confettiPositions[index * 3 + 2] = marked.z + particle.vz * t;
      });
      confettiGeometry.getAttribute('position').needsUpdate = true;
      confetti.visible = true;
    } else confetti.visible = false;

    // --- Overlay, crowd, camera. -----------------------------------------------------
    const key = overlayKey(overlay);
    if (key !== lastOverlay) {
      lastOverlay = key;
      options.onOverlay(overlay);
    }
    if (sceneState !== 'highlight' && lastMode !== 'rest') {
      lastMode = 'rest';
      options.onMode?.('rest');
    }
    excitement +=
      (wanted - excitement) * Math.min(1, dt * (wanted > excitement ? 5 : 0.7));
    const level = Math.round(excitement * 20) / 20;
    if (level !== reportedExcitement) {
      reportedExcitement = level;
      options.onExcitement?.(level);
    }
    const goal = cameraFor(shot);
    rig =
      isCut(shotKind, shot.kind) || snapCamera
        ? goal
        : dampCamera(rig, goal, dt * 1000, shot.kind === 'hero' ? 240 : 380);
    shotKind = shot.kind;
    snapCamera = false;
    applyRig();
    environment.update(time, dt, excitement, cameraPosition);
    snapMotion = false;
  };
  const previousPositions = runners.map(() => ({ x: 0, z: 0 }));
  let snapCamera = true;

  // --- Loop. -------------------------------------------------------------------
  let request = 0;
  let lastTime: number | undefined;
  let sleeping = false;

  const render = () => {
    if (composer) {
      grainUniforms.uTime.value = time % 97;
      composer.render();
    } else renderer.render(scene, camera);
  };

  const tick = (now: number) => {
    request = 0;
    if (disposed || sleeping) return;
    const dt =
      lastTime === undefined ? 0.016 : Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    time += dt;
    update(dt);
    render();
    options.onFrame?.(now);
    request = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (disposed || sleeping || request) return;
    lastTime = undefined;
    request = requestAnimationFrame(tick);
  };

  function resize() {
    const width = Math.max(1, host.clientWidth || 640);
    const height = Math.max(1, host.clientHeight || 360);
    const ratio = Math.min(window.devicePixelRatio || 1, settings.pixelRatio);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    composer?.setPixelRatio(ratio);
    composer?.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const observer =
    typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(resize);
  observer?.observe(host);

  const applyQuality = () => {
    renderer.shadowMap.enabled = settings.shadows;
    renderer.shadowMap.needsUpdate = true;
    athletes.setShadows(settings.shadows);
    ball.castShadow = settings.shadows;
    environment.setQuality(settings);
    if (settings.post) void buildComposer();
    else dropComposer();
    resize();
  };

  if (process.env.NODE_ENV === 'development') {
    // Development only: step the stage by hand (the loop needs a visible tab).
    (window as unknown as Record<string, unknown>).__footebasStage = {
      controller,
      advance(seconds: number) {
        for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) {
          time += 1 / 60;
          update(1 / 60);
        }
        render();
      },
      inspect: () => ({ sceneState, lastMode, shotKind, rig, step: lastStep }),
    };
  }

  // First frame before announcing ready, so the placeholder never gives way to
  // an empty canvas.
  resize();
  if (settings.post) void buildComposer();
  update(0);
  render();
  options.onReady();
  wake();

  return {
    wake() {
      sleeping = false;
      wake();
    },
    sleep() {
      sleeping = true;
      if (request) cancelAnimationFrame(request);
      request = 0;
    },
    setQuality(tier) {
      if (disposed || settings.tier === tier) return;
      settings = QUALITY[tier];
      applyQuality();
    },
    dispose() {
      disposed = true;
      if (request) cancelAnimationFrame(request);
      observer?.disconnect();
      dropComposer();
      environment.dispose();
      athletes.dispose();
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
