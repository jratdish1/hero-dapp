export function sanitizeEnsAvatar(
  rawUrl: string | null | undefined
): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const url = new URL(rawUrl);
    if (url.protocol === "https:" || url.protocol === "http:") return rawUrl;
    return undefined;
  } catch {
    return undefined;
  }
}

export async function copyTextToClipboard(
  text: string,
  browser: { navigator?: any; document?: any } = {}
): Promise<boolean> {
  const targetNavigator =
    browser.navigator ?? (typeof globalThis !== "undefined" ? globalThis.navigator : undefined);
  const targetDocument =
    browser.document ?? (typeof globalThis !== "undefined" ? globalThis.document : undefined);

  try {
    if (targetNavigator?.clipboard?.writeText) {
      await targetNavigator.clipboard.writeText(text);
      return true;
    }

    if (!targetDocument?.createElement || !targetDocument?.body?.appendChild) {
      return false;
    }

    const textArea = targetDocument.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    targetDocument.body.appendChild(textArea);
    textArea.select();
    const copied = targetDocument.execCommand?.("copy");
    targetDocument.body.removeChild(textArea);
    return copied === true;
  } catch {
    return false;
  }
}
