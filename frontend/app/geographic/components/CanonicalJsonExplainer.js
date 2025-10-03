'use client';

import React, { useState, useEffect } from 'react';
import styles from './CanonicalJsonExplainer.module.css';

const CanonicalJsonExplainer = () => {
  const [activeComparison, setActiveComparison] = useState('with');
  const [hoveredFormat, setHoveredFormat] = useState(null);
  const [animationPhase, setAnimationPhase] = useState(0);

  // Payment formats arranged in a circle
  const formats = [
    { id: 'mt103', name: 'MT103', angle: 0, color: '#5C6C75' },
    { id: 'mt202', name: 'MT202', angle: 60, color: '#5C6C75' },
    { id: 'pacs008', name: 'pacs.008', angle: 120, color: '#5C6C75' },
    { id: 'pacs009', name: 'pacs.009', angle: 180, color: '#5C6C75' },
    { id: 'iso8583', name: 'ISO8583', angle: 240, color: '#5C6C75' },
    { id: 'target2', name: 'TARGET2', angle: 300, color: '#5C6C75' }
  ];

  // Field mapping examples for hover
  const fieldMappings = {
    mt103: {
      input: 'Field 50K: Ordering Customer',
      output: 'parties.debtor.name'
    },
    mt202: {
      input: 'Field 52A: Ordering Institution',
      output: 'parties.ordering_institution'
    },
    pacs008: {
      input: 'CdtTrfTxInf.Dbtr.Nm',
      output: 'parties.debtor.name'
    },
    pacs009: {
      input: 'FICdtTrf.Dbtr.FinInstnId',
      output: 'parties.debtor.institution'
    },
    iso8583: {
      input: 'Field 42: Card Acceptor ID',
      output: 'parties.merchant.id'
    },
    target2: {
      input: 'InstgAgt',
      output: 'parties.instructing_agent'
    }
  };

  useEffect(() => {
    // Cycle through animation phases for the comparison view
    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const calculatePosition = (angle, radius) => {
    const rad = (angle * Math.PI) / 180;
    // Round to 2 decimal places to ensure consistent server/client rendering
    return {
      x: Math.round(Math.cos(rad) * radius * 100) / 100,
      y: Math.round(Math.sin(rad) * radius * 100) / 100
    };
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Understanding the Canonical JSON Format</h2>
        <p className={styles.subtitle}>The Universal Language for Payment Conversion</p>
      </div>

      <div className={styles.mainVisualization}>
        <svg className={styles.hubDiagram} viewBox="0 0 600 400">
          <defs>
            {/* Arrow marker */}
            <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#00A35C" />
            </marker>
          </defs>

          {/* Connections from formats to JSON hub */}
          {formats.map(format => {
            const pos = calculatePosition(format.angle, 140);
            const centerX = 300;
            const centerY = 200;
            const nodeX = centerX + pos.x;
            const nodeY = centerY + pos.y;

            return (
              <g key={`connection-${format.id}`}>
                {/* Line to hub */}
                <line
                  x1={nodeX}
                  y1={nodeY}
                  x2={centerX}
                  y2={centerY}
                  stroke={hoveredFormat === format.id ? "#00A35C" : "#C1C7C6"}
                  strokeWidth={hoveredFormat === format.id ? "2.5" : "1.5"}
                  opacity={hoveredFormat === format.id ? "1" : "0.4"}
                  className={styles.connectionLine}
                />
                {/* Arrow pointing to hub */}
                <line
                  x1={nodeX + (centerX - nodeX) * 0.15}
                  y1={nodeY + (centerY - nodeY) * 0.15}
                  x2={nodeX + (centerX - nodeX) * 0.4}
                  y2={nodeY + (centerY - nodeY) * 0.4}
                  stroke={hoveredFormat === format.id ? "#00A35C" : "#C1C7C6"}
                  strokeWidth={hoveredFormat === format.id ? "2" : "1.5"}
                  opacity={hoveredFormat === format.id ? "1" : "0.5"}
                  markerEnd="url(#arrowhead)"
                  className={styles.connectionLine}
                />
                {/* Arrow pointing from hub */}
                <line
                  x1={centerX + (nodeX - centerX) * 0.4}
                  y1={centerY + (nodeY - centerY) * 0.4}
                  x2={centerX + (nodeX - centerX) * 0.65}
                  y2={centerY + (nodeY - centerY) * 0.65}
                  stroke={hoveredFormat === format.id ? "#00A35C" : "#C1C7C6"}
                  strokeWidth={hoveredFormat === format.id ? "2" : "1.5"}
                  opacity={hoveredFormat === format.id ? "1" : "0.5"}
                  markerEnd="url(#arrowhead)"
                  className={styles.connectionLine}
                />
              </g>
            );
          })}

          {/* Format nodes */}
          {formats.map(format => {
            const pos = calculatePosition(format.angle, 140);
            const centerX = 300;
            const centerY = 200;
            const nodeX = centerX + pos.x;
            const nodeY = centerY + pos.y;

            return (
              <g
                key={format.id}
                transform={`translate(${nodeX}, ${nodeY})`}
                onMouseEnter={() => setHoveredFormat(format.id)}
                onMouseLeave={() => setHoveredFormat(null)}
                className={styles.formatNode}
              >
                <rect
                  x="-40"
                  y="-18"
                  width="80"
                  height="36"
                  rx="6"
                  fill="white"
                  stroke={hoveredFormat === format.id ? "#00A35C" : "#E8EDEB"}
                  strokeWidth={hoveredFormat === format.id ? "2.5" : "2"}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="13"
                  fontWeight="600"
                  fill={hoveredFormat === format.id ? "#001E2B" : "#5C6C75"}
                >
                  {format.name}
                </text>
              </g>
            );
          })}

          {/* Central JSON hub - clean and professional */}
          <g transform="translate(300, 200)">
            <rect
              x="-70"
              y="-35"
              width="140"
              height="70"
              rx="8"
              fill="#00A35C"
              filter="drop-shadow(0 4px 12px rgba(0, 163, 92, 0.25))"
            />
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              y="-10"
              fontSize="15"
              fontWeight="700"
              fill="white"
              letterSpacing="0.3"
            >
              Canonical JSON
            </text>
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              y="10"
              fontSize="11"
              fontWeight="500"
              fill="white"
              opacity="0.85"
            >
              Universal Format
            </text>
          </g>
        </svg>

        {/* Hover tooltip */}
        {hoveredFormat && (
          <div className={styles.mappingTooltip}>
            <div className={styles.tooltipHeader}>
              Field Mapping Example
            </div>
            <div className={styles.mappingFlow}>
              <div className={styles.mappingSource}>
                <span className={styles.mappingLabel}>Source:</span>
                <code>{fieldMappings[hoveredFormat].input}</code>
              </div>
              <div className={styles.mappingArrow}>→</div>
              <div className={styles.mappingTarget}>
                <span className={styles.mappingLabel}>JSON:</span>
                <code>{fieldMappings[hoveredFormat].output}</code>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.comparisonSection}>
        <div className={styles.comparisonHeader}>
          <button
            className={`${styles.comparisonTab} ${activeComparison === 'without' ? styles.active : ''}`}
            onClick={() => setActiveComparison('without')}
          >
            Without Canonical JSON
          </button>
          <button
            className={`${styles.comparisonTab} ${activeComparison === 'with' ? styles.active : ''}`}
            onClick={() => setActiveComparison('with')}
          >
            With Canonical JSON
          </button>
        </div>

        <div className={styles.comparisonContent}>
          {activeComparison === 'without' ? (
            <div className={styles.comparisonPanel}>
              <svg viewBox="0 0 300 200" className={styles.comparisonDiagram}>
                {/* Complex mesh of connections */}
                {formats.map((format1, i) =>
                  formats.map((format2, j) => {
                    if (i >= j) return null;
                    const x1 = 50 + (i % 3) * 100;
                    const y1 = 50 + Math.floor(i / 3) * 100;
                    const x2 = 50 + (j % 3) * 100;
                    const y2 = 50 + Math.floor(j / 3) * 100;
                    return (
                      <line
                        key={`${i}-${j}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#C1C7C6"
                        strokeWidth="1"
                        opacity="0.3"
                        className={styles.complexConnection}
                      />
                    );
                  })
                )}
                {/* Format nodes */}
                {formats.map((format, i) => {
                  const x = 50 + (i % 3) * 100;
                  const y = 50 + Math.floor(i / 3) * 100;
                  return (
                    <g key={format.id}>
                      <circle cx={x} cy={y} r="20" fill="#F9FBFA" stroke="#889397" strokeWidth="1" />
                      <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#001E2B">
                        {format.name.split('.')[0]}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div className={styles.comparisonStats}>
                <div className={styles.statNumber}>30</div>
                <div className={styles.statLabel}>Direct Mappings Required</div>
                <div className={styles.statFormula}>(6 × 5) connections</div>
              </div>
              <ul className={styles.drawbacks}>
                <li>Complex point-to-point integrations</li>
                <li>Exponential growth with new formats</li>
                <li>Maintenance nightmare</li>
              </ul>
            </div>
          ) : (
            <div className={styles.comparisonPanel}>
              <svg viewBox="0 0 300 200" className={styles.comparisonDiagram}>
                {/* Central JSON hub */}
                <circle cx="150" cy="100" r="25" fill="#00A35C" />
                <text x="150" y="100" textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="600" fill="white">
                  JSON
                </text>
                {/* Spokes to formats */}
                {formats.map((format, i) => {
                  const angle = (i * 60) * Math.PI / 180;
                  const x = Math.round((150 + Math.cos(angle) * 70) * 100) / 100;
                  const y = Math.round((100 + Math.sin(angle) * 70) * 100) / 100;
                  return (
                    <g key={format.id}>
                      <line x1="150" y1="100" x2={x} y2={y} stroke="#00ED64" strokeWidth="2" opacity="0.6" />
                      <circle cx={x} cy={y} r="18" fill="white" stroke="#00A35C" strokeWidth="1.5" />
                      <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#001E2B">
                        {format.name.split('.')[0]}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div className={styles.comparisonStats}>
                <div className={styles.statNumber}>12</div>
                <div className={styles.statLabel}>Hub Mappings Only</div>
                <div className={styles.statFormula}>(6 × 2) connections</div>
              </div>
              <ul className={styles.benefits}>
                <li>Single source of truth</li>
                <li>Linear scaling with new formats</li>
                <li>Consistent data model</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className={styles.keyBenefits}>
        <h3>The Rosetta Stone of Payment Formats</h3>
        <div className={styles.benefitsList}>
          <div className={styles.benefit}>
            <div className={styles.benefitIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 11l3 3L22 4" stroke="#00A35C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="#00A35C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className={styles.benefitText}>
              <strong>Universal Format</strong>
              <span>Every field from every format has a defined location</span>
            </div>
          </div>
          <div className={styles.benefit}>
            <div className={styles.benefitIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="#00A35C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className={styles.benefitText}>
              <strong>No Data Loss</strong>
              <span>Complete preservation of all payment information</span>
            </div>
          </div>
          <div className={styles.benefit}>
            <div className={styles.benefitIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#00A35C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17l10 5 10-5" stroke="#00A35C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12l10 5 10-5" stroke="#00A35C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className={styles.benefitText}>
              <strong>Enables Any-to-Any</strong>
              <span>Convert between any formats through JSON</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.callToAction}>
        <span className={styles.arrowIndicator}>←</span>
        <span>Select a payment scenario to see the Canonical JSON format in action</span>
      </div>
    </div>
  );
};

export default CanonicalJsonExplainer;