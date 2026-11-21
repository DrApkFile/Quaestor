// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import {Test} from "forge-std/Test.sol";
import {BlobBoard} from "../src/BlobBoard.sol";
contract BlobBoardTest is Test {
    BlobBoard private board;
    event Blob(bytes32 indexed kind, bytes32 indexed sha3, address indexed poster, bytes data);
    function setUp() public { board = new BlobBoard(); }
    function testRejectsEmptyData() public { vm.expectRevert(BlobBoard.EmptyBlob.selector); board.post(bytes32(0), bytes32(0), hex""); }
    function testRejectsMoreThan24576Bytes() public { vm.expectRevert(BlobBoard.BlobTooLarge.selector); board.post(bytes32(0), bytes32(0), new bytes(24577)); }
    function testAcceptsBoundaryAndAnyPosterWithoutStorage() public {
        bytes memory data = new bytes(24576); bytes32 kind = keccak256("quaestor:entry");
        vm.expectEmit(true,true,true,true); emit Blob(kind, bytes32(uint256(7)), address(123), data);
        vm.prank(address(123)); board.post(kind, bytes32(uint256(7)), data);
        assertEq(vm.load(address(board),bytes32(0)),bytes32(0));
    }
    function testPostedHashIsUntrustedMetadata() public {
        vm.expectEmit(true,true,true,true); emit Blob(bytes32(0),bytes32(uint256(42)),address(this),hex"0102");
        board.post(bytes32(0),bytes32(uint256(42)),hex"0102");
    }
}
