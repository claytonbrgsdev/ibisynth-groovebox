import React from 'react';
import { P5Wrapper } from './P5Wrapper';
import { contactSketch } from '../sketches/contactSketch';
import { Mail, ArrowRight } from 'lucide-react';

export const ContactModule = () => {
  return (
    <section id="output" className="relative w-full bg-sys-bg py-32 overflow-hidden border-b-8 border-sys-dark">
      
      {/* Background Canvas */}
      <div id="contact-canvas-container" className="absolute top-1/2 -translate-y-1/2 left-0 w-full z-0 opacity-40 mix-blend-multiply pointer-events-none">
        <P5Wrapper sketch={contactSketch} className="w-full h-[300px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 text-center flex flex-col items-center">
        <span className="font-mono text-sm text-sys-magenta border-2 border-sys-magenta px-3 py-1 rounded-full mb-8 font-bold tracking-widest bg-sys-bg shadow-sm">
          TX-MODULE
        </span>
        
        <h2 className="font-sans font-bold text-5xl md:text-7xl uppercase tracking-tighter mb-6 bg-sys-bg px-4 border-2 border-sys-dark py-2 shadow-[8px_8px_0_0_#0D0D0E]">
          ESTABLISH LINK
        </h2>
        
        <p className="font-sans text-lg md:text-xl opacity-80 mb-12 max-w-lg bg-sys-bg px-4 py-2 border border-sys-dark/20 leading-relaxed rounded-sm">
          Currently open to new systems, creative loops, and technical collaboration.
        </p>
        
        <a 
          href="mailto:contact@placeholder.com"
          className="group relative inline-flex items-center gap-3 bg-sys-dark text-sys-bg px-8 py-5 text-lg font-bold font-sans uppercase rounded-full shadow-[6px_6px_0_0_#FF0055] hover:shadow-[2px_2px_0_0_#FF0055] hover:translate-x-1 hover:translate-y-1 transition-all active:shadow-[0_0_0_0_#FF0055] active:translate-x-1.5 active:translate-y-1.5 pointer-events-auto"
        >
          <Mail className="w-5 h-5 text-sys-magenta" />
          <span>INITIATE SEQUENCE</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform text-sys-magenta" />
        </a>
      </div>
      
      {/* Structural bottom bar */}
      <div className="absolute bottom-0 left-0 w-full p-4 flex justify-between font-mono text-[10px] uppercase opacity-60 pointer-events-none">
        <span>© 2024 ALL RIGHTS RESERVED</span>
        <span>SYS_STATUS: ONLINE // AWAITING INPUT</span>
      </div>
    </section>
  );
};

