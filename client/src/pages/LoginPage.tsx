import { useState, useCallback, type FormEvent } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        window.location.href = "/";
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Network error — check your connection");
    } finally {
      setLoading(false);
    }
  }, [password]);

  return (
    <div className="min-h-screen bg-[#0a0e1c] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="border border-[var(--hero-green,#22c55e)]/30 rounded-lg bg-[#0d1117] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-[#161b22] border-b border-[var(--hero-green,#22c55e)]/20">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-2 text-xs text-gray-500 font-mono">herobase.io — auth</span>
          </div>

          <div className="p-6 space-y-6">
            <div className="text-center space-y-1">
              <h1 className="text-[var(--hero-orange,#f97316)] font-bold text-xl tracking-wider">
                HEROBASE.IO
              </h1>
              <p className="text-gray-500 text-xs uppercase tracking-widest">
                Secure Access Required
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[var(--hero-green,#22c55e)] text-xs font-mono mb-1 uppercase">
                  Operator Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password..."
                  className="w-full bg-[#0a0e1c] border border-[var(--hero-green,#22c55e)]/30 rounded px-3 py-2 text-[var(--hero-green,#22c55e)] font-mono text-sm focus:outline-none focus:border-[var(--hero-green,#22c55e)] placeholder-gray-600"
                  autoFocus
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="text-red-400 text-xs font-mono bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full bg-[var(--hero-green,#22c55e)]/20 border border-[var(--hero-green,#22c55e)]/40 text-[var(--hero-green,#22c55e)] font-mono text-sm py-2 rounded hover:bg-[var(--hero-green,#22c55e)]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "AUTHENTICATING..." : "AUTHENTICATE"}
              </button>
            </form>

            <div className="text-center">
              <p className="text-gray-600 text-[10px] font-mono">
                AES-256-GCM ENCRYPTED | JWT SESSION
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
