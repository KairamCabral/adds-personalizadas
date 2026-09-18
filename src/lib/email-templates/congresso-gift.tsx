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

/**
 * Confirmação do pré-cadastro no congresso.
 *
 * Sem QR e sem código de 6 dígitos: a retirada agora é pelo TELEFONE (busca
 * no balcão + código de confirmação no WhatsApp). O e-mail diz a mesma coisa
 * que a tela final do wizard. Também NÃO mostra o telefone: se o e-mail foi
 * digitado errado, a mensagem cai com um estranho.
 */
export interface CongressoGiftEmailProps {
  participantFirstName: string | null;
  editionName: string | null;
  giftName: string | null;
  /** frase de cashback (Épico 6). Null = não renderiza a seção. */
  cashbackLabel?: string | null;
  /** número da sorte (Épico 8). Null = não renderiza a seção. */
  raffleNumber?: number | null;
  /** URL HTTPS da logo (data-URI não renderiza no Gmail). Null = oculta. */
  logoUrl: string | null;
}

const ADDS_NAVY = "#0b4269";

export function CongressoGiftEmail({
  participantFirstName,
  editionName,
  giftName,
  cashbackLabel,
  raffleNumber,
  logoUrl,
}: CongressoGiftEmailProps) {
  const greeting = participantFirstName
    ? `Prontinho, ${participantFirstName}!`
    : "Inscrição confirmada!";
  const giftLabel = giftName ?? "seu brinde";
  const preview = editionName
    ? `Seu brinde no ${editionName} está reservado — retire no estande da ADDS`
    : "Seu brinde está reservado — retire no estande da ADDS";

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
            Vá ao estande da ADDS e informe o telefone que você usou na
            inscrição para retirar <strong>{giftLabel}</strong>. Vamos enviar
            um código de confirmação no seu WhatsApp.
          </Text>

          {cashbackLabel ? (
            <Section style={styles.cashbackWrap}>
              <Text style={styles.cashbackText}>🛍️ {cashbackLabel}</Text>
            </Section>
          ) : null}

          {raffleNumber != null ? (
            <Section style={styles.raffleWrap}>
              <Text style={styles.raffleLabel}>🎟️ Seu número da sorte</Text>
              <Text style={styles.raffleNum}>
                {String(raffleNumber).padStart(4, "0")}
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
  raffleWrap: {
    backgroundColor: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 10,
    margin: "0 0 20px",
    padding: "14px 12px",
    textAlign: "center" as const,
  },
  raffleLabel: {
    color: "#9a3412",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.15em",
    margin: "0 0 6px",
    textTransform: "uppercase" as const,
  },
  raffleNum: {
    color: "#c2410c",
    fontSize: 30,
    fontWeight: 700,
    letterSpacing: "0.3em",
    margin: 0,
  },
  hr: { borderColor: "#e2e8f0", margin: "24px 0" },
  footer: { color: "#718096", fontSize: 13, lineHeight: "20px", margin: 0 },
};
