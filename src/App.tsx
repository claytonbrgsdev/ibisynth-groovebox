/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DrumMachine } from './components/DrumMachine';

export default function App() {
  return (
    <div className="w-full h-screen h-[100dvh] bg-sys-bg flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <DrumMachine />
      </div>
    </div>
  );
}
