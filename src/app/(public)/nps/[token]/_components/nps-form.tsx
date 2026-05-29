"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  followupQuestionFor,
  NPS_THEME_LABELS,
  NPS_THEMES,
  scoreToCategory,
  type NpsCategory,
  type NpsTheme,
} from "@/lib/nps/scoring";

interface NpsFormProps {
  token: string;
  clientName: string | null;
  orderTitle: string | null;
  questions: { main: string; detractor: string; passive: string; promoter: string };
  initialScore: number | null;
}

const SCALE = Array.from({ length: 11 }, (_, i) => i);

function zoneClasses(n: number, selected: boolean): string {
  const base =
    "flex h-11 w-11 items-center justify-center rounded-lg border-2 text-base font-bold transition";
  if (n <= 6) {
    return `${base} ${selected ? "border-[#e2574c] bg-[#e2574c] text-white" : "border-[#e2574c]/40 text-[#e2574c] hover:border-[#e2574c]"}`;
  }
  if (n <= 8) {
    return `${base} ${selected ? "border-[#f5a623] bg-[#f5a623] text-white" : "border-[#f5a623]/40 text-[#f5a623] hover:border-[#f5a623]"}`;
  }
  return `${base} ${selected ? "border-[#2ecc71] bg-[#2ecc71] text-white" : "border-[#2ecc71]/40 text-[#2ecc71] hover:border-[#2ecc71]"}`;
}

const THANK_YOU: Record<NpsCategory, string> = {
  DETRATOR:
    "Recebemos seu retorno e sentimos muito que não tenha sido a melhor experiência. Nossa equipe pode entrar em contato para resolver. Obrigado pela sinceridade. 💙",
  PASSIVO: "Obrigado pelo seu retorno! Vamos usar isso para melhorar cada vez mais. 💙",
  PROMOTOR: "Que alegria! 💙 Muito obrigado por recomendar a ADDS — significa muito pra gente.",
};

function TerminalCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#21add6]/10 text-3xl">
        💙
      </div>
      <h1 className="text-xl font-bold text-[#0b4269]">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{message}</p>
    </div>
  );
}

export function NpsForm({
  token,
  clientName,
  orderTitle,
  questions,
  initialScore,
}: NpsFormProps) {
  const [score, setScore] = useState<number | null>(initialScore);
  const [comment, setComment] = useState("");
  const [themes, setThemes] = useState<NpsTheme[]>([]);
  const [allowContact, setAllowContact] = useState(true);
  const [allowTestimonial, setAllowTestimonial] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<NpsCategory | null>(null);
  const [closed, setClosed] = useState<string | null>(null);

  const category: NpsCategory | null = score == null ? null : scoreToCategory(score);
  const showThemes = category === "DETRATOR" || category === "PASSIVO";

  // Revela o follow-up: rola até ele na primeira vez (pista visual no mobile);
  // o aria-live="polite" do bloco anuncia para leitores de tela.
  const followupRef = useRef<HTMLDivElement>(null);
  const revealedRef = useRef(false);
  useEffect(() => {
    if (category && !revealedRef.current) {
      revealedRef.current = true;
      followupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [category]);

  function toggleTheme(t: NpsTheme) {
    setThemes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  async function handleSubmit() {
    if (score == null) return;
    setLoading(true);
    setError(null);
    try {
      // Gate por categoria: não enviar estado de uma faixa que não se aplica mais
      const res = await fetch("/api/nps/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          score,
          comment: comment.trim() || undefined,
          themes: showThemes && themes.length ? themes : undefined,
          allow_contact: showThemes ? allowContact : true,
          allow_testimonial: category === "PROMOTOR" ? allowTestimonial : false,
        }),
      });
      const json = (await res.json()) as { error?: string; category?: NpsCategory };
      if (res.status === 409) {
        // estado terminal (já respondida / encerrada / cancelada) — não reeditável
        setClosed(json.error ?? "Esta pesquisa não está mais disponível.");
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Não foi possível enviar sua resposta.");
      setDone(json.category ?? category);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar sua resposta.");
    } finally {
      setLoading(false);
    }
  }

  if (closed) return <TerminalCard title="Pesquisa encerrada" message={closed} />;
  if (done) return <TerminalCard title="Obrigado!" message={THANK_YOU[done]} />;

  return (
    <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-xl font-bold text-[#0b4269]">
        {clientName ? `Olá, ${clientName}!` : "Olá!"}
      </h1>
      <p id="nps-main-question" className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {orderTitle ? <>Sobre seu pedido “{orderTitle}”. </> : null}
        {questions.main}
      </p>

      {/* Escala 0–10 */}
      <div className="mt-5">
        <div
          role="group"
          aria-labelledby="nps-main-question"
          aria-label="Nota de 0 a 10 — 0 nada provável, 10 muito provável"
          className="flex flex-wrap justify-center gap-2"
        >
          {SCALE.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={score === n}
              aria-label={`Nota ${n}`}
              onClick={() => setScore(n)}
              className={zoneClasses(n, score === n)}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-between px-1 text-xs text-muted-foreground">
          <span>0 · nada provável</span>
          <span>muito provável · 10</span>
        </div>
      </div>

      {/* Follow-up condicional */}
      {category && (
        <div ref={followupRef} aria-live="polite" className="mt-6 space-y-4 border-t pt-5">
          <div>
            <Label htmlFor="nps-comment" className="text-sm font-medium text-[#0b4269]">
              {followupQuestionFor(category, {
                question_detractor: questions.detractor,
                question_passive: questions.passive,
                question_promoter: questions.promoter,
              })}
            </Label>
            <Textarea
              id="nps-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Conte pra gente (opcional)…"
              className="mt-2"
            />
          </div>

          {showThemes && (
            <div
              role="group"
              aria-label={
                category === "DETRATOR"
                  ? "O que mais pesou nessa experiência?"
                  : "O que faltou para ser uma nota máxima?"
              }
            >
              <p className="mb-2 text-sm font-medium text-[#0b4269]">
                {category === "DETRATOR"
                  ? "O que mais pesou nessa experiência?"
                  : "O que faltou para ser uma nota máxima?"}
              </p>
              <div className="flex flex-wrap gap-2">
                {NPS_THEMES.map((t) => {
                  const active = themes.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleTheme(t)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? "border-[#21add6] bg-[#21add6] text-white"
                          : "border-input text-muted-foreground hover:border-[#21add6]"
                      }`}
                    >
                      {NPS_THEME_LABELS[t]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {showThemes && (
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={allowContact}
                onCheckedChange={(v) => setAllowContact(v === true)}
                className="mt-0.5"
              />
              <span>Quero que a ADDS entre em contato para resolver isso.</span>
            </label>
          )}

          {category === "PROMOTOR" && (
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={allowTestimonial}
                onCheckedChange={(v) => setAllowTestimonial(v === true)}
                className="mt-0.5"
              />
              <span>Autorizo a ADDS a usar meu comentário como depoimento.</span>
            </label>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-[#21add6] text-white hover:bg-[#1c97bb]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…
              </>
            ) : (
              "Enviar resposta"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
