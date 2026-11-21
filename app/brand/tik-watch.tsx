// Concept 2, "Stopwatch": a round stopwatch is the body, the ✓ is its grin.
import { AMBER, DARK, Drop, INK, LIME, Ln, Rupee, Spark, Zs, type TikProps } from "./shared";

const ARMS = {
  proud: "M14 31 L7.5 21 M50 31 L56.5 21",
  nudge: "M13 40 L8 46 M51 37.5 L59.5 35.5",
  ticking: "M13.5 35 L6 31.5 M50.5 35 L58 31.5",
  collector: "M13 39 L8 43.5 L12.5 48.5 M50 36 L54.5 31",
  sleeping: "M13 42 L10 48 M51 42 L54 48",
};

function Face({ mood }: { mood: TikProps["mood"] }) {
  switch (mood) {
    case "proud":
      return <>
        <Ln d="M22.5 33 Q26.5 27.5 30.5 33" c={INK} w={2.6} />
        <Ln d="M33.5 33 Q37.5 27.5 41.5 33" c={INK} w={2.6} />
        <Ln d="M26 41.5 L30 45.5 L38.5 38.5" c={LIME} w={2.8} />
      </>;
    case "nudge":
      return <>
        <path d="M22.5 32.5 H30.5 A4 4.6 0 0 1 22.5 32.5Z" fill={INK} />
        <path d="M33.5 32.5 H41.5 A4 4.6 0 0 1 33.5 32.5Z" fill={INK} />
        <circle cx="28.6" cy="34.3" r="1.9" fill={DARK} />
        <circle cx="39.6" cy="34.3" r="1.9" fill={DARK} />
        <Ln d="M22.5 30 L30 30.6" c={LIME} w={1.7} />
        <Ln d="M33.5 29 Q37.5 26 41.5 28.4" c={LIME} w={1.7} />
        <Ln d="M28 44 Q33 45 37.5 41.5" c={LIME} w={2.4} />
      </>;
    case "ticking":
      return <>
        <circle cx="26.5" cy="34" r="4.6" fill={INK} />
        <circle cx="37.5" cy="34" r="4.6" fill={INK} />
        <circle cx="26.5" cy="32.4" r="1.5" fill={DARK} />
        <circle cx="37.5" cy="32.4" r="1.5" fill={DARK} />
        <Ln d="M22.5 28 L29.5 26.2" c={LIME} w={1.7} />
        <Ln d="M34.5 26.2 L41.5 28" c={LIME} w={1.7} />
        <Ln d="M26.5 44.5 q1.5 -1.8 3 0 t3 0 t3 0 t2 0" c={LIME} w={2} />
      </>;
    case "collector":
      return <>
        <path d="M22.5 33 H30.5 A4 4.2 0 0 1 22.5 33Z" fill={INK} />
        <path d="M33.5 33 H41.5 A4 4.2 0 0 1 33.5 33Z" fill={INK} />
        <circle cx="26.5" cy="34.8" r="1.9" fill={DARK} />
        <circle cx="37.5" cy="34.8" r="1.9" fill={DARK} />
        <Ln d="M22.5 30.2 Q26.5 28.6 30.5 30.2" c={LIME} w={1.7} />
        <Ln d="M33.5 29.4 Q37.5 27.4 41.5 29.4" c={LIME} w={1.7} />
        <Ln d="M27.5 42 L30 44.5 L37.5 39.6" c={LIME} w={2.6} />
      </>;
    case "sleeping":
      return <>
        <Ln d="M22.5 34 Q26.5 38 30.5 34" c={INK} w={2.4} />
        <Ln d="M33.5 34 Q37.5 38 41.5 34" c={INK} w={2.4} />
        <ellipse cx="32" cy="43.5" rx="1.6" ry="1.9" fill="none" stroke={LIME} strokeWidth="1.6" />
      </>;
  }
}

export default function TikWatch({ mood, size = 160, still = false }: TikProps) {
  const detail = size >= 48;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} overflow="visible" role="img" aria-label={`Tik, ${mood}`}
      className={`tk tk-${mood}${still ? " still" : ""}`}>
      <g transform={mood === "sleeping" ? "rotate(-7 32 58)" : undefined}>
        <g className="tk-body">
          <Ln d="M25 54 v5 M39 54 v5" c={LIME} w={6} />
          <g className="tk-arm"><Ln d={ARMS[mood]} c={LIME} w={6} /></g>
          <rect x="29" y="11" width="6" height="7" fill={LIME} />
          <rect className="tk-crown" x="24.5" y="7" width="15" height="5.5" rx="2.75" fill={mood === "ticking" ? AMBER : LIME} />
          <rect x="-2.5" y="-2" width="5" height="4" rx="1" transform="translate(47.3 20.7) rotate(45)" fill={LIME} />
          <circle cx="32" cy="36" r="20" fill={LIME} />
          <circle cx="32" cy="36" r="15" fill={DARK} />
          <Face mood={mood} />
        </g>
      </g>

      {mood === "proud" && detail && <><Spark x={8} y={10} /><Spark x={57} y={8} s={0.75} /></>}
      {mood === "nudge" && detail && <Ln d="M60 29.5 L62.5 27 M61.5 40 L64 42" c={INK} w={1.4} cls="tk-pokemark" />}
      {mood === "ticking" && <>
        <g className="tk-ring">
          <Ln d="M21 5 Q18.6 9.75 21 14.5 M43 5 Q45.4 9.75 43 14.5" c={AMBER} w={1.8} />
          {detail && <Ln d="M17 3 Q13.6 9.75 17 16.5 M47 3 Q50.4 9.75 47 16.5" c={AMBER} w={1.6} />}
        </g>
        <Drop x={12} y={21} />
        {detail && <Drop x={7} y={24} s={0.6} />}
      </>}
      {mood === "collector" && (
        <g transform="translate(57.5 26.5)">
          <g className="tk-coin">
            <circle r="6.4" fill={AMBER} />
            <circle r="4.8" fill="none" stroke="#c7861c" strokeWidth="1" />
            <g transform="scale(0.62)"><Rupee c={DARK} w={2.2} /></g>
          </g>
        </g>
      )}
      {mood === "sleeping" && <Zs x={44} y={6} n={detail ? 3 : 2} />}
    </svg>
  );
}
