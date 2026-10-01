// Deploy with: supabase functions deploy send-inconsistency-notification
// Required secrets: RESEND_API_KEY, RESEND_FROM_EMAIL, ZERNIO_API_KEY, NOTIFICATION_WHATSAPP_RECIPIENT
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const {
      recipients,
      recipientPhones,
      protocol,
      firefighterName,
      nonConformities,
      createdAt,
      items
    } = await request.json();

    const emails = Array.isArray(recipients)
      ? recipients.filter((email) => typeof email === "string" && email.trim()).map((email) => email.trim())
      : ["supervisoremergencia@riogaleao.com"];

    const phones = Array.isArray(recipientPhones) && recipientPhones.length
      ? recipientPhones
      : [Deno.env.get("NOTIFICATION_WHATSAPP_RECIPIENT") || "5521992114159"];

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") || "ENSEG Alertas <onboarding@resend.dev>";
    const zernioApiKey = Deno.env.get("ZERNIO_API_KEY") || "sk_7bc03b5daab2ccecafd2bd5123e7c1951b798aca89b6c7004bfaf21dc5c20d90";

    const results = { emailSent: false, whatsappSent: false };

    // 1. WhatsApp via Zernio
    if (zernioApiKey && phones.length) {
      try {
        const accRes = await fetch("https://zernio.com/api/v1/accounts", {
          headers: { Authorization: `Bearer ${zernioApiKey}` }
        });
        if (accRes.ok) {
          const accData = await accRes.json();
          const accounts = accData.accounts || [];
          if (accounts.length > 0) {
            const waAcc = accounts.find((a: any) => a.platform === "whatsapp") || accounts[0];
            const accountId = waAcc._id || waAcc.id;

            const textMessage = [
              "🚨 *ALERTA OPERACIONAL DE OCORRÊNCIA — ENSEG / RIOgaleão*",
              "",
              `📋 *Protocolo:* ${protocol}`,
              `👨‍🚒 *Bombeiro Responsável:* ${firefighterName}`,
              `⚠️ *Não Conformidades:* ${nonConformities} item(ns)`,
              `📅 *Data/Hora:* ${createdAt}`,
              "",
              "Acesse o painel para verificar:",
              "🔗 https://bombeirosapp.vercel.app"
            ].join("\n");

            for (const phone of phones) {
              const cleanPhone = String(phone).replace(/\D/g, "");
              await fetch("https://zernio.com/api/v1/inbox/conversations", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${zernioApiKey}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  accountId,
                  participantId: cleanPhone,
                  message: textMessage
                })
              });
            }
            results.whatsappSent = true;
          }
        }
      } catch (waErr) {
        console.error("Zernio WhatsApp error in Edge Function:", waErr);
      }
    }

    // 2. Email via Resend
    if (resendApiKey && emails.length) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: resendFrom,
          to: emails,
          subject: `[ENSEG / RIOgaleão] ${nonConformities} não conformidade(s) — ${protocol}`,
          html: `
            <h2>Nova ocorrência operacional — RIOgaleão</h2>
            <p>A ronda <strong>${protocol}</strong>, registrada por <strong>${firefighterName}</strong> em ${createdAt}, possui <strong>${nonConformities}</strong> não conformidade(s).</p>
            <p>Acesse o painel administrativo para consultar e confirmar a ciência da ocorrência: <a href="https://bombeirosapp.vercel.app">Painel ENSEG</a></p>
          `
        })
      });
      if (emailRes.ok) {
        results.emailSent = true;
      }
    }

    return Response.json({ success: true, ...results });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Erro ao processar envio de notificações." }, { status: 500 });
  }
});
