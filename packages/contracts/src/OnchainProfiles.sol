// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OnchainTypes} from "./OnchainTypes.sol";

/// @title OnchainProfiles
/// @notice Profile registry for the ONCHAIN social protocol.
///         Stores IPFS CID references to profile metadata JSON.
///         The CID proves what metadata was published at a given time.
contract OnchainProfiles is AccessControl, ReentrancyGuard {
    using OnchainTypes for *;

    // =========================================================
    // Roles
    // =========================================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");

    // =========================================================
    // State
    // =========================================================

    // wallet => Profile
    mapping(address => OnchainTypes.Profile) private _profiles;

    // wallet => profile exists
    mapping(address => bool) public hasProfile;

    // Total registered profiles
    uint256 public totalProfiles;

    // Max metadata ref length
    uint256 public maxMetadataRefLength = 512;

    // =========================================================
    // Events
    // =========================================================

    event ProfileRegistered(
        address indexed wallet,
        string metadataRef,
        uint256 timestamp
    );

    event ProfileUpdated(
        address indexed wallet,
        string oldMetadataRef,
        string newMetadataRef,
        uint256 timestamp
    );

    event ProfileDeactivated(
        address indexed wallet,
        address indexed by,
        uint256 timestamp
    );

    event ProfileRestored(
        address indexed wallet,
        address indexed by,
        uint256 timestamp
    );

    // =========================================================
    // Errors
    // =========================================================

    error ProfileAlreadyExists(address wallet);
    error ProfileNotFound(address wallet);
    error ProfileInactive(address wallet);
    error EmptyMetadataRef();
    error MetadataRefTooLong(uint256 length, uint256 maxLength);
    error Unauthorized();

    // =========================================================
    // Constructor
    // =========================================================

    constructor(address admin) {
        require(admin != address(0), "Invalid admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // =========================================================
    // Profile Management
    // =========================================================

    /// @notice Register a new profile
    /// @param metadataRef IPFS CID pointing to profile metadata JSON
    function registerProfile(string calldata metadataRef)
        external
        nonReentrant
    {
        if (hasProfile[msg.sender]) {
            revert ProfileAlreadyExists(msg.sender);
        }
        _validateMetadataRef(metadataRef);

        _profiles[msg.sender] = OnchainTypes.Profile({
            wallet: msg.sender,
            metadataRef: metadataRef,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp,
            active: true
        });

        hasProfile[msg.sender] = true;
        totalProfiles++;

        emit ProfileRegistered(msg.sender, metadataRef, block.timestamp);
    }

    /// @notice Update profile metadata reference
    /// @param metadataRef New IPFS CID pointing to updated profile metadata
    function updateProfile(string calldata metadataRef)
        external
        nonReentrant
    {
        if (!hasProfile[msg.sender]) {
            revert ProfileNotFound(msg.sender);
        }
        _validateMetadataRef(metadataRef);

        OnchainTypes.Profile storage profile = _profiles[msg.sender];
        if (!profile.active) revert ProfileInactive(msg.sender);

        string memory oldRef = profile.metadataRef;
        profile.metadataRef = metadataRef;
        profile.updatedAt = block.timestamp;

        emit ProfileUpdated(msg.sender, oldRef, metadataRef, block.timestamp);
    }

    /// @notice Deactivate a profile (moderator action)
    function deactivateProfile(address wallet)
        external
        onlyRole(MODERATOR_ROLE)
    {
        if (!hasProfile[wallet]) revert ProfileNotFound(wallet);
        OnchainTypes.Profile storage profile = _profiles[wallet];
        profile.active = false;
        emit ProfileDeactivated(wallet, msg.sender, block.timestamp);
    }

    /// @notice Restore a deactivated profile
    function restoreProfile(address wallet)
        external
        onlyRole(MODERATOR_ROLE)
    {
        if (!hasProfile[wallet]) revert ProfileNotFound(wallet);
        OnchainTypes.Profile storage profile = _profiles[wallet];
        profile.active = true;
        emit ProfileRestored(wallet, msg.sender, block.timestamp);
    }

    // =========================================================
    // Configuration
    // =========================================================

    function setMaxMetadataRefLength(uint256 length)
        external
        onlyRole(ADMIN_ROLE)
    {
        require(length > 0 && length <= 4096, "Invalid length");
        maxMetadataRefLength = length;
    }

    // =========================================================
    // View Functions
    // =========================================================

    /// @notice Get profile for a wallet
    function getProfile(address wallet)
        external
        view
        returns (OnchainTypes.Profile memory)
    {
        if (!hasProfile[wallet]) revert ProfileNotFound(wallet);
        return _profiles[wallet];
    }

    /// @notice Get profiles for multiple wallets
    function getProfiles(address[] calldata wallets)
        external
        view
        returns (OnchainTypes.Profile[] memory profiles)
    {
        profiles = new OnchainTypes.Profile[](wallets.length);
        for (uint256 i = 0; i < wallets.length; i++) {
            if (hasProfile[wallets[i]]) {
                profiles[i] = _profiles[wallets[i]];
            }
        }
    }

    // =========================================================
    // Internal
    // =========================================================

    function _validateMetadataRef(string calldata ref) internal view {
        if (bytes(ref).length == 0) revert EmptyMetadataRef();
        if (bytes(ref).length > maxMetadataRefLength) {
            revert MetadataRefTooLong(bytes(ref).length, maxMetadataRefLength);
        }
    }
}
