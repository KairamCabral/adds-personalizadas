import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

// ============================================
// CONSTANTES DE ESTILO
// ============================================
const BLUE = "#21add6";
const NAVY = "#0b4269";
const BG = "#f8fafc";
const TEXT = "#1e293b";
const TEXT_SECONDARY = "#64748b";
const BORDER = "#e2e8f0";

// ============================================
// PROPS
// ============================================
export interface ApprovalRequestEmailProps {
  clientName: string;
  orderTitle: string;
  orderNumber: number;
  approvalLink: string;
  tokenExpirationDays?: number;
}

// ============================================
// TEMPLATE
// ============================================
export function ApprovalRequestEmail({
  clientName,
  orderTitle,
  orderNumber,
  approvalLink,
  tokenExpirationDays = 7,
}: ApprovalRequestEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>
        {`Arte do pedido #${orderNumber} aguardando sua aprovação — ADDS Brasil`}
      </Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* ── Logo ── */}
          <Section style={styles.logoSection}>
            <table cellPadding={0} cellSpacing={0} style={{ margin: "0 auto" }}>
              <tr>
                <td
                  style={{
                    background: `linear-gradient(135deg, ${BLUE} 0%, ${NAVY} 100%)`,
                    borderRadius: "10px",
                    padding: "10px 18px",
                  }}
                >
                  <Text style={styles.logoText}>ADDS Brasil</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* ── Conteúdo ── */}
          <Section style={styles.content}>
            <Heading style={styles.heading}>Arte pronta para aprovação</Heading>

            <Text style={styles.text}>Olá, {clientName}!</Text>

            <Text style={styles.text}>
              A arte do seu pedido está pronta e aguardando a sua aprovação.
              Por favor, revise com atenção antes de confirmar.
            </Text>

            {/* Box do pedido */}
            <Section style={styles.orderBox}>
              <Text style={styles.orderLabel}>Pedido</Text>
              <Text style={styles.orderTitle}>{orderTitle}</Text>
              <Text style={styles.orderNumber}>#{orderNumber}</Text>
            </Section>

            {/* CTA */}
            <Section style={{ textAlign: "center", margin: "32px 0" }}>
              <Button style={styles.button} href={approvalLink}>
                Ver e Aprovar Arte
              </Button>
            </Section>

            <Text style={styles.expiration}>
              Este link expira em {tokenExpirationDays}{" "}
              {tokenExpirationDays === 1 ? "dia" : "dias"}.
            </Text>

            <Hr style={styles.hr} />

            <Text style={styles.textSecondary}>
              Se você não está esperando esta mensagem, pode ignorá-la com
              segurança. Em caso de dúvidas, entre em contato conosco pelo
              WhatsApp ou e-mail.
            </Text>
          </Section>

          {/* ── Rodapé ── */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              © {new Date().getFullYear()} ADDS Brasil LTDA — Todos os direitos
              reservados
            </Text>
            <Text style={styles.footerText}>
              Este e-mail foi enviado automaticamente pelo sistema ADDS CRM.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ============================================
// ESTILOS
// ============================================
const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: BG,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    margin: 0,
    padding: "24px 0",
  },
  container: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    border: `1px solid ${BORDER}`,
    maxWidth: "560px",
    margin: "0 auto",
    overflow: "hidden",
  },
  logoSection: {
    backgroundColor: BG,
    borderBottom: `1px solid ${BORDER}`,
    padding: "24px",
    textAlign: "center",
  },
  logoText: {
    color: "#ffffff",
    fontSize: "18px",
    fontWeight: "700",
    letterSpacing: "0.5px",
    margin: "0",
  },
  content: {
    padding: "40px 40px 32px",
  },
  heading: {
    color: NAVY,
    fontSize: "22px",
    fontWeight: "700",
    lineHeight: "1.3",
    margin: "0 0 24px",
  },
  text: {
    color: TEXT,
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 16px",
  },
  textSecondary: {
    color: TEXT_SECONDARY,
    fontSize: "13px",
    lineHeight: "1.6",
    margin: "16px 0 0",
  },
  orderBox: {
    backgroundColor: BG,
    border: `1px solid ${BORDER}`,
    borderLeft: `4px solid ${BLUE}`,
    borderRadius: "8px",
    margin: "24px 0",
    padding: "16px 20px",
  },
  orderLabel: {
    color: TEXT_SECONDARY,
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.8px",
    margin: "0 0 4px",
    textTransform: "uppercase",
  },
  orderTitle: {
    color: TEXT,
    fontSize: "16px",
    fontWeight: "600",
    margin: "0 0 4px",
  },
  orderNumber: {
    color: BLUE,
    fontSize: "13px",
    fontWeight: "500",
    margin: "0",
  },
  button: {
    backgroundColor: BLUE,
    borderRadius: "8px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: "600",
    padding: "14px 32px",
    textDecoration: "none",
  },
  expiration: {
    color: TEXT_SECONDARY,
    fontSize: "13px",
    margin: "0",
    textAlign: "center",
  },
  hr: {
    border: "none",
    borderTop: `1px solid ${BORDER}`,
    margin: "28px 0 0",
  },
  footer: {
    backgroundColor: BG,
    borderTop: `1px solid ${BORDER}`,
    padding: "20px 40px",
    textAlign: "center",
  },
  footerText: {
    color: TEXT_SECONDARY,
    fontSize: "12px",
    lineHeight: "1.5",
    margin: "0 0 4px",
  },
};

export default ApprovalRequestEmail;
