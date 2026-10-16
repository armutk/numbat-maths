#!/usr/bin/env node
// Exact finite spoken-line inventory added by the sustained-practice release.
import fs from 'node:fs';
import { ADVENTURE_VOICE_LINES } from '../js/adventures.js';
import { REASONING_VOICE_LINES } from '../js/modules/reasoning.js';
import { EXPLORE_SPOKEN_LINES } from '../js/modules/explore.js';

const MODULE_TITLES = ['Sharing Equally', 'Equal Groups', 'Numbers to 120', 'Add and Take Away', "Pip's Brain Teasers", 'Maths Explorer'];
const split = (text) => String(text).replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean);
const lines = new Set(['Daily goal reached!']);
for (const text of [...ADVENTURE_VOICE_LINES, ...REASONING_VOICE_LINES, ...EXPLORE_SPOKEN_LINES]) for (const sentence of split(text)) lines.add(sentence);
for (const title of MODULE_TITLES) {
  lines.add(`Let's explore ${title} first.`);
  lines.add(`Next stop: ${title}.`);
}
const out = [...lines].sort();
fs.writeFileSync(new URL('./voice-release-v6.json', import.meta.url), JSON.stringify(out));
console.log(`release voice lines: ${out.length}`);
