import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const StepRow = ({ steps, label, className = "" }: { steps: number, label: string, className?: string }) => {
  return (
    <div className={`w-full h-full flex flex-col border border-black bg-white p-2 ${className}`}>
       <div className="text-[10px] uppercase font-bold text-center mb-2 tracking-widest">{label}</div>
       <div className="flex-1 flex gap-1 items-center justify-center">
         {Array.from({length: steps}).map((_, i) => (
            <div key={i} className="flex-1 max-w-[32px] md:max-w-[48px] h-4 md:h-8 border border-black/30 hover:bg-black/10 cursor-pointer transition-colors" />
         ))}
       </div>
    </div>
  )
}

const Visualizer = () => (
  <div className="w-full h-full flex items-center justify-center p-4 min-h-[300px]">
    <svg viewBox="0 0 200 200" className="w-full h-full max-w-[500px]">
       <circle cx="100" cy="100" r="95" fill="none" stroke="black" strokeWidth="0.5" />
       <circle cx="100" cy="100" r="60" fill="none" stroke="black" strokeWidth="0.5" />
       
       <line x1="5" y1="100" x2="195" y2="100" stroke="black" strokeWidth="0.5" />
       <line x1="100" y1="5" x2="100" y2="195" stroke="black" strokeWidth="0.5" />
       
       {/* Top Left Blue */}
       <polygon points="100,5 33,33 5,100" fill="none" stroke="blue" strokeWidth="1.5" />
       <polygon points="100,100 33,33 100,5" fill="none" stroke="blue" strokeWidth="1.5" />
       <polygon points="100,100 33,33 5,100" fill="none" stroke="blue" strokeWidth="1.5" />

       {/* Top Right Red */}
       <polygon points="100,5 167,33 195,100" fill="none" stroke="red" strokeWidth="1.5" />
       <polygon points="100,100 167,33 100,5" fill="none" stroke="red" strokeWidth="1.5" />
       <polygon points="100,100 167,33 195,100" fill="none" stroke="red" strokeWidth="1.5" />

       {/* Bottom Left Yellow */}
       <polygon points="5,100 33,167 100,195" fill="none" stroke="#FFD700" strokeWidth="1.5" />
       <polygon points="100,100 33,167 5,100" fill="none" stroke="#FFD700" strokeWidth="1.5" />
       <polygon points="100,100 33,167 100,195" fill="none" stroke="#FFD700" strokeWidth="1.5" />

       {/* Bottom Right Green */}
       <polygon points="195,100 167,167 100,195" fill="none" stroke="#00C800" strokeWidth="1.5" />
       <polygon points="100,100 167,167 195,100" fill="none" stroke="#00C800" strokeWidth="1.5" />
       <polygon points="100,100 167,167 100,195" fill="none" stroke="#00C800" strokeWidth="1.5" />

       {/* Inner Black Box (Tesseract-like projection) */}
       <polygon points="33,33 167,33 167,167 33,167" fill="none" stroke="black" strokeWidth="2" />
       <polygon points="50,50 150,50 150,150 50,150" fill="none" stroke="black" strokeWidth="2" />
       <line x1="33" y1="33" x2="50" y2="50" stroke="black" strokeWidth="2" />
       <line x1="167" y1="33" x2="150" y2="50" stroke="black" strokeWidth="2" />
       <line x1="167" y1="167" x2="150" y2="150" stroke="black" strokeWidth="2" />
       <line x1="33" y1="167" x2="50" y2="150" stroke="black" strokeWidth="2" />

       {/* Additional cross structural lines */}
       <line x1="100" y1="5" x2="50" y2="150" stroke="black" strokeWidth="1.5" />
       <line x1="100" y1="5" x2="150" y2="150" stroke="black" strokeWidth="1.5" />
       <line x1="100" y1="195" x2="50" y2="50" stroke="black" strokeWidth="1.5" />
       <line x1="100" y1="195" x2="150" y2="50" stroke="black" strokeWidth="1.5" />
    </svg>
  </div>
);

export const ComplexStudio = () => {
  return (
    <div className="w-full min-h-screen bg-[#F8F9FA] p-2 md:p-4 font-mono text-black overflow-x-hidden">
      <div className="max-w-[1400px] mx-auto mb-4 px-2">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-black opacity-70 hover:opacity-100 transition-colors tracking-widest text-[10px] md:text-xs uppercase bg-black/5 hover:bg-black/10 px-3 py-2 rounded-sm font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>RETURN TO HOME</span>
        </Link>
      </div>

      {/* Main Container Outline */}
      <div className="max-w-[1400px] mx-auto w-full border border-black bg-white p-2 md:p-3 flex flex-col gap-2 min-h-[85vh]">
        
        {/* Top Rows */}
        <div className="h-16 md:h-20 shrink-0">
          <StepRow steps={16} label="KICK 16 STEPS" />
        </div>
        <div className="h-16 md:h-20 shrink-0">
          <StepRow steps={16} label="BASS 16 STEPS" />
        </div>

        {/* Middle Multi-column Section */}
        <div className="flex-1 flex flex-col md:flex-row gap-2 min-h-0">
          
          {/* Left Panel */}
          <div className="w-full md:w-1/4 flex flex-col gap-2 min-h-[250px] md:min-h-0">
            <div className="flex-[2]">
              <StepRow steps={8} label="DRUMS 8 STEPS" className="justify-start pt-4" />
            </div>
            <div className="flex-1">
              <StepRow steps={8} label="SYNTH 8 STEPS" className="justify-start pt-2" />
            </div>
          </div>

          {/* Center Visualizer Panel */}
          <div className="flex-[2] relative bg-white border border-black min-h-[300px]">
            <Visualizer />
          </div>

          {/* Right Panel */}
          <div className="w-full md:w-1/4 flex flex-col gap-2 min-h-[250px] md:min-h-0">
            <div className="flex-[2]">
              <StepRow steps={8} label="DRUMS 8 STEPS" className="justify-start pt-4" />
            </div>
            <div className="flex-1">
              <StepRow steps={8} label="SYNTH 8 STEPS" className="justify-start pt-2" />
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="h-20 shrink-0">
          <StepRow steps={16} label="SAMPLER 16 STEPS" />
        </div>
        
      </div>
    </div>
  );
};
