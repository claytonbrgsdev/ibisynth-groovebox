# Creative Systems Portfolio — Context

> Last updated: 2026-05-22 (rev 2)

---

## Project Overview

An interactive digital portfolio built with a **Teenage Engineering–inspired tactile aesthetic** — functional, minimal, toy-like. The project is a remix originally scaffolded from Google AI Studio (React + Vite template). It has no git repo yet.

**Dev server:** `npm run dev` → runs on port 3000 (bumps to 3002 if ports are occupied)  
**URL:** http://localhost:3002 (or whichever port Vite picks)

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | React 19, React Router v7 |
| Build | Vite 6 + TypeScript 5.8 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite` plugin) |
| Generative visuals | p5.js v2 (instance mode, wrapped in `P5Wrapper`) |
| Audio | Web Audio API (no libraries, from scratch) |
| Animation | motion (Framer Motion) — imported but not yet used |
| Icons | lucide-react |
| Fonts | Inter (sans), JetBrains Mono (mono) via Google Fonts |

---

## Routes

| Path | Component | Status |
|---|---|---|
| `/` | `DrumMachine` (full-screen, no router) | Working |

All other routes (`/drum`, `/studio`) and page sections (Hero, WorkIndex, AboutNotes, SampleModule, ContactModule, ComplexStudio) have been removed. The app is now a single-page drum machine.

---

## Component Tree

```
App
└── DrumMachine (/)
    └── P5Wrapper(activeSketch)  — VIS_MODULE: swappable between 3 scenes
        ├── ibisSketch           — Scene 0: audio-reactive ibis bird (default)
        ├── placeholderSketch1   — Scene 1: Lissajous Grid animation
        └── placeholderSketch2   — Scene 2: Perlin Flow Field particles
```

---

## Design System (`src/index.css`)

The color tokens use a **Teenage Engineering monochromatic** palette. Note: the variable names (magenta, cyan, volt) are misleading — they are all near-off-white/light grays, intentionally desaturated.

| Token | Hex | Role |
|---|---|---|
| `sys-bg` | `#F2F2F0` | Primary background (warm off-white) |
| `sys-dark` | `#111111` | Foreground / text / borders |
| `sys-gray` | `#7A7A7A` | Secondary text |
| `sys-surface` | `#2A2A2A` | Dark panel surface |
| `sys-magenta` | `#F2F2F0` | "Accent 1" — actually same as bg |
| `sys-cyan` | `#E0DED8` | "Accent 2" — light warm gray |
| `sys-volt` | `#F2F2F0` | "Accent 3" — same as bg |
| `sys-green` | `#E0DED8` | "Accent 4" — same as cyan |

> Inside the DrumMachine dark-theme panels, color class names (e.g. `text-sys-magenta`, `bg-sys-volt`) are used for semantic grouping: magenta = drums, volt = bass, cyan = chords.

---

## DrumMachine (`src/components/DrumMachine.tsx`)

The core interactive module of the portfolio. A 16-step sequencer with three track layers and four layout modes.

### Track Layers
| Layer | Instruments | Mutex rule | Color |
|---|---|---|---|
| Drum_Seq | KICK, SNARE, HIHAT, CLAP | No | magenta |
| SUB_BASS | C2, F2, G2, Bb2 | Yes — one note per step | volt |
| Dub_Synth | Cm7, Fm7, Gm7, Bbm7 | Yes — one chord per step | cyan |
| SAMPLER | SMP_00–SMP_07 | No | `#FF6B35` (orange, inline) |

### Layout Modes (toggled by the grid icon button)
| Mode | Description |
|---|---|
| `linear` | Default. Three stacked 16-step grids left, ibis visual right |
| `circular` | All 36 buttons (12 drum + 12 bass + 12 chord) on concentric rings around a central ibis canvas |
| `tracker` | Vertical pattern editor (rows = steps, cols = DRM/BASS/DUB). ibis sticky right panel |
| `ludic` | Neo-brutalist "Play Box" — large colored step pads, no param sliders |

### Parameters
| Param | Range | Affects |
|---|---|---|
| BPM | 60–200 | Sequencer tempo, ibis breathing rate |
| Filter (Hz) | 200–4000 | Lowpass cutoff on Dub_Synth |
| Bass Decay | 10%–150% | Envelope decay on SUB_BASS |
| Chord Decay | 10%–200% | Envelope decay on Dub_Synth |
| Dry/Wet | 0–90% | Delay send on Dub_Synth + ibis weather state |

### Demo Presets
D1, D2, D3 — preloaded patterns. **Alt+click** blends current pattern with the demo (50% cell probability).

### Scheduling
Uses a lookahead scheduler (`setTimeout` 20ms loop) that looks 100ms ahead. Audio is scheduled via `playSoundAtTime`, `playDubChordAtTime`, `playBassAtTime` from `src/lib/audio.ts`.

---

## Audio System (`src/lib/audio.ts`)

Singleton `AudioContext` (`ctx`) initialized on first user interaction. All synthesis is raw Web Audio API.

### Sound Generators
| Function | Method |
|---|---|
| KICK | Oscillator (sine) 150Hz→0 with exponential ramp |
| SNARE | Triangle osc + white noise (highpass 1kHz) |
| HIHAT | White noise (highpass 7kHz), very short 50ms |
| CLAP | White noise (bandpass 1.5kHz), 150ms |
| SUB_BASS | Sawtooth osc + sine sub-oct, lowpass filter |
| Dub_Synth | Sawtooth + detuned square per note × 4 notes, lowpass + delay feedback |

### Visual Event Bus
`visualEvents[]` is a shared array that audio writers push to and the ibisSketch reads from. Each event: `{ type, time, param }`. The sketch drains events when `audioContext.currentTime >= event.time`.

---

## VIS_MODULE Scene System

The right-column visual panel in the linear and tracker layout modes supports 3 swappable p5.js scenes. State: `visScene: 0 | 1 | 2` in DrumMachine (persists across layout mode switches).

| Index | Sketch | Label | Source | Audio reactive |
|---|---|---|---|---|
| 0 | `ibisSketch` | IBIS_OSCILLOSCOPE | Original | Yes (full event bus) |
| 1 | `placeholderSketch1` | LISSAJOUS_GRID | Original | No |
| 2 | `placeholderSketch2` | FLOW_FIELD | Original | No |
| 3 | `mandelbrotScene` | MANDELBROT | lab-phase-24 | No |
| 4 | `lSystemScene` | L_SYSTEM | lab-phase-24-c | No |
| 5 | `wireWorldScene` | WIRE_WORLD | lab-phase-25-b | No |
| 6 | `spiroScene` | SPIRO | lab-phase-25-c | No |

Scenes 3–6 are ported from `ClaytonBorgesDev-portfolio-03-2026`. Scroll-driven `sp` replaced with `(p.millis() / 60000) % 1` — each cycles all 4 chapters over 60 seconds, looping. Text overlays and scroll listeners stripped; all visual/math logic preserved.

Scene selector: `[SCN_01]` `[SCN_02]` `[SCN_03]` buttons appear inside the VIS_MODULE panel header. Active scene: `text-sys-cyan` border; inactive: `text-sys-gray`. The sublabel updates to the active scene name.

---

## ibisSketch (`src/sketches/ibisSketch.ts`)

Audio-reactive p5.js visualization of a stylized ibis bird standing at a river's edge.

### Reactive Behaviors
| Event | Visual Effect |
|---|---|
| KICK | Bird jumps up (`yOffset = -kickImpact * 30`), sand particles, water ripple under feet |
| SNARE | (not directly mapped visually — no snare branch in ibisSketch) |
| HIHAT | Terrain ripple (sin wave along horizon) |
| CLAP | Magenta background flash, wing jitter |
| DUB | Ghost aura (scaled white silhouette behind bird), beak-tip glow tied to filter freq |
| BASS | Water particles burst, screen flash |
| PARAM_UPDATE | Updates `dubDecayCurrent` (Dry/Wet) + `currentFilterFreq` + `currentBpm` |

### Weather System
`weatherP = dryWet / 0.9` drives a full scene state:
- **Dry (0):** Light sky, 1 cloud, bright sun-like circle, sand dominant
- **Wet (1):** Dark gray sky, multiple clouds, rain particles, rising water level

### Bird Anatomy
- Body: curved polygon with spring-physics tail lag
- Legs: two segmented legs with foot toes
- Wing: flaps on kick impact, feathers have mouse parallax
- Head/beak: long downward curve; eye tracks mouse cursor; blink via Perlin noise

---

## heroSketch (`src/sketches/heroSketch.ts`)

Generative "modular synth" panel layout using BSP (Binary Space Partition) to fill the canvas with interactive panels. Mouse-reactive.

### Panel Types (random)
| Type | Behavior |
|---|---|
| 0 — PADS | Grid of pads that activate on cursor proximity |
| 1 — DIALS | Rotary knobs that track mouse when nearby, auto-oscillate when far |
| 2 — SCREEN | CRT oscilloscope with scanlines; waveform amplitude increases on hover |
| 3 — FADERS | Vertical sliders that follow mouse Y |
| 4 — TAPE | Tape reel mechanism that spins faster on hover |

Animated patch cables with pulsing energy dots connect random panels. Mouse crosshairs (dashed magenta lines + reticle) track cursor globally. Click re-randomizes the layout.

---

## projectSketch (`src/sketches/projectSketch.ts`)

Parametric rotating ring structure (alternating squares/circles), one per project card in WorkIndex. Spins faster and pulses on hover. Rendered at 30% opacity normally, 100% on card hover.

---

## contactSketch (`src/sketches/contactSketch.ts`)

Radar-sweep animation with expanding ring blips. Speed adjusts based on mouse distance from center. Mouse movement generates blips. Rendered at 40% opacity with `mix-blend-multiply`.

---

## P5Wrapper (`src/components/P5Wrapper.tsx`)

Generic React wrapper for p5 instance mode. Uses `ResizeObserver` to call `p.windowResized()` when the container resizes. Tears down and recreates the sketch if `sketch` prop reference changes.

---

## SAMPLER Track (`SAMPLER_PADS`, `samplerGrid`)

8 pads (SMP_00–SMP_07) × 16 steps. Non-mutex (multiple pads can fire per step, like drums). Uses the existing `playSampleAtTime(padId, time)` audio function which maps padId to a pentatonic scale (A3=220Hz base). Fires visual events `SAMPLE` on the shared event bus. Wired into all 4 layout modes. Color: `#FF6B35` (orange, applied inline since it's not in the Tailwind theme).

The old standalone `SampleModule` component (16-pad EP-SM1 page section) has been removed.

---

## Known Placeholder / Incomplete Areas

- **ComplexStudio (`/studio`):** Layout skeleton only — step rows are visual dummies (no audio/state), the SVG visualizer is static.
- **Contact email:** `mailto:contact@placeholder.com` — needs real address.
- **WorkIndex projects:** All placeholder titles/descriptions, no real links.
- **Gemini API key:** `.env.example` references `GEMINI_API_KEY` — not yet integrated into any feature.
- **`motion` library:** Imported in `package.json` but not used anywhere yet.
- **Copyright year:** Shows "© 2024" in ContactModule footer.
- **Ludic mode** lacks audio parameter sliders (intentional simplicity, but may want to add later).
- **No git repository** — project is not version-controlled yet.
