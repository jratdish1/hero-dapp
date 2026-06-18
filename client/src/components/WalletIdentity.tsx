/**
 * WalletIdentity — minimal build-compatibility stub.
 *
 * The original WalletIdentity source was removed in a prior commit.
 * This stub restores build compatibility by rendering a minimal
 * address display with optional avatar placeholder.
 *
 * NO wallet custody logic.
 * NO private key handling.
 * NO contract writes.
 * NO new API calls.
 *
 * build-hotfix: stale WalletIdentity source restored as minimal stub.
 */

interface WalletIdentityProps {
  address?: string | null;
  showAvatar?: boolean;
  size?: "sm" | "md" | "lg";
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const SIZE_CLASSES: Record<string, string> = {
  sm: "text-xs gap-1",
  md: "text-sm gap-1.5",
  lg: "text-base gap-2",
};

const AVATAR_SIZES: Record<string, string> = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

export function WalletIdentity({
  address,
  showAvatar = false,
  size = "md",
}: WalletIdentityProps) {
  if (!address) return null;

  return (
    <div className={`flex items-center font-mono text-muted-foreground ${SIZE_CLASSES[size] ?? SIZE_CLASSES.md}`}>
      {showAvatar && (
        <div
          className={`rounded-full bg-amber-500/20 border border-amber-500/30 flex-shrink-0 ${AVATAR_SIZES[size] ?? AVATAR_SIZES.md}`}
          aria-hidden="true"
        />
      )}
      <span title={address}>{truncateAddress(address)}</span>
    </div>
  );
}

export default WalletIdentity;

/**
 * IdentityBadge — minimal address badge for DAO voter display.
 * build-hotfix: added as named export to satisfy ProposalDetail import.
 */
export function IdentityBadge({ address }: { address?: string | null }) {
  if (!address) return null;
  return (
    <span className="font-mono text-xs text-muted-foreground" title={address}>
      {address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address}
    </span>
  );
}
