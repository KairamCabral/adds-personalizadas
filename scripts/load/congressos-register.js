// Teste de carga do pré-cadastro de congresso (E7 / Story 7.2 — gate de go-live).
// Ver docs/congressos-load-test.md para o roteiro completo.
//
// Rodar (em PREVIEW/STAGING, nunca produção — cria contatos reais no Tiny + e-mails):
//   BASE_URL=https://<preview>.vercel.app \
//   EDITION_SLUG=<slug-da-edicao-de-teste> \
//   RATE=300 DURATION=10m \
//   k6 run scripts/load/congressos-register.js
//
// A edição de teste precisa de turnstile_enabled=false (break-glass) e is_active=true.
import http from "k6/http";
import { check } from "k6";

const BASE = __ENV.BASE_URL; // ex.: https://<preview>.vercel.app
const SLUG = __ENV.EDITION_SLUG; // edição de teste (turnstile_enabled=false)

export const options = {
  scenarios: {
    peak: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.RATE || 300), // cadastros por minuto
      timeUnit: "1m",
      duration: __ENV.DURATION || "10m",
      preAllocatedVUs: 50,
      maxVUs: 300,
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<1000"], // GATE: submit p95 < 1s
    http_req_failed: ["rate<0.01"],
  },
};

// CPF com dígitos verificadores válidos (senão o route responde 400).
function cpf() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (arr) => {
    let f = arr.length + 1;
    let s = 0;
    for (const d of arr) s += d * f--;
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(n);
  const d2 = dv([...n, d1]);
  return [...n, d1, d2].join("");
}

// IP único por request para não bater no rate-limit por IP (congress-reg:${ip}).
function xff() {
  const o = () => (Math.random() * 255) | 0;
  return `10.${o()}.${o()}.${o()}`;
}

export default function () {
  if (!BASE || !SLUG) {
    throw new Error("Defina BASE_URL e EDITION_SLUG no ambiente.");
  }
  const doc = cpf();
  const body = JSON.stringify({
    slug: SLUG,
    document: doc,
    name: `Carga ${doc}`,
    email: `carga+${doc}@example.com`,
    phone: "11999999999",
    contact_type: "DENTISTA", // caminho "qualificado" (promove a client)
    consent: true,
    consent_version: "loadtest-v1",
    idempotency_key: `lt-${doc}-${Date.now()}`,
  });

  const res = http.post(`${BASE}/api/congressos/register`, body, {
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": xff(),
    },
  });

  check(res, {
    "status 200": (r) => r.status === 200,
    "tem token": (r) => {
      try {
        return !!r.json("token");
      } catch (_e) {
        return false;
      }
    },
  });
}
