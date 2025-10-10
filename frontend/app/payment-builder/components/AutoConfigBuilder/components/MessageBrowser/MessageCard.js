'use client';

import Badge from '@leafygreen-ui/badge';
import Button from '@leafygreen-ui/button';
import Icon from '@leafygreen-ui/icon';
import { Body } from '@leafygreen-ui/typography';
import styles from './MessageCard.module.css';

export default function MessageCard({ message, onSelect, isExpanded, onToggleExpand }) {
  const categoryColors = {
    swift_mt: '#00684A',
    iso20022: '#1254B7',
    iso8583: '#5C3C92',
    domestic: '#B35E00',
    other: '#889397'
  };

  const categoryColor = categoryColors[message.category] || '#889397';

  // Get first 3 lines of message for preview
  const getPreview = () => {
    const lines = message.sampleMessage.split('\n').filter(l => l.trim());
    return lines.slice(0, 3).join('\n');
  };

  return (
    <div className={`${styles.card} ${isExpanded ? styles.expanded : ''}`}>
      <div className={styles.cardHeader}>
        <div className={styles.headerTop}>
          <Badge
            variant="lightgray"
            className={styles.formatBadge}
            style={{ borderLeft: `3px solid ${categoryColor}` }}
          >
            {message.sourceFormat}
          </Badge>
          <div className={styles.actions}>
            <button
              className={styles.expandButton}
              onClick={onToggleExpand}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <Icon glyph={isExpanded ? 'ChevronUp' : 'ChevronDown'} size="small" />
            </button>
          </div>
        </div>
        <h4 className={styles.cardTitle}>{message.name}</h4>
        <Body className={styles.cardDescription}>{message.description}</Body>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.preview}>
          <div className={styles.previewLabel}>Sample Preview:</div>
          <pre className={styles.previewCode}>
            {isExpanded ? message.sampleMessage : getPreview()}
            {!isExpanded && '\n...'}
          </pre>
        </div>

        {isExpanded && (
          <div className={styles.metadata}>
            <div className={styles.metadataItem}>
              <span className={styles.metadataLabel}>Use Case:</span>
              <span className={styles.metadataValue}>{message.useCase}</span>
            </div>
            <div className={styles.metadataItem}>
              <span className={styles.metadataLabel}>Suggested Targets:</span>
              <div className={styles.targetBadges}>
                {message.targetFormats.map(format => (
                  <Badge key={format} variant="blue" className={styles.targetBadge}>
                    {format}
                  </Badge>
                ))}
              </div>
            </div>
            <div className={styles.metadataItem}>
              <span className={styles.metadataLabel}>Tags:</span>
              <div className={styles.tags}>
                {message.tags.map(tag => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.cardFooter}>
        <Button
          variant="primary"
          size="default"
          onClick={() => onSelect(message)}
          leftGlyph={<Icon glyph="Checkmark" />}
          className={styles.selectButton}
        >
          Select This Message
        </Button>
      </div>
    </div>
  );
}
