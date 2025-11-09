'use client';

import { useState, useEffect } from 'react';
import styles from './PaymentPreview.module.css';
import paymentBuilderService from '../../services/paymentBuilderService';
import ConversionProgress from './ConversionProgress';

export default function PaymentPreview({ paymentType, formData, isValid, convertedMessage, isConverting }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState('source'); // 'source' or 'target'
  const [targetTemplate, setTargetTemplate] = useState('');
  const [showConversionProgress, setShowConversionProgress] = useState(false);
  const [waitingForMessage, setWaitingForMessage] = useState(false);

  useEffect(() => {
    if (paymentType && formData && Object.keys(formData).length > 0) {
      generateMessage();
    }
  }, [paymentType, formData]);

  useEffect(() => {
    if (paymentType) {
      generateTargetTemplate();
    }
  }, [paymentType]);

  // Show conversion progress when conversion starts
  useEffect(() => {
    if (isConverting) {
      setShowConversionProgress(true);
      setViewMode('target'); // Switch to target view during conversion
    }
  }, [isConverting]);

  // Hide progress only when conversion is done AND we have the converted message
  useEffect(() => {
    if (!isConverting && showConversionProgress && convertedMessage) {
      // Small delay to ensure smooth transition
      setWaitingForMessage(false);
      setTimeout(() => {
        setShowConversionProgress(false);
      }, 300);
    } else if (!isConverting && showConversionProgress && !convertedMessage) {
      // Conversion stopped but no message yet - show waiting state
      setWaitingForMessage(true);
    }
  }, [isConverting, convertedMessage, showConversionProgress]);

  const handleConversionComplete = () => {
    // Animation completed - wait for convertedMessage to arrive
    // The useEffect above will handle hiding the progress
  };

  const generateTargetTemplate = () => {
    // Generate a template based on target format
    const targetFormat = paymentType?.targetFormat;
    if (targetFormat === 'pacs.008') {
      setTargetTemplate(`<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>[Reference]</MsgId>
      <CreDtTm>[DateTime]</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <InstrId>[Reference]</InstrId>
        <EndToEndId>[Reference]</EndToEndId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="[Currency]">[Amount]</IntrBkSttlmAmt>
      <Dbtr>
        <Nm>[Sender Name]</Nm>
        <PstlAdr>
          <AdrLine>[Sender Address]</AdrLine>
        </PstlAdr>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <Othr>
            <Id>[Sender Account]</Id>
          </Othr>
        </Id>
      </DbtrAcct>
      <Cdtr>
        <Nm>[Beneficiary Name]</Nm>
        <PstlAdr>
          <AdrLine>[Beneficiary Address]</AdrLine>
        </PstlAdr>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <Othr>
            <Id>[Beneficiary Account]</Id>
          </Othr>
        </Id>
      </CdtrAcct>
      <RmtInf>
        <Ustrd>[Payment Purpose]</Ustrd>
      </RmtInf>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`);
    } else if (targetFormat === 'cain.001') {
      setTargetTemplate(`<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:cain.001.001.03">
  <AccptrAuthstnReq>
    <Hdr>
      <MsgFctn>AUTQ</MsgFctn>
      <PrtcolVrsn>1.0</PrtcolVrsn>
    </Hdr>
    <AuthstnReq>
      <Envt>
        <Mrchnt>
          <Id>
            <Nm>[Merchant Name]</Nm>
          </Id>
          <MCC>[Merchant Category]</MCC>
        </Mrchnt>
        <Card>
          <PAN>[Card Number]</PAN>
          <CardhldrNm>[Cardholder Name]</CardhldrNm>
        </Card>
      </Envt>
      <Tx>
        <TxAmt Ccy="[Currency]">[Amount]</TxAmt>
        <TxDtls>
          <RqstdAmt>[Amount]</RqstdAmt>
        </TxDtls>
      </Tx>
    </AuthstnReq>
  </AccptrAuthstnReq>
</Document>`);
    } else if (targetFormat === 'pacs.009') {
      setTargetTemplate(`<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08">
  <FICdtTrf>
    <GrpHdr>
      <MsgId>[Reference]</MsgId>
      <CreDtTm>[DateTime]</CreDtTm>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <InstrId>[Reference]</InstrId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="[Currency]">[Amount]</IntrBkSttlmAmt>
      <InstgAgt>
        <FinInstnId>
          <BICFI>[Sender BIC]</BICFI>
        </FinInstnId>
      </InstgAgt>
      <InstdAgt>
        <FinInstnId>
          <BICFI>[Receiver BIC]</BICFI>
        </FinInstnId>
      </InstdAgt>
    </CdtTrfTxInf>
  </FICdtTrf>
</Document>`);
    } else if (targetFormat === 'TARGET2') {
      setTargetTemplate(`// TARGET2 Message Format
// Transaction Type: SCT
// Message Version: 2.0

Header:
  MessageID: [Reference]
  Timestamp: [DateTime]
  Priority: NORMAL

Transaction:
  Amount: [Amount] [Currency]
  ValueDate: [Date]
  Debtor: [Sender Name]
  DebtorAccount: [Sender Account]
  Creditor: [Beneficiary Name]
  CreditorAccount: [Beneficiary Account]
  RemittanceInfo: [Payment Purpose]
  ExecutionTime: INSTANT`);
    } else if (targetFormat === 'CHAPS') {
      setTargetTemplate(`// CHAPS Payment Message
// Format: SWIFT-Compatible

:20:[Reference]
:32A:[Date][Currency][Amount]
:50K:[Sender Account]
     [Sender Name]
     [Sender Address]
:59:[Beneficiary Account]
    [Beneficiary Name]
    [Beneficiary Address]
:70:[Payment Purpose]
:71A:SHA`);
    } else if (targetFormat === 'FPS') {
      setTargetTemplate(`// UK Faster Payments Service (FPS)
// Format: ISO 8583:2003

MTI: 0200
Field 2: [Card/Account Number]
Field 3: 000000 (Processing Code - Credit)
Field 4: [Amount in pence]
Field 7: [Transmission DateTime - MMDDhhmmss]
Field 11: [System Trace Audit Number]
Field 12: [Local Transaction Time - hhmmss]
Field 13: [Local Transaction Date - MMDD]
Field 18: [Merchant Category Code]
Field 32: [Acquiring Institution ID - Sort Code]
Field 37: [Retrieval Reference Number]
Field 41: [Card Acceptor Terminal ID]
Field 42: [Card Acceptor ID Code]
Field 43: [Card Acceptor Name/Location]
Field 48: [Additional Data]
Field 49: 826 (Currency Code - GBP)
Field 61.1: [Payment Sub-Type]
Field 100: [Receiving Institution ID - Sort Code]
Field 102: [Account ID 1 - Debtor]
Field 103: [Account ID 2 - Creditor]
Field 122: [Regulatory Reporting]
Field 127.2: [Structured Data - Payment Reference]

// FPS Specific Requirements:
// - Maximum £250,000 per transaction
// - GBP only (Currency Code 826)
// - UK Sort Codes (6 digits)
// - Payment Reference max 18 characters
// - Settlement in < 2 hours`);
    } else if (targetFormat === 'OpenBankingUK') {
      setTargetTemplate(`// UK Open Banking Payment Initiation API v4.0
// Format: REST/JSON (ISO 20022 compliant)

POST /domestic-payments
Content-Type: application/json
Authorization: Bearer [Access Token]

{
  "Data": {
    "Initiation": {
      "InstructionIdentification": "[Payment Reference]",
      "EndToEndIdentification": "[Payment Reference]",
      "InstructedAmount": {
        "Amount": "[Amount]",
        "Currency": "GBP"
      },
      "DebtorAccount": {
        "SchemeName": "UK.OBIE.SortCodeAccountNumber",
        "Identification": "[Sort Code + Account Number]",
        "Name": "[Sender Name]"
      },
      "CreditorAccount": {
        "SchemeName": "UK.OBIE.SortCodeAccountNumber",
        "Identification": "[Sort Code + Account Number]",
        "Name": "[Beneficiary Name]"
      },
      "CreditorPostalAddress": {
        "AddressLine": ["[Beneficiary Address]"]
      },
      "RemittanceInformation": {
        "Unstructured": "[Payment Purpose]"
      }
    }
  },
  "Risk": {
    "PaymentContextCode": "PartyToParty",
    "MerchantCategoryCode": "[MCC]",
    "DeliveryAddress": {
      "AddressLine": ["[Address]"]
    }
  }
}

// Open Banking v4.0 Features:
// - Real-time payment initiation
// - Strong Customer Authentication (SCA)
// - PSD2 compliant
// - Standardized UK account format
// - Enhanced risk assessment`);
    } else {
      setTargetTemplate('// Target format template will appear here');
    }
  };

  const generateMessage = async () => {
    if (!formData || Object.keys(formData).length === 0) {
      setMessage('// Enter payment details to see message preview');
      return;
    }

    // Check if we have minimum required fields filled (at least 3 non-empty fields)
    const filledFields = Object.values(formData).filter(v => v && v !== '').length;
    const hasMinimumData = filledFields >= 3;

    // Only call backend if form is valid AND has minimum data
    if (!isValid || !hasMinimumData) {
      // Show a preview with partial data using local generation
      const fallback = paymentBuilderService.getFallbackPaymentMessage(paymentType.id, formData);
      setMessage(`// Preview (complete all required fields for final message)\n\n${fallback.source_message}`);
      return;
    }

    setLoading(true);
    try {
      const result = await paymentBuilderService.buildPayment(
        paymentType.id,
        formData
      );

      if (result.message || result.source_message) {
        setMessage(result.message || result.source_message);
      } else {
        // If backend doesn't return a message, use fallback
        const fallback = paymentBuilderService.getFallbackPaymentMessage(paymentType.id, formData);
        setMessage(fallback.source_message);
      }
    } catch (error) {
      console.error('Error generating message:', error);
      // Use fallback message on error
      const fallback = paymentBuilderService.getFallbackPaymentMessage(paymentType.id, formData);
      setMessage(fallback.source_message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      const textToCopy = viewMode === 'source' ? message : (convertedMessage || targetTemplate);
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getCurrentMessage = () => {
    if (viewMode === 'source') {
      return message;
    } else {
      // Show converted message if available and not empty/error
      // Treat <root/> as empty (broken conversion)
      const hasValidConversion = convertedMessage &&
                                 convertedMessage.trim() !== '' &&
                                 convertedMessage.trim() !== '<root/>' &&
                                 convertedMessage.trim() !== '<?xml version="1.0" encoding="UTF-8"?>\n<root/>';
      return hasValidConversion ? convertedMessage : targetTemplate;
    }
  };

  const getCurrentFormat = () => {
    return viewMode === 'source' ? paymentType?.sourceFormat : paymentType?.targetFormat;
  };

  const formatMessage = (msg) => {
    if (!msg) return '';

    const currentFormat = viewMode === 'source' ? paymentType?.sourceFormat : paymentType?.targetFormat;

    // Format XML messages
    if (msg.trim().startsWith('<?xml') || currentFormat?.includes('pacs') || currentFormat?.includes('cain')) {
      const lines = msg.split('\n');
      return lines.map((line, idx) => {
        let className = styles.text;
        if (line.includes('<?xml')) className = styles.xmlDeclaration;
        else if (line.trim().startsWith('<') && !line.trim().startsWith('</')) className = styles.xmlTag;
        else if (line.trim().startsWith('</')) className = styles.xmlClosingTag;
        else if (line.includes('[') && line.includes(']')) className = styles.placeholder;

        return (
          <div key={idx} className={styles.messageLine}>
            <span className={styles.lineNumber}>{idx + 1}</span>
            <span className={className}>{line}</span>
          </div>
        );
      });
    }
    // Format ISO8583 message
    else if (currentFormat === 'ISO8583_0200') {
      // Format ISO8583 message
      return msg.split('|').map((field, idx) => (
        <div key={idx} className={styles.messageLine}>
          <span className={styles.lineNumber}>{idx + 1}</span>
          <span className={styles.field}>{field}</span>
        </div>
      ));
    } else if (currentFormat?.startsWith('MT')) {
      // Format SWIFT MT message
      const lines = msg.split('\n');
      return lines.map((line, idx) => {
        let className = styles.text;
        if (line.startsWith('{')) className = styles.block;
        else if (line.startsWith(':')) className = styles.field;
        else if (line === '-}') className = styles.block;

        return (
          <div key={idx} className={styles.messageLine}>
            <span className={styles.lineNumber}>{idx + 1}</span>
            <span className={className}>{line}</span>
          </div>
        );
      });
    } else {
      // Default formatting
      return msg.split('\n').map((line, idx) => (
        <div key={idx} className={styles.messageLine}>
          <span className={styles.lineNumber}>{idx + 1}</span>
          <span className={styles.text}>{line}</span>
        </div>
      ));
    }
  };

  return (
    <div className={styles.previewContainer}>
      <div className={styles.previewHeader}>
        <h3>Message Preview</h3>
        <div className={styles.headerActions}>
          <div className={styles.toggleGroup}>
            <button
              className={`${styles.toggleButton} ${viewMode === 'source' ? styles.active : ''}`}
              onClick={() => setViewMode('source')}
            >
              Source
            </button>
            <button
              className={`${styles.toggleButton} ${viewMode === 'target' ? styles.active : ''}`}
              onClick={() => setViewMode('target')}
            >
              Target
            </button>
          </div>
          <span className={styles.formatBadge}>
            {getCurrentFormat() || 'FORMAT'}
          </span>
          <button
            onClick={copyToClipboard}
            className={styles.copyButton}
            disabled={(!message && viewMode === 'source') || loading}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className={styles.previewContent}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>Generating message...</p>
          </div>
        ) : showConversionProgress ? (
          waitingForMessage ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>Finalizing conversion...</p>
            </div>
          ) : (
            <ConversionProgress onComplete={handleConversionComplete} />
          )
        ) : (
          <pre className={styles.messageContent}>
            {getCurrentMessage() ? formatMessage(getCurrentMessage()) : (
              <span className={styles.placeholder}>
                {viewMode === 'source'
                  ? 'Payment message will appear here once you fill in the form'
                  : 'Target format template will appear here'}
              </span>
            )}
          </pre>
        )}
      </div>

      {getCurrentMessage() && !loading && !showConversionProgress && (
        <div className={styles.messageStats}>
          <span>Lines: {getCurrentMessage().split('\n').length}</span>
          <span>•</span>
          <span>Characters: {getCurrentMessage().length}</span>
          <span>•</span>
          <span>Format: {getCurrentFormat()}</span>
          {viewMode === 'target' && convertedMessage && (
            <>
              <span>•</span>
              <span className={styles.convertedBadge}>✓ Converted</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}