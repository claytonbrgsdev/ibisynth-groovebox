import React, { useState, useEffect, useRef } from "react";
import { Play, Square, Shuffle, Circle, LayoutGrid, List, Gamepad2 } from "lucide-react";
import {
  initAudio,
  getAudioTime,
  playSoundAtTime,
  playDubChordAtTime,
  playBassAtTime,
  playSampleAtTime,
  scheduleVisualEvent,
  setMasterVolume,
  setDrumBusVolume,
  setBassBusVolume,
  setDubBusVolume,
  setSamplerBusVolume,
  setGlobalDryWet,
  setGlobalWash,
  setEchoDelayTime,
} from "../lib/audio";
import { P5Wrapper } from "./P5Wrapper";
import { EchoOverlay } from "./EchoOverlay";
import { ibisSketch } from "../sketches/ibisSketch";
import { placeholderSketch1 } from "../sketches/placeholderSketch1";
import { chladniScene } from "../sketches/chladniScene";
import { mandelbrotScene } from "../sketches/mandelbrotScene";
import { lSystemScene } from "../sketches/lSystemScene";
import { wireWorldScene } from "../sketches/wireWorldScene";
import { spiroScene } from "../sketches/spiroScene";

const INSTRUMENTS = ["KICK", "SNARE", "HIHAT", "CLAP"];
const CHORDS = ["Cm7", "Fm7", "Gm7", "Bbm7"];
const BASS_NOTES = ["C2", "F2", "G2", "Bb2"];
const SAMPLER_PADS = ["SMP_00", "SMP_01", "SMP_02", "SMP_03"];

const DEMOS = [
  {
    name: "D1",
    bpm: 120,
    drums: [
      [0, 4, 8, 12],
      [4, 12],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      [3, 9, 10, 12, 14]
    ],
    bass: [
      [3, 6, 9, 10, 11, 14],
      [15],
      [12],
      [13]
    ],
    dub: [
      [1],
      [9],
      [],
      []
    ],
    params: { filterFreq: 2400, delayAmt: 0, chordDecay: 0.1, bassDecay: 0.1 }
  },
  {
    name: "D2",
    bpm: 120,
    drums: [
      [0, 4, 8, 12],
      [4, 12],
      [0, 2, 4, 6, 8, 10, 12, 14],
      [5, 10, 11]
    ],
    bass: [
      [1, 2, 5, 9, 10, 11, 13],
      [8],
      [3],
      []
    ],
    dub: [
      [4, 10],
      [],
      [],
      []
    ],
    params: { filterFreq: 1393, delayAmt: 0, chordDecay: 0.1, bassDecay: 0.1 }
  },
  {
    name: "D3",
    bpm: 120,
    drums: [
      [0, 4, 8, 12],
      [4, 12],
      [0, 1, 2, 3, 4, 5, 6, 8, 10, 12],
      [1, 11]
    ],
    bass: [
      [3, 6, 11],
      [12],
      [10],
      [9]
    ],
    dub: [
      [5, 10, 12],
      [],
      [],
      []
    ],
    params: { filterFreq: 4000, delayAmt: 0, chordDecay: 0.1, bassDecay: 0.1 }
  }
];

export const DrumMachine = () => {
  // grid: [instrument][step]
  const [grid, setGrid] = useState<boolean[][]>(() => {
    const initialGrid = Array(4)
      .fill(null)
      .map(() => Array(16).fill(false));
    // Array pattern bootstrap
    [0, 4, 8, 12].forEach((i) => (initialGrid[0][i] = true)); // Kick
    [4, 12].forEach((i) => (initialGrid[1][i] = true)); // Snare
    for (let i = 0; i < 16; i += 2) initialGrid[2][i] = true; // Hihat
    return initialGrid;
  });

  const [chordGrid, setChordGrid] = useState<boolean[][]>(() => {
    const initialGrid = Array(4)
      .fill(null)
      .map(() => Array(16).fill(false));
    initialGrid[0][0] = true;
    initialGrid[1][8] = true;
    return initialGrid;
  });

  const [filterFreq, setFilterFreq] = useState(800);
  const [delayAmt, setDelayAmt] = useState(0.5);
  const [chordDecay, setChordDecay] = useState(0.6);

  const [bassGrid, setBassGrid] = useState<boolean[][]>(() => {
    const initialGrid = Array(4)
      .fill(null)
      .map(() => Array(16).fill(false));
    initialGrid[0][0] = true;
    initialGrid[0][6] = true;
    initialGrid[1][8] = true;
    initialGrid[1][14] = true;
    return initialGrid;
  });
  const [bassDecay, setBassDecay] = useState(0.4);

  const [samplerGrid, setSamplerGrid] = useState<boolean[][]>(() =>
    Array(4).fill(null).map(() => Array(16).fill(false))
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [layoutMode, setLayoutMode] = useState<"linear" | "circular" | "tracker" | "ludic">("linear");
  const [visScene, setVisScene] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(0);

  const [masterVolume, setMasterVolume_] = useState(0.8);
  const [drumVol, setDrumVol] = useState(1.0);
  const [bassVol, setBassVol] = useState(1.0);
  const [dubVol, setDubVol] = useState(1.0);
  const [samplerVol, setSamplerVol] = useState(1.0);
  const [globalDryWet, setGlobalDryWet_] = useState(0);
  const [globalWash, setGlobalWash_] = useState(0);
  const [samplerPitch, setSamplerPitch] = useState(0);
  const [echoDelayMs, setEchoDelayMs_] = useState(200);

  const VIS_SCENES = [
    { sketch: ibisSketch,         label: "IBIS_OSCILLOSCOPE" },
    { sketch: placeholderSketch1, label: "LISSAJOUS_GRID" },
    { sketch: chladniScene, label: "CHLADNI" },
    { sketch: mandelbrotScene,    label: "MANDELBROT" },
    { sketch: lSystemScene,       label: "L_SYSTEM" },
    { sketch: wireWorldScene,     label: "WIRE_WORLD" },
    { sketch: spiroScene,         label: "SPIRO" },
  ] as const;

  const stepRef = useRef(0);
  const gridRef = useRef(grid);
  gridRef.current = grid;

  const chordGridRef = useRef(chordGrid);
  chordGridRef.current = chordGrid;
  const filterFreqRef = useRef(filterFreq);
  filterFreqRef.current = filterFreq;
  const delayAmtRef = useRef(delayAmt);
  delayAmtRef.current = delayAmt;
  const chordDecayRef = useRef(chordDecay);
  chordDecayRef.current = chordDecay;
  const bassGridRef = useRef(bassGrid);
  bassGridRef.current = bassGrid;
  const bassDecayRef = useRef(bassDecay);
  bassDecayRef.current = bassDecay;
  const samplerGridRef = useRef(samplerGrid);
  samplerGridRef.current = samplerGrid;
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  const samplerPitchRef = useRef(samplerPitch);
  samplerPitchRef.current = samplerPitch;
  const globalDryWetRef = useRef(globalDryWet);
  globalDryWetRef.current = globalDryWet;
  const visPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMasterVolume(masterVolume); }, [masterVolume]);
  useEffect(() => { setDrumBusVolume(drumVol); }, [drumVol]);
  useEffect(() => { setBassBusVolume(bassVol); }, [bassVol]);
  useEffect(() => { setDubBusVolume(dubVol); }, [dubVol]);
  useEffect(() => { setSamplerBusVolume(samplerVol); }, [samplerVol]);
  useEffect(() => { setGlobalDryWet(globalDryWet); }, [globalDryWet]);
  useEffect(() => { setGlobalWash(globalWash); }, [globalWash]);
  useEffect(() => { setEchoDelayTime(echoDelayMs / 1000); }, [echoDelayMs]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (isPlaying) {
      initAudio();
      let nextNoteTime = getAudioTime() + 0.1;

      const schedule = () => {
        while (nextNoteTime < getAudioTime() + 0.1) {
          const step = stepRef.current % 16;

          INSTRUMENTS.forEach((inst, idx) => {
            if (gridRef.current[idx][step]) {
              playSoundAtTime(inst, nextNoteTime, step);
            }
          });

          CHORDS.forEach((_, idx) => {
            if (chordGridRef.current[idx][step]) {
              playDubChordAtTime(
                idx,
                nextNoteTime,
                filterFreqRef.current,
                delayAmtRef.current,
                bpmRef.current,
                chordDecayRef.current,
              );
            }
          });

          BASS_NOTES.forEach((_, idx) => {
            if (bassGridRef.current[idx][step]) {
              playBassAtTime(idx, nextNoteTime, bassDecayRef.current);
            }
          });

          samplerGridRef.current.forEach((row, padIdx) => {
            if (row[step]) {
              playSampleAtTime(padIdx, nextNoteTime, samplerPitchRef.current);
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
  }, [isPlaying, bpm]);

  const toggleStep = (instIdx: number, stepIdx: number) => {
    const newGrid = [...grid];
    newGrid[instIdx] = [...newGrid[instIdx]];
    newGrid[instIdx][stepIdx] = !newGrid[instIdx][stepIdx];
    setGrid(newGrid);
  };

  const toggleChordStep = (chordIdx: number, stepIdx: number) => {
    const newGrid = [...chordGrid];
    for (let i = 0; i < CHORDS.length; i++) {
      newGrid[i] = [...newGrid[i]];
      if (i === chordIdx) {
        newGrid[i][stepIdx] = !newGrid[i][stepIdx];
      } else {
        newGrid[i][stepIdx] = false;
      }
    }
    setChordGrid(newGrid);
  };

  const toggleBassStep = (noteIdx: number, stepIdx: number) => {
    const newGrid = [...bassGrid];
    for (let i = 0; i < BASS_NOTES.length; i++) {
      newGrid[i] = [...newGrid[i]];
      if (i === noteIdx) {
        newGrid[i][stepIdx] = !newGrid[i][stepIdx];
      } else {
        newGrid[i][stepIdx] = false;
      }
    }
    setBassGrid(newGrid);
  };

  const clearDrumPattern = () => {
    setGrid(
      Array(4)
        .fill(null)
        .map(() => Array(16).fill(false)),
    );
  };

  const clearChordPattern = () => {
    setChordGrid(
      Array(CHORDS.length)
        .fill(null)
        .map(() => Array(16).fill(false)),
    );
  };

  const clearBassPattern = () => {
    setBassGrid(
      Array(BASS_NOTES.length)
        .fill(null)
        .map(() => Array(16).fill(false)),
    );
  };

  const toggleSamplerStep = (padIdx: number, stepIdx: number) => {
    const newGrid = [...samplerGrid];
    newGrid[padIdx] = [...newGrid[padIdx]];
    newGrid[padIdx][stepIdx] = !newGrid[padIdx][stepIdx];
    setSamplerGrid(newGrid);
  };

  const clearSamplerPattern = () => {
    setSamplerGrid(
      Array(4).fill(null).map(() => Array(16).fill(false)),
    );
  };

  const loadDemo = (demoIndex: number, e?: React.MouseEvent) => {
    const demo = DEMOS[demoIndex];
    if (!demo) return;
    
    const isBlend = e?.altKey;
    const blendChance = 0.5;

    const generateBlendedGrid = (currentGrid: boolean[][], indicesArray: number[][]) => {
      const targetGrid = Array(4).fill(null).map(() => Array(16).fill(false));
      indicesArray.forEach((indices, rowIdx) => {
        if (targetGrid[rowIdx]) {
          indices.forEach(stepIdx => targetGrid[rowIdx][stepIdx] = true);
        }
      });
      if (!isBlend) return targetGrid;
      return currentGrid.map((row, r) =>
        row.map((cell, c) => (Math.random() > blendChance ? cell : targetGrid[r][c]))
      );
    };

    setGrid(prev => generateBlendedGrid(prev, demo.drums));
    setBassGrid(prev => generateBlendedGrid(prev, demo.bass));
    setChordGrid(prev => generateBlendedGrid(prev, demo.dub));

    if (!isBlend) {
      setFilterFreq(demo.params.filterFreq);
      setDelayAmt(demo.params.delayAmt);
      setChordDecay(demo.params.chordDecay);
      setBassDecay(demo.params.bassDecay);
      setBpm(demo.bpm);
      
      scheduleVisualEvent("PARAM_UPDATE", getAudioTime(), {
        filterFreq: demo.params.filterFreq,
        delayAmt: demo.params.delayAmt,
        bpm: demo.bpm
      });
    }
  };

  const randomizePattern = () => {
    const newGrid = Array(4)
      .fill(null)
      .map(() =>
        Array(16)
          .fill(false)
          .map(() => Math.random() > 0.75),
      );
    newGrid[0][0] = true;
    setGrid(newGrid);

    const newChordGrid = Array(CHORDS.length)
      .fill(null)
      .map(() => Array(16).fill(false));
    for (let i = 0; i < 16; i++) {
      if (Math.random() > 0.85) {
        newChordGrid[Math.floor(Math.random() * CHORDS.length)][i] = true;
      }
    }
    setChordGrid(newChordGrid);

    const newBassGrid = Array(BASS_NOTES.length)
      .fill(null)
      .map(() => Array(16).fill(false));
    for (let i = 0; i < 16; i++) {
      if (Math.random() > 0.75) {
        newBassGrid[Math.floor(Math.random() * BASS_NOTES.length)][i] = true;
      }
    }
    newBassGrid[0][0] = true;
    setBassGrid(newBassGrid);
  };

  return (
    <section
      id="drum-machine"
      className="flex-1 flex flex-col py-2 px-4 md:px-8 w-full border-b-2 border-sys-dark overflow-hidden"
    >
      <div className="max-w-7xl w-full h-full mx-auto flex flex-col">
        <div className="bg-sys-dark text-sys-bg p-4 md:p-6 rounded-sm shadow-[8px_8px_0_0_#111111] border-2 border-sys-cyan overflow-hidden relative flex-1 flex flex-col min-h-0">
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(#f2f3f5 1px, transparent 1px), linear-gradient(90deg, #f2f3f5 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          ></div>

          <div className="flex flex-wrap gap-4 justify-between items-center mb-4 border-b border-sys-bg/20 pb-4 relative z-10 shrink-0">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`w-12 h-12 flex items-center justify-center rounded-full border-2 transition-all cursor-pointer ${
                  isPlaying
                    ? "bg-sys-cyan border-sys-cyan text-sys-dark shadow-[0_0_20px_rgba(224,222,216,0.4)]"
                    : "bg-transparent border-sys-bg text-sys-bg hover:border-sys-volt hover:text-sys-volt hover:scale-105"
                }`}
              >
                {isPlaying ? (
                  <Square className="fill-current w-4 h-4" />
                ) : (
                  <Play className="fill-current w-4 h-4 ml-1" />
                )}
              </button>

              <div className="font-mono text-xs">
                <span className="text-sys-gray block mb-1 uppercase text-[10px] tracking-wider">
                  Status
                </span>
                <span
                  className={
                    isPlaying
                      ? "text-sys-cyan font-bold drop-shadow-[0_0_5px_rgba(224,222,216,0.8)]"
                      : "text-sys-bg"
                  }
                >
                  {isPlaying ? "RUNNING" : "STOPPED"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6 font-mono">
              <div className="flex items-center gap-1 md:gap-2">
                {[0, 1, 2].map((i) => (
                  <button
                    key={i}
                    onClick={(e) => loadDemo(i, e)}
                    title={`Load Preset D${i + 1} (Alt-click to randomize-blend)`}
                    className="px-2 md:px-3 py-1.5 border border-sys-bg/30 text-sys-bg text-[10px] hover:border-sys-cyan hover:text-sys-cyan transition-colors uppercase tracking-widest rounded-sm"
                  >
                    D{i + 1}
                  </button>
                ))}
                <button
                  onClick={randomizePattern}
                  title="Randomize Pattern"
                  className="flex items-center justify-center p-1.5 border border-sys-bg/30 text-sys-bg hover:border-sys-magenta hover:text-sys-magenta transition-colors rounded-sm ml-1 md:ml-2"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (layoutMode === "linear") setLayoutMode("circular");
                    else if (layoutMode === "circular") setLayoutMode("tracker");
                    else if (layoutMode === "tracker") setLayoutMode("ludic");
                    else setLayoutMode("linear");
                  }}
                  title="Toggle Layout Mode"
                  className={`flex items-center justify-center p-1.5 border transition-colors rounded-sm ml-1 md:ml-2 cursor-pointer ${
                    layoutMode !== "linear"
                      ? "bg-sys-cyan/20 border-sys-cyan text-sys-cyan shadow-[0_0_10px_rgba(224,222,216,0.3)]"
                      : "border-sys-bg/30 text-sys-bg hover:border-sys-cyan hover:text-sys-cyan"
                  }`}
                >
                  {layoutMode === "linear" ? <LayoutGrid className="w-3.5 h-3.5" /> : layoutMode === "circular" ? <Circle className="w-3.5 h-3.5" /> : layoutMode === "tracker" ? <List className="w-3.5 h-3.5" /> : <Gamepad2 className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="flex flex-col text-right">
                <label className="text-sys-gray text-[10px] tracking-wider uppercase mb-1">
                  Tempo: <span className="text-sys-volt">{bpm}</span> BPM
                </label>
                <input
                  type="range"
                  min="60"
                  max="200"
                  value={bpm}
                  onChange={(e) => {
                    const newBpm = Number(e.target.value);
                    setBpm(newBpm);
                    scheduleVisualEvent("PARAM_UPDATE", getAudioTime(), {
                      bpm: newBpm,
                    });
                  }}
                  className="w-24 md:w-32 appearance-none bg-sys-bg/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-sys-volt [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white transition-colors cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* MASTER CONTROL PANEL — visible in all layouts */}
          <div className="flex flex-wrap gap-4 items-end border-b border-sys-bg/10 pb-4 mb-4 relative z-10 shrink-0">
            {/* Master Volume */}
            <div className="flex flex-col text-left">
              <label className="text-sys-gray text-[8px] tracking-wider uppercase mb-1 font-mono">
                MASTER: {Math.round(masterVolume * 100)}%
              </label>
              <input
                type="range" min="0" max="1" step="0.01"
                value={masterVolume}
                onChange={(e) => { initAudio(); setMasterVolume_(Number(e.target.value)); }}
                className="w-20 appearance-none bg-sys-bg/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-sys-bg [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white"
              />
            </div>
            {/* Module volumes */}
            <div className="flex flex-col text-left">
              <label className="text-sys-gray text-[8px] tracking-wider uppercase mb-1 font-mono">DRM: {Math.round(drumVol * 100)}%</label>
              <input type="range" min="0" max="1" step="0.01" value={drumVol}
                onChange={(e) => { initAudio(); setDrumVol(Number(e.target.value)); }}
                className="w-14 appearance-none bg-sys-bg/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sys-magenta [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>
            <div className="flex flex-col text-left">
              <label className="text-sys-gray text-[8px] tracking-wider uppercase mb-1 font-mono">BASS: {Math.round(bassVol * 100)}%</label>
              <input type="range" min="0" max="1" step="0.01" value={bassVol}
                onChange={(e) => { initAudio(); setBassVol(Number(e.target.value)); }}
                className="w-14 appearance-none bg-sys-bg/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sys-volt [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>
            <div className="flex flex-col text-left">
              <label className="text-sys-gray text-[8px] tracking-wider uppercase mb-1 font-mono">DUB: {Math.round(dubVol * 100)}%</label>
              <input type="range" min="0" max="1" step="0.01" value={dubVol}
                onChange={(e) => { initAudio(); setDubVol(Number(e.target.value)); }}
                className="w-14 appearance-none bg-sys-bg/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sys-cyan [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>
            <div className="flex flex-col text-left">
              <label className="text-sys-gray text-[8px] tracking-wider uppercase mb-1 font-mono">SMP: {Math.round(samplerVol * 100)}%</label>
              <input type="range" min="0" max="1" step="0.01" value={samplerVol}
                onChange={(e) => { initAudio(); setSamplerVol(Number(e.target.value)); }}
                className="w-14 appearance-none bg-sys-bg/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer"
                style={{ '--tw-bg-slider': '#FF6B35' } as any}
              />
            </div>
            {/* Separator */}
            <div className="w-px h-10 bg-sys-bg/20 self-end mb-1" />
            {/* DRY/WET */}
            <div className="flex flex-col text-left">
              <label className="text-sys-bg text-[8px] tracking-wider uppercase mb-1 font-mono font-bold">
                DRY/WET: {Math.round(globalDryWet * 100)}%
              </label>
              <input type="range" min="0" max="1" step="0.01" value={globalDryWet}
                onChange={(e) => { initAudio(); setGlobalDryWet_(Number(e.target.value)); }}
                className="w-20 appearance-none bg-sys-bg/20 h-2 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-sys-cyan [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white"
              />
            </div>
            {/* WASH */}
            <div className="flex flex-col text-left">
              <label className="text-sys-bg text-[8px] tracking-wider uppercase mb-1 font-mono font-bold">
                WASH: {Math.round(globalWash * 100)}%
              </label>
              <input type="range" min="0" max="1" step="0.01" value={globalWash}
                onChange={(e) => { initAudio(); setGlobalWash_(Number(e.target.value)); }}
                className="w-20 appearance-none bg-sys-bg/20 h-2 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-sys-cyan [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white"
              />
            </div>
            {/* ECHO TIME */}
            <div className="flex flex-col text-left">
              <label className="text-sys-bg text-[8px] tracking-wider uppercase mb-1 font-mono font-bold">
                TIME: {echoDelayMs}ms
              </label>
              <input
                type="range" min="50" max="800" step="10"
                value={echoDelayMs}
                onChange={(e) => { initAudio(); setEchoDelayMs_(Number(e.target.value)); }}
                className="w-20 appearance-none bg-sys-bg/20 h-2 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-sys-cyan [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white"
              />
            </div>
            {/* Separator */}
            <div className="w-px h-10 bg-sys-bg/20 self-end mb-1" />
            {/* Sampler Pitch */}
            <div className="flex flex-col text-left">
              <label className="text-sys-gray text-[8px] tracking-wider uppercase mb-1 font-mono">
                PITCH: {samplerPitch > 0 ? '+' : ''}{samplerPitch}st
              </label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSamplerPitch(p => Math.max(-12, p - 1))}
                  className="w-5 h-5 border border-sys-bg/30 text-sys-bg hover:border-sys-bg text-[10px] font-mono flex items-center justify-center rounded-sm"
                >−</button>
                <span className="font-mono text-[10px] text-sys-bg w-6 text-center">{samplerPitch}</span>
                <button
                  onClick={() => setSamplerPitch(p => Math.min(12, p + 1))}
                  className="w-5 h-5 border border-sys-bg/30 text-sys-bg hover:border-sys-bg text-[10px] font-mono flex items-center justify-center rounded-sm"
                >+</button>
                <button
                  onClick={() => setSamplerPitch(0)}
                  className="w-5 h-5 border border-sys-bg/30 text-sys-gray hover:text-sys-bg text-[8px] font-mono flex items-center justify-center rounded-sm ml-0.5"
                >0</button>
              </div>
            </div>
          </div>

          {layoutMode === "circular" ? (
             <div className="flex-1 w-full relative flex flex-col items-center justify-center overflow-auto min-h-[600px] z-10 pb-10 xl:pb-0">
                <div className="relative w-[700px] h-[700px] shrink-0 flex items-center justify-center">
                  <div className="absolute top-4 left-4 z-20 font-mono text-[10px] space-y-1">
                     <div className="text-sys-magenta uppercase tracking-widest">Inner: Drum_Seq</div>
                     <div className="text-sys-volt uppercase tracking-widest">Ring 2: Sub_Bass</div>
                     <div className="text-sys-cyan uppercase tracking-widest">Ring 3: Dub_Synth</div>
                     <div style={{color:'#FF6B35'}} className="uppercase tracking-widest">Outer: Sampler</div>
                  </div>
                  
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] rounded-full overflow-hidden border-[3px] border-sys-cyan shadow-[0_0_20px_rgba(224,222,216,0.2)] z-10 bg-sys-dark">
                    <div className="absolute inset-0 pointer-events-none z-10 rounded-full shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]" />
                    <P5Wrapper sketch={ibisSketch} className="absolute inset-0 w-full h-full scale-110" />
                  </div>

                  <div 
                    className="absolute top-1/2 left-1/2 w-[2px] h-[340px] bg-sys-magenta/30 shadow-[0_0_10px_rgba(242,242,240,0.5)] z-0 pointer-events-none transition-transform duration-[20ms]"
                    style={{ 
                      transformOrigin: 'top center',
                      transform: `translate(-50%, 0) rotate(${currentStep * 22.5 + 180}deg)` 
                    }}
                  />

                  {[
                    ...INSTRUMENTS.map((name, i) => ({ type: 'drum', name, idx: i, activeGrid: grid[i], bgOn: 'bg-sys-magenta', borderOn: 'border-sys-magenta', shadowOn: 'shadow-[0_0_10px_rgba(242,242,240,0.4)]', hoverOn: 'hover:bg-sys-magenta/80', textOn: 'text-sys-bg', toggle: toggleStep, activeBgStyle: undefined as React.CSSProperties | undefined })),
                    ...BASS_NOTES.map((name, i) => ({ type: 'bass', name, idx: i, activeGrid: bassGrid[i], bgOn: 'bg-sys-volt', borderOn: 'border-sys-volt', shadowOn: 'shadow-[0_0_10px_rgba(242,242,240,0.4)]', hoverOn: 'hover:bg-sys-volt/80', textOn: 'text-sys-dark', toggle: toggleBassStep, activeBgStyle: undefined as React.CSSProperties | undefined })),
                    ...CHORDS.map((name, i) => ({ type: 'chord', name, idx: i, activeGrid: chordGrid[i], bgOn: 'bg-sys-cyan', borderOn: 'border-sys-cyan', shadowOn: 'shadow-[0_0_10px_rgba(224,222,216,0.4)]', hoverOn: 'hover:bg-sys-cyan/80', textOn: 'text-sys-bg', toggle: toggleChordStep, activeBgStyle: undefined as React.CSSProperties | undefined })),
                    ...SAMPLER_PADS.map((name, i) => ({ type: 'sampler', name, idx: i, activeGrid: samplerGrid[i], bgOn: '', borderOn: '', shadowOn: '', hoverOn: '', textOn: '', toggle: toggleSamplerStep, activeBgStyle: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' } as React.CSSProperties })),
                  ].map((track, trackIdx) => {
                    const radius = 110 + trackIdx * 18;
                    return (
                      <div key={`${track.type}-${track.name}`} className="absolute inset-0 pointer-events-none">
                        {track.activeGrid.map((isActive, stepIdx) => {
                           const angleDeg = (stepIdx / 16) * 360;
                           return (
                              <button
                                 key={stepIdx}
                                 onClick={() => track.toggle(track.idx, stepIdx)}
                                 title={`${track.name} - Step ${stepIdx + 1}`}
                                 className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm border transition-all cursor-pointer pointer-events-auto ${
                                    currentStep === stepIdx
                                      ? "bg-sys-bg border-sys-bg scale-[1.4] shadow-[0_0_15px_rgba(242,242,240,0.8)] z-10"
                                      : isActive
                                        ? track.bgOn
                                          ? `${track.bgOn} ${track.borderOn} ${track.textOn} ${track.shadowOn} ${track.hoverOn}`
                                          : 'border-[#FF6B35]'
                                        : "bg-sys-dark/80 border-sys-bg/20 hover:border-white/50"
                                 }`}
                                 style={{
                                    transform: `translate(-50%, -50%) rotate(${angleDeg}deg) translateY(-${radius}px) rotate(-${angleDeg}deg)`,
                                    ...(isActive && currentStep !== stepIdx && track.activeBgStyle ? track.activeBgStyle : {}),
                                 }}
                              >
                                 {isActive && currentStep !== stepIdx && !track.activeBgStyle && (
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-black/40 rounded-full" />
                                 )}
                              </button>
                           )
                        })}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-4 md:gap-8 font-mono bg-sys-dark/80 p-3 md:p-4 border border-sys-bg/20 rounded-sm mt-4 justify-center z-20 w-full max-w-4xl shrink-0 backdrop-blur-md">
                    <div className="flex flex-col text-left">
                      <label className="text-sys-gray text-[8px] tracking-wider uppercase mb-1">
                        Bass Decay: {Math.round(bassDecay * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="1.5"
                        step="0.1"
                        value={bassDecay}
                        onChange={(e) => setBassDecay(Number(e.target.value))}
                        className="w-16 md:w-20 appearance-none bg-sys-bg/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sys-volt [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white"
                      />
                    </div>
                    <div className="flex flex-col text-left">
                      <label className="text-sys-gray text-[8px] tracking-wider uppercase mb-1">
                        Filter: {filterFreq}Hz
                      </label>
                      <input
                        type="range"
                        min="200"
                        max="4000"
                        value={filterFreq}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setFilterFreq(val);
                          scheduleVisualEvent("PARAM_UPDATE", getAudioTime(), { filterFreq: val, delayAmt });
                        }}
                        className="w-16 md:w-20 appearance-none bg-sys-bg/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sys-cyan [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white"
                      />
                    </div>
                    <div className="flex flex-col text-left">
                      <label className="text-sys-gray text-[8px] tracking-wider uppercase mb-1">
                        Dub Decay: {Math.round(chordDecay * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.1"
                        value={chordDecay}
                        onChange={(e) => setChordDecay(Number(e.target.value))}
                        className="w-16 md:w-20 appearance-none bg-sys-bg/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sys-cyan [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white"
                      />
                    </div>
                    <div className="flex flex-col text-left">
                      <label className="text-sys-gray text-[8px] tracking-wider uppercase mb-1">
                        Dry/Wet: {Math.round(delayAmt * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="0.9"
                        step="0.1"
                        value={delayAmt}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setDelayAmt(val);
                          scheduleVisualEvent("PARAM_UPDATE", getAudioTime(), { filterFreq, delayAmt: val });
                        }}
                        className="w-16 md:w-20 appearance-none bg-sys-bg/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sys-cyan [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white"
                      />
                    </div>
                    <div className="flex gap-4 items-end pb-[2px]">
                      <button onClick={clearDrumPattern} className="text-[10px] text-sys-gray hover:text-sys-magenta uppercase transition-colors">[CLR_DRM]</button>
                      <button onClick={clearBassPattern} className="text-[10px] text-sys-gray hover:text-sys-volt uppercase transition-colors">[CLR_BSS]</button>
                      <button onClick={clearChordPattern} className="text-[10px] text-sys-gray hover:text-sys-cyan uppercase transition-colors">[CLR_DUB]</button>
                      <button onClick={clearSamplerPattern} className="text-[10px] text-sys-gray uppercase transition-colors" style={{}} onMouseEnter={e => (e.currentTarget.style.color='#FF6B35')} onMouseLeave={e => (e.currentTarget.style.color='')}>[CLR_SMP]</button>
                    </div>
              </div>
             </div>
          ) : layoutMode === "ludic" ? (
             <div className="flex-1 w-full relative flex flex-col items-center overflow-y-auto overflow-x-hidden min-h-[600px] z-10 bg-[#E5E5E5] px-4 md:px-8 py-12">
                 {/* Solid, minimal, playful Neo-brutalist sequencer */}
                 <div className="flex flex-col gap-8 w-full max-w-5xl items-center pb-20">
                    <div className="flex w-full justify-between items-end border-b-4 border-sys-dark pb-4">
                       <h2 className="font-sans text-4xl md:text-6xl font-black tracking-tighter text-sys-dark uppercase">Play Box</h2>
                       <div className="font-mono text-sm md:text-lg font-bold bg-sys-magenta text-sys-bg px-4 py-2 border-4 border-sys-dark shadow-[4px_4px_0_0_#111]">
                         STP / {(currentStep % 16) + 1}
                       </div>
                    </div>
                    
                    <div className="grid gap-8 md:gap-12 w-full">
                       {/* Track Groups */}
                       {[
                         { title: 'DRUMLINE', tracks: INSTRUMENTS, state: grid, toggle: toggleStep, color: 'bg-sys-magenta', colorStyle: undefined as React.CSSProperties | undefined },
                         { title: 'BASSLINE', tracks: BASS_NOTES, state: bassGrid, toggle: toggleBassStep, color: 'bg-[#FFD700]', colorStyle: undefined as React.CSSProperties | undefined },
                         { title: 'SYNTHETIC', tracks: CHORDS, state: chordGrid, toggle: toggleChordStep, color: 'bg-[#00D1FF]', colorStyle: undefined as React.CSSProperties | undefined },
                         { title: 'SAMPLER', tracks: SAMPLER_PADS, state: samplerGrid, toggle: toggleSamplerStep, color: '', colorStyle: { backgroundColor: '#FF6B35' } as React.CSSProperties },
                       ].map((group) => (
                          <div key={group.title} className="bg-white border-4 border-sys-dark rounded-2xl p-4 md:p-8 shadow-[8px_8px_0_0_#111] md:shadow-[12px_12px_0_0_#111]">
                             <div className="flex items-center gap-4 mb-6">
                               <div className={`w-8 h-8 rounded-full border-4 border-sys-dark shadow-[2px_2px_0_0_#111] animate-pulse ${group.color}`} style={group.colorStyle}></div>
                               <h3 className="font-sans font-black text-2xl md:text-3xl tracking-tighter uppercase text-sys-dark">{group.title}</h3>
                             </div>

                             <div className="flex flex-col gap-4">
                               {group.tracks.map((trackName, tIdx) => (
                                  <div key={trackName} className="flex items-center gap-3 md:gap-6 flex-wrap xl:flex-nowrap">
                                     <div className="w-20 md:w-24 font-mono font-bold text-sm md:text-lg uppercase shrink-0 text-sys-dark">
                                        {trackName}
                                     </div>
                                     <div className="flex gap-2 flex-1">
                                         {group.state[tIdx].map((isActive, sIdx) => {
                                            const isCur = currentStep % 16 === sIdx;
                                            return (
                                              <button
                                                key={sIdx}
                                                onClick={() => group.toggle(tIdx, sIdx)}
                                                className={`
                                                  flex-1 aspect-[1.5] xl:aspect-[2] rounded-md border-4 border-sys-dark flex items-center justify-center shrink-0 min-w-[20px]
                                                  transition-all duration-75 outline-none
                                                  ${isCur ? 'translate-y-2 shadow-none' : 'shadow-[3px_3px_0_0_#111] md:shadow-[4px_4px_0_0_#111] hover:translate-y-1 hover:shadow-[2px_2px_0_0_#111] active:translate-y-2 active:shadow-none'}
                                                  ${isActive ? group.color : 'bg-[#E5E5E5]'}
                                                `}
                                                style={isActive && group.colorStyle ? group.colorStyle : {}}
                                              >
                                                {isCur && <div className="w-3 h-3 rounded-full bg-sys-dark animate-ping" />}
                                              </button>
                                            );
                                         })}
                                     </div>
                                  </div>
                               ))}
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
             </div>
          ) : layoutMode === "tracker" ? (
             <div className="flex-1 w-full relative flex justify-center overflow-auto min-h-[600px] z-10 pb-10 xl:pb-0 px-4 md:px-8">
               <div className="max-w-6xl w-full flex flex-col font-mono text-[10px] md:text-xs pt-4">
                 
                 {/* Parameter Controls */}
                 <div className="flex flex-wrap gap-4 md:gap-8 bg-sys-dark/80 p-3 md:p-4 border border-sys-bg/20 rounded-sm mb-4 justify-between items-end backdrop-blur-md sticky top-0 z-30 shadow-[0_4px_10px_rgba(17,17,17,0.8)]">
                    <div className="flex gap-4 md:gap-8">
                       <div className="flex flex-col text-left">
                         <label className="text-sys-gray text-[8px] tracking-wider uppercase mb-1">
                           Bass Decay: {Math.round(bassDecay * 100)}%
                         </label>
                         <input
                           type="range"
                           min="0.1"
                           max="1.5"
                           step="0.1"
                           value={bassDecay}
                           onChange={(e) => setBassDecay(Number(e.target.value))}
                           className="w-16 md:w-20 appearance-none bg-sys-bg/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sys-volt [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white"
                         />
                       </div>
                       <div className="flex flex-col text-left">
                         <label className="text-sys-gray text-[8px] tracking-wider uppercase mb-1">
                           Filter: {filterFreq}Hz
                         </label>
                         <input
                           type="range"
                           min="200"
                           max="4000"
                           value={filterFreq}
                           onChange={(e) => {
                             const val = Number(e.target.value);
                             setFilterFreq(val);
                             scheduleVisualEvent("PARAM_UPDATE", getAudioTime(), { filterFreq: val, delayAmt });
                           }}
                           className="w-16 md:w-20 appearance-none bg-sys-bg/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sys-cyan [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white"
                         />
                       </div>
                       <div className="flex flex-col text-left">
                         <label className="text-sys-gray text-[8px] tracking-wider uppercase mb-1">
                           Dub Decay: {Math.round(chordDecay * 100)}%
                         </label>
                         <input
                           type="range"
                           min="0.1"
                           max="2.0"
                           step="0.1"
                           value={chordDecay}
                           onChange={(e) => setChordDecay(Number(e.target.value))}
                           className="w-16 md:w-20 appearance-none bg-sys-bg/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sys-cyan [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white"
                         />
                       </div>
                       <div className="flex flex-col text-left">
                         <label className="text-sys-gray text-[8px] tracking-wider uppercase mb-1">
                           Dry/Wet: {Math.round(delayAmt * 100)}%
                         </label>
                         <input
                           type="range"
                           min="0"
                           max="0.9"
                           step="0.1"
                           value={delayAmt}
                           onChange={(e) => {
                             const val = Number(e.target.value);
                             setDelayAmt(val);
                             scheduleVisualEvent("PARAM_UPDATE", getAudioTime(), { filterFreq, delayAmt: val });
                           }}
                           className="w-16 md:w-20 appearance-none bg-sys-bg/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sys-cyan [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white"
                         />
                       </div>
                    </div>
                    <div className="flex gap-4">
                      <button onClick={clearDrumPattern} className="text-[10px] text-sys-gray hover:text-sys-magenta uppercase transition-colors">[CLR_DRM]</button>
                      <button onClick={clearBassPattern} className="text-[10px] text-sys-gray hover:text-sys-volt uppercase transition-colors">[CLR_BSS]</button>
                      <button onClick={clearChordPattern} className="text-[10px] text-sys-gray hover:text-sys-cyan uppercase transition-colors">[CLR_DUB]</button>
                      <button onClick={clearSamplerPattern} className="text-[10px] text-sys-gray uppercase transition-colors" onMouseEnter={e => (e.currentTarget.style.color='#FF6B35')} onMouseLeave={e => (e.currentTarget.style.color='')}>[CLR_SMP]</button>
                    </div>
                 </div>

                 <div className="flex flex-col xl:flex-row gap-6">
                 <div className="flex-1 flex flex-col min-w-0 xl:max-w-3xl">
                 {/* Track Headers */}
                 <div className="grid grid-cols-[2.5rem_1fr] md:grid-cols-[3rem_1fr] border-b border-sys-bg/20 pb-2 mb-2 sticky top-[72px] md:top-[88px] bg-sys-dark z-20 shadow-[0_4px_10px_rgba(17,17,17,0.8)]">
                    <div className="text-sys-gray text-center pt-2 text-[10px]">STP</div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-sys-magenta font-bold border border-sys-magenta/30 bg-sys-magenta/10 py-1.5 px-0 md:px-2 rounded-sm text-center text-[9px] md:text-[10px] uppercase tracking-widest">DRM</div>
                      <div className="text-sys-volt font-bold border border-sys-volt/30 bg-sys-volt/10 py-1.5 px-0 md:px-2 rounded-sm text-center text-[9px] md:text-[10px] uppercase tracking-widest">BASS</div>
                      <div className="text-sys-cyan font-bold border border-sys-cyan/30 bg-sys-cyan/10 py-1.5 px-0 md:px-2 rounded-sm text-center text-[9px] md:text-[10px] uppercase tracking-widest">DUB</div>
                      <div className="font-bold border py-1.5 px-0 md:px-2 rounded-sm text-center text-[9px] md:text-[10px] uppercase tracking-widest" style={{color:'#FF6B35', borderColor:'rgba(255,107,53,0.3)', backgroundColor:'rgba(255,107,53,0.1)'}}>SMP</div>
                    </div>
                 </div>
                 {/* Tracker Rows */}
                 <div className="flex flex-col gap-1 pb-16">
                   {Array.from({length: 16}).map((_, stepIdx) => (
                     <div 
                       key={stepIdx} 
                       className={`grid grid-cols-[2.5rem_1fr] md:grid-cols-[3rem_1fr] items-center rounded-sm transition-colors py-1 border-t border-sys-bg/5 ${currentStep === stepIdx ? "bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.05)] outline outline-1 outline-white/20" : "bg-transparent border-transparent"}`}
                     >
                        <div className={`text-center font-bold ${stepIdx % 4 === 0 ? "text-sys-bg opacity-80" : "text-sys-gray opacity-50"}`}>
                           {(stepIdx).toString().padStart(2, '0')}
                        </div>
                        <div className="grid grid-cols-4 gap-2 pr-0 md:pr-2">
                           {/* Drums */}
                           <div className="grid grid-cols-4 gap-0.5 md:gap-1">
                             {INSTRUMENTS.map((inst, instIdx) => {
                               const isActive = grid[instIdx][stepIdx];
                               return (
                                 <button
                                   key={`${inst}-${stepIdx}`}
                                   onClick={() => toggleStep(instIdx, stepIdx)}
                                   className={`h-6 md:h-8 rounded-[2px] transition-all flex items-center justify-center border ${isActive ? "bg-sys-magenta/90 border-sys-magenta text-sys-bg shadow-[0_0_8px_rgba(242,242,240,0.3)]" : "bg-sys-bg/5 border-sys-bg/10 text-transparent hover:border-sys-magenta/40 hover:bg-sys-magenta/10"}`}
                                 >
                                   <span className="scale-[0.85]">{isActive ? inst.substring(0,2) : "·"}</span>
                                 </button>
                               )
                             })}
                           </div>
                           {/* Bass */}
                           <div className="grid grid-cols-4 gap-0.5 md:gap-1">
                             {BASS_NOTES.map((note, noteIdx) => {
                               const isActive = bassGrid[noteIdx][stepIdx];
                               return (
                                 <button
                                   key={`${note}-${stepIdx}`}
                                   onClick={() => toggleBassStep(noteIdx, stepIdx)}
                                   className={`h-6 md:h-8 rounded-[2px] transition-all flex items-center justify-center border ${isActive ? "bg-sys-volt/90 border-sys-volt text-sys-dark shadow-[0_0_8px_rgba(242,242,240,0.3)]" : "bg-sys-bg/5 border-sys-bg/10 text-transparent hover:border-sys-volt/40 hover:bg-sys-volt/10"}`}
                                 >
                                   <span className="scale-[0.85] font-bold">{isActive ? note : "·"}</span>
                                 </button>
                               )
                             })}
                           </div>
                           {/* Chords */}
                           <div className="grid grid-cols-4 gap-0.5 md:gap-1">
                             {CHORDS.map((chord, chordIdx) => {
                               const isActive = chordGrid[chordIdx][stepIdx];
                               return (
                                 <button
                                   key={`${chord}-${stepIdx}`}
                                   onClick={() => toggleChordStep(chordIdx, stepIdx)}
                                   className={`h-6 md:h-8 rounded-[2px] transition-all flex items-center justify-center border ${isActive ? "bg-sys-cyan/90 border-sys-cyan text-sys-dark shadow-[0_0_8px_rgba(224,222,216,0.3)]" : "bg-sys-bg/5 border-sys-bg/10 text-transparent hover:border-sys-cyan/40 hover:bg-sys-cyan/10"}`}
                                 >
                                   <span className="scale-[0.85] font-bold">{isActive ? chord.substring(0,3) : "·"}</span>
                                 </button>
                               )
                             })}
                           </div>
                           {/* Sampler */}
                           <div className="grid grid-cols-4 gap-0.5 md:gap-1">
                             {SAMPLER_PADS.map((pad, padIdx) => {
                               const isActive = samplerGrid[padIdx][stepIdx];
                               return (
                                 <button
                                   key={`${pad}-${stepIdx}`}
                                   onClick={() => toggleSamplerStep(padIdx, stepIdx)}
                                   className={`h-6 md:h-8 rounded-[2px] transition-all flex items-center justify-center border text-sys-dark ${isActive ? "shadow-[0_0_8px_rgba(255,107,53,0.3)]" : "bg-sys-bg/5 border-sys-bg/10 text-transparent"}`}
                                   style={isActive ? { backgroundColor: 'rgba(255,107,53,0.9)', borderColor: '#FF6B35' } : {}}
                                 >
                                   <span className="scale-[0.85] font-bold">{isActive ? pad.substring(4) : "·"}</span>
                                 </button>
                               )
                             })}
                           </div>
                        </div>
                     </div>
                   ))}
                 </div>
                 </div>
                 
                 {/* RIGHT COLUMN: Sketch and Typography */}
                 <div className="flex flex-col gap-3 min-w-0 flex-1 pb-16 xl:pb-0 sticky top-[72px] md:top-[88px] h-[calc(100vh-140px)]">
                    <div className="border border-sys-bg/20 p-4 rounded-sm bg-sys-bg/5 flex flex-col justify-center shrink-0">
                      <h1 className="font-sans font-bold text-xl md:text-2xl text-sys-bg tracking-tight uppercase mb-1">
                        IBIS-SYNTH
                      </h1>
                      <p className="font-mono text-[10px] md:text-xs text-sys-gray tracking-wide leading-relaxed mt-1">
                        Audio reactive processing unit. Modulate dub synthesis and
                        bass decays to alter the dimensional rift.
                      </p>
                    </div>

                    <div ref={visPanelRef} className="flex-1 border border-sys-bg/20 bg-sys-dark/50 rounded-sm relative overflow-hidden flex flex-col min-h-[300px]">
                      {/* Scene selector strip */}
                      <div className="absolute top-3 right-3 z-20 flex flex-wrap gap-1">
                        {VIS_SCENES.map((scene, idx) => (
                          <button
                            key={idx}
                            onClick={() => setVisScene(idx as 0|1|2|3|4|5|6)}
                            className={`font-mono text-[10px] uppercase tracking-widest border px-1.5 py-0.5 rounded-sm transition-colors cursor-pointer ${
                              visScene === idx
                                ? "text-sys-cyan border-sys-cyan"
                                : "text-sys-gray border-sys-bg/30 hover:text-sys-bg hover:border-sys-bg/60"
                            }`}
                          >
                            {`[SCN_0${idx + 1}]`}
                          </button>
                        ))}
                      </div>
                      <div className="absolute top-4 left-4 z-10 pointer-events-none">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-sys-cyan block mb-1 drop-shadow-md">
                          VISUAL_OUT
                        </span>
                        <span className="font-mono text-[8px] uppercase tracking-widest text-sys-bg/80 drop-shadow-md">
                          {VIS_SCENES[visScene].label}
                        </span>
                      </div>
                      {/* Wash filter wrapper */}
                      <div
                        className="absolute inset-0"
                        style={globalWash > 0.01 ? {
                          filter: `blur(${(globalWash * 7).toFixed(1)}px) brightness(${(1 - globalWash * 0.4).toFixed(2)}) saturate(${(1 - globalWash * 0.3).toFixed(2)})`
                        } : undefined}
                      >
                        <P5Wrapper
                          sketch={VIS_SCENES[visScene].sketch}
                          className="absolute inset-0 w-full h-full"
                        />
                      </div>
                      <EchoOverlay visPanelRef={visPanelRef} wet={globalDryWet} delayMs={echoDelayMs} />
                    </div>
                  </div>

                 </div>
               </div>
             </div>
          ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-4 relative z-10 flex-1 min-h-0">
            {/* LEFT COLUMN: Sequencers */}
            <div className="flex flex-col gap-3 min-h-0">
              {/* DRUMS */}
              <div className="min-w-[550px] border border-sys-bg/20 p-3 rounded-sm bg-sys-bg/5 flex-shrink-0">
                <div className="flex justify-between items-end mb-2">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-sys-magenta">
                    Drum_Seq
                  </h3>
                  <button
                    onClick={clearDrumPattern}
                    className="font-mono text-[10px] uppercase tracking-widest text-sys-gray hover:text-sys-magenta transition-colors cursor-pointer"
                  >
                    [CLR]
                  </button>
                </div>
                {INSTRUMENTS.map((inst, instIdx) => (
                  <div key={inst} className="flex gap-4 items-center mb-1.5">
                    <div className="w-16 font-mono font-bold text-[10px] tracking-widest text-sys-volt">
                      {inst}
                    </div>
                    <div className="flex-1 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 md:gap-1.5">
                      {grid[instIdx].map((isActive, stepIdx) => (
                        <button
                          key={stepIdx}
                          onClick={() => toggleStep(instIdx, stepIdx)}
                          className={`relative aspect-square rounded-sm border transition-all cursor-pointer ${
                            stepIdx % 4 === 0 ? "ml-1 md:ml-1.5" : ""
                          } ${
                            currentStep === stepIdx
                              ? "bg-sys-bg border-sys-bg scale-[1.15] shadow-[0_0_15px_rgba(242,242,240,0.8)] z-10"
                              : isActive
                                ? "bg-sys-magenta border-sys-magenta shadow-[0_0_10px_rgba(242,242,240,0.4)] hover:bg-sys-magenta/80"
                                : "bg-transparent border-sys-bg/20 hover:border-sys-volt/50 hover:bg-sys-volt/10"
                          }`}
                        >
                          {isActive && currentStep !== stepIdx && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-sys-bg rounded-full opacity-80" />
                          )}
                          {currentStep === stepIdx && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-0.5 bg-sys-dark opacity-30" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* BASS */}
              <div className="min-w-[550px] border border-sys-bg/20 p-3 rounded-sm bg-sys-bg/5 flex-shrink-0">
                <div className="flex justify-between items-end mb-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-sys-volt">
                      SUB_BASS
                    </h3>
                    <button
                      onClick={clearBassPattern}
                      className="font-mono text-[10px] uppercase tracking-widest text-sys-gray hover:text-sys-volt transition-colors cursor-pointer"
                    >
                      [CLR]
                    </button>
                  </div>
                  <div className="flex gap-4 font-mono">
                    <div className="flex flex-col text-right">
                      <label className="text-sys-gray text-[8px] tracking-wider uppercase mb-1">
                        Decay: {Math.round(bassDecay * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="1.5"
                        step="0.1"
                        value={bassDecay}
                        onChange={(e) => setBassDecay(Number(e.target.value))}
                        className="w-20 appearance-none bg-sys-bg/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sys-volt [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white transition-colors cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {BASS_NOTES.map((note, noteIdx) => (
                  <div key={note} className="flex gap-4 items-center mb-1.5">
                    <div className="w-16 font-mono font-bold text-[10px] tracking-widest text-sys-volt">
                      {note}
                    </div>
                    <div className="flex-1 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 md:gap-1.5">
                      {bassGrid[noteIdx].map((isActive, stepIdx) => (
                        <button
                          key={stepIdx}
                          onClick={() => toggleBassStep(noteIdx, stepIdx)}
                          className={`relative aspect-square rounded-sm border transition-all cursor-pointer ${
                            stepIdx % 4 === 0 ? "ml-1 md:ml-1.5" : ""
                          } ${
                            currentStep === stepIdx
                              ? "bg-sys-bg border-sys-bg scale-[1.15] shadow-[0_0_15px_rgba(242,242,240,0.8)] z-10"
                              : isActive
                                ? "bg-sys-volt border-sys-volt shadow-[0_0_10px_rgba(242,242,240,0.4)] hover:bg-sys-volt/80 text-sys-dark"
                                : "bg-transparent border-sys-bg/20 hover:border-sys-volt/50 hover:bg-sys-volt/10"
                          }`}
                        >
                          {isActive && currentStep !== stepIdx && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-sys-dark rounded-full opacity-60" />
                          )}
                          {currentStep === stepIdx && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-0.5 bg-sys-dark opacity-30" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* CHORDS */}
              <div className="min-w-[550px] border border-sys-bg/20 p-3 rounded-sm bg-sys-bg/5 flex-shrink-0">
                <div className="flex justify-between items-end mb-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-sys-cyan">
                      Dub_Synth
                    </h3>
                    <button
                      onClick={clearChordPattern}
                      className="font-mono text-[10px] uppercase tracking-widest text-sys-gray hover:text-sys-cyan transition-colors cursor-pointer"
                    >
                      [CLR]
                    </button>
                  </div>
                  <div className="flex gap-4 font-mono">
                    <div className="flex flex-col text-right">
                      <label className="text-sys-gray text-[8px] tracking-wider uppercase mb-1">
                        Filter: {filterFreq}Hz
                      </label>
                      <input
                        type="range"
                        min="200"
                        max="4000"
                        value={filterFreq}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setFilterFreq(val);
                          scheduleVisualEvent("PARAM_UPDATE", getAudioTime(), {
                            filterFreq: val,
                            delayAmt: delayAmt,
                          });
                        }}
                        className="w-16 appearance-none bg-sys-bg/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sys-cyan [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white transition-colors cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col text-right">
                      <label className="text-sys-gray text-[8px] tracking-wider uppercase mb-1">
                        Decay: {Math.round(chordDecay * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.1"
                        value={chordDecay}
                        onChange={(e) => setChordDecay(Number(e.target.value))}
                        className="w-16 appearance-none bg-sys-bg/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sys-cyan [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white transition-colors cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col text-right">
                      <label className="text-sys-gray text-[8px] tracking-wider uppercase mb-1">
                        Dry/Wet: {Math.round(delayAmt * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="0.9"
                        step="0.1"
                        value={delayAmt}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setDelayAmt(val);
                          scheduleVisualEvent("PARAM_UPDATE", getAudioTime(), {
                            filterFreq: filterFreq,
                            delayAmt: val,
                          });
                        }}
                        className="w-16 appearance-none bg-sys-bg/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sys-cyan [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-white transition-colors cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {CHORDS.map((chord, chordIdx) => (
                  <div key={chord} className="flex gap-4 items-center mb-1.5">
                    <div className="w-16 font-mono font-bold text-[10px] tracking-widest text-sys-cyan">
                      {chord}
                    </div>
                    <div className="flex-1 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 md:gap-1.5">
                      {chordGrid[chordIdx].map((isActive, stepIdx) => (
                        <button
                          key={stepIdx}
                          onClick={() => toggleChordStep(chordIdx, stepIdx)}
                          className={`relative aspect-square rounded-sm border transition-all cursor-pointer ${
                            stepIdx % 4 === 0 ? "ml-1 md:ml-1.5" : ""
                          } ${
                            currentStep === stepIdx
                              ? "bg-sys-bg border-sys-bg scale-[1.15] shadow-[0_0_15px_rgba(242,242,240,0.8)] z-10"
                              : isActive
                                ? "bg-sys-cyan border-sys-cyan shadow-[0_0_10px_rgba(224,222,216,0.4)] hover:bg-sys-cyan/80"
                                : "bg-transparent border-sys-bg/20 hover:border-sys-cyan/50 hover:bg-sys-cyan/10"
                          }`}
                        >
                          {isActive && currentStep !== stepIdx && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-sys-dark rounded-full opacity-60" />
                          )}
                          {currentStep === stepIdx && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-0.5 bg-sys-dark opacity-30" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* SAMPLER */}
              <div className="min-w-[550px] border border-sys-bg/20 p-3 rounded-sm bg-sys-bg/5 flex-shrink-0">
                <div className="flex justify-between items-end mb-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest" style={{color:'#FF6B35'}}>
                      SMP
                    </h3>
                    <button
                      onClick={clearSamplerPattern}
                      className="font-mono text-[10px] uppercase tracking-widest text-sys-gray transition-colors cursor-pointer"
                      onMouseEnter={e => (e.currentTarget.style.color='#FF6B35')}
                      onMouseLeave={e => (e.currentTarget.style.color='')}
                    >
                      [CLR]
                    </button>
                  </div>
                </div>

                {SAMPLER_PADS.map((pad, padIdx) => (
                  <div key={pad} className="flex gap-4 items-center mb-1.5">
                    <div className="w-16 font-mono font-bold text-[10px] tracking-widest" style={{color:'#FF6B35'}}>
                      {pad}
                    </div>
                    <div className="flex-1 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 md:gap-1.5">
                      {samplerGrid[padIdx].map((isActive, stepIdx) => (
                        <button
                          key={stepIdx}
                          onClick={() => toggleSamplerStep(padIdx, stepIdx)}
                          className={`relative aspect-square rounded-sm border transition-all cursor-pointer ${
                            stepIdx % 4 === 0 ? "ml-1 md:ml-1.5" : ""
                          } ${
                            currentStep === stepIdx
                              ? "bg-sys-bg border-sys-bg scale-[1.15] shadow-[0_0_15px_rgba(242,242,240,0.8)] z-10"
                              : "bg-transparent border-sys-bg/20"
                          }`}
                          style={
                            currentStep !== stepIdx && isActive
                              ? { backgroundColor: '#FF6B35', borderColor: '#FF6B35' }
                              : currentStep !== stepIdx
                              ? {}
                              : {}
                          }
                        >
                          {isActive && currentStep !== stepIdx && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-sys-dark rounded-full opacity-60" />
                          )}
                          {currentStep === stepIdx && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-0.5 bg-sys-dark opacity-30" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT COLUMN: Sketch and Typography */}
            <div className="flex flex-col gap-3 min-w-0 flex-1">
              <div className="border border-sys-bg/20 p-4 rounded-sm bg-sys-bg/5 flex flex-col justify-center shrink-0">
                <h1 className="font-sans font-bold text-xl md:text-2xl text-sys-bg tracking-tight uppercase mb-1">
                  IBIS-SYNTH
                </h1>
                <p className="font-mono text-[10px] md:text-xs text-sys-gray tracking-wide leading-relaxed mt-1">
                  Audio reactive processing unit. Modulate dub synthesis and
                  bass decays to alter the dimensional rift.
                </p>
              </div>

              <div ref={visPanelRef} className="flex-1 border border-sys-bg/20 bg-sys-dark/50 rounded-sm relative overflow-hidden flex flex-col min-h-[300px]">
                {/* Scene selector strip */}
                <div className="absolute top-3 right-3 z-20 flex flex-wrap gap-1">
                  {VIS_SCENES.map((scene, idx) => (
                    <button
                      key={idx}
                      onClick={() => setVisScene(idx as 0|1|2|3|4|5|6)}
                      className={`font-mono text-[10px] uppercase tracking-widest border px-1.5 py-0.5 rounded-sm transition-colors cursor-pointer ${
                        visScene === idx
                          ? "text-sys-cyan border-sys-cyan"
                          : "text-sys-gray border-sys-bg/30 hover:text-sys-bg hover:border-sys-bg/60"
                      }`}
                    >
                      {`[SCN_0${idx + 1}]`}
                    </button>
                  ))}
                </div>
                <div className="absolute top-4 left-4 z-10 pointer-events-none">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-sys-cyan block mb-1 drop-shadow-md">
                    VIS_MODULE
                  </span>
                  <span className="font-mono text-[8px] uppercase tracking-widest text-sys-bg/80 drop-shadow-md">
                    {VIS_SCENES[visScene].label}
                  </span>
                </div>
                {/* Wash filter wrapper */}
                <div
                  className="absolute inset-0"
                  style={globalWash > 0.01 ? {
                    filter: `blur(${(globalWash * 7).toFixed(1)}px) brightness(${(1 - globalWash * 0.4).toFixed(2)}) saturate(${(1 - globalWash * 0.3).toFixed(2)})`
                  } : undefined}
                >
                  <P5Wrapper
                    sketch={VIS_SCENES[visScene].sketch}
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
                <EchoOverlay visPanelRef={visPanelRef} wet={globalDryWet} delayMs={echoDelayMs} />
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </section>
  );
};
