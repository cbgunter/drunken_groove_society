const DEFAULT_BADGE = '🎵'

// Returns the badge emoji if it's an actual pictographic emoji, otherwise the
// default. Guards against bad/out-of-band data where the emoji was flattened to
// ASCII placeholders like "??" (e.g. a non-UTF-8 manual write to DynamoDB).
export function safeBadgeEmoji(badge: string | undefined | null): string {
  return badge && /\p{Extended_Pictographic}/u.test(badge) ? badge : DEFAULT_BADGE
}
