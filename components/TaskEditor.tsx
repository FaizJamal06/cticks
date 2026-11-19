"use client";
import type { Task } from "@/lib/logic";
import { newId } from "@/lib/client";

const PLACEHOLDERS = ["Gym, 45 min", "Read 20 pages", "No sugar", "2 LeetCode problems", "Sleep before 1am", "10k steps", "No reels before noon", "Journal"];

export const blankTasks = (): Task[] => [0, 1, 2].map(() => ({ id: newId(), text: "" }));
export const cleanTasks = (ts: Task[]) => ts.map((t) => ({ id: t.id, text: t.text.trim().slice(0, 60) })).filter((t) => t.text);

export default function TaskEditor({ tasks, onChange }: { tasks: Task[]; onChange: (t: Task[]) => void }) {
  const set = (i: number, text: string) => onChange(tasks.map((t, j) => (j === i ? { ...t, text } : t)));
  return (
    <div>
      {tasks.map((t, i) => (
        <div className="te-row" key={t.id}>
          <span className="n">{String(i + 1).padStart(2, "0")}</span>
          <input className="input" value={t.text} maxLength={60} placeholder={PLACEHOLDERS[i % PLACEHOLDERS.length]}
            onChange={(e) => set(i, e.target.value)} />
          {tasks.length > 1 && (
            <button type="button" className="x" aria-label="Remove task" onClick={() => onChange(tasks.filter((_, j) => j !== i))}>×</button>
          )}
        </div>
      ))}
      {tasks.length < 8 && (
        <button type="button" className="btn ghost small" style={{ marginTop: 10 }}
          onClick={() => onChange([...tasks, { id: newId(), text: "" }])}>+ add task</button>
      )}
    </div>
  );
}

export function RulePicker({ value, onChange }: { value: "all" | "none"; onChange: (v: "all" | "none") => void }) {
  return (
    <div className="choice">
      <button type="button" className={value === "all" ? "on" : ""} onClick={() => onChange("all")}>
        <b>Finish every task</b><span>Leave even one task undone and that day counts as a miss.</span>
      </button>
      <button type="button" className={value === "none" ? "on" : ""} onClick={() => onChange("none")}>
        <b>Do at least one</b><span>It only counts as a miss if you did none of your tasks that day.</span>
      </button>
    </div>
  );
}
