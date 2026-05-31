// Empty module shim - blocks @reown/appkit from being bundled
// WalletConnect uses our custom QR modal instead
export default {};
export const WalletConnectModal = undefined;
export const createAppKit = () => {};
export const AppKit = undefined;
