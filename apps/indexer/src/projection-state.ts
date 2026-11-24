export const reactionNames = ['LIKE', 'LOVE', 'LAUGH', 'WOW', 'SAD', 'ANGRY'] as const
export type ReactionName = typeof reactionNames[number]

type ReactionEvent =
  | { name: 'ReactionAdded'; reactionType: number }
  | { name: 'ReactionRemoved'; previousType: number }
  | { name: 'ReactionChanged'; oldType: number; newType: number }

export function reactionAfterEvent(event: ReactionEvent, reversed: boolean): ReactionName | null {
  const type = event.name === 'ReactionAdded'
    ? reversed ? null : event.reactionType
    : event.name === 'ReactionRemoved'
      ? reversed ? event.previousType : null
      : reversed ? event.oldType : event.newType
  if (type === null) return null
  const reaction = reactionNames[type]
  if (!reaction) throw new Error(`Invalid reaction type: ${type}`)
  return reaction
}

export function activeAfterEvent(eventName: 'Reposted' | 'Unreposted' | 'Followed' | 'Unfollowed', reversed: boolean) {
  return eventName === 'Reposted' || eventName === 'Followed' ? !reversed : reversed
}
