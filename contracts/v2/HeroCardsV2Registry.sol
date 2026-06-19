// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HeroCardsV2Registry
 * @notice On-chain module registry for HERO V2 contracts — Architecture Stub (NOT DEPLOYED)
 *
 * @dev Single source of truth for active NFT contracts and modules per chain.
 *      Lets the UI discover current addresses without hardcoding every module.
 *      Only owner/multisig can update. All changes emit events for audit trail.
 *      DO NOT DEPLOY without full audit and explicit GO from VIC Foundation.
 *
 * A+ Fix (2026-06-18) — Canonical Module Naming SOP:
 *   Module names are free-form strings used as keys. To prevent duplicate entries
 *   from casing or typo variations, all module names MUST follow this convention:
 *
 *     SCREAMING_SNAKE_CASE  e.g. "HERO_CARDS_V2", "REWARDS_DISTRIBUTOR",
 *                                "MARKETPLACE", "BUY_BURN_ROUTER"
 *
 *   Enforcement is operational (off-chain SOP), not on-chain, to keep gas costs low.
 *   The registerModule() function is owner-only; the owner is responsible for
 *   ensuring canonical naming before calling. Names are append-only and cannot
 *   be deleted or renamed once registered.
 */

import "@openzeppelin/contracts/access/Ownable2Step.sol";

// ─── Errors ───────────────────────────────────────────────────────────────────
error ModuleNotFound();
error ZeroAddress();

contract HeroCardsV2Registry is Ownable2Step {

    // ─── Types ────────────────────────────────────────────────────────────────
    enum ModuleStatus { UNKNOWN, ACTIVE, PAUSED, DEPRECATED }

    struct Module {
        address addr;
        ModuleStatus status;
        string version;
        uint256 registeredAt;
        uint256 updatedAt;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    /// @dev chainId => moduleName => Module
    mapping(uint256 => mapping(string => Module)) private _modules;
    /// @dev chainId => list of module names
    mapping(uint256 => string[]) private _moduleNames;

    // ─── Events ───────────────────────────────────────────────────────────────
    event ModuleRegistered(uint256 indexed chainId, string name, address addr, string version);
    event ModuleUpdated(uint256 indexed chainId, string name, address oldAddr, address newAddr, string version);
    event ModuleStatusChanged(uint256 indexed chainId, string name, ModuleStatus newStatus);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor() Ownable(msg.sender) {}

    // ─── Registry ─────────────────────────────────────────────────────────────

    /**
     * @notice Register a new module for a given chain.
     * @param chainId The chain ID where the module is deployed.
     * @param name Human-readable module name (e.g., "HeroCardsV2", "HeroCardsMarketplace").
     * @param addr The deployed contract address.
     * @param version Semantic version string (e.g., "2.0.0").
     */
    function registerModule(
        uint256 chainId,
        string calldata name,
        address addr,
        string calldata version
    ) external onlyOwner {
        if (addr == address(0)) revert ZeroAddress();

        Module storage mod = _modules[chainId][name];
        bool isNew = mod.registeredAt == 0;

        address oldAddr = mod.addr;
        mod.addr = addr;
        mod.status = ModuleStatus.ACTIVE;
        mod.version = version;
        mod.updatedAt = block.timestamp;

        if (isNew) {
            mod.registeredAt = block.timestamp;
            _moduleNames[chainId].push(name);
            emit ModuleRegistered(chainId, name, addr, version);
        } else {
            emit ModuleUpdated(chainId, name, oldAddr, addr, version);
        }
    }

    /**
     * @notice Update the status of a registered module.
     */
    function setModuleStatus(
        uint256 chainId,
        string calldata name,
        ModuleStatus status
    ) external onlyOwner {
        Module storage mod = _modules[chainId][name];
        if (mod.registeredAt == 0) revert ModuleNotFound();
        mod.status = status;
        mod.updatedAt = block.timestamp;
        emit ModuleStatusChanged(chainId, name, status);
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    /**
     * @notice Get the active address for a module on a given chain.
     * Returns address(0) if not found or not active.
     */
    function getModule(uint256 chainId, string calldata name) external view returns (address) {
        Module storage mod = _modules[chainId][name];
        if (mod.status != ModuleStatus.ACTIVE) return address(0);
        return mod.addr;
    }

    /**
     * @notice Get full module info for a given chain and name.
     */
    function getModuleInfo(uint256 chainId, string calldata name)
        external
        view
        returns (address addr, ModuleStatus status, string memory version, uint256 registeredAt, uint256 updatedAt)
    {
        Module storage mod = _modules[chainId][name];
        return (mod.addr, mod.status, mod.version, mod.registeredAt, mod.updatedAt);
    }

    /**
     * @notice Get all module names registered for a given chain.
     */
    function getModuleNames(uint256 chainId) external view returns (string[] memory) {
        return _moduleNames[chainId];
    }

    /**
     * @notice Check if a module is active on a given chain.
     */
    function isModuleActive(uint256 chainId, string calldata name) external view returns (bool) {
        return _modules[chainId][name].status == ModuleStatus.ACTIVE;
    }
}
