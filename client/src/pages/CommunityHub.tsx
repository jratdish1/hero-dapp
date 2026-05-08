import CommunityFeed from "@/components/CommunityFeed";
import QuickVote from "@/components/QuickVote";
import CommunityStats from "@/components/CommunityStats";
import { useNetwork } from "@/contexts/NetworkContext";

export default function CommunityHub() {
  const { isPulseChain } = useNetwork();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Page Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          HERO Community Hub
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Governance, proposals, community updates — all in one place
        </p>
      </div>

      {/* Community Stats Banner */}
      <CommunityStats />

      {/* Two Column Layout: Feed + Voting */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Community Feed - 2/3 width */}
        <div className="lg:col-span-2">
          <CommunityFeed />
        </div>

        {/* Quick Vote Sidebar - 1/3 width */}
        <div>
          <QuickVote />
        </div>
      </div>
    </div>
  );
}
