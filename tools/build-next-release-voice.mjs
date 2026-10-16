#!/usr/bin/env node
// Exact finite spoken-line inventory added by the chapters/focus/demonstrations release.
import fs from 'node:fs';
import { ADVENTURE_VOICE_LINES } from '../js/adventures.js';
import { DEMONSTRATION_VOICE_LINES } from '../js/demonstrations.js';

const split = (text) => String(text).replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean);
const lines = new Set(['Choose a story adventure.']);
for (const text of [...ADVENTURE_VOICE_LINES, ...DEMONSTRATION_VOICE_LINES]) for (const sentence of split(text)) lines.add(sentence);
const out = [...lines].sort();
fs.writeFileSync(new URL('./voice-release-v7.json', import.meta.url), JSON.stringify(out));
console.log(`next release voice lines: ${out.length}`);
