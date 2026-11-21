// Dev-only brand exploration (/brand). Nothing in the app imports from this folder.
export type Mood = "proud" | "nudge" | "ticking" | "collector" | "sleeping";
export type TikProps = { mood: Mood; size?: number; still?: boolean };

export const LIME = "#d7ff3a", DARK = "#0f0f0d", INK = "#f2f0e8", AMBER = "#ffb23a", MUTE = "#8d8b80";

export const MOODS: { id: Mood; label: string; use: string }[] = [
  { id: "proud", label: "Proud", use: "Task ticked, day cleared, round won" },
  { id: "nudge", label: "Nudge", use: "Nudge sent or received" },
  { id: "ticking", label: "Clock's ticking", use: "9pm warning, tasks still open" },
  { id: "collector", label: "Collector", use: "A miss, you owe, round over" },
  { id: "sleeping", label: "Sleeping", use: "Round not started, empty states, waiting" },
];

/** Round-capped stroke, the only line style Tik uses. */
export const Ln = ({ d, c, w, cls }: { d: string; c: string; w: number; cls?: string }) => (
  <path d={d} stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" className={cls} />
);

/** The ₹ glyph as strokes, centred on 0,0, about 8 x 12 units (no font needed, so icons render anywhere). */
export const Rupee = ({ c, w = 1.5 }: { c: string; w?: number }) => (
  <Ln d="M-3.5 -5 H3.5 M-3.5 -2.2 H3.5 M-3.5 -5 H-1.2 C2.6 -5 2.6 0.8 -1.2 0.8 H-3.5 L2.6 6.5" c={c} w={w} />
);

export const Spark = ({ x, y, s = 1, c = LIME }: { x: number; y: number; s?: number; c?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path className="tk-spark" d="M0 -3.4 L0.9 -0.9 L3.4 0 L0.9 0.9 L0 3.4 L-0.9 0.9 L-3.4 0 L-0.9 -0.9Z" fill={c} />
  </g>
);

export const Zs = ({ x, y, n }: { x: number; y: number; n: number }) => (
  <g transform={`translate(${x} ${y})`}>
    {[[0, 6, 0.8], [5, 0, 1.05], [11, -6, 0.75]].slice(0, n).map(([dx, dy, s], i) => (
      <g key={i} transform={`translate(${dx} ${dy}) scale(${s})`}>
        <g className="tk-z" style={{ animationDelay: `${i * 0.8}s` }}>
          <Ln d="M0 0 H4.5 L0 4.5 H4.5" c={MUTE} w={1.7} />
        </g>
      </g>
    ))}
  </g>
);

export const Drop = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path className="tk-drip" d="M0 -4.2 C2.6 -0.8 3 0.8 3 2 A3 3 0 0 1 -3 2 C-3 0.8 -2.6 -0.8 0 -4.2Z" fill="#bfe8ff" />
  </g>
);
