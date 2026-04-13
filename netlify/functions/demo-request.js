export default async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    const ct = req.headers.get("content-type") || "";
    let data = {};
    if (ct.includes("application/json")) {
      data = await req.json();
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const body = await req.text();
      const params = new URLSearchParams(body);
      for (const [k, v] of params.entries()) data[k] = v;
    } else {
      const body = await req.text();
      try { data = JSON.parse(body); } catch { data = { raw: body }; }
    }

    const name = (data.name || "").toString().trim();
    const email = (data.email || "").toString().trim();
    const company = (data.company || "").toString().trim();
    const sector = (data.sector || "").toString().trim();
    const message = (data.message || "").toString().trim();

    if (!name || !email) {
      return new Response(JSON.stringify({ ok: false, error: "name and email are required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || "FinHouse.ai <no-reply@finhouse.ai>";
    const to = process.env.DEMO_TO || "info@finhouse.ai";

    if (!apiKey) {
      return new Response(JSON.stringify({ ok: false, error: "Missing RESEND_API_KEY env var" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
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
      `Kaynak: ${req.headers.get("referer") || "-"}`,
      `IP: ${req.headers.get("x-nf-client-connection-ip") || "-"}`,
    ].join("\n");

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text, reply_to: email }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ ok: false, error: "Resend error", detail: errText }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "unknown error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
