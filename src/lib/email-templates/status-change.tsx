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

// Status → cor de badge
const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  FAZER: { bg: "#f1f5f9", text: "#475569", label: "Fazer" },
  AJUSTE: { bg: "#fffbeb", text: "#92400e", label: "Ajuste" },
  APROVACAO: { bg: "#e0f2fe", text: "#075985", label: "Aprovação" },
  CONFIRMACAO: { bg: "#d1fae5", text: "#065f46", label: "Confirmação" },
  APROVADO: { bg: "#dcfce7", text: "#166534", label: "Aprovado" },
  PRODUCAO: { bg: "#fff7ed", text: "#9a3412", label: "Produção" },
  EXPEDICAO: { bg: "#fef3c7", text: "#92400e", label: "Expedição" },
  FINALIZADO: { bg: "#ecfdf5", text: "#065f46", label: "Finalizado" },
  ENTREGUE: { bg: "#ccfbf1", text: "#0f766e", label: "Entregue" },
  FATURADO: { bg: "#dbeafe", text: "#1e40af", label: "Faturado" },
  ARQUIVADO: { bg: "#f1f5f9", text: "#64748b", label: "Arquivado" },
};

function getStatusStyle(status: string) {
  return (
    STATUS_COLORS[status] ?? { bg: "#f1f5f9", text: "#475569", label: status }
  );
}

// ============================================
// PROPS
// ============================================
export interface StatusChangeEmailProps {
  clientName: string;
  orderNumber: number;
  orderTitle: string;
  oldStatus: string;
  newStatus: string;
  appUrl?: string;
}

// ============================================
// TEMPLATE
// ============================================
export function StatusChangeEmail({
  clientName,
  orderNumber,
  orderTitle,
  oldStatus,
  newStatus,
  appUrl = "https://crm.addsbrasil.com.br",
}: StatusChangeEmailProps) {
  const oldStyle = getStatusStyle(oldStatus);
  const newStyle = getStatusStyle(newStatus);
  const pipelineLink = `${appUrl}/pipeline`;

  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>
        {`Pedido #${orderNumber} mudou de status: ${newStyle.label} — ADDS Brasil`}
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
            <Heading style={styles.heading}>
              Status do pedido atualizado
            </Heading>

            <Text style={styles.text}>Olá, {clientName}!</Text>

            <Text style={styles.text}>
              Seu pedido <strong>#{orderNumber}</strong> foi atualizado para
              um novo status.
            </Text>

            {/* Box do pedido */}
            <Section style={styles.orderBox}>
              <Text style={styles.orderLabel}>Pedido</Text>
              <Text style={styles.orderTitle}>{orderTitle}</Text>
              <Text style={styles.orderNumber}>#{orderNumber}</Text>
            </Section>

            {/* Mudança de status */}
            <Section style={styles.statusRow}>
              {/* Status anterior */}
              <table
                cellPadding={0}
                cellSpacing={0}
                style={{ width: "100%" }}
              >
                <tr>
                  <td style={{ width: "45%", textAlign: "center" }}>
                    <Text style={styles.statusLabel}>Antes</Text>
                    <span
                      style={{
                        ...styles.statusBadge,
                        backgroundColor: oldStyle.bg,
                        color: oldStyle.text,
                      }}
                    >
                      {oldStyle.label}
                    </span>
                  </td>
                  <td
                    style={{
                      width: "10%",
                      textAlign: "center",
                      color: TEXT_SECONDARY,
                      fontSize: "20px",
                      verticalAlign: "bottom",
                      paddingBottom: "4px",
                    }}
                  >
                    →
                  </td>
                  <td style={{ width: "45%", textAlign: "center" }}>
                    <Text style={styles.statusLabel}>Agora</Text>
                    <span
                      style={{
                        ...styles.statusBadge,
                        backgroundColor: newStyle.bg,
                        color: newStyle.text,
                        fontWeight: "700",
                      }}
                    >
                      {newStyle.label}
                    </span>
                  </td>
                </tr>
              </table>
            </Section>

            {/* CTA */}
            <Section style={{ textAlign: "center", margin: "32px 0 0" }}>
              <Button style={styles.button} href={pipelineLink}>
                Ver Pedido
              </Button>
            </Section>

            <Hr style={styles.hr} />

            <Text style={styles.textSecondary}>
              Para dúvidas, entre em contato com a equipe ADDS Brasil pelo
              WhatsApp ou e-mail.
            </Text>
          </Section>

          {/* ── Rodapé ── */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              © {new Date().getFullYear()} ADDS Brasil LTDA — Todos os
              direitos reservados
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
    margin: "0 0 24px",
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
  statusRow: {
    backgroundColor: BG,
    border: `1px solid ${BORDER}`,
    borderRadius: "8px",
    padding: "20px",
  },
  statusLabel: {
    color: TEXT_SECONDARY,
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.8px",
    margin: "0 0 8px",
    textAlign: "center",
    textTransform: "uppercase",
  },
  statusBadge: {
    borderRadius: "6px",
    display: "inline-block",
    fontSize: "13px",
    fontWeight: "600",
    padding: "5px 12px",
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

export default StatusChangeEmail;
