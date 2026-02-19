/**
 * Serviço de e-mail — server-side only.
 *
 * Renderiza templates React Email e envia via Resend.
 * Deve ser chamado apenas de Server Actions, API Routes ou Edge Functions.
 */

import { render } from "@react-email/components";
import { Resend } from "resend";
import * as React from "react";

import { ApprovalRequestEmail } from "@/lib/email-templates/approval-request";
import { StatusChangeEmail } from "@/lib/email-templates/status-change";
import { QuoteReceivedEmail } from "@/lib/email-templates/quote-received";
import { QuoteInternalEmail } from "@/lib/email-templates/quote-internal";
import type { QuoteItem } from "@/lib/email-templates/quote-received";
import type { QuoteInternalItem } from "@/lib/email-templates/quote-internal";

// Re-exporta os tipos para uso externo
export type { QuoteItem, QuoteInternalItem };

// ============================================
// HELPERS
// ============================================

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY não configurada.");
  return new Resend(key);
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "ADDS Brasil <noreply@addsbrasil.com.br>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://crm.addsbrasil.com.br";

async function send(
  to: string,
  subject: string,
  element: React.ReactElement
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = await render(element);
    const resend = getResend();

    const { error } = await resend.emails.send({
      from: FROM,
      to: [to],
      subject,
      html,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro desconhecido ao enviar e-mail";
    console.error("[email.service]", message);
    return { success: false, error: message };
  }
}

// ============================================
// 1. APROVAÇÃO DE ARTE
// ============================================

export interface SendApprovalEmailParams {
  to: string;
  clientName: string;
  orderTitle: string;
  orderNumber: number;
  approvalToken: string;
  tokenExpirationDays?: number;
}

export async function sendApprovalEmail(
  params: SendApprovalEmailParams
): Promise<{ success: boolean; error?: string }> {
  const approvalLink = `${APP_URL}/art/approve/${params.approvalToken}`;

  return send(
    params.to,
    `Arte pronta para aprovação — Pedido #${params.orderNumber}`,
    React.createElement(ApprovalRequestEmail, {
      clientName: params.clientName,
      orderTitle: params.orderTitle,
      orderNumber: params.orderNumber,
      approvalLink,
      tokenExpirationDays: params.tokenExpirationDays ?? 7,
    })
  );
}

// ============================================
// 2. MUDANÇA DE STATUS
// ============================================

export interface SendStatusChangeEmailParams {
  to: string;
  clientName: string;
  orderNumber: number;
  orderTitle: string;
  oldStatus: string;
  newStatus: string;
}

export async function sendStatusChangeEmail(
  params: SendStatusChangeEmailParams
): Promise<{ success: boolean; error?: string }> {
  return send(
    params.to,
    `Pedido #${params.orderNumber} — status atualizado`,
    React.createElement(StatusChangeEmail, {
      clientName: params.clientName,
      orderNumber: params.orderNumber,
      orderTitle: params.orderTitle,
      oldStatus: params.oldStatus,
      newStatus: params.newStatus,
      appUrl: APP_URL,
    })
  );
}

// ============================================
// 3. CONFIRMAÇÃO DE ORÇAMENTO (para o cliente)
// ============================================

export interface SendQuoteReceivedEmailParams {
  to: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  items: QuoteItem[];
  estimatedValue?: number;
}

export async function sendQuoteReceivedEmail(
  params: SendQuoteReceivedEmailParams
): Promise<{ success: boolean; error?: string }> {
  return send(
    params.to,
    "Recebemos seu orçamento! — ADDS Brasil",
    React.createElement(QuoteReceivedEmail, {
      clientName: params.clientName,
      clientEmail: params.clientEmail,
      clientPhone: params.clientPhone,
      items: params.items,
      estimatedValue: params.estimatedValue,
    })
  );
}

// ============================================
// 4. NOTIFICAÇÃO INTERNA de novo orçamento
// ============================================

export interface SendQuoteInternalEmailParams {
  to: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientWhatsapp?: string;
  clientState?: string;
  items: QuoteInternalItem[];
  estimatedValue?: number;
  internalNotes?: string;
}

export async function sendQuoteInternalEmail(
  params: SendQuoteInternalEmailParams
): Promise<{ success: boolean; error?: string }> {
  return send(
    params.to,
    `🆕 Novo orçamento público de ${params.clientName}`,
    React.createElement(QuoteInternalEmail, {
      clientName: params.clientName,
      clientEmail: params.clientEmail,
      clientPhone: params.clientPhone,
      clientWhatsapp: params.clientWhatsapp,
      clientState: params.clientState,
      items: params.items,
      estimatedValue: params.estimatedValue,
      internalNotes: params.internalNotes,
      quotesLink: `${APP_URL}/quotes`,
    })
  );
}
