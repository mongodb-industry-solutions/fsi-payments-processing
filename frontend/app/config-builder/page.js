'use client';

import { useState, useEffect } from 'react';
import Card from '@leafygreen-ui/card';
import Button from '@leafygreen-ui/button';
import Banner from '@leafygreen-ui/banner';
import Badge from '@leafygreen-ui/badge';
import Code from '@leafygreen-ui/code';
import TextInput from '@leafygreen-ui/text-input';

// Sample messages for demo
const SAMPLE_MESSAGES = {
  MT202: {
    label: 'MT202 (Bank Transfer)',
    format: 'SWIFT',
    message: `{1:F01CHASUS33AXXX0000000000}{2:I202DEUTDEFFXXXXN}{4:
:20:MT202TEST
:21:REF2024MT202001
:32A:241215EUR500000,00
:52A:CHASUS33XXX
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
:32A:250115USD750000,00
:52A:BNPAFRPP
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
  }
};

// API base URL
const API_BASE = process.env.NEXT_PUBLIC_CONVERTER_URL || 'http://localhost:8001';

export default function ConfigBuilderPage() {
  // State
  const [configs, setConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
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

  // Load existing configs on mount
  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/v1/configs`);
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

  const handleSampleChange = (key) => {
    const sample = SAMPLE_MESSAGES[key];
    if (sample) {
      setSourceFormat(key);
      setSampleMessage(sample.message);
    }
  };

  const handleGenerateConfig = async () => {
    try {
      setGenerating(true);
      setGenerateError(null);
      setSuccessMessage(null);
      setGeneratedConfig(null);

      const response = await fetch(`${API_BASE}/api/v1/auto-configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_format: sourceFormat,
          target_format: targetFormat,
          sample_message: sampleMessage
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
        `${API_BASE}/api/v1/auto-configure/${generatedConfig.configuration_id}/approve`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to approve config');
      }

      setSuccessMessage(`Config "${generatedConfig.configuration_id}" saved to MongoDB!`);
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
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .page-header {
          margin-bottom: 24px;
        }
        .page-header h1 {
          font-size: 28px;
          font-weight: 600;
          color: var(--black);
          margin-bottom: 8px;
        }
        .page-header p {
          color: var(--gray-dark1);
          font-size: 14px;
        }
        .layout-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .section-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .config-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 300px;
          overflow-y: auto;
        }
        .config-item {
          padding: 12px;
          border: 1px solid var(--gray-light2);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: white;
        }
        .config-item:hover {
          border-color: var(--green-dark1);
          background: var(--green-light3);
        }
        .config-item.selected {
          border-color: var(--green-dark1);
          background: var(--green-light3);
        }
        .config-item-title {
          font-weight: 500;
          font-size: 14px;
        }
        .config-item-meta {
          font-size: 12px;
          color: var(--gray-dark1);
          margin-top: 4px;
        }
        .config-detail {
          background: var(--gray-dark4);
          border-radius: 8px;
          padding: 16px;
          max-height: 400px;
          overflow: auto;
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
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .sample-btn:hover {
          border-color: var(--blue-base);
          background: var(--blue-light3);
        }
        .sample-btn.active {
          border-color: var(--green-dark1);
          background: var(--green-light3);
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
        .schema-info {
          background: var(--blue-light3);
          border: 1px solid var(--blue-light2);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 24px;
        }
        .schema-info h4 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 8px;
          color: var(--blue-dark2);
        }
        .schema-info code {
          background: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
        }
        .schema-info ul {
          margin-left: 20px;
          font-size: 13px;
          color: var(--gray-dark2);
        }
        .schema-info li {
          margin-bottom: 4px;
        }
      `}</style>

      <div className="page-header">
        <h1>Config Builder</h1>
        <p>View existing conversion configs and auto-generate new ones using semantic learning</p>
      </div>

      {/* Schema Info Banner */}
      <div className="schema-info">
        <h4>Simplified Config Schema</h4>
        <p style={{ marginBottom: '8px', fontSize: '13px' }}>
          Each config has 4 fields: <code>_id</code>, <code>extract</code>, <code>map</code>, <code>output</code>
        </p>
        <ul>
          <li><strong>_id</strong>: Config identifier (e.g., "MT103_to_JSON")</li>
          <li><strong>extract</strong>: Regex patterns to extract fields from source message</li>
          <li><strong>map</strong>: Field mappings with optional transformations (split, dateFormat, ai)</li>
          <li><strong>output</strong>: Output field paths for the target format</li>
        </ul>
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

      <div className="layout-grid">
        {/* Left Panel - Existing Configs */}
        <Card>
          <div className="section-title">
            <span>Existing Configs</span>
            <Badge variant="green">{configs.length}</Badge>
            <Button size="xsmall" onClick={loadConfigs} disabled={loading}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <p style={{ color: 'var(--gray-dark1)', fontSize: '14px' }}>Loading configs...</p>
          ) : (
            <div className="config-list">
              {configs.map((config) => (
                <div
                  key={config._id}
                  className={`config-item ${selectedConfig?._id === config._id ? 'selected' : ''}`}
                  onClick={() => setSelectedConfig(config)}
                >
                  <div className="config-item-title">{config._id}</div>
                  <div className="config-item-meta">
                    {Object.keys(config.extract || {}).length} extract patterns, {' '}
                    {(config.map || []).length} mappings
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedConfig && (
            <div style={{ marginTop: '16px' }}>
              <div className="section-title">Config Detail</div>
              <div className="config-detail">
                <Code language="json">
                  {JSON.stringify(selectedConfig, null, 2)}
                </Code>
              </div>
            </div>
          )}
        </Card>

        {/* Right Panel - Generate New Config */}
        <Card>
          <div className="section-title">
            <span>Generate New Config</span>
            <Badge variant="blue">Semantic Learning</Badge>
          </div>

          <div className="form-group">
            <label>Sample Message Template</label>
            <div className="sample-buttons">
              {Object.entries(SAMPLE_MESSAGES).map(([key, val]) => (
                <button
                  key={key}
                  className={`sample-btn ${sourceFormat === key ? 'active' : ''}`}
                  onClick={() => handleSampleChange(key)}
                >
                  {val.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <TextInput
                label="Source Format"
                value={sourceFormat}
                onChange={(e) => setSourceFormat(e.target.value)}
                placeholder="e.g., MT202"
              />
            </div>
            <div className="form-group">
              <TextInput
                label="Target Format"
                value={targetFormat}
                onChange={(e) => setTargetFormat(e.target.value)}
                placeholder="e.g., JSON"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Sample Message</label>
            <textarea
              className="message-textarea"
              value={sampleMessage}
              onChange={(e) => setSampleMessage(e.target.value)}
              placeholder="Paste a sample message..."
            />
          </div>

          <div className="action-buttons">
            <Button
              variant="primary"
              onClick={handleGenerateConfig}
              disabled={generating || !sampleMessage}
            >
              {generating ? 'Generating...' : 'Generate Config'}
            </Button>
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
                <Badge variant="green">{generatedConfig.configuration_id}</Badge>
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
                  Fields detected: {generatedConfig.fields_detected} |
                  Matched: {generatedConfig.matched_fields?.length || 0} |
                  Unknown: {generatedConfig.unknown_fields?.length || 0}
                </span>
              </div>

              {generatedConfig.unknown_fields?.length > 0 && (
                <div className="field-badges">
                  <span style={{ fontSize: '12px', color: 'var(--gray-dark1)' }}>Unknown fields:</span>
                  {generatedConfig.unknown_fields.map((f) => (
                    <Badge key={f} variant="yellow">{f}</Badge>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--gray-dark1)' }}>Learned from: </span>
                {generatedConfig.learned_from?.map((c) => (
                  <Badge key={c} variant="lightgray" style={{ marginRight: '4px' }}>{c}</Badge>
                ))}
              </div>

              <div className="config-detail" style={{ maxHeight: '250px' }}>
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
        </Card>
      </div>
    </div>
  );
}
