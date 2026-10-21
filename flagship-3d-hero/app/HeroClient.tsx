'use client';

import dynamic from 'next/dynamic';

const Strategic3DCanvas = dynamic(() => import('./Strategic3DCanvas').then((m) => m.Strategic3DCanvas), {
  ssr: false,
  loading: () => <div style={{ height: '100vh', background: '#050505' }} />,
});

export function HeroClient() {
  return <Strategic3DCanvas modelUrl="/models/hero.glb" posterUrl="/poster.svg" />;
}
