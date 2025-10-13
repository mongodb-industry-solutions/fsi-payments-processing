'use client';

import React, { useState } from 'react';
import { H1, H2, H3, Subtitle, Body } from '@leafygreen-ui/typography';
import Card from '@leafygreen-ui/card';
import Badge from '@leafygreen-ui/badge';
import Icon from '@leafygreen-ui/icon';
import IconButton from '@leafygreen-ui/icon-button';
import styles from './MongoDBShowcase.module.css';

export default function MongoDBShowcase() {
  const [expandedCard, setExpandedCard] = useState(null);

  const toggleCard = (cardName) => {
    console.log('Toggle card:', cardName, 'Current expanded:', expandedCard);
    setExpandedCard(expandedCard === cardName ? null : cardName);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <H1 className={styles.mainTitle}>MongoDB-Powered Adaptive Conversion</H1>
        <Subtitle className={styles.mainSubtitle}>
          How storing conversion logic as documents enables automatic learning without code deployments
        </Subtitle>
        <div className={styles.badges}>
          <Badge variant="darkgreen">Configuration-Driven</Badge>
          <Badge variant="blue">Auto-Learning</Badge>
          <Badge variant="lightgray">Zero Downtime</Badge>
        </div>
      </div>

      {/* Document Structure */}
      <div className={styles.structureSection}>
        <H2 className={styles.sectionTitle}>Single Document = Complete Conversion</H2>
        <Subtitle className={styles.sectionSubtitle}>
          Each format pair stored as one MongoDB document containing all conversion logic
        </Subtitle>

        <div className={styles.documentGrid}>
          {/* Parser Card */}
          <Card className={styles.docCard}>
            <div
              className={styles.docHeaderClickable}
              onClick={() => toggleCard('parser')}
            >
              <div className={styles.docHeaderLeft}>
                <Icon glyph="Edit" />
                <H3>Parser</H3>
              </div>
              <Icon glyph={expandedCard === 'parser' ? 'ChevronUp' : 'ChevronDown'} />
            </div>
            <Body>Field extraction patterns (11 fields configured)</Body>
            {expandedCard === 'parser' && (
              <pre className={styles.miniCode}>{`"20": {
  "pattern": ":20:([^\\n:]+)",
  "name": "transaction_reference"
},
"32A": {
  "pattern": ":32A:([^\\n:]+)",
  "name": "value_date_amount",
  "components": {
    "value_date": [0, 6],
    "currency": [6, 9],
    "amount": [9, null]
  }
},
"50K": {
  "pattern": ":50K:([^\\n:]+...)*",
  "name": "ordering_customer",
  "multiline": true
}
...`}</pre>
            )}
          </Card>

          {/* Mappings Card */}
          <Card className={styles.docCard}>
            <div
              className={styles.docHeaderClickable}
              onClick={() => toggleCard('mappings')}
            >
              <div className={styles.docHeaderLeft}>
                <Icon glyph="Diagram3" />
                <H3>Mappings</H3>
              </div>
              <Icon glyph={expandedCard === 'mappings' ? 'ChevronUp' : 'ChevronDown'} />
            </div>
            <Body>15 field mappings across 3 processing lanes</Body>
            {expandedCard === 'mappings' && (
              <pre className={styles.miniCode}>{`{
  "source": "20",
  "targets": ["MsgId", "InstrId",
              "EndToEndId", "TxId"],
  "processing_lane": "RULES",
  "confidence": 1.0
},
{
  "source": "71A",
  "targets": ["ChrgBr"],
  "transform": "map",
  "transform_config": {
    "map": {
      "SHA": "SHAR",
      "OUR": "DEBT"
    }
  },
  "processing_lane": "RULES"
}
...`}</pre>
            )}
          </Card>

          {/* Builder Card */}
          <Card className={styles.docCard}>
            <div
              className={styles.docHeaderClickable}
              onClick={() => toggleCard('builder')}
            >
              <div className={styles.docHeaderLeft}>
                <Icon glyph="Building" />
                <H3>Builder</H3>
              </div>
              <Icon glyph={expandedCard === 'builder' ? 'ChevronUp' : 'ChevronDown'} />
            </div>
            <Body>pacs.008 XML template with placeholders</Body>
            {expandedCard === 'builder' && (
              <pre className={styles.miniCode}>{`{
  "output_type": "xml",
  "template": {
    "Document": {
      "@xmlns": "{{namespace}}",
      "FIToFICstmrCdtTrf": {
        "GrpHdr": {
          "MsgId": "{{MsgId}}",
          "CreDtTm": "{{current_time}}"
        },
        "CdtTrfTxInf": {
          "PmtId": {
            "EndToEndId": "{{EndToEndId}}"
          },
          "IntrBkSttlmAmt": {
            "@Ccy": "{{Currency}}",
            "#text": "{{Amount}}"
          }
          ...
        }
      }
    }
  }
}`}</pre>
            )}
          </Card>

          {/* AI Processing Card */}
          <Card className={styles.docCard}>
            <div
              className={styles.docHeaderClickable}
              onClick={() => toggleCard('ai')}
            >
              <div className={styles.docHeaderLeft}>
                <Icon glyph="Sparkle" />
                <H3>AI Processing</H3>
              </div>
              <Icon glyph={expandedCard === 'ai' ? 'ChevronUp' : 'ChevronDown'} />
            </div>
            <Body>AI lane for complex field extraction</Body>
            {expandedCard === 'ai' && (
              <pre className={styles.miniCode}>{`Field 70 (Remittance Info):
  targets: ["RmtInf.Ustrd",
            "RmtInf.Structured"]
  field_type: "remittance"
  transform: "ai_extract"
  confidence_threshold: 0.80

Field 72 (Sender-Receiver):
  targets: ["InstrForCdtrAgt"]
  field_type: "sender_receiver_info"
  transform: "ai_extract"
  confidence_threshold: 0.75

Model: Claude 3 Haiku
Processing: 1-2 seconds
Fallback: Human review if < threshold`}</pre>
            )}
          </Card>
        </div>
      </div>

      {/* Learning Flow */}
      <div className={styles.learningSection}>
        <H2 className={styles.sectionTitle}>How It Learns Automatically</H2>
        
        <div className={styles.flowContainer}>
          <div className={styles.flowStep}>
            <div className={styles.stepNumber}>1</div>
            <div className={styles.stepContent}>
              <H3>Analyze Existing Configs</H3>
              <Body>System learns semantic patterns from MT103, MT202 stored in MongoDB</Body>
            </div>
          </div>

          <Icon glyph="ArrowRight" className={styles.flowArrow} />

          <div className={styles.flowStep}>
            <div className={styles.stepNumber}>2</div>
            <div className={styles.stepContent}>
              <H3>Store Patterns</H3>
              <Body>Saves reusable patterns to semantic_patterns collection</Body>
            </div>
          </div>

          <Icon glyph="ArrowRight" className={styles.flowArrow} />

          <div className={styles.flowStep}>
            <div className={styles.stepNumber}>3</div>
            <div className={styles.stepContent}>
              <H3>Auto-Generate</H3>
              <Body>Creates new format config in 2-8 seconds with 85%+ accuracy</Body>
            </div>
          </div>

          <Icon glyph="ArrowRight" className={styles.flowArrow} />

          <div className={styles.flowStep}>
            <div className={styles.stepNumber}>4</div>
            <div className={styles.stepContent}>
              <H3>Improve</H3>
              <Body>Human corrections enhance pattern confidence for future configs</Body>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className={styles.benefitsSection}>
        <H2 className={styles.sectionTitle}>Key Benefits</H2>

        <div className={styles.benefitsGrid}>
          <Card className={styles.benefitCard}>
            <div className={styles.benefitIcon}>
              <Icon glyph="Checkmark" size="xlarge" />
            </div>
            <H3>Zero-Code Format Addition</H3>
            <Body>
              New formats configured via MongoDB only—no application code changes or deployments required.
            </Body>
          </Card>

          <Card className={styles.benefitCard}>
            <div className={styles.benefitIcon}>
              <Icon glyph="Sparkle" size="xlarge" />
            </div>
            <H3>Intelligent Auto-Configuration</H3>
            <Body>
              System auto-generates new format configs in 2-8 seconds by learning from existing patterns.
            </Body>
          </Card>

          <Card className={styles.benefitCard}>
            <div className={styles.benefitIcon}>
              <Icon glyph="Refresh" size="xlarge" />
            </div>
            <H3>Self-Improving Over Time</H3>
            <Body>
              Every human correction improves pattern confidence, making future auto-generations more accurate.
            </Body>
          </Card>

          <Card className={styles.benefitCard}>
            <div className={styles.benefitIcon}>
              <Icon glyph="InviteUser" size="xlarge" />
            </div>
            <H3>Real-Time Configuration Updates</H3>
            <Body>
              Modify conversion logic instantly without downtime or application restarts.
            </Body>
          </Card>
        </div>
      </div>

      {/* Call to Action */}
      <div className={styles.callToAction}>
        <Icon glyph="ArrowLeft" />
        <Body>
          Select a payment scenario from the left panel or try the Auto Configuration Builder
          to see MongoDB adaptive conversion in action
        </Body>
      </div>
    </div>
  );
}
