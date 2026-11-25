// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title LegalDocumentRegistry
 * @notice Append-only registry of SHA-256 content hashes for legal documents.
 *         Only hashes and opaque identifiers are stored on-chain; never files or personal data.
 */
contract LegalDocumentRegistry {
    struct VersionRecord {
        bytes32 contentHash; // SHA-256 of the original file bytes
        address registrar;   // account that submitted the transaction
        bytes32 uploaderRef; // keccak256 of an off-chain user id (pseudonymous)
        uint64 timestamp;    // block timestamp
        uint32 version;      // 1-based
    }

    address public owner;
    mapping(address => bool) public registrars;
    mapping(bytes32 => VersionRecord[]) private _versions;

    event DocumentRegistered(
        bytes32 indexed documentId,
        uint32 indexed version,
        bytes32 contentHash,
        address indexed registrar,
        bytes32 uploaderRef,
        uint64 timestamp
    );
    event RegistrarUpdated(address indexed account, bool allowed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error NotRegistrar();
    error AlreadyRegistered(bytes32 documentId);
    error NotRegisteredYet(bytes32 documentId);
    error EmptyHash();
    error DuplicateHash(bytes32 documentId, bytes32 contentHash);
    error VersionOutOfRange(bytes32 documentId, uint32 version);
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRegistrar() {
        if (!registrars[msg.sender]) revert NotRegistrar();
        _;
    }

    constructor() {
        owner = msg.sender;
        registrars[msg.sender] = true;
        emit OwnershipTransferred(address(0), msg.sender);
        emit RegistrarUpdated(msg.sender, true);
    }

    function setRegistrar(address account, bool allowed) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        registrars[account] = allowed;
        emit RegistrarUpdated(account, allowed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Registers version 1 of a document.
    function registerDocument(bytes32 documentId, bytes32 contentHash, bytes32 uploaderRef)
        external
        onlyRegistrar
        returns (uint32)
    {
        if (contentHash == bytes32(0)) revert EmptyHash();
        if (_versions[documentId].length != 0) revert AlreadyRegistered(documentId);
        return _append(documentId, contentHash, uploaderRef);
    }

    /// @notice Appends a new version. Earlier versions are never modified.
    function registerVersion(bytes32 documentId, bytes32 contentHash, bytes32 uploaderRef)
        external
        onlyRegistrar
        returns (uint32)
    {
        if (contentHash == bytes32(0)) revert EmptyHash();
        VersionRecord[] storage list = _versions[documentId];
        if (list.length == 0) revert NotRegisteredYet(documentId);
        if (list[list.length - 1].contentHash == contentHash) {
            revert DuplicateHash(documentId, contentHash);
        }
        return _append(documentId, contentHash, uploaderRef);
    }

    function _append(bytes32 documentId, bytes32 contentHash, bytes32 uploaderRef)
        private
        returns (uint32 version)
    {
        VersionRecord[] storage list = _versions[documentId];
        version = uint32(list.length + 1);
        uint64 ts = uint64(block.timestamp);
        list.push(VersionRecord(contentHash, msg.sender, uploaderRef, ts, version));
        emit DocumentRegistered(documentId, version, contentHash, msg.sender, uploaderRef, ts);
    }

    function isRegistered(bytes32 documentId) external view returns (bool) {
        return _versions[documentId].length != 0;
    }

    function getVersionCount(bytes32 documentId) external view returns (uint32) {
        return uint32(_versions[documentId].length);
    }

    function getVersion(bytes32 documentId, uint32 version) external view returns (VersionRecord memory) {
        VersionRecord[] storage list = _versions[documentId];
        if (version == 0 || version > list.length) revert VersionOutOfRange(documentId, version);
        return list[version - 1];
    }

    function getLatest(bytes32 documentId) external view returns (VersionRecord memory) {
        VersionRecord[] storage list = _versions[documentId];
        if (list.length == 0) revert NotRegisteredYet(documentId);
        return list[list.length - 1];
    }

    function getHash(bytes32 documentId, uint32 version) external view returns (bytes32) {
        VersionRecord[] storage list = _versions[documentId];
        if (version == 0 || version > list.length) revert VersionOutOfRange(documentId, version);
        return list[version - 1].contentHash;
    }

    /// @notice True only if `version` exists and its registered hash equals `contentHash`.
    function verifyDocument(bytes32 documentId, uint32 version, bytes32 contentHash)
        external
        view
        returns (bool)
    {
        VersionRecord[] storage list = _versions[documentId];
        if (version == 0 || version > list.length) return false;
        return list[version - 1].contentHash == contentHash;
    }
}
