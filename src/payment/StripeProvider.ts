import type { PaymentProvider } from './PaymentProvider';
import { apiUrl } from '../platform';
import type { Stripe } from '@stripe/stripe-js';

class StripeProvider implements PaymentProvider {
  private stripe: Stripe | null = null;

  async initialize(): Promise<void> {
    const { loadStripe } = await import('@stripe/stripe-js');
    const stripeKey =
      'pk_live_51MQ4wTDjdwEKhnhgi8jlWuTSTjrokSs6lBqHIFP9O6c7Sot00xW54LRCXprU1v2ToVuAoTnvr5gdOWG0jRKAyrZn00pWtSmzKq';
    this.stripe = await loadStripe(stripeKey, { apiVersion: '2022-11-15' });
  }

  async requestPayment(): Promise<{ success: boolean }> {
    if (!this.stripe) {
      this.showFallbackButton();
      return { success: false };
    }

    const stripe = this.stripe;

    const paymentRequest = stripe.paymentRequest({
      country: 'GB',
      currency: 'gbp',
      total: {
        label: '12 linkagram hints',
        amount: 99,
      },
    });

    const elements = stripe.elements();
    const prButton = elements.create('paymentRequestButton', {
      paymentRequest,
    });

    const loadingBtn = document.getElementById('payment-request-loading');
    const prButtonEl = document.getElementById('payment-request-button');

    loadingBtn?.classList.remove('hidden');
    loadingBtn?.classList.add('loading');

    const result = await paymentRequest.canMakePayment();
    if (result) {
      prButton.mount('#payment-request-button');
      loadingBtn?.classList.add('hidden');
    } else {
      prButtonEl?.classList.add('hidden');
      this.showFallbackButton();
    }

    return new Promise(async (resolve) => {
      try {
        const response = await fetch(apiUrl('/hint_payment'), {
          method: 'POST',
          headers: { 'content-type': 'application/json;charset=UTF-8' },
        });
        const clientSecretResponse = await response.json();
        const clientSecret = clientSecretResponse.secret;

        paymentRequest.on('paymentmethod', async (ev) => {
          try {
            const { paymentIntent, error: confirmError } =
              await stripe.confirmCardPayment(
                clientSecret,
                { payment_method: ev.paymentMethod.id },
                { handleActions: false }
              );

            if (confirmError) {
              ev.complete('fail');
              resolve({ success: false });
            } else {
              ev.complete('success');
              if (paymentIntent.status === 'requires_action') {
                const { error } = await stripe.confirmCardPayment(clientSecret);
                resolve({ success: !error });
              } else {
                resolve({ success: true });
              }
            }
          } catch {
            resolve({ success: false });
          }
        });
      } catch {
        this.showFallbackButton();
        resolve({ success: false });
      }
    });
  }

  private showFallbackButton() {
    const loadingBtn = document.getElementById('payment-request-loading');
    loadingBtn?.classList.remove('hidden');
    loadingBtn?.classList.remove('loading');
  }
}

export function create(): PaymentProvider {
  return new StripeProvider();
}
