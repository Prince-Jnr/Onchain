import assert from 'node:assert/strict'
import test from 'node:test'
import { activeAfterEvent, reactionAfterEvent } from './projection-state.js'

test('reaction events project and reverse to the exact previous state', () => {
  assert.equal(reactionAfterEvent({ name: 'ReactionAdded', reactionType: 2 }, false), 'LAUGH')
  assert.equal(reactionAfterEvent({ name: 'ReactionAdded', reactionType: 2 }, true), null)
  assert.equal(reactionAfterEvent({ name: 'ReactionRemoved', previousType: 4 }, false), null)
  assert.equal(reactionAfterEvent({ name: 'ReactionRemoved', previousType: 4 }, true), 'SAD')
  assert.equal(reactionAfterEvent({ name: 'ReactionChanged', oldType: 0, newType: 5 }, false), 'ANGRY')
  assert.equal(reactionAfterEvent({ name: 'ReactionChanged', oldType: 0, newType: 5 }, true), 'LIKE')
})

test('repost and follow events reverse to their prior active state', () => {
  assert.equal(activeAfterEvent('Reposted', false), true)
  assert.equal(activeAfterEvent('Reposted', true), false)
  assert.equal(activeAfterEvent('Unreposted', false), false)
  assert.equal(activeAfterEvent('Unreposted', true), true)
  assert.equal(activeAfterEvent('Followed', false), true)
  assert.equal(activeAfterEvent('Unfollowed', true), true)
})
