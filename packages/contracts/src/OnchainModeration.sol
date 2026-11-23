// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OnchainTypes} from "./OnchainTypes.sol";

/// @title OnchainModeration
/// @notice Central moderation registry for the ONCHAIN protocol.
///         Tracks reports, moderation audit history, and global configuration.
///         Actual entry/profile state changes live in their respective contracts.
contract OnchainModeration is AccessControl, Pausable, ReentrancyGuard {
    using OnchainTypes for *;

    // =========================================================
    // Roles
    // =========================================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");
    bytes32 public constant TRUSTED_ROLE = keccak256("TRUSTED_ROLE");

    // =========================================================
    // Report Types
    // =========================================================

    enum ReportCategory {
        SPAM,
        HARASSMENT,
        HATE_SPEECH,
        MISINFORMATION,
        ILLEGAL_CONTENT,
        VIOLENT_CONTENT,
        ADULT_CONTENT,
        OTHER
    }

    enum ReportStatus {
        PENDING,
        REVIEWING,
        RESOLVED,
        DISMISSED
    }

    struct Report {
        uint256 id;
        address reporter;
        uint256 targetEntryId;    // 0 if reporting a profile
        address targetWallet;     // address(0) if reporting an entry
        ReportCategory category;
        ReportStatus status;
        uint256 createdAt;
        uint256 resolvedAt;
        address resolvedBy;
    }

    struct AuditEntry {
        uint256 id;
        address actor;
        OnchainTypes.ModerationAction action;
        uint256 targetEntryId;
        address targetWallet;
        uint256 timestamp;
    }

    // =========================================================
    // State
    // =========================================================

    uint256 private _nextReportId;
    uint256 private _nextAuditId;

    mapping(uint256 => Report) private _reports;
    mapping(uint256 => AuditEntry) private _auditLog;

    // reporter => targetEntryId => hasReported (spam prevention)
    mapping(address => mapping(uint256 => bool)) private _entryReports;

    // reporter => targetWallet => hasReported
    mapping(address => mapping(address => bool)) private _profileReports;

    // Current moderation mode
    OnchainTypes.ModerationMode public moderationMode;

    // Platform configuration
    uint256 public maxReportsPerHour = 5;
    bool public reportingEnabled = true;

    // =========================================================
    // Events
    // =========================================================

    event ReportSubmitted(
        uint256 indexed reportId,
        address indexed reporter,
        uint256 targetEntryId,
        address targetWallet,
        ReportCategory category,
        uint256 timestamp
    );

    event ReportStatusChanged(
        uint256 indexed reportId,
        ReportStatus oldStatus,
        ReportStatus newStatus,
        address indexed changedBy,
        uint256 timestamp
    );

    event ModerationAuditRecorded(
        uint256 indexed auditId,
        address indexed actor,
        OnchainTypes.ModerationAction action,
        uint256 targetEntryId,
        address targetWallet,
        uint256 timestamp
    );

    event ModeratorAdded(address indexed moderator, address indexed by);
    event ModeratorRemoved(address indexed moderator, address indexed by);
    event TrustedUserAdded(address indexed user, address indexed by);
    event TrustedUserRemoved(address indexed user, address indexed by);
    event ModerationModeChanged(
        OnchainTypes.ModerationMode oldMode,
        OnchainTypes.ModerationMode newMode,
        address indexed by
    );

    // =========================================================
    // Errors
    // =========================================================

    error AlreadyReported(address reporter, uint256 targetId);
    error AlreadyReportedWallet(address reporter, address target);
    error ReportNotFound(uint256 reportId);
    error ReportingDisabled();
    error InvalidReport();
    error CannotReportSelf();

    // =========================================================
    // Constructor
    // =========================================================

    constructor(address admin) {
        require(admin != address(0), "Invalid admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _nextReportId = 1;
        _nextAuditId = 1;
    }

    // =========================================================
    // Reports
    // =========================================================

    /// @notice Submit a report against an entry
    function reportEntry(uint256 entryId, ReportCategory category)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 reportId)
    {
        if (!reportingEnabled) revert ReportingDisabled();
        require(entryId > 0, "Invalid entry ID");

        if (_entryReports[msg.sender][entryId]) {
            revert AlreadyReported(msg.sender, entryId);
        }

        reportId = _nextReportId++;
        _reports[reportId] = Report({
            id: reportId,
            reporter: msg.sender,
            targetEntryId: entryId,
            targetWallet: address(0),
            category: category,
            status: ReportStatus.PENDING,
            createdAt: block.timestamp,
            resolvedAt: 0,
            resolvedBy: address(0)
        });

        _entryReports[msg.sender][entryId] = true;

        emit ReportSubmitted(reportId, msg.sender, entryId, address(0), category, block.timestamp);
    }

    /// @notice Submit a report against a wallet/profile
    function reportWallet(address target, ReportCategory category)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 reportId)
    {
        if (!reportingEnabled) revert ReportingDisabled();
        if (target == msg.sender) revert CannotReportSelf();
        require(target != address(0), "Invalid target");

        if (_profileReports[msg.sender][target]) {
            revert AlreadyReportedWallet(msg.sender, target);
        }

        reportId = _nextReportId++;
        _reports[reportId] = Report({
            id: reportId,
            reporter: msg.sender,
            targetEntryId: 0,
            targetWallet: target,
            category: category,
            status: ReportStatus.PENDING,
            createdAt: block.timestamp,
            resolvedAt: 0,
            resolvedBy: address(0)
        });

        _profileReports[msg.sender][target] = true;

        emit ReportSubmitted(reportId, msg.sender, 0, target, category, block.timestamp);
    }

    /// @notice Update report status (moderator action)
    function updateReportStatus(uint256 reportId, ReportStatus newStatus)
        external
        onlyRole(MODERATOR_ROLE)
    {
        Report storage report = _reports[reportId];
        if (report.reporter == address(0)) revert ReportNotFound(reportId);

        ReportStatus oldStatus = report.status;
        report.status = newStatus;

        if (newStatus == ReportStatus.RESOLVED || newStatus == ReportStatus.DISMISSED) {
            report.resolvedAt = block.timestamp;
            report.resolvedBy = msg.sender;
        }

        emit ReportStatusChanged(reportId, oldStatus, newStatus, msg.sender, block.timestamp);
    }

    // =========================================================
    // Audit Log
    // =========================================================

    /// @notice Record a moderation action in the audit log
    /// @dev Called by moderators to record on-chain evidence of moderation actions
    function recordAuditEntry(
        OnchainTypes.ModerationAction action,
        uint256 targetEntryId,
        address targetWallet
    ) external onlyRole(MODERATOR_ROLE) returns (uint256 auditId) {
        auditId = _nextAuditId++;
        _auditLog[auditId] = AuditEntry({
            id: auditId,
            actor: msg.sender,
            action: action,
            targetEntryId: targetEntryId,
            targetWallet: targetWallet,
            timestamp: block.timestamp
        });

        emit ModerationAuditRecorded(
            auditId,
            msg.sender,
            action,
            targetEntryId,
            targetWallet,
            block.timestamp
        );
    }

    // =========================================================
    // Role Management
    // =========================================================

    /// @notice Grant moderator role
    function addModerator(address moderator) external onlyRole(ADMIN_ROLE) {
        require(moderator != address(0), "Invalid address");
        _grantRole(MODERATOR_ROLE, moderator);
        emit ModeratorAdded(moderator, msg.sender);
    }

    /// @notice Revoke moderator role
    function removeModerator(address moderator) external onlyRole(ADMIN_ROLE) {
        _revokeRole(MODERATOR_ROLE, moderator);
        emit ModeratorRemoved(moderator, msg.sender);
    }

    /// @notice Grant trusted user role
    function addTrustedUser(address user) external onlyRole(MODERATOR_ROLE) {
        require(user != address(0), "Invalid address");
        _grantRole(TRUSTED_ROLE, user);
        emit TrustedUserAdded(user, msg.sender);
    }

    /// @notice Revoke trusted user role
    function removeTrustedUser(address user) external onlyRole(MODERATOR_ROLE) {
        _revokeRole(TRUSTED_ROLE, user);
        emit TrustedUserRemoved(user, msg.sender);
    }

    // =========================================================
    // Configuration
    // =========================================================

    /// @notice Update moderation mode
    function setModerationMode(OnchainTypes.ModerationMode mode)
        external
        onlyRole(ADMIN_ROLE)
    {
        OnchainTypes.ModerationMode old = moderationMode;
        moderationMode = mode;
        emit ModerationModeChanged(old, mode, msg.sender);
    }

    /// @notice Enable or disable reporting
    function setReportingEnabled(bool enabled) external onlyRole(ADMIN_ROLE) {
        reportingEnabled = enabled;
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

    function getReport(uint256 reportId) external view returns (Report memory) {
        if (_reports[reportId].reporter == address(0)) revert ReportNotFound(reportId);
        return _reports[reportId];
    }

    function getAuditEntry(uint256 auditId) external view returns (AuditEntry memory) {
        return _auditLog[auditId];
    }

    function totalReports() external view returns (uint256) {
        return _nextReportId - 1;
    }

    function totalAuditEntries() external view returns (uint256) {
        return _nextAuditId - 1;
    }

    function hasReportedEntry(address reporter, uint256 entryId) external view returns (bool) {
        return _entryReports[reporter][entryId];
    }

    function hasReportedWallet(address reporter, address target) external view returns (bool) {
        return _profileReports[reporter][target];
    }

    function isModerator(address account) external view returns (bool) {
        return hasRole(MODERATOR_ROLE, account);
    }

    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }

    function isTrusted(address account) external view returns (bool) {
        return hasRole(TRUSTED_ROLE, account);
    }
}
