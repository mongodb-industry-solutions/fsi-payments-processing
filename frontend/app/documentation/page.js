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

  useEffect(() => {
    setMounted(true);
  }, []);

  const paymentFormats = [
    {
      name: 'SWIFT MT (ISO 15022)',
      description: 'Legacy cross-border messages (e.g., MT103 customer credit, MT202 bank transfer). Migrating to ISO 20022 MX by Nov 2025 (CBPR+).',
      detail: 'Text-based format with fixed field tags (e.g., :20:, :50K:) containing structured data like sender, receiver, amount, and payment details.',
      whereUsed: 'Global correspondent banking.',
      badge: 'Legacy',
      badgeVariant: 'yellow'
    },
    {
      name: 'ISO 20022 (MX)',
      description: 'Modern XML/JSON-serializable model with rich structured data. Families: pain.* (customer→bank), pacs.* (bank→bank), camt.* (reporting).',
      detail: 'Uses hierarchical XML structure with human-readable tags, supporting extensive remittance info, structured addresses, and regulatory data.',
      whereUsed: 'Core of SEPA, CHAPS, RTP, FedNow, CHIPS, T2.',
      badge: 'Standard',
      badgeVariant: 'green'
    },
    {
      name: 'ACH / NACHA file',
      description: 'Fixed-width ASCII batch file; every record = 94 chars; uses SEC codes (PPD, CCD, WEB …).',
      detail: 'Each line represents a specific record type (file header, batch header, entry detail, addenda) with position-based data fields.',
      whereUsed: 'US ACH batch payments (payroll/AP).',
      badge: 'Batch',
      badgeVariant: 'blue'
    },
    {
      name: 'ISO 8583',
      description: 'Compact bitmap-based messages for card authorization & clearing.',
      detail: 'Binary format using bitmaps to indicate which data elements are present, optimized for low-latency transaction processing.',
      whereUsed: 'POS, ATM, card networks.',
      badge: 'Card',
      badgeVariant: 'purple'
    },
    {
      name: 'RTP (US)',
      description: 'Real-time payments rail by The Clearing House using ISO 20022.',
      detail: 'Supports immediate payment confirmation, request-for-payment flows, and rich remittance data with 24/7/365 availability.',
      whereUsed: 'US instant payments.',
      badge: 'Real-time',
      badgeVariant: 'green'
    },
    {
      name: 'FedNow (US)',
      description: 'Federal Reserve instant rail; ISO 20022 native.',
      detail: 'Interoperable with RTP, providing immediate funds availability and supporting payment requests with detailed remittance information.',
      whereUsed: 'US banks & credit unions.',
      badge: 'Real-time',
      badgeVariant: 'green'
    },
    {
      name: 'CHAPS (UK RTGS)',
      description: 'Live on ISO 20022 since Jun 2023 with enhanced data (LEI, purpose codes).',
      detail: 'High-value same-day sterling payments with irrevocable settlement, supporting Legal Entity Identifiers and extended payment purpose codes.',
      whereUsed: 'UK high-value RTGS.',
      badge: 'RTGS',
      badgeVariant: 'blue'
    },
    {
      name: 'Faster Payments (UK)',
      description: 'Historically ISO 8583; Pay.UK provides ISO 20022 mapping library.',
      detail: 'Near-instant GBP transfers (typically within seconds) with message validation and enhanced fraud detection capabilities.',
      whereUsed: 'UK instant retail payments.',
      badge: 'Real-time',
      badgeVariant: 'green'
    },
    {
      name: 'SEPA (EU)',
      description: 'ISO 20022 end-to-end: pain.001/008, pacs.008/003, camt.* for reporting.',
      detail: 'Unified EUR payment scheme across 36 countries with standardized credit transfers, direct debits, and instant payments (SCT Inst).',
      whereUsed: 'EU cross-border EUR payments.',
      badge: 'Standard',
      badgeVariant: 'green'
    },
    {
      name: 'T2 (Eurosystem)',
      description: 'Successor to TARGET2 (Mar 2023); ISO 20022 native.',
      detail: 'Real-time gross settlement system consolidating TARGET2 and T2S, processing high-value euro payments with central bank liquidity.',
      whereUsed: 'Euro RTGS settlement.',
      badge: 'RTGS',
      badgeVariant: 'blue'
    },
    {
      name: 'CHIPS (US)',
      description: 'ISO 20022 since Apr 2024.',
      detail: 'Clearing House Interbank Payments System processing over $1.5 trillion daily in high-value USD payments with multilateral netting.',
      whereUsed: 'US high-value interbank.',
      badge: 'RTGS',
      badgeVariant: 'blue'
    },
    {
      name: 'UPI (India)',
      description: 'API-driven real-time scheme (JSON/XML payloads).',
      detail: 'Mobile-first payment interface enabling instant inter-bank transfers using virtual payment addresses, supporting P2P and merchant payments.',
      whereUsed: 'Indian instant payments.',
      badge: 'Real-time',
      badgeVariant: 'green'
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
