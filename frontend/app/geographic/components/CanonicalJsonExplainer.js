'use client';

import React, { useState } from 'react';
import { H1, H2, H3, Subtitle, Body } from '@leafygreen-ui/typography';
import Badge from '@leafygreen-ui/badge';
import Card from '@leafygreen-ui/card';
import Icon from '@leafygreen-ui/icon';
import styles from './CanonicalJsonExplainer.module.css';

const CanonicalJsonExplainer = () => {
  const [activeExample, setActiveExample] = useState('mt103');

  // Schema structure with all major sections
  const schemaStructure = [
    { section: 'header', description: 'Message metadata and control', icon: 'InfoWithCircle' },
    { section: 'transaction', description: 'Transaction identifiers and references', icon: 'Unlock' },
    { section: 'parties', description: 'Debtor, creditor, and agent information', icon: 'Person' },
    { section: 'amounts', description: 'All monetary values and currencies', icon: 'Charts' },
    { section: 'dates', description: 'Value dates and timestamps', icon: 'Calendar' },
    { section: 'remittance', description: 'Payment details and invoices', icon: 'Edit' },
    { section: 'instructions', description: 'Processing and settlement instructions', icon: 'Megaphone' },
    { section: 'charges', description: 'Fee and charge information', icon: 'CreditCard' },
  ];

  // Concrete examples showing the transformation
  const examples = {
    mt103: {
      title: 'MT103 to Canonical JSON',
      sourceFormat: 'SWIFT MT103',
      source: `Field 50K: /CH9300762011623852957
SWISS PHARMA INTERNATIONAL AG
BAHNHOFSTRASSE 45
8001 ZURICH

Field 59: /ZA123456789012345678901
SOUTH AFRICAN HEALTH SUPPLIES

Field 32A: 241215CHF180000,00

Field 70: INVOICE MED-ZA-2024-5678
PHARMACEUTICAL SUPPLIES`,
      json: {
        parties: {
          debtor: {
            account: "CH9300762011623852957",
            name: "SWISS PHARMA INTERNATIONAL AG",
            address: "BAHNHOFSTRASSE 45, 8001 ZURICH"
          },
          creditor: {
            account: "ZA123456789012345678901",
            name: "SOUTH AFRICAN HEALTH SUPPLIES"
          }
        },
        amounts: {
          instructed: {
            value: "180000.00",
            currency: "CHF"
          }
        },
        dates: {
          value_date: "2024-12-15"
        },
        remittance: {
          unstructured: [
            "INVOICE MED-ZA-2024-5678",
            "PHARMACEUTICAL SUPPLIES"
          ]
        }
      }
    },
    pacs008: {
      title: 'pacs.008 to Canonical JSON',
      sourceFormat: 'ISO 20022 pacs.008',
      source: `<CdtTrfTxInf>
  <Dbtr>
    <Nm>SWISS PHARMA AG</Nm>
    <Id>
      <OrgId>
        <Othr>
          <Id>CHE123456789</Id>
        </Othr>
      </OrgId>
    </Id>
  </Dbtr>
  <DbtrAcct>
    <Id>
      <IBAN>CH9300762011623852957</IBAN>
    </Id>
  </DbtrAcct>
  <InstdAmt Ccy="CHF">180000.00</InstdAmt>
</CdtTrfTxInf>`,
      json: {
        parties: {
          debtor: {
            name: "SWISS PHARMA AG",
            account: "CH9300762011623852957",
            organization_id: "CHE123456789"
          }
        },
        amounts: {
          instructed: {
            value: "180000.00",
            currency: "CHF"
          }
        }
      }
    },
    iso8583: {
      title: 'ISO 8583 to Canonical JSON',
      sourceFormat: 'ISO 8583 (Card Payment)',
      source: `Field 2: 5123456789012345
Field 3: 000000 (Purchase)
Field 4: 000000050000 (500.00)
Field 42: MERCHANT_ID_12345
Field 43: Coffee Shop Downtown
123 Main St, NYC`,
      json: {
        parties: {
          cardholder: {
            pan: "5123456789012345"
          },
          merchant: {
            id: "MERCHANT_ID_12345",
            name: "Coffee Shop Downtown",
            location: "123 Main St, NYC"
          }
        },
        amounts: {
          transaction: {
            value: "500.00",
            currency: "USD"
          }
        },
        transaction: {
          type: "purchase",
          processing_code: "000000"
        }
      }
    }
  };

  const currentExample = examples[activeExample];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <H1 className={styles.mainTitle}>Canonical JSON Format</H1>
        <Subtitle className={styles.mainSubtitle}>
          The universal intermediary format enabling any-to-any payment conversion
        </Subtitle>
        <div className={styles.badges}>
          <Badge variant="darkgreen">Universal Schema</Badge>
          <Badge variant="blue">Zero Data Loss</Badge>
          <Badge variant="purple">Multi-Hop Routing</Badge>
        </div>
      </div>

      {/* What is Canonical JSON */}
      <div className={styles.whatIsSection}>
        <H2 className={styles.sectionTitle}>What is Canonical JSON?</H2>
        <Card className={styles.explanationCard}>
          <Body>
            Canonical JSON is a <strong>standardized JSON schema</strong> that serves as the universal intermediary
            format in our payment conversion system. Instead of building direct conversions between every format pair
            (MT103 → pacs.008, MT103 → ISO8583, etc.), we convert:
          </Body>
          <div className={styles.conversionFlow}>
            <div className={styles.flowBox}>
              <Body><strong>Any Format</strong></Body>
              <Body className={styles.flowLabel}>MT103, pacs.008, ISO8583...</Body>
            </div>
            <div className={styles.flowArrow}>→</div>
            <div className={`${styles.flowBox} ${styles.flowBoxHighlight}`}>
              <Body><strong>Canonical JSON</strong></Body>
              <Body className={styles.flowLabel}>Universal Schema</Body>
            </div>
            <div className={styles.flowArrow}>→</div>
            <div className={styles.flowBox}>
              <Body><strong>Any Format</strong></Body>
              <Body className={styles.flowLabel}>pacs.009, TARGET2, CHAPS...</Body>
            </div>
          </div>
          <Body className={styles.benefitText}>
            This approach reduces complexity from <strong>O(n²)</strong> direct mappings to <strong>O(2n)</strong> hub mappings,
            while ensuring consistent data representation across all formats.
          </Body>
        </Card>
      </div>

      {/* Schema Structure */}
      <div className={styles.schemaSection}>
        <H2 className={styles.sectionTitle}>Schema Structure</H2>
        <Subtitle className={styles.sectionSubtitle}>
          The Canonical JSON schema organizes payment data into 8 core sections
        </Subtitle>
        <div className={styles.schemaGrid}>
          {schemaStructure.map((item) => (
            <Card key={item.section} className={styles.schemaCard}>
              <div className={styles.schemaHeader}>
                <Icon glyph={item.icon} />
                <H3>{item.section}</H3>
              </div>
              <Body>{item.description}</Body>
            </Card>
          ))}
        </div>
      </div>

      {/* Live Examples */}
      <div className={styles.examplesSection}>
        <H2 className={styles.sectionTitle}>See It In Action</H2>
        <Subtitle className={styles.sectionSubtitle}>
          See how different payment formats map to the same Canonical JSON structure
        </Subtitle>

        <div className={styles.exampleTabs}>
          <button
            className={`${styles.exampleTab} ${activeExample === 'mt103' ? styles.active : ''}`}
            onClick={() => setActiveExample('mt103')}
          >
            SWIFT MT103
          </button>
          <button
            className={`${styles.exampleTab} ${activeExample === 'pacs008' ? styles.active : ''}`}
            onClick={() => setActiveExample('pacs008')}
          >
            ISO 20022 pacs.008
          </button>
          <button
            className={`${styles.exampleTab} ${activeExample === 'iso8583' ? styles.active : ''}`}
            onClick={() => setActiveExample('iso8583')}
          >
            ISO 8583
          </button>
        </div>

        <div className={styles.exampleContent}>
          <div className={styles.exampleColumn}>
            <div className={styles.exampleHeader}>
              <H3>Source: {currentExample.sourceFormat}</H3>
            </div>
            <pre className={styles.codeBlock}>
              {currentExample.source}
            </pre>
          </div>

          <div className={styles.exampleArrow}>
            <Icon glyph="ArrowRight" size="large" />
          </div>

          <div className={styles.exampleColumn}>
            <div className={styles.exampleHeader}>
              <H3>Canonical JSON Output</H3>
              <Badge variant="darkgreen">Universal Schema</Badge>
            </div>
            <pre className={styles.codeBlock}>
              {JSON.stringify(currentExample.json, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      {/* Key Benefits */}
      <div className={styles.benefitsSection}>
        <H2 className={styles.sectionTitle}>Why Canonical JSON?</H2>
        <div className={styles.benefitsGrid}>
          <Card className={styles.benefitCard}>
            <div className={styles.benefitIcon}>
              <Icon glyph="Checkmark" size="xlarge" />
            </div>
            <H3>Single Source of Truth</H3>
            <Body>
              Every payment field has one canonical location. No ambiguity, no conflicts,
              no data loss during conversion.
            </Body>
          </Card>

          <Card className={styles.benefitCard}>
            <div className={styles.benefitIcon}>
              <Icon glyph="Diagram3" size="xlarge" />
            </div>
            <H3>Linear Scaling</H3>
            <Body>
              Adding a new format requires just 2 mappings (to/from JSON), not N mappings
              to every existing format. Complexity grows linearly, not exponentially.
            </Body>
          </Card>

          <Card className={styles.benefitCard}>
            <div className={styles.benefitIcon}>
              <Icon glyph="Megaphone" size="xlarge" />
            </div>
            <H3>Multi-Hop Routing</H3>
            <Body>
              Convert between formats with no direct mapping through intermediate JSON
              conversion paths (e.g., MT103 → JSON → pacs.009).
            </Body>
          </Card>

          <Card className={styles.benefitCard}>
            <div className={styles.benefitIcon}>
              <Icon glyph="University" size="xlarge" />
            </div>
            <H3>Consistent Validation</H3>
            <Body>
              Validate once at the JSON level instead of in every format-specific converter.
              Ensures data quality across all conversions.
            </Body>
          </Card>
        </div>
      </div>

      {/* Complete Schema Reference */}
      <div className={styles.schemaReferenceSection}>
        <H2 className={styles.sectionTitle}>Complete Schema Reference</H2>
        <Card className={styles.schemaReferenceCard}>
          <pre className={styles.fullSchemaCode}>
{`{
  "header": {
    "message_type": "...",
    "message_id": "...",
    "created_datetime": "..."
  },
  "transaction": {
    "end_to_end_id": "...",
    "transaction_id": "...",
    "instruction_id": "..."
  },
  "parties": {
    "debtor": {
      "name": "...",
      "account": "...",
      "address": "...",
      "organization_id": "..."
    },
    "creditor": {
      "name": "...",
      "account": "...",
      "address": "..."
    },
    "debtor_agent": { ... },
    "creditor_agent": { ... }
  },
  "amounts": {
    "instructed": {
      "value": "...",
      "currency": "..."
    },
    "interbank_settled": { ... }
  },
  "dates": {
    "value_date": "...",
    "acceptance_datetime": "..."
  },
  "remittance": {
    "unstructured": [...],
    "structured": { ... }
  },
  "instructions": {
    "settlement_method": "...",
    "clearing_channel": "...",
    "priority": "..."
  },
  "charges": {
    "charge_bearer": "...",
    "charges": [...]
  }
}`}
          </pre>
        </Card>
      </div>

      {/* Call to Action */}
      <div className={styles.callToAction}>
        <Icon glyph="ArrowLeft" />
        <Body>Select a payment scenario on the left to see Canonical JSON in a real conversion flow</Body>
      </div>
    </div>
  );
};

export default CanonicalJsonExplainer;
