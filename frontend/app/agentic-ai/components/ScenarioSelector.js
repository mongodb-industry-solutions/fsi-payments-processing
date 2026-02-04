'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Body } from '@leafygreen-ui/typography';
import Card from '@leafygreen-ui/card';
import Badge from '@leafygreen-ui/badge';
import Icon from '@leafygreen-ui/icon';
import Popover from '@leafygreen-ui/popover';

/**
 * ScenarioSelector Component - Compact Version
 * Displays pre-configured payment scenarios as selectable compact cards
 */
export default function ScenarioSelector({
  scenarios,
  selectedScenario,
  onSelectScenario,
  isStreaming,
  solanaStatus
}) {
  const [openPopover, setOpenPopover] = useState(null);
  const buttonRefs = useRef({});

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      // Check if click is outside any popover content
      const popoverContent = document.querySelector('[data-popover-content]');
      const clickedInfoIcon = event.target.closest('[data-info-trigger]');

      if (openPopover && !popoverContent?.contains(event.target) && !clickedInfoIcon) {
        setOpenPopover(null);
      }
    }

    if (openPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openPopover]);

  return (
    <>
    <div style={{ position: 'relative' }}>
      <div
        className="scenario-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
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
        const isPopoverOpen = openPopover === scenario.id;

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
            {/* Top Row: Route + Agentic Badge + Selection */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              {/* Country Route + Agentic Badge + Info Icon */}
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
                {scenario.isAgentic && (
                  <Badge variant="purple" style={{ fontSize: '10px', marginLeft: '4px' }}>
                    AGENTIC
                  </Badge>
                )}
                {/* Info Popover */}
                {scenario.info && (
                  <>
                    <div
                      ref={(el) => buttonRefs.current[scenario.id] = el}
                      data-info-trigger
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenPopover(isPopoverOpen ? null : scenario.id);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: '2px',
                        borderRadius: '4px',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Icon
                        glyph="InfoWithCircle"
                        size="small"
                        fill={isPopoverOpen ? '#00A35C' : '#889397'}
                      />
                    </div>
                    <Popover
                      active={isPopoverOpen}
                      refEl={buttonRefs.current[scenario.id]}
                      align="bottom"
                      justify="start"
                      spacing={8}
                      adjustOnMutation
                    >
                      <div
                        data-popover-content
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '300px',
                          backgroundColor: '#FFFFFF',
                          borderRadius: '8px',
                          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
                          border: '1px solid #E7EAEE',
                          padding: '16px'
                        }}
                      >
                        {scenario.info.problem && (
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{
                              fontSize: '11px',
                              fontWeight: '600',
                              color: '#5C6C75',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              marginBottom: '6px'
                            }}>
                              Problem
                            </div>
                            <p style={{
                              fontSize: '13px',
                              lineHeight: '1.5',
                              margin: 0,
                              color: '#1C2D38'
                            }}>
                              {scenario.info.problem}
                            </p>
                          </div>
                        )}
                        {scenario.info.solution && (
                          <div>
                            <div style={{
                              fontSize: '11px',
                              fontWeight: '600',
                              color: '#00A35C',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              marginBottom: '6px'
                            }}>
                              Solution
                            </div>
                            <p style={{
                              fontSize: '13px',
                              lineHeight: '1.5',
                              margin: 0,
                              color: '#1C2D38'
                            }}>
                              {scenario.info.solution}
                            </p>
                          </div>
                        )}
                        {scenario.info.process && (
                          <div>
                            <div style={{
                              fontSize: '11px',
                              fontWeight: '600',
                              color: '#5C6C75',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              marginBottom: '6px'
                            }}>
                              Process
                            </div>
                            <p style={{
                              fontSize: '13px',
                              lineHeight: '1.5',
                              margin: 0,
                              color: '#1C2D38'
                            }}>
                              {scenario.info.process}
                            </p>
                          </div>
                        )}
                      </div>
                    </Popover>
                  </>
                )}
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
              gap: '6px',
              flexWrap: 'wrap'
            }}>
              <Badge variant={scenario.badgeVariant} style={{ fontSize: 'var(--font-xs, 11px)', whiteSpace: 'nowrap' }}>
                {scenario.badge}
              </Badge>
              {scenario.isCryptoSettlement && solanaStatus && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: solanaStatus === 'healthy' ? '#F0FDF4' : solanaStatus === 'down' ? '#FEF2F2' : '#F9FAFB',
                  border: `1px solid ${solanaStatus === 'healthy' ? '#BBF7D0' : solanaStatus === 'down' ? '#FECACA' : '#E5E7EB'}`
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: solanaStatus === 'healthy' ? '#22C55E' : solanaStatus === 'down' ? '#EF4444' : '#9CA3AF',
                    animation: solanaStatus === 'checking' ? 'pulse 1.5s infinite' : 'none'
                  }} />
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '600',
                    color: solanaStatus === 'healthy' ? '#16A34A' : solanaStatus === 'down' ? '#DC2626' : '#6B7280',
                    letterSpacing: '0.5px'
                  }}>
                    {solanaStatus === 'healthy' ? 'DEVNET LIVE' : solanaStatus === 'down' ? 'DEVNET DOWN' : 'CHECKING'}
                  </span>
                </div>
              )}
              {scenario.mongoFeature && (
                <Badge variant="green" style={{ fontSize: 'var(--font-xs, 11px)', whiteSpace: 'nowrap' }}>
                  {scenario.mongoFeature}
                </Badge>
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
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
    `}</style>
    </>
  );
}
