// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {OnchainEntries} from "../src/OnchainEntries.sol";
import {OnchainTypes} from "../src/OnchainTypes.sol";

contract OnchainEntriesTest is Test {
    OnchainEntries entries;

    address admin = makeAddr("admin");
    address moderator = makeAddr("moderator");
    address trusted = makeAddr("trusted");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    string constant CID1 = "QmTest1234567890abcdef1234567890abcdef12345678";
    string constant CID2 = "QmTest0987654321fedcba0987654321fedcba09876543";

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

    event EntryDeleted(uint256 indexed entryId, address indexed author, uint256 timestamp);

    function setUp() public {
        vm.startPrank(admin);
        entries = new OnchainEntries(admin);
        entries.grantRole(entries.MODERATOR_ROLE(), moderator);
        entries.grantRole(entries.TRUSTED_ROLE(), trusted);
        vm.stopPrank();
    }

    // =========================================================
    // Deployment Tests
    // =========================================================

    function test_DeploymentSetsAdmin() public view {
        assertTrue(entries.hasRole(entries.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(entries.hasRole(entries.ADMIN_ROLE(), admin));
    }

    function test_InitialState() public view {
        assertEq(entries.totalEntries(), 0);
        assertEq(uint8(entries.moderationMode()), uint8(OnchainTypes.ModerationMode.OPEN));
    }

    // =========================================================
    // Post Creation
    // =========================================================

    function test_CreatePost() public {
        vm.prank(alice);
        uint256 entryId = entries.createPost(CID1);

        assertEq(entryId, 1);

        OnchainTypes.Entry memory entry = entries.getEntry(entryId);
        assertEq(entry.id, 1);
        assertEq(entry.author, alice);
        assertEq(uint8(entry.entryType), uint8(OnchainTypes.EntryType.POST));
        assertEq(entry.parentId, 0);
        assertEq(entry.referenceId, 0);
        assertEq(entry.contentRef, CID1);
        assertEq(uint8(entry.status), uint8(OnchainTypes.EntryStatus.ACTIVE));
        assertFalse(entry.pinned);
        assertEq(entries.totalEntries(), 1);
    }

    function test_CreatePost_EmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit EntryCreated(
            1,
            alice,
            OnchainTypes.EntryType.POST,
            0,
            0,
            CID1,
            OnchainTypes.EntryStatus.ACTIVE,
            block.timestamp
        );
        vm.prank(alice);
        entries.createPost(CID1);
    }

    function test_CreatePost_EmptyContentRef_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(OnchainEntries.EmptyContentRef.selector);
        entries.createPost("");
    }

    function test_CreatePost_ContentRefTooLong_Reverts() public {
        string memory longRef = new string(513);
        vm.prank(alice);
        vm.expectRevert();
        entries.createPost(longRef);
    }

    function test_CreateMultiplePosts() public {
        vm.prank(alice);
        entries.createPost(CID1);
        vm.prank(bob);
        entries.createPost(CID2);

        assertEq(entries.totalEntries(), 2);
    }

    // =========================================================
    // Comment Creation
    // =========================================================

    function test_CreateComment() public {
        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        vm.prank(bob);
        uint256 commentId = entries.createComment(postId, CID2);

        assertEq(commentId, 2);

        OnchainTypes.Entry memory comment = entries.getEntry(commentId);
        assertEq(uint8(comment.entryType), uint8(OnchainTypes.EntryType.COMMENT));
        assertEq(comment.parentId, postId);
        assertEq(comment.author, bob);

        assertEq(entries.commentCount(postId), 1);
    }

    function test_CreateComment_InvalidParent_Reverts() public {
        vm.prank(alice);
        vm.expectRevert();
        entries.createComment(999, CID1);
    }

    function test_CreateComment_OnDeletedPost_Reverts() public {
        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        vm.prank(alice);
        entries.deleteEntry(postId);

        vm.prank(bob);
        vm.expectRevert();
        entries.createComment(postId, CID2);
    }

    function test_NestedComments() public {
        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        vm.prank(bob);
        uint256 commentId = entries.createComment(postId, CID2);

        vm.prank(carol);
        uint256 replyId = entries.createComment(commentId, CID1);

        OnchainTypes.Entry memory reply = entries.getEntry(replyId);
        assertEq(reply.parentId, commentId);
        assertEq(entries.commentCount(commentId), 1);
    }

    // =========================================================
    // Quote Creation
    // =========================================================

    function test_CreateQuote() public {
        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        vm.prank(bob);
        uint256 quoteId = entries.createQuote(postId, CID2);

        OnchainTypes.Entry memory quote = entries.getEntry(quoteId);
        assertEq(uint8(quote.entryType), uint8(OnchainTypes.EntryType.QUOTE));
        assertEq(quote.referenceId, postId);
        assertEq(quote.parentId, 0);
    }

    function test_CreateQuote_DeletedEntry_Reverts() public {
        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        vm.prank(alice);
        entries.deleteEntry(postId);

        vm.prank(bob);
        vm.expectRevert();
        entries.createQuote(postId, CID2);
    }

    // =========================================================
    // Entry Deletion
    // =========================================================

    function test_AuthorCanDeleteOwnPost() public {
        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        vm.prank(alice);
        entries.deleteEntry(postId);

        OnchainTypes.Entry memory entry = entries.getEntry(postId);
        assertEq(uint8(entry.status), uint8(OnchainTypes.EntryStatus.DELETED));
    }

    function test_ModeratorCanDeleteAnyPost() public {
        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        vm.prank(moderator);
        entries.deleteEntry(postId);

        OnchainTypes.Entry memory entry = entries.getEntry(postId);
        assertEq(uint8(entry.status), uint8(OnchainTypes.EntryStatus.DELETED));
    }

    function test_UnauthorizedDeleteReverts() public {
        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        vm.prank(bob);
        vm.expectRevert();
        entries.deleteEntry(postId);
    }

    function test_DeleteAlreadyDeletedReverts() public {
        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        vm.prank(alice);
        entries.deleteEntry(postId);

        vm.prank(alice);
        vm.expectRevert();
        entries.deleteEntry(postId);
    }

    // =========================================================
    // Moderation Actions
    // =========================================================

    function test_ModeratorCanHideEntry() public {
        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        vm.prank(moderator);
        entries.hideEntry(postId);

        OnchainTypes.Entry memory entry = entries.getEntry(postId);
        assertEq(uint8(entry.status), uint8(OnchainTypes.EntryStatus.HIDDEN));
    }

    function test_ModeratorCanRestoreHiddenEntry() public {
        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        vm.prank(moderator);
        entries.hideEntry(postId);

        vm.prank(moderator);
        entries.restoreEntry(postId);

        OnchainTypes.Entry memory entry = entries.getEntry(postId);
        assertEq(uint8(entry.status), uint8(OnchainTypes.EntryStatus.ACTIVE));
    }

    function test_UnauthorizedHideReverts() public {
        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        vm.prank(bob);
        vm.expectRevert();
        entries.hideEntry(postId);
    }

    function test_ModeratorCanPin() public {
        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        vm.prank(moderator);
        entries.setPinned(postId, true);

        OnchainTypes.Entry memory entry = entries.getEntry(postId);
        assertTrue(entry.pinned);
    }

    // =========================================================
    // Moderation Modes
    // =========================================================

    function test_StrictMode_CreatesPendingEntries() public {
        vm.prank(admin);
        entries.setModerationMode(OnchainTypes.ModerationMode.STRICT);

        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        OnchainTypes.Entry memory entry = entries.getEntry(postId);
        assertEq(uint8(entry.status), uint8(OnchainTypes.EntryStatus.PENDING));
    }

    function test_TrustedMode_TrustedUserPublishesImmediately() public {
        vm.prank(admin);
        entries.setModerationMode(OnchainTypes.ModerationMode.TRUSTED);

        vm.prank(trusted);
        uint256 postId = entries.createPost(CID1);

        OnchainTypes.Entry memory entry = entries.getEntry(postId);
        assertEq(uint8(entry.status), uint8(OnchainTypes.EntryStatus.ACTIVE));
    }

    function test_TrustedMode_UntrustedUserCreatesPendingEntry() public {
        vm.prank(admin);
        entries.setModerationMode(OnchainTypes.ModerationMode.TRUSTED);

        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        OnchainTypes.Entry memory entry = entries.getEntry(postId);
        assertEq(uint8(entry.status), uint8(OnchainTypes.EntryStatus.PENDING));
    }

    function test_ModeratorCanApprovePendingEntry() public {
        vm.prank(admin);
        entries.setModerationMode(OnchainTypes.ModerationMode.STRICT);

        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        vm.prank(moderator);
        entries.approveEntry(postId);

        OnchainTypes.Entry memory entry = entries.getEntry(postId);
        assertEq(uint8(entry.status), uint8(OnchainTypes.EntryStatus.ACTIVE));
    }

    function test_ModeratorCanRejectPendingEntry() public {
        vm.prank(admin);
        entries.setModerationMode(OnchainTypes.ModerationMode.STRICT);

        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        vm.prank(moderator);
        entries.rejectEntry(postId);

        OnchainTypes.Entry memory entry = entries.getEntry(postId);
        assertEq(uint8(entry.status), uint8(OnchainTypes.EntryStatus.REJECTED));
    }

    // =========================================================
    // User Restrictions
    // =========================================================

    function test_RestrictedUserCannotPost() public {
        vm.prank(moderator);
        entries.setUserRestriction(alice, OnchainTypes.UserRestriction.RESTRICTED);

        vm.prank(alice);
        vm.expectRevert();
        entries.createPost(CID1);
    }

    function test_BannedUserCannotPost() public {
        vm.prank(moderator);
        entries.setUserRestriction(alice, OnchainTypes.UserRestriction.BANNED);

        vm.prank(alice);
        vm.expectRevert();
        entries.createPost(CID1);
    }

    function test_UnauthorizedRestrictionReverts() public {
        vm.prank(alice);
        vm.expectRevert();
        entries.setUserRestriction(bob, OnchainTypes.UserRestriction.RESTRICTED);
    }

    function test_CannotRestrictModerator() public {
        vm.prank(moderator);
        vm.expectRevert();
        entries.setUserRestriction(moderator, OnchainTypes.UserRestriction.RESTRICTED);
    }

    // =========================================================
    // Pause
    // =========================================================

    function test_PausedContractCannotCreateEntries() public {
        vm.prank(admin);
        entries.pause();

        vm.prank(alice);
        vm.expectRevert();
        entries.createPost(CID1);
    }

    function test_UnpauseRestoresFunctionality() public {
        vm.prank(admin);
        entries.pause();

        vm.prank(admin);
        entries.unpause();

        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);
        assertEq(postId, 1);
    }

    function test_UnauthorizedPauseReverts() public {
        vm.prank(alice);
        vm.expectRevert();
        entries.pause();
    }

    // =========================================================
    // Pagination
    // =========================================================

    function test_GetEntriesByAuthor() public {
        vm.startPrank(alice);
        entries.createPost(CID1);
        entries.createPost(CID2);
        entries.createPost(CID1);
        vm.stopPrank();

        (uint256[] memory ids, uint256 total) = entries.getEntriesByAuthor(alice, 0, 10);
        assertEq(total, 3);
        assertEq(ids.length, 3);
    }

    function test_GetEntriesByAuthor_Pagination() public {
        vm.startPrank(alice);
        for (uint256 i = 0; i < 5; i++) {
            entries.createPost(CID1);
        }
        vm.stopPrank();

        (uint256[] memory page1, uint256 total) = entries.getEntriesByAuthor(alice, 0, 2);
        assertEq(total, 5);
        assertEq(page1.length, 2);

        (uint256[] memory page2,) = entries.getEntriesByAuthor(alice, 2, 2);
        assertEq(page2.length, 2);
    }

    // =========================================================
    // Gas Tests
    // =========================================================

    function test_GasCreatePost() public {
        vm.prank(alice);
        uint256 gasBefore = gasleft();
        entries.createPost(CID1);
        uint256 gasUsed = gasBefore - gasleft();
        console2.log("Gas used for createPost:", gasUsed);
        // First post initializes cold storage slots; subsequent writes are cheaper on mainnet
        assertLt(gasUsed, 350_000, "createPost uses too much gas");
    }

    function test_GasCreateComment() public {
        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        vm.prank(bob);
        uint256 gasBefore = gasleft();
        entries.createComment(postId, CID2);
        uint256 gasUsed = gasBefore - gasleft();
        console2.log("Gas used for createComment:", gasUsed);
        assertLt(gasUsed, 450_000, "createComment uses too much gas");
    }

    // =========================================================
    // Edge Cases
    // =========================================================

    function test_GetNonexistentEntry_Reverts() public {
        vm.expectRevert();
        entries.getEntry(999);
    }

    function test_IsEntryActive_AfterDeletion() public {
        vm.prank(alice);
        uint256 postId = entries.createPost(CID1);

        assertTrue(entries.isEntryActive(postId));

        vm.prank(alice);
        entries.deleteEntry(postId);

        assertFalse(entries.isEntryActive(postId));
    }

    function test_AdminCanChangeMaxContentRefLength() public {
        vm.prank(admin);
        entries.setMaxContentRefLength(256);
        assertEq(entries.maxContentRefLength(), 256);
    }
}
