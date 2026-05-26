import React, { useState, useEffect } from 'react';
import { initAudio, getAudioTime, playSampleAtTime } from '../lib/audio';

const PADS = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  label: `S${(i + 1).toString().padStart(2, '0')}`,
}));

export const SampleModule = () => {
  const [activePad, setActivePad] = useState<number | null>(null);

  useEffect(() => {
    const handleGlobalMouseUp = () => setActivePad(null);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const handlePadDown = (id: number) => {
    initAudio();
    setActivePad(id);
    playSampleAtTime(id, getAudioTime());
  };

  const handlePadUp = () => {
    setActivePad(null);
  };

  return (
    <section className="py-24 px-4 md:px-8 max-w-7xl mx-auto w-full">
      <header className="mb-12 flex justify-between items-end border-b-2 border-sys-dark pb-4">
        <h2 className="font-sans font-bold text-3xl md:text-5xl uppercase tracking-tight">Sampler</h2>
        <span className="font-mono text-sm text-gray-500 uppercase">Input Array [16]</span>
      </header>

      <div className="w-full max-w-md mx-auto aspect-square bg-sys-surface p-6 md:p-8 rounded-lg shadow-[16px_16px_0_0_#0D0D0E,inset_0_0_0_2px_#111111] overflow-hidden flex flex-col items-center border-sys-dark">
        <div className="flex justify-between w-full mb-6 relative">
          <div className="flex gap-2">
             <div className="w-3 h-3 rounded-full bg-sys-magenta animate-pulse" />
             <div className="w-3 h-3 rounded-full bg-sys-dark" />
          </div>
          <span className="font-mono text-xs text-sys-gray tracking-widest uppercase">
            EP-SM1
          </span>
        </div>

        <div className="flex-1 w-full grid grid-cols-4 grid-rows-4 gap-3 md:gap-4">
          {PADS.map((pad) => (
            <button
              key={pad.id}
              onMouseDown={() => handlePadDown(pad.id)}
              onMouseUp={handlePadUp}
              onMouseLeave={handlePadUp}
              onTouchStart={(e) => {
                e.preventDefault();
                handlePadDown(pad.id);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handlePadUp();
              }}
              className={`
                relative group flex items-end justify-center pb-2 md:pb-3 rounded shadow-sm transition-all duration-75 uppercase font-mono text-[10px] md:text-xs tracking-wider tracking-tight outline-none border-2
                ${
                  activePad === pad.id
                    ? 'bg-sys-magenta text-sys-dark border-sys-dark translate-y-1 shadow-[0_0_0_0_#111111]'
                    : 'bg-sys-bg text-sys-dark border-sys-dark/20 hover:border-sys-dark/50 shadow-[0_4px_0_0_#111111]'
                }
              `}
            >
              {pad.label}
              
              <div 
                className={`absolute top-2 w-[30%] h-[2px] rounded-full transition-colors ${
                  activePad === pad.id ? 'bg-sys-dark' : 'bg-sys-gray/40'
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
