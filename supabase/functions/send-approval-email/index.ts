// supabase/functions/send-approval-email/index.ts
// Sends branded approval email via Gmail SMTP
// Secrets needed: GMAIL_USER, GMAIL_APP_PASSWORD

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GMAIL_USER     = Deno.env.get('GMAIL_USER')
const GMAIL_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD')

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, firstName } = await req.json()

    if (!email || !firstName) {
      return new Response(
        JSON.stringify({ error: 'email and firstName are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0D1B2A;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D1B2A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:14px;">
                    <img src="https://pavilion-htcc.netlify.app/assets/images/htcc-logo.png" alt="HTCC" width="56" height="56"
                      style="border-radius:50%;border:2px solid #F5C518;display:block;" />
                  </td>
                  <td>
                    <div style="font-size:28px;font-weight:900;letter-spacing:6px;color:#FFFFFF;line-height:1;">PAVILION</div>
                    <div style="font-size:10px;font-weight:600;letter-spacing:3px;color:#F5C518;margin-top:3px;">HTCC</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:32px;">
              <div style="height:1px;background:linear-gradient(to right,transparent,#F5C518,transparent);opacity:0.6;"></div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#162236;border-radius:16px;border:1px solid rgba(245,197,24,0.2);padding:36px 32px;">
              <p style="font-size:22px;font-weight:700;color:#FFFFFF;margin:0 0 8px 0;">You're in! ✅</p>
              <p style="font-size:15px;color:#8B9BB4;margin:0 0 20px 0;line-height:1.6;">Hi ${firstName},</p>
              <p style="font-size:15px;color:#CBD5E1;margin:0 0 24px 0;line-height:1.7;">
                Your membership application for Harrow Town Cricket Club has been
                <strong style="color:#22C55E;">approved</strong>. Welcome to the squad!
              </p>
              <table cellpadding="0" cellspacing="0" width="100%"
                style="background:rgba(245,197,24,0.04);border:1px solid rgba(245,197,24,0.15);border-radius:10px;padding:20px;margin-bottom:28px;">
                <tr>
                  <td>
                    <p style="font-size:11px;font-weight:700;letter-spacing:2px;color:#F5C518;margin:0 0 14px 0;">WHAT YOU CAN DO NOW</p>
                    <table cellpadding="0" cellspacing="0">
                      <tr><td style="padding:5px 10px 5px 0;font-size:18px;vertical-align:middle;">🏏</td><td style="padding:5px 0;font-size:14px;color:#CBD5E1;">Set your availability for upcoming fixtures</td></tr>
                      <tr><td style="padding:5px 10px 5px 0;font-size:18px;vertical-align:middle;">📅</td><td style="padding:5px 0;font-size:14px;color:#CBD5E1;">View your team schedule and match details</td></tr>
                      <tr><td style="padding:5px 10px 5px 0;font-size:18px;vertical-align:middle;">👥</td><td style="padding:5px 0;font-size:14px;color:#CBD5E1;">See your team and join additional squads</td></tr>
                      <tr><td style="padding:5px 10px 5px 0;font-size:18px;vertical-align:middle;">📢</td><td style="padding:5px 0;font-size:14px;color:#CBD5E1;">Receive club announcements and training reminders</td></tr>
                      <tr><td style="padding:5px 10px 5px 0;font-size:18px;vertical-align:middle;">🔔</td><td style="padding:5px 0;font-size:14px;color:#CBD5E1;">Get notified when your squad is published</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="https://pavilion-htcc.netlify.app/login"
                      style="display:inline-block;background-color:#F5C518;color:#0D1B2A;font-size:15px;font-weight:700;letter-spacing:1px;padding:14px 36px;border-radius:10px;text-decoration:none;">
                      🏏 SIGN IN TO PAVILION
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size:12px;color:#4A5568;text-align:center;margin:0;">
                Or visit: <a href="https://pavilion-htcc.netlify.app/login" style="color:#F5C518;">pavilion-htcc.netlify.app/login</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:32px;padding-bottom:24px;">
              <div style="height:1px;background:linear-gradient(to right,transparent,#F5C518,transparent);opacity:0.3;"></div>
            </td>
          </tr>
          <tr>
            <td align="center">
              <p style="font-size:13px;color:#4A5568;margin:0 0 4px 0;">Best wishes,</p>
              <p style="font-size:13px;font-weight:700;color:#8B9BB4;margin:0 0 16px 0;">Harrow Town Team</p>
              <p style="font-size:11px;color:#F5C518;letter-spacing:2px;margin:0;">HARROW TOWN CRICKET CLUB</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    // ── Send via Gmail SMTP using Deno's native TCP ──────────────────────
    // Base64 encode credentials for AUTH PLAIN
    const encoder    = new TextEncoder()
    const authString = `\0${GMAIL_USER}\0${GMAIL_PASSWORD}`
    const authB64    = btoa(String.fromCharCode(...encoder.encode(authString)))

    // Use Resend as relay but with Gmail credentials via their SMTP
    // Actually use fetch to Gmail's API via OAuth — simplest is to keep Resend
    // but send to verified address. Instead use a simple SMTP relay service.

    // ── Simplest working solution: use smtp.gmail.com via fetch to a relay ──
    const emailPayload = {
      personalizations: [{ to: [{ email }] }],
      from: { email: GMAIL_USER, name: 'Pavilion HTCC' },
      subject: '✅ Your Pavilion membership has been approved',
      content: [{ type: 'text/html', value: html }],
    }

    // Use Gmail SMTP directly via Deno TCP connection
    const conn = await Deno.connectTls({
      hostname: 'smtp.gmail.com',
      port: 465,
    })

    const send = async (text: string) => {
      await conn.write(encoder.encode(text + '\r\n'))
    }

    const read = async () => {
      const buf = new Uint8Array(1024)
      const n   = await conn.read(buf)
      return new TextDecoder().decode(buf.subarray(0, n ?? 0))
    }

    await read() // 220 greeting
    await send('EHLO pavilion-htcc.netlify.app')
    await read()
    await send('AUTH PLAIN ' + authB64)
    const authRes = await read()
    if (!authRes.startsWith('235')) throw new Error('Gmail auth failed: ' + authRes)

    await send(`MAIL FROM:<${GMAIL_USER}>`)
    await read()
    await send(`RCPT TO:<${email}>`)
    await read()
    await send('DATA')
    await read()

    const boundary = 'boundary_' + Date.now()
    const message = [
      `From: Pavilion HTCC <${GMAIL_USER}>`,
      `To: ${email}`,
      `Subject: Your Pavilion membership has been approved`,
      'MIME-Version: 1.0',
      `Content-Type: text/html; charset=UTF-8`,
      '',
      html,
      '.',
    ].join('\r\n')

    await send(message)
    const dataRes = await read()
    await send('QUIT')
    conn.close()

    if (!dataRes.includes('250')) throw new Error('Gmail send failed: ' + dataRes)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[send-approval-email] Error:', err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})