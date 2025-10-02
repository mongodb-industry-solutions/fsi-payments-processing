import React, { useState, useMemo } from 'react';
import styles from './TreeNavigator.module.css';

const getIcon = (iconName) => {
  const icons = {
    'Code': '💻',
    'ArrowRight': '→',
    'Sparkle': '✨',
    'Wrench': '🔧'
  };
  return icons[iconName] || '';
};

const TreeNavigator = ({ configuration, validationResult, onSelect, selectedPath }) => {
  const [expanded, setExpanded] = useState({
    root: true,
    parser: true,
    mappings: false,
    ai_service: false,
    builder: false
  });

  // Build tree with validation status
  const treeData = useMemo(() => {
    const getValidationStatus = (path) => {
      if (!validationResult?.details) return 'valid';

      // Map tree paths to validation check names
      const checkNameMap = {
        '': 'Required Fields',
        'parser': 'Parser Configuration',
        'mappings': 'Mapping Structure',
        'ai_service': 'AI Configuration',
        'builder': 'Builder Template',
        'human_review': 'Human Review Settings'
      };

      const checkName = checkNameMap[path];
      if (!checkName) return 'valid'; // No validation check for this path

      const check = validationResult.details.find(d => d.check === checkName);
      if (!check) return 'valid'; // Check not found, assume valid

      return check.is_valid ? 'valid' : 'error';
    };

    return {
      label: configuration._id,
      path: '',
      status: getValidationStatus(''),
      children: [
        {
          label: 'parser',
          path: 'parser',
          status: getValidationStatus('parser'),
          icon: 'Code',
          children: Object.keys(configuration.parser || {}).map(key => ({
            label: key,
            path: `parser.${key}`,
            status: 'valid'
          }))
        },
        {
          label: `mappings (${configuration.mappings?.length || 0})`,
          path: 'mappings',
          status: getValidationStatus('mappings'),
          icon: 'ArrowRight',
          children: (configuration.mappings || []).map((m, i) => ({
            label: m.source || `Mapping ${i}`,
            path: `mappings[${i}]`,
            status: m.processing_lane === 'AI' && !m.field_type ? 'warning' : 'valid'
          }))
        },
        {
          label: 'ai_service',
          path: 'ai_service',
          status: getValidationStatus('ai_service'),
          icon: 'Sparkle',
          children: Object.keys(configuration.ai_service?.field_types || {}).map(key => ({
            label: key,
            path: `ai_service.field_types.${key}`,
            status: 'valid'
          }))
        },
        {
          label: 'builder',
          path: 'builder',
          status: getValidationStatus('builder'),
          icon: 'Wrench',
          children: []
        }
      ]
    };
  }, [configuration, validationResult]);

  const renderNode = (node, level = 0) => {
    const isExpanded = expanded[node.path] !== false;
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedPath === node.path;

    return (
      <div key={node.path} className={styles.node}>
        <div
          className={`${styles.nodeHeader} ${isSelected ? styles.selected : ''}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            onSelect(node.path);
            if (hasChildren) {
              setExpanded(prev => ({ ...prev, [node.path]: !prev[node.path] }));
            }
          }}
        >
          {hasChildren && (
            <span className={styles.icon}>{isExpanded ? '▼' : '▶'}</span>
          )}
          {node.icon && (
            <span className={styles.icon}>{getIcon(node.icon)}</span>
          )}
          <span className={styles.label}>{node.label}</span>
          {node.status === 'error' && (
            <span className={styles.errorIcon}>✗</span>
          )}
          {node.status === 'warning' && (
            <span className={styles.warningIcon}>⚠</span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className={styles.children}>
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4>Configuration Structure</h4>
      </div>
      <div className={styles.tree}>
        {renderNode(treeData)}
      </div>
    </div>
  );
};

export default TreeNavigator;
