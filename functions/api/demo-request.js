// Cloudflare Pages Function — POST /api/demo-request
// Birincil: Spacemail SMTP (cloudflare:sockets, implicit TLS 465). Yedek: Resend / Brevo (env varsa).
// Secret (Pages → Settings → env): SMTP_PASS (zorunlu). Ops: SMTP_HOST/PORT/USER/FROM, DEMO_TO,
// RESEND_API_KEY, BREVO_API_KEY.
import { connect } from "cloudflare:sockets";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const ct = request.headers.get("content-type") || "";
    let data = {};
    if (ct.includes("application/json")) data = await request.json();
    else if (ct.includes("application/x-www-form-urlencoded")) {
      for (const [k, v] of new URLSearchParams(await request.text()).entries()) data[k] = v;
    } else { try { data = JSON.parse(await request.text()); } catch { data = {}; } }

    const name = s(data.name), email = s(data.email), company = s(data.company),
      phone = s(data.phone), sector = s(data.sector), message = s(data.message);
    let solutions = Array.isArray(data.solutions) ? data.solutions.join(", ") : s(data.solutions);
    if (!name || !email) return json({ ok: false, error: "name and email are required" }, 400);

    const to = env.DEMO_TO || "info@finhouse.ai";
    const subject = `[FinHouse.ai] Demo Talebi — ${company || name}`;
    const { html, text } = buildBody({ name, email, company, phone, sector, solutions, message });

    // ── 1) Spacemail SMTP (birincil) ──
    if (env.SMTP_PASS) {
      await sendSmtp({
        host: env.SMTP_HOST || "mail.spacemail.com",
        port: parseInt(env.SMTP_PORT || "465", 10),
        user: env.SMTP_USER || "info@finhouse.ai",
        pass: env.SMTP_PASS,
        from: env.SMTP_FROM || env.SMTP_USER || "info@finhouse.ai",
        to, replyTo: email, subject, html,
      });
      return json({ ok: true, via: "smtp" }, 200);
    }
    // ── 2) Resend ──
    if (env.RESEND_API_KEY) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `FinHouse.ai Demo <${env.MAIL_FROM || "no-reply@finhouse.ai"}>`, to, subject, html, text, reply_to: email }),
      });
      if (!r.ok) return json({ ok: false, error: "Resend error", detail: (await r.text()).slice(0, 300) }, 502);
      return json({ ok: true, via: "resend" }, 200);
    }
    // ── 3) Brevo ──
    if (env.BREVO_API_KEY) {
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST", headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender: { name: "FinHouse.ai Demo", email: env.MAIL_FROM || "info@aiwatch.com.tr" }, to: [{ email: to }], replyTo: { email }, subject, htmlContent: html, textContent: text }),
      });
      if (!r.ok) return json({ ok: false, error: "Brevo error", detail: (await r.text()).slice(0, 300) }, 502);
      return json({ ok: true, via: "brevo" }, 200);
    }
    return json({ ok: false, error: "No mail provider configured" }, 500);
  } catch (e) {
    return json({ ok: false, error: (e && e.message) || "unknown error" }, 500);
  }
}

// ── SMTP over TLS (implicit, 465) ──
async function sendSmtp({ host, port, user, pass, from, to, replyTo, subject, html }) {
  const socket = connect({ hostname: host, port }, { secureTransport: "on", allowHalfOpen: false });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  const enc = new TextEncoder(), dec = new TextDecoder();
  let buf = "";
  const readResp = async (expect) => {
    while (!/(^|\r\n)\d{3} [^\r\n]*\r\n$/.test(buf)) {
      const { value, done } = await reader.read();
      if (done) throw new Error("SMTP bağlantı kapandı");
      buf += dec.decode(value, { stream: true });
    }
    const line = buf.trim().split("\r\n").pop();
    const code = parseInt(line.slice(0, 3), 10);
    buf = "";
    if (expect && code !== expect) throw new Error(`SMTP ${code} (beklenen ${expect}): ${line.slice(0, 120)}`);
    return code;
  };
  const send = (str) => writer.write(enc.encode(str));
  try {
    await readResp(220);
    await send(`EHLO finhouse.ai\r\n`); await readResp(250);
    await send(`AUTH LOGIN\r\n`); await readResp(334);
    await send(b64(user) + `\r\n`); await readResp(334);
    await send(b64(pass) + `\r\n`); await readResp(235);
    await send(`MAIL FROM:<${from}>\r\n`); await readResp(250);
    await send(`RCPT TO:<${to}>\r\n`); await readResp(250);
    await send(`DATA\r\n`); await readResp(354);
    const headers =
      `From: FinHouse.ai Demo <${from}>\r\n` +
      `To: <${to}>\r\n` +
      (replyTo ? `Reply-To: <${replyTo}>\r\n` : "") +
      `Subject: =?UTF-8?B?${b64utf8(subject)}?=\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: text/html; charset=utf-8\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n`;
    const body = b64utf8(html).replace(/(.{76})/g, "$1\r\n");
    await send(headers + body + `\r\n.\r\n`); await readResp(250);
    await send(`QUIT\r\n`);
  } finally {
    try { await writer.close(); } catch {}
    try { await socket.close(); } catch {}
  }
}

function s(v) { return (v == null ? "" : v).toString().trim(); }
function b64(str) { let bin = ""; for (const b of new TextEncoder().encode(str)) bin += String.fromCharCode(b); return btoa(bin); }
function b64utf8(str) { return b64(str); }
function json(obj, status) { return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } }); }

function buildBody({ name, email, company, phone, sector, solutions, message }) {
  const esc = (v) => (v || "-").toString().replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  const row = (k, v) => `<tr><td style="padding:8px 14px;border-bottom:1px solid #EFEDE5;color:#6B6962;font-size:13px;width:150px;vertical-align:top">${k}</td><td style="padding:8px 14px;border-bottom:1px solid #EFEDE5;color:#0E0E0C;font-size:14px">${esc(v)}</td></tr>`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#F6F4EE;padding:28px"><div style="border:1px solid rgba(14,14,12,.16);border-radius:12px;background:#fff;overflow:hidden"><div style="padding:18px 22px;border-bottom:2px solid #0E0E0C"><div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#2F5D4B;font-family:monospace">FinHouse.ai · Demo Talebi</div><div style="font-size:20px;font-weight:700;color:#0E0E0C;margin-top:4px">${esc(company || name)}</div></div><table style="width:100%;border-collapse:collapse">${row("Ad Soyad", name)}${row("E-posta", email)}${row("Şirket", company)}${row("Telefon", phone)}${row("Sektör", sector)}${row("İlgilenilen çözümler", solutions)}</table><div style="padding:14px 22px;border-top:1px solid #EFEDE5"><div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6B6962;font-family:monospace;margin-bottom:6px">Mesaj</div><div style="font-size:14px;color:#2A2924;line-height:1.6;white-space:pre-wrap">${esc(message)}</div></div></div></div>`;
  const text = ["FinHouse.ai — Yeni Demo Talebi", "", "Ad Soyad: " + name, "E-posta: " + email, "Şirket: " + (company || "-"), "Telefon: " + (phone || "-"), "Sektör: " + (sector || "-"), "İlgilenilen çözümler: " + (solutions || "-"), "", "Mesaj:", (message || "-")].join("\n");
  return { html, text };
}
