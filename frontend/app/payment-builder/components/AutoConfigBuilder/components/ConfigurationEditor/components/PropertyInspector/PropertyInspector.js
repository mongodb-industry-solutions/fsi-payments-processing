import React, { useState, useEffect } from 'react';
import Icon from '@leafygreen-ui/icon';
import styles from './PropertyInspector.module.css';

const PropertyInspector = ({ path, configuration, validationResult, onFieldUpdate }) => {
  const [fieldValue, setFieldValue] = useState('');
  const [fieldInfo, setFieldInfo] = useState(null);

  useEffect(() => {
    if (path) {
      // Get value at path
      const value = getValueAtPath(configuration, path);
      setFieldValue(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || ''));

      // Get field information
      setFieldInfo(getFieldInfo(path));
    }
  }, [path, configuration]);

  const getValueAtPath = (obj, path) => {
    if (!path) return obj;

    return path.split('.').reduce((acc, part) => {
      const arrayMatch = part.match(/(\w+)\[(\d+)\]/);
      if (arrayMatch) {
        return acc?.[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
      }
      return acc?.[part];
    }, obj);
  };

  const getFieldInfo = (path) => {
    // Return metadata about the field based on path
    const fieldMap = {
      'parser.type': {
        type: 'text',
        description: 'Parser type for extracting fields from source message (regex, xml, json, iso8583)'
      },
      'processing_lane': {
        type: 'text',
        description: 'Processing lane for this mapping (RULES, AI, HUMAN)'
      },
      'transform': {
        type: 'text',
        description: 'Transformation to apply to the field'
      },
      'field_type': {
        type: 'text',
        description: 'AI field type for extraction (remittance, party_info, instructions, reference)'
      }
    };

    // Find matching field info
    for (const [pattern, info] of Object.entries(fieldMap)) {
      if (path.includes(pattern)) {
        return info;
      }
    }

    // Default info
    return {
      type: 'text',
      description: `Field at path: ${path}`
    };
  };

  const handleSave = () => {
    console.log('PropertyInspector.handleSave called', { path, fieldValue, onFieldUpdate });

    if (!path) {
      console.error('Cannot save: path is empty');
      return;
    }

    if (!onFieldUpdate) {
      console.error('Cannot save: onFieldUpdate callback is not provided');
      return;
    }

    try {
      let parsedValue;
      try {
        parsedValue = JSON.parse(fieldValue);
      } catch {
        parsedValue = fieldValue;
      }

      console.log('Calling onFieldUpdate with:', { path, parsedValue });
      onFieldUpdate(path, parsedValue);
    } catch (e) {
      console.error('Error in handleSave:', e);
    }
  };

  if (!path) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h4>Property Inspector</h4>
        </div>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <Icon glyph="InfoWithCircle" size={32} />
          </span>
          <p>Select a field from the tree to inspect and edit its properties</p>
        </div>
      </div>
    );
  }

  const validation = validationResult?.details?.find(d =>
    d.errors?.some(e => e.field === path)
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4>Property Inspector</h4>
      </div>

      <div className={styles.content}>
        <div className={styles.pathInfo}>
          <label className={styles.pathLabel}>Path</label>
          <code className={styles.pathCode}>{path}</code>
        </div>

        {validation && !validation.is_valid && (
          <div className={styles.validation}>
            <Icon glyph="Warning" size="small" />
            <div className={styles.errors}>
              {validation.errors.map((error, i) => (
                <div key={i} className={styles.error}>
                  {error.message}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.fieldEditor}>
          <label className={styles.fieldLabel}>Value</label>
          <textarea
            value={fieldValue}
            onChange={(e) => setFieldValue(e.target.value)}
            className={styles.textarea}
            rows={10}
          />
          {fieldInfo?.description && (
            <p className={styles.description}>{fieldInfo.description}</p>
          )}
        </div>

        <div className={styles.actions}>
          <button
            className={styles.applyButton}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Button clicked!');
              handleSave();
            }}
            disabled={!fieldValue}
            type="button"
          >
            Apply Changes
          </button>
        </div>

        {fieldInfo?.description && (
          <div className={styles.help}>
            <Icon glyph="InfoWithCircle" size="small" />
            <span>{fieldInfo.description}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyInspector;
