/**
 * Áudio do telão do sorteio (E8). Sintetizado via Web Audio API (sem assets):
 * `playRoll` = riser de tensão (drumroll acelerando + sweep), `playReveal` =
 * impacto + acorde de fanfarra + shimmer. Autoplay policy: `arm()` DEVE ser
 * chamado num gesto do usuário (o "Clique para iniciar" do telão).
 *
 * Override opcional por MP3: se existir `/public/telao/roll.mp3` e/ou
 * `/public/telao/reveal.mp3`, eles são usados no lugar do sintetizado.
 */
export interface TelaoAudio {
  arm: () => void;
  playRoll: () => void;
  stopRoll: () => void;
  playReveal: () => void;
  close: () => void;
}

export function createTelaoAudio(): TelaoAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;

  // Overrides MP3 (carregados sob demanda no arm; ficam null se não existirem).
  let rollEl: HTMLAudioElement | null = null;
  let revealEl: HTMLAudioElement | null = null;

  // Estado do riser sintetizado.
  let rollTimer: ReturnType<typeof setInterval> | null = null;
  let rollSweep: { osc: OscillatorNode; gain: GainNode } | null = null;
  let tickRate = 90; // ms entre ticks (acelera durante o roll)

  function noiseBuffer(seconds: number): AudioBuffer {
    const c = ctx!;
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function tick() {
    if (!ctx || !master) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.05);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
    src.stop(t + 0.06);
  }

  function scheduleTick() {
    tick();
    tickRate = Math.max(28, tickRate * 0.985); // acelera progressivamente
    rollTimer = setTimeout(scheduleTick, tickRate);
  }

  function tone(
    freq: number,
    start: number,
    dur: number,
    peak: number,
    type: OscillatorType = "sine"
  ) {
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  async function tryLoadMp3(
    src: string,
    loop: boolean
  ): Promise<HTMLAudioElement | null> {
    try {
      const res = await fetch(src, { method: "HEAD" });
      if (!res.ok) return null;
      const el = new Audio(src);
      el.loop = loop;
      el.preload = "auto";
      return el;
    } catch {
      return null;
    }
  }

  return {
    arm() {
      if (ctx) return;
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      // Overrides opcionais (silenciosos se ausentes).
      void tryLoadMp3("/telao/roll.mp3", true).then((el) => (rollEl = el));
      void tryLoadMp3("/telao/reveal.mp3", false).then((el) => (revealEl = el));
    },

    playRoll() {
      if (!ctx || !master) return;
      void ctx.resume();
      if (rollEl) {
        rollEl.currentTime = 0;
        void rollEl.play().catch(() => {});
        return;
      }
      // Riser sintetizado: ticks acelerando + sweep de ruído subindo.
      tickRate = 90;
      if (!rollTimer) scheduleTick();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 4;
      const t = ctx.currentTime;
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(80, t);
      osc.frequency.exponentialRampToValueAtTime(520, t + 4);
      bp.frequency.setValueAtTime(200, t);
      bp.frequency.exponentialRampToValueAtTime(2400, t + 4);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 3.6);
      osc.connect(bp).connect(g).connect(master);
      osc.start(t);
      rollSweep = { osc, gain: g };
    },

    stopRoll() {
      if (rollTimer) {
        clearTimeout(rollTimer as unknown as number);
        rollTimer = null;
      }
      if (rollEl) {
        rollEl.pause();
      }
      if (rollSweep && ctx) {
        const t = ctx.currentTime;
        rollSweep.gain.gain.cancelScheduledValues(t);
        rollSweep.gain.gain.setValueAtTime(rollSweep.gain.gain.value, t);
        rollSweep.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        rollSweep.osc.stop(t + 0.1);
        rollSweep = null;
      }
    },

    playReveal() {
      if (!ctx || !master) return;
      void ctx.resume();
      if (revealEl) {
        revealEl.currentTime = 0;
        void revealEl.play().catch(() => {});
        return;
      }
      const t = ctx.currentTime;
      // Impacto: sub-boom (queda de frequência) + estouro de ruído.
      const boom = ctx.createOscillator();
      const bg = ctx.createGain();
      boom.type = "sine";
      boom.frequency.setValueAtTime(160, t);
      boom.frequency.exponentialRampToValueAtTime(42, t + 0.5);
      bg.gain.setValueAtTime(0.9, t);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      boom.connect(bg).connect(master);
      boom.start(t);
      boom.stop(t + 0.65);

      const burst = ctx.createBufferSource();
      burst.buffer = noiseBuffer(0.25);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.5, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      burst.connect(ng).connect(master);
      burst.start(t);

      // Acorde de fanfarra (maior) + oitava, com brilho.
      const chord = [523.25, 659.25, 783.99, 1046.5];
      chord.forEach((f, i) =>
        tone(f, t + 0.04 + i * 0.02, 1.3, 0.22, "triangle")
      );
      // Shimmer agudo.
      tone(1567.98, t + 0.12, 1.1, 0.12, "sine");
    },

    close() {
      this.stopRoll();
      void ctx?.close();
      ctx = null;
      master = null;
    },
  };
}
