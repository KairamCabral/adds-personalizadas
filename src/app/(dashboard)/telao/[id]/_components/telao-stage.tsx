"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Play, Trophy, Sparkles, Volume2 } from "lucide-react";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { createTelaoAudio, type TelaoAudio } from "@/lib/congressos/telao-audio";
import {
  createRaffleChannel,
  type RaffleChannel,
} from "@/lib/congressos/raffle-channel";
import type { EventEdition } from "@/types/database.types";
import type {
  RaffleDrawResult,
  RafflePoolEntry,
} from "@/services/congressos-raffle.service";
import { TelaoBackdrop } from "./telao-backdrop";
import { ConfettiCanvas } from "./confetti-canvas";
import { LuckyNumberRoll } from "./lucky-number-roll";
import { NameShuffle } from "./name-shuffle";

const ROLL_MS = 3800;
// Logo ADDS branca (SVG vetorial → nítida em qualquer tamanho), sem fundo.
const WHITE_LOGO = "/Logo%20ADDS%20Branca.svg";

type Phase = "armed" | "idle" | "rolling" | "revealed";

export function TelaoStage({
  editionId,
  edition,
  pool,
}: {
  editionId: string;
  edition: EventEdition;
  pool: RafflePoolEntry[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { enter } = useFullscreen();
  const audioRef = useRef<TelaoAudio | null>(null);
  const rollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<Phase>("armed");
  const [winner, setWinner] = useState<RaffleDrawResult | null>(null);
  const [fireKey, setFireKey] = useState(0);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const names = useMemo(
    () => pool.map((p) => p.name ?? "").filter(Boolean),
    [pool]
  );
  const prize = edition.raffle_prize?.trim() || "Prêmio do sorteio";

  const startReveal = useCallback((w: RaffleDrawResult) => {
    if (phaseRef.current === "rolling") return; // não sobrepõe uma revelação
    setWinner(w);
    setPhase("rolling");
    audioRef.current?.playRoll();
    rollTimeoutRef.current = setTimeout(() => {
      audioRef.current?.stopRoll();
      audioRef.current?.playReveal();
      setFireKey((k) => k + 1);
      setPhase("revealed");
    }, ROLL_MS);
  }, []);

  // Canal controle → telão (BroadcastChannel + Realtime broadcast).
  useEffect(() => {
    const ch: RaffleChannel = createRaffleChannel(editionId);
    ch.subscribe((msg) => startReveal(msg.winner));
    return () => {
      ch.close();
      if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
      audioRef.current?.close();
    };
  }, [editionId, startReveal]);

  const handleArm = () => {
    const audio = createTelaoAudio();
    audio.arm();
    audioRef.current = audio;
    enter(containerRef.current);
    setPhase("idle");
  };

  const rolling = phase === "rolling";
  const revealed = phase === "revealed";

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex h-dvh w-dvw items-center justify-center overflow-hidden text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <TelaoBackdrop intense={rolling || revealed} />
      <ConfettiCanvas fireKey={fireKey} />

      {/* Marca no topo (fora do splash) */}
      {phase !== "armed" && (
        <div className="absolute left-[3vw] top-[3vh] flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={WHITE_LOGO} alt="ADDS" className="h-9 w-auto sm:h-11" />
          <span className="text-lg font-bold tracking-tight text-white/90">
            {edition.name}
          </span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* SPLASH / ARMAR */}
        {phase === "armed" && (
          <motion.div
            key="armed"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-8 px-6 text-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={WHITE_LOGO}
              alt="ADDS"
              className="w-auto drop-shadow-[0_0_40px_rgba(33,173,214,0.35)]"
              style={{ height: "clamp(4.5rem, 13vw, 9rem)" }}
            />
            <div>
              <h1
                className="font-black tracking-tight"
                style={{ fontSize: "clamp(2.5rem, 8vw, 6rem)" }}
              >
                Sorteio
              </h1>
              <p className="mt-2 text-white/70" style={{ fontSize: "clamp(1rem,3vw,2rem)" }}>
                {edition.name} · {prize}
              </p>
            </div>
            <button
              onClick={handleArm}
              className="group flex items-center gap-3 rounded-full bg-[#f07d00] px-10 py-5 text-2xl font-bold shadow-[0_0_50px_rgba(240,125,0,0.5)] transition-transform hover:scale-105"
            >
              <Play className="h-7 w-7 fill-current" />
              Iniciar telão
            </button>
            <p className="flex items-center gap-2 text-sm text-white/50">
              <Volume2 className="h-4 w-4" />
              Libera o som e entra em tela cheia
            </p>
          </motion.div>
        )}

        {/* OCIOSO — aguardando */}
        {phase === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-6 px-6 text-center"
          >
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.2, repeat: Infinity }}
              className="flex items-center gap-3 text-white/70"
            >
              <Sparkles className="h-7 w-7 text-[#21add6]" />
              <span style={{ fontSize: "clamp(1.25rem,3.5vw,2.5rem)" }}>
                Aguardando o sorteio…
              </span>
            </motion.div>
            <p
              className="font-black tracking-tight text-white"
              style={{ fontSize: "clamp(2rem,7vw,5.5rem)" }}
            >
              {prize}
            </p>
            <p className="text-white/60" style={{ fontSize: "clamp(1rem,2.5vw,1.75rem)" }}>
              {pool.length.toLocaleString("pt-BR")} concorrendo
            </p>
          </motion.div>
        )}

        {/* ROLANDO / REVELADO */}
        {(rolling || revealed) && (
          <motion.div
            key="draw"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-[2vh] px-4 text-center"
          >
            <motion.p
              className="font-semibold uppercase tracking-[0.3em] text-white/60"
              style={{ fontSize: "clamp(0.8rem,2vw,1.4rem)" }}
              animate={rolling ? { opacity: [0.4, 1, 0.4] } : { opacity: 1 }}
              transition={rolling ? { duration: 0.9, repeat: Infinity } : {}}
            >
              {rolling ? "Sorteando…" : "Número da sorte"}
            </motion.p>

            <motion.div
              animate={
                rolling
                  ? { scale: [1, 1.03, 1] }
                  : { scale: [0.8, 1.06, 1] }
              }
              transition={
                rolling
                  ? { duration: 0.5, repeat: Infinity }
                  : { duration: 0.6, ease: "easeOut" }
              }
            >
              <LuckyNumberRoll
                value={winner?.raffle_number ?? null}
                rolling={rolling}
              />
            </motion.div>

            <NameShuffle
              names={names}
              rolling={rolling}
              finalName={winner?.participant_name ?? null}
            />

            {revealed && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="flex items-center gap-3 rounded-full bg-[#f07d00]/20 px-6 py-2 ring-1 ring-[#f07d00]/40">
                  <Trophy className="h-7 w-7 text-[#f07d00]" />
                  <span
                    className="font-bold text-[#f5b25e]"
                    style={{ fontSize: "clamp(1rem,3vw,2rem)" }}
                  >
                    {prize}
                  </span>
                </div>
                <p className="text-white/60" style={{ fontSize: "clamp(0.9rem,2vw,1.4rem)" }}>
                  Sorteado entre {(winner?.pool_size ?? pool.length).toLocaleString("pt-BR")} elegíveis
                </p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
