import React, { Suspense } from "react";

// Lazy-load streamdown (pulls in mermaid 11.5MB + shiki) only when actually needed
const StreamdownComponent = React.lazy(() =>
  import("streamdown").then((mod) => ({ default: mod.Streamdown }))
);

interface LazyStreamdownProps {
  children: string;
}

export function LazyStreamdown({ children }: LazyStreamdownProps) {
  return (
    <Suspense fallback={<div className="animate-pulse bg-muted rounded p-4 min-h-[2rem]" />}>
      <StreamdownComponent>{children}</StreamdownComponent>
    </Suspense>
  );
}
