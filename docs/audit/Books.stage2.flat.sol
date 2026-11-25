// Source git commit: d8fad814e7f3fd10caac7536db76f997b01b7d63
// Diana (qorechain-diana, EVM 9800): 0x9775c1d0dc814e41fb1b38d26fa17f60d24faf64
// File SHA-256 (this field normalized to 64 zeros): 1849e5b596eeddf7a19964cef6cd2521f3d5012eff31a9572144d68d34ba8e49
// Logic identical to deployed bytecode; see evidence/m11-bytecode-equivalence.json
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice QoreChain ML-DSA-87 (FIPS 204, 2592-byte public key) precompile ABI.
interface IQoreBooksPQC {
    /// @notice Public read at 0x0A02; returns registration, algorithm, key and possession-proven status.
    /// @dev Missing or malformed return data makes callers fail closed during ABI decoding.
    function pqcKeyStatus(address account) external view returns (bool, uint8, bytes memory, bool);
    /// @notice Public read at 0x0A01; verifies pure ML-DSA-87 with empty context.
    /// @dev Returns false for invalid signatures; missing or malformed data fails closed at the caller.
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool);
}

/// @notice Owner-authorized ciphertext anchors and ML-DSA-87 authenticated period closes.
/// @custom:security-contact https://github.com/DrApkFile/Quaestor/issues
contract Books {
    error NoPqKey();
    error WrongAlgorithm();
    error PossessionNotProven();
    error NotOwner();
    error BookExists();
    error PeriodClosed();
    error BadIndex();
    error BrokenChain();
    error ZeroHash();
    error BadSignature();
    error GrantExists();
    error BadEntryCount();
    error BadLastHash();
    event OpeningAnchored(bytes32 indexed book, bytes32 openingSha3);
    event BookRegistered(bytes32 indexed book, address indexed owner);
    event EntryAnchored(bytes32 indexed book, bytes32 indexed period, uint64 index, bytes32 blobSha3, bytes32 prevSha3);
    event GrantAnchored(bytes32 indexed book, bytes32 indexed period, address indexed auditor, bytes32 grantSha3);
    event PeriodClosedEvent(bytes32 indexed book, bytes32 indexed period, bytes32 closeSha3);
    struct Period { uint64 nextIndex; bytes32 lastSha3; bool closed; bytes32 closeSha3; }
    struct Anchor { bytes32 blobSha3; bytes32 prevSha3; }
    mapping(bytes32 => address) public books;
    mapping(bytes32 => bytes32) public openings;
    mapping(bytes32 => mapping(bytes32 => Period)) public periods;
    mapping(bytes32 => mapping(bytes32 => mapping(uint64 => Anchor))) public entryAnchors;
    mapping(bytes32 => mapping(bytes32 => mapping(address => bytes32))) public grants;
    IQoreBooksPQC private constant KEYS = IQoreBooksPQC(address(0x0a02));
    IQoreBooksPQC private constant VERIFY = IQoreBooksPQC(address(0x0a01));

    /// @notice Internal callers only: query QoreChain pqcKeyStatus at 0x0A02.
    /// @dev NoPqKey means unregistered or key length != 2592; WrongAlgorithm means algorithm != 1
    /// (ML-DSA-87, FIPS 204); PossessionNotProven means possession is not proven.
    /// Missing precompile or malformed data reverts; unregistered (false) status fails closed.
    function provenKey(address owner) private view returns (bytes memory) {
        (bool registered, uint8 algorithm, bytes memory key, bool proven) = KEYS.pqcKeyStatus(owner);
        if (!registered || key.length != 2592) revert NoPqKey();
        if (algorithm != 1) revert WrongAlgorithm();
        if (!proven) revert PossessionNotProven();
        return key;
    }
    /// @notice Internal callers only: require the registering address as msg.sender.
    /// @dev NotOwner means sender differs from books[book], including an unregistered book.
    function requireOwner(bytes32 book) private view {
        if (books[book] != msg.sender) revert NotOwner();
    }
    /// @notice Anyone with a registered, possession-proven ML-DSA-87 key may register.
    /// @dev Checks provenKey (NoPqKey, WrongAlgorithm, PossessionNotProven or ABI failure).
    /// ZeroHash means empty opening anchor; BookExists means sender/salt already registered.
    /// The ID is keccak256(abi.encodePacked(msg.sender, salt)).
    function registerBook(bytes32 salt, bytes32 openingSha3) external returns (bytes32 book) {
        provenKey(msg.sender);
        if (openingSha3 == bytes32(0)) revert ZeroHash();
        book = keccak256(abi.encodePacked(msg.sender, salt));
        if (books[book] != address(0)) revert BookExists();
        books[book] = msg.sender;
        openings[book] = openingSha3;
        emit OpeningAnchored(book, openingSha3);
        emit BookRegistered(book, msg.sender);
    }
    /// @notice Only the registered owner may append an entry; NotOwner rejects other senders.
    /// @dev PeriodClosed rejects a closed period; BadIndex rejects a nonsequential index;
    /// BrokenChain rejects a previous hash unequal to lastSha3; ZeroHash rejects an empty anchor.
    /// Checked uint64 increment panics with 0x11 at maximum index, rolling back all writes.
    function anchorEntry(bytes32 book, bytes32 period, uint64 index, bytes32 blobSha3, bytes32 prevSha3) external {
        requireOwner(book);
        Period storage state = periods[book][period];
        if (state.closed) revert PeriodClosed();
        if (index != state.nextIndex) revert BadIndex();
        if (prevSha3 != state.lastSha3) revert BrokenChain();
        if (blobSha3 == bytes32(0)) revert ZeroHash();
        entryAnchors[book][period][index] = Anchor(blobSha3, prevSha3);
        state.lastSha3 = blobSha3;
        state.nextIndex = index + 1;
        emit EntryAnchored(book, period, index, blobSha3, prevSha3);
    }
    /// @notice Only the registered owner may grant, including after close; otherwise NotOwner.
    /// @dev ZeroHash rejects a zero auditor or anchor; GrantExists rejects overwriting a grant.
    function anchorGrant(bytes32 book, bytes32 period, address auditor, bytes32 grantSha3) external {
        requireOwner(book);
        if (auditor == address(0) || grantSha3 == bytes32(0)) revert ZeroHash();
        if (grants[book][period][auditor] != bytes32(0)) revert GrantExists();
        grants[book][period][auditor] = grantSha3;
        emit GrantAnchored(book, period, auditor, grantSha3);
    }
    /// @notice Only the registered owner may close; other senders revert NotOwner.
    /// @dev PeriodClosed means already closed; BadEntryCount or BadLastHash means the stated
    /// final count or hash differs from storage; ZeroHash means an empty close anchor.
    /// provenKey checks NoPqKey, WrongAlgorithm and PossessionNotProven at 0x0A02.
    /// Digest: keccak256(abi.encodePacked("quaestor:close", block.chainid, address(this),
    /// book, period, entryCount, lastEntrySha3, closeSha3)). Types are string, uint256, address,
    /// bytes32, bytes32, uint64, bytes32, bytes32. The 32 digest bytes are the message.
    /// pqcVerify at 0x0A01 uses empty context; domain separation is in the message.
    /// False verification reverts BadSignature; missing precompiles or malformed returns revert.
    /// All failures leave the period open (fail closed).
    function closePeriod(bytes32 book, bytes32 period, uint64 entryCount, bytes32 lastEntrySha3, bytes32 closeSha3, bytes calldata mlDsaSignature) external {
        requireOwner(book);
        Period storage state = periods[book][period];
        if (state.closed) revert PeriodClosed();
        if (entryCount != state.nextIndex) revert BadEntryCount();
        if (lastEntrySha3 != state.lastSha3) revert BadLastHash();
        if (closeSha3 == bytes32(0)) revert ZeroHash();
        bytes memory key = provenKey(msg.sender);
        bytes32 digest = keccak256(abi.encodePacked("quaestor:close", block.chainid, address(this), book, period, entryCount, lastEntrySha3, closeSha3));
        if (!VERIFY.pqcVerify(key, mlDsaSignature, abi.encodePacked(digest))) revert BadSignature();
        state.closed = true;
        state.closeSha3 = closeSha3;
        emit PeriodClosedEvent(book, period, closeSha3);
    }
}
