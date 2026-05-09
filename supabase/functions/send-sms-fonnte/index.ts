import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const FONTNE_MESSAGE_TEMPLATE = `SCIENTIA

Hello,

Your login OTP is: {{otp}}

This OTP expires in 5 minutes.
Do NOT share it with anyone.

- SCIENTIA Team`

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return new Response('Expected application/json', { status: 400 })
  }

  const event = await req.json().catch(() => null)

  if (!event) {
    return new Response('Invalid JSON body', { status: 400 })
  }

  let phone: string | undefined = event?.user?.phone
  const otp: string | undefined = event?.sms?.otp

  if (!phone || !otp) {
    return new Response('Missing phone or otp in hook payload', { status: 400 })
  }

  // Normalize phone number - remove any formatting
  phone = phone.replace(/[\s\-()]/g, '')
  // Ensure country code is present
  if (!phone.startsWith('+')) {
    phone = '+' + phone
  }

  const fonnteToken = Deno.env.get('FONNTE_TOKEN')
  const fonnteEndpoint = Deno.env.get('FONNTE_ENDPOINT')

  if (!fonnteToken || !fonnteEndpoint) {
    return new Response('Server misconfigured', { status: 500 })
  }

  // Custom template from user
  const message = FONTNE_MESSAGE_TEMPLATE.replace('{{otp}}', otp)

  const formData = new FormData()
  formData.append('target', phone)
  formData.append('message', message)
  formData.append('countryCode', '0')

  try {
    const fonnteRes = await fetch(fonnteEndpoint, {
      method: 'POST',
      headers: {
        Authorization: fonnteToken,
      },
      body: formData,
    })

    const responseText = await fonnteRes.text().catch(() => 'Failed to read response')

    if (!fonnteRes.ok) {
      return new Response(`Fonnte failed: ${responseText}`, { status: 502 })
    }

    return new Response(JSON.stringify({ ok: true, phone }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response('Internal server error', { status: 500 })
  }
})