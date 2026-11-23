// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {OnchainEntries} from "../src/OnchainEntries.sol";
import {OnchainSocial} from "../src/OnchainSocial.sol";
import {OnchainTypes} from "../src/OnchainTypes.sol";

contract OnchainSocialTest is Test {
    OnchainEntries entries;
    OnchainSocial social;

    address admin = makeAddr("admin");
    address moderator = makeAddr("moderator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    string constant CID1 = "QmTest1234567890abcdef1234567890abcdef12345678";
    string constant CID2 = "QmTest0987654321fedcba0987654321fedcba09876543";

    uint256 alicePostId;
    uint256 bobPostId;

    function setUp() public {
        vm.startPrank(admin);
        entries = new OnchainEntries(admin);
        entries.grantRole(entries.MODERATOR_ROLE(), moderator);
        social = new OnchainSocial(admin, address(entries));
        vm.stopPrank();

        // Create test posts
        vm.prank(alice);
        alicePostId = entries.createPost(CID1);

        vm.prank(bob);
        bobPostId = entries.createPost(CID2);
    }

    // =========================================================
    // Reactions
    // =========================================================

    function test_AddReaction() public {
        vm.prank(bob);
        social.addReaction(alicePostId, OnchainTypes.ReactionType.LIKE);

        (bool hasReacted, OnchainTypes.ReactionType reactionType) =
            social.getUserReaction(alicePostId, bob);

        assertTrue(hasReacted);
        assertEq(uint8(reactionType), uint8(OnchainTypes.ReactionType.LIKE));
        assertEq(social.reactionCounts(alicePostId, OnchainTypes.ReactionType.LIKE), 1);
        assertEq(social.totalReactionCount(alicePostId), 1);
    }

    function test_AddDifferentReactions() public {
        vm.prank(bob);
        social.addReaction(alicePostId, OnchainTypes.ReactionType.LOVE);

        vm.prank(carol);
        social.addReaction(alicePostId, OnchainTypes.ReactionType.LOVE);

        assertEq(social.reactionCounts(alicePostId, OnchainTypes.ReactionType.LOVE), 2);
        assertEq(social.totalReactionCount(alicePostId), 2);
    }

    function test_DuplicateReaction_Reverts() public {
        vm.prank(bob);
        social.addReaction(alicePostId, OnchainTypes.ReactionType.LIKE);

        vm.prank(bob);
        vm.expectRevert();
        social.addReaction(alicePostId, OnchainTypes.ReactionType.LIKE);
    }

    function test_DuplicateReactionDifferentType_Reverts() public {
        vm.prank(bob);
        social.addReaction(alicePostId, OnchainTypes.ReactionType.LIKE);

        vm.prank(bob);
        vm.expectRevert();
        social.addReaction(alicePostId, OnchainTypes.ReactionType.LOVE);
    }

    function test_RemoveReaction() public {
        vm.prank(bob);
        social.addReaction(alicePostId, OnchainTypes.ReactionType.LIKE);

        vm.prank(bob);
        social.removeReaction(alicePostId);

        (bool hasReacted,) = social.getUserReaction(alicePostId, bob);
        assertFalse(hasReacted);
        assertEq(social.reactionCounts(alicePostId, OnchainTypes.ReactionType.LIKE), 0);
        assertEq(social.totalReactionCount(alicePostId), 0);
    }

    function test_RemoveNonexistentReaction_Reverts() public {
        vm.prank(bob);
        vm.expectRevert();
        social.removeReaction(alicePostId);
    }

    function test_ChangeReaction() public {
        vm.prank(bob);
        social.addReaction(alicePostId, OnchainTypes.ReactionType.LIKE);

        vm.prank(bob);
        social.changeReaction(alicePostId, OnchainTypes.ReactionType.LOVE);

        (bool hasReacted, OnchainTypes.ReactionType reactionType) =
            social.getUserReaction(alicePostId, bob);

        assertTrue(hasReacted);
        assertEq(uint8(reactionType), uint8(OnchainTypes.ReactionType.LOVE));
        assertEq(social.reactionCounts(alicePostId, OnchainTypes.ReactionType.LIKE), 0);
        assertEq(social.reactionCounts(alicePostId, OnchainTypes.ReactionType.LOVE), 1);
    }

    function test_ChangeReactionToSameType_Reverts() public {
        vm.prank(bob);
        social.addReaction(alicePostId, OnchainTypes.ReactionType.LIKE);

        vm.prank(bob);
        vm.expectRevert();
        social.changeReaction(alicePostId, OnchainTypes.ReactionType.LIKE);
    }

    function test_ReactOnInactiveEntry_Reverts() public {
        vm.prank(alice);
        entries.deleteEntry(alicePostId);

        vm.prank(bob);
        vm.expectRevert();
        social.addReaction(alicePostId, OnchainTypes.ReactionType.LIKE);
    }

    function test_GetAllReactionCounts() public {
        vm.prank(bob);
        social.addReaction(alicePostId, OnchainTypes.ReactionType.LIKE);

        vm.prank(carol);
        social.addReaction(alicePostId, OnchainTypes.ReactionType.LOVE);

        uint256[6] memory counts = social.getReactionCounts(alicePostId);
        assertEq(counts[0], 1); // LIKE
        assertEq(counts[1], 1); // LOVE
        assertEq(counts[2], 0); // LAUGH
        assertEq(counts[3], 0); // WOW
        assertEq(counts[4], 0); // SAD
        assertEq(counts[5], 0); // ANGRY
    }

    // =========================================================
    // Reposts
    // =========================================================

    function test_Repost() public {
        vm.prank(bob);
        social.repost(alicePostId);

        assertTrue(social.hasReposted(bob, alicePostId));
        assertEq(social.repostCount(alicePostId), 1);
    }

    function test_DuplicateRepost_Reverts() public {
        vm.prank(bob);
        social.repost(alicePostId);

        vm.prank(bob);
        vm.expectRevert();
        social.repost(alicePostId);
    }

    function test_Unrepost() public {
        vm.prank(bob);
        social.repost(alicePostId);

        vm.prank(bob);
        social.unrepost(alicePostId);

        assertFalse(social.hasReposted(bob, alicePostId));
        assertEq(social.repostCount(alicePostId), 0);
    }

    function test_UnrepostWithoutRepost_Reverts() public {
        vm.prank(bob);
        vm.expectRevert();
        social.unrepost(alicePostId);
    }

    function test_CannotRepostComment() public {
        vm.prank(bob);
        uint256 commentId = entries.createComment(alicePostId, CID2);

        vm.prank(carol);
        vm.expectRevert();
        social.repost(commentId);
    }

    function test_RepostInactiveEntry_Reverts() public {
        vm.prank(alice);
        entries.deleteEntry(alicePostId);

        vm.prank(bob);
        vm.expectRevert();
        social.repost(alicePostId);
    }

    // =========================================================
    // Following
    // =========================================================

    function test_Follow() public {
        vm.prank(bob);
        social.follow(alice);

        assertTrue(social.isFollowing(bob, alice));
        assertEq(social.followerCount(alice), 1);
        assertEq(social.followingCount(bob), 1);
    }

    function test_FollowSelf_Reverts() public {
        vm.prank(alice);
        vm.expectRevert();
        social.follow(alice);
    }

    function test_DuplicateFollow_Reverts() public {
        vm.prank(bob);
        social.follow(alice);

        vm.prank(bob);
        vm.expectRevert();
        social.follow(alice);
    }

    function test_Unfollow() public {
        vm.prank(bob);
        social.follow(alice);

        vm.prank(bob);
        social.unfollow(alice);

        assertFalse(social.isFollowing(bob, alice));
        assertEq(social.followerCount(alice), 0);
        assertEq(social.followingCount(bob), 0);
    }

    function test_UnfollowWithoutFollowing_Reverts() public {
        vm.prank(bob);
        vm.expectRevert();
        social.unfollow(alice);
    }

    function test_MutualFollow() public {
        vm.prank(bob);
        social.follow(alice);

        vm.prank(alice);
        social.follow(bob);

        assertTrue(social.isFollowing(bob, alice));
        assertTrue(social.isFollowing(alice, bob));
        assertEq(social.followerCount(alice), 1);
        assertEq(social.followerCount(bob), 1);
    }

    // =========================================================
    // Restricted Users
    // =========================================================

    function test_RestrictedUserCannotReact() public {
        vm.prank(moderator);
        entries.setUserRestriction(bob, OnchainTypes.UserRestriction.RESTRICTED);

        vm.prank(bob);
        vm.expectRevert();
        social.addReaction(alicePostId, OnchainTypes.ReactionType.LIKE);
    }

    function test_BannedUserCannotRepost() public {
        vm.prank(moderator);
        entries.setUserRestriction(bob, OnchainTypes.UserRestriction.BANNED);

        vm.prank(bob);
        vm.expectRevert();
        social.repost(alicePostId);
    }

    // =========================================================
    // Pause
    // =========================================================

    function test_PausedContractCannotReact() public {
        vm.prank(admin);
        social.pause();

        vm.prank(bob);
        vm.expectRevert();
        social.addReaction(alicePostId, OnchainTypes.ReactionType.LIKE);
    }

    // =========================================================
    // Gas Tests
    // =========================================================

    function test_GasAddReaction() public {
        vm.prank(bob);
        uint256 gasBefore = gasleft();
        social.addReaction(alicePostId, OnchainTypes.ReactionType.LIKE);
        uint256 gasUsed = gasBefore - gasleft();
        console2.log("Gas used for addReaction:", gasUsed);
        assertLt(gasUsed, 200_000, "addReaction uses too much gas");
    }

    function test_GasRepost() public {
        vm.prank(bob);
        uint256 gasBefore = gasleft();
        social.repost(alicePostId);
        uint256 gasUsed = gasBefore - gasleft();
        console2.log("Gas used for repost:", gasUsed);
        assertLt(gasUsed, 250_000, "repost uses too much gas");
    }

    function test_GasFollow() public {
        vm.prank(bob);
        uint256 gasBefore = gasleft();
        social.follow(alice);
        uint256 gasUsed = gasBefore - gasleft();
        console2.log("Gas used for follow:", gasUsed);
        assertLt(gasUsed, 200_000, "follow uses too much gas");
    }
}
