// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title OnchainTypes
/// @notice Shared types and enums for the ONCHAIN protocol
library OnchainTypes {
    // =========================================================
    // Entry Types
    // =========================================================

    enum EntryType {
        POST,     // 0 — Top-level post
        COMMENT,  // 1 — Comment or reply to any entry
        QUOTE     // 2 — Quote referencing another entry
    }

    enum EntryStatus {
        ACTIVE,   // 0 — Visible and accessible
        DELETED,  // 1 — Deleted by author (tombstone remains)
        HIDDEN,   // 2 — Hidden by moderator
        PENDING,  // 3 — Awaiting moderation approval
        REJECTED  // 4 — Rejected by moderator
    }

    // =========================================================
    // Social Types
    // =========================================================

    enum ReactionType {
        LIKE,   // 0
        LOVE,   // 1
        LAUGH,  // 2
        WOW,    // 3
        SAD,    // 4
        ANGRY   // 5
    }

    // =========================================================
    // Moderation Types
    // =========================================================

    enum ModerationMode {
        OPEN,    // 0 — All content published immediately
        TRUSTED, // 1 — Trusted wallets publish immediately; others require approval
        STRICT,  // 2 — All content requires moderation approval
        EVENT    // 3 — Custom event mode (configurable)
    }

    enum ModerationAction {
        APPROVE,   // 0
        REJECT,    // 1
        HIDE,      // 2
        RESTORE,   // 3
        PIN,       // 4
        UNPIN,     // 5
        DELETE     // 6
    }

    enum UserRestriction {
        NONE,       // 0
        RESTRICTED, // 1 — Cannot post, comment, react
        BANNED      // 2 — Fully restricted
    }

    // =========================================================
    // Structs
    // =========================================================

    struct Entry {
        uint256 id;
        address author;
        EntryType entryType;
        uint256 parentId;      // 0 if none
        uint256 referenceId;   // 0 if none (used for quotes)
        string contentRef;     // IPFS CID or content hash
        uint256 createdAt;
        EntryStatus status;
        bool pinned;
    }

    struct Profile {
        address wallet;
        string metadataRef;    // IPFS CID pointing to profile JSON
        uint256 registeredAt;
        uint256 updatedAt;
        bool active;
    }

    struct ReactionState {
        bool hasReacted;
        ReactionType reactionType;
    }
}
