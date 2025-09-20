'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './ConversionMapping.module.css';

export default function ConversionMapping({
  sourceMessage,
  targetMessage,
  sourceFormat,
  targetFormat,
  mappingData
}) {
  const [selectedField, setSelectedField] = useState(null);
  const [hoveredField, setHoveredField] = useState(null);
  const [mappingLines, setMappingLines] = useState([]);
  const sourceRef = useRef(null);
  const targetRef = useRef(null);
  const svgRef = useRef(null);

  // Extract fields from MT103 message
  const extractMT103Fields = (message) => {
    const fields = [];
    const lines = message.split('\n');

    lines.forEach(line => {
      const fieldMatch = line.match(/^:(\d{2}[A-Z]?):(.*)/);
      if (fieldMatch) {
        const fieldCode = fieldMatch[1];
        const fieldValue = fieldMatch[2];
        fields.push({
          code: fieldCode,
          value: fieldValue,
          description: getMT103FieldDescription(fieldCode)
        });
      }
    });

    return fields;
  };

  // Extract fields from pacs.008 XML
  const extractPacs008Fields = (xml) => {
    const fields = [];

    // Simple XML field extraction (for demo purposes)
    const patterns = [
      { regex: /<MsgId>(.*?)<\/MsgId>/g, field: 'MsgId', description: 'Message Identification' },
      { regex: /<EndToEndId>(.*?)<\/EndToEndId>/g, field: 'EndToEndId', description: 'End to End Reference' },
      { regex: /<IntrBkSttlmAmt Ccy="(.*?)">(.*?)<\/IntrBkSttlmAmt>/g, field: 'IntrBkSttlmAmt', description: 'Settlement Amount' },
      { regex: /<Nm>(.*?)<\/Nm>/g, field: 'Nm', description: 'Name' },
      { regex: /<IBAN>(.*?)<\/IBAN>/g, field: 'IBAN', description: 'Account Number' },
      { regex: /<Ustrd>(.*?)<\/Ustrd>/g, field: 'Ustrd', description: 'Remittance Information' },
    ];

    patterns.forEach(({ regex, field, description }) => {
      let match;
      while ((match = regex.exec(xml)) !== null) {
        if (field === 'IntrBkSttlmAmt') {
          fields.push({
            code: field,
            value: `${match[1]} ${match[2]}`,
            description
          });
        } else {
          fields.push({
            code: field,
            value: match[1],
            description
          });
        }
      }
    });

    return fields;
  };

  // Get field descriptions for MT103
  const getMT103FieldDescription = (code) => {
    const descriptions = {
      '20': 'Transaction Reference',
      '23B': 'Bank Operation Code',
      '32A': 'Value Date/Currency/Amount',
      '50K': 'Ordering Customer',
      '52A': 'Ordering Institution',
      '53A': 'Sender\'s Correspondent',
      '59': 'Beneficiary Customer',
      '70': 'Remittance Information',
      '71A': 'Details of Charges',
      '72': 'Sender to Receiver Information'
    };
    return descriptions[code] || code;
  };

  // Define field mappings
  const getFieldMappings = () => {
    return [
      { source: '20', target: 'MsgId', color: '#FF6B6B' },
      { source: '20', target: 'EndToEndId', color: '#FF6B6B' },
      { source: '32A', target: 'IntrBkSttlmAmt', color: '#4ECDC4' },
      { source: '50K', target: 'Nm', color: '#45B7D1', targetIndex: 0 },
      { source: '59', target: 'Nm', color: '#96CEB4', targetIndex: 1 },
      { source: '59', target: 'IBAN', color: '#96CEB4' },
      { source: '70', target: 'Ustrd', color: '#DDA0DD' },
    ];
  };

  // Calculate mapping lines positions
  useEffect(() => {
    if (!sourceRef.current || !targetRef.current || !svgRef.current) return;

    const calculateLines = () => {
      const lines = [];
      const mappings = getFieldMappings();
      const sourceFields = extractMT103Fields(sourceMessage);
      const targetFields = extractPacs008Fields(targetMessage);

      mappings.forEach(mapping => {
        const sourceFieldIndex = sourceFields.findIndex(f => f.code === mapping.source);
        const targetFieldIndex = targetFields.findIndex((f, idx) => {
          if (mapping.targetIndex !== undefined) {
            const count = targetFields.slice(0, idx + 1).filter(tf => tf.code === mapping.target).length - 1;
            return f.code === mapping.target && count === mapping.targetIndex;
          }
          return f.code === mapping.target;
        });

        if (sourceFieldIndex !== -1 && targetFieldIndex !== -1) {
          const sourceElements = sourceRef.current.querySelectorAll('[data-field]');
          const targetElements = targetRef.current.querySelectorAll('[data-field]');

          const sourceEl = sourceElements[sourceFieldIndex];
          const targetEl = targetElements[targetFieldIndex];

          if (sourceEl && targetEl) {
            const sourceRect = sourceEl.getBoundingClientRect();
            const targetRect = targetEl.getBoundingClientRect();
            const svgRect = svgRef.current.getBoundingClientRect();

            lines.push({
              x1: sourceRect.right - svgRect.left,
              y1: sourceRect.top + sourceRect.height / 2 - svgRect.top,
              x2: targetRect.left - svgRect.left,
              y2: targetRect.top + targetRect.height / 2 - svgRect.top,
              color: mapping.color,
              sourceField: mapping.source,
              targetField: mapping.target
            });
          }
        }
      });

      setMappingLines(lines);
    };

    // Calculate lines after a short delay to ensure DOM is ready
    const timer = setTimeout(calculateLines, 100);
    return () => clearTimeout(timer);
  }, [sourceMessage, targetMessage]);

  const sourceFields = extractMT103Fields(sourceMessage);
  const targetFields = extractPacs008Fields(targetMessage);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h3>Conversion Mapping Visualization</h3>
        <p>Hover over fields to see how values are mapped from source to target</p>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Source Message */}
        <div className={styles.messageColumn} ref={sourceRef}>
          <div className={styles.messageHeader}>
            <span className={styles.formatBadge}>{sourceFormat}</span>
            <span className={styles.messageTitle}>Source Message</span>
          </div>
          <div className={styles.messageContent}>
            {sourceFields.map((field, idx) => (
              <div
                key={idx}
                data-field={field.code}
                className={`${styles.field} ${
                  hoveredField === field.code ? styles.highlighted : ''
                }`}
                onMouseEnter={() => setHoveredField(field.code)}
                onMouseLeave={() => setHoveredField(null)}
                onClick={() => setSelectedField(field.code)}
              >
                <div className={styles.fieldHeader}>
                  <span className={styles.fieldCode}>:{field.code}:</span>
                  <span className={styles.fieldDescription}>{field.description}</span>
                </div>
                <div className={styles.fieldValue}>{field.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Mapping Lines */}
        <svg className={styles.mappingSvg} ref={svgRef}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3, 0 6"
                fill="#999"
              />
            </marker>
          </defs>
          {mappingLines.map((line, idx) => (
            <g key={idx}>
              <path
                d={`M ${line.x1} ${line.y1} Q ${(line.x1 + line.x2) / 2} ${line.y1} ${(line.x1 + line.x2) / 2} ${(line.y1 + line.y2) / 2} T ${line.x2} ${line.y2}`}
                stroke={line.color}
                strokeWidth="2"
                fill="none"
                opacity={hoveredField && hoveredField !== line.sourceField ? 0.2 : 0.8}
                markerEnd="url(#arrowhead)"
                className={styles.mappingLine}
              />
            </g>
          ))}
        </svg>

        {/* Target Message */}
        <div className={styles.messageColumn} ref={targetRef}>
          <div className={styles.messageHeader}>
            <span className={styles.formatBadge}>{targetFormat}</span>
            <span className={styles.messageTitle}>Target Message</span>
          </div>
          <div className={styles.messageContent}>
            {targetFields.map((field, idx) => {
              // Find which source field maps to this target field
              const mapping = getFieldMappings().find(m => m.code === field.code);
              const isHighlighted = hoveredField && getFieldMappings().some(
                m => m.source === hoveredField && m.target === field.code
              );

              return (
                <div
                  key={idx}
                  data-field={field.code}
                  className={`${styles.field} ${
                    isHighlighted ? styles.highlighted : ''
                  }`}
                >
                  <div className={styles.fieldHeader}>
                    <span className={styles.fieldCode}>&lt;{field.code}&gt;</span>
                    <span className={styles.fieldDescription}>{field.description}</span>
                  </div>
                  <div className={styles.fieldValue}>{field.value}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendTitle}>Field Mapping Legend</div>
        <div className={styles.legendItems}>
          <div className={styles.legendItem}>
            <div className={styles.legendColor} style={{ backgroundColor: '#FF6B6B' }}></div>
            <span>Transaction Reference</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendColor} style={{ backgroundColor: '#4ECDC4' }}></div>
            <span>Amount & Currency</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendColor} style={{ backgroundColor: '#45B7D1' }}></div>
            <span>Ordering Party</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendColor} style={{ backgroundColor: '#96CEB4' }}></div>
            <span>Beneficiary</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendColor} style={{ backgroundColor: '#DDA0DD' }}></div>
            <span>Remittance Info</span>
          </div>
        </div>
      </div>
    </div>
  );
}