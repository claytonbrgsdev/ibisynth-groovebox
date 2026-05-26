/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DrumMachine } from './components/DrumMachine';

export default function App() {
  return (
    <div className="w-full h-screen h-[100dvh] bg-sys-bg flex flex-col py-4 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <DrumMachine />
      </div>
    </div>
  );
}
