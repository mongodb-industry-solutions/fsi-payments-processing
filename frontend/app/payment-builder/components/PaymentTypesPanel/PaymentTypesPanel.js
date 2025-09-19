'use client';

import { useState } from 'react';
import styles from './PaymentTypesPanel.module.css';
import {
  WireTransferIcon,
  CardIcon,
  BankIcon,
  CurrencyIcon,
  FastPaymentIcon,
  NetworkIcon
} from '../shared/Icons';

const PAYMENT_TYPES = [
  {
    id: 'cross_border',
    name: 'Cross-Border Wire Transfer',
    icon: <WireTransferIcon />,
    description: 'International payment conversion',
    sourceFormat: 'MT103',
    targetFormat: 'pacs.008',
    complexity: 'complex',
    estimatedTime: '1-3s',
    fields: 27,
    mongoFeatures: ['Flexible Schema', 'AI Processing', 'Multi-lane'],
    color: 'green'
  },
  {
    id: 'card_payment',
    name: 'Card Authorization',
    icon: <CardIcon />,
    description: 'Real-time card transaction',
    sourceFormat: 'ISO8583',
    targetFormat: 'cain.001',
    complexity: 'medium',
    estimatedTime: '500ms',
    fields: 18,
    mongoFeatures: ['Binary Handling', 'Real-time', 'Sub-second'],
    color: 'blue'
  },
  {
    id: 'bank_transfer',
    name: 'Bank-to-Bank Transfer',
    icon: <BankIcon />,
    description: 'Correspondent banking',
    sourceFormat: 'MT202',
    targetFormat: 'pacs.009',
    complexity: 'simple',
    estimatedTime: '200ms',
    fields: 15,
    mongoFeatures: ['Direct Mapping', 'High Volume', 'Bulk Ops'],
    color: 'purple'
  },
  {
    id: 'fx_settlement',
    name: 'FX Settlement',
    icon: <CurrencyIcon />,
    description: 'Foreign exchange settlement',
    sourceFormat: 'MT205',
    targetFormat: 'pacs.009',
    complexity: 'medium',
    estimatedTime: '750ms',
    fields: 22,
    mongoFeatures: ['Decimal128', 'Multi-currency', 'Atomic Ops'],
    color: 'orange'
  },
  {
    id: 'instant_payment',
    name: 'Instant Payment',
    icon: <FastPaymentIcon />,
    description: 'Real-time P2P payment',
    sourceFormat: 'pacs.008',
    targetFormat: 'TARGET2',
    complexity: 'simple',
    estimatedTime: '150ms',
    fields: 12,
    mongoFeatures: ['Caching', 'Low Latency', 'Direct Route'],
    color: 'teal'
  },
  {
    id: 'multi_hop',
    name: 'Multi-Hop Journey',
    icon: <NetworkIcon />,
    description: 'Complex multi-format routing',
    sourceFormat: 'MT103',
    targetFormat: 'pacs.009',
    complexity: 'complex',
    estimatedTime: '2-5s',
    fields: 30,
    mongoFeatures: ['Graph Routing', 'JSON Bridge', 'Auto-config'],
    color: 'red'
  }
];

export default function PaymentTypesPanel({ selectedType, onSelectType }) {
  const [hoveredType, setHoveredType] = useState(null);

  const getComplexityBadge = (complexity) => {
    const colors = {
      simple: { bg: 'var(--green-light3)', text: 'var(--green-dark1)' },
      medium: { bg: 'var(--blue-light3)', text: 'var(--blue-dark1)' },
      complex: { bg: '#fee9e9', text: '#d32f2f' }
    };
    return colors[complexity] || colors.medium;
  };

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerAccent} aria-hidden="true" />
        <h2 id="payment-types-heading">Payment Types</h2>
        <p id="payment-types-description">Select a payment scenario to build</p>
      </div>

      {/* Payment Type Cards */}
      <div className={styles.typesList} role="list" aria-labelledby="payment-types-heading" aria-describedby="payment-types-description">
        {PAYMENT_TYPES.map((type) => {
          const isSelected = selectedType?.id === type.id;
          const isHovered = hoveredType === type.id;
          const complexityColors = getComplexityBadge(type.complexity);

          return (
            <div
              key={type.id}
              className={`${styles.typeCard} ${isSelected ? styles.selected : ''}`}
              onClick={() => onSelectType(type)}
              onMouseEnter={() => setHoveredType(type.id)}
              onMouseLeave={() => setHoveredType(null)}
              role="listitem"
              tabIndex={0}
              aria-selected={isSelected}
              aria-label={`${type.name}. ${type.description}. Converts ${type.sourceFormat} to ${type.targetFormat}. Estimated time: ${type.estimatedTime}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectType(type);
                }
              }}
            >
              {/* Card Header */}
              <div className={styles.cardHeader}>
                <div className={styles.iconWrapper} aria-hidden="true">
                  {type.icon}
                </div>
                <div className={styles.cardTitle}>
                  <h3>{type.name}</h3>
                  <span
                    className={styles.complexityBadge}
                    style={{
                      backgroundColor: complexityColors.bg,
                      color: complexityColors.text
                    }}
                  >
                    {type.complexity}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className={styles.description}>{type.description}</p>

              {/* Format Flow */}
              <div className={styles.formatFlow} aria-label={`Converts from ${type.sourceFormat} to ${type.targetFormat}`}>
                <span className={styles.format}>{type.sourceFormat}</span>
                <span className={styles.arrow} aria-hidden="true">→</span>
                <span className={styles.format}>{type.targetFormat}</span>
              </div>

              {/* Stats Grid */}
              <div className={styles.statsGrid}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Time</span>
                  <span className={styles.statValue}>{type.estimatedTime}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Fields</span>
                  <span className={styles.statValue}>{type.fields}</span>
                </div>
              </div>

              {/* MongoDB Features */}
              <div className={styles.features}>
                {type.mongoFeatures.slice(0, 2).map((feature, idx) => (
                  <span key={idx} className={styles.featureBadge}>
                    {feature}
                  </span>
                ))}
                {type.mongoFeatures.length > 2 && (
                  <span className={styles.featureBadge}>
                    +{type.mongoFeatures.length - 2}
                  </span>
                )}
              </div>

              {/* Select Button */}
              <button
                className={`${styles.selectButton} ${isSelected ? styles.selectedButton : ''}`}
                tabIndex={-1}
                aria-hidden="true"
              >
                {isSelected ? 'Selected' : 'Select Type'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className={styles.footer}>
        <div className={styles.footerInfo}>
          <strong>6</strong> payment scenarios
          <span className={styles.separator}>•</span>
          <strong>100%</strong> generic converter
        </div>
      </div>
    </div>
  );
}