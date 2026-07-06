// Cloudflare Pages Function — POST /api/demo-request
// Netlify function'dan taşındı. Env değişkenleri (Pages → Settings → Environment variables):
//   RESEND_API_KEY (zorunlu), RESEND_FROM (ops.), DEMO_TO (ops.)
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const ct = request.headers.get("content-type") || "";
    let data = {};
    if (ct.includes("application/json")) {
      data = await request.json();
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const body = await request.text();
      const params = new URLSearchParams(body);
      for (const [k, v] of params.entries()) data[k] = v;
    } else {
      const body = await request.text();
      try { data = JSON.parse(body); } catch { data = { raw: body }; }
    }

    const name = (data.name || "").toString().trim();
    const email = (data.email || "").toString().trim();
    const company = (data.company || "").toString().trim();
    const sector = (data.sector || "").toString().trim();
    const message = (data.message || "").toString().trim();

    if (!name || !email) {
      return json({ ok: false, error: "name and email are required" }, 400);
    }

    const apiKey = env.RESEND_API_KEY;
    const from = env.RESEND_FROM || "FinHouse.ai <no-reply@finhouse.ai>";
    const to = env.DEMO_TO || "info@finhouse.ai";

    if (!apiKey) {
      return json({ ok: false, error: "Missing RESEND_API_KEY env var" }, 500);
    }

    const subject = `[FinHouse.ai] Yeni Demo Talebi - ${company || name}`;
    const text = [
      "Yeni demo talebi alındı:",
      "",
      `Ad Soyad: ${name}`,
      `E-posta: ${email}`,
      `Şirket: ${company || "-"}`,
      `Sektör: ${sector || "-"}`,
      "",
      "Mesaj:",
      message || "-",
      "",
      `Kaynak: ${request.headers.get("referer") || "-"}`,
      `IP: ${request.headers.get("cf-connecting-ip") || "-"}`,
    ].join("\n");

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, reply_to: email }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return json({ ok: false, error: "Resend error", detail: errText }, 502);
    }

    return json({ ok: true }, 200);
  } catch (e) {
    return json({ ok: false, error: (e && e.message) || "unknown error" }, 500);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
