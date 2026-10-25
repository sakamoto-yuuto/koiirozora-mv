// Check cards (?lab=<set>, or node export/export.mjs --lab <set> --sheet out/x.png --times 0,1,2,...):
// one card per second from t = 0, no lyrics. A concrete picture passes when it can be named without reading.
//   art     every silhouette of config.json -> art, printed in its three plates (one per second)
//   plates  every silhouette printed out of register on paper, in the `memory` state
//   bg      every background plate of config.json -> plates, once per colour state (snow night memory cold koi dawn)
import { ground, marks } from '../components/plate.js';

const BG_STATES = ['snow', 'night', 'memory', 'cold', 'koi', 'dawn'];

export function labShots(env, set) {
  if (set === 'bg') {
    return (env.cfg.plates || []).flatMap((name, i) => BG_STATES.map((st, j) => ({
      id: `lab-bg-${name}-${st}`, at: i * BG_STATES.length + j, palette: st, lyric: 'none', moment: `check card: ${name} in ${st}`,
      render(ctx) {
        ground(ctx, { tone: 'panel', light: [960, 500, 800, 'raised', 1] });
        env.plates.draw(ctx, name, { x: 0, y: 0, w: 1920, h: 1080 });
        ctx.rect(0, 1010, 1920, 70, { fill: true, color: 'bg', alpha: 0.8 });
        ctx.text(`${name} · ${st}`, 960, 1052, { size: 22, font: 'mono', color: 'sub', align: 'center' });
      },
    })));
  }
  const names = env.cfg.art || [];
  return names.map((name, i) => ({
    id: `lab-${set}-${name}`, at: i, palette: set === 'plates' ? 'memory' : 'voice', lyric: 'none', moment: `check card: ${name}`,
    render(ctx) {
      ground(ctx, { tone: 'panel', light: [960, 500, 800, 'raised', 1] });
      const { w, h } = env.art.size(name), s = Math.min(1500 / w, 900 / h), dst = { x: 960 - (w * s) / 2, y: 520 - (h * s) / 2, w: w * s, h: h * s };
      const off = set === 'plates' ? { black: [10, 6], orange: [-6, 0] } : {};
      env.art.inks(ctx, name, dst, { roles: { cream: 'text', orange: env.cfg.artAccent?.[name] ?? 'me', black: 'bg' }, offset: off });
      marks(ctx);
      ctx.text(name, 960, 1040, { size: 22, font: 'mono', color: 'sub', align: 'center' });
    },
  }));
}
