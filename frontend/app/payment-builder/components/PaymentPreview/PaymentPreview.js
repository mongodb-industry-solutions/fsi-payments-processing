'use client';

import { useState, useEffect } from 'react';
import styles from './PaymentPreview.module.css';
import paymentBuilderService from '../../services/paymentBuilderService';

export default function PaymentPreview({ paymentType, formData, isValid, convertedMessage, isConverting }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState('source'); // 'source' or 'target'
  const [targetTemplate, setTargetTemplate] = useState('');

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
    } else {
      setTargetTemplate('// Target format template will appear here');
    }
  };

  const generateMessage = async () => {
    if (!formData || Object.keys(formData).length === 0) {
      setMessage('// Enter payment details to see message preview');
      return;
    }

    // Only call backend if form is valid
    if (!isValid) {
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

      if (result.source_message) {
        setMessage(result.source_message);
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
      // Show converted message if available, otherwise show template
      return convertedMessage || targetTemplate;
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
        {loading || isConverting ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>{isConverting ? 'Converting message...' : 'Generating message...'}</p>
          </div>
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

      {getCurrentMessage() && !loading && !isConverting && (
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