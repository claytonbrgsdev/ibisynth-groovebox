import React, { useState, useEffect, useRef } from "react";
import { Play, Square, Shuffle } from "lucide-react";
import {
  initAudio,
  getAudioTime,
  playSoundAtTime,
  playDubChordAtTime,
  playBassAtTime,
  scheduleVisualEvent,
  setGlobalDryWet,
  setGlobalWash,
  setGlobalFilter,
} from "../lib/audio";
import { P5Wrapper } from "./P5Wrapper";
import Knob from "./Knob";
import { cityScanSketch } from "../sketches/cityScan";

// ── Track constants ───────────────────────────────────────────────────────────
const INSTRUMENTS = ["KICK", "SNARE", "HIHAT", "CLAP"];
const DRUM_LABELS  = ["KK", "SN", "HH", "CL"];

const CHORDS       = ["Cm7", "Fm7", "Gm7", "Bbm7"];
const CHORD_LABELS = ["Cm", "Fm", "Gm", "Bb"];

const BASS_NOTES   = ["C2", "F2", "G2", "Bb2"];
const BASS_LABELS  = ["C2", "F2", "G2", "Bb"];

// ── Demo presets ──────────────────────────────────────────────────────────────
const DEMOS = [
  {
    name: "D1",
    bpm: 120,
    drums: [[0, 4, 8, 12], [4, 12], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], [3, 9, 10, 12, 14]],
    bass:  [[3, 6, 9, 10, 11, 14], [15], [12], [13]],
    dub:   [[1], [9], [], []],
  },
  {
    name: "D2",
    bpm: 120,
    drums: [[0, 4, 8, 12], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14], [5, 10, 11]],
    bass:  [[1, 2, 5, 9, 10, 11, 13], [8], [3], []],
    dub:   [[4, 10], [], [], []],
  },
  {
    name: "D3",
    bpm: 120,
    drums: [[0, 4, 8, 12], [4, 12], [0, 1, 2, 3, 4, 5, 6, 8, 10, 12], [1, 11]],
    bass:  [[3, 6, 11], [12], [10], [9]],
    dub:   [[5, 10, 12], [], [], []],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeGrid(rows: number): boolean[][] {
  return Array(rows).fill(null).map(() => Array(16).fill(false));
}

function fromIndices(arr: number[][]): boolean[][] {
  const g = makeGrid(4);
  arr.forEach((steps, r) => steps.forEach(s => { if (g[r]) g[r][s] = true; }));
  return g;
}

// ── Component ─────────────────────────────────────────────────────────────────
export const DrumMachine = () => {

  // Sequencer grids
  const [grid, setGrid] = useState<boolean[][]>(() => {
    const g = makeGrid(4);
    [0, 4, 8, 12].forEach(i => (g[0][i] = true));
    [4, 12].forEach(i => (g[1][i] = true));
    for (let i = 0; i < 16; i += 2) g[2][i] = true;
    return g;
  });

  const [chordGrid, setChordGrid] = useState<boolean[][]>(() => {
    const g = makeGrid(4);
    g[0][0] = true;
    g[1][8] = true;
    return g;
  });

  const [bassGrid, setBassGrid] = useState<boolean[][]>(() => {
    const g = makeGrid(4);
    g[0][0] = true;
    g[0][6] = true;
    g[1][8] = true;
    g[1][14] = true;
    return g;
  });

  // Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState(120);

  // Knob values (0–1 normalized)
  const [tempoKnob,   setTempoKnob]   = useState((120 - 60) / 180);
  const [textureKnob, setTextureKnob] = useState(0);
  const [filterKnob,  setFilterKnob]  = useState(0.45); // ~2400 Hz default
  const [spaceKnob,   setSpaceKnob]   = useState(0);

  // Refs for scheduler closure
  const stepRef      = useRef(0);
  const gridRef      = useRef(grid);      gridRef.current      = grid;
  const chordGridRef = useRef(chordGrid); chordGridRef.current = chordGrid;
  const bassGridRef  = useRef(bassGrid);  bassGridRef.current  = bassGrid;
  const bpmRef       = useRef(bpm);       bpmRef.current       = bpm;

  // ── Knob handlers ───────────────────────────────────────────────────────────
  const handleTempoKnob = (v: number) => {
    setTempoKnob(v);
    const newBpm = Math.round(60 + v * 180);
    setBpm(newBpm);
    scheduleVisualEvent("PARAM_UPDATE", getAudioTime(), { bpm: newBpm });
  };

  const handleTextureKnob = (v: number) => {
    setTextureKnob(v);
    initAudio();
    setGlobalDryWet(v);
  };

  const handleFilterKnob = (v: number) => {
    setFilterKnob(v);
    initAudio();
    // Exponential sweep: 200 Hz → 8000 Hz
    const freq = 200 * Math.pow(8000 / 200, v);
    setGlobalFilter(freq);
  };

  const handleSpaceKnob = (v: number) => {
    setSpaceKnob(v);
    initAudio();
    setGlobalWash(v);
  };

  // ── Scheduler ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    if (isPlaying) {
      initAudio();
      let nextNoteTime = getAudioTime() + 0.1;

      const schedule = () => {
        while (nextNoteTime < getAudioTime() + 0.1) {
          const step = stepRef.current % 16;

          // Drums
          INSTRUMENTS.forEach((inst, idx) => {
            if (gridRef.current[idx][step]) {
              playSoundAtTime(inst, nextNoteTime, step);
            }
          });

          // Dub chords
          CHORDS.forEach((_, idx) => {
            if (chordGridRef.current[idx][step]) {
              playDubChordAtTime(idx, nextNoteTime, 800, 0, bpmRef.current, 0.6);
            }
          });

          // Bass
          BASS_NOTES.forEach((_, idx) => {
            if (bassGridRef.current[idx][step]) {
              playBassAtTime(idx, nextNoteTime, 0.4);
            }
          });

          setCurrentStep(step);
          stepRef.current = step + 1;
          nextNoteTime += 60.0 / bpmRef.current / 4.0;
        }
        timeout = setTimeout(schedule, 20);
      };

      schedule();
    } else {
      stepRef.current = 0;
      setCurrentStep(0);
    }

    return () => clearTimeout(timeout);
  }, [isPlaying]);

  // ── Grid toggles ────────────────────────────────────────────────────────────
  const toggleStep = (instIdx: number, stepIdx: number) => {
    const g = [...grid];
    g[instIdx] = [...g[instIdx]];
    g[instIdx][stepIdx] = !g[instIdx][stepIdx];
    setGrid(g);
  };

  const toggleChordStep = (chordIdx: number, stepIdx: number) => {
    const g = chordGrid.map(row => [...row]);
    for (let i = 0; i < CHORDS.length; i++) {
      g[i][stepIdx] = i === chordIdx ? !g[i][stepIdx] : false;
    }
    setChordGrid(g);
  };

  const toggleBassStep = (noteIdx: number, stepIdx: number) => {
    const g = bassGrid.map(row => [...row]);
    for (let i = 0; i < BASS_NOTES.length; i++) {
      g[i][stepIdx] = i === noteIdx ? !g[i][stepIdx] : false;
    }
    setBassGrid(g);
  };

  // ── Demo load ───────────────────────────────────────────────────────────────
  const loadDemo = (demoIdx: number) => {
    const demo = DEMOS[demoIdx];
    if (!demo) return;
    setGrid(fromIndices(demo.drums));
    setBassGrid(fromIndices(demo.bass));
    setChordGrid(fromIndices(demo.dub));
    const newBpm = demo.bpm;
    setBpm(newBpm);
    setTempoKnob((newBpm - 60) / 180);
    scheduleVisualEvent("PARAM_UPDATE", getAudioTime(), { bpm: newBpm });
  };

  // ── Randomize ───────────────────────────────────────────────────────────────
  const randomizePattern = () => {
    const g = makeGrid(4).map((row) =>
      row.map(() => Math.random() > 0.75)
    );
    g[0][0] = true;
    setGrid(g);

    const cg = makeGrid(4);
    for (let i = 0; i < 16; i++) {
      if (Math.random() > 0.85) cg[Math.floor(Math.random() * 4)][i] = true;
    }
    setChordGrid(cg);

    const bg = makeGrid(4);
    for (let i = 0; i < 16; i++) {
      if (Math.random() > 0.75) bg[Math.floor(Math.random() * 4)][i] = true;
    }
    bg[0][0] = true;
    setBassGrid(bg);
  };

  // ── Step button style ────────────────────────────────────────────────────────
  const getStepStyle = (isHead: boolean, isActive: boolean): React.CSSProperties => {
    if (isHead) return {
      backgroundColor: "var(--ib-text)",
      borderColor:     "var(--ib-text)",
      boxShadow:       "0 0 8px rgba(230,224,212,0.5)",
      opacity: 1,
    };
    if (isActive) return {
      backgroundColor: "var(--ib-accent)",
      borderColor:     "var(--ib-accent)",
      boxShadow:       "0 0 5px rgba(196,162,100,0.4)",
      opacity: 1,
    };
    return {
      backgroundColor: "transparent",
      borderColor:     "var(--ib-muted)",
      opacity: 0.4,
    };
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <section
      id="drum-machine"
      className="w-full h-full flex bg-[var(--ib-bg)] overflow-hidden"
    >
      {/* ─── LEFT PANEL — sequencer + controls (42%) ─── */}
      <div className="w-[42%] min-w-[280px] flex flex-col border-r border-[var(--ib-muted)] overflow-hidden">

        {/* Brand header + play controls */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--ib-muted)] shrink-0">
          {/* Brand */}
          <div>
            <div
              className="leading-none text-[var(--ib-text)]"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 200,
                fontSize: "17px",
                letterSpacing: "0.18em",
              }}
            >
              IBISYNTH
            </div>
            <div
              className="text-[var(--ib-muted)] mt-[3px]"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.22em",
              }}
            >
              GROOVEBOX
            </div>
          </div>

          {/* Controls: presets + randomize + play */}
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                onClick={() => loadDemo(i)}
                className="px-2 py-1 border border-[var(--ib-muted)] text-[var(--ib-muted)] hover:border-[var(--ib-accent)] hover:text-[var(--ib-accent)] transition-colors rounded-sm cursor-pointer"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                D{i + 1}
              </button>
            ))}

            <button
              onClick={randomizePattern}
              title="Randomize pattern"
              className="flex items-center justify-center p-1.5 border border-[var(--ib-muted)] text-[var(--ib-muted)] hover:border-[var(--ib-accent)] hover:text-[var(--ib-accent)] transition-colors rounded-sm cursor-pointer"
            >
              <Shuffle className="w-3 h-3" />
            </button>

            {/* Play / Stop */}
            <button
              onClick={() => {
                initAudio();
                setIsPlaying((p) => !p);
              }}
              className={`w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all cursor-pointer ${
                isPlaying
                  ? "bg-[var(--ib-accent)] border-[var(--ib-accent)] text-[var(--ib-bg)]"
                  : "bg-transparent border-[var(--ib-accent)] text-[var(--ib-accent)] hover:bg-[var(--ib-accent)]/10"
              }`}
            >
              {isPlaying
                ? <Square className="fill-current w-3 h-3" />
                : <Play  className="fill-current w-3 h-3 ml-0.5" />
              }
            </button>
          </div>
        </div>

        {/* ── Knobs row ── */}
        <div className="flex justify-around items-end px-4 pt-4 pb-3 border-b border-[var(--ib-muted)] shrink-0">
          {/* TEMPO */}
          <div className="flex flex-col items-center">
            <Knob label="TEMPO" value={tempoKnob} onChange={handleTempoKnob} size={52} />
            <span
              className="text-[var(--ib-text)] mt-1"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px" }}
            >
              {Math.round(60 + tempoKnob * 180)}
            </span>
          </div>

          {/* TEXTURE */}
          <div className="flex flex-col items-center">
            <Knob label="TEXTURE" value={textureKnob} onChange={handleTextureKnob} size={52} />
          </div>

          {/* FILTER */}
          <div className="flex flex-col items-center">
            <Knob label="FILTER" value={filterKnob} onChange={handleFilterKnob} size={52} />
          </div>

          {/* SPACE */}
          <div className="flex flex-col items-center">
            <Knob label="SPACE" value={spaceKnob} onChange={handleSpaceKnob} size={52} />
          </div>
        </div>

        {/* ── Sequencer tracks ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0">

          {/* DRUM track */}
          <div>
            <div
              className="text-[var(--ib-muted)] mb-2"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
              }}
            >
              DRUM
            </div>
            {INSTRUMENTS.map((inst, instIdx) => (
              <div key={inst} className="flex items-center gap-1 mb-1">
                <span
                  className="text-[var(--ib-muted)] w-5 shrink-0"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "7px",
                    textTransform: "uppercase",
                  }}
                >
                  {DRUM_LABELS[instIdx]}
                </span>
                <div className="flex gap-[3px] flex-1">
                  {Array(16).fill(null).map((_, stepIdx) => (
                    <button
                      key={stepIdx}
                      onClick={() => toggleStep(instIdx, stepIdx)}
                      className="flex-1 h-[13px] rounded-[2px] border transition-all cursor-pointer"
                      style={getStepStyle(isPlaying && currentStep === stepIdx, grid[instIdx][stepIdx])}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-[var(--ib-muted)] opacity-30 shrink-0" />

          {/* BASS track */}
          <div>
            <div
              className="text-[var(--ib-muted)] mb-2"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
              }}
            >
              BASS
            </div>
            {BASS_NOTES.map((note, noteIdx) => (
              <div key={note} className="flex items-center gap-1 mb-1">
                <span
                  className="text-[var(--ib-muted)] w-5 shrink-0"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "7px",
                    textTransform: "uppercase",
                  }}
                >
                  {BASS_LABELS[noteIdx]}
                </span>
                <div className="flex gap-[3px] flex-1">
                  {Array(16).fill(null).map((_, stepIdx) => (
                    <button
                      key={stepIdx}
                      onClick={() => toggleBassStep(noteIdx, stepIdx)}
                      className="flex-1 h-[13px] rounded-[2px] border transition-all cursor-pointer"
                      style={getStepStyle(isPlaying && currentStep === stepIdx, bassGrid[noteIdx][stepIdx])}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-[var(--ib-muted)] opacity-30 shrink-0" />

          {/* DUB track */}
          <div>
            <div
              className="text-[var(--ib-muted)] mb-2"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
              }}
            >
              DUB
            </div>
            {CHORDS.map((chord, chordIdx) => (
              <div key={chord} className="flex items-center gap-1 mb-1">
                <span
                  className="text-[var(--ib-muted)] w-5 shrink-0"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "7px",
                    textTransform: "uppercase",
                  }}
                >
                  {CHORD_LABELS[chordIdx]}
                </span>
                <div className="flex gap-[3px] flex-1">
                  {Array(16).fill(null).map((_, stepIdx) => (
                    <button
                      key={stepIdx}
                      onClick={() => toggleChordStep(chordIdx, stepIdx)}
                      className="flex-1 h-[13px] rounded-[2px] border transition-all cursor-pointer"
                      style={getStepStyle(isPlaying && currentStep === stepIdx, chordGrid[chordIdx][stepIdx])}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-auto pt-3 border-t border-[var(--ib-muted)] opacity-30 shrink-0">
            <span
              className="text-[var(--ib-muted)]"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "7px",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
              }}
            >
              IBISYNTH v2.0 · 2026
            </span>
          </div>
        </div>
      </div>

      {/* ─── RIGHT PANEL — hero composition (identity + vis + CTA) ─── */}
      <div className="flex-1 relative overflow-hidden flex flex-col">

        {/* Identity hero — top of right panel */}
        <div className="relative z-10 px-8 pt-7 pb-5 shrink-0">
          <h1
            className="text-[var(--ib-text)] leading-[0.95]"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 200,
              fontSize: "clamp(28px, 3.4vw, 46px)",
              letterSpacing: "-0.01em",
            }}
          >
            Clayton Borges
          </h1>

          <div className="flex items-baseline gap-3 mt-2 flex-wrap">
            <span
              className="text-[var(--ib-accent)]"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
              }}
            >
              Creative / Full-Stack Developer
            </span>
            <span
              className="text-[var(--ib-muted)]"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "10px",
                letterSpacing: "0.04em",
              }}
            >
              · React · Next.js · Three.js · Python · Ruby
            </span>
          </div>
        </div>

        {/* Vis canvas — fills remaining space */}
        <div className="flex-1 relative overflow-hidden min-h-0">
          <P5Wrapper sketch={cityScanSketch} className="w-full h-full absolute inset-0" />
        </div>

        {/* CTA prompt — bottom of right panel */}
        <div className="relative z-10 px-8 pb-5 pt-3 shrink-0 flex items-center justify-between">
          <span
            className="text-[var(--ib-muted)]"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "9px",
              textTransform: "uppercase",
              letterSpacing: "0.3em",
            }}
          >
            but first — hit play · turn a knob
          </span>
          <span
            className="text-[var(--ib-muted)] opacity-60"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "9px",
              textTransform: "uppercase",
              letterSpacing: "0.3em",
            }}
          >
            scroll ↓
          </span>
        </div>
      </div>
    </section>
  );
};
