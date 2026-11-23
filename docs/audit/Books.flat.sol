// Source git commit: c380d9f71774a2b5a066c4f3e2a827bb8a2668b8
// Diana (qorechain-diana, EVM 9800): 0x9775c1d0dc814e41fb1b38d26fa17f60d24faf64
// File SHA-256 (this field normalized to 64 zeros): 19224f8a006edcc7e635a8da83445214aa954be2961fe4ff02bf03159f06b4e4
// SPDX-License-Identifier: MIT
pragma solidity =0.8.24;

// src/Books.sol

interface IQoreBooksPQC {
    function pqcKeyStatus(address account) external view returns (bool, uint8, bytes memory, bool);
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message) external view returns (bool);
}

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

    function provenKey(address owner) private view returns (bytes memory) {
        (bool registered, uint8 algorithm, bytes memory key, bool proven) = KEYS.pqcKeyStatus(owner);
        if (!registered || key.length != 2592) revert NoPqKey();
        if (algorithm != 1) revert WrongAlgorithm();
        if (!proven) revert PossessionNotProven();
        return key;
    }
    function requireOwner(bytes32 book) private view {
        if (books[book] != msg.sender) revert NotOwner();
    }
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
    function anchorGrant(bytes32 book, bytes32 period, address auditor, bytes32 grantSha3) external {
        requireOwner(book);
        if (auditor == address(0) || grantSha3 == bytes32(0)) revert ZeroHash();
        if (grants[book][period][auditor] != bytes32(0)) revert GrantExists();
        grants[book][period][auditor] = grantSha3;
        emit GrantAnchored(book, period, auditor, grantSha3);
    }
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

