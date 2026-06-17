// api/checkout/confirm.js
// Vercel Serverless Function — spustí se při POST /api/checkout/confirm
// Stack: Supabase (DB) + Resend (emaily)

import { createClient } from '@supabase/supabase-js';

// ── Konfigurace (nastav jako env proměnné ve Vercel Dashboard) ──────────────
const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY; // service role — obchází RLS
const RESEND_KEY       = process.env.RESEND_API_KEY;
const ACCOUNT_NUMBER   = '3666250018/3030';                      // AirBank podnikatelský
const ADMIN_EMAILS     = ['davidaugustin1211@seznam.cz'];        // přidej parťáka sem
const FROM_EMAIL       = 'UlovProfil <objednavky@ulovprofil.cz>';

// ── Pomocné funkce ───────────────────────────────────────────────────────────

/** Generuje unikátní VS: YYMMDD + 4 náhodné cifry, např. 2606171234 */
function generateVS() {
  const now  = new Date();
  const date = String(now.getFullYear()).slice(2)
             + String(now.getMonth() + 1).padStart(2, '0')
             + String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return date + rand;
}

/** Formátuje číslo jako české Kč: 26450 → "26 450 Kč" */
function formatCZK(amount) {
  return amount.toLocaleString('cs-CZ') + ' Kč';
}

/** SPAYD QR string pro české bankovní aplikace */
function spaydString(amount, vs) {
  return `SPD*1.0*ACC:${ACCOUNT_NUMBER}*AM:${amount.toFixed(2)}*CC:CZK*X-VS:${vs}*MSG:UlovProfil`;
}

/** QR kód jako PNG v Base64 přes api.qrserver.com (žádná závislost) */
function qrImageUrl(amount, vs) {
  const data = encodeURIComponent(spaydString(amount, vs));
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${data}`;
}

// ── Email šablony ────────────────────────────────────────────────────────────

function buyerEmailHtml({ order, listing, vs, total, fee, base }) {
  const qrUrl = qrImageUrl(total, vs);
  return `
<!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 16px">

  <!-- Logo -->
  <div style="text-align:center;margin-bottom:28px">
    <div style="display:inline-block;background:#FF5500;color:#fff;font-weight:700;font-size:18px;padding:8px 18px;border-radius:6px;letter-spacing:-.01em">UlovProfil</div>
    <div style="color:#666;font-size:12px;margin-top:6px;font-family:monospace">ulovprofil.cz</div>
  </div>

  <!-- Nadpis -->
  <div style="background:#111;border:1px solid #222;border-radius:16px;overflow:hidden;margin-bottom:16px">
    <div style="background:linear-gradient(135deg,#FF5500,#FF7733);padding:24px;text-align:center">
      <div style="color:rgba(255,255,255,.8);font-size:12px;font-family:monospace;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Potvrzení objednávky</div>
      <div style="color:#fff;font-size:14px;font-weight:600">Objednávka přijata! Nyní proveď platbu.</div>
    </div>

    <!-- Detaily objednávky -->
    <div style="padding:20px 24px">
      <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #1e1e1e">
        <span style="color:#666;font-size:13px">Platforma</span>
        <span style="color:#fff;font-size:13px;font-weight:600">${listing.platform}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #1e1e1e">
        <span style="color:#666;font-size:13px">Sledující / obsah</span>
        <span style="color:#fff;font-size:13px">${listing.followers} · ${listing.niche}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #1e1e1e">
        <span style="color:#666;font-size:13px">Cena účtu</span>
        <span style="color:#fff;font-size:13px;font-family:monospace">${formatCZK(base)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #1e1e1e">
        <span style="color:#666;font-size:13px">Provize UlovProfil (15 %)</span>
        <span style="color:#aaa;font-size:13px;font-family:monospace">${formatCZK(fee)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px 0">
        <span style="color:#fff;font-size:14px;font-weight:700">Celkem k zaplacení</span>
        <span style="color:#FF5500;font-size:18px;font-weight:700;font-family:monospace">${formatCZK(total)}</span>
      </div>
    </div>
  </div>

  <!-- Platební instrukce -->
  <div style="background:#111;border:1px solid #2e2e2e;border-radius:12px;padding:20px 24px;margin-bottom:16px">
    <div style="color:#FF5500;font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:.1em;margin-bottom:16px">Platební instrukce</div>

    <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #1e1e1e">
      <span style="color:#666;font-size:12px">Číslo účtu</span>
      <span style="color:#fff;font-size:13px;font-family:monospace;font-weight:600">${ACCOUNT_NUMBER}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #1e1e1e">
      <span style="color:#666;font-size:12px">Variabilní symbol</span>
      <span style="color:#FF5500;font-size:20px;font-family:monospace;font-weight:700;letter-spacing:.05em">${vs}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #1e1e1e">
      <span style="color:#666;font-size:12px">Částka</span>
      <span style="color:#fff;font-size:14px;font-family:monospace;font-weight:700">${formatCZK(total)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:9px 0">
      <span style="color:#666;font-size:12px">Zpráva pro příjemce</span>
      <span style="color:#aaa;font-size:12px;font-family:monospace">UlovProfil #${vs}</span>
    </div>

    <!-- Upozornění na VS -->
    <div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);border-radius:8px;padding:12px 14px;margin-top:14px">
      <div style="color:#f59e0b;font-size:12px;line-height:1.6">
        ⚠️ <strong>Nezapomeň uvést variabilní symbol ${vs}</strong> — bez něj nemůžeme platbu spárovat s tvou objednávkou.
      </div>
    </div>
  </div>

  <!-- QR kód -->
  <div style="background:#111;border:1px solid #222;border-radius:12px;padding:20px 24px;text-align:center;margin-bottom:16px">
    <div style="color:#aaa;font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px">QR platba pro mobilní banking</div>
    <img src="${qrUrl}" alt="QR platba ${vs}" width="180" height="180" style="border-radius:8px;background:#fff;padding:8px">
    <div style="color:#666;font-size:11px;margin-top:10px">Naskenuj v mobilní aplikaci banky · obsahuje všechny platební údaje</div>
  </div>

  <!-- Co se stane dál -->
  <div style="background:#111;border:1px solid #222;border-radius:12px;padding:20px 24px;margin-bottom:24px">
    <div style="color:#aaa;font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px">Co se stane dál</div>
    <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid #1a1a1a">
      <div style="width:20px;height:20px;background:rgba(255,85,0,.15);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#FF5500;flex-shrink:0;font-family:monospace">1</div>
      <div style="font-size:12px;color:#aaa;line-height:1.6">Proveď platbu s VS <strong style="color:#fff">${vs}</strong> na účet <strong style="color:#fff">${ACCOUNT_NUMBER}</strong></div>
    </div>
    <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid #1a1a1a">
      <div style="width:20px;height:20px;background:rgba(255,85,0,.15);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#FF5500;flex-shrink:0;font-family:monospace">2</div>
      <div style="font-size:12px;color:#aaa;line-height:1.6">Do 24 hodin platbu spárujeme a upozorníme prodejce</div>
    </div>
    <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid #1a1a1a">
      <div style="width:20px;height:20px;background:rgba(255,85,0,.15);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#FF5500;flex-shrink:0;font-family:monospace">3</div>
      <div style="font-size:12px;color:#aaa;line-height:1.6">Prodejce předá přístupy — dostaneš je do dashboardu nebo emailem</div>
    </div>
    <div style="display:flex;gap:12px;padding:8px 0">
      <div style="width:20px;height:20px;background:rgba(255,85,0,.15);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#FF5500;flex-shrink:0;font-family:monospace">4</div>
      <div style="font-size:12px;color:#aaa;line-height:1.6">Máš <strong style="color:#fff">48 hodin</strong> na ověření — pak potvrdíš a my vyplatíme prodejce</div>
    </div>
  </div>

  <!-- Footer -->
  <div style="text-align:center;color:#444;font-size:11px;font-family:monospace;line-height:1.8">
    UlovProfil — Garantovaný marketplace pro prodej sociálních účtů<br>
    Dotazy: <a href="mailto:info@ulovprofil.cz" style="color:#FF5500;text-decoration:none">info@ulovprofil.cz</a>
    &nbsp;·&nbsp;
    <a href="https://ulovprofil.cz" style="color:#FF5500;text-decoration:none">ulovprofil.cz</a>
  </div>
</div>
</body>
</html>`;
}

function adminEmailHtml({ order, listing, vs, total, base, fee, buyerEmail }) {
  return `
<!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:500px;margin:0 auto;padding:28px 16px">

  <div style="background:#FF5500;color:#fff;font-weight:700;font-size:15px;padding:10px 16px;border-radius:6px;margin-bottom:20px;text-align:center">
    🔔 Nová objednávka čeká na platbu
  </div>

  <div style="background:#111;border:1px solid #222;border-radius:10px;padding:18px 22px;margin-bottom:14px">
    <div style="font-size:11px;color:#666;font-family:monospace;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Detaily objednávky</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #1e1e1e">Order ID</td><td style="color:#fff;font-family:monospace;text-align:right;padding:5px 0;border-bottom:1px solid #1e1e1e">#${order.id}</td></tr>
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #1e1e1e">Variabilní symbol</td><td style="color:#FF5500;font-family:monospace;font-weight:700;font-size:16px;text-align:right;padding:5px 0;border-bottom:1px solid #1e1e1e">${vs}</td></tr>
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #1e1e1e">Platforma</td><td style="color:#fff;text-align:right;padding:5px 0;border-bottom:1px solid #1e1e1e">${listing.platform}</td></tr>
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #1e1e1e">Inzerát</td><td style="color:#fff;text-align:right;padding:5px 0;border-bottom:1px solid #1e1e1e">${listing.followers} · ${listing.niche}</td></tr>
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #1e1e1e">Kupující</td><td style="color:#fff;font-family:monospace;font-size:12px;text-align:right;padding:5px 0;border-bottom:1px solid #1e1e1e">${buyerEmail}</td></tr>
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #1e1e1e">Cena účtu</td><td style="color:#fff;font-family:monospace;text-align:right;padding:5px 0;border-bottom:1px solid #1e1e1e">${formatCZK(base)}</td></tr>
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #1e1e1e">Provize (15 %)</td><td style="color:#22c55e;font-family:monospace;text-align:right;padding:5px 0;border-bottom:1px solid #1e1e1e">+${formatCZK(fee)}</td></tr>
      <tr><td style="color:#fff;font-weight:700;padding:8px 0">Celkem čeká na účtu</td><td style="color:#FF5500;font-family:monospace;font-size:17px;font-weight:700;text-align:right;padding:8px 0">${formatCZK(total)}</td></tr>
    </table>
  </div>

  <div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:8px;padding:14px 18px;font-size:12px;color:#aaa;line-height:1.7">
    Jakmile platba dorazí na účet <strong style="color:#fff">${ACCOUNT_NUMBER}</strong> s VS <strong style="color:#FF5500">${vs}</strong>,
    přejdi do admin panelu a změň status na <strong style="color:#fff">PAYMENT_RECEIVED</strong>.
  </div>

</div>
</body>
</html>`;
}

// ── Hlavní handler ───────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Pouze POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { listing_id, buyer_id, buyer_email } = req.body;

  // Základní validace vstupu
  if (!listing_id || !buyer_id || !buyer_email) {
    return res.status(400).json({ error: 'Chybí povinné parametry.' });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  try {
    // ── 1. Načti inzerát a zkontroluj dostupnost ───────────────────────────
    const { data: listing, error: listingErr } = await sb
      .from('listings')
      .select('*')
      .eq('id', listing_id)
      .single();

    if (listingErr || !listing) {
      return res.status(404).json({ error: 'Inzerát nenalezen.' });
    }
    if (listing.status !== 'active') {
      return res.status(409).json({ error: 'Inzerát již není dostupný.' });
    }

    // ── 2. Spočítej ceny ───────────────────────────────────────────────────
    const base  = parseInt(listing.price);
    const fee   = Math.round(base * 0.15);
    const total = base + fee;
    const vs    = generateVS();

    // ── 3. Ulož objednávku + rezervuj inzerát (atomicky) ──────────────────
    // Vložíme objednávku
    const { data: order, error: orderErr } = await sb
      .from('orders')
      .insert({
        listing_id,
        buyer_id,
        buyer_email,
        seller_id:        listing.user_id,
        seller_email:     listing.seller_email,
        listing_platform: listing.platform,
        listing_followers:listing.followers,
        listing_niche:    listing.niche,
        price_base:       base,
        price_fee:        fee,
        price_total:      total,
        variable_symbol:  vs,
        status:           'PENDING_PAYMENT',
        created_at:       new Date().toISOString(),
      })
      .select()
      .single();

    if (orderErr) throw new Error('Chyba při vytváření objednávky: ' + orderErr.message);

    // Rezervuj inzerát — změn status na 'reserved'
    await sb
      .from('listings')
      .update({ status: 'reserved', reserved_order_id: order.id })
      .eq('id', listing_id);

    // ── 4. Email kupujícímu ────────────────────────────────────────────────
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [buyer_email],
        subject: `✅ Objednávka potvrzena — zaplať VS: ${vs} · ${formatCZK(total)}`,
        html:    buyerEmailHtml({ order, listing, vs, total, fee, base }),
      }),
    });

    // ── 5. Admin notifikace ────────────────────────────────────────────────
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      ADMIN_EMAILS,
        subject: `🔔 Nová objednávka #${order.id} · VS ${vs} · ${formatCZK(total)}`,
        html:    adminEmailHtml({ order, listing, vs, total, base, fee, buyerEmail: buyer_email }),
      }),
    });

    // ── 6. Vrátit odpověď frontendu ────────────────────────────────────────
    return res.status(200).json({
      success:         true,
      order_id:        order.id,
      variable_symbol: vs,
      total,
      account:         ACCOUNT_NUMBER,
    });

  } catch (err) {
    console.error('[checkout/confirm]', err);
    return res.status(500).json({ error: err.message || 'Interní chyba serveru.' });
  }
}
