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
        vm.prank(owner); book = ledger.registerBook(bytes32(uint256(1)));
    }
    function status(bool registered, uint8 algorithm, bool proven) private {
        vm.mockCall(address(0x0a02), abi.encodeCall(IQoreBooksPQC.pqcKeyStatus, (owner)), abi.encode(registered, algorithm, key, proven));
    }
    function testRegistrationRequiresProvenAlgorithmOne() public {
        status(false, 0, false); vm.expectRevert(Books.NoPqKey.selector); vm.prank(owner); ledger.registerBook(bytes32(uint256(2)));
        status(true, 2, true); vm.expectRevert(Books.WrongAlgorithm.selector); vm.prank(owner); ledger.registerBook(bytes32(uint256(2)));
        status(true, 1, false); vm.expectRevert(Books.PossessionNotProven.selector); vm.prank(owner); ledger.registerBook(bytes32(uint256(2)));
    }
    function testRejectsWrongOwner() public {
        vm.expectRevert(Books.NotOwner.selector); ledger.anchorEntry(book, period, 0, bytes32(uint256(1)), bytes32(0));
        vm.expectRevert(Books.NotOwner.selector); ledger.anchorGrant(book, period, address(2), bytes32(uint256(1)));
        vm.expectRevert(Books.NotOwner.selector); ledger.closePeriod(book, period, bytes32(uint256(1)), hex"01");
    }
    function testRejectsOutOfOrderAndBrokenPreviousHash() public {
        vm.prank(owner); ledger.anchorEntry(book, period, 0, bytes32(uint256(4)), bytes32(0));
        vm.expectRevert(Books.BadIndex.selector); vm.prank(owner); ledger.anchorEntry(book, period, 0, bytes32(uint256(5)), bytes32(uint256(4)));
        vm.expectRevert(Books.BrokenChain.selector); vm.prank(owner); ledger.anchorEntry(book, period, 1, bytes32(uint256(5)), bytes32(0));
    }
    function testCloseBindsExactDomainAndLocksEntries() public {
        bytes32 closeHash = bytes32(uint256(9)); bytes memory signature = hex"0102";
        bytes32 digest = keccak256(abi.encodePacked("quaestor:close", block.chainid, address(ledger), book, period, closeHash));
        vm.mockCall(address(0x0a01), abi.encodeCall(IQoreBooksPQC.pqcVerify, (key, signature, abi.encodePacked(digest))), abi.encode(true));
        vm.prank(owner); ledger.closePeriod(book, period, closeHash, signature);
        (,,bool closed, bytes32 stored) = ledger.periods(book, period);
        assertTrue(closed); assertEq(stored, closeHash);
        vm.expectRevert(Books.PeriodClosed.selector); vm.prank(owner); ledger.anchorEntry(book, period, 0, closeHash, bytes32(0));
        vm.expectRevert(Books.PeriodClosed.selector); vm.prank(owner); ledger.closePeriod(book, period, closeHash, signature);
    }
    function testBadSignatureRefusedAndPeriodRemainsOpen() public {
        vm.mockCall(address(0x0a01), abi.encodeWithSelector(IQoreBooksPQC.pqcVerify.selector), abi.encode(false));
        vm.expectRevert(Books.BadSignature.selector); vm.prank(owner); ledger.closePeriod(book, period, bytes32(uint256(3)), hex"01");
        (,,bool closed,) = ledger.periods(book, period); assertFalse(closed);
    }
    function testGrantAfterCloseAllowedButCannotBeOverwritten() public {
        vm.mockCall(address(0x0a01), abi.encodeWithSelector(IQoreBooksPQC.pqcVerify.selector), abi.encode(true));
        vm.prank(owner); ledger.closePeriod(book, period, bytes32(uint256(3)), hex"01");
        vm.prank(owner); ledger.anchorGrant(book, period, address(2), bytes32(uint256(7)));
        assertEq(ledger.grants(book, period, address(2)), bytes32(uint256(7)));
        vm.expectRevert(Books.GrantExists.selector); vm.prank(owner); ledger.anchorGrant(book, period, address(2), bytes32(uint256(8)));
    }
    function testDuplicateBookRefused() public {
        vm.expectRevert(Books.BookExists.selector); vm.prank(owner); ledger.registerBook(bytes32(uint256(1)));
    }
}
