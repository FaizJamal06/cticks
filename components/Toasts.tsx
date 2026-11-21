"use client";
import { useEffect, useState } from "react";
import type { Mood } from "@/lib/tik";
import Tik from "./Tik";

type Item = { id: number; msg: string; mood?: Mood };

export default function Toasts() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const id = Date.now() + Math.random();
      const { msg, mood } = (e as CustomEvent<{ msg: string; mood?: Mood }>).detail;
      setItems((xs) => [...xs.slice(-2), { id, msg, mood }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 5000);
    };
    window.addEventListener("payup-toast", on);
    return () => window.removeEventListener("payup-toast", on);
  }, []);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div className="toast" key={t.id}>{t.mood && <Tik mood={t.mood} size={24} />}<span>{t.msg}</span></div>
      ))}
    </div>
  );
}
