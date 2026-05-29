import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export interface NpsSurveyEmailProps {
  clientName: string | null;
  surveyUrl: string;
  orderTitle: string | null;
  isReminder?: boolean;
}

const ADDS_BLUE = "#21add6";
const ADDS_NAVY = "#0b4269";

/** cor da nota por zona: 0-6 vermelho · 7-8 âmbar · 9-10 verde */
function zoneColor(n: number): string {
  if (n <= 6) return "#e2574c";
  if (n <= 8) return "#f5a623";
  return "#2ecc71";
}

export function NpsSurveyEmail({
  clientName,
  surveyUrl,
  orderTitle,
  isReminder = false,
}: NpsSurveyEmailProps) {
  const greeting = clientName ? `Olá, ${clientName}!` : "Olá!";
  const scale = Array.from({ length: 11 }, (_, i) => i);
  const preview = isReminder
    ? "Lembrete: sua opinião vale muito"
    : "Como foi sua experiência com a ADDS?";

  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.h1}>{greeting}</Heading>

          <Text style={styles.text}>
            {orderTitle
              ? `Você recebeu recentemente o pedido “${orderTitle}”. `
              : ""}
            Numa escala de <strong>0 a 10</strong>, o quanto você recomendaria a{" "}
            <strong>ADDS Brasil</strong> a um amigo ou colega?
          </Text>

          <Section style={styles.scaleWrap}>
            {scale.map((n) => (
              <Link
                key={n}
                href={`${surveyUrl}?score=${n}`}
                style={{ ...styles.scoreBtn, borderColor: zoneColor(n), color: zoneColor(n) }}
              >
                {n}
              </Link>
            ))}
          </Section>

          <Text style={styles.legend}>
            0 = nada provável&nbsp;&nbsp;·&nbsp;&nbsp;10 = muito provável
          </Text>

          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            Leva menos de 30 segundos e nos ajuda a melhorar cada vez mais. Obrigado! 💙
            <br />
            Equipe ADDS Brasil
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default NpsSurveyEmail;

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: "#f4f6f8",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    margin: 0,
    padding: "24px 0",
  },
  container: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    margin: "0 auto",
    maxWidth: 520,
    padding: "32px 28px",
  },
  h1: { color: ADDS_NAVY, fontSize: 22, fontWeight: 700, margin: "0 0 12px" },
  text: { color: "#2d3748", fontSize: 16, lineHeight: "24px", margin: "0 0 20px" },
  scaleWrap: { textAlign: "center" as const, margin: "8px 0 4px" },
  scoreBtn: {
    border: "2px solid",
    borderRadius: 8,
    display: "inline-block",
    fontSize: 16,
    fontWeight: 700,
    margin: "4px",
    padding: "10px 0",
    textAlign: "center" as const,
    textDecoration: "none",
    width: 34,
  },
  legend: {
    color: "#718096",
    fontSize: 12,
    margin: "8px 0 0",
    textAlign: "center" as const,
  },
  hr: { borderColor: "#e2e8f0", margin: "24px 0" },
  footer: { color: "#718096", fontSize: 13, lineHeight: "20px", margin: 0 },
};
