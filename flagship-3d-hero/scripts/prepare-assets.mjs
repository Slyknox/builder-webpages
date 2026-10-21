// Runs before `next build`: copies the Draco/Basis decoders out of `three` so the CSP can stay 'self',
// and generates the placeholder hero model. Replace the model step once the real GLB exists.
import { cpSync, mkdirSync } from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import * as THREE from 'three';

const libs = 'node_modules/three/examples/jsm/libs';
cpSync(`${libs}/draco/gltf`, 'public/decoders/draco', { recursive: true });
cpSync(`${libs}/basis`, 'public/decoders/basis', { recursive: true });

const geo = new THREE.TorusKnotGeometry(1, 0.32, 256, 48);
const doc = new Document();
const buffer = doc.createBuffer();
const accessor = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
const prim = doc.createPrimitive()
  .setAttribute('POSITION', accessor('VEC3', new Float32Array(geo.attributes.position.array)))
  .setAttribute('NORMAL', accessor('VEC3', new Float32Array(geo.attributes.normal.array)))
  .setIndices(accessor('SCALAR', new Uint32Array(geo.index.array)))
  .setMaterial(doc.createMaterial('placeholder'));
doc.createScene().addChild(doc.createNode('knot').setMesh(doc.createMesh().addPrimitive(prim)));
doc.createExtension(KHRDracoMeshCompression).setRequired(true)
  .setEncoderOptions({ method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER });

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
mkdirSync('public/models', { recursive: true });
await io.write('public/models/hero.glb', doc);
console.log(`prepare-assets: decoders copied, hero.glb written (${geo.attributes.position.count} vertices)`);
