'use client';

import React from 'react';
import { H2, Body } from '@leafygreen-ui/typography';
import Button from '@leafygreen-ui/button';
import Icon from '@leafygreen-ui/icon';
import ScenarioSelector from './ScenarioSelector';

/**
 * CollapsibleScenariosPanel Component
 * Collapsible panel containing scenario selection cards
 *
 * @param {Object} props
 * @param {boolean} props.isExpanded - Whether panel is expanded
 * @param {Function} props.onToggleExpand - Callback to toggle expansion
 * @param {Array} props.scenarios - Array of scenario objects
 * @param {string} props.selectedScenario - Currently selected scenario ID
 * @param {Function} props.onSelectScenario - Callback when scenario is selected
 * @param {Function} props.onSimulate - Callback when simulate button is clicked
 * @param {Function} props.onReset - Callback when reset button is clicked
 * @param {boolean} props.isStreaming - Whether conversion is in progress
 */
export default function CollapsibleScenariosPanel({
  isExpanded,
  onToggleExpand,
  scenarios,
  selectedScenario,
  onSelectScenario,
  onSimulate,
  onReset,
  isStreaming
}) {
  const selectedScenarioData = scenarios.find(s => s.id === selectedScenario);

  return (
    <div style={{
      marginBottom: '24px',
      background: 'white',
      border: '1px solid #E7EAEE',
      borderRadius: '12px',
      overflow: 'hidden',
      transition: 'all 0.3s ease'
    }}>
      {/* Header - Always Visible */}
      <div
        style={{
          padding: '16px 20px',
          background: '#F9FBFA',
          borderBottom: isExpanded ? '1px solid #E7EAEE' : 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'background 0.2s ease'
        }}
        onClick={onToggleExpand}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#F0F3F5';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#F9FBFA';
        }}
      >
        <div style={{ flex: 1 }}>
          {isExpanded ? (
            <Body weight="medium" style={{ fontSize: '16px' }}>
              Payment Scenarios
            </Body>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Icon glyph="Checkmark" fill="#00A35C" />
              <div>
                <Body style={{ fontSize: '12px', color: '#889397' }}>
                  Payment Scenarios
                </Body>
                <Body weight="medium" style={{ fontSize: '14px' }}>
                  {selectedScenarioData?.title || 'No scenario selected'}
                </Body>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!isExpanded && selectedScenario && (
            <Button
              variant="danger"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              disabled={isStreaming}
            >
              Reset
            </Button>
          )}
          <Icon
            glyph={isExpanded ? 'ChevronUp' : 'ChevronDown'}
            fill="#889397"
            size="large"
          />
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div style={{
          padding: '16px',
          animation: 'slideDown 0.3s ease'
        }}>
          {/* Scenario Cards */}
          <ScenarioSelector
            scenarios={scenarios}
            selectedScenario={selectedScenario}
            onSelectScenario={onSelectScenario}
            isStreaming={isStreaming}
          />

          {/* Simulate Button */}
          {selectedScenario && (
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #E7EAEE'
            }}>
              <Button
                variant="primary"
                onClick={onSimulate}
                disabled={isStreaming}
                leftGlyph={<Icon glyph="Play" />}
              >
                {isStreaming ? 'Processing...' : 'Simulate Transaction'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
