export {};

declare const __APP_VERSION__: string;

declare global {
    interface Window {
        ApplePaySession: any | undefined;
    }
}
