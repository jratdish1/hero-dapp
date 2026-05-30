/**
 * WalletIdentity — Enhanced wallet display with on-chain identity resolution.
 * Resolves ENS names, Basenames, and avatars for connected wallets.
 * Falls back gracefully to truncated addresses when no identity is found.
 */
import { useState, useMemo } from "react";
import { useAccount, useEnsName, useEnsAvatar } from "wagmi";
// ENS resolution requires mainnet (chainId 1) but wagmi Register only allows 369|8453
const MAINNET_CHAIN_ID = 1 as unknown as 369;
import { normalize } from "viem/ens";
import { getAddress, isAddress } from "viem";

// ─── Types ──────────────────────────────────────────────────────────────
interface WalletIdentityProps {
  address?: `0x${string}`;
  showAvatar?: boolean;
  showBalance?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// ─── Jazzicon-style gradient avatar ─────────────────────────────────────
function generateGradient(address: string): string {
  // Always use checksummed address for deterministic output
  if (!address || !isAddress(address)) return "linear-gradient(135deg, #666, #333)";
  const checksummed = getAddress(address as `0x${string}`);
  const seed = parseInt(checksummed.slice(2, 10), 16);
  const hue1 = seed % 360;
  const hue2 = (seed * 7) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 60%, 40%))`;
}

// ─── Avatar Component ───────────────────────────────────────────────────
function IdentityAvatar({
  address,
  ensAvatar,
  size = "md",
}: {
  address: string;
  ensAvatar?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizeMap = { sm: "h-6 w-6", md: "h-8 w-8", lg: "h-10 w-10" };
  const [imgError, setImgError] = useState(false);

  if (ensAvatar && !imgError) {
    return (
      <img
        src={ensAvatar}
        alt="Avatar"
        className={`${sizeMap[size]} rounded-full ring-2 ring-hero-orange/30 object-cover`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeMap[size]} rounded-full ring-2 ring-hero-orange/30 flex items-center justify-center text-white font-bold text-xs`}
      style={{ background: generateGradient(address) }}
    >
      {getAddress(address as `0x${string}`).slice(2, 4).toUpperCase()}
    </div>
  );
}

// ─── Name Display ───────────────────────────────────────────────────────
function IdentityName({
  address,
  ensName,
  size = "md",
}: {
  address: string;
  ensName?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const textSize = { sm: "text-xs", md: "text-sm", lg: "text-base" };

  if (ensName) {
    return (
      <span className={`${textSize[size]} font-semibold text-foreground truncate max-w-[120px]`}>
        {ensName}
      </span>
    );
  }

  const checksummed = getAddress(address as `0x${string}`);
  return (
    <span className={`${textSize[size]} font-mono text-foreground/80`}>
      {checksummed.slice(0, 6)}...{checksummed.slice(-4)}
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────
export function WalletIdentity({
  address: propAddress,
  showAvatar = true,
  size = "md",
  className = "",
}: WalletIdentityProps) {
  const { address: connectedAddress } = useAccount();
  const targetAddress = propAddress || connectedAddress;

  // ENS resolution (mainnet)
  const { data: ensName } = useEnsName({
    address: targetAddress,
    chainId: MAINNET_CHAIN_ID,
    query: { enabled: !!targetAddress, staleTime: 1000 * 60 * 60 }, // Cache 1hr
  });

  // Memoize normalize() to prevent unnecessary recalculations
  const normalizedEnsName = useMemo(
    () => (ensName ? normalize(ensName) : undefined),
    [ensName]
  );

  const { data: ensAvatar } = useEnsAvatar({
    name: normalizedEnsName,
    chainId: MAINNET_CHAIN_ID,
    query: { enabled: !!normalizedEnsName, staleTime: 1000 * 60 * 60 },
  });

  if (!targetAddress) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showAvatar && (
        <IdentityAvatar
          address={targetAddress}
          ensAvatar={ensAvatar}
          size={size}
        />
      )}
      <IdentityName
        address={targetAddress}
        ensName={ensName}
        size={size}
      />
    </div>
  );
}

// ─── Compact Badge for DAO voter lists ──────────────────────────────────
export function IdentityBadge({
  address,
  className = "",
}: {
  address: string;
  className?: string;
}) {
  const { data: ensName } = useEnsName({
    address: address as `0x${string}`,
    chainId: MAINNET_CHAIN_ID,
    query: { enabled: !!address, staleTime: 1000 * 60 * 60 },
  });

  // Memoize normalize() to prevent unnecessary recalculations
  const normalizedEnsName = useMemo(
    () => (ensName ? normalize(ensName) : undefined),
    [ensName]
  );

  const { data: ensAvatar } = useEnsAvatar({
    name: normalizedEnsName,
    chainId: MAINNET_CHAIN_ID,
    query: { enabled: !!normalizedEnsName, staleTime: 1000 * 60 * 60 },
  });

  const checksummed = getAddress(address as `0x${string}`);
  const truncated = `${checksummed.slice(0, 6)}...${checksummed.slice(-4)}`;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <IdentityAvatar address={address} ensAvatar={ensAvatar} size="sm" />
      <span className="text-xs font-medium text-foreground/80">
        {ensName || truncated}
      </span>
    </div>
  );
}

export default WalletIdentity;
