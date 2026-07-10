"use client";

import { useEffect, useRef, useState } from "react";

function pad4(n: number | null): string {
  return n == null ? "----" : String(n).padStart(4, "0").slice(-4);
}

/**
 * Número da sorte estilo roleta/slot: enquanto `rolling`, os 4 dígitos giram
 * rápido; quando para, trava no `value` (padded 4). Fonte mono tabular.
 */
export function LuckyNumberRoll({
  value,
  rolling,
}: {
  value: number | null;
  rolling: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(["-", "-", "-", "-"]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (rolling) {
      timerRef.current = setInterval(() => {
        setDigits(
          Array.from({ length: 4 }, () => String((Math.random() * 10) | 0))
        );
      }, 55);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setDigits(pad4(value).split(""));
  }, [rolling, value]);

  return (
    <div className="flex items-center justify-center gap-[1.2vw]">
      {digits.map((d, i) => (
        <span
          key={i}
          className="inline-flex items-center justify-center rounded-[1.2vw] bg-white/5 px-[1.6vw] font-mono font-black leading-none text-white shadow-[0_0_60px_rgba(33,173,214,0.25)] ring-1 ring-white/10 tabular-nums"
          style={{
            fontSize: "clamp(3.5rem, 16vw, 15rem)",
            minWidth: "0.9em",
          }}
        >
          {d}
        </span>
      ))}
    </div>
  );
}
