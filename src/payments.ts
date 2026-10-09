export type PaymentResult = { succeeded: boolean; reference: string };

export interface PaymentProvider {
  readonly name: string;
  charge(input: { orderId: string; amountMinor: number; currency: string }): Promise<PaymentResult>;
}

// Safe local adapter: real providers should be added behind this interface and use verified webhooks.
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  async charge(input: { orderId: string }): Promise<PaymentResult> {
    return { succeeded: true, reference: `mock_${input.orderId}` };
  }
}

export const paymentProvider: PaymentProvider = new MockPaymentProvider();
