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
const ORANGE = "#f07d00";
const NAVY = "#0b4269";
const BG = "#f8fafc";
const TEXT = "#1e293b";
const TEXT_SECONDARY = "#64748b";
const BORDER = "#e2e8f0";

// ============================================
// PROPS
// ============================================
export interface QuoteInternalItem {
  productName: string;
  quantity: number;
  personalization?: string;
}

export interface QuoteInternalEmailProps {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientWhatsapp?: string;
  clientState?: string;
  items: QuoteInternalItem[];
  estimatedValue?: number;
  internalNotes?: string;
  quotesLink?: string;
}

// ============================================
// TEMPLATE
// ============================================
export function QuoteInternalEmail({
  clientName,
  clientEmail,
  clientPhone,
  clientWhatsapp,
  clientState,
  items,
  estimatedValue,
  internalNotes,
  quotesLink = "https://crm.addsbrasil.com.br/quotes",
}: QuoteInternalEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>
        🆕 Novo orçamento de {clientName} — ação necessária
      </Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* ── Topo de alerta ── */}
          <Section style={styles.alertBanner}>
            <Text style={styles.alertText}>
              🆕 Novo orçamento público recebido
            </Text>
          </Section>

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
                  <Text style={styles.logoText}>ADDS Brasil · CRM</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* ── Conteúdo ── */}
          <Section style={styles.content}>
            <Heading style={styles.heading}>
              Orçamento público recebido
            </Heading>

            <Text style={styles.text}>
              Um novo orçamento foi preenchido no formulário público. Revise
              as informações abaixo e entre em contato com o cliente.
            </Text>

            {/* Dados do cliente */}
            <Section style={styles.section}>
              <Text style={styles.sectionTitle}>Dados do cliente</Text>

              <table cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
                <tr>
                  <td style={{ paddingBottom: "12px", paddingRight: "16px" }}>
                    <Text style={styles.fieldLabel}>Nome</Text>
                    <Text style={styles.fieldValue}>{clientName}</Text>
                  </td>
                  {clientState && (
                    <td style={{ paddingBottom: "12px" }}>
                      <Text style={styles.fieldLabel}>Estado</Text>
                      <Text style={styles.fieldValue}>{clientState}</Text>
                    </td>
                  )}
                </tr>
                <tr>
                  <td style={{ paddingBottom: "12px", paddingRight: "16px" }}>
                    <Text style={styles.fieldLabel}>E-mail</Text>
                    <Text style={styles.fieldValueLink}>{clientEmail}</Text>
                  </td>
                  {clientPhone && (
                    <td style={{ paddingBottom: "12px" }}>
                      <Text style={styles.fieldLabel}>Telefone</Text>
                      <Text style={styles.fieldValue}>{clientPhone}</Text>
                    </td>
                  )}
                </tr>
                {clientWhatsapp && (
                  <tr>
                    <td colSpan={2}>
                      <Text style={styles.fieldLabel}>WhatsApp</Text>
                      <Text style={styles.fieldValueLink}>
                        {clientWhatsapp}
                      </Text>
                    </td>
                  </tr>
                )}
              </table>
            </Section>

            {/* Produtos */}
            <Section style={styles.section}>
              <Text style={styles.sectionTitle}>Produtos solicitados</Text>

              {items.map((item, i) => (
                <table
                  key={i}
                  cellPadding={0}
                  cellSpacing={0}
                  style={{
                    ...styles.itemRow,
                    borderBottom:
                      i < items.length - 1 ? `1px solid ${BORDER}` : "none",
                  }}
                >
                  <tr>
                    <td style={{ paddingRight: "12px" }}>
                      <Text style={styles.itemName}>{item.productName}</Text>
                      {item.personalization && (
                        <Text style={styles.itemPersonalization}>
                          {item.personalization}
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
                  style={{
                    ...styles.totalRow,
                    borderTop: `2px solid ${BORDER}`,
                    marginTop: "12px",
                    paddingTop: "12px",
                  }}
                >
                  <tr>
                    <td>
                      <Text style={styles.totalLabel}>
                        Valor estimado pelo cliente
                      </Text>
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

            {/* Notas internas (se houver) */}
            {internalNotes && (
              <Section style={styles.notesBox}>
                <Text style={styles.sectionTitle}>Notas / observações</Text>
                <Text style={styles.notesText}>{internalNotes}</Text>
              </Section>
            )}

            {/* CTA */}
            <Section style={{ textAlign: "center", margin: "32px 0 0" }}>
              <Button style={styles.button} href={quotesLink}>
                Ver Orçamento no CRM
              </Button>
            </Section>

            <Hr style={styles.hr} />

            <Text style={styles.textSecondary}>
              Este e-mail é uma notificação interna do sistema ADDS CRM.
              Responda ao cliente diretamente pelo contato acima.
            </Text>
          </Section>

          {/* ── Rodapé ── */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              © {new Date().getFullYear()} ADDS Brasil LTDA — Uso interno
            </Text>
            <Text style={styles.footerText}>
              Enviado automaticamente pelo sistema ADDS CRM.
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
  alertBanner: {
    backgroundColor: ORANGE,
    padding: "12px 24px",
    textAlign: "center",
  },
  alertText: {
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "700",
    letterSpacing: "0.3px",
    margin: "0",
  },
  logoSection: {
    backgroundColor: BG,
    borderBottom: `1px solid ${BORDER}`,
    padding: "20px",
    textAlign: "center",
  },
  logoText: {
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "700",
    letterSpacing: "0.5px",
    margin: "0",
  },
  content: {
    padding: "36px 40px 32px",
  },
  heading: {
    color: NAVY,
    fontSize: "22px",
    fontWeight: "700",
    lineHeight: "1.3",
    margin: "0 0 20px",
  },
  text: {
    color: TEXT,
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 20px",
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
    margin: "0 0 16px",
    padding: "16px 20px",
  },
  sectionTitle: {
    color: NAVY,
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    margin: "0 0 12px",
    textTransform: "uppercase",
  },
  fieldLabel: {
    color: TEXT_SECONDARY,
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.5px",
    margin: "0 0 2px",
    textTransform: "uppercase",
  },
  fieldValue: {
    color: TEXT,
    fontSize: "14px",
    fontWeight: "500",
    margin: "0",
  },
  fieldValueLink: {
    color: BLUE,
    fontSize: "14px",
    fontWeight: "500",
    margin: "0",
  },
  itemRow: {
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
    fontSize: "14px",
    fontWeight: "700",
    margin: "0",
  },
  totalRow: {
    width: "100%",
  },
  totalLabel: {
    color: TEXT_SECONDARY,
    fontSize: "13px",
    margin: "0",
  },
  totalValue: {
    color: ORANGE,
    fontSize: "20px",
    fontWeight: "700",
    margin: "0",
  },
  notesBox: {
    backgroundColor: "#fffbeb",
    border: `1px solid #fde68a`,
    borderRadius: "8px",
    margin: "0 0 0",
    padding: "16px 20px",
  },
  notesText: {
    color: "#92400e",
    fontSize: "14px",
    lineHeight: "1.6",
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

export default QuoteInternalEmail;
