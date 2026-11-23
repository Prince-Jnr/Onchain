// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OnchainTypes} from "./OnchainTypes.sol";

/// @title OnchainEntries
/// @notice Core entry management for the ONCHAIN social protocol.
///         Handles posts, comments, and quotes. Each entry stores a
///         content reference (IPFS CID) rather than raw content.
/// @dev Social interactions (reactions, reposts) live in OnchainSocial.
///      Moderation actions (hide, pin, approve) live in OnchainModeration.
contract OnchainEntries is AccessControl, Pausable, ReentrancyGuard {
    using OnchainTypes for *;

    // =========================================================
    // Roles
    // =========================================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");
    bytes32 public constant TRUSTED_ROLE = keccak256("TRUSTED_ROLE");

    // =========================================================
    // State
    // =========================================================

    uint256 private _nextEntryId;

    // entryId => Entry
    mapping(uint256 => OnchainTypes.Entry) private _entries;

    // author => array of entry IDs
    mapping(address => uint256[]) private _entriesByAuthor;

    // parentId => array of child entry IDs
    mapping(uint256 => uint256[]) private _childEntries;

    // entryId => count of direct children
    mapping(uint256 => uint256) public commentCount;

    // address => UserRestriction
    mapping(address => OnchainTypes.UserRestriction) public userRestrictions;

    // Moderation mode (synced from OnchainModeration via update)
    OnchainTypes.ModerationMode public moderationMode;

    // Max content reference length in bytes
    uint256 public maxContentRefLength = 512;

    // =========================================================
    // Events
    // =========================================================

    event EntryCreated(
        uint256 indexed entryId,
        address indexed author,
        OnchainTypes.EntryType entryType,
        uint256 indexed parentId,
        uint256 referenceId,
        string contentRef,
        OnchainTypes.EntryStatus status,
        uint256 timestamp
    );

    event EntryDeleted(
        uint256 indexed entryId,
        address indexed author,
        uint256 timestamp
    );

    event EntryStatusChanged(
        uint256 indexed entryId,
        OnchainTypes.EntryStatus oldStatus,
        OnchainTypes.EntryStatus newStatus,
        address indexed changedBy,
        uint256 timestamp
    );

    event EntryPinned(uint256 indexed entryId, bool pinned, address indexed by);

    event UserRestrictionChanged(
        address indexed user,
        OnchainTypes.UserRestriction restriction,
        address indexed changedBy
    );

    event ModerationModeChanged(
        OnchainTypes.ModerationMode oldMode,
        OnchainTypes.ModerationMode newMode,
        address indexed changedBy
    );

    event MaxContentRefLengthChanged(uint256 oldLength, uint256 newLength);

    // =========================================================
    // Errors
    // =========================================================

    error EntryNotFound(uint256 entryId);
    error EntryNotActive(uint256 entryId);
    error EntryAlreadyDeleted(uint256 entryId);
    error NotEntryAuthor(uint256 entryId, address caller);
    error EmptyContentRef();
    error ContentRefTooLong(uint256 length, uint256 maxLength);
    error InvalidEntryType();
    error UserRestricted(address user);
    error UserBanned(address user);
    error InvalidParentEntry(uint256 parentId);
    error InvalidReferenceEntry(uint256 referenceId);
    error CannotDeleteModeratorsEntry();
    error Unauthorized();

    // =========================================================
    // Constructor
    // =========================================================

    constructor(address admin) {
        require(admin != address(0), "Invalid admin address");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _nextEntryId = 1; // Start at 1, 0 means "no parent"
    }

    // =========================================================
    // Entry Creation
    // =========================================================

    /// @notice Create a new post (top-level entry)
    /// @param contentRef IPFS CID or content hash reference
    function createPost(string calldata contentRef)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 entryId)
    {
        _validateContentRef(contentRef);
        _validateNotRestricted(msg.sender);

        entryId = _createEntry(
            msg.sender,
            OnchainTypes.EntryType.POST,
            0,   // no parent
            0,   // no reference
            contentRef
        );
    }

    /// @notice Create a comment or reply on an existing entry
    /// @param parentId The entry being replied to
    /// @param contentRef IPFS CID or content hash reference
    function createComment(uint256 parentId, string calldata contentRef)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 entryId)
    {
        _validateContentRef(contentRef);
        _validateNotRestricted(msg.sender);
        _validateParentEntry(parentId);

        entryId = _createEntry(
            msg.sender,
            OnchainTypes.EntryType.COMMENT,
            parentId,
            0,
            contentRef
        );

        commentCount[parentId]++;
        _childEntries[parentId].push(entryId);
    }

    /// @notice Create a quote post referencing an existing entry
    /// @param referenceId The entry being quoted
    /// @param contentRef IPFS CID or content hash reference
    function createQuote(uint256 referenceId, string calldata contentRef)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 entryId)
    {
        _validateContentRef(contentRef);
        _validateNotRestricted(msg.sender);

        // Reference must exist and be accessible
        if (referenceId == 0 || referenceId >= _nextEntryId) {
            revert InvalidReferenceEntry(referenceId);
        }
        OnchainTypes.Entry storage ref = _entries[referenceId];
        if (ref.author == address(0)) revert EntryNotFound(referenceId);
        if (ref.status == OnchainTypes.EntryStatus.DELETED) {
            revert InvalidReferenceEntry(referenceId);
        }

        entryId = _createEntry(
            msg.sender,
            OnchainTypes.EntryType.QUOTE,
            0,
            referenceId,
            contentRef
        );
    }

    // =========================================================
    // Entry Deletion
    // =========================================================

    /// @notice Delete an entry (author can delete their own; moderators can delete any)
    /// @param entryId The entry to delete
    function deleteEntry(uint256 entryId)
        external
        nonReentrant
    {
        OnchainTypes.Entry storage entry = _getActiveEntry(entryId);

        bool isAuthor = entry.author == msg.sender;
        bool isModerator = hasRole(MODERATOR_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender);

        if (!isAuthor && !isModerator) {
            revert NotEntryAuthor(entryId, msg.sender);
        }

        OnchainTypes.EntryStatus oldStatus = entry.status;
        entry.status = OnchainTypes.EntryStatus.DELETED;

        emit EntryDeleted(entryId, entry.author, block.timestamp);
        emit EntryStatusChanged(entryId, oldStatus, OnchainTypes.EntryStatus.DELETED, msg.sender, block.timestamp);
    }

    // =========================================================
    // Moderation Actions
    // =========================================================

    /// @notice Approve a pending entry
    function approveEntry(uint256 entryId)
        external
        onlyRole(MODERATOR_ROLE)
    {
        OnchainTypes.Entry storage entry = _entries[entryId];
        if (entry.author == address(0)) revert EntryNotFound(entryId);
        if (entry.status != OnchainTypes.EntryStatus.PENDING) revert EntryNotActive(entryId);

        OnchainTypes.EntryStatus oldStatus = entry.status;
        entry.status = OnchainTypes.EntryStatus.ACTIVE;

        emit EntryStatusChanged(entryId, oldStatus, OnchainTypes.EntryStatus.ACTIVE, msg.sender, block.timestamp);
    }

    /// @notice Reject a pending entry
    function rejectEntry(uint256 entryId)
        external
        onlyRole(MODERATOR_ROLE)
    {
        OnchainTypes.Entry storage entry = _entries[entryId];
        if (entry.author == address(0)) revert EntryNotFound(entryId);
        if (entry.status != OnchainTypes.EntryStatus.PENDING) revert EntryNotActive(entryId);

        OnchainTypes.EntryStatus oldStatus = entry.status;
        entry.status = OnchainTypes.EntryStatus.REJECTED;

        emit EntryStatusChanged(entryId, oldStatus, OnchainTypes.EntryStatus.REJECTED, msg.sender, block.timestamp);
    }

    /// @notice Hide an active entry
    function hideEntry(uint256 entryId)
        external
        onlyRole(MODERATOR_ROLE)
    {
        OnchainTypes.Entry storage entry = _entries[entryId];
        if (entry.author == address(0)) revert EntryNotFound(entryId);
        if (entry.status == OnchainTypes.EntryStatus.DELETED) revert EntryAlreadyDeleted(entryId);

        OnchainTypes.EntryStatus oldStatus = entry.status;
        entry.status = OnchainTypes.EntryStatus.HIDDEN;

        emit EntryStatusChanged(entryId, oldStatus, OnchainTypes.EntryStatus.HIDDEN, msg.sender, block.timestamp);
    }

    /// @notice Restore a hidden or rejected entry
    function restoreEntry(uint256 entryId)
        external
        onlyRole(MODERATOR_ROLE)
    {
        OnchainTypes.Entry storage entry = _entries[entryId];
        if (entry.author == address(0)) revert EntryNotFound(entryId);
        if (
            entry.status != OnchainTypes.EntryStatus.HIDDEN &&
            entry.status != OnchainTypes.EntryStatus.REJECTED
        ) {
            revert EntryNotActive(entryId);
        }

        OnchainTypes.EntryStatus oldStatus = entry.status;
        entry.status = OnchainTypes.EntryStatus.ACTIVE;

        emit EntryStatusChanged(entryId, oldStatus, OnchainTypes.EntryStatus.ACTIVE, msg.sender, block.timestamp);
    }

    /// @notice Pin or unpin an entry
    function setPinned(uint256 entryId, bool pinned)
        external
        onlyRole(MODERATOR_ROLE)
    {
        OnchainTypes.Entry storage entry = _entries[entryId];
        if (entry.author == address(0)) revert EntryNotFound(entryId);

        entry.pinned = pinned;
        emit EntryPinned(entryId, pinned, msg.sender);
    }

    // =========================================================
    // User Restrictions
    // =========================================================

    /// @notice Set a user's restriction level
    function setUserRestriction(address user, OnchainTypes.UserRestriction restriction)
        external
        onlyRole(MODERATOR_ROLE)
    {
        require(user != address(0), "Invalid user address");
        // Moderators cannot restrict other moderators or admins
        require(
            !hasRole(MODERATOR_ROLE, user) && !hasRole(ADMIN_ROLE, user),
            "Cannot restrict moderator or admin"
        );

        userRestrictions[user] = restriction;
        emit UserRestrictionChanged(user, restriction, msg.sender);
    }

    // =========================================================
    // Configuration
    // =========================================================

    /// @notice Update the moderation mode
    function setModerationMode(OnchainTypes.ModerationMode mode)
        external
        onlyRole(ADMIN_ROLE)
    {
        OnchainTypes.ModerationMode old = moderationMode;
        moderationMode = mode;
        emit ModerationModeChanged(old, mode, msg.sender);
    }

    /// @notice Update maximum content reference length
    function setMaxContentRefLength(uint256 length)
        external
        onlyRole(ADMIN_ROLE)
    {
        require(length > 0 && length <= 4096, "Invalid length");
        uint256 old = maxContentRefLength;
        maxContentRefLength = length;
        emit MaxContentRefLengthChanged(old, length);
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

    /// @notice Get a single entry by ID
    function getEntry(uint256 entryId)
        external
        view
        returns (OnchainTypes.Entry memory)
    {
        OnchainTypes.Entry storage entry = _entries[entryId];
        if (entry.author == address(0)) revert EntryNotFound(entryId);
        return entry;
    }

    /// @notice Get multiple entries by IDs
    function getEntries(uint256[] calldata entryIds)
        external
        view
        returns (OnchainTypes.Entry[] memory entries)
    {
        entries = new OnchainTypes.Entry[](entryIds.length);
        for (uint256 i = 0; i < entryIds.length; i++) {
            entries[i] = _entries[entryIds[i]];
        }
    }

    /// @notice Get entry IDs by author (paginated)
    function getEntriesByAuthor(address author, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory ids, uint256 total)
    {
        uint256[] storage authorEntries = _entriesByAuthor[author];
        total = authorEntries.length;

        if (offset >= total || limit == 0) {
            return (new uint256[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;

        ids = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            // Return in reverse chronological order
            ids[i] = authorEntries[total - 1 - offset - i];
        }
    }

    /// @notice Get child entry IDs for a parent (paginated)
    function getChildEntries(uint256 parentId, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory ids, uint256 total)
    {
        uint256[] storage children = _childEntries[parentId];
        total = children.length;

        if (offset >= total || limit == 0) {
            return (new uint256[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;

        ids = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            ids[i] = children[offset + i];
        }
    }

    /// @notice Get total number of entries
    function totalEntries() external view returns (uint256) {
        return _nextEntryId - 1;
    }

    /// @notice Check if an entry exists and is active
    function isEntryActive(uint256 entryId) external view returns (bool) {
        return _entries[entryId].status == OnchainTypes.EntryStatus.ACTIVE;
    }

    // =========================================================
    // Internal Helpers
    // =========================================================

    function _createEntry(
        address author,
        OnchainTypes.EntryType entryType,
        uint256 parentId,
        uint256 referenceId,
        string calldata contentRef
    ) internal returns (uint256 entryId) {
        entryId = _nextEntryId++;

        // Determine initial status based on moderation mode
        OnchainTypes.EntryStatus initialStatus;
        if (
            moderationMode == OnchainTypes.ModerationMode.OPEN ||
            moderationMode == OnchainTypes.ModerationMode.EVENT ||
            hasRole(TRUSTED_ROLE, author) ||
            hasRole(MODERATOR_ROLE, author) ||
            hasRole(ADMIN_ROLE, author)
        ) {
            initialStatus = OnchainTypes.EntryStatus.ACTIVE;
        } else if (moderationMode == OnchainTypes.ModerationMode.TRUSTED) {
            initialStatus = OnchainTypes.EntryStatus.PENDING;
        } else {
            // STRICT mode — all require approval
            initialStatus = OnchainTypes.EntryStatus.PENDING;
        }

        _entries[entryId] = OnchainTypes.Entry({
            id: entryId,
            author: author,
            entryType: entryType,
            parentId: parentId,
            referenceId: referenceId,
            contentRef: contentRef,
            createdAt: block.timestamp,
            status: initialStatus,
            pinned: false
        });

        _entriesByAuthor[author].push(entryId);

        emit EntryCreated(
            entryId,
            author,
            entryType,
            parentId,
            referenceId,
            contentRef,
            initialStatus,
            block.timestamp
        );
    }

    function _validateContentRef(string calldata contentRef) internal view {
        if (bytes(contentRef).length == 0) revert EmptyContentRef();
        if (bytes(contentRef).length > maxContentRefLength) {
            revert ContentRefTooLong(bytes(contentRef).length, maxContentRefLength);
        }
    }

    function _validateNotRestricted(address user) internal view {
        OnchainTypes.UserRestriction restriction = userRestrictions[user];
        if (restriction == OnchainTypes.UserRestriction.BANNED) {
            revert UserBanned(user);
        }
        if (restriction == OnchainTypes.UserRestriction.RESTRICTED) {
            revert UserRestricted(user);
        }
    }

    function _validateParentEntry(uint256 parentId) internal view {
        if (parentId == 0 || parentId >= _nextEntryId) {
            revert InvalidParentEntry(parentId);
        }
        OnchainTypes.Entry storage parent = _entries[parentId];
        if (parent.author == address(0)) revert EntryNotFound(parentId);
        if (
            parent.status == OnchainTypes.EntryStatus.DELETED ||
            parent.status == OnchainTypes.EntryStatus.REJECTED
        ) {
            revert InvalidParentEntry(parentId);
        }
    }

    function _getActiveEntry(uint256 entryId)
        internal
        view
        returns (OnchainTypes.Entry storage entry)
    {
        entry = _entries[entryId];
        if (entry.author == address(0)) revert EntryNotFound(entryId);
        if (entry.status == OnchainTypes.EntryStatus.DELETED) {
            revert EntryAlreadyDeleted(entryId);
        }
    }
}
