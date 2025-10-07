import React, { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import Icon from '@leafygreen-ui/icon';
import styles from './JsonEditorPanel.module.css';

const JsonEditorPanel = ({ value, onChange, markers, onEditorMount, theme = 'vs-light' }) => {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure JSON language features
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      schemas: [{
        uri: "http://myschema/conversion-registry.json",
        fileMatch: ["*"],
        schema: getConversionRegistrySchema()
      }]
    });

    // Set markers for validation errors
    if (markers && markers.length > 0) {
      monaco.editor.setModelMarkers(
        editor.getModel(),
        'validation',
        markers
      );
    }

    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      automaticLayout: true,
      formatOnPaste: true,
      formatOnType: true
    });

    // Call parent mount handler
    if (onEditorMount) {
      onEditorMount(editor, monaco);
    }
  };

  // Update markers when validation changes
  useEffect(() => {
    if (monacoRef.current && editorRef.current && markers) {
      monacoRef.current.editor.setModelMarkers(
        editorRef.current.getModel(),
        'validation',
        markers
      );
    }
  }, [markers]);

  const handleFormat = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument').run();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4>Configuration JSON</h4>
        <div className={styles.actions}>
          <button className={styles.formatButton} onClick={handleFormat}>
            <Icon glyph="Edit" size="small" /> Format
          </button>
        </div>
      </div>
      <div className={styles.editorWrapper}>
        <Editor
          height="100%"
          defaultLanguage="json"
          value={value}
          onChange={onChange}
          onMount={handleEditorDidMount}
          theme={theme}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            fontSize: 13,
            lineNumbers: 'on',
            glyphMargin: true,
            folding: true,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 3,
            renderLineHighlight: 'all',
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
              useShadows: false,
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10
            }
          }}
        />
      </div>
    </div>
  );
};

// MongoDB conversion_registry schema for validation
const getConversionRegistrySchema = () => ({
  type: "object",
  required: ["_id", "parser", "mappings", "builder"],
  properties: {
    _id: { type: "string" },
    parser: {
      type: "object",
      properties: {
        type: { enum: ["regex", "xml", "json", "iso8583"] },
        config: { type: "object" }
      },
      required: ["type", "config"]
    },
    mappings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: { type: "string" },
          targets: { type: "array", items: { type: "string" } },
          transform: { type: "string" },
          transform_config: { type: "object" },
          processing_lane: { enum: ["RULES", "AI", "HUMAN"] },
          field_type: { type: "string" },
          confidence_threshold: { type: "number" }
        },
        required: ["source", "targets"]
      }
    },
    ai_service: {
      type: "object",
      properties: {
        field_types: { type: "object" }
      }
    },
    builder: {
      type: "object",
      properties: {
        type: { enum: ["xml", "json", "swift", "iso8583"] }
      },
      required: ["type"]
    },
    human_review: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        confidence_threshold: { type: "number" },
        review_fields: { type: "array", items: { type: "string" } }
      }
    }
  }
});

export default JsonEditorPanel;
