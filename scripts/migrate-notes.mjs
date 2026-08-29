#!/usr/bin/env node
// Merges legacy per-device notes (SK: NOTES#<nanoid>, grouped by userName)
// into a single record per Cognito user (SK: NOTES#<sub>).
//
// Usage:
//   node scripts/migrate-notes.mjs --user-pool-id us-east-1_XXXX [--apply]
//
// Dry-run by default — always writes a JSON backup of every scanned item
// before doing anything else, even in dry-run. Pass --apply to mutate.
//
// Idempotent: a group that's already just NOTES#<sub> is skipped, so it's
// safe to re-run after the auth flip to sweep up stragglers.

import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'
import { writeFileSync } from 'node:fs'

function parseArgs(argv) {
  const args = { apply: false, region: 'us-east-1', table: 'drunken-groove-society' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') args.apply = true
    else if (a === '--user-pool-id') args.userPoolId = argv[++i]
    else if (a === '--region') args.region = argv[++i]
    else if (a === '--table') args.table = argv[++i]
    else if (a === '--backup') args.backup = argv[++i]
    else {
      console.error(`Unknown argument: ${a}`)
      process.exit(1)
    }
  }
  if (!args.userPoolId) {
    console.error('Missing required --user-pool-id (see the UserPoolId stack output)')
    process.exit(1)
  }
  if (!args.backup) {
    args.backup = `./dgs-notes-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  }
  return args
}

function canonical(name) {
  return (name ?? '').trim().toLowerCase()
}

// A record is "empty" for an entry only if it has NO content at all for it —
// including pickerNote and trackReactions, which are real stored content
// (see MeetingView) that a narrower rule would silently drop.
function isEmptyEntry(notes) {
  if (!notes) return true
  const hasAlbumNotes = !!notes.albumNotes?.trim()
  const hasTrackNotes = Object.values(notes.trackNotes ?? {}).some((v) => v?.trim())
  const hasRating = (notes.rating ?? 0) > 0
  const hasPickerNote = !!notes.pickerNote?.trim()
  const hasReactions = Object.keys(notes.trackReactions ?? {}).length > 0
  return !hasAlbumNotes && !hasTrackNotes && !hasRating && !hasPickerNote && !hasReactions
}

async function buildNameToSubMap(cognito, userPoolId) {
  const map = new Map()
  let paginationToken
  do {
    const res = await cognito.send(
      new ListUsersCommand({ UserPoolId: userPoolId, PaginationToken: paginationToken }),
    )
    for (const user of res.Users ?? []) {
      const sub = user.Attributes?.find((a) => a.Name === 'sub')?.Value
      const name = user.Attributes?.find((a) => a.Name === 'name')?.Value
      const username = user.Username
      if (!sub) continue
      for (const key of [canonical(name), canonical(username)]) {
        if (!key) continue
        if (map.has(key) && map.get(key) !== sub) {
          throw new Error(`Ambiguous name → sub mapping for "${key}": both ${map.get(key)} and ${sub}`)
        }
        map.set(key, sub)
      }
    }
    paginationToken = res.PaginationToken
  } while (paginationToken)
  return map
}

async function scanNotesItems(ddb, table) {
  const items = []
  let exclusiveStartKey
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: table,
        FilterExpression: 'begins_with(SK, :p)',
        ExpressionAttributeValues: { ':p': 'NOTES#' },
        ExclusiveStartKey: exclusiveStartKey,
      }),
    )
    items.push(...(res.Items ?? []))
    exclusiveStartKey = res.LastEvaluatedKey
  } while (exclusiveStartKey)
  return items
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const cognito = new CognitoIdentityProviderClient({ region: args.region })
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: args.region }))

  console.log(args.apply ? '⚡ APPLY MODE — this will mutate DynamoDB\n' : '🔍 DRY RUN — pass --apply to make changes\n')

  const nameToSub = await buildNameToSubMap(cognito, args.userPoolId)
  console.log('name → sub map:')
  for (const [k, v] of nameToSub) console.log(`  ${k.padEnd(12)} ${v}`)

  console.log('\nScanning for NOTES# items…')
  const items = await scanNotesItems(ddb, args.table)
  console.log(`Found ${items.length} items.`)

  writeFileSync(args.backup, JSON.stringify(items, null, 2))
  console.log(`Backup written to ${args.backup}`)

  // Group per-partition (PK) by canonical userName. SK is scoped to one
  // SESSION#<month>, so grouping must not cross partitions.
  const groups = new Map() // `${PK}|${canonicalName}` -> items[]
  const needsReview = []

  for (const item of items) {
    const key = canonical(item.userName)
    const sub = nameToSub.get(key)
    if (!sub) {
      needsReview.push(item)
      continue
    }
    const groupKey = `${item.PK}|${key}`
    if (!groups.has(groupKey)) groups.set(groupKey, { sub, canonicalName: item.userName, items: [] })
    groups.get(groupKey).items.push(item)
  }

  if (needsReview.length > 0) {
    console.log(`\n⚠️  ${needsReview.length} item(s) could not be matched to a Cognito user — needs manual review:`)
    for (const item of needsReview) {
      console.log(`  ${item.PK} / ${item.SK}  userName=${JSON.stringify(item.userName)}`)
    }
  }

  let merged = 0
  let archived = 0
  let skipped = 0

  for (const [groupKey, group] of groups) {
    const { sub, items: groupItems } = group
    const targetSk = `NOTES#${sub}`

    // Already fully migrated (only item is the target itself) — skip.
    if (groupItems.length === 1 && groupItems[0].SK === targetSk) {
      skipped++
      continue
    }

    const pk = groupItems[0].PK
    const legacyItems = groupItems.filter((i) => i.SK !== targetSk)
    const existingTarget = groupItems.find((i) => i.SK === targetSk)

    // Newest-first by updatedAt (ISO-8601 strings sort lexicographically = chronologically).
    const candidates = [...groupItems].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))

    const mergedEntries = {}
    const allEntryIds = new Set()
    for (const it of candidates) for (const eid of Object.keys(it.entries ?? {})) allEntryIds.add(eid)

    console.log(`\n${pk}  →  ${targetSk}  (${group.canonicalName})`)
    for (const entryId of allEntryIds) {
      const withEntry = candidates.filter((i) => i.entries?.[entryId])
      const nonEmpty = withEntry.filter((i) => !isEmptyEntry(i.entries[entryId]))
      const winner = (nonEmpty[0] ?? withEntry[0])
      mergedEntries[entryId] = winner.entries[entryId]

      const loser = withEntry.find((i) => i !== winner)
      const winnerLabel = `${winner.SK} (updatedAt ${winner.updatedAt ?? '?'}${nonEmpty.length ? '' : ', empty'})`
      const loserLabel = loser ? `, skipped ${loser.SK} (updatedAt ${loser.updatedAt ?? '?'})` : ''
      console.log(`  entry ${entryId} ← ${winnerLabel}${loserLabel}`)
    }

    const now = new Date().toISOString()
    const mergedItem = {
      PK: pk,
      SK: targetSk,
      userId: sub,
      userName: group.canonicalName,
      entries: mergedEntries,
      updatedAt: candidates.reduce((max, i) => ((i.updatedAt ?? '') > max ? i.updatedAt : max), ''),
      ttl: Math.floor(Date.now() / 1000) + 5 * 365 * 24 * 60 * 60,
      migratedFrom: legacyItems.map((i) => i.SK),
      migratedAt: now,
    }

    if (args.apply) {
      // 1. Write the merged record.
      await ddb.send(new PutCommand({ TableName: args.table, Item: mergedItem }))
      // 2. Archive each legacy item under a prefix the API never reads.
      for (const legacy of legacyItems) {
        await ddb.send(
          new PutCommand({
            TableName: args.table,
            Item: {
              ...legacy,
              SK: `ARCHIVED_NOTES#${legacy.SK.replace(/^NOTES#/, '')}`,
              archivedAt: now,
              archivedFromSK: legacy.SK,
              mergedIntoSK: targetSk,
            },
          }),
        )
      }
      // 3. Delete the legacy originals — mandatory, not optional. If these
      //    survive, getNotes still returns them and the merge is a no-op.
      for (const legacy of legacyItems) {
        await ddb.send(new DeleteCommand({ TableName: args.table, Key: { PK: legacy.PK, SK: legacy.SK } }))
      }
      void existingTarget // already folded into candidates/merge above
    }

    merged++
    archived += legacyItems.length
  }

  console.log(`\n${args.apply ? 'Applied' : 'Would apply'}: ${merged} group(s) merged, ${archived} item(s) archived, ${skipped} already-migrated group(s) skipped.`)
  if (needsReview.length > 0) {
    console.log(`${needsReview.length} item(s) need manual review (see above) — not touched.`)
  }
  if (!args.apply) {
    console.log('\nNothing changed. Re-run with --apply to write.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
