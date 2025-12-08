'use client';

import React from 'react';
import { Body } from '@leafygreen-ui/typography';
import Card from '@leafygreen-ui/card';
import Badge from '@leafygreen-ui/badge';
import Icon from '@leafygreen-ui/icon';
import Tooltip from '@leafygreen-ui/tooltip';

/**
 * ScenarioSelector Component - Compact Version
 * Displays pre-configured payment scenarios as selectable compact cards
 */
export default function ScenarioSelector({
  scenarios,
  selectedScenario,
  onSelectScenario,
  isStreaming
}) {
  return (
    <div style={{
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap'
    }}>
      {scenarios.map((scenario) => {
        const isSelected = scenario.id === selectedScenario;
        return (
          <Card
            key={scenario.id}
            as="div"
            onClick={() => onSelectScenario(scenario.id)}
            style={{
              padding: '10px 12px',
              border: isSelected ? '2px solid #00A35C' : '1px solid #E7EAEE',
              transition: 'all 0.15s ease',
              cursor: 'pointer',
              backgroundColor: isSelected ? '#F0F8F4' : 'white',
              boxShadow: isSelected ? '0 2px 8px rgba(0, 163, 92, 0.2)' : 'none',
              minWidth: '200px',
              maxWidth: '280px',
              flex: '1 1 200px'
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = '#C1C7CD';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = '#E7EAEE';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {/* Top Row: Route + Selection */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px'
            }}>
              {/* Country Route */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Body style={{ fontSize: '12px', fontWeight: '600', color: '#1C2D38' }}>
                  {scenario.sourceCountry.code}
                </Body>
                <Icon glyph="ArrowRight" size="small" fill="#889397" />
                <Body style={{ fontSize: '12px', fontWeight: '600', color: '#1C2D38' }}>
                  {scenario.targetCountry.code}
                </Body>
              </div>

              {/* Selection Check */}
              {isSelected && (
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: '#00A35C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon glyph="Checkmark" fill="white" size="xsmall" />
                </div>
              )}
            </div>

            {/* Title */}
            <Body weight="medium" style={{
              fontSize: '11px',
              color: '#5C6C75',
              marginBottom: '8px',
              lineHeight: '1.3'
            }}>
              {scenario.description}
            </Body>

            {/* Badges Row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap'
            }}>
              <Badge variant={scenario.badgeVariant} style={{ fontSize: '9px' }}>
                {scenario.badge}
              </Badge>
              {scenario.isAgentic && (
                <Badge variant="purple" style={{ fontSize: '9px' }}>
                  AGENTIC
                </Badge>
              )}

              {/* Info Tooltip */}
              {scenario.info && (
                <Tooltip
                  trigger={
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'help',
                        marginLeft: 'auto'
                      }}
                    >
                      <Icon glyph="InfoWithCircle" size="small" fill="#889397" />
                    </div>
                  }
                  darkMode={false}
                >
                  <div style={{
                    maxWidth: '280px',
                    padding: '10px',
                    color: '#000000',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '6px'
                  }}>
                    {scenario.info.problem && (
                      <>
                        <strong style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                          Problem
                        </strong>
                        <p style={{ fontSize: '11px', marginBottom: '8px', lineHeight: '1.5', margin: '0 0 8px 0' }}>
                          {scenario.info.problem}
                        </p>
                      </>
                    )}
                    {scenario.info.solution && (
                      <>
                        <strong style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                          Solution
                        </strong>
                        <p style={{ fontSize: '11px', lineHeight: '1.5', margin: 0 }}>
                          {scenario.info.solution}
                        </p>
                      </>
                    )}
                    {scenario.info.process && (
                      <p style={{ fontSize: '11px', lineHeight: '1.5', margin: 0 }}>
                        {scenario.info.process}
                      </p>
                    )}
                  </div>
                </Tooltip>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
