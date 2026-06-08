'use client';

import { useState, useEffect } from 'react';
import styles from './documentation.module.css';
import { Tab, Tabs } from '@leafygreen-ui/tabs';
import { H3, Body } from '@leafygreen-ui/typography';
import Badge from '@leafygreen-ui/badge';
import Icon from '@leafygreen-ui/icon';

export default function Documentation() {
  const [mounted, setMounted] = useState(false);
  const [showDiagramModal, setShowDiagramModal] = useState(false);
  const [showTranslationModal, setShowTranslationModal] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showConfigBuilderModal, setShowConfigBuilderModal] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState(0);
  const [showDbExplorer, setShowDbExplorer] = useState(false);
  const [selectedDbCollection, setSelectedDbCollection] = useState(null);
  const [collectionDocs, setCollectionDocs] = useState(null);
  const [collectionLoading, setCollectionLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dbCollections = [
    { name: 'canonicalJsonStorage', icon: 'Array' },
    { name: 'correspondentBanks', icon: 'Building' },
    { name: 'legalEntities', icon: 'Shield' },
    { name: 'purposeCodes', icon: 'Sparkle' },
    { name: 'conversionConfigs', icon: 'CurlyBraces' },
    { name: 'formatSpecifications', icon: 'Apps' },
  ];

  const handleCollectionSelect = async (collectionName) => {
    if (selectedDbCollection === collectionName && collectionDocs) return;
    setSelectedDbCollection(collectionName);
    setCollectionLoading(true);
    setCollectionDocs(null);
    try {
      const res = await fetch(`/api/collection-preview/${collectionName}`);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setCollectionDocs(data.documents);
    } catch (err) {
      console.error('Collection fetch error:', err);
      setCollectionDocs([]);
    } finally {
      setCollectionLoading(false);
    }
  };

  const openDbExplorer = () => {
    setShowDbExplorer(true);
    if (!selectedDbCollection) {
      handleCollectionSelect(dbCollections[0].name);
    }
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
      description: 'Real-time payments using XML + ISO 8583 per NPCI standards. Third-party integrations often wrap in JSON.',
      detail: 'Core protocol uses XML for UPI APIs and ISO 8583 when routing through IMPS. Mobile-first interface enabling instant inter-bank transfers using virtual payment addresses.',
      whereUsed: 'Indian instant payments.',
      badge: 'Real-time',
      badgeVariant: 'green',
      example: `Core Format: XML + ISO 8583
NPCI UPI APIs use stateless HTTPS with XML input/output.
When routing UPI→IMPS, messages convert from XML to ISO 8583.

Third-party Gateway (JSON wrapper):
{
  "payerVPA": "user@bankname",
  "payeeVPA": "merchant@payment",
  "amount": "500.00",
  "currency": "INR",
  "txnId": "UPI123456789",
  "refId": "ORDER001"
}`,
      explanation: 'UPI core protocol: XML-based APIs (per NPCI guidelines) with ISO 8583 for inter-system routing (e.g., UPI→IMPS conversion). Payment Service Providers must adopt data message standards per XML and ISO 8583. Third-party gateways often expose JSON APIs as abstraction layer for easier developer integration. Virtual Payment Addresses (VPA) like user@bankname enable instant P2P and merchant payments. Processes over 10 billion transactions monthly.'
    }
  ];


  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {!mounted ? (
          <div className={styles.loading}>Loading documentation...</div>
        ) : (
          <Tabs
            aria-label="Payment Format Documentation"
            className={styles.tabs}
            id="documentation-tabs"
          >
          <Tab name="Challenges" default>
            <div className={styles.tabContent}>
              <div className={styles.formatsLayout}>
                <div className={styles.formatsLeftPanel}>
                  <div className={styles.formatsIntro}>
                    <H3 className={styles.introSectionTitle}>The Problem</H3>
                    <H3 className={styles.introTitle}>The Tower of Babel Problem</H3>
                    <Body className={styles.introParagraph}>
                      Payment processors handle legacy card messages (ISO 8583), modern standards (ISO 20022), regional systems (Zengin, UPI), and crypto rails—simultaneously. Each speaks a different dialect: SWIFT MT uses fixed tags, ISO 8583 packs binary bitmaps, ISO 20022 nests verbose XML.
                    </Body>

                    <H3 className={styles.introTitle}>Why It Breaks</H3>
                    <Body className={styles.introParagraph}>
                      Rigid ETL pipelines break when fields change. SWIFT identified <strong>"data truncation" risks</strong> where legacy systems strip ISO 20022 data. Payments stall on missing codes (India's IFSC), wrong scripts (Japan's Katakana), or ambiguous names—queuing for manual review.
                    </Body>

                    <H3 className={styles.introTitle}>The Multi-Rail Reality</H3>
                    <Body className={styles.introParagraph}>
                      In the post-ISO 20022 era, payments complexity has not disappeared—it has fragmented further. While external messaging is now standardized, many banks still operate without a true payment hub, relying on siloed, rail-specific systems and legacy cores that cannot ingest or preserve the richness of ISO 20022 data. As ISO 8583, ISO 20022, real-time payments, and emerging rails coexist, enriched messages are flattened, duplicated, or inconsistently translated across systems, creating operational blind spots and compounding failure risks. This fragmentation also prevents banks from leveraging agentic AI—capable of reasoning across payment context, lifecycle states, and exceptions—because the underlying data remains inconsistent and rail-bound. Without a payment canonical data hub to normalize payment intent and semantics, both real-time control and intelligent automation remain out of reach.
                    </Body>
                  </div>

                  <div className={styles.formatsSelector}>
                    <Body className={styles.selectorLabel}>
                      <Icon glyph="ChevronRight" size="small" /> Select a format to view details
                    </Body>
                    <div className={styles.formatsList}>
                      {paymentFormats.map((format, index) => (
                        <button
                          key={index}
                          className={`${styles.formatListItem} ${selectedFormat === index ? styles.formatListItemActive : ''}`}
                          onClick={() => setSelectedFormat(index)}
                        >
                          <span className={styles.formatListName}>{format.name}</span>
                          <Badge variant={format.badgeVariant} className={styles.formatListBadge}>{format.badge}</Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={styles.formatDetails}>
                  <div className={styles.formatDetailsHeader}>
                    <H3 className={styles.formatDetailsName}>{paymentFormats[selectedFormat].name}</H3>
                    <Badge variant={paymentFormats[selectedFormat].badgeVariant}>
                      {paymentFormats[selectedFormat].badge}
                    </Badge>
                  </div>

                  <Body className={styles.formatDetailsDesc}>
                    {paymentFormats[selectedFormat].description}
                  </Body>

                  <div className={styles.formatDetailsInfo}>
                    <Body className={styles.formatDetailText}>
                      {paymentFormats[selectedFormat].detail}
                    </Body>
                  </div>

                  <div className={styles.formatDetailsFooter}>
                    <Icon glyph="Building" size="small" />
                    <Body>{paymentFormats[selectedFormat].whereUsed}</Body>
                  </div>

                  {paymentFormats[selectedFormat].example && (
                    <div className={styles.formatDetailsExample}>
                      <div className={styles.exampleHeader}>
                        <Icon glyph="Code" size="small" />
                        <Body><strong>Example Message</strong></Body>
                      </div>
                      <pre className={styles.exampleCode}>
                        {paymentFormats[selectedFormat].example}
                      </pre>
                      <div className={styles.explanationSection}>
                        <Icon glyph="InfoWithCircle" size="small" />
                        <Body className={styles.explanationText}>
                          {paymentFormats[selectedFormat].explanation}
                        </Body>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Tab>

          <Tab name="Behind the Scenes">
            <div className={styles.tabContent}>
              <div className={styles.architectureLayout}>
                <div className={styles.architectureTopRow}>
                  <div className={styles.architectureDiagramSection}>
                    <H3 className={styles.archSectionTitle}>Architecture Diagram</H3>
                    <div
                      className={styles.diagramContainer}
                      onClick={() => setShowDiagramModal(true)}
                    >
                      <img
                        src="/architecture-diagram.png"
                        alt="Payment Processing Platform Architecture"
                        className={styles.architectureImage}
                      />
                      <div className={styles.zoomOverlay}>
                        <Icon glyph="MagnifyingGlass" size="large" />
                        <span>Click to enlarge</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.translationSection}>
                    <H3 className={styles.archSectionTitle}>Message Translation</H3>
                    <Body className={styles.archParagraph}>
                      Each conversion pair (e.g., MT103 → pacs.008) is defined by a <strong>configuration document</strong> in MongoDB. A config contains: regex patterns for the <strong>Parser</strong> to extract source fields, field <strong>Mappings</strong> that route data through Rules (deterministic transforms) or AI (for unstructured text like remittance info), and templates for the <strong>Builder</strong> to assemble the target format. Adding a new format means inserting a config document—no code changes.
                    </Body>
                    <div
                      className={styles.translationDiagramContainer}
                      onClick={() => setShowTranslationModal(true)}
                    >
                      <img
                        src="/message-translation-diagram.png"
                        alt="Message Translation Flow: Parser → Mapping → Rules/AI Lanes → Builder"
                        className={styles.translationDiagramImage}
                      />
                      <div className={styles.zoomOverlay}>
                        <Icon glyph="MagnifyingGlass" size="large" />
                        <span>Click to enlarge</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.architectureMiddleRow}>
                  <div className={styles.configSection}>
                    <H3 className={styles.archSectionTitle}>Conversion Configuration</H3>
                    <pre className={styles.configCode}>{`{
  "_id": "MT103_to_pacs.008",
  "extract": {
    "20": ":20:([^\\\\n:]+)",
    "32A": ":32A:([^\\\\n:]+)",
    "50K": ":50K:([\\\\s\\\\S]*?)(?=:[0-9])"
  },
  "map": [
    {"from": "20", "to": ["transactionRef"]},
    {"from": "32A", "to": ["valueDate", "currency", "amount"], "split": [6, 9]},
    {"from": "50K", "to": ["debtorAccount", "debtorName"], "multiline": true},
    {"from": "70", "to": "remittanceInfo", "ai": "remittance"}
  ],
  "output": {
    "transactionRef": "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.InstrId",
    "amount": "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text"
  }
}`}</pre>
                    <Body className={styles.configExplanation}>
                      Three sections define the conversion: <strong>extract</strong> pulls fields using regex, <strong>map</strong> transforms them (splitting composites, formatting dates, routing to AI), and <strong>output</strong> places values in the target format. New message formats are enabled via document inserts, removing translation logic from the deployment cycle.
                    </Body>
                  </div>

                  <div className={styles.canonicalJsonSection}>
                    <H3 className={styles.archSectionTitle}>Canonical JSON</H3>
                    <pre className={styles.canonicalJsonCode}>{`{
  "transactionRef": "MED-CH-ZA-2024-001",
  "amount": "180000.00",
  "currency": "CHF",
  "valueDate": "2024-12-15",

  "debtorName": "SWISS PHARMA AG",
  "debtorAccount": "CH930076201162...",
  "debtorBank": "UBSWCHZH80A",

  "creditorName": "SA HEALTH SUPPLIES",
  "creditorAccount": "ZA12345678901...",
  "creditorBank": "ABSAZAJJXXX",

  "remittanceInfo": "INVOICE MED-ZA-2024-5678",
  "chargeBearer": "SHA"
}`}</pre>
                    <Body className={styles.canonicalJsonExplanation}>
                      Every payment format maps to a single, flat JSON structure. MT103, ISO 8583, pacs.008, blockchain transactions—they all share the same field names for equivalent concepts. This universal bridge enables multi-hop routing (e.g., MT103 → JSON → pacs.009) and preserves ISO 20022's full data richness without truncation.
                    </Body>
                  </div>
                </div>

                <div className={styles.architectureBottomRow}>
                  <div className={styles.agentSection}>
                    <H3 className={styles.archSectionTitle}>Agentic Resolution</H3>
                    <div
                      className={styles.agentDiagramContainer}
                      onClick={() => setShowAgentModal(true)}
                    >
                      <img
                        src="/payment-resolution-ai-agent.png"
                        alt="Payment Resolution AI Agent Architecture"
                        className={styles.agentDiagramImage}
                      />
                      <div className={styles.zoomOverlay}>
                        <Icon glyph="MagnifyingGlass" size="large" />
                        <span>Click to enlarge</span>
                      </div>
                    </div>
                    <Body className={styles.agentExplanation}>
                      When a payment fails validation—missing IFSC code, unrecognized address format, ambiguous beneficiary name—the system doesn't just reject it. A <strong>Supervisory Orchestration Agent</strong> coordinates specialized workers: the <strong>Resolution Agent</strong> searches MongoDB using Atlas Search (fuzzy text), Vector Search (semantic similarity), or LLM inference to find corrections. The <strong>Execution Agent</strong> applies approved fixes and logs an audit trail.
                    </Body>
                  </div>

                  <div className={styles.agentSection}>
                    <H3 className={styles.archSectionTitle}>Config Builder</H3>
                    <div
                      className={styles.agentDiagramContainer}
                      onClick={() => setShowConfigBuilderModal(true)}
                    >
                      <img
                        src="/config-builder.png"
                        alt="Config Builder Architecture"
                        className={styles.agentDiagramImage}
                      />
                      <div className={styles.zoomOverlay}>
                        <Icon glyph="MagnifyingGlass" size="large" />
                        <span>Click to enlarge</span>
                      </div>
                    </div>
                    <Body className={styles.agentExplanation}>
                      When you provide a sample message, the system runs a <strong>MongoDB aggregation pipeline</strong> across all existing configs to build a field lookup. It auto-detects the format (SWIFT, ISO8583, ISO20022), extracts fields, and matches them against <strong>learned patterns</strong>. For unknown fields, an <strong>LLM suggests mappings</strong>—constrained by the target format specification. Users approve configs before they're permanent. What took months now takes minutes.
                    </Body>
                  </div>
                </div>
              </div>

              {showDiagramModal && (
                <div className={styles.diagramModal} onClick={() => setShowDiagramModal(false)}>
                  <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                    <button
                      className={styles.modalClose}
                      onClick={() => setShowDiagramModal(false)}
                    >
                      <Icon glyph="X" size="large" />
                    </button>
                    <img
                      src="/architecture-diagram.png"
                      alt="Payment Processing Platform Architecture"
                      className={styles.modalImage}
                    />
                  </div>
                </div>
              )}

              {showTranslationModal && (
                <div className={styles.diagramModal} onClick={() => setShowTranslationModal(false)}>
                  <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                    <button
                      className={styles.modalClose}
                      onClick={() => setShowTranslationModal(false)}
                    >
                      <Icon glyph="X" size="large" />
                    </button>
                    <img
                      src="/message-translation-diagram.png"
                      alt="Message Translation Flow: Parser → Mapping → Rules/AI Lanes → Builder"
                      className={styles.modalImage}
                    />
                  </div>
                </div>
              )}

              {showAgentModal && (
                <div className={styles.diagramModal} onClick={() => setShowAgentModal(false)}>
                  <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                    <button
                      className={styles.modalClose}
                      onClick={() => setShowAgentModal(false)}
                    >
                      <Icon glyph="X" size="large" />
                    </button>
                    <img
                      src="/payment-resolution-ai-agent.png"
                      alt="Payment Resolution AI Agent Architecture"
                      className={styles.modalImage}
                    />
                  </div>
                </div>
              )}

              {showConfigBuilderModal && (
                <div className={styles.diagramModal} onClick={() => setShowConfigBuilderModal(false)}>
                  <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                    <button
                      className={styles.modalClose}
                      onClick={() => setShowConfigBuilderModal(false)}
                    >
                      <Icon glyph="X" size="large" />
                    </button>
                    <img
                      src="/config-builder.png"
                      alt="Config Builder Architecture"
                      className={styles.modalImage}
                    />
                  </div>
                </div>
              )}
            </div>
          </Tab>

          <Tab name="Why MongoDB?">
            <div className={styles.tabContent}>
              <div className={styles.mongoDbLayout}>
                <div className={styles.mongoDbIntro}>
                  <H3 className={styles.introSectionTitle}>The Unified Data Platform</H3>
                  <Body className={styles.introParagraph}>
                    MongoDB Atlas serves as the <strong>operational data layer</strong> for the entire platform—format configuration, transaction processing, agent decisions, and audit trails in one system.
                  </Body>
                  <button className={styles.dbExplorerButton} onClick={openDbExplorer}>
                    <Icon glyph="Database" size="small" /> Explore Database
                  </button>
                </div>

                <div className={styles.featuresGridCompact}>
                  <div className={styles.featureCardCompact}>
                    <H3 className={styles.featureTitle}><Icon glyph="Apps" size="small" /> Document Model</H3>
                    <Body className={styles.featureDescCompact}>
                      Flexible schema stores canonical JSON, metadata, and audit trail in a single document. No migrations when formats evolve.
                    </Body>
                  </div>

                  <div className={styles.featureCardCompact}>
                    <H3 className={styles.featureTitle}><Icon glyph="MagnifyingGlass" size="small" /> Atlas Search</H3>
                    <Body className={styles.featureDescCompact}>
                      Typo-tolerant lookups (2 edit distance) for IFSC codes, bank names. "HDFC Connaught" → "HDFC Bank Connaught Place".
                    </Body>
                  </div>

                  <div className={styles.featureCardCompact}>
                    <H3 className={styles.featureTitle}><Icon glyph="Sparkle" size="small" /> Vector Search</H3>
                    <Body className={styles.featureDescCompact}>
                      Semantic matching for payment classification. "paying wages" → purpose code SALA by meaning, not keywords.
                    </Body>
                  </div>

                  <div className={styles.featureCardCompact}>
                    <H3 className={styles.featureTitle}><Icon glyph="CurlyBraces" size="small" /> Aggregation</H3>
                    <Body className={styles.featureDescCompact}>
                      Config Builder uses $objectToArray + $unwind to extract mappings from 50+ configs in &lt;100ms.
                    </Body>
                  </div>

                  <div className={styles.featureCardCompact}>
                    <H3 className={styles.featureTitle}><Icon glyph="Shield" size="small" /> Atomicity</H3>
                    <Body className={styles.featureDescCompact}>
                      Agent repairs update fields + audit trail in one atomic operation. No partial writes.
                    </Body>
                  </div>
                </div>

                <div className={styles.aiIntegrationCompact}>
                  <H3 className={styles.introSectionTitle}>AI Framework Integration</H3>
                  <div className={styles.aiToolsCompact}>
                    <span><strong>LangGraph</strong> — multi-agent workflow with interrupt() for human review</span>
                    <span><strong>AWS Bedrock</strong> — Claude for unstructured field extraction</span>
                    <span><strong>LangChain</strong> — @tool decorators expose MongoDB as agent capabilities</span>
                    <span><strong>Voyage AI</strong> — embeddings stored directly in Atlas</span>
                  </div>
                </div>

                <div className={styles.painPointsCompact}>
                  <H3 className={styles.introSectionTitle}>Before → After</H3>
                  <div className={styles.painPointsList}>
                    <div className={styles.painPointRow}>
                      <Body><Icon glyph="X" size="small" /> Rigid ETL breaks on new fields</Body>
                      <Body><Icon glyph="Checkmark" size="small" /> Document model accepts changes</Body>
                    </div>
                    <div className={styles.painPointRow}>
                      <Body><Icon glyph="X" size="small" /> Data truncation in legacy systems</Body>
                      <Body><Icon glyph="Checkmark" size="small" /> JSON captures full message depth</Body>
                    </div>
                    <div className={styles.painPointRow}>
                      <Body><Icon glyph="X" size="small" /> Separate search, vector, cache infra</Body>
                      <Body><Icon glyph="Checkmark" size="small" /> All-in-one Atlas platform</Body>
                    </div>
                    <div className={styles.painPointRow}>
                      <Body><Icon glyph="X" size="small" /> Manual review takes days</Body>
                      <Body><Icon glyph="Checkmark" size="small" /> Agents resolve in seconds</Body>
                    </div>
                    <div className={styles.painPointRow}>
                      <Body><Icon glyph="X" size="small" /> New formats take months</Body>
                      <Body><Icon glyph="Checkmark" size="small" /> Faster format onboarding</Body>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Tab>
        </Tabs>
        )}
      </div>

      {showDbExplorer && (
        <div className={styles.dbOverlay} onClick={() => setShowDbExplorer(false)}>
          <div className={styles.dbPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dbPanelHeader}>
              <div className={styles.dbPanelHeaderLeft}>
                <Icon glyph="Database" size="small" />
                <H3>MongoDB Explorer</H3>
              </div>
              <button className={styles.dbCloseBtn} onClick={() => setShowDbExplorer(false)}>
                <Icon glyph="X" size="small" />
              </button>
            </div>
            <div className={styles.dbPanelBody}>
              <div className={styles.dbSidebar}>
                <div className={styles.dbSidebarTitle}>
                  <Body weight="medium">COLLECTIONS</Body>
                </div>
                {dbCollections.map((col) => (
                  <button
                    key={col.name}
                    className={`${styles.dbSidebarItem} ${selectedDbCollection === col.name ? styles.dbSidebarItemActive : ''}`}
                    onClick={() => handleCollectionSelect(col.name)}
                  >
                    <Icon glyph={col.icon} size="small" />
                    <span>{col.name}</span>
                  </button>
                ))}
              </div>
              <div className={styles.dbContent}>
                {collectionLoading ? (
                  <div className={styles.dbEmptyState}>
                    <Body>Loading documents...</Body>
                  </div>
                ) : collectionDocs && collectionDocs.length > 0 ? (
                  <>
                    <div className={styles.dbContentHeader}>
                      <Body weight="medium">{selectedDbCollection}</Body>
                      <Badge variant="darkgray">{collectionDocs.length} documents</Badge>
                    </div>
                    <div className={styles.dbDocsList}>
                      {collectionDocs.map((doc, idx) => (
                        <pre key={idx} className={styles.dbDocJson}>
                          {JSON.stringify(doc, null, 2)}
                        </pre>
                      ))}
                    </div>
                  </>
                ) : selectedDbCollection ? (
                  <div className={styles.dbEmptyState}>
                    <Body>No documents found.</Body>
                  </div>
                ) : (
                  <div className={styles.dbEmptyState}>
                    <Body>Select a collection to explore.</Body>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
