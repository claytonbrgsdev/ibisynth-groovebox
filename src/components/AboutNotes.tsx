import React from 'react';

const blocks = [
  { label: 'INPUT', content: 'Observation of everyday mechanical switches, analog dials, and clear tactile feedback. The physical environment as the primary data source.' },
  { label: 'PROCESS', content: 'Reducing visual noise to its necessary elements. Combining strict Scandinavian grids with playful, unexpected behavioral loops.' },
  { label: 'OUTPUT', content: 'Digital artifacts that feel physical. Interfaces that invite manipulation, yielding immediate emotional and visual responses.' },
  { label: 'TOOLS', content: 'REACT / P5.JS / TYPESCRIPT / DESIGN SYSTEMS / GENERATIVE LOGIC' },
  { label: 'VALUES', content: 'MINIMALISM. PLAYFULNESS. CLARITY. PERFORMANCE. TANGIBILITY.' },
];

export const AboutNotes = () => {
  return (
    <section id="about" className="py-24 px-4 md:px-8 bg-sys-dark text-sys-bg w-full border-y-2 border-sys-dark">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
        
        <div className="md:col-span-4 flex flex-col justify-between">
          <div>
            <h2 className="font-sans font-bold text-4xl mb-4 tracking-tighter uppercase">SYSTEM_INFO</h2>
            <div className="w-16 h-2 bg-sys-volt mb-8"></div>
            <p className="font-sans text-lg font-medium opacity-80 mb-8 max-w-sm">
              Core directives governing this creative environment. A focus on functional minimalism and immediate tactile response.
            </p>
          </div>
          
          <div className="hidden md:flex gap-4">
            {/* Visual Decoration referencing synths */}
            <div className="w-8 h-24 border-2 border-sys-bg/20 rounded-full bg-sys-dark flex justify-center p-1 relative overflow-hidden">
               <div className="w-6 h-8 bg-sys-bg rounded-full absolute bottom-1 shadow-md"></div>
               <div className="w-0.5 h-full bg-sys-bg/10 mx-auto"></div>
            </div>
            <div className="w-8 h-24 border-2 border-sys-bg/20 rounded-full bg-sys-dark flex justify-center p-1 relative overflow-hidden">
               <div className="w-6 h-8 bg-sys-magenta rounded-full absolute top-1 shadow-md"></div>
               <div className="w-0.5 h-full bg-sys-bg/10 mx-auto"></div>
            </div>
            <div className="w-8 h-24 border-2 border-sys-bg/20 rounded-full bg-sys-dark flex justify-center p-1 relative overflow-hidden">
               <div className="w-6 h-8 bg-sys-bg rounded-full absolute top-1/2 -translate-y-1/2 shadow-md"></div>
               <div className="w-0.5 h-full bg-sys-bg/10 mx-auto"></div>
            </div>
          </div>
        </div>

        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {blocks.map((block, idx) => (
            <div key={idx} className={`border border-sys-bg/20 p-6 flex flex-col justify-between ${idx === 0 ? 'sm:col-span-2' : ''} hover:border-sys-volt/50 transition-colors`}>
              <span className="font-mono text-xs text-sys-volt mb-6 inline-block">/// {block.label}</span>
              <p className="font-sans text-sm md:text-base leading-relaxed opacity-90">
                {block.content}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
