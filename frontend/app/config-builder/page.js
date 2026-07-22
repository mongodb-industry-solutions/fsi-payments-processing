'use client';

import { useState, useEffect } from 'react';
import Card from '@leafygreen-ui/card';
import Button from '@leafygreen-ui/button';
import Banner from '@leafygreen-ui/banner';
import Badge from '@leafygreen-ui/badge';
import Code from '@leafygreen-ui/code';
import TextInput from '@leafygreen-ui/text-input';
import { Select, Option } from '@leafygreen-ui/select';
import { Tabs, Tab } from '@leafygreen-ui/tabs';

// Sample messages for demo
const SAMPLE_MESSAGES = {
  MT202: {
    label: 'MT202 (Bank Transfer)',
    format: 'SWIFT',
    message: `{1:F01CHASUS33AXXX0000000000}{2:I202DEUTDEFFXXXXN}{4:
:20:MT202TEST
:21:REF2024MT202001
:13C:/STIME/1230+0100
:32A:241215EUR500000,00
:52A:CHASUS33XXX
:56A:BNPAFRPPXXX
:57A:DEUTDEFFXXX
:58A:/DE12345678901234567890
BENEFICIARY INSTITUTION
:72:/BNF/TREASURY OPERATIONS
/INS/PRIORITY PROCESSING
-}`
  },
  MT205: {
    label: 'MT205 (Financial Institution Transfer)',
    format: 'SWIFT',
    message: `{1:F01BNPAFRPPAXXX0000000000}{2:I205DEUTDEFFXXXXN}{4:
:20:MT205TEST001
:21:REF2025MT205
:13C:/CLSTIME/1800+0100
:32A:250115USD750000,00
:52A:BNPAFRPP
:56A:COBADEFFXXX
:57A:DEUTDEFF
:58A:/DE89370400440532013000
DEUTSCHE BANK AG
:72:/BNF/LIQUIDITY MANAGEMENT
-}`
  },
  ISO8583_0210: {
    label: 'ISO8583 0210 (Card Response)',
    format: 'ISO8583',
    message: `0210|8000000000000000|4539123456789012|000000|000000025000|1205143052|123456|143052|1205|ABCD12345678|TERM0001|MERCHANT12345678|ACME STORE 123 MAIN ST SINGAPORE SG|702`
  },
  'pacs.004': {
    label: 'pacs.004 (Payment Return)',
    format: 'ISO20022',
    message: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.004.001.09">
    <PmtRtr>
        <GrpHdr>
            <MsgId>RETURN-2024-001</MsgId>
            <CreDtTm>2024-12-15T10:30:00Z</CreDtTm>
            <NbOfTxs>1</NbOfTxs>
            <SttlmMtd>CLRG</SttlmMtd>
        </GrpHdr>
        <TxInf>
            <RtrId>RTN2024001</RtrId>
            <OrgnlGrpInf>
                <OrgnlMsgId>ORIG-MSG-2024-001</OrgnlMsgId>
                <OrgnlMsgNmId>pacs.008.001.08</OrgnlMsgNmId>
            </OrgnlGrpInf>
            <RtrdIntrBkSttlmAmt Ccy="EUR">5000.00</RtrdIntrBkSttlmAmt>
            <IntrBkSttlmDt>2024-12-16</IntrBkSttlmDt>
            <RtrRsnInf>
                <Rsn>
                    <Cd>AC04</Cd>
                </Rsn>
            </RtrRsnInf>
            <InstgAgt>
                <FinInstnId>
                    <BICFI>DEUTDEFFXXX</BICFI>
                </FinInstnId>
            </InstgAgt>
            <InstdAgt>
                <FinInstnId>
                    <BICFI>CHABORLAXXX</BICFI>
                </FinInstnId>
            </InstdAgt>
            <ChrgBr>SHAR</ChrgBr>
        </TxInf>
    </PmtRtr>
</Document>`
  }
};

// Format explanations for dynamic display
const FORMAT_INFO = {
  MT103: {
    name: 'MT103',
    type: 'SWIFT',
    description: 'Single Customer Credit Transfer - used for cross-border wire transfers between banks.',
    keyFields: [
      { field: '20', desc: 'Transaction Reference' },
      { field: '32A', desc: 'Value Date, Currency, Amount' },
      { field: '50K', desc: 'Ordering Customer (Debtor)' },
      { field: '59', desc: 'Beneficiary Customer (Creditor)' },
      { field: '70', desc: 'Remittance Information' },
      { field: '71A', desc: 'Details of Charges' }
    ]
  },
  MT202: {
    name: 'MT202',
    type: 'SWIFT',
    description: 'General Financial Institution Transfer - bank-to-bank transfers for treasury operations.',
    keyFields: [
      { field: '20', desc: 'Transaction Reference' },
      { field: '21', desc: 'Related Reference' },
      { field: '32A', desc: 'Value Date, Currency, Amount' },
      { field: '52A', desc: 'Ordering Institution' },
      { field: '58A', desc: 'Beneficiary Institution' },
      { field: '72', desc: 'Sender to Receiver Info' }
    ]
  },
  'pacs.008': {
    name: 'pacs.008',
    type: 'ISO 20022',
    description: 'FIToFICustomerCreditTransfer - ISO 20022 message for customer credit transfers.',
    keyFields: [
      { field: 'MsgId', desc: 'Message Identification' },
      { field: 'InstrId', desc: 'Instruction Identification' },
      { field: 'EndToEndId', desc: 'End-to-End Identification' },
      { field: 'IntrBkSttlmAmt', desc: 'Interbank Settlement Amount' },
      { field: 'Dbtr', desc: 'Debtor Information' },
      { field: 'Cdtr', desc: 'Creditor Information' }
    ]
  },
  'pacs.009': {
    name: 'pacs.009',
    type: 'ISO 20022',
    description: 'FinancialInstitutionCreditTransfer - ISO 20022 message for bank-to-bank transfers.',
    keyFields: [
      { field: 'MsgId', desc: 'Message Identification' },
      { field: 'InstrId', desc: 'Instruction Identification' },
      { field: 'IntrBkSttlmAmt', desc: 'Interbank Settlement Amount' },
      { field: 'InstgAgt', desc: 'Instructing Agent' },
      { field: 'InstdAgt', desc: 'Instructed Agent' },
      { field: 'Cdtr', desc: 'Creditor Institution' }
    ]
  },
  'pacs.004': {
    name: 'pacs.004',
    type: 'ISO 20022',
    description: 'PaymentReturn - ISO 20022 message for returning payments (e.g., account closed, insufficient funds).',
    keyFields: [
      { field: 'MsgId', desc: 'Message Identification' },
      { field: 'RtrId', desc: 'Return Identification' },
      { field: 'OrgnlMsgId', desc: 'Original Message ID' },
      { field: 'OrgnlEndToEndId', desc: 'Original End-to-End ID' },
      { field: 'RtrdIntrBkSttlmAmt', desc: 'Returned Amount' },
      { field: 'RtrRsnInf/Cd', desc: 'Return Reason Code (AC04, AM04, etc.)' }
    ]
  },
  JSON: {
    name: 'Canonical JSON',
    type: 'Internal',
    description: 'Universal bridge format - all payment formats convert through this intermediate structure.',
    keyFields: [
      { field: 'transactionRef', desc: 'Transaction Reference' },
      { field: 'amount/currency', desc: 'Payment Amount' },
      { field: 'valueDate', desc: 'Settlement Date' },
      { field: 'debtor*', desc: 'Debtor Information' },
      { field: 'creditor*', desc: 'Creditor Information' },
      { field: 'remittanceInfo', desc: 'Payment Details' }
    ]
  },
  TARGET2: {
    name: 'TARGET2',
    type: 'RTGS',
    description: 'Trans-European Automated Real-time Gross Settlement Express Transfer system.',
    keyFields: [
      { field: 'MsgId', desc: 'Message Identification' },
      { field: 'SttlmMtd', desc: 'Settlement Method' },
      { field: 'IntrBkSttlmAmt', desc: 'Settlement Amount' },
      { field: 'DbtrAgt', desc: 'Debtor Agent BIC' },
      { field: 'CdtrAgt', desc: 'Creditor Agent BIC' }
    ]
  },
  CHAPS: {
    name: 'CHAPS',
    type: 'RTGS',
    description: 'Clearing House Automated Payment System - UK same-day sterling transfers.',
    keyFields: [
      { field: 'MsgId', desc: 'Message Identification' },
      { field: 'IntrBkSttlmAmt', desc: 'Settlement Amount (GBP)' },
      { field: 'ChrgBr', desc: 'Charge Bearer' },
      { field: 'DbtrAcct', desc: 'Debtor Account (Sort Code)' },
      { field: 'CdtrAcct', desc: 'Creditor Account (Sort Code)' }
    ]
  },
  ISO8583_0200: {
    name: 'ISO8583_0200',
    type: 'ISO 8583',
    description: 'Card authorization request message - POS terminal to acquirer for purchase transactions.',
    keyFields: [
      { field: 'mti', desc: 'Message Type Indicator (0200)' },
      { field: 'pan', desc: 'Primary Account Number' },
      { field: 'processing_code', desc: 'Processing Code' },
      { field: 'amount', desc: 'Transaction Amount' },
      { field: 'stan', desc: 'System Trace Audit Number' },
      { field: 'merchantInfo', desc: 'Card Acceptor Name/Location' }
    ]
  },
  'cain.001': {
    name: 'cain.001',
    type: 'ISO 20022',
    description: 'AcceptorAuthorisationRequest - Card transaction authorization in ISO 20022 format.',
    keyFields: [
      { field: 'MsgTp', desc: 'Message Type' },
      { field: 'TxId', desc: 'Transaction Identification' },
      { field: 'TxAmt', desc: 'Transaction Amount' },
      { field: 'Card.PAN', desc: 'Primary Account Number' },
      { field: 'AccptrTxDtTm', desc: 'Acceptor Transaction DateTime' },
      { field: 'MrchntCtgyCd', desc: 'Merchant Category Code' }
    ]
  },
  ISO8583_0210: {
    name: 'ISO8583_0210',
    type: 'ISO 8583',
    description: 'Card authorization response message - Issuer response to acquirer for purchase transactions.',
    keyFields: [
      { field: 'mti', desc: 'Message Type Indicator (0210)' },
      { field: 'pan', desc: 'Primary Account Number' },
      { field: 'response_code', desc: 'Authorization Response Code' },
      { field: 'auth_code', desc: 'Authorization ID Response' },
      { field: 'amount', desc: 'Transaction Amount' },
      { field: 'stan', desc: 'System Trace Audit Number' }
    ]
  }
};

// LLM Prompt Details Component
function LLMPromptDetails({ promptInfo }) {
  const [activePromptTab, setActivePromptTab] = useState(0);

  if (!promptInfo) return null;

  return (
    <div className="prompt-details">
      <style jsx>{`
        .prompt-details {
          font-size: 13px;
        }
        .prompt-meta {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
          padding: 12px;
          background: var(--gray-light3);
          border-radius: 6px;
          flex-wrap: wrap;
        }
        .prompt-meta-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .prompt-meta-label {
          font-size: 11px;
          color: var(--gray-base);
          text-transform: uppercase;
        }
        .prompt-meta-value {
          font-weight: 500;
          font-family: monospace;
          font-size: 12px;
        }
        .construction-steps {
          margin-bottom: 16px;
        }
        .step-item {
          display: flex;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid var(--gray-light2);
        }
        .step-item:last-child {
          border-bottom: none;
        }
        .step-number {
          width: 24px;
          height: 24px;
          background: #E1F7FF;
          color: #0B61A4;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
        }
        .step-content {
          flex: 1;
        }
        .step-name {
          font-weight: 600;
          margin-bottom: 2px;
        }
        .step-desc {
          color: var(--gray-dark1);
          font-size: 12px;
        }
        .fields-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        .fields-section {
          background: var(--gray-light3);
          border-radius: 6px;
          padding: 12px;
        }
        .fields-section-title {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .field-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 150px;
          overflow-y: auto;
        }
        .field-item {
          font-size: 11px;
          padding: 4px 8px;
          background: white;
          border-radius: 4px;
          font-family: monospace;
        }
        .field-item.blocked {
          background: #FFEBE6;
          color: #A6260D;
          text-decoration: line-through;
        }
        .field-item.available {
          background: #E3FCF7;
          color: #00684A;
        }
        .prompt-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        .prompt-tab {
          padding: 6px 12px;
          font-size: 12px;
          border: 1px solid var(--gray-light2);
          border-radius: 4px;
          background: white;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .prompt-tab:hover {
          border-color: var(--blue-base);
        }
        .prompt-tab.active {
          background: #E1F7FF;
          border-color: #0B61A4;
          color: #0B61A4;
        }
        .prompt-code {
          background: var(--gray-dark4);
          border-radius: 6px;
          max-height: 300px;
          overflow: auto;
          padding: 12px;
          font-family: monospace;
          font-size: 11px;
          white-space: pre-wrap;
          word-break: break-word;
          color: #E0E0E0;
        }
        .section-divider {
          font-weight: 600;
          margin: 16px 0 8px;
          font-size: 12px;
          color: var(--gray-dark2);
        }
      `}</style>

      {/* Meta info */}
      <div className="prompt-meta">
        <div className="prompt-meta-item">
          <span className="prompt-meta-label">Model</span>
          <span className="prompt-meta-value">{promptInfo.model_id?.split('.').pop() || 'claude-3-haiku'}</span>
        </div>
        <div className="prompt-meta-item">
          <span className="prompt-meta-label">Source</span>
          <span className="prompt-meta-value">{promptInfo.source_format}</span>
        </div>
        <div className="prompt-meta-item">
          <span className="prompt-meta-label">Target</span>
          <span className="prompt-meta-value">{promptInfo.target_format}</span>
        </div>
        <div className="prompt-meta-item">
          <span className="prompt-meta-label">Unknown Fields</span>
          <span className="prompt-meta-value">{promptInfo.unknown_fields?.length || 0}</span>
        </div>
      </div>

      {/* Construction Steps */}
      <div className="section-divider">How the Prompt is Constructed</div>
      <div className="construction-steps">
        {promptInfo.construction_steps?.map((step) => (
          <div key={step.step} className="step-item">
            <span className="step-number">{step.step}</span>
            <div className="step-content">
              <div className="step-name">{step.name}</div>
              <div className="step-desc">{step.description}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Format Specification Source */}
      {promptInfo.format_specification && (
        <>
          <div className="section-divider">Format Specification Source (MongoDB)</div>
          <div style={{
            background: '#F5F6F7',
            border: '1px solid #E8EDEB',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}>
            {/* Header row */}
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <div>
                <span style={{ color: '#5C6C75' }}>Collection: </span>
                <span style={{ color: '#00684A', fontWeight: 500 }}>{promptInfo.format_specification.collection}</span>
              </div>
              <div>
                <span style={{ color: '#5C6C75' }}>Document ID: </span>
                <span style={{ color: '#0B61A4', fontWeight: 500 }}>{promptInfo.format_specification.document_id}</span>
              </div>
              <div>
                <span style={{ color: '#5C6C75' }}>Format Type: </span>
                <span style={{ fontWeight: 500 }}>{promptInfo.format_specification.format_type}</span>
              </div>
              <div>
                <span style={{ color: '#5C6C75' }}>Total Fields: </span>
                <span style={{ fontWeight: 500 }}>{promptInfo.format_specification.total_fields}</span>
              </div>
            </div>
            {promptInfo.format_specification.description && (
              <div style={{ marginBottom: '12px', color: '#5C6C75', fontStyle: 'italic' }}>
                {promptInfo.format_specification.description}
              </div>
            )}
            {/* Full document JSON */}
            <div style={{
              background: '#1E2022',
              borderRadius: '4px',
              padding: '10px',
              maxHeight: '200px',
              overflow: 'auto',
              fontSize: '11px',
              color: '#E0E0E0',
              whiteSpace: 'pre-wrap'
            }}>
              <div style={{ color: '#888', marginBottom: '4px' }}>// Document in collection</div>
              {JSON.stringify({
                _id: promptInfo.format_specification.document_id,
                format_type: promptInfo.format_specification.format_type,
                description: promptInfo.format_specification.description,
                supported_fields: promptInfo.format_specification.supported_fields
              }, null, 2)}
            </div>
          </div>
        </>
      )}

      {/* Target Fields Grid */}
      <div className="section-divider">Target Field Constraints</div>
      <div className="fields-grid">
        <div className="fields-section">
          <div className="fields-section-title">
            <Badge variant="green" style={{ fontSize: '10px' }}>Available</Badge>
            ({promptInfo.available_target_fields?.length || 0})
          </div>
          <div className="field-list">
            {promptInfo.available_target_fields?.slice(0, 15).map((f) => (
              <div key={f.name} className="field-item available" title={f.description}>
                {f.name}
              </div>
            ))}
            {promptInfo.available_target_fields?.length > 15 && (
              <div style={{ fontSize: '11px', color: 'var(--gray-base)', padding: '4px' }}>
                +{promptInfo.available_target_fields.length - 15} more...
              </div>
            )}
          </div>
        </div>
        <div className="fields-section">
          <div className="fields-section-title">
            <Badge variant="red" style={{ fontSize: '10px' }}>Blocked</Badge>
            Already Mapped ({promptInfo.blocked_target_fields?.length || 0})
          </div>
          <div className="field-list">
            {promptInfo.blocked_target_fields?.length > 0 ? (
              promptInfo.blocked_target_fields.map((f) => (
                <div key={f.name} className="field-item blocked" title={f.description}>
                  {f.name}
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--gray-base)', fontSize: '11px', padding: '4px' }}>None</div>
            )}
          </div>
        </div>
      </div>

      {/* Prompt/Response Tabs */}
      <div className="section-divider">Raw Prompt & Response</div>
      <div className="prompt-tabs">
        <button
          className={`prompt-tab ${activePromptTab === 0 ? 'active' : ''}`}
          onClick={() => setActivePromptTab(0)}
        >
          Full Prompt Sent
        </button>
        <button
          className={`prompt-tab ${activePromptTab === 1 ? 'active' : ''}`}
          onClick={() => setActivePromptTab(1)}
        >
          LLM Response
        </button>
      </div>

      <div className="prompt-code">
        {activePromptTab === 0
          ? promptInfo.full_prompt || 'No prompt available'
          : promptInfo.llm_response || 'No response available'}
      </div>

      {promptInfo.error && (
        <Banner variant="warning" style={{ marginTop: '12px' }}>
          LLM Error: {promptInfo.error}
        </Banner>
      )}
    </div>
  );
}

export default function ConfigBuilderPage() {
  // State
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Auto-configure state
  const [sourceFormat, setSourceFormat] = useState('MT202');
  const [targetFormat, setTargetFormat] = useState('JSON');
  const [sampleMessage, setSampleMessage] = useState(SAMPLE_MESSAGES.MT202.message);
  const [generatedConfig, setGeneratedConfig] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [activeTab, setActiveTab] = useState(0); // 0 = Schema Reference (default)
  const [showMt103Example, setShowMt103Example] = useState(false);
  const [showCanonicalJson, setShowCanonicalJson] = useState(false);
  const [schemaConfigId, setSchemaConfigId] = useState(''); // For Schema Reference tab
  const [mounted, setMounted] = useState(false); // For hydration fix
  const [showPromptDetails, setShowPromptDetails] = useState(false); // For LLM prompt details
  const [formatSpecs, setFormatSpecs] = useState([]); // Target format specifications from MongoDB
  const [sessionConfigId, setSessionConfigId] = useState(null); // Track config saved in this session

  // Fix hydration mismatch - only render Tabs after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get selected config object for Schema Reference tab
  const schemaConfig = configs.find(c => c._id === schemaConfigId) || null;

  // Filter configs: show permanent (no expires_at) + this session's config
  const displayConfigs = configs.filter(c =>
    !c.expires_at || c._id === sessionConfigId
  );

  // Parse config ID to get source and target formats
  // Handles session suffix: MT202_to_JSON_90df8718 → source: MT202, target: JSON
  const parseConfigId = (configId) => {
    if (!configId) return { source: null, target: null };
    // Strip session suffix (8 hex chars at end) if present
    const cleanId = configId.replace(/_[a-f0-9]{8}$/, '');
    const parts = cleanId.split('_to_');
    return { source: parts[0], target: parts[1] };
  };

  const { source: schemaSource, target: schemaTarget } = parseConfigId(schemaConfigId);
  const sourceInfo = FORMAT_INFO[schemaSource] || null;
  const targetInfo = FORMAT_INFO[schemaTarget] || null;

  // Load existing configs and format specs on mount
  useEffect(() => {
    loadConfigs();
    loadFormatSpecs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/configs');
      if (!response.ok) throw new Error('Failed to load configs');
      const data = await response.json();
      setConfigs(data.configs || []);
      setError(null);
    } catch (err) {
      setError(`Failed to load configs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadFormatSpecs = async () => {
    try {
      const response = await fetch('/api/format-specifications');
      if (response.ok) {
        const data = await response.json();
        setFormatSpecs(data.specifications || []);
      }
    } catch (err) {
      console.warn('Could not load format specifications:', err.message);
    }
  };

  // Handle source format change - update sample message
  const handleSourceFormatChange = (value) => {
    setSourceFormat(value);
    const sample = SAMPLE_MESSAGES[value];
    if (sample) {
      setSampleMessage(sample.message);
    }
  };

  const handleGenerateConfig = async () => {
    try {
      setGenerating(true);
      setGenerateError(null);
      setSuccessMessage(null);
      setGeneratedConfig(null);

      const response = await fetch('/api/auto-configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFormat: sourceFormat,
          targetFormat: targetFormat,
          sampleMessage: sampleMessage
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to generate config');
      }

      const data = await response.json();
      setGeneratedConfig(data);
    } catch (err) {
      setGenerateError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveConfig = async () => {
    if (!generatedConfig) return;

    try {
      setApproving(true);
      setGenerateError(null);

      const response = await fetch(
        `/api/auto-configure/${encodeURIComponent(generatedConfig.configurationId)}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to approve config');
      }

      const data = await response.json();
      const uniqueConfigId = data.configurationId; // Backend returns unique ID with suffix

      setSessionConfigId(uniqueConfigId); // Track this session's config
      setSchemaConfigId(uniqueConfigId); // Auto-select in Schema Reference dropdown
      setActiveTab(0); // Switch to Schema Reference tab to show the saved config
      setSuccessMessage(`Config "${uniqueConfigId}" saved! View it in Schema Reference tab.`);
      setGeneratedConfig(null);
      loadConfigs(); // Refresh list
    } catch (err) {
      setGenerateError(err.message);
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="config-builder-page">
      <style jsx>{`
        .config-builder-page {
          padding: var(--space-xl, 24px);
          max-width: var(--container-lg, 1920px);
          margin: 0 auto;
        }
        .main-layout {
          display: flex;
          gap: 0;
        }
        .main-content {
          flex: 1;
          min-width: 0;
        }
        .section-title {
          font-size: var(--font-md, 16px);
          font-weight: 600;
          margin-bottom: var(--space-lg, 16px);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .form-group {
          margin-bottom: 16px;
        }
        .form-group label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 6px;
          color: var(--gray-dark2);
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .sample-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .sample-btn {
          padding: 6px 12px;
          font-size: 12px;
          border: 1px solid var(--gray-light2);
          border-radius: 4px;
          background: white;
          color: var(--gray-dark2);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .sample-btn:hover {
          border-color: var(--blue-base);
          background: var(--blue-light3);
          color: var(--blue-dark2);
        }
        .sample-btn.active {
          border-color: var(--green-dark1);
          background: var(--green-light3);
          color: var(--green-dark2);
        }
        .message-textarea {
          width: 100%;
          min-height: 150px;
          font-family: monospace;
          font-size: 12px;
          padding: 12px;
          border: 1px solid var(--gray-light2);
          border-radius: 8px;
          resize: vertical;
        }
        .action-buttons {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }
        .result-section {
          margin-top: 24px;
        }
        .confidence-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .confidence-track {
          flex: 1;
          height: 8px;
          background: var(--gray-light2);
          border-radius: 4px;
          overflow: hidden;
        }
        .confidence-fill {
          height: 100%;
          background: var(--green-dark1);
          transition: width 0.3s ease;
        }
        .confidence-label {
          font-size: 14px;
          font-weight: 500;
          min-width: 50px;
        }
        .field-badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .config-detail {
          background: var(--gray-dark4);
          border-radius: 8px;
          padding: 12px;
          max-height: 250px;
          overflow: auto;
          font-size: 11px;
        }
        .schema-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          font-size: 12px;
          color: var(--green-dark2);
          background: var(--green-light3);
          border: 1px solid var(--green-light2);
          border-radius: 6px;
          cursor: pointer;
          margin-bottom: 16px;
          transition: all 0.2s ease;
        }
        .schema-toggle:hover {
          background: var(--green-light2);
        }
        .schema-toggle svg {
          transition: transform 0.2s ease;
        }
        .schema-toggle.open svg {
          transform: rotate(180deg);
        }
        .schema-info {
          background: var(--green-light3);
          border: 1px solid var(--green-light2);
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 16px;
          font-size: 13px;
        }
        .schema-info code {
          background: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
        }
        .schema-fields {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          margin-top: 8px;
        }
        .schema-field {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .schema-field code {
          font-weight: 500;
        }
        .schema-field span {
          color: var(--gray-dark1);
          font-size: 12px;
        }
        .suggestions-section {
          margin-top: 16px;
          margin-bottom: 16px;
        }
        .suggestions-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--gray-dark2);
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .suggestion-card {
          background: var(--yellow-light3);
          border: 1px solid var(--yellow-light1);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 8px;
        }
        .suggestion-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .suggestion-field-id {
          font-family: monospace;
          font-size: 13px;
          font-weight: 600;
          color: var(--yellow-dark2);
          background: var(--yellow-light2);
          padding: 2px 8px;
          border-radius: 4px;
        }
        .suggestion-arrow {
          color: var(--gray-base);
          font-size: 14px;
        }
        .suggestion-target {
          font-family: monospace;
          font-size: 13px;
          font-weight: 500;
          color: var(--green-dark2);
          background: var(--green-light3);
          padding: 2px 8px;
          border-radius: 4px;
        }
        .suggestion-value {
          font-size: 11px;
          color: var(--gray-dark1);
          font-family: monospace;
          background: white;
          padding: 6px 8px;
          border-radius: 4px;
          margin-bottom: 8px;
          max-height: 60px;
          overflow: auto;
          white-space: pre-wrap;
          word-break: break-all;
        }
        .suggestion-reasoning {
          font-size: 12px;
          color: var(--gray-dark2);
          line-height: 1.4;
          padding-left: 8px;
          border-left: 2px solid var(--yellow-base);
        }
        .suggestion-target-info {
          font-size: 11px;
          color: var(--gray-base);
          margin-top: 6px;
        }
        .suggestion-target-info code {
          background: var(--gray-light3);
          padding: 1px 4px;
          border-radius: 3px;
          font-size: 10px;
        }
        /* Schema Reference Tab Styles */
        .schema-section {
          margin-bottom: 24px;
        }
        .format-info-card {
          background: white;
          border: 1px solid var(--gray-light2);
          border-radius: 8px;
          padding: 16px;
        }
        .schema-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: var(--space-md, 12px);
          margin-bottom: 16px;
        }
        .schema-card {
          background: white;
          border: 1px solid var(--gray-light2);
          border-radius: 8px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          min-height: 240px;
          max-height: 360px;
          min-width: 0;
          width: 100%;
        }
        .schema-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          flex-shrink: 0;
          height: 24px;
        }
        .schema-card-number {
          width: 24px;
          height: 24px;
          background: var(--green-light3);
          color: var(--green-dark2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
        }
        .schema-card-title {
          font-size: var(--font-base, 14px);
          font-weight: 600;
          color: var(--black);
        }
        .schema-card-desc {
          font-size: var(--font-sm, 13px);
          color: var(--gray-dark1);
          margin-bottom: var(--space-md, 12px);
          line-height: 1.5;
          flex-shrink: 0;
          min-height: 36px;
          overflow: hidden;
        }
        .schema-card-code {
          background: var(--gray-light3);
          border-radius: 6px;
          padding: var(--space-sm, 10px);
          font-family: monospace;
          font-size: var(--font-xs, 12px);
          overflow: auto;
          flex: 1;
          min-height: 0;
          min-width: 0;
        }
        .schema-card-code pre {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .expandable-section {
          background: var(--gray-light3);
          border: 1px solid var(--gray-light2);
          border-radius: 8px;
          margin-bottom: 12px;
        }
        .expandable-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          cursor: pointer;
          user-select: none;
        }
        .expandable-header:hover {
          background: rgba(0,0,0,0.02);
        }
        .expandable-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--gray-dark2);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .expandable-content {
          padding: 0 16px 16px;
        }
        .expandable-code {
          background: var(--gray-dark4);
          border-radius: 6px;
          max-height: 300px;
          overflow: auto;
        }
        .canonical-field-group {
          margin-bottom: 16px;
        }
        .canonical-field-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--gray-dark2);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .canonical-fields {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .canonical-field {
          background: var(--blue-light3);
          color: var(--blue-dark2);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-family: monospace;
        }
        .canonical-field.required {
          background: var(--green-light3);
          color: var(--green-dark2);
        }
        .tabs-container {
          margin-bottom: 0;
          background: white;
          border: 1px solid var(--gray-light2);
          border-radius: 12px;
          padding: 20px 24px;
        }
        .page-header-wrapper {
          background: linear-gradient(135deg, #F9FBFA 0%, #FFFFFF 100%);
          border: 1px solid var(--gray-light2);
          border-radius: 12px;
          padding: 20px 24px;
          margin-bottom: 20px;
        }
        .page-header {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }
        .page-title {
          font-size: clamp(1.5rem, 1.25rem + 0.5vw, 1.75rem);
          font-weight: 700;
          color: var(--green-dark2);
          margin: 0 0 6px 0;
        }
        .page-subtitle {
          font-size: var(--font-base, 14px);
          color: var(--gray-dark1);
          margin: 0;
          line-height: 1.5;
        }
        .schema-selector-card {
          background: var(--gray-light3);
          border: 1px solid var(--gray-light2);
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .schema-selector-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--gray-dark2);
          white-space: nowrap;
        }
        .schema-intro {
          background: var(--gray-light3);
          border: none;
          border-radius: 6px;
          padding: 10px 14px;
          margin-bottom: 16px;
          margin-top: 8px;
        }
        .schema-intro-text {
          font-size: var(--font-xs, 12px);
          color: var(--gray-dark1);
          line-height: 1.5;
          margin: 0;
        }
        /* Build Config Form Styles */
        .build-step {
          background: white;
          border: 1px solid var(--gray-light2);
          border-radius: 8px;
          padding: 16px 20px;
          margin-bottom: 12px;
        }
        .build-step-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .build-step-number {
          width: 22px;
          height: 22px;
          background: var(--green-light3);
          color: var(--green-dark2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
          flex-shrink: 0;
        }
        .build-step-title {
          font-size: var(--font-base, 14px);
          font-weight: 600;
          color: var(--black);
        }
        .build-form-card {
          background: white;
          border: 1px solid var(--gray-light2);
          border-radius: 8px;
          padding: 16px;
        }
      `}</style>

      {/* Page Header */}
      <div className="page-header-wrapper">
        <div className="page-header">
          <h1 className="page-title">Config Studio</h1>
          <p className="page-subtitle">Explore existing configs or generate new ones via pattern matching + LLM suggestions</p>
        </div>
      </div>

      {error && (
        <Banner variant="danger" style={{ marginBottom: '16px' }}>
          {error}
        </Banner>
      )}

      {successMessage && (
        <Banner variant="success" style={{ marginBottom: '16px' }}>
          {successMessage}
        </Banner>
      )}

      <div className="tabs-container">
        {mounted ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} aria-label="Config Studio tabs">
            <Tab name="Schema Reference">
              {/* Schema Reference Content */}
              <div className="schema-section">
                {/* Intro Banner */}
                <div className="schema-intro">
                  <p className="schema-intro-text">
                    Each conversion config has three sections: <strong>Extract</strong> (regex patterns to parse source),
                    <strong> Map</strong> (transformation rules), and <strong>Output</strong> (target field paths).
                    Select a config below to explore its structure.
                  </p>
                </div>

                {/* Config Selector */}
                <div className="schema-selector-card">
                  <span className="schema-selector-label">View config:</span>
                  <Select
                    aria-label="Select a config to view its structure"
                    placeholder="Choose a conversion config..."
                    value={schemaConfigId}
                    onChange={(value) => setSchemaConfigId(value)}
                    allowDeselect={false}
                    style={{ minWidth: '280px' }}
                  >
                    {displayConfigs.map((config) => (
                      <Option key={config._id} value={config._id}>
                        {config._id === sessionConfigId
                          ? `⭐ ${config._id.replace('_to_', ' → ')} (Your Session)`
                          : config._id.replace('_to_', ' → ')}
                      </Option>
                    ))}
                  </Select>
                  {schemaConfig && (
                    <Badge variant="green" style={{ marginLeft: 'auto' }}>
                      {schemaConfig.map?.length || 0} mappings
                    </Badge>
                  )}
                </div>

              {/* Show format info when config is selected */}
              {schemaConfig ? (
                <>
                  {/* Format Info Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    {/* Source Format */}
                    <div className="format-info-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Badge variant="blue">Source</Badge>
                        <span style={{ fontWeight: '600', fontSize: '14px' }}>{sourceInfo?.name || schemaSource}</span>
                        {sourceInfo?.type && <Badge variant="lightgray">{sourceInfo.type}</Badge>}
                      </div>
                      {sourceInfo?.description && (
                        <p style={{ fontSize: '12px', color: 'var(--gray-dark1)', marginBottom: '12px' }}>
                          {sourceInfo.description}
                        </p>
                      )}
                      {sourceInfo?.keyFields && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {sourceInfo.keyFields.map((f, i) => (
                            <span key={i} style={{
                              background: '#E1F7FF',
                              color: '#0B61A4',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontFamily: 'monospace'
                            }} title={f.desc}>
                              {f.field}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Target Format */}
                    <div className="format-info-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Badge variant="green">Target</Badge>
                        <span style={{ fontWeight: '600', fontSize: '14px' }}>{targetInfo?.name || schemaTarget}</span>
                        {targetInfo?.type && <Badge variant="lightgray">{targetInfo.type}</Badge>}
                      </div>
                      {targetInfo?.description && (
                        <p style={{ fontSize: '12px', color: 'var(--gray-dark1)', marginBottom: '12px' }}>
                          {targetInfo.description}
                        </p>
                      )}
                      {targetInfo?.keyFields && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {targetInfo.keyFields.map((f, i) => (
                            <span key={i} style={{
                              background: '#E3FCF7',
                              color: '#00684A',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontFamily: 'monospace'
                            }} title={f.desc}>
                              {f.field}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3 Cards showing actual config data */}
                  <div className="schema-cards">
                    {/* Extract Card */}
                    <div className="schema-card">
                      <div className="schema-card-header">
                        <span className="schema-card-number">1</span>
                        <span className="schema-card-title">Extract</span>
                        <Badge variant="lightgray" style={{ marginLeft: 'auto' }}>
                          {schemaConfig.extract ? Object.keys(schemaConfig.extract).length : 0} patterns
                        </Badge>
                      </div>
                      <p className="schema-card-desc">
                        Regex patterns to pull fields from {sourceInfo?.name || schemaSource} messages.
                      </p>
                      <div className="schema-card-code">
                        <pre>{schemaConfig.extract ? JSON.stringify(schemaConfig.extract, null, 2) : 'No extract patterns'}</pre>
                      </div>
                    </div>

                    {/* Map Card */}
                    <div className="schema-card">
                      <div className="schema-card-header">
                        <span className="schema-card-number">2</span>
                        <span className="schema-card-title">Map</span>
                        <Badge variant="lightgray" style={{ marginLeft: 'auto' }}>
                          {schemaConfig.map ? schemaConfig.map.length : 0} mappings
                        </Badge>
                      </div>
                      <p className="schema-card-desc">
                        Transform rules: direct, split, multiline, AI extraction.
                      </p>
                      <div className="schema-card-code">
                        <pre>{schemaConfig.map ? JSON.stringify(schemaConfig.map, null, 2) : 'No mappings'}</pre>
                      </div>
                    </div>

                    {/* Output Card */}
                    <div className="schema-card">
                      <div className="schema-card-header">
                        <span className="schema-card-number">3</span>
                        <span className="schema-card-title">Output</span>
                        <Badge variant="lightgray" style={{ marginLeft: 'auto' }}>
                          {schemaConfig.output ? Object.keys(schemaConfig.output).length : 0} fields
                        </Badge>
                      </div>
                      <p className="schema-card-desc">
                        Map to {targetInfo?.name || schemaTarget} field paths.
                      </p>
                      <div className="schema-card-code">
                        <pre>{schemaConfig.output ? JSON.stringify(schemaConfig.output, null, 2) : 'No output mappings'}</pre>
                      </div>
                    </div>
                  </div>

                  {/* Full Config JSON */}
                  <div className="expandable-section">
                    <div className="expandable-header" onClick={() => setShowMt103Example(!showMt103Example)}>
                      <span className="expandable-title">
                        <Badge variant="blue">Full Config</Badge>
                        {schemaConfigId.replace('_to_', ' → ')}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: showMt103Example ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                        <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                      </svg>
                    </div>
                    {showMt103Example && (
                      <div className="expandable-content">
                        <div className="expandable-code">
                          <Code language="json">{JSON.stringify(schemaConfig, null, 2)}</Code>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Default view when no config selected */
                <>
                  {/* Static 3 Cards showing example structure */}
                  <div className="schema-cards">
                    <div className="schema-card">
                      <div className="schema-card-header">
                        <span className="schema-card-number">1</span>
                        <span className="schema-card-title">Extract</span>
                      </div>
                      <p className="schema-card-desc">
                        Regex patterns to pull fields from the source message.
                      </p>
                      <div className="schema-card-code">
                        <pre>{`"extract": {
  "20": ":20:([^\\n:]+)",
  "32A": ":32A:([^\\n:]+)"
}`}</pre>
                      </div>
                    </div>

                    <div className="schema-card">
                      <div className="schema-card-header">
                        <span className="schema-card-number">2</span>
                        <span className="schema-card-title">Map</span>
                      </div>
                      <p className="schema-card-desc">
                        Transform: direct, split, multiline, AI.
                      </p>
                      <div className="schema-card-code">
                        <pre>{`"map": [
  {"from": "20", "to": ["ref"]},
  {"from": "32A", "split": [6,9]}
]`}</pre>
                      </div>
                    </div>

                    <div className="schema-card">
                      <div className="schema-card-header">
                        <span className="schema-card-number">3</span>
                        <span className="schema-card-title">Output</span>
                      </div>
                      <p className="schema-card-desc">
                        Map to target format paths.
                      </p>
                      <div className="schema-card-code">
                        <pre>{`"output": {
  "ref": "transactionRef",
  "amount": "amount"
}`}</pre>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Expandable: Canonical JSON - always shown */}
              <div className="expandable-section">
                <div className="expandable-header" onClick={() => setShowCanonicalJson(!showCanonicalJson)}>
                  <span className="expandable-title">
                    <Badge variant="green">Reference</Badge>
                    Canonical JSON Fields
                  </span>
                  <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: showCanonicalJson ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  </svg>
                </div>
                {showCanonicalJson && (
                  <div className="expandable-content">
                    <p style={{ fontSize: '12px', color: 'var(--gray-dark1)', marginBottom: '16px' }}>
                      Universal bridge format - all payment formats convert through this structure.
                    </p>

                    <div className="canonical-field-group">
                      <div className="canonical-field-title">Required Fields</div>
                      <div className="canonical-fields">
                        <span className="canonical-field required">transactionRef</span>
                        <span className="canonical-field required">amount</span>
                        <span className="canonical-field required">currency</span>
                        <span className="canonical-field required">valueDate</span>
                      </div>
                    </div>

                    <div className="canonical-field-group">
                      <div className="canonical-field-title">Party Information</div>
                      <div className="canonical-fields">
                        <span className="canonical-field">debtorName</span>
                        <span className="canonical-field">debtorAccount</span>
                        <span className="canonical-field">debtorBank</span>
                        <span className="canonical-field">creditorName</span>
                        <span className="canonical-field">creditorAccount</span>
                        <span className="canonical-field">creditorBank</span>
                      </div>
                    </div>

                    <div className="canonical-field-group">
                      <div className="canonical-field-title">Payment Details</div>
                      <div className="canonical-fields">
                        <span className="canonical-field">remittanceInfo</span>
                        <span className="canonical-field">chargeBearer</span>
                        <span className="canonical-field">bankOperationCode</span>
                        <span className="canonical-field">endToEndId</span>
                        <span className="canonical-field">instructionId</span>
                      </div>
                    </div>

                    <div className="canonical-field-group">
                      <div className="canonical-field-title">Crypto Settlement (Optional)</div>
                      <div className="canonical-fields">
                        <span className="canonical-field">cryptoEnabled</span>
                        <span className="canonical-field">cryptoBlockchain</span>
                        <span className="canonical-field">cryptoSenderWallet</span>
                        <span className="canonical-field">cryptoReceiverWallet</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Tab>

          <Tab name="Build Config">
              {/* Build Config Content */}
              <div className="schema-section">
                {/* Intro Banner - Green theme for Build */}
                <div className="schema-intro" style={{ background: 'linear-gradient(135deg, #E3FCF7 0%, #F9FBFA 100%)', borderColor: '#C0FAE6' }}>
                  <p className="schema-intro-text">
                    Auto-generate configs by <strong>pattern matching</strong> against all existing MongoDB configs.
                    Unknown fields get <strong>LLM-suggested mappings</strong> for review.
                  </p>
                </div>

                <div className="build-form-card">
                  {/* Format Selection Row */}
                  <div className="build-step">
                    <div className="build-step-header">
                      <span className="build-step-number">1</span>
                      <span className="build-step-title">Select Conversion Path</span>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      {/* Source Format Dropdown */}
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: 'var(--gray-dark2)' }}>
                          Source Format
                        </label>
                        <Select
                          aria-label="Select source format"
                          value={sourceFormat}
                          onChange={handleSourceFormatChange}
                          allowDeselect={false}
                          style={{ width: '100%' }}
                        >
                          {Object.entries(SAMPLE_MESSAGES).map(([key, val]) => (
                            <Option key={key} value={key}>
                              {key} - {val.label}
                            </Option>
                          ))}
                        </Select>
                      </div>

                      {/* Arrow */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 8px',
                        color: 'var(--gray-dark1)',
                        fontSize: '20px',
                        marginBottom: '8px'
                      }}>
                        →
                      </div>

                      {/* Target Format Dropdown */}
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: 'var(--gray-dark2)' }}>
                          Target Format
                        </label>
                        <Select
                          aria-label="Select target format"
                          value={targetFormat}
                          onChange={(value) => setTargetFormat(value)}
                          allowDeselect={false}
                          style={{ width: '100%' }}
                        >
                          <Option value="JSON">JSON - Canonical JSON (Universal Bridge)</Option>
                          <Option value="pacs.008">pacs.008 - Customer Credit Transfer</Option>
                          <Option value="pacs.009">pacs.009 - FI Credit Transfer</Option>
                          <Option value="cain.001">cain.001 - Card Transaction</Option>
                          {formatSpecs.filter(s => !['JSON', 'pacs.008', 'pacs.009', 'cain.001'].includes(s._id)).map((spec) => (
                            <Option key={spec._id} value={spec._id}>
                              {spec._id} - {spec.description || spec.format_type}
                            </Option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    {/* Conversion Preview Badge */}
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--gray-dark1)' }}>Creating config:</span>
                      <Badge variant="blue">{sourceFormat}</Badge>
                      <span style={{ color: 'var(--gray-dark1)' }}>→</span>
                      <Badge variant="green">{targetFormat}</Badge>
                    </div>
                  </div>

                  {/* Sample Message */}
                  <div className="build-step">
                    <div className="build-step-header">
                      <span className="build-step-number">2</span>
                      <span className="build-step-title">Sample Message</span>
                      {SAMPLE_MESSAGES[sourceFormat] && (
                        <Badge variant="lightgray" style={{ marginLeft: 'auto' }}>
                          {SAMPLE_MESSAGES[sourceFormat].format}
                        </Badge>
                      )}
                    </div>
                    <textarea
                      className="message-textarea"
                      value={sampleMessage}
                      onChange={(e) => setSampleMessage(e.target.value)}
                      placeholder="Paste a sample message..."
                      style={{ marginBottom: 0 }}
                    />
                  </div>

                  {/* Generate Button */}
                  <div className="action-buttons" style={{ marginTop: '8px' }}>
                    <Button
                      variant="primary"
                      onClick={handleGenerateConfig}
                      disabled={generating || !sampleMessage}
                    >
                      {generating ? 'Generating...' : 'Generate Config'}
                    </Button>
                  </div>
                </div>

          {generateError && (
            <Banner variant="danger" style={{ marginTop: '16px' }}>
              {generateError}
            </Banner>
          )}

          {/* Generated Config Result */}
          {generatedConfig && (
            <div className="result-section">
              <div className="section-title">
                <span>Generated Config</span>
                <Badge variant="green">{generatedConfig.configurationId}</Badge>
              </div>

              <div className="confidence-bar">
                <span style={{ fontSize: '13px', color: 'var(--gray-dark1)' }}>Match Rate:</span>
                <div className="confidence-track">
                  <div
                    className="confidence-fill"
                    style={{ width: `${generatedConfig.confidence * 100}%` }}
                  />
                </div>
                <span className="confidence-label">
                  {Math.round(generatedConfig.confidence * 100)}%
                </span>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--gray-dark1)' }}>
                  Source Fields: {generatedConfig.sourceFieldsIdentified} | Target Coverage: {(generatedConfig.targetFieldsMapped || 0) + (generatedConfig.targetFieldsAi || 0)}/{generatedConfig.targetFieldsRequired || 0}
                </span>
              </div>

              {generatedConfig.matchedFields?.length > 0 && (
                <div className="field-badges">
                  <span style={{ fontSize: '12px', color: 'var(--gray-dark1)' }}>Mapped fields:</span>
                  {generatedConfig.matchedFields.flatMap((f) => {
                    const mapping = generatedConfig.config?.map?.find(m => m.from === f);
                    const targets = mapping?.to || [];
                    if (targets.length <= 1) {
                      return [(
                        <Badge key={f} variant="green">
                          {f} → {targets[0] || f}
                        </Badge>
                      )];
                    }
                    return targets.map((t) => (
                      <Badge key={`${f}-${t}`} variant="green">
                        {f} → {t}
                      </Badge>
                    ));
                  })}
                </div>
              )}

              {generatedConfig.unknownFields?.length > 0 && (
                <div className="field-badges">
                  <span style={{ fontSize: '12px', color: 'var(--gray-dark1)' }}>Uncertain fields:</span>
                  {generatedConfig.unknownFields.map((f) => (
                    <Badge key={f} variant="yellow">{f}</Badge>
                  ))}
                </div>
              )}

              {/* LLM Suggestions for Uncertain Fields */}
              {generatedConfig.suggestions?.length > 0 && (
                <div className="suggestions-section">
                  <div className="suggestions-title">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zM8 4a.75.75 0 00-.75.75v3.5a.75.75 0 001.5 0v-3.5A.75.75 0 008 4zm0 7a1 1 0 100-2 1 1 0 000 2z"/>
                    </svg>
                    AI Suggestions for Uncertain Fields
                    <Badge variant="yellow">{generatedConfig.suggestions.length}</Badge>
                  </div>
                  {generatedConfig.suggestions.map((suggestion, idx) => (
                    <div key={idx} className="suggestion-card">
                      <div className="suggestion-header">
                        <span className="suggestion-field-id">{suggestion.field_id}</span>
                        <span className="suggestion-arrow">→</span>
                        <span className="suggestion-target">
                          {suggestion.suggested_mapping?.to?.join(', ') || 'unknown'}
                        </span>
                      </div>
                      {suggestion.field_value && (
                        <div className="suggestion-value">
                          {suggestion.field_value}
                        </div>
                      )}
                      <div className="suggestion-reasoning">
                        {suggestion.reasoning}
                      </div>
                      {suggestion.target_field_info?.path && (
                        <div className="suggestion-target-info">
                          Target path: <code>{suggestion.target_field_info.path}</code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {generatedConfig.notCoveredFields?.length > 0 && (
                <div className="field-badges">
                  <span style={{ fontSize: '12px', color: 'var(--gray-dark1)' }}>Unresolvable Target Fields:</span>
                  {generatedConfig.notCoveredFields.map((f) => (
                    <Badge key={f} variant="lightgray">{f}</Badge>
                  ))}
                </div>
              )}

              {/* LLM Prompt Construction Details */}
              {generatedConfig.llmPromptInfo && (
                <div className="expandable-section" style={{ marginTop: '16px' }}>
                  <div
                    className="expandable-header"
                    onClick={() => setShowPromptDetails(!showPromptDetails)}
                  >
                    <span className="expandable-title">
                      <Badge variant="blue">LLM</Badge>
                      Prompt Construction Details
                    </span>
                    <svg width="12" height="12" viewBox="0 0 12 12" style={{
                      transform: showPromptDetails ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s'
                    }}>
                      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                    </svg>
                  </div>
                  {showPromptDetails && (
                    <div className="expandable-content">
                      <LLMPromptDetails promptInfo={generatedConfig.llmPromptInfo} />
                    </div>
                  )}
                </div>
              )}

              {generatedConfig.learnedFrom?.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--gray-dark1)' }}>Learned from: </span>
                  {generatedConfig.learnedFrom.map((c) => (
                    <Badge key={c} variant="lightgray" style={{ marginRight: '4px' }}>{c}</Badge>
                  ))}
                </div>
              )}

              <div className="config-detail">
                <Code language="json">
                  {JSON.stringify(generatedConfig.config, null, 2)}
                </Code>
              </div>

              <div className="action-buttons">
                <Button
                  variant="primary"
                  onClick={handleApproveConfig}
                  disabled={approving}
                >
                  {approving ? 'Saving...' : 'Save to MongoDB'}
                </Button>
                <Button
                  variant="default"
                  onClick={() => setGeneratedConfig(null)}
                >
                  Discard
                </Button>
              </div>
            </div>
          )}
              </div>
            </Tab>
          </Tabs>
        ) : (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--gray-base)' }}>
            Loading...
          </div>
        )}
      </div>
    </div>
  );
}
