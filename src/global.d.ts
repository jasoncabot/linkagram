export {};

declare global {
    interface Window {
        ApplePaySession: any | undefined;
    }
}
