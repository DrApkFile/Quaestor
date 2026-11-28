pragma solidity 0.8.24;
import {Test} from "forge-std/Test.sol";
import {Books, IQoreBooksPQC} from "../src/Books.sol";

contract BooksTest is Test {
    Books private ledger;
    address private owner = address(0xb0b);
    bytes32 private book;
    bytes32 private period = keccak256("2026-11-20");
    bytes private key;
    function setUp() public {
        ledger = new Books();
        key = new bytes(2592);
        vm.etch(address(0x0a02), hex"00");
        vm.etch(address(0x0a01), hex"00");
        status(true, 1, true);
        vm.prank(owner); book = ledger.registerBook(bytes32(uint256(1)), bytes32(uint256(88)));
    }
    function status(bool registered, uint8 algorithm, bool proven) private {
        vm.mockCall(address(0x0a02), abi.encodeCall(IQoreBooksPQC.pqcKeyStatus, (owner)), abi.encode(registered, algorithm, key, proven));
    }
    function testRegistrationRequiresProvenAlgorithmOne() public {
        status(false, 0, false); vm.expectRevert(Books.NoPqKey.selector); vm.prank(owner); ledger.registerBook(bytes32(uint256(2)), bytes32(uint256(88)));
        status(true, 2, true); vm.expectRevert(Books.WrongAlgorithm.selector); vm.prank(owner); ledger.registerBook(bytes32(uint256(2)), bytes32(uint256(88)));
        status(true, 1, false); vm.expectRevert(Books.PossessionNotProven.selector); vm.prank(owner); ledger.registerBook(bytes32(uint256(2)), bytes32(uint256(88)));
    }
    function assertPeriodUnchanged(uint64 expectedIndex, bytes32 expectedLast) private view {
        (uint64 index, bytes32 last, bool closed, bytes32 closeHash) = ledger.periods(book, period);
        assertEq(index, expectedIndex); assertEq(last, expectedLast);
        assertFalse(closed); assertEq(closeHash, bytes32(0));
    }
    function testRejectsWrongOwner() public {
        vm.expectRevert(Books.NotOwner.selector); ledger.anchorEntry(book, period, 0, bytes32(uint256(1)), bytes32(0));
        vm.expectRevert(Books.NotOwner.selector); ledger.anchorGrant(book, period, address(2), bytes32(uint256(1)));
        vm.expectRevert(Books.NotOwner.selector); ledger.closePeriod(book, period, 0, bytes32(0), bytes32(uint256(1)), hex"01");
    }
    function testQ1UnauthorizedCallsPreserveState() public {
        vm.prank(owner); ledger.anchorEntry(book, period, 0, bytes32(uint256(4)), bytes32(0));
        vm.expectRevert(Books.NotOwner.selector); ledger.anchorEntry(book, period, 1, bytes32(uint256(5)), bytes32(uint256(4)));
        vm.expectRevert(Books.NotOwner.selector); ledger.anchorGrant(book, period, address(2), bytes32(uint256(1)));
        vm.expectRevert(Books.NotOwner.selector); ledger.closePeriod(book, period, 1, bytes32(uint256(4)), bytes32(uint256(1)), hex"01");
        assertPeriodUnchanged(1, bytes32(uint256(4)));
        (bytes32 anchored, bytes32 previous) = ledger.entryAnchors(book, period, 1);
        assertEq(anchored, bytes32(0)); assertEq(previous, bytes32(0));
        assertEq(ledger.grants(book, period, address(2)), bytes32(0));
    }
    function testQ2MaximumIndexPanicsAndRollsBack() public {
        bytes32 slot = keccak256(abi.encode(period, keccak256(abi.encode(book, uint256(2)))));
        vm.store(address(ledger), slot, bytes32(uint256(type(uint64).max)));
        assertPeriodUnchanged(type(uint64).max, bytes32(0));
        vm.expectRevert(abi.encodeWithSignature("Panic(uint256)", uint256(0x11))); vm.prank(owner);
        ledger.anchorEntry(book, period, type(uint64).max, bytes32(uint256(5)), bytes32(0));
        assertPeriodUnchanged(type(uint64).max, bytes32(0));
        (bytes32 anchored, bytes32 previous) = ledger.entryAnchors(book, period, type(uint64).max);
        assertEq(anchored, bytes32(0)); assertEq(previous, bytes32(0));
    }
    function testQ3WrongLengthKeyFailsClosed() public {
        key = new bytes(2591); status(true, 1, true);
        vm.expectRevert(Books.NoPqKey.selector); vm.prank(owner);
        ledger.closePeriod(book, period, 0, bytes32(0), bytes32(uint256(3)), hex"01");
        assertPeriodUnchanged(0, bytes32(0));
    }
    function testQ3MissingKeyPrecompileFailsClosed() public {
        vm.clearMockedCalls(); vm.etch(address(0x0a02), hex"");
        vm.expectRevert(); vm.prank(owner);
        ledger.closePeriod(book, period, 0, bytes32(0), bytes32(uint256(3)), hex"01");
        assertPeriodUnchanged(0, bytes32(0));
    }
    function testQ3MissingVerifyPrecompileFailsClosed() public {
        vm.etch(address(0x0a01), hex"");
        vm.expectRevert(); vm.prank(owner);
        ledger.closePeriod(book, period, 0, bytes32(0), bytes32(uint256(3)), hex"01");
        assertPeriodUnchanged(0, bytes32(0));
    }
    function testQ4SameSaltCannotTakeAnotherOwnersBook() public {
        address attacker = address(0x123); bytes32 salt = bytes32(uint256(42));
        vm.mockCall(address(0x0a02), abi.encodeCall(IQoreBooksPQC.pqcKeyStatus, (attacker)), abi.encode(true, uint8(1), key, true));
        vm.prank(attacker); bytes32 attackerBook = ledger.registerBook(salt, bytes32(uint256(88)));
        vm.prank(owner); bytes32 ownerBook = ledger.registerBook(salt, bytes32(uint256(88)));
        assertNotEq(attackerBook, ownerBook);
        assertEq(ownerBook, keccak256(abi.encodePacked(owner, salt)));
        assertEq(ledger.books(ownerBook), owner); assertEq(ledger.books(attackerBook), attacker);
    }
    function testRejectsOutOfOrderAndBrokenPreviousHash() public {
        vm.prank(owner); ledger.anchorEntry(book, period, 0, bytes32(uint256(4)), bytes32(0));
        vm.expectRevert(Books.BadIndex.selector); vm.prank(owner); ledger.anchorEntry(book, period, 0, bytes32(uint256(5)), bytes32(uint256(4)));
        vm.expectRevert(Books.BrokenChain.selector); vm.prank(owner); ledger.anchorEntry(book, period, 1, bytes32(uint256(5)), bytes32(0));
    }
    function testCloseBindsExactDomainAndLocksEntries() public {
        bytes32 closeHash = bytes32(uint256(9)); bytes memory signature = hex"0102";
        bytes32 digest = keccak256(abi.encodePacked("quaestor:close", block.chainid, address(ledger), book, period, uint64(0), bytes32(0), closeHash));
        vm.mockCall(address(0x0a01), abi.encodeCall(IQoreBooksPQC.pqcVerify, (key, signature, abi.encodePacked(digest))), abi.encode(true));
        vm.prank(owner); ledger.closePeriod(book, period, 0, bytes32(0), closeHash, signature);
        (,,bool closed, bytes32 stored) = ledger.periods(book, period);
        assertTrue(closed); assertEq(stored, closeHash);
        vm.expectRevert(Books.PeriodClosed.selector); vm.prank(owner); ledger.anchorEntry(book, period, 0, closeHash, bytes32(0));
        vm.expectRevert(Books.PeriodClosed.selector); vm.prank(owner); ledger.closePeriod(book, period, 0, bytes32(0), closeHash, signature);
    }
    function testBadSignatureRefusedAndPeriodRemainsOpen() public {
        vm.mockCall(address(0x0a01), abi.encodeWithSelector(IQoreBooksPQC.pqcVerify.selector), abi.encode(false));
        vm.expectRevert(Books.BadSignature.selector); vm.prank(owner); ledger.closePeriod(book, period, 0, bytes32(0), bytes32(uint256(3)), hex"01");
        (,,bool closed,) = ledger.periods(book, period); assertFalse(closed);
    }
    function testS2_4TruncatedAndEmptySignaturesRevertBadSignatureAndPreserveOpenPeriod() public {
        bytes32 closeHash = bytes32(uint256(3));
        bytes32 digest = keccak256(abi.encodePacked("quaestor:close", block.chainid, address(ledger), book, period, uint64(0), bytes32(0), closeHash));
        bytes memory truncated = new bytes(4626);
        vm.mockCall(address(0x0a01), abi.encodeCall(IQoreBooksPQC.pqcVerify, (key, truncated, abi.encodePacked(digest))), abi.encode(false));
        vm.mockCall(address(0x0a01), abi.encodeCall(IQoreBooksPQC.pqcVerify, (key, hex"", abi.encodePacked(digest))), abi.encode(false));
        vm.expectRevert(Books.BadSignature.selector); vm.prank(owner);
        ledger.closePeriod(book, period, 0, bytes32(0), closeHash, truncated);
        assertPeriodUnchanged(0, bytes32(0));
        vm.expectRevert(Books.BadSignature.selector); vm.prank(owner);
        ledger.closePeriod(book, period, 0, bytes32(0), closeHash, hex"");
        assertPeriodUnchanged(0, bytes32(0));
    }
    function testS2_3OneBooksGrowthCannotWriteAnotherBook() public {
        vm.prank(owner); bytes32 other = ledger.registerBook(bytes32(uint256(17)), bytes32(uint256(88)));
        for (uint64 i = 0; i < 20; i++) {
            vm.prank(owner); ledger.anchorEntry(book, period, i, bytes32(uint256(i + 1)), bytes32(uint256(i)));
        }
        (uint64 index, bytes32 last, bool closed, bytes32 closeHash) = ledger.periods(other, period);
        assertEq(index, 0); assertEq(last, bytes32(0)); assertFalse(closed); assertEq(closeHash, bytes32(0));
        vm.prank(owner); ledger.anchorEntry(other, period, 0, bytes32(uint256(55)), bytes32(0));
        (index,,,) = ledger.periods(other, period); assertEq(index, 1);
    }
    function testGrantAfterCloseAllowedButCannotBeOverwritten() public {
        vm.mockCall(address(0x0a01), abi.encodeWithSelector(IQoreBooksPQC.pqcVerify.selector), abi.encode(true));
        vm.prank(owner); ledger.closePeriod(book, period, 0, bytes32(0), bytes32(uint256(3)), hex"01");
        vm.prank(owner); ledger.anchorGrant(book, period, address(2), bytes32(uint256(7)));
        assertEq(ledger.grants(book, period, address(2)), bytes32(uint256(7)));
        vm.expectRevert(Books.GrantExists.selector); vm.prank(owner); ledger.anchorGrant(book, period, address(2), bytes32(uint256(8)));
    }
    function testDuplicateBookRefused() public {
        vm.expectRevert(Books.BookExists.selector); vm.prank(owner); ledger.registerBook(bytes32(uint256(1)), bytes32(uint256(88)));
    }
    function testCloseRejectsMisstatedCountOrLastHash() public {
        vm.prank(owner); ledger.anchorEntry(book, period, 0, bytes32(uint256(4)), bytes32(0));
        vm.expectRevert(Books.BadEntryCount.selector); vm.prank(owner);
        ledger.closePeriod(book, period, 0, bytes32(uint256(4)), bytes32(uint256(9)), hex"01");
        vm.expectRevert(Books.BadLastHash.selector); vm.prank(owner);
        ledger.closePeriod(book, period, 1, bytes32(uint256(5)), bytes32(uint256(9)), hex"01");
    }
    function testOpeningHashIsRequiredAndAnchoredAtRegistration() public {
        assertEq(ledger.openings(book), bytes32(uint256(88)));
        vm.expectRevert(Books.ZeroHash.selector); vm.prank(owner);
        ledger.registerBook(bytes32(uint256(7)), bytes32(0));
    }
}
