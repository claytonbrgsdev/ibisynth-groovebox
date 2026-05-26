import React from 'react';
import { P5Wrapper } from './P5Wrapper';
import { heroSketch } from '../sketches/heroSketch';
import { Link } from 'react-router-dom';

export const Hero = () => {
  return (
    <section className="relative w-full h-[80vh] flex flex-col justify-between overflow-hidden bg-sys-bg border-b-2 border-sys-dark">
      {/* Top Header Navigation */}
      <header className="absolute top-0 left-0 w-full p-4 md:p-8 flex justify-between items-start z-10 font-mono text-xs uppercase tracking-widest pointer-events-none">
        <div className="flex flex-col gap-1 pointer-events-auto">
          <span>PORTFOLIO.SYS</span>
          <span className="text-sys-magenta">REV.04</span>
        </div>
        <div className="flex flex-col items-end gap-1 pointer-events-auto">
          <nav className="flex gap-4">
            <Link to="/drum" className="hover:text-sys-volt font-bold transition-colors border-b border-transparent hover:border-sys-volt">DRUM_SEQ</Link>
            <a href="#work" className="hover:text-sys-cyan transition-colors border-b border-transparent hover:border-sys-cyan">WORK_VAR</a>
            <a href="#about" className="hover:text-sys-cyan transition-colors border-b border-transparent hover:border-sys-cyan">SYS_INFO</a>
            <a href="#output" className="hover:text-sys-magenta transition-colors border-b border-transparent hover:border-sys-magenta">OUT_PORT</a>
          </nav>
          <span className="text-gray-400">VOL.1</span>
        </div>
      </header>

      {/* P5 Canvas Container */}
      <div id="canvas-container" className="absolute inset-0 z-0">
        <P5Wrapper sketch={heroSketch} className="w-full h-full" />
      </div>

      {/* Bottom Metadata Block */}
      <div className="absolute bottom-0 left-0 w-full p-4 md:p-8 z-10 pointer-events-none flex justify-between items-end">
        <div className="max-w-xs md:max-w-sm pointer-events-auto p-5 bg-sys-bg/95 border-2 border-sys-dark shadow-[6px_6px_0_0_#0D0D0E] rounded-sm">
          <h1 className="font-sans font-bold text-xl leading-tight uppercase mb-2 tracking-tighter">CTL_SURFACE</h1>
          <p className="font-sans text-sm text-sys-dark/80 leading-relaxed">
            Interactive canvas module. Manipulate the controls to generate visual frequencies. The system responds to proximity and physical input.
          </p>
        </div>
        
        <div className="hidden md:flex gap-3 pointer-events-auto">
          <div className="flex flex-col justify-end text-right font-mono text-[10px] mr-2 text-sys-dark/50 pb-1">
            <span>PWR: ON</span>
            <span>FREQ: 440HZ</span>
          </div>
          <button className="w-14 h-14 bg-sys-dark rounded-full flex items-center justify-center text-white hover:bg-sys-magenta transition-colors active:scale-95 shadow-[0_4px_0_0_#000]">
            <span className="sr-only">Play</span>
            <div className="w-0 h-0 border-t-8 border-t-transparent border-l-10 border-l-white border-b-8 border-b-transparent ml-1" />
          </button>
        </div>
      </div>
    </section>
  );
};
