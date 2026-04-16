import { useState, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Camera,
  Video,
  Upload,
  Image as ImageIcon,
  Film,
  Heart,
  Smile,
  Megaphone,
  BookOpen,
  Hexagon,
  X,
  Loader2,
  Wallet,
} from "lucide-react";
// Simple toast replacement
const useToast = () => ({
  toast: ({ title, description, variant }: { title: string; description?: string; variant?: string }) => {
    if (variant === "destructive") {
      console.error(title, description);
    }
    // We'll use alert-style notifications inline
  }
});

type Category = "instructional" | "photos" | "memories" | "memes" | "announcements" | "nfts";

const CATEGORIES: { value: Category; label: string; icon: React.ReactNode; description: string }[] = [
  { value: "instructional", label: "Instructional", icon: <BookOpen className="w-5 h-5" />, description: "Tutorials & how-to guides" },
  { value: "photos", label: "Community Photos", icon: <Camera className="w-5 h-5" />, description: "Community snapshots" },
  { value: "memories", label: "Mission Memories", icon: <Heart className="w-5 h-5" />, description: "Stories & memories" },
  { value: "memes", label: "Memes & Fun", icon: <Smile className="w-5 h-5" />, description: "Memes & laughs" },
  { value: "announcements", label: "Announcements", icon: <Megaphone className="w-5 h-5" />, description: "Official updates" },
  { value: "nfts", label: "NFT Showcase", icon: <Hexagon className="w-5 h-5" />, description: "Share your NFTs" },
];

export default function MediaHub() {
  const { user } = useAuth();
  const { address, isConnected } = useAccount();
  const { toast } = useToast();

  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showWalletPrompt, setShowWalletPrompt] = useState(false);
  const [showNftDialog, setShowNftDialog] = useState(false);

  // Upload form state
  const [uploadCategory, setUploadCategory] = useState<Category>("photos");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // NFT share form state
  const [nftTitle, setNftTitle] = useState("");
  const [nftDescription, setNftDescription] = useState("");
  const [nftImageUrl, setNftImageUrl] = useState("");
  const [nftContract, setNftContract] = useState("");
  const [nftTokenId, setNftTokenId] = useState("");
  const [nftChainId, setNftChainId] = useState("369");
  const [nftCollection, setNftCollection] = useState("");

  const queryInput = useMemo(() => {
    if (activeCategory === "all") return { limit: 50 };
    return { category: activeCategory as Category, limit: 50 };
  }, [activeCategory]);

  const { data: posts, isLoading, refetch } = trpc.media.list.useQuery(queryInput);

  const uploadMutation = trpc.media.upload.useMutation({
    onSuccess: () => {
      toast({ title: "Upload successful!", description: "Your content has been posted to the Media Hub." });
      resetUploadForm();
      setShowUploadDialog(false);
      refetch();
    },
    onError: (err) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const shareNftMutation = trpc.media.shareNft.useMutation({
    onSuccess: () => {
      toast({ title: "NFT shared!", description: "Your NFT has been posted to the showcase." });
      resetNftForm();
      setShowNftDialog(false);
      refetch();
    },
    onError: (err) => {
      toast({ title: "Share failed", description: err.message, variant: "destructive" });
    },
  });

  const resetUploadForm = useCallback(() => {
    setUploadTitle("");
    setUploadDescription("");
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadCategory("photos");
  }, []);

  const resetNftForm = useCallback(() => {
    setNftTitle("");
    setNftDescription("");
    setNftImageUrl("");
    setNftContract("");
    setNftTokenId("");
    setNftChainId("369");
    setNftCollection("");
  }, []);

  const handleUploadClick = useCallback(() => {
    if (!isConnected || !address) {
      setShowWalletPrompt(true);
      return;
    }
    setShowUploadDialog(true);
  }, [isConnected, address]);

  const handleNftShareClick = useCallback(() => {
    if (!isConnected || !address) {
      setShowWalletPrompt(true);
      return;
    }
    setShowNftDialog(true);
  }, [isConnected, address]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast({ title: "File too large", description: "Maximum file size is 50MB.", variant: "destructive" });
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  }, [toast]);

  const handleUploadSubmit = useCallback(async () => {
    if (!selectedFile || !uploadTitle || !address) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const mediaType = selectedFile.type.startsWith("video/") ? "video" as const : "image" as const;

      uploadMutation.mutate({
        walletAddress: address,
        category: uploadCategory,
        title: uploadTitle,
        description: uploadDescription || undefined,
        mediaType,
        fileBase64: base64,
        fileName: selectedFile.name,
        contentType: selectedFile.type,
        fileSizeMb: selectedFile.size / (1024 * 1024),
      });
    };
    reader.readAsDataURL(selectedFile);
  }, [selectedFile, uploadTitle, address, uploadCategory, uploadDescription, uploadMutation]);

  const handleNftSubmit = useCallback(() => {
    if (!nftTitle || !nftImageUrl || !nftContract || !nftTokenId || !address) return;

    shareNftMutation.mutate({
      walletAddress: address,
      title: nftTitle,
      description: nftDescription || undefined,
      nftImageUrl,
      nftContractAddress: nftContract,
      nftTokenId,
      nftChainId: parseInt(nftChainId),
      nftCollectionName: nftCollection || undefined,
    });
  }, [nftTitle, nftImageUrl, nftContract, nftTokenId, address, nftDescription, nftChainId, nftCollection, shareNftMutation]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">
                <span className="text-orange-500">Media</span> Hub
              </h1>
              <p className="text-muted-foreground mt-1">
                Share photos, videos, memories, and NFTs with the HERO community
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleUploadClick}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
              <Button
                onClick={handleNftShareClick}
                variant="outline"
                className="border-green-500/50 text-green-400 hover:bg-green-500/10"
              >
                <Hexagon className="w-4 h-4 mr-2" />
                Share NFT
              </Button>
              <a
                href="https://double.trudefi.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 transition-colors text-sm font-medium"
              >
                <img src="https://double.trudefi.io/favicon.ico" className="w-4 h-4" alt="TruDeFi" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                TruDeFi 🔗
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory("all")}
            className={activeCategory === "all" ? "bg-orange-500 hover:bg-orange-600" : ""}
          >
            All
          </Button>
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.value}
              variant={activeCategory === cat.value ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat.value)}
              className={activeCategory === cat.value ? "bg-orange-500 hover:bg-orange-600" : ""}
            >
              {cat.icon}
              <span className="ml-1.5">{cat.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Content Grid */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : !posts || posts.length === 0 ? (
          <div className="text-center py-20">
            <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-semibold text-muted-foreground">No content yet</h3>
            <p className="text-muted-foreground/70 mt-2">
              Be the first to share something with the HERO community!
            </p>
            <Button
              onClick={handleUploadClick}
              className="mt-4 bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Content
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {posts.map((post) => (
              <Card key={post.id} className="overflow-hidden bg-card border-border hover:border-orange-500/30 transition-colors group">
                <div className="aspect-video relative overflow-hidden bg-secondary">
                  {post.mediaType === "video" ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <video
                        src={post.mediaUrl}
                        className="w-full h-full object-cover"
                        preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Film className="w-12 h-12 text-white/80" />
                      </div>
                    </div>
                  ) : (
                    <img
                      src={post.mediaUrl}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  )}
                  {post.category === "nfts" && (
                    <div className="absolute top-2 right-2 bg-green-500/90 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <Hexagon className="w-3 h-3" />
                      NFT
                    </div>
                  )}
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                    {CATEGORIES.find(c => c.value === post.category)?.label || post.category}
                  </div>
                </div>
                <CardContent className="p-3">
                  <h3 className="font-semibold text-sm truncate">{post.title}</h3>
                  {post.description && (
                    <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{post.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>{post.authorName || "Anonymous"}</span>
                    <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>
                  {post.nftCollectionName && (
                    <div className="mt-1 text-xs text-green-400 truncate">
                      {post.nftCollectionName} #{post.nftTokenId}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Wallet Connection Prompt Dialog */}
      <Dialog open={showWalletPrompt} onOpenChange={setShowWalletPrompt}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-orange-500" />
              Connect Your Wallet
            </DialogTitle>
            <DialogDescription>
              You need to connect your wallet to upload content or share NFTs.
              This verifies your identity and links your posts to your wallet address.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowWalletPrompt(false)}>
              Cancel
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => {
                setShowWalletPrompt(false);
                toast({ title: "Connect your wallet", description: "Use the wallet button in the header to connect MetaMask, Trust Wallet, or WalletConnect." });
              }}
            >
              <Wallet className="w-4 h-4 mr-2" />
              Got It
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-orange-500" />
              Upload Content
            </DialogTitle>
            <DialogDescription>
              Share photos, videos, or memories with the HERO community.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Category</label>
              <Select value={uploadCategory} onValueChange={(v) => setUploadCategory(v as Category)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter(c => c.value !== "nfts").map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="flex items-center gap-2">
                        {cat.icon}
                        {cat.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title</label>
              <Input
                placeholder="Give your post a title..."
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                maxLength={500}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description (optional)</label>
              <Textarea
                placeholder="Tell the community about this..."
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                maxLength={2000}
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              {selectedFile ? (
                <div className="border border-border rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedFile.type.startsWith("video/") ? (
                      <Video className="w-5 h-5 text-blue-400" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-green-400" />
                    )}
                    <span className="text-sm truncate max-w-[200px]">{selectedFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-24 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Click to select a file</span>
                    <span className="text-xs text-muted-foreground/60">Images or videos up to 50MB</span>
                  </div>
                </Button>
              )}
              {previewUrl && (
                <img src={previewUrl} alt="Preview" className="mt-2 rounded-lg max-h-40 object-cover" />
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { resetUploadForm(); setShowUploadDialog(false); }}>
                Cancel
              </Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={handleUploadSubmit}
                disabled={!selectedFile || !uploadTitle || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" /> Upload</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share NFT Dialog */}
      <Dialog open={showNftDialog} onOpenChange={setShowNftDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hexagon className="w-5 h-5 text-green-400" />
              Share Your NFT
            </DialogTitle>
            <DialogDescription>
              Showcase your NFT to the HERO community. Paste the image URL and contract details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">NFT Title</label>
              <Input
                placeholder="My awesome NFT..."
                value={nftTitle}
                onChange={(e) => setNftTitle(e.target.value)}
                maxLength={500}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">NFT Image URL</label>
              <Input
                placeholder="https://..."
                value={nftImageUrl}
                onChange={(e) => setNftImageUrl(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Contract Address</label>
                <Input
                  placeholder="0x..."
                  value={nftContract}
                  onChange={(e) => setNftContract(e.target.value)}
                  maxLength={42}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Token ID</label>
                <Input
                  placeholder="1234"
                  value={nftTokenId}
                  onChange={(e) => setNftTokenId(e.target.value)}
                  maxLength={100}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Chain</label>
                <Select value={nftChainId} onValueChange={setNftChainId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="369">PulseChain</SelectItem>
                    <SelectItem value="8453">BASE</SelectItem>
                    <SelectItem value="1">Ethereum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Collection Name</label>
                <Input
                  placeholder="HERO Military NFTs"
                  value={nftCollection}
                  onChange={(e) => setNftCollection(e.target.value)}
                  maxLength={200}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description (optional)</label>
              <Textarea
                placeholder="Tell us about this NFT..."
                value={nftDescription}
                onChange={(e) => setNftDescription(e.target.value)}
                maxLength={2000}
                rows={2}
              />
            </div>
            {nftImageUrl && (
              <div className="rounded-lg overflow-hidden border border-border">
                <img src={nftImageUrl} alt="NFT Preview" className="w-full max-h-48 object-contain bg-secondary" />
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { resetNftForm(); setShowNftDialog(false); }}>
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleNftSubmit}
                disabled={!nftTitle || !nftImageUrl || !nftContract || !nftTokenId || shareNftMutation.isPending}
              >
                {shareNftMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sharing...</>
                ) : (
                  <><Hexagon className="w-4 h-4 mr-2" /> Share NFT</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
