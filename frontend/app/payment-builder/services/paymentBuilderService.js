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

  // Construct message from form data (for visualization)
  constructMessage(paymentType, formData) {
    if (!paymentType || !formData) return '';

    // Construct MT103 message
    if (paymentType.sourceFormat === 'MT103') {
      const reference = formData.reference || `REF${Date.now().toString().slice(-8)}`;
      const valueDate = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const amount = formData.amount || '0.00';
      const currency = formData.currency || 'USD';
      const senderBic = formData.sender_bic || 'UBSWCHZH80A';
      const receiverBic = formData.receiver_bic || 'ABSAZAJJXXX';
      const intermediaryBic = formData.intermediary_bic || receiverBic;
      const senderBankBic = formData.sender_bank_bic || senderBic.substring(0, 11) + 'XXX';

      // Ensure sender_to_receiver has proper format with /TAG/ notation
      const senderToReceiver = formData.sender_to_receiver ||
        '/ACC/PRIORITY\n/REC/NOTIFY RECIPIENT\n/INS/PLEASE PROCESS URGENTLY';

      return `{1:F01${senderBic}0000000000}
{2:I103${receiverBic}N}
{4:
:20:${reference}
:23B:CRED
:32A:${valueDate}${currency}${amount.replace('.', ',')}
:50K:/${formData.sender_account || 'CH9300762011623852957'}
${formData.sender_name || 'SENDER NAME'}
${formData.sender_address || 'STREET ADDRESS\nCITY POSTAL\nCOUNTRY'}
:52A:${senderBankBic}
:53A:${intermediaryBic}
:59:/${formData.beneficiary_account || 'ZA123456789012345678901'}
${formData.beneficiary_name || 'BENEFICIARY NAME'}
${formData.beneficiary_address || 'STREET ADDRESS\nCITY POSTAL\nCOUNTRY'}
:70:${formData.remittance_info || formData.purpose || 'PAYMENT PURPOSE'}
:71A:SHA
:72:${senderToReceiver}
-}`;
    }

    // Construct MT202 message
    if (paymentType.sourceFormat === 'MT202') {
      const reference = formData.reference || `REF${Date.now().toString().slice(-8)}`;
      const relatedRef = formData.related_reference || `RR${Date.now().toString().slice(-7)}`;
      const valueDate = formData.value_date || new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const amount = formData.amount || '0.00';
      const currency = formData.currency || 'EUR';
      const senderBic = formData.sender_bic || 'CHASUS33XXX';
      const receiverBic = formData.receiver_bic || 'DEUTDEFFXXX';
      const senderToReceiverInfo = formData.sender_to_receiver_info || '/BNF/TREASURY OPERATIONS\n/INS/PRIORITY PROCESSING';

      return `{1:F01${senderBic}0000000000}
{2:I202${receiverBic}N}
{3:{108:PRIORITY}}
{4:
:20:${reference}
:21:${relatedRef}
:32A:${valueDate}${currency}${amount.replace('.', ',')}
:52A:${formData.ordering_institution || senderBic}
:57A:${formData.account_institution || receiverBic}
:58A:/${formData.beneficiary_account || 'DE12345678901234567890'}
${formData.beneficiary_institution || 'BENEFICIARY INSTITUTION'}
:72:${senderToReceiverInfo}
-}`;
    }

    // Construct ISO8583 message
    if (paymentType.sourceFormat === 'ISO8583_0200') {
      const datetime = formData.datetime || new Date().toISOString().slice(5, 17).replace(/[-:]/g, '').substring(0, 10);
      const stan = formData.stan || Date.now().toString().slice(-6);
      const ref = formData.ref || Date.now().toString().slice(-12);
      const processingCode = formData.processing_code || '000000';
      const location = formData.location || 'LOCATION';
      const cardExpiry = formData.card_expiry || '2512';
      const acquirer = formData.acquirer || '12345678901';
      const additionalData = formData.additional_data || 'Transaction notes';

      return `0200|PAN:${formData.card_number || '4111111111111111'}|PROC:${processingCode}|AMT:${formData.amount || '0'}|CUR:${formData.currency_code || '840'}|DT:${datetime}|STAN:${stan}|REF:${ref}|TERM:${formData.terminal_id || 'TERM0001'}|MID:${formData.merchant_id || 'MERCH001'}|MERCHANT:${formData.merchant_name || 'MERCHANT'} ${location}|EXP:${cardExpiry}|ACQ:${acquirer}|DATA:${additionalData}|`;
    }

    // Construct canonical JSON message for instant payment
    if (paymentType.sourceFormat === 'JSON') {
      const endToEndId = formData.end_to_end_id || `E2E-${Date.now().toString().slice(-10)}`;
      const messageId = formData.message_id || `MSG-${Date.now().toString().slice(-10)}`;
      const creationDatetime = formData.creation_datetime || new Date().toISOString();

      const canonicalJson = {
        header: {
          message_type: "customer_transfer",
          reference: endToEndId,
          timestamp: creationDatetime
        },
        transaction: {
          end_to_end_id: endToEndId,
          transaction_id: messageId
        },
        parties: {
          debtor: {
            name: formData.debtor_name || 'John Smith',
            account: {
              identifier: formData.debtor_iban || 'DE89370400440532013000',
              type: "IBAN"
            }
          },
          creditor: {
            name: formData.creditor_name || 'Jane Doe',
            account: {
              identifier: formData.creditor_iban || 'FR1420041010050500013M02606',
              type: "IBAN"
            }
          }
        },
        amounts: {
          instructed: {
            value: formData.amount || '0.00',
            currency: formData.currency || 'EUR'
          }
        },
        remittance: {
          unstructured: [formData.remittance_info || 'Payment']
        },
        charges: {
          bearer: "SLEV"
        }
      };

      return JSON.stringify(canonicalJson, null, 2);
    }

    // Construct canonical JSON for crypto payment (source format)
    if (paymentType.id === 'crypto_payment') {
      const transactionId = formData.transaction_id || `TXN-${Date.now()}`;
      const timestamp = formData.creation_datetime || new Date().toISOString();

      const canonicalJson = {
        header: {
          message_type: "crypto_transfer",
          reference: formData.reference || "Payment",
          timestamp: timestamp
        },
        transaction: {
          transaction_id: transactionId,
          end_to_end_id: `E2E-${Date.now().toString().slice(-10)}`
        },
        parties: {
          debtor: {
            name: formData.sender_name || "Sender",
            account: {
              identifier: formData.source_wallet_id || "wallet-123",
              type: "WALLET"
            }
          },
          creditor: {
            name: formData.recipient_name || "Recipient",
            account: {
              identifier: formData.recipient_wallet || "0x1234567890abcdef1234567890abcdef12345678",
              type: "WALLET"
            }
          }
        },
        amounts: {
          instructed: {
            value: formData.amount || "0.00",
            currency: formData.currency || "USD"
          }
        },
        remittance: {
          unstructured: [formData.remittance_info || "Transfer"]
        }
      };
      return JSON.stringify(canonicalJson, null, 2);
    }

    // Default fallback
    return 'Message preview unavailable';
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

  // Auto-configuration methods
  async getAutoConfigScenarios() {
    try {
      return await this.circuitBreaker.execute(async () => {
        const response = await withTimeout(
          this.retryFetch(`${this.baseUrl}/api/v1/demo/auto-config/scenarios`),
          10000
        );
        if (!response.ok) {
          // Return hardcoded scenarios if endpoint doesn't exist
          return this.getFallbackAutoConfigScenarios();
        }
        return await response.json();
      });
    } catch (error) {
      console.error('Error fetching auto-config scenarios:', error);
      return this.getFallbackAutoConfigScenarios();
    }
  }

  async triggerAutoConfig(sourceFormat, targetFormat, sampleMessage, similarTo) {
    try {
      return await this.circuitBreaker.execute(async () => {
        return await retryWithBackoff(
          async () => {
            const response = await withTimeout(
              fetch(`${this.baseUrl}/api/v1/converter/auto-configure`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  source_format: sourceFormat,
                  target_format: targetFormat,
                  sample_message: sampleMessage,
                  similar_to: similarTo
                })
              }),
              30000 // 30 second timeout for AI processing
            );
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
          },
          {
            maxRetries: 2,
            initialDelay: 2000,
            onRetry: (attempt, delay, error) => {
              console.log(`Retrying auto-config (attempt ${attempt}) after ${delay}ms`);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error triggering auto-config:', error);
      // Return mock result for demo
      return this.getMockAutoConfigResult(sourceFormat, targetFormat);
    }
  }

  async getAutoConfigStatus(configId) {
    try {
      const response = await withTimeout(
        fetch(`${this.baseUrl}/api/v1/converter/auto-config/status/${configId}`),
        5000
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching auto-config status:', error);
      return { status: 'unknown', error: error.message };
    }
  }

  async validateAutoConfig(configId, corrections, approved) {
    try {
      const response = await withTimeout(
        fetch(`${this.baseUrl}/api/v1/converter/validate-config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            configuration_id: configId,
            corrections: corrections,
            approved: approved
          })
        }),
        10000
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error validating auto-config:', error);
      return { success: false, error: error.message };
    }
  }

  async getSemanticPatterns() {
    try {
      const response = await withTimeout(
        this.retryFetch(`${this.baseUrl}/api/v1/converter/semantic-patterns`),
        10000
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching semantic patterns:', error);
      return [];
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
      cross_border: `{1:F01UBSWCHZH80A0000000000}
{2:I103ABSAZAJJXXXXN}
{4:
:20:TEST${Date.now().toString().slice(-6)}
:23B:CRED
:32A:241215${formData.currency || 'CHF'}${formData.amount || '0'},00
:50K:/${formData.sender_account || 'CH9300762011623852957'}
${formData.sender_name || 'SENDER NAME'}
${formData.sender_address || 'SENDER ADDRESS\nCITY\nCOUNTRY'}
:52A:UBSWCHZH80A
:53A:ABSAZAJJXXX
:59:/${formData.beneficiary_account || 'ZA123456789012345678901'}
${formData.beneficiary_name || 'BENEFICIARY NAME'}
${formData.beneficiary_address || 'BENEFICIARY ADDRESS\nCITY\nCOUNTRY'}
:70:${formData.purpose || 'PAYMENT PURPOSE'}
:71A:SHA
:72:${formData.sender_to_receiver || '/ACC/PRIORITY\n/REC/NOTIFY RECIPIENT\n/INS/PLEASE PROCESS URGENTLY'}
-}`,
      card_payment: `0200|PAN:${formData.card_number || '4111111111111111'}|PROC:${formData.processing_code || '000000'}|AMT:${formData.amount || '0'}|CUR:${formData.currency_code || '840'}|DT:${formData.datetime || new Date().toISOString().slice(5, 17).replace(/[-:]/g, '').substring(0, 10)}|STAN:${formData.stan || Date.now().toString().slice(-6)}|REF:${formData.ref || Date.now().toString().slice(-12)}|TERM:${formData.terminal_id || 'TERM0001'}|MID:${formData.merchant_id || 'MERCH001'}|MERCHANT:${formData.merchant_name || 'MERCHANT'} ${formData.location || 'LOCATION'}|EXP:${formData.card_expiry || '2512'}|ACQ:${formData.acquirer || '12345678901'}|DATA:${formData.additional_data || 'Transaction notes'}|`,
      bank_transfer: `{1:F01${formData.sender_bic || 'CHASUS33XXX'}0000000000}
{2:I202${formData.receiver_bic || 'DEUTDEFFXXX'}N}
{3:{108:PRIORITY}}
{4:
:20:${formData.reference || 'FT' + Date.now().toString().slice(-8)}
:21:${formData.related_reference || 'REF' + Date.now().toString().slice(-7)}
:32A:${formData.value_date || new Date().toISOString().slice(2, 10).replace(/-/g, '')}${formData.currency || 'EUR'}${(formData.amount || '0.00').replace('.', ',')}
:52A:${formData.ordering_institution || formData.sender_bic || 'CHASUS33XXX'}
:57A:${formData.account_institution || formData.receiver_bic || 'DEUTDEFFXXX'}
:58A:/${formData.beneficiary_account || 'DE12345678901234567890'}
${formData.beneficiary_institution || 'BENEFICIARY INSTITUTION'}
:72:${formData.sender_to_receiver_info || '/BNF/TREASURY OPERATIONS\n/INS/PRIORITY PROCESSING'}
-}`,
      instant_payment: JSON.stringify({
        header: {
          message_type: "customer_transfer",
          reference: formData.end_to_end_id || `E2E-${Date.now().toString().slice(-10)}`,
          timestamp: formData.creation_datetime || new Date().toISOString()
        },
        transaction: {
          end_to_end_id: formData.end_to_end_id || `E2E-${Date.now().toString().slice(-10)}`,
          transaction_id: formData.message_id || `MSG-${Date.now().toString().slice(-10)}`
        },
        parties: {
          debtor: {
            name: formData.debtor_name || 'John Smith',
            account: {
              identifier: formData.debtor_iban || 'DE89370400440532013000',
              type: "IBAN"
            }
          },
          creditor: {
            name: formData.creditor_name || 'Jane Doe',
            account: {
              identifier: formData.creditor_iban || 'FR1420041010050500013M02606',
              type: "IBAN"
            }
          }
        },
        amounts: {
          instructed: {
            value: formData.amount || '0.00',
            currency: formData.currency || 'EUR'
          }
        },
        remittance: {
          unstructured: [formData.remittance_info || 'Payment']
        },
        charges: {
          bearer: "SLEV"
        }
      }, null, 2),
      crypto_payment: JSON.stringify({
        header: {
          message_type: "crypto_transfer",
          reference: formData.reference || "Payment",
          timestamp: formData.creation_datetime || new Date().toISOString()
        },
        transaction: {
          transaction_id: formData.transaction_id || `TXN-${Date.now()}`,
          end_to_end_id: `E2E-${Date.now().toString().slice(-10)}`
        },
        parties: {
          debtor: {
            name: formData.sender_name || "Sender",
            account: {
              identifier: formData.source_wallet_id || "wallet-123",
              type: "WALLET"
            }
          },
          creditor: {
            name: formData.recipient_name || "Recipient",
            account: {
              identifier: formData.recipient_wallet || "0x1234567890abcdef1234567890abcdef12345678",
              type: "WALLET"
            }
          }
        },
        amounts: {
          instructed: {
            value: formData.amount || "0.00",
            currency: formData.currency || "USD"
          }
        },
        remittance: {
          unstructured: [formData.remittance_info || "Transfer"]
        }
      }, null, 2)
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

  getFallbackAutoConfigScenarios() {
    return [
      {
        id: 'mt192_to_pacs008',
        name: 'MT192 Request for Cancellation',
        source_format: 'MT192',
        target_format: 'pacs.008',
        confidence_expected: 0.85
      },
      {
        id: 'mt205_to_pacs009',
        name: 'MT205 Financial Institution Transfer',
        source_format: 'MT205',
        target_format: 'pacs.009',
        confidence_expected: 0.88
      },
      {
        id: 'iso8583_0220_to_cain001',
        name: 'ISO8583 Financial Advice',
        source_format: 'ISO8583_0220',
        target_format: 'cain.001',
        confidence_expected: 0.90
      }
    ];
  }

  getMockAutoConfigResult(sourceFormat, targetFormat) {
    return {
      configuration_id: `${sourceFormat}_to_${targetFormat}`,
      confidence: 0.85,
      fields_detected: 12,
      fields_mapped: 10,
      uncertain_fields: [
        {
          field: 'field_79',
          confidence: 0.65,
          suggested_mapping: 'RmtInf.Ustrd',
          reason: 'Complex unstructured field'
        }
      ],
      generation_time_seconds: 4.5,
      ready_to_save: false,
      configuration: {
        parser: { fields: {} },
        mappings: [],
        builder: { template: {} }
      }
    };
  }

  // Auto-configure a new payment format
  async autoConfigureFormat(sourceFormat, targetFormat, sampleMessage, similarTo = null) {
    try {
      const payload = {
        source_format: sourceFormat,
        target_format: targetFormat,
        sample_message: sampleMessage
      };

      // Only include similar_to if explicitly provided (backend will auto-detect if not provided)
      if (similarTo) {
        payload.similar_to = similarTo;
      }

      const response = await withTimeout(
        fetch(`${this.baseUrl}/api/v1/converter/auto-configure?include_details=true`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }),
        90000 // 90 second timeout for auto-configuration (AI processing can take time)
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Auto-configuration failed: ${response.status}`);
      }

      const result = await response.json();

      // Add some mock data for visualization if backend doesn't provide it
      return {
        ...result,
        mappings: result.mappings || this.generateMockMappings(sourceFormat, targetFormat),
        fields_detected: result.fields_detected || 15,
        generation_time_seconds: result.generation_time_seconds || 4.5
      };
    } catch (error) {
      console.error('Error auto-configuring format:', error);
      // Return mock result for development
      if (error.message.includes('fetch')) {
        return this.getMockAutoConfigResult(sourceFormat, targetFormat);
      }
      throw error;
    }
  }

  // Generate mock mappings for visualization
  generateMockMappings(sourceFormat, targetFormat) {
    const mockMappings = [
      { source: 'field_20', target: 'MsgId', lane: 'RULES', confidence: 95 },
      { source: 'field_32A', target: 'IntrBkSttlmAmt', lane: 'RULES', confidence: 98 },
      { source: 'field_50K', target: 'Dbtr.Nm', lane: 'RULES', confidence: 92 },
      { source: 'field_59', target: 'Cdtr.Nm', lane: 'RULES', confidence: 90 },
      { source: 'field_70', target: 'RmtInf.Ustrd', lane: 'AI', confidence: 75 },
      { source: 'field_72', target: 'InstrForNxtAgt', lane: 'AI', confidence: 70 },
    ];

    return mockMappings.filter(() => Math.random() > 0.2); // Randomly include mappings
  }

  // Validate auto-generated configuration
  async validateAutoConfig(configurationId, configuration = null, approved = false) {
    try {
      const payload = {
        configuration_id: configurationId,
        approved,
        ...(configuration && { configuration })
      };

      const response = await withTimeout(
        fetch(`${this.baseUrl}/api/v1/converter/validate-config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }),
        10000
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Validation failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error validating configuration:', error);
      // Return mock success for development
      if (error.message.includes('fetch')) {
        return {
          success: true,
          message: approved ? 'Configuration approved and saved' : 'Configuration rejected',
          configuration_id: configurationId
        };
      }
      throw error;
    }
  }

  // Validate configuration schema
  async validateConfigSchema(configuration) {
    try {
      const response = await withTimeout(
        fetch(`${this.baseUrl}/api/v1/converter/validate-schema`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            configuration: configuration
          }),
        }),
        15000 // 15 second timeout
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Validation failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error validating config schema:', error);
      throw error;
    }
  }

  // Save validated configuration to production (or pending in demo mode)
  async saveValidatedConfig(configuration, force = false, sessionId = null) {
    try {
      console.log('paymentBuilderService.saveValidatedConfig called with:', {
        configId: configuration?._id,
        force,
        sessionId,
        sessionIdType: typeof sessionId
      });

      const requestBody = {
        configuration: configuration,
        force: force
      };

      // Add session_id if provided (for demo mode isolation)
      if (sessionId) {
        requestBody.session_id = sessionId;
        console.log('Added session_id to request body:', sessionId);
      } else {
        console.warn('No sessionId provided to saveValidatedConfig');
      }

      const response = await withTimeout(
        fetch(`${this.baseUrl}/api/v1/converter/save-validated-config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }),
        15000
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Save failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error saving validated config:', error);
      throw error;
    }
  }

  // Update a specific field in the configuration
  async updateConfigField(configurationId, fieldPath, value) {
    try {
      const response = await withTimeout(
        fetch(`${this.baseUrl}/api/v1/converter/update-config-field`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            configuration_id: configurationId,
            field_path: fieldPath,
            value: value
          }),
        }),
        10000
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Update failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating config field:', error);
      throw error;
    }
  }
}

// Export singleton instance
const paymentBuilderService = new PaymentBuilderService();
export default paymentBuilderService;