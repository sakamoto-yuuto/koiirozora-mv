// Time grid and every off-grid cue of the film, in SONG seconds. Cuts sit on the grid (B / Bt / half beats);
// events inside a shot may sit on a cue listed here. Correct a time by ear HERE and nowhere else.
//
// Grid: 75.00 BPM constant (docs/PLAN.md §5): beat 0 at 0.21 s, one beat 0.8 s, bars start on beats 1, 5, 9 ...
//   B(n)   start of bar n (bar 0 = 1.01 s)        Bt(b)  time of beat b (fractions allowed)
//   T(i)   LRC start of lyric line i               text(i) / zh(i)  the line, Japanese / Chinese
export function cues({ features, lyrics }) {
  const P = features.period, t0 = features.t0, ph = features.downPhase;
  const B = (n) => t0 + (4 * n + ph) * P;
  return {
    P,
    B,
    Bt: (b) => t0 + b * P,
    T: (i) => lyrics.start(i),
    E: (i) => lyrics.end(i),
    text: (i) => lyrics.lines[i].text,
    zh: (i) => lyrics.lines[i].zh,
  };
}

/** Song structure (research/lyrics_and_music.md §6.2), snapped to bar lines. */
export const SECTION = {
  introA: 0, introA2: 13.81, introB: 20.21, introC: 58.61, v1: 74.61,
  b1: 100.21, c1: 122.61, post1: 148.21, brk: 173.81, v2: 186.61,
  b2: 212.21, c2: 234.61, bridge: 263.41, c3: 295.41, title: 320.44, outro: 333.81, fade: 375.41, end: 395.41,
};

/** Measured / chosen moments that are not bar lines (seconds, with where they come from). */
export const CUE = {
  cardIn: 20.21,          // bar 6: the band enters (onset at 20.45 per research; the bar line is 20.21) - the LED lights
  dialFrom: 26.61,        // bar 8: first digit; one digit per beat
  ringFrom: 36.21,        // bar 11: first ring-back tone (400 Hz, 1 s on / 2 s off, one per bar)
  answer: 58.61,          // bar 18: the band drops out, the machine answers
  hush1: 64.5, hush2: 71.5,  // the two rests in Intro C (research §6.2: "约 1:04.5、1:11.5 后两次留白")
  beep: 74.61,            // bar 23: ピー, REC lights
  firstLine: 75.83,       // LRC L01
};
