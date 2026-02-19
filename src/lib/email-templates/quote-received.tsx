import {
  Body,
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
const ORANGE = "#f07d00";
const NAVY = "#0b4269";
const BG = "#f8fafc";
const TEXT = "#1e293b";
const TEXT_SECONDARY = "#64748b";
const BORDER = "#e2e8f0";

// ============================================
// PROPS
// ============================================
export interface QuoteItem {
  productName: string;
  quantity: number;
  personalization?: string;
}

export interface QuoteReceivedEmailProps {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  items: QuoteItem[];
  estimatedValue?: number;
}

// ============================================
// TEMPLATE
// ============================================
export function QuoteReceivedEmail({
  clientName,
  clientEmail,
  clientPhone,
  items,
  estimatedValue,
}: QuoteReceivedEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>
        Recebemos seu orçamento! Em breve nossa equipe entrará em contato —
        ADDS Brasil
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

          {/* ── Banner de confirmação ── */}
          <Section style={styles.heroBanner}>
            <Text style={styles.heroEmoji}>✅</Text>
            <Heading style={styles.heroTitle}>
              Recebemos seu orçamento!
            </Heading>
            <Text style={styles.heroSubtitle}>
              Nossa equipe entrará em contato em até{" "}
              <strong>48 horas úteis</strong>.
            </Text>
          </Section>

          {/* ── Conteúdo ── */}
          <Section style={styles.content}>
            <Text style={styles.text}>
              Olá, {clientName}! Obrigado por entrar em contato com a ADDS
              Brasil.
            </Text>

            <Text style={styles.text}>
              Recebemos seu pedido de orçamento e já estamos analisando as
              informações. Abaixo está um resumo do que você solicitou:
            </Text>

            {/* Produtos */}
            <Section style={styles.section}>
              <Text style={styles.sectionTitle}>Produtos solicitados</Text>
              {items.map((item, i) => (
                <table
                  key={i}
                  cellPadding={0}
                  cellSpacing={0}
                  style={styles.itemRow}
                >
                  <tr>
                    <td>
                      <Text style={styles.itemName}>{item.productName}</Text>
                      {item.personalization && (
                        <Text style={styles.itemPersonalization}>
                          Personalização: {item.personalization}
                        </Text>
                      )}
                    </td>
                    <td style={{ textAlign: "right", verticalAlign: "top" }}>
                      <Text style={styles.itemQty}>
                        {item.quantity} unid.
                      </Text>
                    </td>
                  </tr>
                </table>
              ))}

              {estimatedValue != null && estimatedValue > 0 && (
                <table
                  cellPadding={0}
                  cellSpacing={0}
                  style={styles.totalRow}
                >
                  <tr>
                    <td>
                      <Text style={styles.totalLabel}>Valor estimado</Text>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Text style={styles.totalValue}>
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(estimatedValue)}
                      </Text>
                    </td>
                  </tr>
                </table>
              )}
            </Section>

            {/* Dados de contato */}
            <Section style={styles.section}>
              <Text style={styles.sectionTitle}>Seus dados de contato</Text>
              <table cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
                <tr>
                  <td style={{ paddingBottom: "8px" }}>
                    <Text style={styles.contactLabel}>E-mail</Text>
                    <Text style={styles.contactValue}>{clientEmail}</Text>
                  </td>
                  {clientPhone && (
                    <td style={{ paddingBottom: "8px" }}>
                      <Text style={styles.contactLabel}>Telefone</Text>
                      <Text style={styles.contactValue}>{clientPhone}</Text>
                    </td>
                  )}
                </tr>
              </table>
            </Section>

            {/* Próximos passos */}
            <Section style={styles.nextStepsBox}>
              <Text style={styles.nextStepsTitle}>O que acontece agora?</Text>
              <Text style={styles.nextStepsItem}>
                <strong>1.</strong> Nossa equipe analisará seu orçamento
              </Text>
              <Text style={styles.nextStepsItem}>
                <strong>2.</strong> Entraremos em contato em até 48 horas
                úteis
              </Text>
              <Text style={styles.nextStepsItem}>
                <strong>3.</strong> Apresentaremos a proposta final com
                valores e prazos
              </Text>
            </Section>

            <Hr style={styles.hr} />

            <Text style={styles.textSecondary}>
              Se tiver dúvidas, responda este e-mail ou entre em contato
              diretamente pelo WhatsApp.
            </Text>
          </Section>

          {/* ── Rodapé ── */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              © {new Date().getFullYear()} ADDS Brasil LTDA — Todos os
              direitos reservados
            </Text>
            <Text style={styles.footerText}>
              Escova Dental e Produtos Personalizados
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
  heroBanner: {
    backgroundColor: "#ecfdf5",
    borderBottom: `1px solid #d1fae5`,
    padding: "32px 40px",
    textAlign: "center",
  },
  heroEmoji: {
    fontSize: "40px",
    margin: "0 0 12px",
  },
  heroTitle: {
    color: "#065f46",
    fontSize: "24px",
    fontWeight: "700",
    margin: "0 0 8px",
  },
  heroSubtitle: {
    color: "#047857",
    fontSize: "15px",
    lineHeight: "1.5",
    margin: "0",
  },
  content: {
    padding: "40px 40px 32px",
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
  section: {
    backgroundColor: BG,
    border: `1px solid ${BORDER}`,
    borderRadius: "8px",
    margin: "20px 0",
    padding: "16px 20px",
  },
  sectionTitle: {
    color: NAVY,
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    margin: "0 0 12px",
    textTransform: "uppercase",
  },
  itemRow: {
    borderBottom: `1px solid ${BORDER}`,
    marginBottom: "8px",
    paddingBottom: "8px",
    width: "100%",
  },
  itemName: {
    color: TEXT,
    fontSize: "14px",
    fontWeight: "600",
    margin: "0 0 2px",
  },
  itemPersonalization: {
    color: TEXT_SECONDARY,
    fontSize: "12px",
    margin: "0",
  },
  itemQty: {
    color: BLUE,
    fontSize: "13px",
    fontWeight: "600",
    margin: "0",
  },
  totalRow: {
    marginTop: "12px",
    width: "100%",
  },
  totalLabel: {
    color: TEXT_SECONDARY,
    fontSize: "13px",
    fontWeight: "600",
    margin: "0",
  },
  totalValue: {
    color: ORANGE,
    fontSize: "18px",
    fontWeight: "700",
    margin: "0",
  },
  contactLabel: {
    color: TEXT_SECONDARY,
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.5px",
    margin: "0 0 2px",
    textTransform: "uppercase",
  },
  contactValue: {
    color: TEXT,
    fontSize: "14px",
    margin: "0",
  },
  nextStepsBox: {
    backgroundColor: "#eff6ff",
    border: `1px solid #dbeafe`,
    borderRadius: "8px",
    margin: "24px 0",
    padding: "20px",
  },
  nextStepsTitle: {
    color: NAVY,
    fontSize: "14px",
    fontWeight: "700",
    margin: "0 0 12px",
  },
  nextStepsItem: {
    color: "#1e40af",
    fontSize: "14px",
    lineHeight: "1.5",
    margin: "0 0 8px",
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

export default QuoteReceivedEmail;
