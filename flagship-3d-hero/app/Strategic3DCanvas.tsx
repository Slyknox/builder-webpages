'use client';

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Center, PerformanceMonitor, useGLTF } from '@react-three/drei';
import { KTX2Loader } from 'three-stdlib';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';

gsap.registerPlugin(ScrollTrigger);

// Self-hosted so the CSP stays 'self' and there's no third-party runtime dependency
const DRACO_PATH = '/decoders/draco/';
const BASIS_PATH = '/decoders/basis/';

// One instance: every KTX2Loader spawns its own transcoder worker pool
let ktx2Loader: KTX2Loader | null = null;
const getKTX2Loader = (gl: THREE.WebGLRenderer) =>
  (ktx2Loader ??= new KTX2Loader().setTranscoderPath(BASIS_PATH).detectSupport(gl));

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uScrollProgress;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec3 p = position;
    p.x += sin(p.y * 3.0 + uTime * 2.0) * 0.08 * uScrollProgress;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vViewPosition = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform vec3 uFresnelColor;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0), 3.0);
    gl_FragColor = vec4(mix(uBaseColor, uFresnelColor, fresnel), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

// three.js r163+ is WebGL2-only. R3F's own `fallback` only covers browsers without <canvas>,
// not a failed WebGL context, so probe once and release the probe context immediately.
function useWebGL2Support() {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    setSupported(gl !== null);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }, []);
  return supported;
}

// Catches context-creation and model-load failures so the hero degrades to the poster
// instead of taking down the whole client tree
class HeroErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

type HeroModelProps = {
  modelPath: string;
  triggerRef: React.RefObject<HTMLElement | null>;
  reducedMotion: boolean;
};

function HeroModel({ modelPath, triggerRef, reducedMotion }: HeroModelProps) {
  const gl = useThree((s) => s.gl);
  const { scene } = useGLTF(modelPath, DRACO_PATH, true, (loader) =>
    loader.setKTX2Loader(getKTX2Loader(gl)),
  );
  const groupRef = useRef<THREE.Group>(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uScrollProgress: { value: 0 },
          uBaseColor: { value: new THREE.Color('#0a0a0a') },
          uFresnelColor: { value: new THREE.Color('#0055ff') },
        },
      }),
    [],
  );

  // Clone so the loader cache keeps its own materials; the originals never render,
  // so their textures never reach the GPU
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = material;
    });
    return clone;
  }, [scene, material]);

  // Geometry is the only GPU allocation this hero owns; evict the cache with it
  useEffect(
    () => () => {
      model.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
      });
      material.dispose();
      useGLTF.clear(modelPath);
    },
    [model, material, modelPath],
  );

  useEffect(() => {
    const trigger = triggerRef.current;
    const target = groupRef.current;
    if (reducedMotion || !trigger || !target) return;

    const ctx = gsap.context(() => {
      gsap
        .timeline({ scrollTrigger: { trigger, start: 'top top', end: 'bottom bottom', scrub: 0.6 } })
        .to(material.uniforms.uScrollProgress, { value: 1, ease: 'none' }, 0)
        .to(target.rotation, { y: Math.PI * 2, z: Math.PI * 0.5, ease: 'none' }, 0);
    });
    return () => ctx.revert(); // kills tweens and ScrollTriggers, restores start values
  }, [material, triggerRef, reducedMotion]);

  useFrame((_, delta) => {
    if (!reducedMotion) material.uniforms.uTime.value += delta;
  });

  return (
    <group ref={groupRef}>
      <Center>
        <primitive object={model} />
      </Center>
    </group>
  );
}

export function Strategic3DCanvas({ modelUrl, posterUrl }: { modelUrl: string; posterUrl: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [dpr, setDpr] = useState(1.5);
  const reducedMotion = usePrefersReducedMotion();
  const webgl2 = useWebGL2Support();

  // Rendered outside <canvas> and only when needed, so WebGL visitors never download it
  const poster = <img src={posterUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;

  return (
    <section ref={sectionRef} style={{ position: 'relative', width: '100%', height: '200vh' }}>
      <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', background: '#050505' }}>
        {webgl2 === false && poster}
        {webgl2 && (
          <HeroErrorBoundary fallback={poster}>
            <Canvas
              dpr={dpr}
              gl={{ antialias: true, powerPreference: 'high-performance', stencil: false }}
              camera={{ position: [0, 0, 5], fov: 45 }}
            >
              <color attach="background" args={['#050505']} />
              <PerformanceMonitor
                onDecline={() => setDpr(1)}
                onIncline={() => setDpr(Math.min(1.75, window.devicePixelRatio))}
              />
              <Suspense fallback={null}>
                <HeroModel modelPath={modelUrl} triggerRef={sectionRef} reducedMotion={reducedMotion} />
              </Suspense>
            </Canvas>
          </HeroErrorBoundary>
        )}
      </div>
    </section>
  );
}
