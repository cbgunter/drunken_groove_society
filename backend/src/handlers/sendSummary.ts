import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { ok, err } from '../lib/cors'
import { withAuth } from '../lib/auth'

const ses = new SESClient({ region: 'us-east-1' })
const FROM_EMAIL = process.env.FROM_EMAIL ?? ''
const CREW_EMAILS = process.env.CREW_EMAILS ?? ''

export const handler = withAuth(async (event) => {
  if (!FROM_EMAIL || !CREW_EMAILS) {
    return err('Email not configured', 503)
  }

  let body: { summary: string; sessionMonth: string }
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return err('Invalid JSON', 400)
  }

  const { summary, sessionMonth } = body
  if (!summary) return err('Missing summary', 400)

  const recipients = CREW_EMAILS.split(',').map((e) => e.trim()).filter(Boolean)

  await ses.send(
    new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: recipients },
      Message: {
        Subject: { Data: `DGS Meeting Notes — ${sessionMonth ?? 'Meeting'}` },
        Body: { Text: { Data: summary } },
      },
    }),
  )

  return ok({ sent: true })
})
