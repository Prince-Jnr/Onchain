// Generated ABIs for ONCHAIN contracts
// Keep in sync with compiled contracts

export const ONCHAIN_ENTRIES_ABI = [
  // Events
  {
    type: 'event',
    name: 'EntryCreated',
    inputs: [
      { name: 'entryId', type: 'uint256', indexed: true },
      { name: 'author', type: 'address', indexed: true },
      { name: 'entryType', type: 'uint8', indexed: false },
      { name: 'parentId', type: 'uint256', indexed: true },
      { name: 'referenceId', type: 'uint256', indexed: false },
      { name: 'contentRef', type: 'string', indexed: false },
      { name: 'status', type: 'uint8', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EntryDeleted',
    inputs: [
      { name: 'entryId', type: 'uint256', indexed: true },
      { name: 'author', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EntryStatusChanged',
    inputs: [
      { name: 'entryId', type: 'uint256', indexed: true },
      { name: 'oldStatus', type: 'uint8', indexed: false },
      { name: 'newStatus', type: 'uint8', indexed: false },
      { name: 'changedBy', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EntryPinned',
    inputs: [
      { name: 'entryId', type: 'uint256', indexed: true },
      { name: 'pinned', type: 'bool', indexed: false },
      { name: 'by', type: 'address', indexed: true },
    ],
  },
  // Write functions
  {
    type: 'function',
    name: 'createPost',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'contentRef', type: 'string' }],
    outputs: [{ name: 'entryId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'createComment',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'parentId', type: 'uint256' },
      { name: 'contentRef', type: 'string' },
    ],
    outputs: [{ name: 'entryId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'createQuote',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'referenceId', type: 'uint256' },
      { name: 'contentRef', type: 'string' },
    ],
    outputs: [{ name: 'entryId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'deleteEntry',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'entryId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approveEntry',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'entryId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'rejectEntry',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'entryId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'hideEntry',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'entryId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'restoreEntry',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'entryId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setPinned',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'entryId', type: 'uint256' },
      { name: 'pinned', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setUserRestriction',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'restriction', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setModerationMode',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'mode', type: 'uint8' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'pause',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'unpause',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  // Read functions
  {
    type: 'function',
    name: 'getEntry',
    stateMutability: 'view',
    inputs: [{ name: 'entryId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'author', type: 'address' },
          { name: 'entryType', type: 'uint8' },
          { name: 'parentId', type: 'uint256' },
          { name: 'referenceId', type: 'uint256' },
          { name: 'contentRef', type: 'string' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'pinned', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getEntriesByAuthor',
    stateMutability: 'view',
    inputs: [
      { name: 'author', type: 'address' },
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [
      { name: 'ids', type: 'uint256[]' },
      { name: 'total', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'totalEntries',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'isEntryActive',
    stateMutability: 'view',
    inputs: [{ name: 'entryId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'moderationMode',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'commentCount',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'userRestrictions',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const

export const ONCHAIN_SOCIAL_ABI = [
  // Events
  {
    type: 'event',
    name: 'ReactionAdded',
    inputs: [
      { name: 'entryId', type: 'uint256', indexed: true },
      { name: 'user', type: 'address', indexed: true },
      { name: 'reactionType', type: 'uint8', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ReactionRemoved',
    inputs: [
      { name: 'entryId', type: 'uint256', indexed: true },
      { name: 'user', type: 'address', indexed: true },
      { name: 'previousType', type: 'uint8', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Reposted',
    inputs: [
      { name: 'entryId', type: 'uint256', indexed: true },
      { name: 'user', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Unreposted',
    inputs: [
      { name: 'entryId', type: 'uint256', indexed: true },
      { name: 'user', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Followed',
    inputs: [
      { name: 'follower', type: 'address', indexed: true },
      { name: 'followed', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Unfollowed',
    inputs: [
      { name: 'follower', type: 'address', indexed: true },
      { name: 'followed', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  // Write functions
  {
    type: 'function',
    name: 'addReaction',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'entryId', type: 'uint256' },
      { name: 'reactionType', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'removeReaction',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'entryId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'changeReaction',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'entryId', type: 'uint256' },
      { name: 'newReactionType', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'repost',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'entryId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'unrepost',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'entryId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'follow',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'followed', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'unfollow',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'followed', type: 'address' }],
    outputs: [],
  },
  // Read functions
  {
    type: 'function',
    name: 'getUserReaction',
    stateMutability: 'view',
    inputs: [
      { name: 'entryId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [
      { name: 'hasReacted', type: 'bool' },
      { name: 'reactionType', type: 'uint8' },
    ],
  },
  {
    type: 'function',
    name: 'getReactionCounts',
    stateMutability: 'view',
    inputs: [{ name: 'entryId', type: 'uint256' }],
    outputs: [{ name: 'counts', type: 'uint256[6]' }],
  },
  {
    type: 'function',
    name: 'hasReposted',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'entryId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'isFollowing',
    stateMutability: 'view',
    inputs: [
      { name: 'follower', type: 'address' },
      { name: 'followed', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'repostCount',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'followerCount',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'followingCount',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export const ONCHAIN_PROFILES_ABI = [
  {
    type: 'event',
    name: 'ProfileRegistered',
    inputs: [
      { name: 'wallet', type: 'address', indexed: true },
      { name: 'metadataRef', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ProfileUpdated',
    inputs: [
      { name: 'wallet', type: 'address', indexed: true },
      { name: 'oldMetadataRef', type: 'string', indexed: false },
      { name: 'newMetadataRef', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'registerProfile',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'metadataRef', type: 'string' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'updateProfile',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'metadataRef', type: 'string' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getProfile',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'wallet', type: 'address' },
          { name: 'metadataRef', type: 'string' },
          { name: 'registeredAt', type: 'uint256' },
          { name: 'updatedAt', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'hasProfile',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'totalProfiles',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export const ONCHAIN_MODERATION_ABI = [
  {
    type: 'function',
    name: 'reportEntry',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'entryId', type: 'uint256' },
      { name: 'category', type: 'uint8' },
    ],
    outputs: [{ name: 'reportId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'reportWallet',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'category', type: 'uint8' },
    ],
    outputs: [{ name: 'reportId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'updateReportStatus',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'reportId', type: 'uint256' },
      { name: 'newStatus', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'addModerator',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'moderator', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'removeModerator',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'moderator', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'addTrustedUser',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'removeTrustedUser',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setModerationMode',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'mode', type: 'uint8' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'moderationMode',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'isModerator',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'isAdmin',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'isTrusted',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getReport',
    stateMutability: 'view',
    inputs: [{ name: 'reportId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'reporter', type: 'address' },
          { name: 'targetEntryId', type: 'uint256' },
          { name: 'targetWallet', type: 'address' },
          { name: 'category', type: 'uint8' },
          { name: 'status', type: 'uint8' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'resolvedAt', type: 'uint256' },
          { name: 'resolvedBy', type: 'address' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'totalReports',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const
