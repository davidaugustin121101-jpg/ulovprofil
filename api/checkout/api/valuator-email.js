// api/valuator-email.js
// Vercel Serverless Function â POST /api/valuator-email
// OdesĂ­lĂĄ email s vĂ˝sledkem valuatoru pĹes Resend
// Resend API klĂ­Ä je POUZE zde na serveru, ne ve frontendu

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, platform, amount, low, high, followers } = req.body;

  // ZĂĄkladnĂ­ validace
  if (!to || !platform || !amount) {
    return res.status(400).json({ error: 'ChybĂ­ povinnĂŠ parametry.' });
  }

  // Validace emailu
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return res.status(400).json({ error: 'NeplatnĂ˝ email.' });
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    return res.status(500).json({ error: 'Email service nenĂ­ nakonfigurovĂĄn.' });
  }

  const formatted = amount.toLocaleString('cs-CZ');
  const formattedLow  = low  ? low.toLocaleString('cs-CZ')  : null;
  const formattedHigh = high ? high.toLocaleString('cs-CZ') : null;

  const html = `
<!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:32px 16px">

  <div style="text-align:center;margin-bottom:24px">
    <div style="display:inline-block;background:#FF5500;color:#fff;font-weight:700;font-size:17px;padding:8px 18px;border-radius:6px">UlovProfil</div>
  </div>

  <div style="background:#111;border:1px solid #222;border-radius:14px;overflow:hidden;margin-bottom:16px">
    <div style="background:linear-gradient(135deg,#FF5500,#FF7733);padding:22px;text-align:center">
      <div style="color:rgba(255,255,255,.8);font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">VĂ˝sledek ocenÄnĂ­</div>
      <div style="color:#fff;font-size:13px;font-weight:600">${platform} Âˇ ${followers} sledujĂ­cĂ­ch</div>
    </div>
    <div style="padding:22px 24px;text-align:center">
      <div style="color:#666;font-size:12px;margin-bottom:4px">OdhadovanĂĄ hodnota ĂşÄtu</div>
      <div style="color:#FF5500;font-size:36px;font-weight:700;font-family:monospace;letter-spacing:-.02em">${formatted} KÄ</div>
      ${formattedLow && formattedHigh ? `<div style="color:#555;font-size:12px;margin-top:4px;font-family:monospace">Rozsah: ${formattedLow} â ${formattedHigh} KÄ</div>` : ''}
    </div>
  </div>

  <div style="background:#111;border:1px solid #222;border-radius:10px;padding:18px 22px;margin-bottom:16px">
    <div style="color:#FF5500;font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">ChceĹĄ ĂşÄet prodat?</div>
    <div style="color:#aaa;font-size:13px;line-height:1.7;margin-bottom:14px">
      Zaregistruj svĹŻj inzerĂĄt na UlovProfil zdarma. Provize 15 % pouze pĹi ĂşspÄĹĄnĂŠm prodeji.
      UlovProfil garantuje kaĹždou transakci vlastnĂ­m jmĂŠnem.
    </div>
    <a href="https://www.ulovprofil.cz" style="display:inline-block;background:#FF5500;color:#fff;text-decoration:none;font-weight:600;font-size:13px;padding:10px 20px;border-radius:6px">PĹidat inzerĂĄt zdarma â</a>
  </div>

  <div style="text-align:center;color:#444;font-size:11px;font-family:monospace;line-height:1.8">
    UlovProfil Âˇ <a href="https://www.ulovprofil.cz" style="color:#FF5500;text-decoration:none">ulovprofil.cz</a>
    &nbsp;Âˇ&nbsp; <a href="mailto:info@ulovprofil.cz" style="color:#FF5500;text-decoration:none">info@ulovprofil.cz</a>
  </div>

</div>
</body>
</html>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'UlovProfil <oceneni@ulovprofil.cz>',
        to: [to],
        subject: `đ° TvĹŻj ${platform} ĂşÄet mĂĄ hodnotu ${formatted} KÄ`,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Resend error');
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('[valuator-email]', err);
    return res.status(500).json({ error: 'Email se nepodaĹilo odeslat.' });
  }
}
