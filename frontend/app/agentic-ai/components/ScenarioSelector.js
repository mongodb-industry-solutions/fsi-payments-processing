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
    <>
    <div style={{ position: 'relative' }}>
      <div
        className="scenario-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-md, 16px)',
          maxHeight: '280px',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0, 0, 0, 0.2) transparent',
          padding: '4px'
        }}
      >
      {scenarios.map((scenario) => {
        const isSelected = scenario.id === selectedScenario;
        return (
          <Card
            key={scenario.id}
            as="div"
            onClick={() => onSelectScenario(scenario.id)}
            style={{
              padding: 'var(--space-lg, 18px)',
              border: isSelected ? '2px solid #00A35C' : '1px solid #E7EAEE',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              backgroundColor: isSelected ? '#F0FDF4' : 'white',
              boxShadow: isSelected
                ? '0 4px 12px rgba(0, 163, 92, 0.15), 0 2px 4px rgba(0, 163, 92, 0.1)'
                : '0 1px 3px rgba(0, 0, 0, 0.04)',
              width: '100%',
              transform: isSelected ? 'translateY(-1px)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = '#00A35C';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = '#E7EAEE';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)';
                e.currentTarget.style.transform = 'none';
              }
            }}
          >
            {/* Top Row: Route + Selection */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              {/* Country Route */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Body style={{ fontSize: 'var(--font-base, 15px)', fontWeight: '700', color: '#1C2D38' }}>
                  {scenario.sourceCountry.code}
                </Body>
                <Icon glyph="ArrowRight" size="small" fill="#5C6C75" />
                <Body style={{ fontSize: 'var(--font-base, 15px)', fontWeight: '700', color: '#1C2D38' }}>
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

            {/* Description */}
            <Body style={{
              fontSize: 'var(--font-sm, 13px)',
              color: '#4A5568',
              marginBottom: '10px',
              lineHeight: '1.5',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {scenario.description}
            </Body>

            {/* Badges Row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap'
            }}>
              <Badge variant={scenario.badgeVariant} style={{ fontSize: 'var(--font-xs, 11px)' }}>
                {scenario.badge}
              </Badge>
              {scenario.isAgentic && (
                <Badge variant="purple" style={{ fontSize: 'var(--font-xs, 11px)' }}>
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
    </div>
    <style jsx>{`
      .scenario-grid::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      .scenario-grid::-webkit-scrollbar-track {
        background: transparent;
      }
      .scenario-grid::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 3px;
      }
      .scenario-grid::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.3);
      }
    `}</style>
    </>
  );
}
