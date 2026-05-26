import React, { useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { P5Wrapper } from './P5Wrapper';
import { createProjectSketch } from '../sketches/projectSketch';

const projects = [
  { id: '01', title: 'GENERATIVE GRID', role: 'VISUAL DESIGN', year: '2023', category: 'INTERACTIVE', colorHex: '#0044FF', description: 'A matrix of responsive cells simulating fluid dynamics through user interaction and proximity.' },
  { id: '02', title: 'TAPE SEQUENCER', role: 'ENGINEERING', year: '2023', category: 'AUDIO / WEB', colorHex: '#FFD600', description: 'Web-based loop synthesizer using modular logic gates and physical modeling for sound.' },
  { id: '03', title: 'FIELD RECORDER', role: 'UI / UX', year: '2024', category: 'PROTOTYPE', colorHex: '#00C853', description: 'Tactile interface concept for a portable sound capture device focusing on immediate recording.' },
  { id: '04', title: 'MODULAR SYNTH', role: 'CREATIVE CODE', year: '2024', category: 'TOOL', colorHex: '#FF5A00', description: 'Experimental patching system for routing generative audio-visual sources in the browser.' },
];

export const WorkIndex = () => {
  return (
    <section id="work" className="py-24 px-4 md:px-8 max-w-7xl mx-auto w-full">
      <header className="mb-12 flex justify-between items-end border-b-2 border-sys-dark pb-4">
        <h2 className="font-sans font-bold text-3xl md:text-5xl uppercase tracking-tight">Selected Work</h2>
        <span className="font-mono text-sm text-gray-500 uppercase">Input Array [4]</span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        {projects.map((project, idx) => {
          // Stable reference to sketch creator to avoid unmounting canvas unnecessarily
          const sketch = useMemo(() => createProjectSketch(project.colorHex, idx * 10), [project.colorHex, idx]);

          return (
            <div 
              key={project.id}
              className="group relative flex flex-col justify-between border-2 border-sys-dark bg-sys-bg aspect-square md:aspect-[4/3] p-6 transition-all duration-300 transform shadow-[12px_12px_0_0_#0D0D0E,inset_0_0_0_0_currentColor] hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0_0_#0D0D0E,inset_0_0_0_4px_currentColor] overflow-hidden"
              style={{ color: 'var(--color-sys-dark)' }}
            >
              
              {/* Generative Interactive Background */}
              <div className="absolute inset-0 z-0 opacity-30 group-hover:opacity-100 transition-opacity duration-500 pointer-events-auto mix-blend-multiply">
                 <P5Wrapper sketch={sketch} className="w-full h-full" />
              </div>

              {/* Card Content - Z10 to sit above canvas */}
              <div className="flex justify-between items-start z-10 pointer-events-none">
                <span className="font-mono text-xs md:text-sm font-bold bg-sys-dark text-sys-bg px-2 py-1 rounded-sm shadow-sm group-hover:bg-sys-bg group-hover:text-sys-dark transition-colors">
                  MOD.{project.id}
                </span>
                <div className="w-10 h-10 rounded-full border-2 border-sys-dark flex items-center justify-center bg-sys-bg group-hover:bg-sys-dark group-hover:text-sys-bg transition-colors">
                  <ArrowUpRight className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                </div>
              </div>

              <div className="z-10 mt-auto pointer-events-none bg-sys-bg/90 backdrop-blur-sm p-4 border border-sys-dark/20 rounded-md shadow-sm group-hover:bg-sys-bg/95 transition-colors">
                <div className="flex gap-3 font-mono text-xs uppercase mb-3 opacity-80">
                  <span className="border-r border-sys-dark/30 pr-3">{project.role}</span>
                  <span>{project.year}</span>
                </div>
                <h3 className="font-sans font-bold text-3xl md:text-4xl leading-tight uppercase mb-3 tracking-tighter">
                  {project.title}
                </h3>
                <p className="font-sans text-sm md:text-base max-w-sm leading-snug opacity-90">
                  {project.description}
                </p>
                <div className="mt-6 flex gap-2">
                  <span className="font-mono text-[10px] bg-sys-gray border border-sys-dark/20 px-2 py-1 rounded-full uppercase font-bold text-sys-dark/80">
                    {project.category}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
