import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAccount } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserPlus, Vote, Award, Shield } from "lucide-react";
import { ConnectWalletPrompt } from "@/components/ConnectWalletPrompt";

export default function Delegates() {
  const { user } = useAuth();
  const { address, isConnected } = useAccount();
  const [showRegister, setShowRegister] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [statement, setStatement] = useState("");
  const [error, setError] = useState("");

  const { data: delegates, isLoading } = trpc.dao.delegates.list.useQuery({ limit: 100 });
  const { data: myDelegate } = trpc.dao.delegates.byAddress.useQuery(
    { address: address || "" },
    { enabled: !!address }
  );

  const utils = trpc.useUtils();
  const register = trpc.dao.delegates.register.useMutation({
    onSuccess: () => {
      utils.dao.delegates.list.invalidate();
      utils.dao.delegates.byAddress.invalidate({ address: address || "" });
      setShowRegister(false);
      setDisplayName("");
      setStatement("");
    },
    onError: (err) => setError(err.message),
  });

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!address) { setError("Connect wallet first"); return; }
    register.mutate({
      address,
      displayName: displayName.trim() || undefined,
      statement: statement.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Delegates
          </h1>
          <p className="text-muted-foreground mt-1">
            Delegate your voting power or become a delegate to represent the HERO community.
          </p>
        </div>
        {isConnected && user && !myDelegate && (
          <Button className="gap-2" onClick={() => setShowRegister(!showRegister)}>
            <UserPlus className="h-4 w-4" />
            Become a Delegate
          </Button>
        )}
        {myDelegate && (
          <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30 py-1.5 px-3">
            <Shield className="h-3.5 w-3.5 mr-1" />
            You are a Delegate
          </Badge>
        )}
      </div>

      {/* Registration Form */}
      {showRegister && (
        <Card className="bg-card text-card-foreground border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Register as Delegate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5">Display Name (optional)</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name..."
                  maxLength={128}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Delegate Statement (optional)</label>
                <Textarea
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  placeholder="Why should people delegate to you? What's your vision for HERO?"
                  rows={4}
                  maxLength={5000}
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={register.isPending}>
                  {register.isPending ? "Registering..." : "Register"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowRegister(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Delegates List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : delegates && delegates.length > 0 ? (
          delegates.map((d, i) => (
            <Card key={d.id} className="bg-card text-card-foreground border-border hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {/* Rank */}
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold shrink-0">
                    {i + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">
                        {d.displayName || `${d.address.slice(0, 6)}...${d.address.slice(-4)}`}
                      </h3>
                      {d.address === address && (
                        <Badge variant="outline" className="text-xs bg-primary/10">You</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{d.address}</p>
                    {d.statement && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{d.statement}</p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-center">
                      <p className="text-lg font-bold">{d.votingPower.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Voting Power</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold">{d.delegatorCount}</p>
                      <p className="text-xs text-muted-foreground">Delegators</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold">{d.proposalsVoted}</p>
                      <p className="text-xs text-muted-foreground">Votes Cast</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="bg-card text-card-foreground border-border">
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-1">No Delegates Yet</h3>
              <p className="text-muted-foreground mb-4">
                Be the first to register as a delegate and represent the HERO community.
              </p>
              {isConnected && user ? (
                <Button onClick={() => setShowRegister(true)}>Become a Delegate</Button>
              ) : !isConnected ? (
                <ConnectWalletPrompt
                  message="Connect your wallet to become a delegate."
                  subMessage="Delegates represent the HERO community in governance votes."
                  icon="shield"
                  variant="inline"
                />
              ) : (
                <p className="text-sm text-muted-foreground">Sign in to register as a delegate.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delegation Info */}
      <Card className="bg-card text-card-foreground border-border">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Vote className="h-4 w-4 text-primary" />
                How Delegation Works
              </h3>
              <p className="text-sm text-muted-foreground">
                Delegate your HERO voting power to a trusted community member. They vote on your behalf while you keep your tokens.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Revocable Anytime
              </h3>
              <p className="text-sm text-muted-foreground">
                Delegations can be revoked at any time. Your tokens are never locked or transferred — only the voting weight moves.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                Delegate Rewards
              </h3>
              <p className="text-sm text-muted-foreground">
                Active delegates who consistently vote and participate in governance may receive recognition and future incentives.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
