/**
 * Converts the owner's `football-field` FBX into the optimised GLB served by
 * the 3D match stage (ADR 0012 §4).
 *
 *   pnpm --filter @footebas/web stadium:convert
 *
 * Runs in Node with Three's FBXLoader + GLTFExporter (no native tooling):
 *  - bakes the FBX node transform (rotation/scale) into the geometry;
 *  - re-orients and rescales the field so that the painted line box is
 *    105 m long along +X and the grass surface sits at y = 0 (see
 *    `components/match-stage/projection.ts` for the matching constants);
 *  - drops the texture references: the stage attaches `football_field_tex.png`
 *    and the ground AO itself, so the GLB stays geometry-only (~3 KB);
 *  - copies the two textures next to the GLB.
 *
 * Output: `apps/web/public/assets/stadium/`.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// FBXLoader/GLTFExporter touch a few browser globals even for geometry-only
// work; these shims are enough for a headless conversion.
globalThis.self = globalThis;
globalThis.document = {
  createElementNS: () => ({
    addEventListener() {},
    removeEventListener() {},
    set src(_value) {},
  }),
};
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
};

const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const { GLTFExporter } =
  await import('three/examples/jsm/exporters/GLTFExporter.js');

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const source = resolve(repoRoot, 'football-field');
const output = resolve(here, '../public/assets/stadium');

/** Painted line box inside the grass texture, measured in UV space. */
const LINE_BOX = {
  u0: 20.5 / 512,
  u1: 490.5 / 512,
  v0: 20 / 351,
  v1: 330 / 351,
};
/** Target length of the painted line box, in metres (world units). */
const FIELD_LENGTH = 105;

const fbx = readFileSync(resolve(source, 'source/football_field.fbx'));
const group = new FBXLoader().parse(
  fbx.buffer.slice(fbx.byteOffset, fbx.byteOffset + fbx.byteLength),
  '',
);
group.updateMatrixWorld(true);

let mesh;
group.traverse((object) => {
  if (object.isMesh && !mesh) mesh = object;
});
if (!mesh) throw new Error('No mesh found in football_field.fbx');

const geometry = mesh.geometry.clone();
geometry.applyMatrix4(mesh.matrixWorld);
geometry.computeBoundingBox();
const box = geometry.boundingBox;
const size = new THREE.Vector3();
box.getSize(size);

// The FBX is a box 800 x 110 x 1200 after its node transform: the long axis
// (texture u, goal to goal) ends up on Z. Rotate it onto X.
geometry.rotateY(Math.PI / 2);
geometry.computeBoundingBox();
box.getSize(size);
const lineLength = size.x * (LINE_BOX.u1 - LINE_BOX.u0);
const scale = FIELD_LENGTH / lineLength;
geometry.scale(scale, scale, scale);
geometry.computeBoundingBox();
const center = new THREE.Vector3();
box.getCenter(center);
geometry.translate(-center.x, -box.max.y, -center.z);
geometry.computeBoundingBox();
geometry.computeVertexNormals();

const materials = (
  Array.isArray(mesh.material) ? mesh.material : [mesh.material]
).map(
  (material) =>
    new THREE.MeshStandardMaterial({
      name: material.name,
      color: material.color,
      roughness: 1,
      metalness: 0,
    }),
);
const baked = new THREE.Mesh(geometry, materials);
baked.name = 'football_field';

const glb = await new Promise((done, fail) => {
  new GLTFExporter().parse(baked, (result) => done(Buffer.from(result)), fail, {
    binary: true,
  });
});

mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'football_field.glb'), glb);
copyFileSync(
  resolve(source, 'textures/football_field_tex.png'),
  resolve(output, 'football_field_tex.png'),
);
copyFileSync(
  resolve(source, 'textures/internal_ground_ao_texture.jpeg'),
  resolve(output, 'ground_ao.jpg'),
);

const finalSize = new THREE.Vector3();
geometry.boundingBox.getSize(finalSize);
console.log(
  `football_field.glb: ${glb.byteLength} bytes; field box ` +
    `${finalSize.x.toFixed(2)} x ${finalSize.y.toFixed(2)} x ${finalSize.z.toFixed(2)} m; ` +
    `line box ${FIELD_LENGTH} x ${(finalSize.z * (LINE_BOX.v1 - LINE_BOX.v0)).toFixed(2)} m`,
);
