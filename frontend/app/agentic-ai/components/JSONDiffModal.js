'use client';

import React from 'react';
import { H3, Body } from '@leafygreen-ui/typography';
import Modal from '@leafygreen-ui/modal';

/**
 * Highlight changed fields in JSON
 */
function highlightJSON(jsonObj, changedFields) {
  if (!jsonObj) return [];
  
  const formatted = JSON.stringify(jsonObj, null, 2);
  const lines = formatted.split('\n');
  
  return lines.map((line, idx) => {
    // Check if this line contains any of the changed fields
    const isChanged = changedFields.some(field => {
      const fieldPattern = `"${field}"`;
      return line.includes(fieldPattern);
    });
    
    return {
      text: line,
      isChanged,
      key: idx
    };
  });
}

/**
 * JSONDiffModal Component
 * Shows side-by-side comparison of canonical JSON before and after agent updates
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Callback to close modal
 * @param {Object} props.beforeJSON - JSON before update
 * @param {Object} props.afterJSON - JSON after update
 * @param {Array} props.changedFields - List of changed field names
 */
export default function JSONDiffModal({ 
  isOpen, 
  onClose, 
  beforeJSON, 
  afterJSON, 
  changedFields = []
}) {
  const beforeLines = highlightJSON(beforeJSON, changedFields);
  const afterLines = highlightJSON(afterJSON, changedFields);

  return (
    <>
      <style jsx global>{`
        [data-testid="lg-modal"] {
          position: fixed !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          margin: 0 !important;
          width: 700px !important;
          max-width: 95vw !important;
          max-height: 90vh !important;
        }
        
        /* Transparent scrollbar */
        .json-diff-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .json-diff-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .json-diff-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
        .json-diff-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.2);
        }
      `}</style>
      <Modal
        open={isOpen}
        setOpen={onClose}
      >
        <div className="json-diff-scroll" style={{ padding: '20px', maxHeight: '85vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '16px' }}>
          <H3>Canonical JSON Document Changes</H3>
          <Body style={{ fontSize: '12px', color: '#889397', marginTop: '4px' }}>
            Field modified: <span style={{ fontWeight: '600', color: '#0B61A4' }}>{changedFields.join(', ')}</span>
          </Body>
        </div>

        {/* Vertical Comparison */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Before Update */}
          <div>
            <div style={{
              padding: '8px 12px',
              background: '#FFF3E0',
              borderRadius: '6px 6px 0 0',
              borderBottom: '2px solid #FF9800'
            }}>
              <Body weight="bold" style={{ fontSize: '13px', color: '#E65100' }}>
                Before Update
              </Body>
            </div>
            <div style={{
              background: '#FAFAFA',
              border: '1px solid #E7EAEE',
              borderTop: 'none',
              borderRadius: '0 0 6px 6px',
              padding: '12px'
            }}>
              <pre style={{
                margin: 0,
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                fontSize: '11px',
                lineHeight: '1.5',
                color: '#1C2D38'
              }}>
                {beforeLines.map(({ text, isChanged, key }) => (
                  <div
                    key={key}
                    style={{
                      backgroundColor: isChanged ? '#FFEBEE' : 'transparent',
                      padding: isChanged ? '2px 4px' : '0',
                      margin: isChanged ? '0 -4px' : '0',
                      borderRadius: '3px'
                    }}
                  >
                    {text}
                  </div>
                ))}
              </pre>
            </div>
          </div>

          {/* After Update */}
          <div>
            <div style={{
              padding: '8px 12px',
              background: '#E8F5E9',
              borderRadius: '6px 6px 0 0',
              borderBottom: '2px solid #4CAF50'
            }}>
              <Body weight="bold" style={{ fontSize: '13px', color: '#2E7D32' }}>
                After Update
              </Body>
            </div>
            <div style={{
              background: '#FAFAFA',
              border: '1px solid #E7EAEE',
              borderTop: 'none',
              borderRadius: '0 0 6px 6px',
              padding: '12px'
            }}>
              <pre style={{
                margin: 0,
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                fontSize: '11px',
                lineHeight: '1.5',
                color: '#1C2D38'
              }}>
                {afterLines.map(({ text, isChanged, key }) => (
                  <div
                    key={key}
                    style={{
                      backgroundColor: isChanged ? '#C8E6C9' : 'transparent',
                      padding: isChanged ? '2px 4px' : '0',
                      margin: isChanged ? '0 -4px' : '0',
                      borderRadius: '3px'
                    }}
                  >
                    {text}
                  </div>
                ))}
              </pre>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex',
          gap: '16px',
          padding: '8px 12px',
          background: '#F9FBFA',
          borderRadius: '4px',
          border: '1px solid #E7EAEE',
          marginTop: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              background: '#FFEBEE',
              border: '1px solid #E7EAEE',
              borderRadius: '2px'
            }} />
            <Body style={{ fontSize: '10px', color: '#5C6C75' }}>Old Value</Body>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              background: '#C8E6C9',
              border: '1px solid #E7EAEE',
              borderRadius: '2px'
            }} />
            <Body style={{ fontSize: '10px', color: '#5C6C75' }}>New Value</Body>
          </div>
        </div>
        </div>
      </Modal>
    </>
  );
}

