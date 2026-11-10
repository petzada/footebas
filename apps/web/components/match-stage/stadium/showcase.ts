/**
 * The empty stadium as a living backdrop: the same pitch, stands, crowd and
 * floodlights of the match, seen from a slow aerial orbit. Used outside the
 * match (start screen, the club's stadium). Render-only, loaded on demand.
 */
import type * as ThreeTypes from 'three';
import { hashSeed } from '../choreography';
import { cameraFor } from '../projection';
import { createEnvironment, type Ambience } from './environment';
import { QUALITY, type QualityTier } from './quality';
import { STAND_MODEL_URL } from './stage';

type Three = typeof ThreeTypes;

export interface StadiumShowcaseOptions {
  readonly host: HTMLElement;
  readonly quality: QualityTier;
  /** Club colours for seats, fans and boards. */
  readonly colour: string;
  readonly trim: string;
  readonly name: string;
  readonly ambience?: Ambience;
  /** 0..1: share of the seats taken (the club's attendance). */
  readonly occupancy?: number;
  /** Draw one frame and stop (reduced motion). */
  readonly still?: boolean;
  readonly onReady: () => void;
}

export interface StadiumShowcaseHandle {
  wake(): void;
  sleep(): void;
  dispose(): void;
}

export async function createStadiumShowcase(
  options: StadiumShowcaseOptions,
): Promise<StadiumShowcaseHandle> {
  const THREE = (await import('three')) as Three;
  const { host } = options;
  const base = QUALITY[options.quality];
  // A backdrop never needs the full crowd, shadows or post-processing.
  const settings = {
    ...base,
    shadows: false,
    post: false,
    pixelRatio: Math.min(base.pixelRatio, 1.5),
    crowd: base.crowd * Math.max(0.15, Math.min(1, options.occupancy ?? 0.85)),
  };

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
    powerPreference: 'low-power',
    alpha: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.5, 2000);

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

  const seed = hashSeed(options.name);
  const environment = createEnvironment(THREE, {
    scene,
    quality: settings,
    ambience: options.ambience ?? 'night',
    seed,
    anisotropy: Math.min(4, renderer.capabilities.getMaxAnisotropy()),
    homeColour: options.colour,
    homeTrim: options.trim,
    awayColour: options.colour,
    homeName: options.name,
    stand,
  });
  renderer.toneMappingExposure = environment.exposure;

  const position = new THREE.Vector3();
  let time = 0;
  let request = 0;
  let last: number | undefined;
  let sleeping = false;
  let disposed = false;

  const frame = (dt: number) => {
    time += dt;
    // A slow orbit that breathes in and out: never the same picture twice.
    const rig = cameraFor({ kind: 'aerial', angle: 0.9 + time * 0.035 });
    // Above and outside the stands, so the whole bowl is in the picture.
    const lift = 1.24 + Math.sin(time * 0.11) * 0.1;
    camera.position.set(
      rig.position.x * lift,
      rig.position.y * (1.08 + Math.sin(time * 0.07) * 0.1),
      rig.position.z * lift,
    );
    camera.lookAt(rig.target.x, rig.target.y, rig.target.z);
    position.copy(camera.position);
    environment.update(time, dt, 0.16, position);
    renderer.render(scene, camera);
  };

  const tick = (now: number) => {
    request = 0;
    if (disposed || sleeping) return;
    const dt = last === undefined ? 0.016 : Math.min(0.1, (now - last) / 1000);
    last = now;
    frame(dt);
    if (!options.still) request = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (disposed || sleeping || request || options.still) return;
    last = undefined;
    request = requestAnimationFrame(tick);
  };

  const resize = () => {
    const width = Math.max(1, host.clientWidth || 640);
    const height = Math.max(1, host.clientHeight || 360);
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, settings.pixelRatio),
    );
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (options.still && !disposed) frame(0);
  };
  const observer =
    typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(resize);
  observer?.observe(host);

  resize();
  frame(0);
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
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
