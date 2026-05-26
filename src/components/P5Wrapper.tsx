import React, { useEffect, useRef } from 'react';
import p5 from 'p5';

interface P5WrapperProps {
  sketch: (p: any) => void;
  className?: string;
  data?: any;
}

export const P5Wrapper: React.FC<P5WrapperProps> = ({ sketch, className, data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    p5InstanceRef.current = new p5(sketch, containerRef.current);
    if (p5InstanceRef.current.updateWithProps) {
        p5InstanceRef.current.updateWithProps(data);
    }

    const ro = new ResizeObserver((entries) => {
       for (let entry of entries) {
           if (p5InstanceRef.current && typeof p5InstanceRef.current.windowResized === 'function') {
               p5InstanceRef.current.windowResized(new Event('resize'));
           }
       }
    });
    
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
        p5InstanceRef.current = null;
      }
    };
  }, [sketch]); // Re-init if sketch function changes entirely

  useEffect(() => {
     if (p5InstanceRef.current && p5InstanceRef.current.updateWithProps) {
         p5InstanceRef.current.updateWithProps(data);
     }
  }, [data]);

  return <div ref={containerRef} className={className} />;
};
