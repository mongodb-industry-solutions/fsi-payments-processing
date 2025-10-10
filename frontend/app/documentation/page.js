'use client';

import { useState, useEffect } from 'react';
import styles from './documentation.module.css';
import { Tab, Tabs } from '@leafygreen-ui/tabs';
import { H2, H3, Body, Link } from '@leafygreen-ui/typography';
import Card from '@leafygreen-ui/card';
import Badge from '@leafygreen-ui/badge';
import Icon from '@leafygreen-ui/icon';
import Banner from '@leafygreen-ui/banner';

export default function Documentation() {
  const [mounted, setMounted] = useState(false);
  const [expandedFormats, setExpandedFormats] = useState({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleFormat = (index) => {
    setExpandedFormats(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const paymentFormats = [
    {
      name: 'SWIFT MT (ISO 15022)',
      description: 'Legacy cross-border messages (e.g., MT103 customer credit, MT202 bank transfer). Migrating to ISO 20022 MX by Nov 2025 (CBPR+).',
      detail: 'Text-based format with fixed field tags (e.g., :20:, :50K:) containing structured data like sender, receiver, amount, and payment details.',
      whereUsed: 'Global correspondent banking.',
      badge: 'Legacy',
      badgeVariant: 'yellow',
      example: `{1:F01UBSWCHZH80A0000000000}
{2:I103ABSAZAJJXXXXN}
{4:
:20:REF123456789
:23B:CRED
:32A:241215CHF180000,00
:50K:/CH9300762011623852957
SWISS PHARMA AG
ZURICH
:59:/ZA123456789012345678901
SOUTH AFRICAN HEALTH SUPPLIES
JOHANNESBURG
:70:INVOICE INV-2024-001
:71A:SHA
-}`,
      explanation: 'MT103 is the most common SWIFT message for customer credit transfers. Field :20: is transaction reference, :32A: contains value date/currency/amount, :50K: is ordering customer, :59: is beneficiary, :70: is remittance info.'
    },
    {
      name: 'ISO 20022 (MX)',
      description: 'Modern XML/JSON-serializable model with rich structured data. Families: pain.* (customer→bank), pacs.* (bank→bank), camt.* (reporting).',
      detail: 'Uses hierarchical XML structure with human-readable tags, supporting extensive remittance info, structured addresses, and regulatory data.',
      whereUsed: 'Core of SEPA, CHAPS, RTP, FedNow, CHIPS, T2.',
      badge: 'Standard',
      badgeVariant: 'green',
      example: `<CdtTrfTxInf>
  <PmtId>
    <EndToEndId>REF123456789</EndToEndId>
  </PmtId>
  <Amt>
    <InstdAmt Ccy="CHF">180000.00</InstdAmt>
  </Amt>
  <Dbtr>
    <Nm>SWISS PHARMA AG</Nm>
  </Dbtr>
  <DbtrAcct>
    <Id><IBAN>CH9300762011623852957</IBAN></Id>
  </DbtrAcct>
  <Cdtr>
    <Nm>SOUTH AFRICAN HEALTH SUPPLIES</Nm>
  </Cdtr>
  <CdtrAcct>
    <Id><Othr><Id>ZA123456789012345678901</Id></Othr></Id>
  </CdtrAcct>
  <RmtInf>
    <Ustrd>INVOICE INV-2024-001</Ustrd>
  </RmtInf>
</CdtTrfTxInf>`,
      explanation: 'pacs.008 is a bank-to-bank credit transfer message. It uses self-describing XML tags: PmtId for identifiers, InstdAmt for amount, Dbtr/Cdtr for parties, RmtInf for remittance data. Much richer data model than MT messages.'
    },
    {
      name: 'ACH / NACHA file',
      description: 'Fixed-width ASCII batch file; every record = 94 chars; uses SEC codes (PPD, CCD, WEB …).',
      detail: 'Each line represents a specific record type (file header, batch header, entry detail, addenda) with position-based data fields.',
      whereUsed: 'US ACH batch payments (payroll/AP).',
      badge: 'Batch',
      badgeVariant: 'blue',
      example: `1011234567890000000001230424A094101BANK NAME             COMPANY NAME
5220PAYROLL       1234567890PPDPAYROLL   230424230424   1012345670000001
62212345678901234567890000050000       JOHN DOE              0012345670000001
82200000010012345678000000500000000000000001234567890
9000001000001000000010012345678000000500000000000000000`,
      explanation: 'ACH files are fixed-width with 94 characters per line. Record types: 1=File Header, 5=Batch Header, 6=Entry Detail (payment), 8=Batch Control, 9=File Control. Position-based fields mean character 1-2 is record type, 3-12 is routing number, etc.'
    },
    {
      name: 'ISO 8583',
      description: 'Compact bitmap-based messages for card authorization & clearing.',
      detail: 'Binary format using bitmaps to indicate which data elements are present, optimized for low-latency transaction processing.',
      whereUsed: 'POS, ATM, card networks.',
      badge: 'Card',
      badgeVariant: 'purple',
      example: `MTI: 0200 (Authorization Request)
Field 2: 5123456789012345 (PAN)
Field 3: 000000 (Processing Code - Purchase)
Field 4: 000000050000 (Transaction Amount - $500.00)
Field 7: 0424103000 (Transmission Date/Time)
Field 11: 123456 (System Trace Audit Number)
Field 42: MERCHANT_ID_001 (Card Acceptor ID)
Field 43: Coffee Shop NYC    New York    US
Field 49: 840 (Currency Code - USD)`,
      explanation: 'ISO 8583 uses a Message Type Indicator (MTI) and bitmaps to show which fields are present. Field 2 is the card number, Field 4 is amount, Field 42/43 identify the merchant. Binary format makes it very compact and fast for real-time card auth.'
    },
    {
      name: 'RTP (US)',
      description: 'Real-time payments rail by The Clearing House using ISO 20022.',
      detail: 'Supports immediate payment confirmation, request-for-payment flows, and rich remittance data with 24/7/365 availability.',
      whereUsed: 'US instant payments.',
      badge: 'Real-time',
      badgeVariant: 'green',
      example: `Uses ISO 20022 pacs.008 format with RTP-specific enhancements for immediate settlement and payment confirmation.`,
      explanation: 'RTP uses ISO 20022 pacs.008 messages with real-time settlement. Supports Request for Payment (RfP) flows, remittance data up to 280 characters, and immediate payment confirmation via pacs.002 response messages.'
    },
    {
      name: 'FedNow (US)',
      description: 'Federal Reserve instant rail; ISO 20022 native.',
      detail: 'Interoperable with RTP, providing immediate funds availability and supporting payment requests with detailed remittance information.',
      whereUsed: 'US banks & credit unions.',
      badge: 'Real-time',
      badgeVariant: 'green',
      example: `Uses ISO 20022 pacs.008 format, similar to RTP, with Federal Reserve-specific network addressing and settlement.`,
      explanation: 'FedNow uses standard ISO 20022 messages (pacs.008 for credit transfers, pacs.028 for payment requests) processed through the Federal Reserve network. Designed for interoperability with RTP and future instant payment systems.'
    },
    {
      name: 'CHAPS (UK RTGS)',
      description: 'Live on ISO 20022 since Jun 2023 with enhanced data (LEI, purpose codes).',
      detail: 'High-value same-day sterling payments with irrevocable settlement, supporting Legal Entity Identifiers and extended payment purpose codes.',
      whereUsed: 'UK high-value RTGS.',
      badge: 'RTGS',
      badgeVariant: 'blue',
      example: `Uses ISO 20022 pacs.008 with mandatory LEI (Legal Entity Identifier) and enhanced payment purpose codes for regulatory compliance.`,
      explanation: 'CHAPS migrated to ISO 20022 in June 2023. Supports LEI identifiers for corporates, extended remittance data (140 chars), and detailed payment purpose codes for transparency and regulatory reporting.'
    },
    {
      name: 'Faster Payments (UK)',
      description: 'Historically ISO 8583; Pay.UK provides ISO 20022 mapping library.',
      detail: 'Near-instant GBP transfers (typically within seconds) with message validation and enhanced fraud detection capabilities.',
      whereUsed: 'UK instant retail payments.',
      badge: 'Real-time',
      badgeVariant: 'green',
      example: `Currently uses ISO 8583 bitmap messages. Migrating to ISO 20022 as part of UK New Payments Architecture (NPA) program.`,
      explanation: 'Faster Payments currently uses ISO 8583 but Pay.UK provides translation libraries. Migration to ISO 20022 planned under New Payments Architecture, enabling richer remittance data and better fraud detection.'
    },
    {
      name: 'SEPA (EU)',
      description: 'ISO 20022 end-to-end: pain.001/008, pacs.008/003, camt.* for reporting.',
      detail: 'Unified EUR payment scheme across 36 countries with standardized credit transfers, direct debits, and instant payments (SCT Inst).',
      whereUsed: 'EU cross-border EUR payments.',
      badge: 'Standard',
      badgeVariant: 'green',
      example: `pain.001 (customer payment initiation)
pacs.008 (bank-to-bank transfer)
pacs.002 (payment status)
camt.053 (bank statement)`,
      explanation: 'SEPA uses complete ISO 20022 message chain: pain.001 from customer to bank, pacs.008 between banks, pacs.002 for status, and camt.053 for account statements. Supports SEPA Credit Transfer (SCT) and SEPA Instant (SCT Inst) with 10-second settlement.'
    },
    {
      name: 'T2 (Eurosystem)',
      description: 'Successor to TARGET2 (Mar 2023); ISO 20022 native.',
      detail: 'Real-time gross settlement system consolidating TARGET2 and T2S, processing high-value euro payments with central bank liquidity.',
      whereUsed: 'Euro RTGS settlement.',
      badge: 'RTGS',
      badgeVariant: 'blue',
      example: `Uses ISO 20022 pacs.008 for payment instructions and pacs.002 for settlement confirmations in the Eurosystem RTGS.`,
      explanation: 'TARGET2 consolidated platform (T2) processes all euro RTGS payments using ISO 20022. Supports central bank liquidity management, real-time gross settlement, and integrated securities settlement (T2S).'
    },
    {
      name: 'CHIPS (US)',
      description: 'ISO 20022 since Apr 2024.',
      detail: 'Clearing House Interbank Payments System processing over $1.5 trillion daily in high-value USD payments with multilateral netting.',
      whereUsed: 'US high-value interbank.',
      badge: 'RTGS',
      badgeVariant: 'blue',
      example: `Migrated to ISO 20022 pacs.008 in April 2024, replacing legacy proprietary format for all high-value USD transfers.`,
      explanation: 'CHIPS completed ISO 20022 migration in April 2024. Uses pacs.008 for payment instructions with multilateral netting, supporting over $1.5 trillion daily volume in high-value USD payments between financial institutions.'
    },
    {
      name: 'UPI (India)',
      description: 'API-driven real-time scheme (JSON/XML payloads).',
      detail: 'Mobile-first payment interface enabling instant inter-bank transfers using virtual payment addresses, supporting P2P and merchant payments.',
      whereUsed: 'Indian instant payments.',
      badge: 'Real-time',
      badgeVariant: 'green',
      example: `{
  "payerVPA": "user@bankname",
  "payeeVPA": "merchant@payment",
  "amount": "500.00",
  "currency": "INR",
  "txnId": "UPI123456789",
  "refId": "ORDER001"
}`,
      explanation: 'UPI uses JSON-based API messages with Virtual Payment Addresses (VPA) like user@bankname. Supports instant P2P and merchant payments, QR code scanning, and payment requests. Processes over 10 billion transactions monthly.'
    }
  ];

  const flowSteps = [
    {
      number: '1',
      title: 'Initiation (Customer → Sending Bank)',
      description: 'The company\'s ERP sends a payment instruction as ISO 20022 pain.001 (or a bank API / legacy MT101).',
      example: 'Message says: "Pay €10,000 to Supplier GmbH."',
      icon: 'Laptop'
    },
    {
      number: '2',
      title: 'Clearing Hop (Sending Bank → Network → Receiving Bank)',
      description: 'The sending bank chooses the cross-border rail (usually SWIFT).',
      example: 'Interbank format depends on corridor readiness: MT103 or ISO 20022 pacs.008 (CBPR+ migration).',
      icon: 'University'
    },
    {
      number: '3',
      title: 'Settlement (Banks settle funds)',
      description: 'Funds are settled across the banks\' accounts (via their correspondents/RTGS as applicable).',
      example: 'Outcome: Supplier\'s account in Germany is credited.',
      icon: 'Checkmark'
    },
    {
      number: '4',
      title: 'Status & Reporting (Back to Customer)',
      description: 'Banks exchange pacs.002 (status) and produce camt.053 (statement).',
      example: 'The sending bank translates status for the ERP channel as pain.002 ("accepted/posted/exception").',
      icon: 'InviteUser'
    }
  ];

  const sources = [
    { text: 'SWIFT CBPR+ timeline and ISO 20022 overview', url: 'https://www.swift.com/standards/iso-20022/iso-20022-faqs/implementation' },
    { text: 'ISO 20022 payment families (pain/pacs/camt)', url: 'https://www.swift.com/standards/iso-20022/iso-20022-financial-institutions-focus-payments-instructions' },
    { text: 'European Payments Council Implementation Guidelines', url: 'https://www.europeanpaymentscouncil.eu/document-library/implementation-guidelines' },
    { text: 'Nacha Operating Rules & file structure guide', url: 'https://www.nacha.org/' },
    { text: 'The Clearing House RTP Implementation Guide', url: 'https://www.theclearinghouse.org/payment-systems/rtp' },
    { text: 'Federal Reserve FedNow Service', url: 'https://www.frbservices.org/financial-services/fednow' },
    { text: 'Bank of England CHAPS ISO 20022 migration', url: 'https://www.bankofengland.co.uk/payment-and-settlement/chaps' },
    { text: 'Eurosystem TARGET Services', url: 'https://www.ecb.europa.eu/paym/target/target2/html/index.en.html' },
    { text: 'Pay.UK New Payments Architecture', url: 'https://www.payuk.org.uk/' },
    { text: 'NPCI UPI documentation', url: 'https://www.npci.org.in/what-we-do/upi/product-overview' }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerIcon}>
            <Icon glyph="CreditCard" size="xlarge" />
          </div>
          <div className={styles.headerText}>
            <H2 className={styles.title}>Payment Format Reference</H2>
            <Body className={styles.subtitle}>
              Comprehensive guide to payment message formats and transaction flows
            </Body>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {!mounted ? (
          <div className={styles.loading}>Loading documentation...</div>
        ) : (
          <Tabs
            aria-label="Payment Format Documentation"
            className={styles.tabs}
            id="documentation-tabs"
          >
          <Tab name="Payment Formats" default>
            <div className={styles.tabContent}>
              <Banner variant="info" className={styles.banner}>
                This cheatsheet covers the most common payment message formats used in global payment systems.
              </Banner>

              <div className={styles.formatsGrid}>
                {paymentFormats.map((format, index) => (
                  <Card key={index} className={styles.formatCard}>
                    <div className={styles.formatHeader}>
                      <H3 className={styles.formatName}>{format.name}</H3>
                      <Badge variant={format.badgeVariant}>{format.badge}</Badge>
                    </div>
                    <Body className={styles.formatDescription}>
                      {format.description}
                    </Body>
                    <Body className={styles.formatDetail}>
                      {format.detail}
                    </Body>
                    <div className={styles.formatFooter}>
                      <Icon glyph="Building" size="small" className={styles.footerIcon} />
                      <Body className={styles.whereUsed}>{format.whereUsed}</Body>
                    </div>

                    {format.example && (
                      <>
                        <button
                          className={styles.expandButton}
                          onClick={() => toggleFormat(index)}
                        >
                          <Icon glyph={expandedFormats[index] ? "ChevronUp" : "ChevronDown"} size="small" />
                          <Body>{expandedFormats[index] ? "Hide Example" : "View Example Message"}</Body>
                        </button>

                        {expandedFormats[index] && (
                          <div className={styles.exampleSection}>
                            <div className={styles.exampleHeader}>
                              <Icon glyph="Code" size="small" />
                              <Body><strong>Example Message:</strong></Body>
                            </div>
                            <pre className={styles.exampleCode}>
                              {format.example}
                            </pre>
                            <div className={styles.explanationSection}>
                              <Icon glyph="InfoWithCircle" size="small" />
                              <Body className={styles.explanationText}>{format.explanation}</Body>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          </Tab>

          <Tab name="Transaction Flow">
            <div className={styles.tabContent}>
              <Banner variant="success" className={styles.banner}>
                <strong>Scenario:</strong> An Indian company pays a German supplier in EUR.
              </Banner>

              <H3 className={styles.sectionTitle}>Payment Journey</H3>

              <div className={styles.flowSteps}>
                {flowSteps.map((step, index) => (
                  <Card key={index} className={styles.flowCard}>
                    <div className={styles.flowHeader}>
                      <div className={styles.stepNumber}>{step.number}</div>
                      <div className={styles.flowHeaderContent}>
                        <H3 className={styles.stepTitle}>{step.title}</H3>
                      </div>
                    </div>
                    <Body className={styles.stepDescription}>{step.description}</Body>
                    <div className={styles.stepExample}>
                      <Icon glyph="InfoWithCircle" size="small" />
                      <Body className={styles.exampleText}>{step.example}</Body>
                    </div>
                  </Card>
                ))}
              </div>

              <Card className={styles.flowSummaryCard}>
                <H3 className={styles.summaryTitle}>Complete Flow</H3>
                <div className={styles.flowDiagram}>
                  <code className={styles.flowCode}>
                    ERP (pain.001 or API) → Sending Bank → SWIFT (MT103 or pacs.008) →
                    Receiving Bank (pacs.*) → pacs.002 / camt.053 → Bank → ERP (pain.002)
                  </code>
                </div>
                <div className={styles.converterValue}>
                  <Icon glyph="Megaphone" size="small" />
                  <Body>
                    <strong>Why your converter matters:</strong> Each arrow is a format mapping.
                    Traditional stacks hard-code thousands of rules; your MongoDB config-driven
                    converter loads mappings as data, so adding a corridor/rail becomes a
                    configuration change—not a code project.
                  </Body>
                </div>
              </Card>
            </div>
          </Tab>
        </Tabs>
        )}
      </div>
    </div>
  );
}
