import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNetwork } from "../contexts/NetworkContext";
import { NetworkBadge } from "../components/NetworkSwitcher";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import {
  Bot,
  Send,
  Sparkles,
  TrendingUp,
  Shield,
  AlertTriangle,
  Loader2,
  Trash2,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  {
    icon: TrendingUp,
    label: "HERO Price Analysis",
    prompt: "Analyze the current market conditions for $HERO token on PulseChain. What are the key support and resistance levels? What's the bullish and bearish case?",
  },
  {
    icon: TrendingUp,
    label: "VETS Market Outlook",
    prompt: "What's the market outlook for $VETS token? Analyze recent trading volume, liquidity depth, and potential catalysts for price movement.",
  },
  {
    icon: Shield,
    label: "Farm Yield Strategy",
    prompt: "Compare the yield farming opportunities for $HERO and $VETS across Emit Farm, RhinoFi, and TruFarms. Which pairs offer the best risk-adjusted returns?",
  },
  {
    icon: AlertTriangle,
    label: "Scam Detection Tips",
    prompt: "What are the top red flags to watch for when evaluating new PulseChain tokens? How can I verify if a token contract is safe?",
  },
];

export default function AiAssistant() {
  const { chain } = useNetwork();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const aiChat = trpc.ai.chat.useMutation();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await aiChat.mutateAsync({
        message: content.trim(),
        chainContext: chain.name,
        history: messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: response.reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        role: "assistant",
        content:
          "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] border-2 border-white/30 rounded-2xl mx-2 my-2 overflow-hidden shadow-[0_0_15px_rgba(255,255,255,0.05)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-hero-orange/20 to-hero-green/20 border border-hero-orange/30">
            <Bot className="h-5 w-5 text-hero-orange" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              HERO AI Assistant
              <Sparkles className="h-4 w-4 text-hero-orange" />
            </h1>
            <p className="text-xs text-muted-foreground">
              Powered by Grok — Market analysis, scam detection, and DeFi strategy
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NetworkBadge />
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-hero-orange/20 to-hero-green/20 border border-hero-orange/20">
              <Bot className="h-8 w-8 text-hero-orange" />
            </div>
            <div className="text-center max-w-md">
              <h2 className="text-xl font-bold text-foreground mb-2">
                What can I help you with?
              </h2>
              <p className="text-sm text-muted-foreground">
                Ask me about $HERO and $VETS market analysis, farm yield
                strategies, scam detection, or any DeFi question on{" "}
                {chain.name}.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp.label}
                  onClick={() => sendMessage(qp.prompt)}
                  className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/50 p-3 text-left text-sm transition-all hover:bg-card hover:border-hero-orange/30 group"
                >
                  <qp.icon className="h-4 w-4 text-muted-foreground group-hover:text-hero-orange shrink-0" />
                  <span className="text-foreground/80 group-hover:text-foreground">
                    {qp.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-hero-orange/20 to-hero-green/20 border border-hero-orange/30">
                    <Bot className="h-4 w-4 text-hero-orange" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-hero-orange/20 border border-hero-orange/30 text-foreground"
                      : "bg-card border border-border/50 text-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <Streamdown>{msg.content}</Streamdown>
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-hero-orange/20 to-hero-green/20 border border-hero-orange/30">
                  <Bot className="h-4 w-4 text-hero-orange" />
                </div>
                <div className="rounded-2xl bg-card border border-border/50 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border/50 px-6 py-4">
        <div className="flex items-end gap-3 max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask about $HERO, $VETS, or anything on ${chain.name}...`}
              rows={1}
              className="w-full resize-none rounded-xl border-2 border-white/40 bg-card/50 px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/60"
              style={{ maxHeight: "120px" }}
            />
          </div>
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="bg-gradient-to-r from-hero-orange to-hero-green text-black font-semibold hover:opacity-90 shrink-0"
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-2">
          Powered by Grok (xAI) — Not financial advice. Always DYOR.
        </p>
      </div>
    </div>
  );
}
