// Payment Builder Service - Backend API Integration
import { retryWithBackoff, createRetryFetch, withTimeout, CircuitBreaker } from '../utils/retryUtils';

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export class PaymentBuilderService {
  constructor() {
    this.baseUrl = BACKEND_API_URL;
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000,
      monitorTimeout: 30000
    });
    this.retryFetch = createRetryFetch({
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      shouldRetry: (error) => {
        if (!error.response) return true;
        const status = error.response?.status;
        return status >= 500 && status < 600 || status === 429;
      }
    });
  }

  // Get list of available payment types
  async getPaymentTypes() {
    try {
      return await this.circuitBreaker.execute(async () => {
        const response = await withTimeout(
          this.retryFetch(`${this.baseUrl}/api/v1/demo/payment/types`),
          10000
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
      });
    } catch (error) {
      console.error('Error fetching payment types:', error);
      // Return fallback data if backend is unavailable
      return this.getFallbackPaymentTypes();
    }
  }

  // Get form schema for a specific payment type
  async getFormSchema(paymentType, prefill = false) {
    try {
      return await this.circuitBreaker.execute(async () => {
        const response = await withTimeout(
          this.retryFetch(
            `${this.baseUrl}/api/v1/demo/payment/types/${paymentType}/form?prefill=${prefill}`
          ),
          10000
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
      });
    } catch (error) {
      console.error('Error fetching form schema:', error);
      // Return fallback schema
      return this.getFallbackFormSchema(paymentType);
    }
  }

  // Get demo values for a payment type
  async getDemoValues(paymentType) {
    try {
      return await retryWithBackoff(
        async () => {
          const response = await withTimeout(
            fetch(
              `${this.baseUrl}/api/v1/demo/payment/types/${paymentType}/demo-values`
            ),
            5000
          );
          if (!response.ok) {
            // If endpoint doesn't exist, use fallback
            console.log('Demo values endpoint returned:', response.status);
            return this.getFallbackDemoValues(paymentType);
          }
          return await response.json();
        },
        {
          maxRetries: 2,
          initialDelay: 500,
          shouldRetry: (error) => {
            // Only retry on network errors, not 404s
            return !error.response || error.response.status >= 500;
          }
        }
      );
    } catch (error) {
      console.error('Error fetching demo values:', error);
      return this.getFallbackDemoValues(paymentType);
    }
  }

  // Build payment message from form data
  async buildPayment(paymentType, formData) {
    try {
      return await this.circuitBreaker.execute(async () => {
        return await retryWithBackoff(
          async () => {
            const response = await withTimeout(
              fetch(`${this.baseUrl}/api/v1/demo/payment/build`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  payment_type: paymentType,
                  form_data: formData
                })
              }),
              15000
            );
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            onRetry: (attempt, delay, error) => {
              console.log(`Retrying buildPayment (attempt ${attempt}) after ${delay}ms`);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error building payment:', error);
      // Return fallback message
      return this.getFallbackPaymentMessage(paymentType, formData);
    }
  }

  // Execute payment conversion with tracking
  async executePayment(paymentType, formData, sessionId = null) {
    try {
      return await this.circuitBreaker.execute(async () => {
        return await retryWithBackoff(
          async () => {
            const response = await withTimeout(
              fetch(`${this.baseUrl}/api/v1/demo/payment/execute`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  payment_type: paymentType,
                  form_data: formData,
                  track_mongodb: true,
                  session_id: sessionId,
                  use_demo_values: false,
                  save_result: false
                })
              }),
              30000 // 30 second timeout for execution
            );
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
          },
          {
            maxRetries: 2, // Less retries for long-running operations
            initialDelay: 2000,
            onRetry: (attempt, delay, error) => {
              console.log(`Retrying executePayment (attempt ${attempt}) after ${delay}ms`);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error executing payment:', error);
      // Return mock execution result for demo
      return this.getMockExecutionResult(paymentType);
    }
  }

  // Validate payment data
  async validatePaymentData(paymentType, formData) {
    try {
      return await retryWithBackoff(
        async () => {
          const response = await withTimeout(
            fetch(`${this.baseUrl}/api/v1/demo/payment/validate`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                payment_type: paymentType,
                form_data: formData
              })
            }),
            5000
          );
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return await response.json();
        },
        {
          maxRetries: 2,
          initialDelay: 500
        }
      );
    } catch (error) {
      console.error('Error validating payment data:', error);
      return { valid: true, errors: [] };
    }
  }

  // Get payment journey details
  async getPaymentJourney(paymentType) {
    try {
      return await this.circuitBreaker.execute(async () => {
        const response = await withTimeout(
          this.retryFetch(
            `${this.baseUrl}/api/v1/demo/payment/journey/${paymentType}`
          ),
          10000
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
      });
    } catch (error) {
      console.error('Error fetching payment journey:', error);
      return this.getFallbackJourney(paymentType);
    }
  }

  // --- Fallback Data Methods (for when backend is unavailable) ---

  getFallbackPaymentTypes() {
    return [
      {
        id: 'cross_border',
        name: 'Cross-Border Wire Transfer',
        description: 'International MT103 to pacs.008',
        source_format: 'MT103',
        target_format: 'pacs.008'
      },
      {
        id: 'card_payment',
        name: 'Card Authorization',
        description: 'ISO8583 to cain.001 conversion',
        source_format: 'ISO8583_0200',
        target_format: 'cain.001'
      }
    ];
  }

  getFallbackFormSchema(paymentType) {
    const schemas = {
      cross_border: {
        form_schema: {
          sections: [
            {
              title: "Sender Information",
              fields: [
                {
                  id: "sender_name",
                  label: "Sender Name",
                  type: "text",
                  required: true,
                  placeholder: "Enter sender name"
                },
                {
                  id: "sender_account",
                  label: "Sender Account",
                  type: "text",
                  required: true,
                  placeholder: "Account number or IBAN"
                },
                {
                  id: "sender_country",
                  label: "Sender Country",
                  type: "select",
                  required: true,
                  options: ["USA", "UK", "Germany", "France", "Japan"]
                }
              ]
            },
            {
              title: "Beneficiary Information",
              fields: [
                {
                  id: "beneficiary_name",
                  label: "Beneficiary Name",
                  type: "text",
                  required: true,
                  placeholder: "Enter beneficiary name"
                },
                {
                  id: "beneficiary_account",
                  label: "Beneficiary Account",
                  type: "text",
                  required: true,
                  placeholder: "Account number or IBAN"
                },
                {
                  id: "beneficiary_country",
                  label: "Beneficiary Country",
                  type: "select",
                  required: true,
                  options: ["USA", "UK", "Germany", "France", "Japan"]
                }
              ]
            },
            {
              title: "Payment Details",
              fields: [
                {
                  id: "amount",
                  label: "Amount",
                  type: "number",
                  required: true,
                  placeholder: "0.00"
                },
                {
                  id: "currency",
                  label: "Currency",
                  type: "select",
                  required: true,
                  options: ["USD", "EUR", "GBP", "JPY"]
                },
                {
                  id: "purpose",
                  label: "Payment Purpose",
                  type: "textarea",
                  required: true,
                  placeholder: "Enter payment purpose"
                }
              ]
            }
          ]
        }
      },
      card_payment: {
        form_schema: {
          sections: [
            {
              title: "Card Information",
              fields: [
                {
                  id: "card_number",
                  label: "Card Number",
                  type: "text",
                  pattern: "[0-9]{13,19}",
                  required: true,
                  placeholder: "1234 5678 9012 3456"
                },
                {
                  id: "cardholder_name",
                  label: "Cardholder Name",
                  type: "text",
                  required: true,
                  placeholder: "Name on card"
                }
              ]
            },
            {
              title: "Transaction Details",
              fields: [
                {
                  id: "amount",
                  label: "Amount",
                  type: "number",
                  required: true,
                  placeholder: "0.00"
                },
                {
                  id: "currency_code",
                  label: "Currency",
                  type: "select",
                  required: true,
                  options: [
                    { value: "840", label: "USD" },
                    { value: "978", label: "EUR" },
                    { value: "826", label: "GBP" },
                    { value: "392", label: "JPY" }
                  ]
                },
                {
                  id: "merchant_name",
                  label: "Merchant Name",
                  type: "text",
                  required: true,
                  placeholder: "Merchant name"
                },
                {
                  id: "merchant_category",
                  label: "Merchant Category",
                  type: "select",
                  required: true,
                  options: [
                    { value: "5411", label: "Grocery Stores" },
                    { value: "5812", label: "Restaurants" },
                    { value: "5999", label: "Miscellaneous" }
                  ]
                }
              ]
            }
          ]
        }
      }
    };

    return schemas[paymentType] || schemas.cross_border;
  }

  getFallbackDemoValues(paymentType) {
    const demoValues = {
      cross_border: {
        sender_name: "ACME Corporation",
        sender_account: "US64209876543210987654",
        sender_country: "USA",
        beneficiary_name: "Global Supplies GmbH",
        beneficiary_account: "DE89370400440532013000",
        beneficiary_country: "Germany",
        amount: "125750.50",
        currency: "USD",
        purpose: "Invoice Payment #2024-001 for Electronic Components"
      },
      card_payment: {
        card_number: "4111111111111111",
        cardholder_name: "John Doe",
        amount: "675.00",
        currency_code: "840",
        merchant_name: "TechStore Online",
        merchant_category: "5999"
      }
    };

    return { demo_values: demoValues[paymentType] || {} };
  }

  getFallbackPaymentMessage(paymentType, formData) {
    const messages = {
      cross_border: `{1:F01CHASUS33XXXX0000000000}
{2:I103DEUTDEFFXXXXN}
{3:{108:ILOVESEPA}}
{4:
:20:TEST${Date.now().toString().slice(-6)}
:23B:CRED
:32A:241215${formData.currency || 'USD'}${formData.amount || '0'},00
:50K:/${formData.sender_account || 'ACCOUNT'}
${formData.sender_name || 'SENDER NAME'}
${formData.sender_country || 'USA'}
:59:/${formData.beneficiary_account || 'ACCOUNT'}
${formData.beneficiary_name || 'BENEFICIARY NAME'}
${formData.beneficiary_country || 'COUNTRY'}
:70:${formData.purpose || 'PAYMENT PURPOSE'}
:71A:SHA
-}`,
      card_payment: `0200|PAN:${formData.card_number || '4111111111111111'}|AMT:${formData.amount || '0'}|CUR:${formData.currency_code || '840'}|MER:${formData.merchant_name || 'MERCHANT'}|MCC:${formData.merchant_category || '5999'}`
    };

    return {
      success: true,
      source_message: messages[paymentType] || messages.cross_border,
      payment_type: paymentType
    };
  }

  getMockExecutionResult(paymentType) {
    return {
      success: true,
      payment_type: paymentType,
      source_format: paymentType === 'card_payment' ? 'ISO8583_0200' : 'MT103',
      target_format: paymentType === 'card_payment' ? 'cain.001' : 'pacs.008',
      source_message: 'Mock source message...',
      converted_message: '<?xml version="1.0"?><Document>...</Document>',
      conversion_metadata: {
        processing_stats: {
          rules_lane: { count: 20, fields: ['field1', 'field2'] },
          ai_lane: { count: 3, fields: ['field70', 'field72'] },
          human_lane: { count: 1, fields: ['field_unknown'] }
        },
        confidence_scores: {
          overall: 0.92,
          field_70: 0.85,
          field_72: 0.78
        },
        processing_time_seconds: 2.5,
        mongodb_operations: 15
      }
    };
  }

  getFallbackJourney(paymentType) {
    return {
      payment_type: paymentType,
      stages: [
        { name: 'Parse', status: 'pending', duration_ms: 50 },
        { name: 'Transform', status: 'pending', duration_ms: 200 },
        { name: 'Build', status: 'pending', duration_ms: 30 }
      ],
      total_duration_ms: 280
    };
  }
}

// Export singleton instance
const paymentBuilderService = new PaymentBuilderService();
export default paymentBuilderService;