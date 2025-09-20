'use client';

import { useState, useRef } from 'react';
import styles from './ConfigurationExportImport.module.css';

export default function ConfigurationExportImport({
  configuration,
  onImport,
  onClose
}) {
  const [activeTab, setActiveTab] = useState('export'); // export, import
  const [importData, setImportData] = useState('');
  const [importError, setImportError] = useState(null);
  const [exportFormat, setExportFormat] = useState('json'); // json, yaml, csv
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef(null);

  const handleExport = () => {
    let data;
    let filename;
    let mimeType;

    switch (exportFormat) {
      case 'json':
        data = JSON.stringify(configuration, null, 2);
        filename = `${configuration?._id || 'config'}.json`;
        mimeType = 'application/json';
        break;

      case 'yaml':
        // Simplified YAML conversion
        data = convertToYAML(configuration);
        filename = `${configuration?._id || 'config'}.yaml`;
        mimeType = 'text/yaml';
        break;

      case 'csv':
        // Export mappings as CSV
        data = convertToCSV(configuration.mappings || []);
        filename = `${configuration?._id || 'config'}_mappings.csv`;
        mimeType = 'text/csv';
        break;

      default:
        data = JSON.stringify(configuration, null, 2);
    }

    // Create download
    const blob = new Blob([data], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      setImportError(null);
      setImportStatus('validating');

      // Parse the import data
      let parsedData;
      try {
        parsedData = JSON.parse(importData);
      } catch (e) {
        throw new Error('Invalid JSON format');
      }

      // Validate required fields
      if (!parsedData.parser || !parsedData.mappings || !parsedData.builder) {
        throw new Error('Missing required configuration fields');
      }

      // Validate mappings structure
      if (!Array.isArray(parsedData.mappings)) {
        throw new Error('Mappings must be an array');
      }

      setImportStatus('success');

      // Call the import handler
      if (onImport) {
        onImport(parsedData);
      }

      // Clear import data
      setTimeout(() => {
        setImportData('');
        setImportStatus(null);
        if (onClose) onClose();
      }, 2000);

    } catch (error) {
      setImportError(error.message);
      setImportStatus('error');
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImportData(e.target.result);
        setImportError(null);
      };
      reader.onerror = () => {
        setImportError('Failed to read file');
      };
      reader.readAsText(file);
    }
  };

  const convertToYAML = (obj) => {
    // Simplified YAML converter
    const yaml = [];
    yaml.push('# Auto-generated configuration');
    yaml.push(`id: ${obj._id || 'unknown'}`);
    yaml.push('');
    yaml.push('parser:');
    yaml.push(`  type: ${obj.parser?.type || 'regex'}`);
    yaml.push('  fields:');
    Object.entries(obj.parser?.fields || {}).forEach(([key, field]) => {
      yaml.push(`    ${key}:`);
      yaml.push(`      pattern: "${field.pattern}"`);
      yaml.push(`      name: "${field.name}"`);
    });
    yaml.push('');
    yaml.push('mappings:');
    (obj.mappings || []).forEach(mapping => {
      yaml.push(`  - source: ${mapping.source}`);
      yaml.push(`    targets: [${mapping.targets?.join(', ') || mapping.target}]`);
      if (mapping.transform) {
        yaml.push(`    transform: ${mapping.transform}`);
      }
    });
    return yaml.join('\n');
  };

  const convertToCSV = (mappings) => {
    const headers = ['Source Field', 'Target Field', 'Transform', 'Processing Lane', 'Confidence'];
    const rows = [headers.join(',')];

    mappings.forEach(mapping => {
      const row = [
        mapping.source || '',
        mapping.targets?.[0] || mapping.target || '',
        mapping.transform || 'direct',
        mapping.processing_lane || 'RULES',
        mapping.confidence || '1.0'
      ];
      rows.push(row.map(val => `"${val}"`).join(','));
    });

    return rows.join('\n');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Export / Import Configuration</h3>
        <button className={styles.closeButton} onClick={onClose}>✕</button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'export' ? styles.active : ''}`}
          onClick={() => setActiveTab('export')}
        >
          <span className={styles.tabIcon}>📤</span>
          Export
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'import' ? styles.active : ''}`}
          onClick={() => setActiveTab('import')}
        >
          <span className={styles.tabIcon}>📥</span>
          Import
        </button>
      </div>

      <div className={styles.content}>
        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className={styles.exportSection}>
            <div className={styles.configInfo}>
              <h4>Configuration Details</h4>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <label>Configuration ID:</label>
                  <span>{configuration?._id || 'N/A'}</span>
                </div>
                <div className={styles.infoItem}>
                  <label>Source Format:</label>
                  <span>{configuration?.metadata?.source_format || 'N/A'}</span>
                </div>
                <div className={styles.infoItem}>
                  <label>Target Format:</label>
                  <span>{configuration?.metadata?.target_format || 'N/A'}</span>
                </div>
                <div className={styles.infoItem}>
                  <label>Fields:</label>
                  <span>{Object.keys(configuration?.parser?.fields || {}).length}</span>
                </div>
                <div className={styles.infoItem}>
                  <label>Mappings:</label>
                  <span>{configuration?.mappings?.length || 0}</span>
                </div>
                <div className={styles.infoItem}>
                  <label>Auto-Generated:</label>
                  <span>{configuration?.metadata?.auto_generated ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

            <div className={styles.formatSelection}>
              <h4>Export Format</h4>
              <div className={styles.formatOptions}>
                <label className={`${styles.formatOption} ${exportFormat === 'json' ? styles.selected : ''}`}>
                  <input
                    type="radio"
                    value="json"
                    checked={exportFormat === 'json'}
                    onChange={(e) => setExportFormat(e.target.value)}
                  />
                  <div className={styles.formatContent}>
                    <span className={styles.formatIcon}>{ }</span>
                    <span className={styles.formatName}>JSON</span>
                    <span className={styles.formatDesc}>Complete configuration</span>
                  </div>
                </label>

                <label className={`${styles.formatOption} ${exportFormat === 'yaml' ? styles.selected : ''}`}>
                  <input
                    type="radio"
                    value="yaml"
                    checked={exportFormat === 'yaml'}
                    onChange={(e) => setExportFormat(e.target.value)}
                  />
                  <div className={styles.formatContent}>
                    <span className={styles.formatIcon}>📝</span>
                    <span className={styles.formatName}>YAML</span>
                    <span className={styles.formatDesc}>Human-readable format</span>
                  </div>
                </label>

                <label className={`${styles.formatOption} ${exportFormat === 'csv' ? styles.selected : ''}`}>
                  <input
                    type="radio"
                    value="csv"
                    checked={exportFormat === 'csv'}
                    onChange={(e) => setExportFormat(e.target.value)}
                  />
                  <div className={styles.formatContent}>
                    <span className={styles.formatIcon}>📊</span>
                    <span className={styles.formatName}>CSV</span>
                    <span className={styles.formatDesc}>Mappings only</span>
                  </div>
                </label>
              </div>
            </div>

            <button className={styles.exportButton} onClick={handleExport}>
              <span className={styles.buttonIcon}>💾</span>
              Export Configuration
            </button>
          </div>
        )}

        {/* Import Tab */}
        {activeTab === 'import' && (
          <div className={styles.importSection}>
            <div className={styles.importOptions}>
              <h4>Import Configuration</h4>
              <p>Paste configuration JSON or select a file to import</p>

              <div className={styles.fileUpload}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.yaml,.yml"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <button
                  className={styles.fileButton}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className={styles.buttonIcon}>📁</span>
                  Choose File
                </button>
              </div>

              <div className={styles.textareaWrapper}>
                <textarea
                  className={styles.importTextarea}
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder="Paste your configuration JSON here..."
                  rows={12}
                />
              </div>

              {importError && (
                <div className={styles.errorMessage}>
                  <span className={styles.errorIcon}>⚠️</span>
                  {importError}
                </div>
              )}

              {importStatus === 'success' && (
                <div className={styles.successMessage}>
                  <span className={styles.successIcon}>✅</span>
                  Configuration imported successfully!
                </div>
              )}

              <div className={styles.importActions}>
                <button
                  className={styles.validateButton}
                  onClick={() => {
                    try {
                      JSON.parse(importData);
                      setImportError(null);
                      setImportStatus('valid');
                    } catch {
                      setImportError('Invalid JSON format');
                      setImportStatus('error');
                    }
                  }}
                  disabled={!importData}
                >
                  Validate
                </button>
                <button
                  className={styles.importButton}
                  onClick={handleImport}
                  disabled={!importData || importStatus === 'validating'}
                >
                  <span className={styles.buttonIcon}>📥</span>
                  Import Configuration
                </button>
              </div>
            </div>

            <div className={styles.importHelp}>
              <h5>Import Requirements</h5>
              <ul>
                <li>Configuration must be in valid JSON format</li>
                <li>Must include parser, mappings, and builder sections</li>
                <li>Field mappings must match target format structure</li>
                <li>AI configurations will be validated upon import</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}