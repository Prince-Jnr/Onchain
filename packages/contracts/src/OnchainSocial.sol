// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OnchainTypes} from "./OnchainTypes.sol";
import {OnchainEntries} from "./OnchainEntries.sol";

/// @title OnchainSocial
/// @notice Social interaction layer for the ONCHAIN protocol.
///         Handles reactions, reposts, and on-chain follow records.
/// @dev Reactions and reposts are stored as mappings for O(1) lookup.
///      Counts are maintained as separate mappings for efficiency.
contract OnchainSocial is AccessControl, Pausable, ReentrancyGuard {
    using OnchainTypes for *;

    // =========================================================
    // Roles
    // =========================================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");

    // =========================================================
    // State — Reference to Entries contract
    // =========================================================

    OnchainEntries public immutable entriesContract;

    // =========================================================
    // State — Reactions
    // =========================================================

    // entryId => wallet => ReactionState
    mapping(uint256 => mapping(address => OnchainTypes.ReactionState)) private _reactions;

    // entryId => ReactionType => count
    mapping(uint256 => mapping(OnchainTypes.ReactionType => uint256)) public reactionCounts;

    // entryId => total reaction count
    mapping(uint256 => uint256) public totalReactionCount;

    // =========================================================
    // State — Reposts
    // =========================================================

    // wallet => entryId => hasReposted
    mapping(address => mapping(uint256 => bool)) private _reposts;

    // entryId => repost count
    mapping(uint256 => uint256) public repostCount;

    // wallet => array of reposted entry IDs (for profile display)
    mapping(address => uint256[]) private _repostedByUser;

    // =========================================================
    // State — Follows (on-chain record)
    // =========================================================

    // follower => followed => isFollowing
    mapping(address => mapping(address => bool)) private _follows;

    // wallet => follower count
    mapping(address => uint256) public followerCount;

    // wallet => following count
    mapping(address => uint256) public followingCount;

    // =========================================================
    // Events
    // =========================================================

    event ReactionAdded(
        uint256 indexed entryId,
        address indexed user,
        OnchainTypes.ReactionType reactionType,
        uint256 timestamp
    );

    event ReactionRemoved(
        uint256 indexed entryId,
        address indexed user,
        OnchainTypes.ReactionType previousType,
        uint256 timestamp
    );

    event ReactionChanged(
        uint256 indexed entryId,
        address indexed user,
        OnchainTypes.ReactionType oldType,
        OnchainTypes.ReactionType newType,
        uint256 timestamp
    );

    event Reposted(
        uint256 indexed entryId,
        address indexed user,
        uint256 timestamp
    );

    event Unreposted(
        uint256 indexed entryId,
        address indexed user,
        uint256 timestamp
    );

    event Followed(
        address indexed follower,
        address indexed followed,
        uint256 timestamp
    );

    event Unfollowed(
        address indexed follower,
        address indexed followed,
        uint256 timestamp
    );

    // =========================================================
    // Errors
    // =========================================================

    error AlreadyReacted(uint256 entryId, address user);
    error NotReacted(uint256 entryId, address user);
    error AlreadyReposted(uint256 entryId, address user);
    error NotReposted(uint256 entryId, address user);
    error AlreadyFollowing(address follower, address followed);
    error NotFollowing(address follower, address followed);
    error CannotFollowSelf();
    error CannotReactToOwnPost();
    error UserRestricted(address user);
    error UserBanned(address user);
    error EntryNotReactable(uint256 entryId);

    // =========================================================
    // Constructor
    // =========================================================

    constructor(address admin, address entriesContractAddress) {
        require(admin != address(0), "Invalid admin");
        require(entriesContractAddress != address(0), "Invalid entries contract");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        entriesContract = OnchainEntries(entriesContractAddress);
    }

    // =========================================================
    // Reactions
    // =========================================================

    /// @notice Add a reaction to an entry
    /// @param entryId The entry to react to
    /// @param reactionType The type of reaction
    function addReaction(uint256 entryId, OnchainTypes.ReactionType reactionType)
        external
        whenNotPaused
        nonReentrant
    {
        _validateNotRestricted(msg.sender);

        // Entry must be active
        if (!entriesContract.isEntryActive(entryId)) {
            revert EntryNotReactable(entryId);
        }

        OnchainTypes.ReactionState storage state = _reactions[entryId][msg.sender];
        if (state.hasReacted) {
            revert AlreadyReacted(entryId, msg.sender);
        }

        state.hasReacted = true;
        state.reactionType = reactionType;
        reactionCounts[entryId][reactionType]++;
        totalReactionCount[entryId]++;

        emit ReactionAdded(entryId, msg.sender, reactionType, block.timestamp);
    }

    /// @notice Remove a reaction from an entry
    /// @param entryId The entry to remove reaction from
    function removeReaction(uint256 entryId)
        external
        whenNotPaused
        nonReentrant
    {
        OnchainTypes.ReactionState storage state = _reactions[entryId][msg.sender];
        if (!state.hasReacted) {
            revert NotReacted(entryId, msg.sender);
        }

        OnchainTypes.ReactionType previousType = state.reactionType;
        state.hasReacted = false;

        // Underflow protection (should never underflow in practice)
        if (reactionCounts[entryId][previousType] > 0) {
            reactionCounts[entryId][previousType]--;
        }
        if (totalReactionCount[entryId] > 0) {
            totalReactionCount[entryId]--;
        }

        emit ReactionRemoved(entryId, msg.sender, previousType, block.timestamp);
    }

    /// @notice Change a reaction type (removes old, adds new in single tx)
    /// @param entryId The entry
    /// @param newReactionType The new reaction type
    function changeReaction(uint256 entryId, OnchainTypes.ReactionType newReactionType)
        external
        whenNotPaused
        nonReentrant
    {
        _validateNotRestricted(msg.sender);

        OnchainTypes.ReactionState storage state = _reactions[entryId][msg.sender];
        if (!state.hasReacted) {
            revert NotReacted(entryId, msg.sender);
        }

        OnchainTypes.ReactionType oldType = state.reactionType;
        require(oldType != newReactionType, "Same reaction type");

        // Update counts
        if (reactionCounts[entryId][oldType] > 0) {
            reactionCounts[entryId][oldType]--;
        }
        reactionCounts[entryId][newReactionType]++;
        state.reactionType = newReactionType;

        emit ReactionChanged(entryId, msg.sender, oldType, newReactionType, block.timestamp);
    }

    // =========================================================
    // Reposts
    // =========================================================

    /// @notice Repost an entry
    /// @param entryId The entry to repost
    function repost(uint256 entryId)
        external
        whenNotPaused
        nonReentrant
    {
        _validateNotRestricted(msg.sender);

        if (!entriesContract.isEntryActive(entryId)) {
            revert EntryNotReactable(entryId);
        }

        // Verify it's a top-level post (cannot repost comments)
        OnchainTypes.Entry memory entry = entriesContract.getEntry(entryId);
        require(
            entry.entryType == OnchainTypes.EntryType.POST ||
            entry.entryType == OnchainTypes.EntryType.QUOTE,
            "Can only repost posts and quotes"
        );

        if (_reposts[msg.sender][entryId]) {
            revert AlreadyReposted(entryId, msg.sender);
        }

        _reposts[msg.sender][entryId] = true;
        repostCount[entryId]++;
        _repostedByUser[msg.sender].push(entryId);

        emit Reposted(entryId, msg.sender, block.timestamp);
    }

    /// @notice Unrepost an entry
    /// @param entryId The entry to unrepost
    function unrepost(uint256 entryId)
        external
        whenNotPaused
        nonReentrant
    {
        if (!_reposts[msg.sender][entryId]) {
            revert NotReposted(entryId, msg.sender);
        }

        _reposts[msg.sender][entryId] = false;
        if (repostCount[entryId] > 0) {
            repostCount[entryId]--;
        }

        // Note: We don't remove from _repostedByUser array to avoid O(n) operation.
        // The indexer filters based on current repost state.

        emit Unreposted(entryId, msg.sender, block.timestamp);
    }

    // =========================================================
    // Following
    // =========================================================

    /// @notice Follow a wallet address
    /// @param followed The address to follow
    function follow(address followed)
        external
        whenNotPaused
        nonReentrant
    {
        if (followed == msg.sender) revert CannotFollowSelf();
        require(followed != address(0), "Invalid address");

        if (_follows[msg.sender][followed]) {
            revert AlreadyFollowing(msg.sender, followed);
        }

        _follows[msg.sender][followed] = true;
        followerCount[followed]++;
        followingCount[msg.sender]++;

        emit Followed(msg.sender, followed, block.timestamp);
    }

    /// @notice Unfollow a wallet address
    /// @param followed The address to unfollow
    function unfollow(address followed)
        external
        whenNotPaused
        nonReentrant
    {
        if (!_follows[msg.sender][followed]) {
            revert NotFollowing(msg.sender, followed);
        }

        _follows[msg.sender][followed] = false;
        if (followerCount[followed] > 0) followerCount[followed]--;
        if (followingCount[msg.sender] > 0) followingCount[msg.sender]--;

        emit Unfollowed(msg.sender, followed, block.timestamp);
    }

    // =========================================================
    // Pause
    // =========================================================

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // =========================================================
    // View Functions
    // =========================================================

    /// @notice Get user's reaction state for an entry
    function getUserReaction(uint256 entryId, address user)
        external
        view
        returns (bool hasReacted, OnchainTypes.ReactionType reactionType)
    {
        OnchainTypes.ReactionState storage state = _reactions[entryId][user];
        return (state.hasReacted, state.reactionType);
    }

    /// @notice Get all reaction counts for an entry
    function getReactionCounts(uint256 entryId)
        external
        view
        returns (uint256[6] memory counts)
    {
        counts[0] = reactionCounts[entryId][OnchainTypes.ReactionType.LIKE];
        counts[1] = reactionCounts[entryId][OnchainTypes.ReactionType.LOVE];
        counts[2] = reactionCounts[entryId][OnchainTypes.ReactionType.LAUGH];
        counts[3] = reactionCounts[entryId][OnchainTypes.ReactionType.WOW];
        counts[4] = reactionCounts[entryId][OnchainTypes.ReactionType.SAD];
        counts[5] = reactionCounts[entryId][OnchainTypes.ReactionType.ANGRY];
    }

    /// @notice Check if a user has reposted an entry
    function hasReposted(address user, uint256 entryId) external view returns (bool) {
        return _reposts[user][entryId];
    }

    /// @notice Check if a user is following another
    function isFollowing(address follower, address followed) external view returns (bool) {
        return _follows[follower][followed];
    }

    // =========================================================
    // Internal Helpers
    // =========================================================

    function _validateNotRestricted(address user) internal view {
        OnchainTypes.UserRestriction restriction = entriesContract.userRestrictions(user);
        if (restriction == OnchainTypes.UserRestriction.BANNED) {
            revert UserBanned(user);
        }
        if (restriction == OnchainTypes.UserRestriction.RESTRICTED) {
            revert UserRestricted(user);
        }
    }
}
