/**
 * Three.js stadium stage. Render-only: reads the same `StageController`
 * clock as the Phaser scene and samples `sampleStageNormalized`, so the 3D
 * stadium shows exactly the trajectories the 2D stages show. Nothing here
 * feeds back into the score, the events or the statistics.
 *
 * Retro look: fixed low-resolution render target (320–480 px wide) blown up
 * by CSS with crisp pixels, nearest-filtered pixel-art sprites as
 * billboards, blob shadows, no post-processing.
 */
import type * as ThreeTypes from 'three';
import type { ReplaySide } from '@/lib/match-replay-model';
import {
  sampleStageNormalized,
  type NormalizedStageFrame,
  type StageOverlay,
} from './choreography';
import { advanceController, type StageController } from './match-scene';
import {
  RUN_FRAMES,
  confettiPalette,
  paintBall,
  paintBoard,
  paintCard,
  paintCrowd,
  paintInjury,
  paintNet,
  paintPlayer,
  paintShadow,
} from './pixel-art';
import {
  FIELD,
  cameraFor,
  cameraSettled,
  dampCamera,
  goalLineX,
  pitchToWorld,
  renderSizeFor,
  runFrame,
  type CameraRig,
  type WorldPoint,
} from './projection';
import type { StageTheme } from './theme';

type Three = typeof ThreeTypes;

export const STADIUM_ASSETS = {
  model: '/assets/stadium/football_field.glb',
  grass: '/assets/stadium/football_field_tex.png',
  groundAo: '/assets/stadium/ground_ao.jpg',
} as const;

export interface ThreeStageOptions {
  readonly host: HTMLElement;
  readonly controller: StageController;
  readonly theme: StageTheme;
  readonly assets?: typeof STADIUM_ASSETS;
  readonly onReady: () => void;
  readonly onError: (error: unknown) => void;
  /** Fired only when the visible overlay changes (goal, card, sub...). */
  readonly onOverlay: (overlay: StageOverlay | null) => void;
  /** One call per rendered frame with the rAF timestamp (FPS probe). */
  readonly onFrame?: (now: number) => void;
}

export interface ThreeStageHandle {
  /** Restarts the render loop after React changed the controller. */
  wake(): void;
  /** Stops rendering (hidden tab); `wake` resumes. */
  sleep(): void;
  dispose(): void;
}

const CONFETTI = 140;
const TRAIL = 6;
const PLAYER_HEIGHT = 2.8;
const BALL_SIZE = 1.2;

function overlayKey(overlay: StageOverlay | null): string {
  if (!overlay) return '';
  const target = 'playerKey' in overlay ? overlay.playerKey : '';
  return `${overlay.kind}:${overlay.side}:${target}`;
}

/** Loads Three and the stadium, builds the scene and starts rendering. */
export async function createThreeStage(
  options: ThreeStageOptions,
): Promise<ThreeStageHandle> {
  const THREE = (await import('three')) as Three;
  const { GLTFLoader } =
    await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { host, controller, theme } = options;
  const assets = options.assets ?? STADIUM_ASSETS;
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // --- Renderer: low resolution, pixel-doubled by CSS. --------------------
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    display: 'block',
    width: '100%',
    height: '100%',
    imageRendering: 'pixelated',
  });
  host.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'low-power',
    alpha: false,
  });
  // The retro target is already far below device resolution: never scale
  // by the device pixel ratio (the cap of 2 from the Phaser stage is moot).
  renderer.setPixelRatio(1);
  const size = renderSizeFor(host.clientWidth || 360);
  renderer.setSize(size.width, size.height, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#7cc4ea');
  scene.fog = new THREE.Fog('#9fd3ee', 140, 260);
  const camera = new THREE.PerspectiveCamera(
    34,
    size.width / size.height,
    1,
    400,
  );
  const initialRig = cameraFor({
    kind: 'follow',
    focus: { x: 0, y: 0, z: 0 },
    zoom: 0,
  });
  let rig: CameraRig = initialRig;
  let goalRig: CameraRig = initialRig;
  const applyRig = () => {
    camera.position.set(rig.position.x, rig.position.y, rig.position.z);
    camera.lookAt(rig.target.x, rig.target.y, rig.target.z);
    if (camera.fov !== rig.fov) {
      camera.fov = rig.fov;
      camera.updateProjectionMatrix();
    }
  };
  applyRig();

  // --- Lights: simple key + sky, no shadow maps (blob shadows instead). ---
  scene.add(new THREE.HemisphereLight('#ffffff', '#2f7d3a', 1.1));
  const sun = new THREE.DirectionalLight('#fff2cc', 1.3);
  sun.position.set(40, 90, 30);
  scene.add(sun);

  const pixelTexture = (image: HTMLCanvasElement | HTMLImageElement) => {
    const texture = new THREE.Texture(image);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return track(texture);
  };

  // --- Stands, crowd and boards around the island. -------------------------
  const crowd = pixelTexture(paintCrowd(controller.choreography.matchId));
  crowd.wrapS = THREE.RepeatWrapping;
  crowd.wrapT = THREE.RepeatWrapping;
  crowd.repeat.set(14, 1);
  const standMaterial = track(
    new THREE.MeshLambertMaterial({ map: crowd, color: '#bfb7a8' }),
  );
  const standGeometry = track(
    new THREE.BoxGeometry(FIELD.islandLength + 28, 15, 12),
  );
  const endGeometry = track(new THREE.BoxGeometry(12, 15, FIELD.islandWidth));
  const standOffsetZ = FIELD.islandWidth / 2 + 10;
  const standOffsetX = FIELD.islandLength / 2 + 10;
  for (const z of [-standOffsetZ, standOffsetZ]) {
    const stand = new THREE.Mesh(standGeometry, standMaterial);
    stand.position.set(0, -FIELD.islandDepth + 7.5, z);
    scene.add(stand);
  }
  for (const x of [-standOffsetX, standOffsetX]) {
    const stand = new THREE.Mesh(endGeometry, standMaterial);
    stand.position.set(x, -FIELD.islandDepth + 7.5, 0);
    scene.add(stand);
  }
  const boardGeometry = track(new THREE.BoxGeometry(26, 1.1, 0.3));
  theme.boards.forEach((_, index) => {
    const material = track(
      new THREE.MeshBasicMaterial({
        map: pixelTexture(paintBoard(theme, index)),
      }),
    );
    const x = (index - (theme.boards.length - 1) / 2) * 27;
    for (const [z, flip] of [
      [-(FIELD.lineWidth / 2 + 3.2), 0],
      [FIELD.lineWidth / 2 + 3.6, Math.PI],
    ] as const) {
      const board = new THREE.Mesh(boardGeometry, material);
      board.position.set(x, 0.55, z);
      board.rotation.y = flip;
      scene.add(board);
    }
  });

  // --- Goals: posts, crossbar and a pixel net. ------------------------------
  const postMaterial = track(
    new THREE.MeshLambertMaterial({ color: theme.colors.post }),
  );
  const netTexture = pixelTexture(paintNet(theme));
  netTexture.wrapS = THREE.RepeatWrapping;
  netTexture.wrapT = THREE.RepeatWrapping;
  netTexture.repeat.set(FIELD.goalWidth / 0.45, FIELD.goalHeight / 0.45);
  const netMaterial = track(
    new THREE.MeshBasicMaterial({
      map: netTexture,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const postGeometry = track(new THREE.BoxGeometry(0.3, FIELD.goalHeight, 0.3));
  const barGeometry = track(
    new THREE.BoxGeometry(0.3, 0.3, FIELD.goalWidth + 0.3),
  );
  const backNet = track(
    new THREE.PlaneGeometry(FIELD.goalWidth, FIELD.goalHeight),
  );
  const sideNet = track(
    new THREE.PlaneGeometry(FIELD.goalDepth, FIELD.goalHeight),
  );
  const topNet = track(
    new THREE.PlaneGeometry(FIELD.goalDepth, FIELD.goalWidth),
  );
  for (const side of ['home', 'away'] as const) {
    const lineX = goalLineX(side);
    const behind = Math.sign(lineX) * FIELD.goalDepth;
    for (const z of [-FIELD.goalWidth / 2, FIELD.goalWidth / 2]) {
      const post = new THREE.Mesh(postGeometry, postMaterial);
      post.position.set(lineX, FIELD.goalHeight / 2, z);
      scene.add(post);
      const sideMesh = new THREE.Mesh(sideNet, netMaterial);
      sideMesh.position.set(lineX + behind / 2, FIELD.goalHeight / 2, z);
      sideMesh.rotation.y = Math.PI / 2;
      scene.add(sideMesh);
    }
    const bar = new THREE.Mesh(barGeometry, postMaterial);
    bar.position.set(lineX, FIELD.goalHeight, 0);
    scene.add(bar);
    const back = new THREE.Mesh(backNet, netMaterial);
    back.position.set(lineX + behind, FIELD.goalHeight / 2, 0);
    back.rotation.y = Math.PI / 2;
    scene.add(back);
    const top = new THREE.Mesh(topNet, netMaterial);
    top.position.set(lineX + behind / 2, FIELD.goalHeight, 0);
    top.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    scene.add(top);
  }

  // --- Players, ball, shadows, plates, confetti. ----------------------------
  const spriteCache = new Map<string, ThreeTypes.Texture>();
  const playerTexture = (side: ReplaySide, number: number, frame: number) => {
    const color = controller.colors[side];
    const key = `${color}:${number}:${frame}`;
    let texture = spriteCache.get(key);
    if (!texture) {
      texture = pixelTexture(paintPlayer(theme, color, number, frame));
      spriteCache.set(key, texture);
    }
    return texture;
  };
  const shadowTexture = pixelTexture(paintShadow(theme));
  const shadowMaterial = track(
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: theme.shadowAlpha,
      depthWrite: false,
    }),
  );
  const shadowGeometry = track(new THREE.PlaneGeometry(1.8, 0.6));
  const makeShadow = (scale = 1) => {
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    shadow.scale.setScalar(scale);
    scene.add(shadow);
    return shadow;
  };

  const initial = frameOf();
  const players = initial.players.map((player) => {
    const material = track(
      new THREE.SpriteMaterial({
        map: playerTexture(player.side, player.number, 0),
        alphaTest: 0.5,
      }),
    );
    const sprite = new THREE.Sprite(material);
    sprite.center.set(0.5, 0);
    sprite.scale.set(PLAYER_HEIGHT * (11 / 15), PLAYER_HEIGHT, 1);
    scene.add(sprite);
    return {
      sprite,
      material,
      shadow: makeShadow(),
      number: player.number,
      frame: 0,
      distance: 0,
      last: pitchToWorld(player),
    };
  });

  const ballTexture = pixelTexture(paintBall(theme));
  const ballMaterial = track(
    new THREE.SpriteMaterial({ map: ballTexture, alphaTest: 0.5 }),
  );
  const ball = new THREE.Sprite(ballMaterial);
  ball.scale.set(BALL_SIZE, BALL_SIZE, 1);
  scene.add(ball);
  const ballShadow = makeShadow(0.55);
  const trail = Array.from({ length: TRAIL }, (_, index) => {
    const material = track(
      new THREE.SpriteMaterial({
        map: ballTexture,
        transparent: true,
        opacity: 0.55 * (1 - index / TRAIL),
        depthWrite: false,
      }),
    );
    const sprite = new THREE.Sprite(material);
    const scale = BALL_SIZE * (0.8 - (index / TRAIL) * 0.5);
    sprite.scale.set(scale, scale, 1);
    sprite.visible = false;
    scene.add(sprite);
    return sprite;
  });
  const trailPoints: WorldPoint[] = [];

  const plateTextures = {
    yellow: pixelTexture(paintCard(theme, 'yellow')),
    red: pixelTexture(paintCard(theme, 'red')),
    injury: pixelTexture(paintInjury(theme)),
  };
  const plateMaterial = track(
    new THREE.SpriteMaterial({ map: plateTextures.yellow, alphaTest: 0.5 }),
  );
  const plate = new THREE.Sprite(plateMaterial);
  plate.center.set(0.5, 0);
  plate.scale.set(1.3, 1.95, 1);
  plate.visible = false;
  scene.add(plate);

  const confettiPositions = new Float32Array(CONFETTI * 3);
  const confettiColors = new Float32Array(CONFETTI * 3);
  const confettiGeometry = track(new THREE.BufferGeometry());
  confettiGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(confettiPositions, 3),
  );
  confettiGeometry.setAttribute(
    'color',
    new THREE.BufferAttribute(confettiColors, 3),
  );
  const confettiMaterial = track(
    new THREE.PointsMaterial({
      size: 3,
      sizeAttenuation: false,
      vertexColors: true,
    }),
  );
  const confetti = new THREE.Points(confettiGeometry, confettiMaterial);
  confetti.visible = false;
  confetti.frustumCulled = false;
  scene.add(confetti);
  let confettiSide: ReplaySide | null = null;
  const confettiSeeds = Array.from({ length: CONFETTI }, (_, index) => {
    // Golden-angle spread: deterministic, no PRNG needed.
    const angle = index * 2.399963;
    const ring = (index % 7) / 7;
    return {
      vx: Math.cos(angle) * (4 + ring * 9),
      vz: Math.sin(angle) * (4 + ring * 9),
      vy: 9 + ((index * 13) % 10),
      palette: index % 5,
    };
  });
  const colorScratch = new THREE.Color();
  const paintConfetti = (side: ReplaySide) => {
    const palette = confettiPalette(controller.colors[side]);
    confettiSeeds.forEach((seed, index) => {
      colorScratch.set(palette[seed.palette]!);
      confettiColors[index * 3] = colorScratch.r;
      confettiColors[index * 3 + 1] = colorScratch.g;
      confettiColors[index * 3 + 2] = colorScratch.b;
    });
    confettiGeometry.getAttribute('color').needsUpdate = true;
    confettiSide = side;
  };

  // --- The stadium model and its textures. ---------------------------------
  const textureLoader = new THREE.TextureLoader();
  const loadTexture = (url: string) =>
    new Promise<ThreeTypes.Texture>((resolve, reject) => {
      textureLoader.load(
        url,
        (texture) => resolve(track(texture)),
        undefined,
        reject,
      );
    });
  const loadModel = (url: string) =>
    new Promise<ThreeTypes.Group>((resolve, reject) => {
      new GLTFLoader().load(
        url,
        (gltf) => resolve(gltf.scene),
        undefined,
        reject,
      );
    });

  const disposeAll = () => {
    spriteCache.forEach((texture) => texture.dispose());
    disposables.forEach((item) => item.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  };

  let grass: ThreeTypes.Texture;
  let groundAo: ThreeTypes.Texture;
  let field: ThreeTypes.Group;
  try {
    [grass, groundAo, field] = await Promise.all([
      loadTexture(assets.grass),
      loadTexture(assets.groundAo),
      loadModel(assets.model),
    ]);
  } catch (error) {
    // A missing model or texture: release the context and let the caller
    // drop to the Phaser scene.
    disposeAll();
    throw error;
  }
  grass.magFilter = THREE.NearestFilter;
  grass.minFilter = THREE.LinearMipmapLinearFilter;
  grass.colorSpace = THREE.SRGBColorSpace;
  // The GLB keeps glTF's UV convention (origin top-left), like GLTFLoader.
  grass.flipY = false;
  grass.needsUpdate = true;
  field.traverse((object) => {
    const mesh = object as ThreeTypes.Mesh;
    if (!mesh.isMesh) return;
    const sources = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    const replaced = sources.map((source) => {
      const color = (source as ThreeTypes.MeshStandardMaterial).color;
      const isGrass = source.name === 'football_field';
      source.dispose();
      return track(
        new THREE.MeshLambertMaterial({
          color: isGrass ? '#ffffff' : color,
          map: isGrass ? grass : null,
        }),
      );
    });
    mesh.material = Array.isArray(mesh.material) ? replaced : replaced[0]!;
    track(mesh.geometry);
  });
  scene.add(field);

  groundAo.colorSpace = THREE.NoColorSpace;
  const groundGeometry = track(new THREE.PlaneGeometry(210, 210));
  const groundMaterial = track(
    new THREE.MeshBasicMaterial({ map: groundAo, color: '#6b4119' }),
  );
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  ground.position.y = -FIELD.islandDepth - 0.1;
  scene.add(ground);

  // --- Frame application. ----------------------------------------------------
  function frameOf(): NormalizedStageFrame {
    return sampleStageNormalized(
      controller.choreography,
      controller.step,
      controller.progress,
    );
  }

  let lastStep = controller.step;
  let lastOverlay = overlayKey(null);
  let trailActive = false;

  function apply(frame: NormalizedStageFrame, snapped: boolean) {
    frame.players.forEach((player, index) => {
      const entry = players[index];
      if (!entry) return;
      const world = pitchToWorld(player);
      if (snapped) {
        entry.distance = 0;
      } else {
        entry.distance += Math.hypot(
          world.x - entry.last.x,
          world.z - entry.last.z,
        );
      }
      entry.last = world;
      const frameIndex = runFrame(entry.distance, RUN_FRAMES);
      if (entry.number !== player.number || entry.frame !== frameIndex) {
        entry.number = player.number;
        entry.frame = frameIndex;
        entry.material.map = playerTexture(
          player.side,
          player.number,
          frameIndex,
        );
      }
      const celebrating =
        frame.overlay?.kind === 'goal' &&
        frame.overlay.playerKey === player.key;
      const hop = celebrating
        ? Math.abs(Math.sin(frame.progress * 40)) * 0.9 * frame.celebration
        : 0;
      entry.sprite.position.set(world.x, hop, world.z);
      entry.sprite.visible = player.visible;
      entry.shadow.position.set(world.x, 0.03, world.z);
      entry.shadow.visible = player.visible;
    });

    const ballWorld = pitchToWorld(frame.ball, frame.ball.height);
    ball.position.set(ballWorld.x, ballWorld.y + BALL_SIZE / 2, ballWorld.z);
    ballShadow.position.set(ballWorld.x, 0.04, ballWorld.z);
    const lift = Math.min(1, frame.ball.height * 1.4);
    ballShadow.scale.setScalar(0.55 * (1 + lift * 0.4));

    if (frame.shotFrom) {
      trailPoints.unshift(ballWorld);
      if (trailPoints.length > TRAIL + 1) trailPoints.length = TRAIL + 1;
      trailActive = true;
    } else if (trailPoints.length > 0) {
      trailPoints.pop();
      trailActive = trailPoints.length > 0;
    }
    trail.forEach((sprite, index) => {
      const point = trailPoints[index + 1];
      sprite.visible = point !== undefined;
      if (point) sprite.position.set(point.x, point.y + BALL_SIZE / 2, point.z);
    });

    const overlay = frame.overlay;
    const target =
      overlay && 'playerKey' in overlay
        ? frame.players.find((player) => player.key === overlay.playerKey)
        : undefined;
    if (target && (overlay?.kind === 'card' || overlay?.kind === 'injury')) {
      plateMaterial.map =
        overlay.kind === 'card'
          ? plateTextures[overlay.card]
          : plateTextures.injury;
      const world = pitchToWorld(target);
      plate.position.set(world.x, PLAYER_HEIGHT + 0.3, world.z);
      plate.visible = true;
    } else {
      plate.visible = false;
    }

    if (overlay?.kind === 'goal' && frame.celebration > 0 && target) {
      if (confettiSide !== overlay.side) paintConfetti(overlay.side);
      const origin = pitchToWorld(target);
      const t = frame.celebration * 1.6;
      confettiSeeds.forEach((seed, index) => {
        confettiPositions[index * 3] = origin.x + seed.vx * t;
        confettiPositions[index * 3 + 1] = Math.max(
          0.1,
          1.5 + seed.vy * t - 9.8 * t * t * 0.5,
        );
        confettiPositions[index * 3 + 2] = origin.z + seed.vz * t;
      });
      confettiGeometry.getAttribute('position').needsUpdate = true;
      confetti.visible = true;
    } else {
      confetti.visible = false;
    }

    const key = overlayKey(overlay);
    if (key !== lastOverlay) {
      lastOverlay = key;
      options.onOverlay(overlay);
    }

    // Camera: follow the ball, react to shots, push in on goals.
    if (overlay?.kind === 'goal' && frame.celebration > 0) {
      goalRig = cameraFor({
        kind: 'goal',
        side: overlay.side,
        intensity: frame.celebration,
      });
    } else {
      goalRig = cameraFor({
        kind: 'follow',
        focus: ballWorld,
        zoom: frame.shotFrom ? 1 : 0,
      });
    }
    if (snapped) rig = goalRig;
  }

  // --- Loop. -----------------------------------------------------------------
  let request = 0;
  let lastTime: number | undefined;
  let sleeping = false;
  let disposed = false;

  const tick = (now: number) => {
    request = 0;
    if (disposed || sleeping) return;
    const delta = lastTime === undefined ? 16 : now - lastTime;
    lastTime = now;
    const moving = advanceController(controller, delta);
    // `syncController` sets progress 1 for skips and rewinds (snap to the
    // rest pose) and 0 for the natural next step (continuous motion).
    const snapped = controller.step !== lastStep && controller.progress >= 1;
    lastStep = controller.step;
    apply(frameOf(), snapped);
    rig = dampCamera(rig, goalRig, delta);
    applyRig();
    renderer.render(scene, camera);
    options.onFrame?.(now);
    const settled = !moving && cameraSettled(rig, goalRig) && !trailActive;
    if (settled) {
      lastTime = undefined;
      return;
    }
    request = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (disposed || sleeping || request) return;
    lastTime = undefined;
    request = requestAnimationFrame(tick);
  };

  const resize = () => {
    const next = renderSizeFor(host.clientWidth || 360);
    renderer.setSize(next.width, next.height, false);
    camera.aspect = next.width / next.height;
    camera.updateProjectionMatrix();
    wake();
  };
  const observer =
    typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(resize);
  observer?.observe(host);

  // First frame before announcing ready, so the 2D placeholder never gives
  // way to an empty canvas.
  apply(frameOf(), true);
  applyRig();
  renderer.render(scene, camera);
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
    dispose() {
      disposed = true;
      if (request) cancelAnimationFrame(request);
      observer?.disconnect();
      disposeAll();
    },
  };
}
