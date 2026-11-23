// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {OnchainModeration} from "../src/OnchainModeration.sol";
import {OnchainTypes} from "../src/OnchainTypes.sol";

contract OnchainModerationTest is Test {
    OnchainModeration moderation;

    address admin = makeAddr("admin");
    address moderator = makeAddr("moderator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        vm.prank(admin);
        moderation = new OnchainModeration(admin);

        vm.prank(admin);
        moderation.addModerator(moderator);
    }

    function test_AddModerator() public {
        address newMod = makeAddr("newMod");
        vm.prank(admin);
        moderation.addModerator(newMod);
        assertTrue(moderation.isModerator(newMod));
    }

    function test_RemoveModerator() public {
        vm.prank(admin);
        moderation.removeModerator(moderator);
        assertFalse(moderation.isModerator(moderator));
    }

    function test_AddTrustedUser() public {
        vm.prank(moderator);
        moderation.addTrustedUser(alice);
        assertTrue(moderation.isTrusted(alice));
    }

    function test_RemoveTrustedUser() public {
        vm.prank(moderator);
        moderation.addTrustedUser(alice);

        vm.prank(moderator);
        moderation.removeTrustedUser(alice);
        assertFalse(moderation.isTrusted(alice));
    }

    function test_UnauthorizedAddModerator_Reverts() public {
        vm.prank(alice);
        vm.expectRevert();
        moderation.addModerator(bob);
    }

    function test_ReportEntry() public {
        vm.prank(alice);
        uint256 reportId = moderation.reportEntry(1, OnchainModeration.ReportCategory.SPAM);

        assertEq(reportId, 1);
        OnchainModeration.Report memory report = moderation.getReport(reportId);
        assertEq(report.reporter, alice);
        assertEq(report.targetEntryId, 1);
        assertEq(uint8(report.status), uint8(OnchainModeration.ReportStatus.PENDING));
    }

    function test_DuplicateReport_Reverts() public {
        vm.prank(alice);
        moderation.reportEntry(1, OnchainModeration.ReportCategory.SPAM);

        vm.prank(alice);
        vm.expectRevert();
        moderation.reportEntry(1, OnchainModeration.ReportCategory.SPAM);
    }

    function test_ReportWallet() public {
        vm.prank(alice);
        uint256 reportId = moderation.reportWallet(bob, OnchainModeration.ReportCategory.HARASSMENT);

        OnchainModeration.Report memory report = moderation.getReport(reportId);
        assertEq(report.targetWallet, bob);
    }

    function test_CannotReportSelf() public {
        vm.prank(alice);
        vm.expectRevert();
        moderation.reportWallet(alice, OnchainModeration.ReportCategory.SPAM);
    }

    function test_UpdateReportStatus() public {
        vm.prank(alice);
        uint256 reportId = moderation.reportEntry(1, OnchainModeration.ReportCategory.SPAM);

        vm.prank(moderator);
        moderation.updateReportStatus(reportId, OnchainModeration.ReportStatus.RESOLVED);

        OnchainModeration.Report memory report = moderation.getReport(reportId);
        assertEq(uint8(report.status), uint8(OnchainModeration.ReportStatus.RESOLVED));
        assertEq(report.resolvedBy, moderator);
        assertGt(report.resolvedAt, 0);
    }

    function test_UnauthorizedReportStatusUpdate_Reverts() public {
        vm.prank(alice);
        uint256 reportId = moderation.reportEntry(1, OnchainModeration.ReportCategory.SPAM);

        vm.prank(bob);
        vm.expectRevert();
        moderation.updateReportStatus(reportId, OnchainModeration.ReportStatus.RESOLVED);
    }

    function test_RecordAuditEntry() public {
        vm.prank(moderator);
        uint256 auditId = moderation.recordAuditEntry(
            OnchainTypes.ModerationAction.HIDE,
            42,
            address(0)
        );

        OnchainModeration.AuditEntry memory audit = moderation.getAuditEntry(auditId);
        assertEq(audit.actor, moderator);
        assertEq(uint8(audit.action), uint8(OnchainTypes.ModerationAction.HIDE));
        assertEq(audit.targetEntryId, 42);
    }

    function test_SetModerationMode() public {
        vm.prank(admin);
        moderation.setModerationMode(OnchainTypes.ModerationMode.STRICT);
        assertEq(uint8(moderation.moderationMode()), uint8(OnchainTypes.ModerationMode.STRICT));
    }

    function test_UnauthorizedSetMode_Reverts() public {
        vm.prank(alice);
        vm.expectRevert();
        moderation.setModerationMode(OnchainTypes.ModerationMode.STRICT);
    }

    function test_DisableReporting() public {
        vm.prank(admin);
        moderation.setReportingEnabled(false);

        vm.prank(alice);
        vm.expectRevert();
        moderation.reportEntry(1, OnchainModeration.ReportCategory.SPAM);
    }

    function test_TotalCounts() public {
        vm.prank(alice);
        moderation.reportEntry(1, OnchainModeration.ReportCategory.SPAM);

        vm.prank(bob);
        moderation.reportEntry(2, OnchainModeration.ReportCategory.HARASSMENT);

        assertEq(moderation.totalReports(), 2);
    }
}
