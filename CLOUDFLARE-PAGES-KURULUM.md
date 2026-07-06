# finhouse.ai → Cloudflare Pages Kurulumu

Repo Cloudflare Pages'e **hazır** (2026-07-06). Aşağıdaki adımlar senin Cloudflare hesabın +
Spaceship (registrar) panelinden yapılır. Kod tarafında yapılacak bir şey kalmadı.

## ⚠️ Önce kritik uyarı — NS taşıması TÜM alt alanları etkiler
finhouse.ai nameserver'ları şu an **Spaceship'te**. Cloudflare'a taşıyınca **bütün DNS zone**
Cloudflare'a geçer. Bu, sadece ana siteyi değil şunları da etkiler:
- **app.finhouse.ai** → şu an `firmai-app.netlify.app`'e CNAME (FirmaAI uygulaması). Bu kayıt
  Cloudflare'da da olmalı, yoksa **uygulama erişilemez** olur.
- **E-posta (MX + SPF/DKIM/DMARC)** → info@finhouse.ai, no-reply@finhouse.ai çalışıyorsa MX
  kayıtları var demektir. Taşımada bunlar da taşınmalı, yoksa **mail durur**.

Cloudflare "Add site" sırasında mevcut kayıtları tarayıp import eder — ama **NS değişiminden
ÖNCE** import edilen listeyi Spaceship'teki kayıtlarla karşılaştır. Eksik varsa elle ekle.

## Adım adım

### 1. Cloudflare'a domaini ekle
- Cloudflare → **Add a site** → `finhouse.ai` → Free plan.
- Cloudflare mevcut DNS kayıtlarını tarar. **app.finhouse.ai CNAME + MX + TXT (SPF/DKIM)**
  listede var mı doğrula. Eksikse Spaceship DNS panelinden bakıp elle ekle.
- Cloudflare sana 2 nameserver verir (ör. `xxx.ns.cloudflare.com`).

### 2. Spaceship'te nameserver'ları değiştir
- Spaceship → finhouse.ai → **Nameservers** → Cloudflare'ın verdiği 2 NS'i yaz, kaydet.
- Yayılma birkaç dk–birkaç saat sürebilir. Cloudflare zone "Active" olunca hazır.

### 3. Pages projesini oluştur
- Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**.
- Repo: `ayhanagirgol/finhouse-ai-site`, branch: `main`.
- Build ayarları:
  - **Framework preset:** None
  - **Build command:** (boş bırak)
  - **Build output directory:** `/` (kök)
- Deploy et. Proje `*.pages.dev` adresinde açılmalı. `functions/api/demo-request.js`
  otomatik Pages Function olarak yüklenir.

### 4. Environment variables (demo formu maili için)
- Pages → proje → **Settings → Environment variables → Production**:
  - `RESEND_API_KEY` = (Netlify'daki değer)
  - `RESEND_FROM` = `FinHouse.ai <no-reply@finhouse.ai>`  (ops.)
  - `DEMO_TO` = `info@finhouse.ai`  (ops.)
- Kaydedip **Retry deployment** (env'in aktif olması için).
- Not: RESEND_API_KEY yoksa form kırılmaz — kullanıcıya "info@finhouse.ai'a yazın" mailto
  linki gösterir (graceful fallback).

### 5. Özel alan adı
- Pages → proje → **Custom domains → Set up a domain** → `finhouse.ai` (ve `www.finhouse.ai`).
- Zone Cloudflare'da olduğu için gerekli DNS kaydını otomatik ekler.

### 6. www → apex yönlendirmesi (önerilir)
- Cloudflare → finhouse.ai → **Rules → Redirect Rules → Create**:
  - When: Hostname equals `www.finhouse.ai`
  - Then: Dynamic redirect → `concat("https://finhouse.ai", http.request.uri.path)` , 301.

### 7. Netlify'ı devreden çıkar
- finhouse.ai artık Cloudflare'da olduğu için Netlify'daki eski site trafik almaz.
- Netlify → eski "finhouse.ai" sitesi → domain'i kaldır / siteyi unpublish (opsiyonel temizlik).
- **Dikkat:** app.finhouse.ai hâlâ Netlify'daki `firmai-app`'e gidiyor; onu bozma.

## Doğrulama (canlıya geçince)
- `https://finhouse.ai/` yeni tasarım açılıyor
- `https://finhouse.ai/blog-kredi-tahsis-yapay-zeka.html`
- `/robots.txt`, `/sitemap.xml`, `/llms.txt`
- `/demo` formu → gönder → thanks sayfası (env set edildiyse mail düşer)
- `https://www.finhouse.ai` → apex'e yönleniyor
- app.finhouse.ai hâlâ çalışıyor (uygulama)

## Repo'da yapılan Pages uyarlamaları (referans)
- `functions/api/demo-request.js` — Netlify function → Pages Function (`onRequestPost`, `env.*`,
  `cf-connecting-ip`). Eski `netlify/functions/` ve `netlify.toml` kaldırıldı.
- `demo.html` — fetch `/.netlify/functions/demo-request` → `/api/demo-request`; Netlify Forms
  fallback yerine mailto fallback.
- `_redirects` — Netlify'a özgü Host= / .html satırları kaldırıldı (Pages temiz URL + HTTPS'i
  kendi hallediyor; eski satırlar loop yaratırdı).
- `_headers` — Pages `_headers`'ı destekliyor; CSP olduğu gibi geçerli.
