import { sanitizeString } from "../../lib/validation";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAccount, useSignMessage } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, FileText } from "lucide-react";
import { ConnectWalletPrompt } from "@/components/ConnectWalletPrompt";

interface PendingBinding {
  walletAddress: string;
  challenge: string;
  message: string;
}

export default function CreateProposal() {
  const { user } = useAuth();
  const { address, isConnected } = useAccount();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();
  const [, navigate] = useLocation();

  const validCategories = ["protocol", "treasury", "community", "emergency"] as const;
  const validChains = ["base", "pulsechain", "both"] as const;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"protocol" | "treasury" | "community" | "emergency">("protocol");
  const [chain, setChain] = useState<"base" | "pulsechain" | "both">("both");
  const [durationDays, setDurationDays] = useState(7);
  const [pendingBinding, setPendingBinding] = useState<PendingBinding | null>(null);
  const [error, setError] = useState("");
  const pendingForCurrentWallet = !!address
    && pendingBinding?.walletAddress.toLowerCase() === address.toLowerCase()
    ? pendingBinding
    : null;

  const createProposal = trpc.dao.proposals.create.useMutation({
    onSuccess: (data) => {
      if (!data.success && data.requiresConfirmation) {
        if (!data.bindingChallenge || !data.bindingMessage) {
          setPendingBinding(null);
          setError("The server did not issue a complete wallet-binding challenge.");
          return;
        }
        setPendingBinding({
          walletAddress: data.walletAddress,
          challenge: data.bindingChallenge,
          message: data.bindingMessage,
        });
        setError(data.message);
        return;
      }
      if (data.success && data.proposalId) {
        setPendingBinding(null);
        navigate(`/dao/proposals/${data.proposalId}`);
        return;
      }
      setError("Proposal creation did not return a valid proposal ID.");
    },
    onError: (err) => {
      setPendingBinding(null);
      setError(err.message);
    },
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!sanitizeString(title.trim())) { setError("Title is required"); return; }
    if (!sanitizeString(description.trim())) { setError("Description is required"); return; }
    if (!isConnected || !address) { setError("Connect your wallet to create a proposal"); return; }
    if (!user) { setError("Sign in to create a proposal"); return; }

    let walletSignature: `0x${string}` | undefined;
    if (pendingForCurrentWallet) {
      try {
        walletSignature = await signMessageAsync({ message: pendingForCurrentWallet.message });
      } catch (signatureError) {
        setError(signatureError instanceof Error ? signatureError.message : "Wallet signature was rejected");
        return;
      }
    }

    createProposal.mutate({
      title: sanitizeString(title.trim()),
      description: sanitizeString(description.trim()),
      walletAddress: address,
      category,
      chain,
      durationDays,
      governanceMode: "advisory",
      bindingChallenge: pendingForCurrentWallet?.challenge,
      walletSignature,
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/dao/proposals">
        <Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4" />Back to Proposals</Button>
      </Link>

      <Card className="bg-card text-card-foreground border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Create New Advisory Proposal</CardTitle>
        </CardHeader>
        <CardContent>
          {!isConnected ? (
            <ConnectWalletPrompt
              message="Connect your wallet to create an advisory proposal."
              subMessage="The wallet identifies the proposal author. Binding execution and token-weighted voting are disabled."
              icon="shield"
            />
          ) : !user ? (
            <div className="text-center py-8"><p className="text-muted-foreground">Sign in to create a proposal.</p></div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium mb-1.5">Title</label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Enter proposal title..." maxLength={512} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe your proposal in detail. Include motivation, implementation plan, and expected outcomes..."
                  rows={10}
                  maxLength={10000}
                />
                <p className="text-xs text-muted-foreground mt-1">{description.length}/10,000 characters</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={(event) => { const value = event.target.value; if ((validCategories as readonly string[]).includes(value)) setCategory(value as typeof category); }}
                    className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                  >
                    <option value="protocol">Protocol</option><option value="treasury">Treasury</option><option value="community">Community</option><option value="emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Chain scope</label>
                  <select
                    value={chain}
                    onChange={(event) => { const value = event.target.value; if ((validChains as readonly string[]).includes(value)) setChain(value as typeof chain); }}
                    className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                  >
                    <option value="both">Both Chains</option><option value="pulsechain">PulseChain</option><option value="base">Base</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Duration (days)</label>
                  <Input type="number" value={durationDays} onChange={(event) => setDurationDays(Math.max(1, Math.min(30, parseInt(event.target.value) || 7)))} min={1} max={30} />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                <p className="font-medium mb-1">Advisory Governance Boundary</p>
                <ul className="text-muted-foreground space-y-1 text-xs">
                  <li>• One authenticated account and wallet receives one advisory vote.</li>
                  <li>• The wallet must sign a server-issued account/address/nonce challenge before permanent binding.</li>
                  <li>• The selected chain limits where an advisory vote may be recorded.</li>
                  <li>• The signature authorizes no transaction, token transfer, delegation, or execution.</li>
                </ul>
              </div>

              <Button type="submit" className="w-full" disabled={createProposal.isPending || isSigning}>
                {isSigning ? "Awaiting Wallet Signature..." : createProposal.isPending ? "Creating..." : pendingForCurrentWallet ? "Sign & Submit Advisory Proposal" : "Submit Advisory Proposal"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
