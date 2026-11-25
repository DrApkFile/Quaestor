pragma solidity 0.8.24;
import {Test} from "forge-std/Test.sol";
import {Books, IQoreBooksPQC} from "../src/Books.sol";

contract M12HedgedTest is Test {
    struct Fixture {
        address deployed;
        address owner;
        bytes32 salt;
        bytes32 book;
        bytes32 openingSha3;
        bytes32 closeSha3;
        bytes32 period;
        bytes32 digest;
        bytes key;
        bytes first;
        bytes second;
    }
    function liveFixture() private view returns (Fixture memory f) {
        string memory source = vm.readFile("../evidence/m12-hedged-close.json");
        f.deployed = vm.parseJsonAddress(source, ".contract");
        f.owner = vm.parseJsonAddress(source, ".owner");
        f.salt = vm.parseJsonBytes32(source, ".salt");
        f.book = vm.parseJsonBytes32(source, ".book");
        f.openingSha3 = vm.parseJsonBytes32(source, ".openingSha3");
        f.closeSha3 = vm.parseJsonBytes32(source, ".closeSha3");
        f.period = keccak256(bytes(vm.parseJsonString(source, ".period")));
        f.digest = vm.parseJsonBytes32(source, ".digest");
        f.key = vm.parseJsonBytes(source, ".publicKey");
        f.first = vm.parseJsonBytes(source, ".signature");
        f.second = vm.parseJsonBytes(source, ".secondSignature");
    }
    function testM12BothLiveHedgedSignaturesBindTheExactBooksDigestAndLockThePeriod() public {
        Fixture memory f = liveFixture();
        assertEq(f.key.length, 2592);
        assertEq(f.first.length, 4627);
        assertEq(f.second.length, 4627);
        assertNotEq(keccak256(f.first), keccak256(f.second));
        vm.chainId(9800);
        vm.etch(f.deployed, type(Books).runtimeCode);
        vm.etch(address(0x0a01), hex"00");
        vm.etch(address(0x0a02), hex"00");
        vm.mockCall(address(0x0a02), abi.encodeCall(IQoreBooksPQC.pqcKeyStatus, (f.owner)), abi.encode(true, uint8(1), f.key, true));
        Books ledger = Books(f.deployed);
        vm.prank(f.owner);
        assertEq(ledger.registerBook(f.salt, f.openingSha3), f.book);
        bytes32 digest = keccak256(abi.encodePacked("quaestor:close", block.chainid, f.deployed, f.book, f.period, uint64(0), bytes32(0), f.closeSha3));
        assertEq(digest, f.digest);
        bytes[2] memory signatures = [f.first, f.second];
        for (uint256 i; i < signatures.length; ++i) {
            uint256 snapshot = vm.snapshotState();
            vm.mockCall(address(0x0a01), abi.encodeCall(IQoreBooksPQC.pqcVerify, (f.key, signatures[i], abi.encodePacked(digest))), abi.encode(true));
            vm.prank(f.owner);
            ledger.closePeriod(f.book, f.period, 0, bytes32(0), f.closeSha3, signatures[i]);
            (uint64 count, bytes32 last, bool closed, bytes32 stored) = ledger.periods(f.book, f.period);
            assertEq(count, 0);
            assertEq(last, bytes32(0));
            assertTrue(closed);
            assertEq(stored, f.closeSha3);
            vm.expectRevert(Books.PeriodClosed.selector);
            vm.prank(f.owner);
            ledger.anchorEntry(f.book, f.period, 0, f.closeSha3, bytes32(0));
            assertTrue(vm.revertToState(snapshot));
        }
        f.first[0] = bytes1(uint8(f.first[0]) ^ 1);
        vm.mockCall(address(0x0a01), abi.encodeCall(IQoreBooksPQC.pqcVerify, (f.key, f.first, abi.encodePacked(digest))), abi.encode(false));
        vm.expectRevert(Books.BadSignature.selector);
        vm.prank(f.owner);
        ledger.closePeriod(f.book, f.period, 0, bytes32(0), f.closeSha3, f.first);
        (,,bool stillClosed,) = ledger.periods(f.book, f.period);
        assertFalse(stillClosed);
    }
}
