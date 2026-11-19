"use client";
import { useEffect, useState } from "react";

export default function Toasts() {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs.slice(-2), { id, msg: (e as CustomEvent).detail }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 5000);
    };
    window.addEventListener("payup-toast", on);
    return () => window.removeEventListener("payup-toast", on);
  }, []);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div className="toast" key={t.id}>{t.msg}</div>
      ))}
    </div>
  );
}
