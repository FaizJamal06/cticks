// Concept 1, "Stroke": the ✓ itself is the body. Its short arm is a raised arm; a stopwatch crown sits on its head like a hat.
import { AMBER, DARK, Drop, INK, LIME, Ln, Rupee, Spark, Zs, type TikProps } from "./shared";

const CHECK = "M11 32 L24 45 L50 16";
const ARM = {
  proud: "M44 33 L53 24.5",
  nudge: "M44.5 34 L57 34",
  ticking: "M45 33 L55 30",
  collector: "M44 35 L52.5 32",
  sleeping: "M44 35 L51.5 39.5",
};

function Face({ mood }: { mood: TikProps["mood"] }) {
  switch (mood) {
    case "proud":
      return <>
        <Ln d="M35 24.5 Q38 19.5 41 24.5" c={DARK} w={2.6} />
        <Ln d="M44 24.5 Q47 19.5 50 24.5" c={DARK} w={2.6} />
        <path d="M36.2 28.6 Q40.6 35.4 45.6 28 Z" fill={DARK} strokeLinejoin="round" stroke={DARK} strokeWidth="1.2" />
      </>;
    case "nudge":
      return <>
        <path d="M35.6 22.2 H41.6 A3 3.8 0 0 1 35.6 22.2Z M44.6 22.2 H50.6 A3 3.8 0 0 1 44.6 22.2Z" fill={DARK} />
        <circle cx="40.1" cy="24.2" r="0.9" fill={INK} />
        <circle cx="49.1" cy="24.2" r="0.9" fill={INK} />
        <Ln d="M36 19 L41 19.6" c={DARK} w={1.9} />
        <Ln d="M45 17.2 Q48 14.8 51 16.6" c={DARK} w={1.9} />
        <Ln d="M37 30.6 Q40.6 31.6 44 28.6" c={DARK} w={2.2} />
      </>;
    case "ticking":
      return <>
        <circle cx="38" cy="23" r="3.7" fill={DARK} />
        <circle cx="47" cy="23" r="3.7" fill={DARK} />
        <circle cx="39" cy="21.8" r="1.1" fill={INK} />
        <circle cx="48" cy="21.8" r="1.1" fill={INK} />
        <Ln d="M34.6 18.4 L40 16.6" c={DARK} w={1.9} />
        <Ln d="M44.6 16.4 L50.2 17.6" c={DARK} w={1.9} />
        <Ln d="M36 31 q1.3 -1.6 2.6 0 t2.6 0 t2.6 0" c={DARK} w={1.9} />
      </>;
    case "collector":
      return <>
        <path d="M35 22.6 H41 A3 3.6 0 0 1 35 22.6Z M44 22.6 H50 A3 3.6 0 0 1 44 22.6Z" fill={DARK} />
        <circle cx="38.8" cy="24.6" r="0.9" fill={INK} />
        <circle cx="47.8" cy="24.6" r="0.9" fill={INK} />
        <Ln d="M35.6 19.6 Q38 18.4 40.6 19.4 M44.4 19.2 Q47 18 49.6 19.2" c={DARK} w={1.8} />
        <Ln d="M36.4 29.2 L38.8 31.4 L44.6 27.2" c={DARK} w={2.3} />
      </>;
    case "sleeping":
      return <>
        <Ln d="M35.4 23.4 Q38 26.6 40.6 23.4" c={DARK} w={2.2} />
        <Ln d="M44.4 23.4 Q47 26.6 49.6 23.4" c={DARK} w={2.2} />
        <ellipse cx="41" cy="30" rx="1.4" ry="1.7" fill={DARK} />
      </>;
  }
}

export default function TikStroke({ mood, size = 160, still = false }: TikProps) {
  const detail = size >= 48;
  const crownColor = mood === "ticking" ? AMBER : LIME;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} overflow="visible" role="img" aria-label={`Tik, ${mood}`}
      className={`tk tk-${mood}${still ? " still" : ""}`}>
      <g transform={mood === "sleeping" ? "rotate(14 24 54)" : undefined}>
        <g className="tk-body">
          <Ln d="M20 52 v5 M28 52 v5" c={LIME} w={5.5} />
          <g className="tk-arm"><Ln d={ARM[mood]} c={LIME} w={6} /></g>
          <rect x="48" y="3" width="4" height="6" fill={LIME} />
          <rect className="tk-crown" x="44" y="0" width="12" height="4.4" rx="2.2" fill={crownColor} />
          <Ln d={CHECK} c={LIME} w={18} />
          <g transform="translate(-0.7 2) rotate(-8 42 25)"><Face mood={mood} /></g>
        </g>
      </g>

      {mood === "proud" && detail && <><Spark x={7} y={14} /><Spark x={60} y={30} s={0.7} /></>}
      {mood === "nudge" && detail && <Ln d="M60 29 L62.5 26.5 M60.5 39 L63 41.5" c={INK} w={1.4} cls="tk-pokemark" />}
      {mood === "ticking" && <>
        <g className="tk-ring">
          <Ln d="M41 -2 Q38.8 2.2 41 6.4 M59 -2 Q61.2 2.2 59 6.4" c={AMBER} w={1.8} />
          {detail && <Ln d="M37 -3.6 Q33.8 2.2 37 8 M63 -3.6 Q66.2 2.2 63 8" c={AMBER} w={1.6} />}
        </g>
        <Drop x={31} y={12} />
        {detail && <Drop x={27} y={20} s={0.6} />}
      </>}
      {mood === "collector" && (
        <g transform="translate(58 29)">
          <g className="tk-coin">
            <circle r="6.4" fill={AMBER} />
            <circle r="4.8" fill="none" stroke="#c7861c" strokeWidth="1" />
            <g transform="scale(0.62)"><Rupee c={DARK} w={2.2} /></g>
          </g>
        </g>
      )}
      {mood === "sleeping" && <Zs x={46} y={4} n={detail ? 3 : 2} />}
    </svg>
  );
}
