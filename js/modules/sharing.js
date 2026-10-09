// Sharing Equally — the hero module (VC2M1N06). Drag things onto friends' plates, check, then explain.
import { h, svg, flipMove, wait, randInt, pick, shuffle, numberChoices } from '../ui.js';
import { items, friend, moduleArt, mascot } from '../art.js';

const KINDS = [
  { id: 'cookie', one: 'cookie', many: 'cookies', draw: items.cookie },
  { id: 'apple', one: 'apple', many: 'apples', draw: items.apple },
  { id: 'strawberry', one: 'strawberry', many: 'strawberries', draw: items.strawberry },
  { id: 'lolly', one: 'lolly', many: 'lollies', draw: items.lolly },
  { id: 'muffin', one: 'muffin', many: 'muffins', draw: items.muffin },
  { id: 'carrot', one: 'carrot', many: 'carrots', draw: items.carrot },
];

/** A box of ten (for the extension to bigger numbers). */
function boxOfTen(kind) {
  const dots = Array.from({ length: 10 }, (_, i) => `<g transform="translate(${6 + (i % 5) * 11} ${16 + Math.floor(i / 5) * 14}) scale(0.16)">${kind.draw()}</g>`).join('');
  return `<svg viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="62" height="42" rx="8" fill="#F3D7B0" stroke="#D9B27F" stroke-width="2"/><rect x="1" y="4" width="62" height="10" rx="5" fill="#E6C291"/><text x="32" y="12.5" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="8" fill="#6B4B2E">10</text>${dots}</svg>`;
}

const numWord = (n) => n;

/**
 * Build a sharing task.
 * n = total items, g = number of friends (1 = all into one basket), tens = items are boxes of ten.
 */
function shareTask({ n, g, kind, tens = false }) {
  const unit = tens ? 10 : 1;
  const count = n / unit;            // draggable pieces
  const each = Math.floor(count / g); // pieces each
  const left = count - each * g;      // leftover pieces
  const eachItems = each * unit;
  const leftItems = left * unit;
  const noun = (k) => (k === 1 ? kind.one : kind.many);
  const say = g === 1
    ? `Put all ${n} ${noun(n)} into one basket.`
    : `Share ${n} ${noun(n)} between ${g} friends. Give each friend the same.${left ? ' If any are left over, put them in Pip\'s bowl.' : ''}`;

  return {
    say,
    mount(stage, api) {
      stage.classList.add('sharing-stage');
      const plates = h('div', { class: 'plates' });
      const zones = [];
      const portrait = innerHeight > innerWidth;
      const itemSize = Math.round((tens ? 96 : count > 12 ? 56 : 68) * (portrait ? 1.18 : 1));
      const plateW = g >= 5 ? 'min(18vw, 210px)' : g === 4 ? 'min(22vw, 250px)' : g === 3 ? 'min(29vw, 300px)' : g === 2 ? 'min(42vw, 400px)' : 'min(60vw, 420px)';
      const plateH = tens ? '150px' : g >= 5 ? '130px' : g === 4 ? '150px' : '190px';
      for (let i = 0; i < g; i++) {
        const dish = h('div', { class: 'plate-dish', style: { '--item': `${tens ? 80 : Math.round(itemSize * 0.8)}px` } });
        const count = h('div', { class: 'count' }, '0');
        const zone = h('div', { class: `plate drop ${g === 1 ? 'basket' : ''}`, style: { '--plate-w': plateW, '--plate-h': plateH } },
          g === 1 ? null : h('div', { class: 'friend', html: friend(i) }),
          h('div', { style: { position: 'relative', width: '100%' } }, dish, count),
        );
        api.dropTarget(zone, `plate${i}`);
        zones.push({ zone, dish, count, leftover: false });
        plates.append(zone);
      }
      let bowl = null;
      if (left) {
        const dish = h('div', { class: 'plate-dish', style: { '--item': `${itemSize * 0.78}px` } });
        const count = h('div', { class: 'count' }, '0');
        bowl = h('div', { class: 'plate drop basket', style: { '--plate-w': 'min(22vw, 180px)', '--plate-h': '90px' } },
          h('div', { class: 'friend', html: mascot('happy', 'mascot-tiny') }),
          h('div', { style: { position: 'relative', width: '100%' } }, dish, count),
          h('div', { class: 'label' }, 'Pip\'s bowl'),
        );
        api.dropTarget(bowl, 'bowl');
        zones.push({ zone: bowl, dish, count, leftover: true });
        plates.append(bowl);
      }

      const tray = h('div', { class: 'tray drop', style: { '--item': `${itemSize}px` } });
      api.dropTarget(tray, 'tray');
      const pieces = [];
      for (let i = 0; i < count; i++) {
        const el = h('div', { class: 'item', html: tens ? boxOfTen(kind) : kind.draw() });
        if (tens) el.style.width = `${itemSize}px`, el.style.height = `${itemSize * 0.75}px`;
        api.draggable(el, { canDrag: () => phase === 'share', onDrop: drop });
        tray.append(el);
        pieces.push(el);
      }
      stage.append(plates, tray);

      let phase = 'share';
      let checkBtn = api.button('Check', onCheck);
      checkBtn.disabled = true;

      function countsNow() { return zones.map((z) => z.dish.children.length); }
      function refresh() {
        tray.classList.toggle('is-empty', tray.children.length === 0);
        checkBtn.disabled = tray.children.length !== 0;
        for (const z of zones) if (z.count.classList.contains('on')) z.count.textContent = String(z.dish.children.length * unit);
      }
      async function drop(el, target) {
        if (!target) return;
        const dishEl = target.classList.contains('tray') ? target : target.querySelector('.plate-dish');
        if (!dishEl || dishEl === el.parentElement) { el.style.transform = ''; return; }
        api.sfx.drop();
        await flipMove(el, dishEl);
        refresh();
        if (tray.children.length === 0 && phase === 'share' && !saidCheck) { saidCheck = true; api.say('All shared out. Now tap Check.'); checkBtn.classList.add('is-glow'); }
      }
      let saidCheck = false;

      function showCounts() {
        const c = countsNow();
        zones.forEach((z, i) => {
          z.count.textContent = String(c[i] * unit);
          z.count.classList.add('on');
        });
      }

      async function onCheck() {
        if (phase !== 'share') return;
        checkBtn.classList.remove('is-glow');
        showCounts();
        const c = countsNow();
        const plateCounts = zones.filter((z) => !z.leftover).map((z) => z.dish.children.length);
        const bowlCount = bowl ? zones.find((z) => z.leftover).dish.children.length : 0;
        const allEqual = plateCounts.every((v) => v === plateCounts[0]);
        const ok = allEqual && bowlCount === left;
        zones.forEach((z, i) => { z.count.classList.toggle('is-even', ok); z.count.classList.toggle('is-odd', !ok && !z.leftover && (c[i] !== Math.max(...plateCounts) || c[i] !== Math.min(...plateCounts))); });
        if (ok) {
          phase = 'explain';
          checkBtn.remove();
          const msg = g === 1
            ? `All ${n} in one basket.`
            : left ? `Every friend has ${eachItems}, and ${leftItems} left over for Pip. That's fair!` : `Every friend has ${eachItems}. That's fair!`;
          await api.step(true, { say: msg });
          explain();
        } else {
          const max = Math.max(...plateCounts), min = Math.min(...plateCounts);
          let msg;
          if (!allEqual) {
            const hi = zones.findIndex((z) => !z.leftover && z.dish.children.length === max);
            const lo = zones.findIndex((z) => !z.leftover && z.dish.children.length === min);
            msg = `Hmm. This friend has ${max * unit} and this friend has ${min * unit}. That's not the same. Move some so each friend has the same.`;
            zones[hi].zone.classList.add('is-glow'); zones[lo].zone.classList.add('is-glow');
          } else {
            msg = bowlCount > left ? `Pip's bowl has too many. Share some more out to the friends.` : `Each friend has the same, but Pip's bowl should have ${leftItems}. Pop the extra ${leftItems === 1 ? 'one' : 'ones'} in the bowl.`;
            bowl.classList.add('is-glow');
          }
          await api.step(false, { say: msg, hint: (st, a, wrongs) => hint(wrongs) });
        }
      }

      async function hint(wrongs) {
        // after a second miss, deal them out together ("one for you, one for you") so she sees the method
        if (wrongs < 2) return;
        zones.forEach((z) => z.zone.classList.remove('is-glow'));
        await api.say('Let\'s do it together. One for you, one for you...');
        const all = pieces.slice();
        let i = 0;
        for (const el of all) {
          const target = i < each * g ? zones[i % g].dish : zones[zones.length - 1].dish;
          if (el.parentElement !== target) { api.sfx.tick(i % g); await flipMove(el, target, { duration: 300 }); await wait(120); }
          i++;
        }
        showCounts();
        zones.forEach((z) => { z.count.classList.remove('is-odd'); z.count.classList.add('is-even'); });
        await wait(300);
        phase = 'explain';
        checkBtn.remove();
        await api.say(g === 1 ? `All ${n} in one basket.` : `Now every friend has ${eachItems}${left ? `, and ${leftItems} left over` : ''}. That's the same for everyone.`, 'is-happy');
        explain();
      }

      function explain() {
        zones.forEach((z) => z.zone.classList.remove('is-glow'));
        tray.remove();
        const sentence = g === 1
          ? h('div', { class: 'sentence' }, `${n} ${noun(n)} in 1 group is `, h('b', {}, '?'))
          : h('div', { class: 'sentence' }, `${n} ${noun(n)} shared between ${g} friends is `, h('b', {}, '?'), ' each', left ? `, with ${leftItems} left over` : '');
        stage.append(sentence);
        const q = g === 1 ? `How many ${noun(n)} are in the basket?` : `How many ${noun(n)} did each friend get?`;
        api.say(q);
        const answer = g === 1 ? n : eachItems;
        const opts = tens ? shuffle([...new Set([answer, answer + 10, Math.max(10, answer - 10), answer + 20])].slice(0, 3)) : numberChoices(answer, 3, 1, 30);
        const full = g === 1 ? `${n} ${noun(n)} in 1 group is ${n}. Great counting!` : `${n} ${noun(n)} shared between ${g} friends is ${answer} each${left ? `, with ${leftItems} left over` : ''}. Great sharing!`;
        api.ask({
          options: opts, answer, finalSay: full,
          onCorrect: null,
        });
        // when the right one is picked, fill the sentence
        stage.querySelector('.choices').addEventListener('click', (e) => {
          const b = e.target.closest('.choice');
          if (b && Number(b.dataset.value) === answer) sentence.querySelector('b').textContent = String(answer);
        });
      }

      return () => { stage.classList.remove('sharing-stage'); };
    },
    hint() {},
  };
}

function levelParams(skillId, level) {
  const kind = pick(KINDS);
  if (skillId === 'sharing.two') {
    if (level === 1) return { n: pick([4, 6, 8, 10]), g: 2, kind };
    if (level === 2) return { n: pick([6, 8, 10, 12, 12, 14]), g: 2, kind };
    if (level === 3) return { n: pick([5, 7, 9, 11, 8, 10, 12]), g: 2, kind };
    return { n: pick([20, 40, 60, 80, 100, 120]), g: 2, kind, tens: true };
  }
  if (skillId === 'sharing.groups') {
    if (level === 1) return { n: pick([6, 9, 12]), g: 3, kind };
    if (level === 2) { const g = pick([3, 4]); return { n: g * randInt(2, 4), g, kind }; }
    if (level === 3) { const g = pick([3, 4, 5]); const n = g * randInt(2, 4) + (Math.random() < 0.45 ? randInt(1, g - 1) : 0); return { n: Math.min(n, 20), g, kind }; }
    const g = pick([3, 4, 5, 6]);
    return { n: g * 10 * randInt(1, Math.floor(12 / g)), g, kind, tens: true };
  }
  // sharing.one — all into one group
  if (level === 1) return { n: randInt(5, 10), g: 1, kind };
  return { n: randInt(8, 20), g: 1, kind };
}

export default {
  id: 'sharing',
  title: 'Sharing Equally',
  tagline: 'Share things out fairly',
  colour: 'orange',
  art: moduleArt.sharing,
  skills: [
    { id: 'sharing.two', name: 'Sharing between 2', maxLevel: 4 },
    { id: 'sharing.groups', name: 'Sharing between 3, 4 or 5', maxLevel: 4 },
    { id: 'sharing.one', name: 'All into one group', maxLevel: 2 },
  ],
  makeTask(skillId, level) {
    return shareTask(levelParams(skillId, level));
  },
};
