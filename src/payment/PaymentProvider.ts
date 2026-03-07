export interface PaymentProvider {
  initialize(): Promise<void>;
  requestPayment(container?: HTMLElement): Promise<{ success: boolean }>;
}
