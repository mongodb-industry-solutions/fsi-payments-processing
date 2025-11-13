'use client';

import React from 'react';
import { Body } from '@leafygreen-ui/typography';
import Card from '@leafygreen-ui/card';
import Badge from '@leafygreen-ui/badge';
import Icon from '@leafygreen-ui/icon';

/**
 * ScenarioSelector Component
 * Displays pre-configured payment scenarios as selectable cards
 *
 * @param {Object} props
 * @param {Array} props.scenarios - Array of scenario objects
 * @param {string} props.selectedScenario - Currently selected scenario ID
 * @param {Function} props.onSelectScenario - Callback when scenario is selected
 * @param {boolean} props.isStreaming - Whether conversion is in progress
 */
export default function ScenarioSelector({
  scenarios,
  selectedScenario,
  onSelectScenario,
  isStreaming
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '12px'
    }}>
        {scenarios.map((scenario) => (
          <Card
            key={scenario.id}
            as="button"
            onClick={() => onSelectScenario(scenario.id)}
            style={{
              padding: '12px',
              cursor: 'pointer',
              border: '2px solid #E7EAEE',
              transition: 'all 0.2s ease',
              textAlign: 'left',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#00A35C';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 163, 92, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#E7EAEE';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <Body weight="medium" style={{ fontSize: '13px' }}>{scenario.title}</Body>
              <Badge variant={scenario.badgeVariant}>{scenario.badge}</Badge>
            </div>

            {/* Country Route */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 8px',
              background: '#F9FBFA',
              borderRadius: '4px'
            }}>
              <span style={{ fontSize: '16px' }}>{scenario.sourceCountry.flag}</span>
              <Icon glyph="ArrowRight" size="small" fill="#889397" />
              <span style={{ fontSize: '16px' }}>{scenario.targetCountry.flag}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Body style={{ fontSize: '10px', color: '#889397' }}>
                  {scenario.steps} steps
                </Body>
              </div>
            </div>
          </Card>
        ))}

        {/* Custom Configuration Card */}
        <Card
          style={{
            padding: '12px',
            border: '2px dashed #C1C7CD',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100px',
            background: '#F9FBFA'
          }}
        >
          <Icon glyph="Plus" size="small" fill="#889397" />
          <Body weight="medium" style={{ marginTop: '8px', fontSize: '13px', color: '#5C6C75' }}>
            Configure your own
          </Body>
          <Body style={{ fontSize: '10px', color: '#889397', marginTop: '2px' }}>
            Coming soon
          </Body>
        </Card>
      </div>
  );
}
