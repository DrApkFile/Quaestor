// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

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
