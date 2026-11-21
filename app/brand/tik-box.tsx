// Concept 3, "Checkbox": the task box you tap every day, come alive. The ✓ is its hair; the clock is a prop it carries.
import { AMBER, DARK, Drop, INK, LIME, Ln, MUTE, Rupee, Spark, Zs, type TikProps } from "./shared";

const ARMS = {
  proud: "M14 33 L7.5 24 M50 33 L56.5 24",
  nudge: "M13 41 L8 46 M51 38 L60 37",
  ticking: "M13 39 L7.5 44 M51 37 L55.5 31.5",
  collector: "M13 39 L8 43.5 L12.5 48.5 M51 38 L55 33",
  sleeping: "M13 42 L10 48 M51 42 L54 48",
};

function Face({ mood }: { mood: TikProps["mood"] }) {
  switch (mood) {
    case "proud":
      return <>
        <Ln d="M21 36.5 L24.5 32 L28 36.5" c={DARK} w={2.8} />
        <Ln d="M36 36.5 L39.5 32 L43 36.5" c={DARK} w={2.8} />
        <path d="M26.5 41.5 H37.5 Q37.5 48.5 32 48.5 Q26.5 48.5 26.5 41.5Z" fill={DARK} />
      </>;
    case "nudge":
      return <>
        <rect x="23" y="30" width="6" height="9" rx="3" fill={DARK} />
        <rect x="38" y="30" width="6" height="9" rx="3" fill={DARK} />
        <rect x="21" y="28" width="25" height="5.2" fill={LIME} />
        <Ln d="M21.5 29.4 L29 30" c={DARK} w={2} />
        <Ln d="M37 27.6 Q40.5 24.8 44.5 27" c={DARK} w={2} />
        <Ln d="M28 45.5 Q32.5 46.5 36.5 43.5" c={DARK} w={2.4} />
      </>;
    case "ticking":
      return <>
        <circle cx="24.5" cy="34.5" r="4.4" fill={DARK} />
        <circle cx="39.5" cy="34.5" r="4.4" fill={DARK} />
        <circle cx="25.8" cy="33" r="1.3" fill={INK} />
        <circle cx="40.8" cy="33" r="1.3" fill={INK} />
        <Ln d="M20.5 28.2 L27.5 26.4" c={DARK} w={2} />
        <Ln d="M36.5 26.4 L43.5 28.2" c={DARK} w={2} />
        <Ln d="M25.5 46 q1.6 -1.8 3.2 0 t3.2 0 t3.2 0 t3.2 0" c={DARK} w={2} />
      </>;
    case "collector":
      return <>
        <rect x="21.5" y="30" width="6" height="9" rx="3" fill={DARK} />
        <rect x="36.5" y="30" width="6" height="9" rx="3" fill={DARK} />
        <rect x="19.5" y="28" width="25" height="4.6" fill={LIME} />
        <Ln d="M20.5 30.2 Q24.5 28.6 28.5 30.2 M35.5 30.2 Q39.5 28.6 43.5 30.2" c={DARK} w={2} />
        <Ln d="M26.5 44.5 Q32 47.5 38 42.5" c={DARK} w={2.4} />
      </>;
    case "sleeping":
      return <>
        <Ln d="M21 35 Q24.5 38.5 28 35" c={DARK} w={2.4} />
        <Ln d="M36 35 Q39.5 38.5 43 35" c={DARK} w={2.4} />
        <ellipse cx="32" cy="44.5" rx="1.6" ry="1.9" fill={DARK} />
      </>;
  }
}

export default function TikBox({ mood, size = 160, still = false }: TikProps) {
  const detail = size >= 48;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} overflow="visible" role="img" aria-label={`Tik, ${mood}`}
      className={`tk tk-${mood}${still ? " still" : ""}`}>
      <g transform={mood === "sleeping" ? "rotate(-6 32 58)" : undefined}>
        <g className="tk-body">
          <Ln d="M22 54 v5 M42 54 v5" c={LIME} w={6} />
          <g className="tk-arm"><Ln d={ARMS[mood]} c={LIME} w={6} /></g>
          <rect x="12" y="20" width="40" height="36" rx="11" fill={LIME} />
          <g className="tk-crest" transform={mood === "sleeping" ? "rotate(14 30.5 23.5)" : undefined}>
            <Ln d="M25.5 18.5 L30.5 23.5 L40.5 9.5" c={DARK} w={9.5} />
            <Ln d="M25.5 18.5 L30.5 23.5 L40.5 9.5" c={LIME} w={5.5} />
          </g>
          <Face mood={mood} />
        </g>
      </g>

      {mood === "proud" && detail && <><Spark x={7} y={12} /><Spark x={56} y={12} s={0.75} /></>}
      {mood === "nudge" && detail && <Ln d="M61 31.5 L63.5 29 M61.5 42 L64 44.5" c={INK} w={1.4} cls="tk-pokemark" />}
      {mood === "ticking" && <>
        <g transform="translate(57 24)">
          <rect x="-1.6" y="-9.6" width="3.2" height="3.4" fill={INK} />
          <rect x="-3.4" y="-11" width="6.8" height="2.6" rx="1.3" fill={AMBER} />
          <circle r="6.2" fill={INK} />
          <circle r="4.6" fill="none" stroke={MUTE} strokeWidth="0.8" />
          <Ln d="M0 0 L0 -3.6 M0 0 L2.4 1.2" c={DARK} w={1.3} />
          <g className="tk-ring">
            <Ln d="M-6 -12 Q-8.6 -9 -8.2 -6 M6 -12 Q8.6 -9 8.2 -6" c={AMBER} w={1.6} />
          </g>
        </g>
        <Drop x={8} y={25} />
        {detail && <Drop x={5} y={34} s={0.6} />}
      </>}
      {mood === "collector" && (
        <g transform="translate(57 25) rotate(8)">
          <g className="tk-bill">
            <path d="M-6 -9 H6 V8 L4 6.6 L2 8 L0 6.6 L-2 8 L-4 6.6 L-6 8Z" fill={INK} />
            <g transform="translate(0 -3) scale(0.5)"><Rupee c={DARK} w={2.6} /></g>
            <Ln d="M-3.6 3 H3.6" c={MUTE} w={1.1} />
          </g>
        </g>
      )}
      {mood === "sleeping" && <Zs x={44} y={4} n={detail ? 3 : 2} />}
    </svg>
  );
}
