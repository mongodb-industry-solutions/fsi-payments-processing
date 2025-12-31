'use client';

import React, { useState, useEffect } from 'react';
import { Body, Label } from '@leafygreen-ui/typography';
import BubbleDetailPanel from './BubbleDetailPanel';

/**
 * ConversionFlowPipeline Component
 * Displays a horizontal flow of conversion bubbles with clickable details
 *
 * @param {Object} props
 * @param {string} props.sourceFormat - Source format (e.g., "MT103")
 * @param {string} props.targetFormat - Target format (e.g., "pacs.008")
 * @param {string} props.sourceMessage - Original input message
 * @param {string} props.targetMessage - Final output message
 * @param {Array} props.events - All SSE events from conversion
 * @param {Object} props.stats - Processing statistics
 * @param {number} props.totalTime - Total processing time
 * @param {Object} props.hop1Details - Detailed processing for Hop 1
 * @param {Object} props.hop2Details - Detailed processing for Hop 2
 */
export default function ConversionFlowPipeline({
  sourceFormat,
  targetFormat,
  sourceMessage,
  targetMessage,
  events = [],
  stats = null,
  totalTime = 0,
  hop1Details = null,
  hop2Details = null,
  conversionRunId = null
}) {
  const [selectedBubble, setSelectedBubble] = useState(null);

  // Extract hop times from events
  const hop1CompleteEvent = events.find(e => e.type === 'hop1_complete');
  const hop2CompleteEvent = events.find(e => e.type === 'hop2_complete');

  const hop1Time = hop1CompleteEvent?.time || 0;
  const hop2Time = hop2CompleteEvent?.time || 0;

  // Debug logging
  console.log('🔍 ConversionFlowPipeline - hop1Details:', hop1Details);
  console.log('🔍 ConversionFlowPipeline - hop2Details:', hop2Details);

  // Define bubble configurations
  const bubbles = [
    {
      id: '1',
      type: 'message',
      label: 'Source',
      sublabel: sourceFormat,
      color: '#00A35C',
      data: { message: sourceMessage, format: sourceFormat }
    },
    {
      id: 'A',
      type: 'conversion',
      label: 'Stage 1',
      sublabel: `${sourceFormat} → JSON`,
      color: '#0B61A4',
      data: {
        conversionId: `${sourceFormat}_to_JSON`,
        time: hop1Time,
        hop: 1,
        detailed: hop1Details
      }
    },
    {
      id: '2',
      type: 'json',
      label: 'JSON',
      sublabel: 'Canonical',
      color: '#FFC010',
      data: {
        format: 'JSON',
        conversionRunId: conversionRunId
      }
    },
    {
      id: 'B',
      type: 'conversion',
      label: 'Stage 2',
      sublabel: `JSON → ${targetFormat}`,
      color: '#0B61A4',
      data: {
        conversionId: `JSON_to_${targetFormat}`,
        time: hop2Time,
        hop: 2,
        detailed: hop2Details
      }
    },
    {
      id: '3',
      type: 'message',
      label: 'Target',
      sublabel: targetFormat,
      color: '#13AA52',
      data: { message: targetMessage, format: targetFormat }
    }
  ];

  const handleBubbleClick = (bubbleId) => {
    setSelectedBubble(selectedBubble === bubbleId ? null : bubbleId);
  };

  return (
    <>
      <style jsx global>{`
        .pipeline-scrollable::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .pipeline-scrollable::-webkit-scrollbar-track {
          background: transparent;
        }
        .pipeline-scrollable::-webkit-scrollbar-thumb {
          background: rgba(136, 147, 151, 0.2);
          border-radius: 4px;
        }
        .pipeline-scrollable::-webkit-scrollbar-thumb:hover {
          background: rgba(136, 147, 151, 0.4);
        }
        /* Firefox */
        .pipeline-scrollable {
          scrollbar-width: thin;
          scrollbar-color: rgba(136, 147, 151, 0.2) transparent;
        }
      `}</style>
    <div className="pipeline-scrollable" style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto'
    }}>
      {/* Pipeline Flow - Compact at top */}
      <div style={{
        padding: '24px',
        borderBottom: '1px solid #E7EAEE',
        background: 'white'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px'
        }}>
          {bubbles.map((bubble, index) => (
            <React.Fragment key={bubble.id}>
              {/* Bubble */}
              <div
                onClick={() => handleBubbleClick(bubble.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  transform: selectedBubble === bubble.id ? 'scale(1.1)' : 'scale(1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = selectedBubble === bubble.id ? 'scale(1.1)' : 'scale(1)';
                }}
              >
                {/* Bubble Circle */}
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: selectedBubble === bubble.id ? `3px solid ${bubble.color}` : `2px solid #E7EAEE`,
                  background: selectedBubble === bubble.id ? `${bubble.color}15` : 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: '700',
                  color: selectedBubble === bubble.id ? bubble.color : '#5C6C75',
                  transition: 'all 0.2s',
                  boxShadow: selectedBubble === bubble.id ? `0 4px 8px ${bubble.color}30` : 'none'
                }}>
                  {bubble.id}
                </div>

                {/* Bubble Label */}
                <div style={{
                  marginTop: '8px',
                  textAlign: 'center'
                }}>
                  <Label style={{
                    fontSize: '11px',
                    color: '#1C2D38',
                    fontWeight: '600',
                    display: 'block',
                    marginBottom: '2px'
                  }}>
                    {bubble.label}
                  </Label>
                  <Label style={{
                    fontSize: '10px',
                    color: '#889397',
                    display: 'block'
                  }}>
                    {bubble.sublabel}
                  </Label>
                </div>
              </div>

              {/* Flow Arrow */}
              {index < bubbles.length - 1 && (
                <div style={{
                  width: '40px',
                  height: '2px',
                  background: '#E7EAEE',
                  position: 'relative',
                  marginBottom: '32px'
                }}>
                  {/* Arrow Head */}
                  <div style={{
                    position: 'absolute',
                    right: '-4px',
                    top: '-3px',
                    width: '0',
                    height: '0',
                    borderTop: '4px solid transparent',
                    borderBottom: '4px solid transparent',
                    borderLeft: '6px solid #E7EAEE'
                  }} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="pipeline-scrollable" style={{
        flex: 1,
        padding: '24px',
        overflow: 'auto',
        background: '#F9FBFA'
      }}>
        {selectedBubble ? (
          <BubbleDetailPanel
            bubbleType={selectedBubble}
            data={bubbles.find(b => b.id === selectedBubble)?.data}
            stats={stats}
          />
        ) : (
          <div style={{
            textAlign: 'center',
            paddingTop: '60px',
            color: '#889397'
          }}>
            <Body>Click on a bubble above to view details</Body>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
