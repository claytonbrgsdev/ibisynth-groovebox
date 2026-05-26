# TODO — Creative Systems Portfolio

> Last updated: 2026-05-22 (rev 2)  
> Status key: `[ ]` pending · `[~]` in progress · `[x]` done · `[-]` dropped

---

## In Progress

_(nothing currently running)_

---

## High Priority

### DrumMachine
- `[ ]` **DRUM_SQ — snare has no visual response in ibisSketch** — SNARE fires audio but ibisSketch has no snare branch in event processing. Decide on a visual (e.g. screen glitch / horizontal scan line flash).
- `[ ]` **Circular mode: step indicator** — the rotating arm shows current step but doesn't indicate which ring/track is active. Consider per-ring color highlights.
- `[ ]` **Ludic mode: add audio param controls** — no filter/decay/dry-wet sliders in ludic ("Play Box") layout. Could be large knob graphics or a bottom strip.
- `[ ]` **Mobile: test and fix drum pad tap accuracy** — small buttons in linear/tracker modes on mobile may be too small. Touch targets should be ≥44px.

### VIS_MODULE Scenes
- `[ ]` **Design real Scene 2 and Scene 3** — replace Lissajous Grid and Flow Field placeholders with proper audio-reactive or thematic scenes that fit the system aesthetic.
- `[ ]` **Wire SAMPLE visual events to ibisSketch** — ibisSketch currently has no branch for the `SAMPLE` event type (emitted by SAMPLER track). Add a visual response (e.g. small spark/particle at a random location).

---

## Medium Priority

### Polish & UX
- `[ ]` **Hero sketch: mobile responsiveness** — BSP panel layout can get very cramped on small screens. Consider simplified fallback.
- `[ ]` **Persist pattern state across layout mode switches** — pattern state is in React state so it does persist, but verify no edge-case resets on mode toggle.
- `[ ]` **Add keyboard shortcuts** — spacebar = play/stop, arrow keys = BPM up/down, number keys = load D1/D2/D3.
- `[ ]` **Pattern export/import** — allow users to copy/paste patterns as JSON or share as URL params.
- `[ ]` **DrumMachine: add step count selector** — currently fixed at 16 steps. 8-step or 32-step variations would be musically useful.
- `[ ]` **Snare visual feedback** — map SNARE event to something in ibisSketch (see high priority note above).

### Audio
- `[ ]` **Audio: gate/mute per track** — no per-track mute buttons in any layout mode.
- `[ ]` **Audio: volume/gain per track** — all tracks share a fixed gain in audio.ts. Add individual level controls.
- `[ ]` **Swing/shuffle** — add a swing amount parameter that offsets odd steps by a fraction of a beat.
- `[ ]` **Sub-bass: tune to Dub_Synth root** — BASS_NOTES (C2/F2/G2/Bb2) already match CHORDS (Cm7/Fm7/Gm7/Bbm7) but there's no enforcement. Could auto-select matching bass when chord is placed.

### Visuals
- `[ ]` **ibisSketch: add SNARE visual** — see high priority note.
- `[ ]` **ibisSketch: optimize particle count** — `particles[]` can grow large (BASS pushes 40 particles per hit). Cap at a max and reuse pool.
- `[ ]` **projectSketch: hover interaction** — rings pulse on hover but no click interaction. Consider clicking a project card to expand it.

---

## Low Priority / Ideas

- `[ ]` **Gemini API integration** — `.env.example` has `GEMINI_API_KEY`. Could use AI to generate pattern descriptions, name presets, or generate MIDI-like note sequences.
- `[ ]` **`motion` (Framer Motion) animations** — installed but unused. Candidate: page transition between routes, AboutNotes card reveal on scroll.
- `[ ]` **Dark/light mode** — system is monochromatic but currently always light-bg. A dark mode (flip sys-bg/sys-dark) could be interesting.
- `[ ]` **MIDI input/output** — Web MIDI API integration so physical pads/controllers can drive the sequencer.
- `[ ]` **Record + playback** — record knob/button interactions as automation lanes.
- `[ ]` **Add `#FF6B35` (sampler orange) to the Tailwind theme** in `index.css` as `--color-sys-orange` so it can be used as a Tailwind class instead of inline styles throughout DrumMachine.
- `[ ]` **Git init and first commit** — project has no git history yet.
- `[ ]` **Deploy to Vercel** — connect to a Vercel project for preview + production deploys.
- `[ ]` **Replace AI Studio README** — current README.md is the Google AI Studio boilerplate template.

---

## Done

- `[x]` Initial codebase exploration and CONTEXT.md + TODO.md creation (2026-05-22)
- `[x]` Stripped app to single-page DrumMachine — removed router, Hero, WorkIndex, AboutNotes, SampleModule, ContactModule, ComplexStudio (2026-05-22)
- `[x]` VIS_MODULE scene switcher — 7 swappable p5 scenes in linear + tracker modes (2026-05-22)
- `[x]` Lab-phase ports: mandelbrotScene (lab-24), lSystemScene (lab-24c), wireWorldScene (lab-25b), spiroScene (lab-25c) — time-based sp cycling (2026-05-22)
- `[x]` SAMPLER track — 8-pad × 16-step sampler module added to all 4 layout modes, scheduled via `playSampleAtTime` (2026-05-22)

---

## Notes

- All audio is synthesized from scratch via Web Audio API — no audio files or samples.
- The ibis bird visual responds to audio events via a shared `visualEvents[]` array in `src/lib/audio.ts`.
- Pattern state lives entirely in DrumMachine React state — no persistence between page reloads.
- The design system tokens (`sys-magenta`, `sys-volt`, etc.) are intentionally desaturated/monochromatic despite the vibrant-sounding names. This is the Teenage Engineering aesthetic.
