#!/usr/bin/env node
// Provisions the fixed 3-person crew as Cognito users.
//
// Usage:
//   node scripts/bootstrap-cognito-users.mjs --user-pool-id us-east-1_XXXX [--apply]
//
// Dry-run by default — pass --apply to actually create users / set passwords.
// Idempotent: re-running skips any user that already exists.
//
// Prints each generated password to stdout ONLY. Relay it out-of-band
// (never commit it, never put it in a file this script writes) — each
// person can change it later via Cognito's forgot-password flow.

import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { randomBytes } from 'node:crypto'

// Roster names must exactly match HISTORIC_ROSTER in
// frontend/src/utils/historicSeed.ts and the crew's Entry.selector values —
// see the roster-drift guard in App.tsx.
const ROSTER = ['Corey', 'Doug', 'Mike']

// Same order as CrewEmails in samconfig.toml.
const DEFAULT_EMAILS = [
  'cbgunter@gmail.com',
  'doug32674@yahoo.com',
  'michael.ramirez.dev@gmail.com',
]

function parseArgs(argv) {
  const args = { apply: false, region: 'us-east-1' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') args.apply = true
    else if (a === '--user-pool-id') args.userPoolId = argv[++i]
    else if (a === '--region') args.region = argv[++i]
    else if (a === '--emails') args.emails = argv[++i].split(',').map((s) => s.trim())
    else {
      console.error(`Unknown argument: ${a}`)
      process.exit(1)
    }
  }
  if (!args.userPoolId) {
    console.error('Missing required --user-pool-id (see the UserPoolId stack output)')
    process.exit(1)
  }
  return args
}

// 16 chars, avoids visually ambiguous characters (0/O, 1/l/I).
const PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*'
function generatePassword(length = 16) {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length]
  }
  return out
}

function attr(user, name) {
  return user.UserAttributes?.find((a) => a.Name === name)?.Value
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const emails = args.emails ?? DEFAULT_EMAILS
  if (emails.length !== ROSTER.length) {
    console.error(`Expected ${ROSTER.length} emails (one per roster member), got ${emails.length}`)
    process.exit(1)
  }

  const client = new CognitoIdentityProviderClient({ region: args.region })
  const crew = ROSTER.map((name, i) => ({ name, email: emails[i] }))

  console.log(args.apply ? '⚡ APPLY MODE — this will create users and set passwords\n' : '🔍 DRY RUN — pass --apply to make changes\n')

  const results = []

  for (const { name, email } of crew) {
    let existing
    try {
      existing = await client.send(new AdminGetUserCommand({ UserPoolId: args.userPoolId, Username: name }))
    } catch (err) {
      if (err.name !== 'UserNotFoundException') throw err
    }

    if (existing) {
      const sub = attr(existing, 'sub')
      console.log(`  ${name.padEnd(8)} already exists — status ${existing.UserStatus}, sub ${sub}`)
      results.push({ name, sub, created: false })
      continue
    }

    if (!args.apply) {
      console.log(`  ${name.padEnd(8)} would be created (${email})`)
      results.push({ name, sub: '<pending>', created: false })
      continue
    }

    const password = generatePassword()

    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: args.userPoolId,
        Username: name,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'name', Value: name },
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
        ],
      }),
    )

    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: args.userPoolId,
        Username: name,
        Password: password,
        Permanent: true, // avoids the NEW_PASSWORD_REQUIRED challenge on first login
      }),
    )

    const created = await client.send(new AdminGetUserCommand({ UserPoolId: args.userPoolId, Username: name }))
    const sub = attr(created, 'sub')

    console.log(`  ${name.padEnd(8)} created — sub ${sub}`)
    console.log(`             password: ${password}`)
    results.push({ name, sub, created: true })
  }

  console.log('\nname → sub (needed for scripts/migrate-notes.mjs):')
  for (const r of results) {
    console.log(`  ${r.name.padEnd(8)} ${r.sub}`)
  }

  if (!args.apply) {
    console.log('\nNothing changed. Re-run with --apply to create users.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
