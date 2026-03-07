import type { PaymentProvider } from './PaymentProvider';
import 'cordova-plugin-purchase';

const PRODUCT_ID = 'com.jasoncabot.linkagram.hints12';

class StoreKitProvider implements PaymentProvider {
  private store = CdvPurchase.store;
  private purchaseResolve: ((result: { success: boolean }) => void) | null = null;
  private localizedPrice: string | null = null;

  async initialize(): Promise<void> {
    const priceEl = document.getElementById('hint-price');
    if (priceEl) priceEl.textContent = '--';

    this.store.register([{
      id: PRODUCT_ID,
      platform: CdvPurchase.Platform.APPLE_APPSTORE,
      type: CdvPurchase.ProductType.CONSUMABLE,
    }]);

    this.store.when()
      .productUpdated((product) => {
        if (product.id !== PRODUCT_ID) return;
        const price = (product as any)?.pricing?.price;
        if (price) {
          this.localizedPrice = price;
          const el = document.getElementById('hint-price');
          if (el) el.textContent = price;
        }
      })
      .approved((transaction) => {
        transaction.verify();
      })
      .verified((receipt) => {
        receipt.finish();
        this.purchaseResolve?.({ success: true });
        this.purchaseResolve = null;
      });

    await this.store.initialize([{
      platform: CdvPurchase.Platform.APPLE_APPSTORE,
    }]);
  }

  async requestPayment(): Promise<{ success: boolean }> {
    const loadingBtn = document.getElementById('payment-request-loading') as HTMLButtonElement | null;
    const prButtonEl = document.getElementById('payment-request-button');

    const product = this.store.get(PRODUCT_ID);
    if (!product) {
      if (loadingBtn) {
        loadingBtn.classList.remove('loading', 'hidden');
        loadingBtn.textContent = 'Purchase unavailable';
        loadingBtn.onclick = null;
      }
      return { success: false };
    }

    const offer = product.getOffer();
    if (!offer) {
      if (loadingBtn) {
        loadingBtn.classList.remove('loading', 'hidden');
        loadingBtn.textContent = 'Purchase unavailable';
        loadingBtn.onclick = null;
      }
      return { success: false };
    }

    loadingBtn?.classList.add('hidden');

    const price = this.localizedPrice ?? (product as any).pricing?.price ?? '0.99';
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-fullwidth';
    btn.textContent = `Buy 12 hints for ${price}`;
    prButtonEl?.replaceChildren(btn);

    return new Promise((resolve) => {
      this.purchaseResolve = resolve;

      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const error = await offer.order();
        if (error) {
          btn.disabled = false;
          this.purchaseResolve = null;
          resolve({ success: false });
        }
        // on success: resolved via the verified listener
      }, { once: true });
    });
  }

  async restorePurchases(): Promise<void> {
    await this.store.restorePurchases();
  }
}

export function create(): PaymentProvider {
  return new StoreKitProvider();
}
