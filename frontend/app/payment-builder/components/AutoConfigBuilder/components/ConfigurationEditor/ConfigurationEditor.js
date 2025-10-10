import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import Icon from '@leafygreen-ui/icon';
import TreeNavigator from './components/TreeNavigator/TreeNavigator';
import JsonEditorPanel from './components/JsonEditorPanel/JsonEditorPanel';
import RegistryConsole from '../RegistryConsole/RegistryConsole';
import ProblemsPanel from './components/ProblemsPanel/ProblemsPanel';
import styles from './ConfigurationEditor.module.css';

const ConfigurationEditor = ({
  configuration,
  validationResult,
  onSave,
  onValidate,
  onFieldUpdate,
  isValidating,
  isSaving
}) => {
  const [selectedPath, setSelectedPath] = useState(null);
  const [editorValue, setEditorValue] = useState(JSON.stringify(configuration, null, 2));
  const [markers, setMarkers] = useState([]);
  const [showProblems, setShowProblems] = useState(true);
  const [localValidationResult, setLocalValidationResult] = useState(null);
  const [validationSource, setValidationSource] = useState('none'); // 'client', 'server', or 'none'
  const sessionIdRef = useRef(null); // Use ref instead of state to avoid closure issues
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const validationTriggeredRef = useRef(false);
  const validationTimeoutRef = useRef(null);
  const problemsPanelRef = useRef(null);

  // Log validation result prop changes
  useEffect(() => {
    console.log('ConfigurationEditor - validationResult prop changed:', validationResult);
  }, [validationResult]);

  // Auto-trigger validation on mount if not already validated
  useEffect(() => {
    if (!validationResult && !validationTriggeredRef.current && onValidate && configuration) {
      console.log('ConfigurationEditor - Auto-triggering validation on mount');
      validationTriggeredRef.current = true;
      onValidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Transform backend validation format to frontend format
  const transformValidationResult = useCallback((backendResult) => {
    if (!backendResult) return null;

    console.log('ConfigurationEditor - Raw validation result from backend:', JSON.stringify(backendResult, null, 2));

    // Backend format: {valid, score, checks: [{name, status, errors}]}
    // Frontend format: {details: [{is_valid, check, errors}]}

    // If already has details array, ensure is_valid property exists at root
    if (backendResult.details) {
      console.log('Already has details array, normalizing format');
      return {
        ...backendResult,
        is_valid: backendResult.is_valid !== undefined ? backendResult.is_valid : backendResult.valid,
        error_count: backendResult.error_count || backendResult.summary?.failed || 0,
        warning_count: backendResult.warning_count || backendResult.summary?.warnings || 0
      };
    }

    // Transform backend format to frontend format
    if (backendResult.checks) {
      const details = backendResult.checks.map(check => ({
        is_valid: check.status === 'passed',
        check: check.name,
        errors: check.errors || []
      }));

      const transformed = {
        is_valid: backendResult.valid,
        error_count: backendResult.errors?.length || 0,
        warning_count: backendResult.warnings?.length || 0,
        details: details
      };

      console.log('ConfigurationEditor - Transformed validation result:', JSON.stringify(transformed, null, 2));
      console.log(`Found ${details.filter(d => !d.is_valid).length} checks with errors`);

      return transformed;
    }

    console.log('No checks array found, returning as-is');
    return backendResult;
  }, []);

  const transformedValidationResult = useMemo(() => {
    // Use local validation result if available (from editor changes), otherwise use prop
    const resultToUse = localValidationResult || validationResult;
    console.log('ConfigurationEditor - Computing transformedValidationResult:', {
      hasLocalValidation: !!localValidationResult,
      hasValidationProp: !!validationResult,
      resultToUse: resultToUse
    });
    const transformed = transformValidationResult(resultToUse);
    console.log('ConfigurationEditor - Transformed result:', transformed);
    console.log('ConfigurationEditor - Save button should be enabled:', transformed?.is_valid);
    return transformed;
  }, [localValidationResult, validationResult, transformValidationResult]);

  // Sync editor value when configuration changes
  useEffect(() => {
    setEditorValue(JSON.stringify(configuration, null, 2));
  }, [configuration]);

  // Convert validation errors to Monaco markers
  useEffect(() => {
    if (transformedValidationResult?.details && monacoRef.current) {
      const newMarkers = transformedValidationResult.details
        .filter(check => !check.is_valid)
        .flatMap(check =>
          check.errors.map(error => ({
            startLineNumber: error.line || 1,
            startColumn: 1,
            endLineNumber: error.line || 1,
            endColumn: 1000,
            message: error.message,
            severity: monacoRef.current.MarkerSeverity.Error
          }))
        );
      setMarkers(newMarkers);
    }
  }, [transformedValidationResult]);

  const handleEditorChange = useCallback((value) => {
    setEditorValue(value);
    console.log('📝 Editor changed, setting 1-second debounce timer...');

    // Debounce validation - wait 1 second after user stops typing
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
      console.log('⏱️  Cleared previous validation timer');
    }

    validationTimeoutRef.current = setTimeout(async () => {
      console.log('⏰ Debounce elapsed - starting validation...');

      // Validate the edited JSON
      try {
        const parsed = JSON.parse(value);
        console.log('✅ JSON parse successful');
        console.log('📦 Parsed config has these top-level keys:', Object.keys(parsed));
        console.log('🔍 Editor changed - validating edited config');

        // First, do instant client-side validation
        try {
          const { validateConfiguration } = await import('../../../../utils/schemaValidator');
          console.log('🔧 Running client-side validation...');
          const clientResult = validateConfiguration(parsed);
          console.log('⚡ Client-side validation result:', {
            valid: clientResult.valid,
            score: clientResult.score,
            error_count: clientResult.details?.filter(d => !d.is_valid).length
          });
          setLocalValidationResult(clientResult);
          setValidationSource('client');
        } catch (clientError) {
          console.error('❌ Client-side validation error:', clientError);
          // Fall back to server validation if client validation fails
        }

        // Then call server validation for authoritative result
        // (This runs in background to verify client-side result)
        const { default: paymentBuilderService } = await import('../../../../services/paymentBuilderService');
        console.log('🌐 Running server-side validation...');
        paymentBuilderService.validateConfigSchema(parsed).then(serverResult => {
          console.log('🌐 Server validation result:', {
            valid: serverResult.valid,
            score: serverResult.score,
            error_count: serverResult.details?.filter(d => !d.is_valid).length
          });
          console.log('📊 Full server result:', serverResult);
          // Update with server result if different from client
          setLocalValidationResult(serverResult);
          setValidationSource('server');
        }).catch(err => {
          console.error('❌ Server validation failed:', err);
          // Keep client validation if server fails
        });

      } catch (e) {
        console.log('❌ Invalid JSON:', e.message);
        // Invalid JSON - user is still typing
        setLocalValidationResult({
          valid: false,
          score: 0,
          details: [{
            check: 'JSON Syntax',
            status: 'failed',
            details: 'Invalid JSON syntax',
            errors: [{
              field: 'root',
              message: e.message,
              severity: 'error'
            }],
            is_valid: false
          }]
        });
      }
    }, 1000); // 1 second debounce
  }, []);

  const handleTreeSelect = useCallback((path) => {
    setSelectedPath(path);
    // Jump to line in editor
    if (editorRef.current && path) {
      const line = findLineForPath(path, editorValue);
      if (line > 0) {
        editorRef.current.revealLineInCenter(line);
        editorRef.current.setPosition({ lineNumber: line, column: 1 });
      }
    }
  }, [editorValue]);

  const findLineForPath = (path, jsonString) => {
    if (!path) return 1;

    const lines = jsonString.split('\n');
    const pathParts = path.split('.');
    const searchKey = pathParts[pathParts.length - 1].replace(/\[.*\]/, '');

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`"${searchKey}"`)) {
        return i + 1;
      }
    }
    return 1;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Configuration Editor: {configuration._id}</h3>
        <div className={styles.actions}>
          <span className={`${styles.badge} ${transformedValidationResult?.is_valid ? styles.badgeSuccess : styles.badgeError}`}>
            {transformedValidationResult?.is_valid ? (
              <>
                <Icon glyph="Checkmark" size="small" /> Valid
              </>
            ) : (
              `${transformedValidationResult?.error_count || 0} Errors`
            )}
          </span>
          <button
            className={styles.validateButton}
            onClick={async () => {
              console.log('Validate button clicked');
              try {
                // Parse the edited JSON
                const parsed = JSON.parse(editorValue);
                console.log('Validating edited configuration against schema');

                // Call validation API directly with the edited configuration
                const { default: paymentBuilderService } = await import('../../../../services/paymentBuilderService');
                const validationResult = await paymentBuilderService.validateConfigSchema(parsed);

                console.log('Validation result:', validationResult);

                // Update local validation state
                setLocalValidationResult(validationResult);
                setValidationSource('server');

                // If valid, update the configuration in parent state
                if (validationResult.valid && onFieldUpdate) {
                  console.log('Configuration is valid, updating parent state');
                  Object.keys(parsed).forEach(key => {
                    if (JSON.stringify(configuration[key]) !== JSON.stringify(parsed[key])) {
                      onFieldUpdate(key, parsed[key]);
                    }
                  });
                }
              } catch (e) {
                console.error('Validation failed:', e);
                if (e.message.includes('JSON')) {
                  alert('Invalid JSON: ' + e.message);
                } else {
                  alert('Validation failed: ' + e.message);
                }
              }
            }}
            disabled={isValidating}
          >
            <Icon glyph="InviteUser" size="small" /> {isValidating ? 'Validating...' : 'Validate'}
          </button>
          <button
            className={styles.saveButton}
            onClick={() => {
              console.log('Save button clicked, sessionId:', sessionIdRef.current);
              onSave(false, sessionIdRef.current);
            }}
            disabled={!transformedValidationResult?.is_valid || isSaving}
          >
            <Icon glyph="Save" size="small" /> {isSaving ? 'Saving...' : 'Save to Production'}
          </button>
        </div>
      </div>

      <PanelGroup direction="vertical" className={styles.mainContent}>
        <Panel defaultSize={70} minSize={30}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={20} minSize={15} maxSize={35}>
              <TreeNavigator
                configuration={configuration}
                validationResult={transformedValidationResult}
                onSelect={handleTreeSelect}
                selectedPath={selectedPath}
              />
            </Panel>

            <PanelResizeHandle className={styles.resizeHandle} />

            <Panel defaultSize={50} minSize={30}>
              <JsonEditorPanel
                value={editorValue}
                onChange={handleEditorChange}
                markers={markers}
                onEditorMount={(editor, monaco) => {
                  editorRef.current = editor;
                  monacoRef.current = monaco;
                }}
                theme="vs-light"
              />
            </Panel>

            <PanelResizeHandle className={styles.resizeHandle} />

            <Panel defaultSize={30} minSize={20} maxSize={40}>
              <PanelGroup direction="vertical">
                <Panel
                  ref={problemsPanelRef}
                  defaultSize={40}
                  minSize={5}
                  maxSize={60}
                  collapsible={true}
                  collapsedSize={5}
                >
                  <ProblemsPanel
                    validationResult={transformedValidationResult}
                    validationSource={validationSource}
                    onProblemClick={(problem) => {
                      // Jump to problem in editor
                      if (editorRef.current && problem.line) {
                        editorRef.current.revealLineInCenter(problem.line);
                        editorRef.current.setPosition({ lineNumber: problem.line, column: 1 });
                      }
                    }}
                    isVisible={showProblems}
                    onToggle={() => {
                      setShowProblems(!showProblems);
                      // Trigger panel collapse/expand via imperative API
                      if (problemsPanelRef.current) {
                        if (showProblems) {
                          problemsPanelRef.current.collapse();
                        } else {
                          problemsPanelRef.current.expand();
                        }
                      }
                    }}
                  />
                </Panel>

                <PanelResizeHandle className={styles.resizeHandleHorizontal} />

                <Panel defaultSize={60} minSize={40}>
                  <RegistryConsole
                    lastSavedConfig={configuration?._id}
                    onRefresh={() => {
                      console.log('Registry refreshed');
                    }}
                    onSessionIdGenerated={(id) => {
                      console.log('Session ID generated callback called with:', id);
                      console.log('Setting sessionIdRef.current to:', id);
                      sessionIdRef.current = id;
                      console.log('sessionIdRef.current is now:', sessionIdRef.current);
                    }}
                  />
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default ConfigurationEditor;
