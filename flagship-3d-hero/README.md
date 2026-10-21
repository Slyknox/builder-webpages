# flagship-3d-hero

Scroll-driven WebGL hero: Next.js 15, React Three Fiber, GSAP ScrollTrigger, a custom Fresnel shader, and a nonce-based Content Security Policy.

```bash
cd flagship-3d-hero
npm install
npm run build   # prebuild copies the Draco/Basis decoders out of `three` and generates the placeholder model
npm start
```

## Things to know

- **The CSP forces per-request rendering.** `middleware.ts` issues a fresh nonce on every request, so `app/layout.tsx` sets `dynamic = 'force-dynamic'`. A prerendered page carries no nonce and the browser blocks every script.
- **Decoders are self-hosted** under `/decoders/`, so `script-src` needs only `'self'` and `'wasm-unsafe-eval'`.
- **The model is a placeholder.** `scripts/prepare-assets.mjs` generates a Draco-compressed torus knot. Put the real GLB at `public/models/hero.glb` and drop the model step from the script.
- **Fallbacks:** without WebGL2, or if the model fails to load, the hero shows `public/poster.svg`. Reduced-motion visitors get a still frame.

## Deploying on Vercel

This app lives in a subfolder of `builder-webpages`. When importing the repo, set **Root Directory** to `flagship-3d-hero` and the **production branch** to the branch it's on. Vercel detects Next.js; no other settings are needed.
