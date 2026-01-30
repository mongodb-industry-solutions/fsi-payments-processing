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
 * @param {boolean} props.useAI - Whether to use AI lane for unstructured fields
 * @param {Function} props.onToggleAI - Callback to toggle AI mode
 */
export default function CollapsibleScenariosPanel({
  isExpanded,
  onToggleExpand,
  scenarios,
  selectedScenario,
  onSelectScenario,
  onSimulate,
  onReset,
  isStreaming,
  useAI = true,
  onToggleAI
}) {
  const selectedScenarioData = scenarios.find(s => s.id === selectedScenario);
  const isDeterministic = selectedScenarioData?.isDeterministic === true;
  const toggleDisabled = isStreaming || isDeterministic;

  return (
    <div style={{
      marginBottom: '24px',
      background: 'white',
      border: '1px solid #E7EAEE',
      borderRadius: '12px',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
    }}>
      {/* Header - Always Visible */}
      <div
        style={{
          padding: '16px 24px',
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
            <H2>Payment Scenarios</H2>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#E3FCF7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon glyph="Checkmark" fill="#00A35C" />
              </div>
              <div>
                <Body style={{ fontSize: '11px', color: '#889397', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Selected Scenario
                </Body>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                  <Body weight="medium" style={{ fontSize: '15px', color: '#1C2D38' }}>
                    {selectedScenarioData?.sourceCountry?.code || '??'} → {selectedScenarioData?.targetCountry?.code || '??'}
                  </Body>
                  <Body style={{ fontSize: '13px', color: '#5C6C75' }}>
                    {selectedScenarioData?.description?.substring(0, 50)}{selectedScenarioData?.description?.length > 50 ? '...' : ''}
                  </Body>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!isExpanded && selectedScenario && (
            <>
              <Button
                variant="default"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onReset();
                }}
                disabled={isStreaming}
              >
                Reset
              </Button>
              <Button
                variant="primary"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onSimulate();
                }}
                disabled={isStreaming}
                leftGlyph={<Icon glyph="Play" />}
                style={{
                  boxShadow: '0 2px 8px rgba(0, 163, 92, 0.25)'
                }}
              >
                {isStreaming ? 'Processing...' : 'Simulate'}
              </Button>
            </>
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

          {/* Action Buttons */}
          {selectedScenario && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #E7EAEE'
            }}>
              {/* AI/Rules Mode Toggle - Segmented Control */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{
                  fontSize: '13px',
                  color: '#5C6C75',
                  fontWeight: 500
                }}>
                  Processing Mode:
                </span>
                <div style={{
                  display: 'flex',
                  borderRadius: '20px',
                  border: '1px solid #E8EDEB',
                  background: '#F9FBFA',
                  padding: '3px',
                  opacity: toggleDisabled ? 0.5 : 1,
                  cursor: isDeterministic ? 'not-allowed' : 'default'
                }}>
                  <button
                    onClick={() => !isDeterministic && onToggleAI && onToggleAI(false)}
                    disabled={toggleDisabled}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '16px',
                      border: 'none',
                      cursor: toggleDisabled ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      transition: 'all 0.2s ease',
                      background: !useAI ? '#1C2D38' : 'transparent',
                      color: !useAI ? 'white' : '#5C6C75'
                    }}
                  >
                    <span style={{ fontSize: '13px' }}>⚡</span>
                    Rules
                  </button>
                  <button
                    onClick={() => !isDeterministic && onToggleAI && onToggleAI(true)}
                    disabled={toggleDisabled}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '16px',
                      border: 'none',
                      cursor: toggleDisabled ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      transition: 'all 0.2s ease',
                      background: useAI ? '#00684A' : 'transparent',
                      color: useAI ? 'white' : '#5C6C75'
                    }}
                  >
                    <span style={{ fontSize: '13px' }}>🤖</span>
                    AI
                  </button>
                </div>
                <span style={{
                  fontSize: '11px',
                  color: '#889397',
                  maxWidth: '200px'
                }}>
                  {isDeterministic
                    ? 'All fields mapped deterministically'
                    : useAI ? 'LLM parses unstructured fields' : 'Regex patterns extract unstructured fields'}
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button
                  variant="default"
                  onClick={onReset}
                  disabled={isStreaming}
                >
                  Reset
                </Button>
                <Button
                  variant="primary"
                  onClick={onSimulate}
                  disabled={isStreaming}
                  leftGlyph={<Icon glyph="Play" />}
                  style={{
                    boxShadow: '0 4px 12px rgba(0, 163, 92, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isStreaming ? 'Processing...' : 'Simulate Transaction'}
                </Button>
              </div>
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
