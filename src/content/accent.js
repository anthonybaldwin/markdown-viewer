// accent.js — randomized, click-to-reroll accent color.
//
// The whole viewer is driven by a small set of accent CSS variables. We pick a
// random hue per load and let the user reroll it by clicking the bar dot. Hues
// are rendered through tuned HSL so any random hue stays legible on BOTH light
// and dark backgrounds; the right lightness is re-derived when the theme flips.

export function randomHue() {
  // 0–359, but nudge away from the muddy yellow-green band (70–95) that reads
  // poorly as a UI accent on light paper.
  let h = Math.floor(Math.random() * 360);
  if (h >= 70 && h <= 95) h = (h + 40) % 360;
  return h;
}

export function applyAccent(root, hue, dark) {
  const set = (k, v) => root.style.setProperty(k, v);
  if (dark) {
    set('--mdv-accent', `hsl(${hue} 75% 62%)`);
    set('--mdv-accent-strong', `hsl(${hue} 88% 75%)`);
    set('--mdv-accent-soft', `hsl(${hue} 75% 62% / 0.16)`);
    set('--mdv-link', `hsl(${hue} 88% 75%)`);
  } else {
    set('--mdv-accent', `hsl(${hue} 72% 40%)`);
    set('--mdv-accent-strong', `hsl(${hue} 80% 31%)`);
    set('--mdv-accent-soft', `hsl(${hue} 72% 45% / 0.12)`);
    set('--mdv-link', `hsl(${hue} 80% 31%)`);
  }
}

// Make the bar dot a reroll control. Returns nothing; calls onRoll(newHue) each
// time it fires (click or keyboard), and gives a quick pop unless reduced-motion.
export function wireAccentReroll(dot, onRoll) {
  if (!dot) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const roll = () => {
    const h = randomHue();
    onRoll(h);
    if (!reduce && dot.animate) {
      dot.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.7)' }, { transform: 'scale(1)' }],
        { duration: 300, easing: 'cubic-bezier(.2,.9,.2,1)' }
      );
    }
  };
  dot.addEventListener('click', roll);
  dot.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      roll();
    }
  });
}
