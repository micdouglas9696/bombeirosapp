// Deploy with: supabase functions deploy send-inconsistency-notification
// Required secrets: RESEND_API_KEY and RESEND_FROM_EMAIL.
// The browser sends only already-saved round data; no mail credential is exposed.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { recipients, protocol, firefighterName, nonConformities, createdAt } = await request.json();
    const emails = Array.isArray(recipients)
      ? recipients.filter((email) => typeof email === "string" && email.trim()).map((email) => email.trim())
      : [];

    if (!emails.length) return Response.json({ skipped: true, reason: "No recipients configured" });

    const apiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("RESEND_FROM_EMAIL");
    if (!apiKey || !from) {
      return Response.json({ skipped: true, reason: "Email provider is not configured" });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: emails,
        subject: `[ENSEG] ${nonConformities} não conformidade(s) — ${protocol}`,
        html: `<h2>Nova ocorrência operacional</h2><p>A ronda <strong>${protocol}</strong>, registrada por <strong>${firefighterName}</strong> em ${createdAt}, possui <strong>${nonConformities}</strong> não conformidade(s).</p><p>Acesse o painel administrativo para consultar e confirmar a ciência da ocorrência.</p>`
      })
    });

    if (!response.ok) throw new Error(await response.text());
    return Response.json({ sent: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Não foi possível enviar o e-mail de alerta." }, { status: 500 });
  }
});
