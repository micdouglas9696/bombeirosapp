import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_WHATSAPP_PHONE = "5521992114159";
const DEFAULT_EMAIL_RECIPIENT = "supervisoremergencia@riogaleao.com";
const DEFAULT_ZERNIO_KEY = "sk_7bc03b5daab2ccecafd2bd5123e7c1951b798aca89b6c7004bfaf21dc5c20d90";

interface OccurrenceItem {
  item_number?: number;
  item_title?: string;
  itemId?: string | number;
  title?: string;
  location?: string | null;
  observation?: string | null;
  action_taken?: string | null;
  supervisor_notified?: string | null;
}

interface NotifyPayload {
  protocol?: string;
  firefighterName?: string;
  shift?: string;
  nonConformities?: number;
  items?: OccurrenceItem[];
  recipientEmails?: string[];
  recipientPhones?: string[];
  isTest?: boolean;
}

// Helper to format WhatsApp Alert text
function buildWhatsAppMessage({
  protocol,
  firefighterName,
  shift,
  nonConformities,
  items,
  createdAt,
  isTest
}: {
  protocol: string;
  firefighterName: string;
  shift: string;
  nonConformities: number;
  items: OccurrenceItem[];
  createdAt: string;
  isTest?: boolean;
}) {
  if (isTest) {
    return [
      "🔔 *[TESTE] NOTIFICAÇÃO OPERACIONAL — ENSEG / RIOgaleão*",
      "",
      "Este é um teste de envio de alerta operacional via Zernio WhatsApp.",
      "",
      `📅 *Data/Hora:* ${createdAt}`,
      "✅ *Status:* Canal de comunicação integrado com sucesso!",
      "",
      "_ENSEG Segurança e Prevenção Contra Incêndio · SBGL Aeroporto Internacional Tom Jobim_"
    ].join("\n");
  }

  const itemsDetail = items.length
    ? items
        .map((it) => {
          const num = it.item_number || it.itemId || "-";
          const title = it.item_title || it.title || "Item Não Conforme";
          const loc = it.location ? `\n   📍 *Local:* ${it.location}` : "";
          const obs = it.observation ? `\n   🔍 *Não Conformidade:* ${it.observation}` : "";
          const act = it.action_taken ? `\n   🛠️ *Ação Imediata:* ${it.action_taken}` : "";
          const sup = it.supervisor_notified ? `\n   📞 *Supervisor:* ${it.supervisor_notified}` : "";
          return `• *Item #${num} — ${title}*${loc}${obs}${act}${sup}`;
        })
        .join("\n\n")
    : "Não há detalhamento disponível.";

  return [
    "🚨 *ALERTA OPERACIONAL DE OCORRÊNCIA — ENSEG / RIOgaleão* 🚨",
    "",
    `📋 *Ronda / Protocolo:* ${protocol}`,
    `👨‍🚒 *Bombeiro Responsável:* ${firefighterName} (${shift || "Turno Regular"})`,
    `⚠️ *Não Conformidades:* ${nonConformities} item(ns) registrado(s)`,
    `📅 *Data/Hora:* ${createdAt}`,
    "",
    "📌 *DETALHAMENTO DAS OCORRÊNCIAS:*",
    itemsDetail,
    "",
    "Acesse o painel para auditar e confirmar ciência:",
    "🔗 https://bombeirosapp.vercel.app",
    "",
    "_ENSEG Sistema de Inspeção Operacional · Aeroporto Internacional Tom Jobim (Galeão - SBGL)_"
  ].join("\n");
}

// Send via Zernio WhatsApp API
async function sendViaZernio({
  apiKey,
  phone,
  message
}: {
  apiKey: string;
  phone: string;
  message: string;
}) {
  const cleanPhone = phone.replace(/\D/g, "");
  if (!cleanPhone) {
    return { success: false, error: "Número de telefone inválido para WhatsApp." };
  }

  // 1. Fetch connected accounts
  try {
    const accRes = await fetch("https://zernio.com/api/v1/accounts", {
      headers: { Authorization: `Bearer ${apiKey}` }
    });

    if (!accRes.ok) {
      const errText = await accRes.text();
      return { success: false, error: `Autenticação na Zernio falhou (${accRes.status}): ${errText}` };
    }

    const accData = await accRes.json();
    const accounts: Array<{ _id?: string; id?: string; platform?: string; name?: string }> = accData.accounts || [];

    if (accounts.length === 0) {
      return {
        success: false,
        error: "Nenhuma conta de WhatsApp conectada no painel da Zernio ainda. Conecte seu WhatsApp Business em: https://zernio.com/dashboard/connections"
      };
    }

    const waAccount = accounts.find((a) => a.platform === "whatsapp") || accounts[0];
    const accountId = waAccount._id || waAccount.id;

    // 2. Open conversation & send message
    const sendRes = await fetch("https://zernio.com/api/v1/inbox/conversations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accountId,
        participantId: cleanPhone,
        message
      })
    });

    if (!sendRes.ok) {
      const errJson = await sendRes.json().catch(() => null);
      return {
        success: false,
        error: errJson?.error || `Erro HTTP ${sendRes.status} da Zernio ao enviar WhatsApp`
      };
    }

    const result = await sendRes.json();
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido ao chamar API da Zernio."
    };
  }
}

// Send via Resend Email API
async function sendViaResend({
  apiKey,
  from,
  to,
  protocol,
  firefighterName,
  shift,
  nonConformities,
  items,
  createdAt,
  isTest
}: {
  apiKey: string;
  from: string;
  to: string[];
  protocol: string;
  firefighterName: string;
  shift: string;
  nonConformities: number;
  items: OccurrenceItem[];
  createdAt: string;
  isTest?: boolean;
}) {
  if (!apiKey) {
    return {
      success: false,
      error: "RESEND_API_KEY não informada. Solicite ou configure a chave de API do Resend."
    };
  }

  const validEmails = to.filter((e) => typeof e === "string" && e.includes("@"));
  if (validEmails.length === 0) {
    return { success: false, error: "Nenhum endereço de e-mail válido fornecido." };
  }

  const subject = isTest
    ? `[TESTE - ENSEG / RIOgaleão] Teste de Notificação de Alerta`
    : `🚨 [ENSEG / RIOgaleão] ${nonConformities} Não Conformidade(s) — Ronda ${protocol}`;

  const itemsHtml = items.length
    ? items
        .map((it) => {
          const num = it.item_number || it.itemId || "-";
          const title = it.item_title || it.title || "Item Não Conforme";
          return `
            <div style="background: #ffffff; border: 1px solid #e2e2dc; border-left: 4px solid #d9383a; border-radius: 4px; padding: 12px; margin-bottom: 10px; font-size: 13px;">
              <div style="font-weight: 700; color: #111; font-size: 13px; margin-bottom: 6px;">
                Item #${num} · ${title}
              </div>
              <div style="color: #555; margin-bottom: 4px;"><strong>Local:</strong> ${it.location || "Não especificado"}</div>
              <div style="color: #555; margin-bottom: 4px;"><strong>Não Conformidade:</strong> ${it.observation || "Sem observações adicionais"}</div>
              <div style="color: #555; margin-bottom: 4px;"><strong>Providência Adotada:</strong> ${it.action_taken || "Aguardando providência"}</div>
              ${it.supervisor_notified ? `<div style="color: #555;"><strong>Supervisor Notificado:</strong> ${it.supervisor_notified}</div>` : ""}
            </div>
          `;
        })
        .join("")
    : "<p style='color: #666;'>Nenhum detalhe adicional de item.</p>";

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f5; margin: 0; padding: 24px; color: #1c1d1a;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e2dc; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <!-- Top Header -->
        <div style="background: #111214; padding: 22px 24px; border-bottom: 3px solid #d9383a;">
          <div style="margin-bottom: 8px;">
            <span style="color: #ffffff; font-size: 15px; font-weight: 700; letter-spacing: 1px;">ENSEG · RIOgaleão</span>
          </div>
          <h1 style="color: #ffffff; font-size: 18px; margin: 0; font-weight: 600;">
            ${isTest ? "Disparo de Teste de Notificações" : "Alerta Operacional de Não Conformidade"}
          </h1>
        </div>

        <!-- Body -->
        <div style="padding: 24px;">
          <p style="font-size: 14px; line-height: 1.5; color: #444; margin-top: 0;">
            ${
              isTest
                ? "Este é um disparo de teste para verificar a entrega de alertas no endereço cadastrado do Supervisor de Emergência."
                : "Foi registrada uma nova vistoria operacional com apontamentos de não conformidade no Aeroporto Internacional Tom Jobim (Galeão - SBGL)."
            }
          </p>

          <table style="width: 100%; border-collapse: collapse; margin: 18px 0; background: #fafaf8; border-radius: 6px; border: 1px solid #ededeb; font-size: 13px;">
            <tr>
              <td style="padding: 10px 14px; border-bottom: 1px solid #ededeb; color: #666; width: 150px;">Protocolo:</td>
              <td style="padding: 10px 14px; border-bottom: 1px solid #ededeb; font-weight: 700; color: #111;">${protocol}</td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; border-bottom: 1px solid #ededeb; color: #666;">Bombeiro Responsável:</td>
              <td style="padding: 10px 14px; border-bottom: 1px solid #ededeb; font-weight: 600;">${firefighterName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; border-bottom: 1px solid #ededeb; color: #666;">Turno / Posto:</td>
              <td style="padding: 10px 14px; border-bottom: 1px solid #ededeb;">${shift || "Turno Regular"}</td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; border-bottom: 1px solid #ededeb; color: #666;">Data e Hora:</td>
              <td style="padding: 10px 14px; border-bottom: 1px solid #ededeb;">${createdAt}</td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; color: #666;">Não Conformidades:</td>
              <td style="padding: 10px 14px; font-weight: 700; color: #d9383a;">${nonConformities} item(ns)</td>
            </tr>
          </table>

          <h3 style="font-size: 14px; text-transform: uppercase; color: #111; letter-spacing: 0.5px; margin: 24px 0 12px; border-bottom: 1px solid #ededeb; padding-bottom: 6px;">
            Detalhamento dos Itens Apontados
          </h3>
          ${itemsHtml}

          <div style="margin-top: 28px; text-align: center;">
            <a href="https://bombeirosapp.vercel.app" style="display: inline-block; background: #111214; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 13px;">
              Acessar Painel Administrativo ENSEG
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #fafaf8; border-top: 1px solid #ededeb; padding: 16px 24px; text-align: center; font-size: 11px; color: #888;">
          ENSEG Vigilância e Segurança Operacional · SBGL Aeroporto Internacional Tom Jobim<br/>
          Mensagem automática de segurança e emergência.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: validEmails,
        subject,
        html
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      let errorMsg = `Falha ao enviar via Resend (${res.status}): ${errText}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.message) errorMsg = parsed.message;
      } catch {}
      return { success: false, error: errorMsg };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido ao chamar API do Resend."
    };
  }
}

// GET: Return current notification configuration status
export async function GET() {
  const zernioKey = process.env.ZERNIO_API_KEY || DEFAULT_ZERNIO_KEY;
  const resendKey = process.env.RESEND_API_KEY || "";
  const whatsappPhone = process.env.NOTIFICATION_WHATSAPP_RECIPIENT || DEFAULT_WHATSAPP_PHONE;
  const emailRecipient = process.env.NOTIFICATION_EMAIL_RECIPIENT || DEFAULT_EMAIL_RECIPIENT;

  let whatsappStatus = "não_configurado";
  let whatsappAccountInfo = null;

  if (zernioKey) {
    try {
      const accRes = await fetch("https://zernio.com/api/v1/accounts", {
        headers: { Authorization: `Bearer ${zernioKey}` }
      });
      if (accRes.ok) {
        const accData = await accRes.json();
        const accounts = accData.accounts || [];
        if (accounts.length > 0) {
          whatsappStatus = "conectado";
          whatsappAccountInfo = accounts[0];
        } else {
          whatsappStatus = "aguardando_conexao";
        }
      } else {
        whatsappStatus = "chave_invalida";
      }
    } catch {
      whatsappStatus = "erro_conexao";
    }
  }

  return NextResponse.json({
    whatsapp: {
      status: whatsappStatus,
      configuredKey: Boolean(zernioKey),
      keyPreview: zernioKey ? `${zernioKey.slice(0, 6)}...${zernioKey.slice(-6)}` : null,
      recipientPhone: whatsappPhone,
      account: whatsappAccountInfo
    },
    email: {
      status: resendKey ? "configurado" : "aguardando_chave",
      configuredKey: Boolean(resendKey),
      keyPreview: resendKey ? `${resendKey.slice(0, 5)}...${resendKey.slice(-4)}` : null,
      recipientEmail: emailRecipient,
      from: process.env.RESEND_FROM_EMAIL || "ENSEG Alertas <onboarding@resend.dev>"
    }
  });
}

// POST: Trigger notifications
export async function POST(request: Request) {
  try {
    const body: NotifyPayload = await request.json().catch(() => ({}));

    const protocol = body.protocol || `TEST-${Date.now().toString().slice(-4)}`;
    const firefighterName = body.firefighterName || "Supervisor do Posto";
    const shift = body.shift || "Turno Operacional";
    const nonConformities = body.nonConformities ?? 1;
    const items = body.items || [];
    const isTest = Boolean(body.isTest);
    const createdAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    // Recipient lists (defaulting to requested recipients)
    const recipientEmails = (body.recipientEmails && body.recipientEmails.length > 0)
      ? body.recipientEmails
      : [process.env.NOTIFICATION_EMAIL_RECIPIENT || DEFAULT_EMAIL_RECIPIENT];

    const recipientPhones = (body.recipientPhones && body.recipientPhones.length > 0)
      ? body.recipientPhones
      : [process.env.NOTIFICATION_WHATSAPP_RECIPIENT || DEFAULT_WHATSAPP_PHONE];

    // API Keys
    const zernioApiKey = process.env.ZERNIO_API_KEY || DEFAULT_ZERNIO_KEY;
    const resendApiKey = process.env.RESEND_API_KEY || "";
    const resendFrom = process.env.RESEND_FROM_EMAIL || "ENSEG Alertas <onboarding@resend.dev>";

    // Build message
    const whatsappMessage = buildWhatsAppMessage({
      protocol,
      firefighterName,
      shift,
      nonConformities,
      items,
      createdAt,
      isTest
    });

    // 1. Dispatch WhatsApp (Zernio)
    const whatsappResults = await Promise.all(
      recipientPhones.map((phone) =>
        sendViaZernio({
          apiKey: zernioApiKey,
          phone,
          message: whatsappMessage
        })
      )
    );

    // 2. Dispatch Email (Resend)
    const emailResult = await sendViaResend({
      apiKey: resendApiKey,
      from: resendFrom,
      to: recipientEmails,
      protocol,
      firefighterName,
      shift,
      nonConformities,
      items,
      createdAt,
      isTest
    });

    const whatsappSuccess = whatsappResults.some((r) => r.success);
    const overallSuccess = whatsappSuccess || emailResult.success;

    return NextResponse.json({
      success: overallSuccess,
      isTest,
      protocol,
      whatsapp: {
        success: whatsappSuccess,
        results: whatsappResults,
        recipients: recipientPhones
      },
      email: {
        success: emailResult.success,
        detail: emailResult,
        recipients: recipientEmails
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro interno ao processar notificações."
      },
      { status: 500 }
    );
  }
}
