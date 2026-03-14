import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { email, firstName, downloadLinks } = await req.json()

  if (!email || !firstName) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const googlePlayUrl = downloadLinks?.google_play_url || null
  const appleStoreUrl = downloadLinks?.apple_store_url || null
  const apkUrl = downloadLinks?.apk_download_url || null
  const desktopUrl = downloadLinks?.desktop_app_url || 'https://revele-ton-pilates.vercel.app/login'

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#FAF6F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 20px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,#C6684F,#E8926F);margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
        <span style="font-size:28px;">🌿</span>
      </div>
      <h1 style="font-size:26px;color:#2C2C2C;margin:0 0 4px;">Bienvenue ${firstName} !</h1>
      <p style="font-size:14px;color:#6B6359;margin:0;">Ton espace Révèle Ton Pilates est prêt</p>
    </div>

    <!-- Main card -->
    <div style="background:white;border-radius:20px;padding:28px 24px;border:1px solid #EDE5DA;">
      <p style="font-size:14px;color:#6B6359;line-height:1.6;margin:0 0 24px;">
        Ton compte a été créé avec succès. Voici les liens pour télécharger l'application et accéder à ton espace depuis n'importe quel appareil.
      </p>

      <!-- Download buttons -->
      <div style="margin-bottom:12px;">
        ${googlePlayUrl ? `
        <a href="${googlePlayUrl}" target="_blank" style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:#2C2C2C;border-radius:14px;text-decoration:none;margin-bottom:10px;">
          <span style="font-size:20px;">▶️</span>
          <div>
            <p style="font-size:10px;color:rgba(255,255,255,0.7);margin:0;line-height:1;">Télécharger sur</p>
            <p style="font-size:15px;font-weight:600;color:white;margin:0;line-height:1.3;">Google Play</p>
          </div>
        </a>` : `
        <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:rgba(44,44,44,0.5);border-radius:14px;margin-bottom:10px;">
          <span style="font-size:20px;">▶️</span>
          <div style="flex:1;">
            <p style="font-size:10px;color:rgba(255,255,255,0.6);margin:0;line-height:1;">Télécharger sur</p>
            <p style="font-size:15px;font-weight:600;color:rgba(255,255,255,0.8);margin:0;line-height:1.3;">Google Play</p>
          </div>
          <span style="font-size:10px;background:rgba(255,255,255,0.2);color:rgba(255,255,255,0.8);padding:2px 8px;border-radius:20px;">Bientôt</span>
        </div>`}

        ${appleStoreUrl ? `
        <a href="${appleStoreUrl}" target="_blank" style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:#2C2C2C;border-radius:14px;text-decoration:none;margin-bottom:10px;">
          <span style="font-size:20px;">🍎</span>
          <div>
            <p style="font-size:10px;color:rgba(255,255,255,0.7);margin:0;line-height:1;">Télécharger sur l'</p>
            <p style="font-size:15px;font-weight:600;color:white;margin:0;line-height:1.3;">App Store</p>
          </div>
        </a>` : `
        <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:rgba(44,44,44,0.5);border-radius:14px;margin-bottom:10px;">
          <span style="font-size:20px;">🍎</span>
          <div style="flex:1;">
            <p style="font-size:10px;color:rgba(255,255,255,0.6);margin:0;line-height:1;">Télécharger sur l'</p>
            <p style="font-size:15px;font-weight:600;color:rgba(255,255,255,0.8);margin:0;line-height:1.3;">App Store</p>
          </div>
          <span style="font-size:10px;background:rgba(255,255,255,0.2);color:rgba(255,255,255,0.8);padding:2px 8px;border-radius:20px;">Bientôt</span>
        </div>`}
      </div>

      ${apkUrl ? `
      <!-- APK -->
      <a href="${apkUrl}" target="_blank" style="display:block;text-align:center;padding:12px;background:#C6684F;color:white;border-radius:14px;text-decoration:none;font-size:14px;font-weight:600;margin-bottom:16px;">
        📥 Télécharger l'APK (Android)
      </a>` : ''}

      <!-- Separator -->
      <div style="border-top:1px solid #EDE5DA;margin:20px 0;"></div>

      <!-- Desktop -->
      <a href="${desktopUrl}" target="_blank" style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:#FAF6F1;border:1px solid #EDE5DA;border-radius:14px;text-decoration:none;">
        <div style="width:40px;height:40px;border-radius:50%;background:rgba(198,104,79,0.1);display:flex;align-items:center;justify-content:center;">
          <span style="font-size:18px;">🖥️</span>
        </div>
        <div>
          <p style="font-size:14px;font-weight:600;color:#2C2C2C;margin:0;line-height:1.3;">Version Desktop</p>
          <p style="font-size:11px;color:#A09488;margin:0;">Accède depuis ton navigateur</p>
        </div>
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:28px;">
      <p style="font-size:12px;color:#A09488;line-height:1.5;margin:0 0 4px;">
        Connecte-toi avec ton email et ton mot de passe,<br>quelle que soit la plateforme choisie.
      </p>
      <p style="font-size:11px;color:#DCCFBF;margin:16px 0 0;">
        Révèle Ton Pilates — Marjorie Jamin
      </p>
    </div>
  </div>
</body>
</html>`

  try {
    const { error } = await resend.emails.send({
      from: '=?UTF-8?B?UsOpdsOobGUgVG9uIFBpbGF0ZXM=?= <noreply@marjoriejamin.com>',
      to: email,
      subject: `Bienvenue ${firstName} ! Voici tes liens de téléchargement`,
      html,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur envoi email' }, { status: 500 })
  }
}
