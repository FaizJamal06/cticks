import { tikSvg, type Mood } from "@/lib/tik";

/** Tik, the mascot. Decorative by default (hidden from screen readers); pass `title` when Tik carries meaning. */
export default function Tik({ mood, size = 32, still = true, title, className = "" }: {
  mood: Mood; size?: number; still?: boolean; title?: string; className?: string;
}) {
  return (
    <span className={`tik ${className}`} style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: tikSvg(mood, { size, still, title }) }} />
  );
}

/** The cTicks wordmark with a small Tik. Lives inside an element with class "logo" (sizes come from CSS). */
export function Logo({ tik = 32 }: { tik?: number }) {
  return <><Tik mood="proud" size={tik} /><span>c<i>T</i>icks</span></>;
}
