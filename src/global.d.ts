export {};

declare global {
    const __APP_VERSION__: string;
    interface Window {
        ApplePaySession: any | undefined;
    }
}
