'use client';

import React from 'react';
import { H3, Body, Label } from '@leafygreen-ui/typography';
import Code from '@leafygreen-ui/code';
import Badge from '@leafygreen-ui/badge';

/**
 * BubbleDetailPanel Component
 * Displays detailed information based on bubble type
 *
 * @param {Object} props
 * @param {string} props.bubbleType - '1', 'A', '2', 'B', '3'
 * @param {Object} props.data - Relevant data for the bubble
 * @param {Object} props.stats - Processing statistics (for conversion bubbles)
 */
export default function BubbleDetailPanel({ bubbleType, data, stats }) {
  if (!bubbleType || !data) {
    return null;
  }

  // Message bubbles (1, 3)
  if (bubbleType === '1' || bubbleType === '3') {
    return (
      <div style={{
        background: 'white',
        border: '1px solid #E7EAEE',
        borderRadius: '8px',
        padding: '24px'
      }}>
        <H3 style={{ marginBottom: '16px' }}>
          {bubbleType === '1' ? 'Source Message' : 'Target Message'}
        </H3>

        <Label style={{
          fontSize: '12px',
          color: '#889397',
          display: 'block',
          marginBottom: '12px'
        }}>
          Format: {data.format}
        </Label>

        <div style={{
          background: '#F9FBFA',
          borderRadius: '6px',
          padding: '16px',
          border: '1px solid #E7EAEE',
          maxHeight: '500px',
          overflow: 'auto'
        }}>
          <Code
            language={data.format?.startsWith('MT') ? 'swift' : 'xml'}
            copyable={true}
          >
            {data.message || 'No message data available'}
          </Code>
        </div>
      </div>
    );
  }

  // Conversion bubbles (A, B)
  if (bubbleType === 'A' || bubbleType === 'B') {
    const hopNumber = data.hop || (bubbleType === 'A' ? 1 : 2);

    // Calculate lane distribution from stats if available
    const laneStats = stats?.lane_distribution || {};
    const rulesCount = laneStats.RULES || 0;
    const aiCount = laneStats.AI || 0;
    const humanCount = laneStats.HUMAN || 0;
    const totalFields = rulesCount + aiCount + humanCount;

    const rulesPercent = totalFields > 0 ? ((rulesCount / totalFields) * 100).toFixed(1) : 0;
    const aiPercent = totalFields > 0 ? ((aiCount / totalFields) * 100).toFixed(1) : 0;
    const humanPercent = totalFields > 0 ? ((humanCount / totalFields) * 100).toFixed(1) : 0;

    return (
      <div style={{
        background: 'white',
        border: '1px solid #E7EAEE',
        borderRadius: '8px',
        padding: '24px'
      }}>
        <H3 style={{ marginBottom: '16px' }}>
          Hop {hopNumber} Conversion Details
        </H3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          marginBottom: '24px'
        }}>
          {/* Conversion ID */}
          <div>
            <Label style={{
              fontSize: '12px',
              color: '#889397',
              display: 'block',
              marginBottom: '8px'
            }}>
              Conversion ID
            </Label>
            <Body weight="medium" style={{ fontSize: '14px' }}>
              {data.conversionId}
            </Body>
          </div>

          {/* Processing Time */}
          <div>
            <Label style={{
              fontSize: '12px',
              color: '#889397',
              display: 'block',
              marginBottom: '8px'
            }}>
              Processing Time
            </Label>
            <Body weight="medium" style={{ fontSize: '14px' }}>
              {data.time ? `${data.time.toFixed(2)}s` : 'N/A'}
            </Body>
          </div>
        </div>

        {/* Lane Distribution */}
        {totalFields > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <Label style={{
              fontSize: '12px',
              color: '#889397',
              display: 'block',
              marginBottom: '12px'
            }}>
              Processing Lane Distribution
            </Label>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <Badge variant="blue">
                RULES: {rulesPercent}%
              </Badge>
              <Badge variant="yellow">
                AI: {aiPercent}%
              </Badge>
              {humanCount > 0 && (
                <Badge variant="red">
                  HUMAN: {humanPercent}%
                </Badge>
              )}
            </div>

            {/* Visual Bar */}
            <div style={{
              width: '100%',
              height: '24px',
              background: '#F9FBFA',
              borderRadius: '4px',
              overflow: 'hidden',
              display: 'flex',
              border: '1px solid #E7EAEE'
            }}>
              {rulesCount > 0 && (
                <div style={{
                  width: `${rulesPercent}%`,
                  background: '#0B61A4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  color: 'white',
                  fontWeight: '600'
                }}>
                  {rulesCount}
                </div>
              )}
              {aiCount > 0 && (
                <div style={{
                  width: `${aiPercent}%`,
                  background: '#FFC010',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  color: '#1C2D38',
                  fontWeight: '600'
                }}>
                  {aiCount}
                </div>
              )}
              {humanCount > 0 && (
                <div style={{
                  width: `${humanPercent}%`,
                  background: '#CD4246',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  color: 'white',
                  fontWeight: '600'
                }}>
                  {humanCount}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary */}
        <div style={{
          background: '#F9FBFA',
          borderRadius: '6px',
          padding: '16px',
          border: '1px solid #E7EAEE'
        }}>
          <Label style={{
            fontSize: '12px',
            color: '#889397',
            display: 'block',
            marginBottom: '8px'
          }}>
            Summary
          </Label>
          <Body style={{ fontSize: '13px', lineHeight: '1.6' }}>
            Hop {hopNumber} processed {totalFields} field{totalFields !== 1 ? 's' : ''}
            {rulesCount > 0 && ` using ${rulesCount} rules-based mapping${rulesCount !== 1 ? 's' : ''}`}
            {aiCount > 0 && `, ${aiCount} AI extraction${aiCount !== 1 ? 's' : ''}`}
            {humanCount > 0 && `, and ${humanCount} field${humanCount !== 1 ? 's' : ''} requiring human review`}.
            {data.time && ` Total processing time: ${data.time.toFixed(2)} seconds.`}
          </Body>
        </div>
      </div>
    );
  }

  // JSON bubble (2)
  if (bubbleType === '2') {
    return (
      <div style={{
        background: 'white',
        border: '1px solid #E7EAEE',
        borderRadius: '8px',
        padding: '24px'
      }}>
        <H3 style={{ marginBottom: '16px' }}>
          Intermediate Canonical JSON
        </H3>

        <div style={{
          background: '#F9FBFA',
          borderRadius: '6px',
          padding: '16px',
          border: '1px solid #E7EAEE',
          marginBottom: '16px'
        }}>
          <Label style={{
            fontSize: '12px',
            color: '#889397',
            display: 'block',
            marginBottom: '8px'
          }}>
            Purpose
          </Label>
          <Body style={{ fontSize: '13px', lineHeight: '1.6' }}>
            The canonical JSON format serves as the universal intermediate format that enables
            multi-hop routing. All payment formats map to and from this standardized JSON structure,
            allowing seamless conversion between any source and target formats.
          </Body>
        </div>

        <div style={{
          background: '#FFF9E6',
          borderRadius: '6px',
          padding: '16px',
          border: '1px solid #FFC010'
        }}>
          <Label style={{
            fontSize: '12px',
            color: '#895D1A',
            display: 'block',
            marginBottom: '8px'
          }}>
            Note
          </Label>
          <Body style={{ fontSize: '13px', lineHeight: '1.6', color: '#895D1A' }}>
            To view the complete JSON structure and any agent corrections, the canonical JSON diff
            endpoint would be called here. This will show before/after states if the agent made
            any modifications (e.g., transliteration, IFSC lookup).
          </Body>
        </div>
      </div>
    );
  }

  return null;
}
