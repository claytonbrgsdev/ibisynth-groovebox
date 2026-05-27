import React, { useRef } from 'react';

interface KnobProps {
  label: string;
  value: number;       // 0–1 normalized
  onChange: (v: number) => void;
  size?: number;       // outer SVG size in px, default 64
}

// SVG angle convention: 0° = right (3-o'clock), clockwise positive
// Knob arc: starts at 135° (bottom-left), sweeps clockwise 270°, ends at 405° = 45°
function ptOnCircle(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = angleDeg * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function svgArcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
  sweepDeg: number,
): string {
  const s = ptOnCircle(cx, cy, r, startAngle);
  const e = ptOnCircle(cx, cy, r, endAngle);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

const Knob: React.FC<KnobProps> = ({ label, value, onChange, size = 64 }) => {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 2;
  const trackR = size / 2 - 7;
  const innerR = size / 2 - 16;

  // Drag state in refs — no re-renders during drag
  const dragging      = useRef(false);
  const dragStartY    = useRef(0);
  const dragStartVal  = useRef(0);

  // Arc geometry
  const START_ANGLE = 135;
  const SWEEP       = 270;
  const currentAngle = START_ANGLE + value * SWEEP;
  const endAngle    = START_ANGLE + SWEEP; // 405° = 45° when drawn

  // Full track arc (270°, always visible)
  const trackPath = svgArcPath(cx, cy, trackR, START_ANGLE, endAngle % 360, SWEEP);

  // Value arc (swept portion)
  const valueSweep = value * SWEEP;
  const valuePath = valueSweep > 0.5
    ? svgArcPath(cx, cy, trackR, START_ANGLE, currentAngle, valueSweep)
    : null;

  // Indicator line
  const p1 = ptOnCircle(cx, cy, innerR * 0.3, currentAngle);
  const p2 = ptOnCircle(cx, cy, innerR * 0.85, currentAngle);

  // Pointer handlers
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    dragging.current     = true;
    dragStartY.current   = e.clientY;
    dragStartVal.current = value;
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const delta  = dragStartY.current - e.clientY; // up = increase
    const newVal = Math.max(0, Math.min(1, dragStartVal.current + delta / 200));
    onChange(newVal);
  };

  const handlePointerUp = () => {
    dragging.current = false;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        userSelect: 'none',
      }}
    >
      <svg
        width={size}
        height={size}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ cursor: 'ns-resize', display: 'block' }}
      >
        {/* Outer ring */}
        <circle
          cx={cx}
          cy={cy}
          r={outerR}
          fill="none"
          stroke="#3D2E1E"
          strokeWidth={1.5}
        />

        {/* Track arc — full 270° */}
        <path
          d={trackPath}
          fill="none"
          stroke="#3D2E1E"
          strokeWidth={2.5}
          strokeLinecap="round"
        />

        {/* Value arc — cyan, swept portion */}
        {valuePath && (
          <path
            d={valuePath}
            fill="none"
            stroke="#C89548"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}

        {/* Knob face */}
        <circle
          cx={cx}
          cy={cy}
          r={innerR}
          fill="#18110A"
        />

        {/* Indicator line */}
        <line
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke="#C89548"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>

      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          color: '#2E2D2A',
          textAlign: 'center',
          marginTop: '4px',
          userSelect: 'none',
        }}
      >
        {label}
      </div>
    </div>
  );
};

export default Knob;
