# OAKHAVEN — Luxury Custom Homes (3D scroll site)

A scroll-driven 3D house-construction website: the home builds itself part-by-part as you
scroll — blueprint → foundation → framing → dried in → exterior → home → a dusk
"Welcome home." push-in to the porch.

## Stack

- **Vite 5 + React 18 + Tailwind 3** — app shell, overlay UI, captions, nav
- **Three.js 0.169** (vanilla, no R3F) — scene, camera rig, part animation, bloom
- **Framer Motion** — caption / hero / welcome transitions
- **Blender 5 (headless)** — procedural house model exported to a single GLB
- **puppeteer-core + Edge** — headless screenshot verification pipeline

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build -> dist/
npm run preview
npm run blender     # rebuild public/assets/house.glb (requires Blender 5 on PATH as `blender`)
npm run shot -- "out/dir" "0,0.13,0.3,0.48,0.64,0.8,0.93,1.0"   # verification screenshots
```

## How it works

- **Scroll → progress**: native scroll drives `targetP ∈ [0,1]`, damped into `dispP`
  (frame-rate independent) each frame. `window.__jump(p)` jumps instantly (used by tests).
- **Stages** (`src/stages.js`): plan [0, .075], fnd [.075, .21], frm [.21, .405],
  dry [.405, .56], ext [.56, .72], home [.72, .885], wel [.885, 1].
  Each part reveals at `t = clamp01((stageLocal - order*0.74)/0.26)` with per-anim
  easing: pop / rise / drop / slide / grow / fade / temp (temporary framing members).
- **Model encoding** (`blender/model.py` → GLB): three.js GLTFLoader sanitizes names
  (strips `. [ ] : /`), so every part is named
  `stage|OOOO|anim|vstage|VVVV|label|ax,ay,az` with milli-unit integers; `parseParts`
  in `src/three/Scene.js` decodes it. Openings (windows/doors) are cut with `rect_diff`
  via `panel_local`; rake plates derive direction from `sign(b-a)`.
- **Dusk & glow**: near the home stage the sky/sun/fog lerp to dusk and window glass /
  bulbs / lanterns ramp emissive intensity with `glow = smooth((homeLs-0.28)/0.35)`.
- **Camera**: keyframed `CAM` array (pos/target) interpolated by progress, plus subtle
  mouse parallax and sway.

## Debug helpers

Exposed on the page: `window.__jump(p)`, `window.__scene` (`.parts`, `.apply`,
`.glowMats`, `.bulbMats`), `window.__ready`, `window.__THREE`.

Scripts in `scripts/`:
- `shot.mjs` — screenshot a list of progress points (double-capture: headless paints
  DOM one frame late, so each shot is taken twice — second is authoritative)
- `onesess.mjs` — same-session shot → hide → shot → pixel diff (diagnosis workhorse)
- `idbuf.mjs` — flat-color ID-buffer render of every mesh + legend
- `probe.mjs` / `prefixes.mjs` / `iso.mjs` / `badverts.mjs` — category/geometry triage
- `crop.mjs` — crop bands (e.g. nav strip) out of a screenshot

Notes: THREE.Raycaster is unreliable in this scene (throws on every mesh) — use
category-hide screenshots or ID buffers instead. Headless WebGL is SwiftShader-slow;
shoot subsets and use generous timeouts.
