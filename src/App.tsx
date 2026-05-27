/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { DrumMachine } from './components/DrumMachine';
import { ouroborosSketch } from './sketches/ouroboros';
import { ouroborosPatientiaSketch } from './sketches/ouroborosPatientia';

const ROUTES = [
  { hash: '',    label: 'V1', sketch: ouroborosSketch,          name: 'ouroboros' },
  { hash: '#v2', label: 'V2', sketch: ouroborosPatientiaSketch, name: 'patientia' },
] as const;

function useHashRoute() {
  const [hash, setHash] = useState(typeof window !== 'undefined' ? window.location.hash : '');
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHashRoute();
  const route = ROUTES.find(r => r.hash === hash) ?? ROUTES[0];

  return (
    <div className="w-full h-screen h-[100dvh] bg-sys-bg flex flex-col overflow-hidden relative">
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <DrumMachine sketch={route.sketch} />
      </div>

      {/* Route switcher — subtle top-right floating */}
      <nav
        className="absolute top-3 right-4 flex items-center gap-3 z-50 select-none"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}
      >
        {ROUTES.map(r => {
          const active = r.hash === route.hash;
          return (
            <a
              key={r.label}
              href={r.hash || '#'}
              className="transition-opacity hover:opacity-100"
              style={{
                color: active ? 'var(--ib-accent)' : 'var(--ib-muted)',
                opacity: active ? 1 : 0.6,
                textDecoration: 'none',
              }}
            >
              {r.label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
