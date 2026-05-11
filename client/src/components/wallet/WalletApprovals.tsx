import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileWarning } from "lucide-react";
import { Approval, WALLET_API, retryWithBackoff } from "./WalletUtils";
import { toast } from "sonner";

interface WalletApprovalsProps {
  address: string | undefined;
  selectedNetwork: string;
}

export function WalletApprovals({ address, selectedNetwork }: WalletApprovalsProps) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const approvalsAbortController = useRef<AbortController | null>(null);

  const fetchApprovals = useCallback(async () => {
    if (!address) return;
    if (approvalsAbortController.current) approvalsAbortController.current.abort();
    const abortController = new AbortController();
    approvalsAbortController.current = abortController;
    try {
      await retryWithBackoff(async () => {
        const res = await fetch(`${WALLET_API}/api/wallet/approvals?address=${encodeURIComponent(address)}`, { signal: abortController.signal });
        if (!res.ok) {
          throw new Error("Failed to fetch approvals");
        }
        const data = await res.json();
        setApprovals(data.approvals || []);
      });
    } catch (e) {
      if ((e as any).name !== "AbortError") {
        console.error("Approvals fetch error:", e);
      }
    }
  }, [address]);

  useEffect(() => {
    fetchApprovals();
    return () => {
      approvalsAbortController.current?.abort();
    };
  }, [fetchApprovals]);

  const handleRevoke = async (token: string, spender: string) => {
    try {
      await retryWithBackoff(async () => {
        const res = await fetch(`${WALLET_API}/api/wallet/revoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, token, spender, chain: selectedNetwork }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Revoke failed");
        }
        toast.success("Approval revoked");
        fetchApprovals();
      });
    } catch (e) {
      toast.error((e as Error).message || "Revoke failed");
    }
  };

  return (
    <Card className="bg-black/95 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <FileWarning className="w-5 h-5 text-orange-400" aria-hidden="true" />
          Token Approvals Audit
        </CardTitle>
      </CardHeader>
      <CardContent>
        {approvals.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No active approvals found</p>
        ) : (
          <div className="space-y-2">
            {approvals.map((a, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <div>
                  <p className="text-white font-medium">{a.token}</p>
                  <p className="text-xs text-gray-400">Spender: {a.spenderName || a.spender.slice(0, 10) + "..."}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={a.risk === "high" ? "destructive" : a.risk === "medium" ? "default" : "secondary"}>{a.risk}</Badge>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevoke(a.token, a.spender)}
                    aria-label={`Revoke approval for ${a.token} spender ${a.spenderName || a.spender}`}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-4">
          <FileWarning className="w-3 h-3 inline mr-1" aria-hidden="true" />
          High-risk approvals allow unlimited token spending. Revoke unused approvals to protect your funds.
        </p>
      </CardContent>
    </Card>
  );
}
