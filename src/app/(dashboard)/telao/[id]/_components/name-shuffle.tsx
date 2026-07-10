"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Nomes do pool piscando durante o suspense; ao parar (`rolling` false),
 * aterrissa no `finalName`. Se o pool estiver vazio, mostra um placeholder.
 */
export function NameShuffle({
  names,
  rolling,
  finalName,
}: {
  names: string[];
  rolling: boolean;
  finalName: string | null;
}) {
  const [current, setCurrent] = useState<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (rolling && names.length > 0) {
      timerRef.current = setInterval(() => {
        setCurrent(names[(Math.random() * names.length) | 0] ?? "");
      }, 80);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setCurrent(finalName ?? "");
  }, [rolling, finalName, names]);

  return (
    <p
      className="max-w-[92vw] truncate text-center font-bold tracking-tight text-white"
      style={{ fontSize: "clamp(1.5rem, 5vw, 4.5rem)" }}
    >
      {current || " "}
    </p>
  );
}
