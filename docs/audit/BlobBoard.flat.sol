// Source git commit: c380d9f71774a2b5a066c4f3e2a827bb8a2668b8
// Diana (qorechain-diana, EVM 9800): 0xe79e5a3108d8e856aa7ac770c97ac7af308c1d67
// File SHA-256 (this field normalized to 64 zeros): 32058111885e2031ad1440eebcd13f148dd2803e9e819582fea9bb8726eea095
// SPDX-License-Identifier: MIT
pragma solidity =0.8.24;

// src/BlobBoard.sol

contract BlobBoard {
    error EmptyBlob();
    error BlobTooLarge();
    event Blob(bytes32 indexed kind, bytes32 indexed sha3, address indexed poster, bytes data);
    function post(bytes32 kind, bytes32 sha3, bytes calldata data) external {
        if (data.length == 0) revert EmptyBlob();
        if (data.length > 24576) revert BlobTooLarge();
        emit Blob(kind, sha3, msg.sender, data);
    }
}

