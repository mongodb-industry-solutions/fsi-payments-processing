'use client';

import { useState, useEffect } from 'react';
import Card from '@leafygreen-ui/card';
import Button from '@leafygreen-ui/button';
import Banner from '@leafygreen-ui/banner';
import Badge from '@leafygreen-ui/badge';
import Code from '@leafygreen-ui/code';
import TextInput from '@leafygreen-ui/text-input';
import { Select, Option } from '@leafygreen-ui/select';

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
:13C:/CLSTIME/1800+0100
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
  const [selectedConfigId, setSelectedConfigId] = useState('');
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
  const [showSchemaInfo, setShowSchemaInfo] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Get selected config object
  const selectedConfig = configs.find(c => c._id === selectedConfigId) || null;

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
          max-width: 1600px;
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
        .main-layout {
          display: flex;
          gap: 0;
        }
        .main-content {
          flex: 1;
          min-width: 0;
        }
        .section-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
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
          color: var(--blue-dark2);
          background: var(--blue-light3);
          border: 1px solid var(--blue-light2);
          border-radius: 6px;
          cursor: pointer;
          margin-bottom: 16px;
          transition: all 0.2s ease;
        }
        .schema-toggle:hover {
          background: var(--blue-light2);
        }
        .schema-toggle svg {
          transition: transform 0.2s ease;
        }
        .schema-toggle.open svg {
          transform: rotate(180deg);
        }
        .schema-info {
          background: var(--blue-light3);
          border: 1px solid var(--blue-light2);
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
        /* Sidebar drawer styles */
        .sidebar-drawer {
          position: fixed;
          top: 64px;
          right: 0;
          height: calc(100vh - 64px);
          display: flex;
          z-index: 100;
          pointer-events: none;
        }
        .sidebar-tab {
          pointer-events: auto;
          position: absolute;
          right: 0;
          top: 24px;
          writing-mode: vertical-rl;
          text-orientation: mixed;
          padding: 16px 8px;
          background: var(--gray-dark3);
          color: white;
          border: none;
          border-radius: 8px 0 0 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          font-family: inherit;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background 0.2s ease;
        }
        .sidebar-tab:hover {
          background: var(--gray-dark2);
        }
        .sidebar-tab svg {
          transform: rotate(90deg);
          transition: transform 0.2s ease;
        }
        .sidebar-drawer.open .sidebar-tab svg {
          transform: rotate(-90deg);
        }
        .sidebar-panel {
          pointer-events: auto;
          position: absolute;
          right: 0;
          top: 0;
          width: 360px;
          height: 100%;
          background: white;
          border-left: 1px solid var(--gray-light2);
          box-shadow: -4px 0 20px rgba(0,0,0,0.1);
          transform: translateX(100%);
          transition: transform 0.3s ease;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .sidebar-drawer.open .sidebar-panel {
          transform: translateX(0);
        }
        .sidebar-drawer.open .sidebar-tab {
          right: 360px;
        }
        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid var(--gray-light2);
          flex-shrink: 0;
        }
        .sidebar-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--black);
        }
        .sidebar-body {
          padding: 16px;
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .config-viewer {
          background: var(--gray-dark4);
          border-radius: 8px;
          padding: 12px;
          margin-top: 12px;
          flex: 1;
          overflow: auto;
          font-size: 11px;
        }
        .config-viewer-empty {
          background: var(--gray-light3);
          border-radius: 8px;
          color: var(--gray-base);
          font-size: 13px;
          text-align: center;
          padding: 24px 12px;
          margin-top: 12px;
        }
      `}</style>

      <div className="page-header">
        <h1>Config Builder</h1>
        <p>Auto-generate conversion configs using semantic learning</p>
      </div>

      {/* Schema Info Toggle */}
      <button
        className={`schema-toggle ${showSchemaInfo ? 'open' : ''}`}
        onClick={() => setShowSchemaInfo(!showSchemaInfo)}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        </svg>
        Config Schema Reference
      </button>

      {showSchemaInfo && (
        <div className="schema-info">
          <div className="schema-fields">
            <div className="schema-field"><code>_id</code><span>identifier</span></div>
            <div className="schema-field"><code>extract</code><span>regex patterns</span></div>
            <div className="schema-field"><code>map</code><span>field mappings + transforms</span></div>
            <div className="schema-field"><code>output</code><span>target paths</span></div>
          </div>
        </div>
      )}

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

      <div className="main-layout">
        {/* Main: Generator */}
        <div className="main-content">
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

              {/* LLM Suggestions for Unknown Fields */}
              {generatedConfig.suggestions?.length > 0 && (
                <div className="suggestions-section">
                  <div className="suggestions-title">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zM8 4a.75.75 0 00-.75.75v3.5a.75.75 0 001.5 0v-3.5A.75.75 0 008 4zm0 7a1 1 0 100-2 1 1 0 000 2z"/>
                    </svg>
                    AI Suggestions for Unknown Fields
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

              {generatedConfig.learned_from?.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--gray-dark1)' }}>Learned from: </span>
                  {generatedConfig.learned_from.map((c) => (
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
        </Card>
        </div>
      </div>

      {/* Sidebar Drawer - Config Viewer */}
      <div className={`sidebar-drawer ${sidebarOpen ? 'open' : ''}`}>
        <button
          className="sidebar-tab"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          </svg>
          Configs ({configs.length})
        </button>

        <div className="sidebar-panel">
          <div className="sidebar-header">
            <span className="sidebar-title">Existing Configs</span>
            <Button size="xsmall" onClick={loadConfigs} disabled={loading}>
              {loading ? '...' : 'Refresh'}
            </Button>
          </div>

          <div className="sidebar-body">
            <Select
              label="Select Config"
              placeholder="Choose a config"
              value={selectedConfigId}
              onChange={(value) => setSelectedConfigId(value)}
              disabled={loading || configs.length === 0}
              size="small"
            >
              {configs.map((config) => (
                <Option key={config._id} value={config._id}>
                  {config._id}
                </Option>
              ))}
            </Select>

            {selectedConfig ? (
              <div className="config-viewer">
                <Code language="json">
                  {JSON.stringify(selectedConfig, null, 2)}
                </Code>
              </div>
            ) : (
              <div className="config-viewer-empty">
                {loading ? 'Loading...' : 'Select a config to view'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
