'use client';

import React from 'react';
import { Body } from '@leafygreen-ui/typography';
import Card from '@leafygreen-ui/card';
import Badge from '@leafygreen-ui/badge';
import Icon from '@leafygreen-ui/icon';
import Tooltip from '@leafygreen-ui/tooltip';

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
        {scenarios.map((scenario) => {
          const isSelected = scenario.id === selectedScenario;
          return (
          <Card
            key={scenario.id}
            as="button"
            onClick={() => onSelectScenario(scenario.id)}
            style={{
              padding: '12px',
              cursor: 'pointer',
              border: isSelected ? '2px solid #00A35C' : '2px solid #E7EAEE',
              transition: 'all 0.2s ease',
              textAlign: 'left',
              position: 'relative',
              backgroundColor: isSelected ? '#F0F8F4' : 'white',
              boxShadow: isSelected ? '0 4px 12px rgba(0, 163, 92, 0.25)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = '#00A35C';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 163, 92, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = '#E7EAEE';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {/* Selection Checkmark */}
            {isSelected && (
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#00A35C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon glyph="Checkmark" fill="white" size="small" />
              </div>
            )}
            
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: '8px',
              gap: '8px',
              paddingRight: isSelected ? '32px' : '0'
            }}>
              <Body weight="medium" style={{ fontSize: '13px', flex: 1 }}>{scenario.title}</Body>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {scenario.info && (
                  <Tooltip
                    trigger={
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'help'
                        }}
                      >
                        <Icon glyph="InfoWithCircle" size="small" fill="#0B61A4" />
                      </div>
                    }
                    darkMode={false}
                  >
                    <div style={{ 
                      maxWidth: '300px', 
                      padding: '12px', 
                      color: '#000000',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '6px'
                    }}>
                      <strong style={{ 
                        display: 'block',
                        fontSize: '12px', 
                        marginBottom: '8px', 
                        color: '#000000'
                      }}>
                        Problem
                      </strong>
                      <p style={{ 
                        fontSize: '12px', 
                        marginBottom: '12px', 
                        lineHeight: '1.6', 
                        color: '#000000',
                        margin: '0 0 12px 0'
                      }}>
                        {scenario.info.problem}
                      </p>
                      <strong style={{ 
                        display: 'block',
                        fontSize: '12px', 
                        marginBottom: '8px', 
                        color: '#000000'
                      }}>
                        Agent Solution
                      </strong>
                      <p style={{ 
                        fontSize: '12px', 
                        marginBottom: '12px', 
                        lineHeight: '1.6', 
                        color: '#000000',
                        margin: '0 0 12px 0'
                      }}>
                        {scenario.info.solution}
                      </p>
                      <em style={{ 
                        display: 'block',
                        fontSize: '11px', 
                        color: '#5C6C75', 
                        lineHeight: '1.5',
                        borderTop: '1px solid #E7EAEE',
                        paddingTop: '8px',
                        marginTop: '4px'
                      }}>
                        {scenario.info.whyAgent}
                      </em>
                    </div>
                  </Tooltip>
                )}
                <Badge variant={scenario.badgeVariant}>{scenario.badge}</Badge>
              </div>
            </div>

            {/* Country Route */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 8px',
              background: '#F9FBFA',
              borderRadius: '4px'
            }}>
              {/* Source Country */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#00A35C'
                }} />
                <Body style={{ fontSize: '11px', fontWeight: '600', color: '#1C2D38' }}>
                  {scenario.sourceCountry.code}
                </Body>
              </div>
              
              <Icon glyph="ArrowRight" size="small" fill="#889397" />
              
              {/* Target Country */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#0B61A4'
                }} />
                <Body style={{ fontSize: '11px', fontWeight: '600', color: '#1C2D38' }}>
                  {scenario.targetCountry.code}
                </Body>
              </div>
            </div>
          </Card>
          );
        })}

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
