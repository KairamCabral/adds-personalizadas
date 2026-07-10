import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export interface CongressoGiftEmailProps {
  participantFirstName: string | null;
  editionName: string | null;
  giftName: string | null;
  shortCode: string;
  /** frase de cashback (Épico 6). Null = não renderiza a seção. */
  cashbackLabel?: string | null;
  /** URL HTTPS da logo (data-URI não renderiza no Gmail). Null = oculta. */
  logoUrl: string | null;
  /** URL HTTPS do QR do brinde (data-URI não renderiza no Gmail). Null = oculta. */
  qrUrl: string | null;
}

const ADDS_BLUE = "#21add6";
const ADDS_NAVY = "#0b4269";

export function CongressoGiftEmail({
  participantFirstName,
  editionName,
  giftName,
  shortCode,
  cashbackLabel,
  logoUrl,
  qrUrl,
}: CongressoGiftEmailProps) {
  const greeting = participantFirstName
    ? `Prontinho, ${participantFirstName}!`
    : "Brinde liberado!";
  const giftLabel = giftName ?? "seu brinde";
  const preview = `Seu código do brinde é ${shortCode}`;

  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {logoUrl ? (
            <Img
              src={logoUrl}
              alt="ADDS Brasil"
              width={80}
              height={80}
              style={styles.logo}
            />
          ) : null}

          <Heading style={styles.h1}>{greeting}</Heading>

          <Text style={styles.text}>
            {editionName
              ? `Seu pré-cadastro no ${editionName} está confirmado. `
              : "Seu pré-cadastro está confirmado. "}
            Mostre o código abaixo no balcão para retirar{" "}
            <strong>{giftLabel}</strong>.
          </Text>

          <Section style={styles.codeWrap}>
            <Text style={styles.codeLabel}>Código do brinde</Text>
            <Text style={styles.code}>{shortCode}</Text>
          </Section>

          {cashbackLabel ? (
            <Section style={styles.cashbackWrap}>
              <Text style={styles.cashbackText}>💰 {cashbackLabel}</Text>
            </Section>
          ) : null}

          {qrUrl ? (
            <Section style={styles.qrWrap}>
              <Img
                src={qrUrl}
                alt="QR code do seu brinde"
                width={200}
                height={200}
                style={styles.qr}
              />
              <Text style={styles.qrHint}>
                Ou apresente este QR code na retirada.
              </Text>
            </Section>
          ) : null}

          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            Guarde este e-mail — ele é o seu comprovante. Até lá! 💙
            <br />
            Equipe ADDS Brasil
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default CongressoGiftEmail;

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
  logo: { display: "block", height: 80, margin: "0 auto 16px", width: 80 },
  h1: { color: ADDS_NAVY, fontSize: 22, fontWeight: 700, margin: "0 0 12px" },
  text: { color: "#2d3748", fontSize: 16, lineHeight: "24px", margin: "0 0 20px" },
  codeWrap: {
    backgroundColor: "#f0f9fc",
    border: `1px solid ${ADDS_BLUE}33`,
    borderRadius: 10,
    margin: "0 0 20px",
    padding: "18px 12px",
    textAlign: "center" as const,
  },
  codeLabel: {
    color: "#718096",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.2em",
    margin: "0 0 6px",
    textTransform: "uppercase" as const,
  },
  code: {
    color: ADDS_NAVY,
    fontSize: 34,
    fontWeight: 700,
    letterSpacing: "0.3em",
    margin: 0,
  },
  cashbackWrap: {
    backgroundColor: "#f0fdf4",
    border: "1px solid #86efac",
    borderRadius: 10,
    margin: "0 0 20px",
    padding: "14px 16px",
  },
  cashbackText: {
    color: "#166534",
    fontSize: 15,
    fontWeight: 600,
    lineHeight: "22px",
    margin: 0,
    textAlign: "center" as const,
  },
  qrWrap: { margin: "0 0 8px", textAlign: "center" as const },
  qr: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    display: "inline-block",
    padding: 8,
  },
  qrHint: { color: "#718096", fontSize: 12, margin: "8px 0 0" },
  hr: { borderColor: "#e2e8f0", margin: "24px 0" },
  footer: { color: "#718096", fontSize: 13, lineHeight: "20px", margin: 0 },
};
