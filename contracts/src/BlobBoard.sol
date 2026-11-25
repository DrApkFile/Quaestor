// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Stateless public ciphertext event board; anyone may post.
/// @dev sha3 is an unverified FIPS 202 SHA3-256 label: the EVM has no SHA3-256 opcode.
/// Readers recompute the hash; authoritative ciphertext anchors live in Books.
/// @custom:security-contact https://github.com/DrApkFile/Quaestor/issues
contract BlobBoard {
    error EmptyBlob();
    error BlobTooLarge();
    event Blob(bytes32 indexed kind, bytes32 indexed sha3, address indexed poster, bytes data);
    /// @notice Anyone may emit a blob of 1-24,576 bytes; no state is stored.
    /// @dev EmptyBlob means zero bytes; BlobTooLarge means more than 24,576 bytes.
    /// kind and sha3 are caller-supplied labels, not verified here.
    function post(bytes32 kind, bytes32 sha3, bytes calldata data) external {
        if (data.length == 0) revert EmptyBlob();
        if (data.length > 24576) revert BlobTooLarge();
        emit Blob(kind, sha3, msg.sender, data);
    }
}
