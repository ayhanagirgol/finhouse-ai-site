// Cloudflare Pages Function — POST /api/demo-request
// Sağlayıcı-bağımsız: RESEND_API_KEY varsa Resend, yoksa BREVO_API_KEY varsa Brevo ile gönderir.
// Env (Pages → Settings → Environment variables):
//   RESEND_API_KEY (re_...)   VEYA   BREVO_API_KEY (xkeysib-...)
//   MAIL_FROM (ops., varsayılan no-reply@finhouse.ai)   DEMO_TO (ops., varsayılan info@finhouse.ai)
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const ct = request.headers.get("content-type") || "";
    let data = {};
    if (ct.includes("application/json")) {
      data = await request.json();
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(await request.text());
      for (const [k, v] of params.entries()) data[k] = v;
    } else {
      try { data = JSON.parse(await request.text()); } catch { data = {}; }
    }

    const name = (data.name || "").toString().trim();
    const email = (data.email || "").toString().trim();
    const company = (data.company || "").toString().trim();
    const phone = (data.phone || "").toString().trim();
    const sector = (data.sector || "").toString().trim();
    const message = (data.message || "").toString().trim();
    let solutions = data.solutions;
    if (Array.isArray(solutions)) solutions = solutions.join(", ");
    solutions = (solutions || "").toString().trim();

    if (!name || !email) return json({ ok: false, error: "name and email are required" }, 400);

    const to = env.DEMO_TO || "info@finhouse.ai";
    const fromEmail = env.MAIL_FROM || "no-reply@finhouse.ai";
    const subject = `[FinHouse.ai] Demo Talebi — ${company || name}`;

    const esc = (s) => (s || "-").toString().replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const row = (k, v) => `<tr><td style="padding:8px 14px;border-bottom:1px solid #EFEDE5;color:#6B6962;font-size:13px;width:150px;vertical-align:top">${k}</td><td style="padding:8px 14px;border-bottom:1px solid #EFEDE5;color:#0E0E0C;font-size:14px">${esc(v)}</td></tr>`;
    const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#F6F4EE;padding:28px">
      <div style="border:1px solid rgba(14,14,12,.16);border-radius:12px;background:#fff;overflow:hidden">
        <div style="padding:18px 22px;border-bottom:2px solid #0E0E0C">
          <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#2F5D4B;font-family:monospace">FinHouse.ai · Demo Talebi</div>
          <div style="font-size:20px;font-weight:700;color:#0E0E0C;margin-top:4px">${esc(company || name)}</div>
        </div>
        <table style="width:100%;border-collapse:collapse">
          ${row("Ad Soyad", name)}${row("E-posta", email)}${row("Şirket", company)}
          ${row("Telefon", phone)}${row("Sektör", sector)}${row("İlgilenilen çözümler", solutions)}
        </table>
        <div style="padding:14px 22px;border-top:1px solid #EFEDE5">
          <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6B6962;font-family:monospace;margin-bottom:6px">Mesaj</div>
          <div style="font-size:14px;color:#2A2924;line-height:1.6;white-space:pre-wrap">${esc(message)}</div>
        </div>
      </div>
      <div style="font-family:monospace;font-size:11px;color:#97948B;text-align:center;margin-top:14px">finhouse.ai demo formu</div>
    </div>`;
    const text = ["FinHouse.ai — Yeni Demo Talebi", "", "Ad Soyad: " + name, "E-posta: " + email,
      "Şirket: " + (company || "-"), "Telefon: " + (phone || "-"), "Sektör: " + (sector || "-"),
      "İlgilenilen çözümler: " + (solutions || "-"), "", "Mesaj:", (message || "-")].join("\n");

    // ── Resend ──
    if (env.RESEND_API_KEY) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `FinHouse.ai Demo <${fromEmail}>`, to, subject, html, text, reply_to: email }),
      });
      if (!r.ok) return json({ ok: false, error: "Resend error", detail: (await r.text()).slice(0, 300) }, 502);
      return json({ ok: true }, 200);
    }

    // ── Brevo ──
    if (env.BREVO_API_KEY) {
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", "accept": "application/json" },
        body: JSON.stringify({
          sender: { name: "FinHouse.ai Demo", email: fromEmail },
          to: [{ email: to }], replyTo: { email, name: name || email },
          subject, htmlContent: html, textContent: text,
        }),
      });
      if (!r.ok) return json({ ok: false, error: "Brevo error", detail: (await r.text()).slice(0, 300) }, 502);
      return json({ ok: true }, 200);
    }

    return json({ ok: false, error: "No mail provider configured (set RESEND_API_KEY or BREVO_API_KEY)" }, 500);
  } catch (e) {
    return json({ ok: false, error: (e && e.message) || "unknown error" }, 500);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
