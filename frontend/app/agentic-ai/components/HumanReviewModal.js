'use client';

import React, { useState } from 'react';
import { H3, Body } from '@leafygreen-ui/typography';
import Modal from '@leafygreen-ui/modal';
import Button from '@leafygreen-ui/button';
import TextInput from '@leafygreen-ui/text-input';
import Icon from '@leafygreen-ui/icon';
import Badge from '@leafygreen-ui/badge';

/**
 * HumanReviewModal Component
 * Shows proposed agent change and allows human to approve, reject, or modify
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Callback to close modal (on cancel)
 * @param {Function} props.onApprove - Callback when approved (receives { modified_value?: string })
 * @param {Function} props.onReject - Callback when rejected
 * @param {Object} props.reviewData - Data from review_required event
 * @param {boolean} props.isSubmitting - Whether submit is in progress
 */
export default function HumanReviewModal({
  isOpen,
  onClose,
  onApprove,
  onReject,
  reviewData = {},
  isSubmitting = false
}) {
  const [modifiedValue, setModifiedValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Handle null reviewData (modal renders before data arrives)
  const safeReviewData = reviewData || {};
  const {
    problem = '',
    field = '',
    original_value = '',
    proposed_value = '',
    confidence = 0,
    reasoning = ''
  } = safeReviewData;

  // Derive task label from problem description
  const getTaskLabel = (problemText) => {
    if (!problemText) return 'Field Correction';
    const lowerProblem = problemText.toLowerCase();
    if (lowerProblem.includes('katakana') || lowerProblem.includes('japanese')) {
      return 'Japanese Transliteration';
    }
    if (lowerProblem.includes('ifsc') || lowerProblem.includes('india')) {
      return 'IFSC Code Lookup';
    }
    if (lowerProblem.includes('legal name') || lowerProblem.includes('verification')) {
      return 'Name Verification';
    }
    return 'Field Correction';
  };
  const taskLabel = getTaskLabel(problem);

  // Format field name for display. Canonical fields are camelCase; the fallback
  // splits camelCase into spaced Title Case (e.g. "creditorBank" → "Creditor Bank").
  const fieldLabel = field === 'creditorName'
    ? 'Beneficiary Name'
    : field === 'creditorBic'
    ? 'Bank Code (IFSC)'
    : field.replace(/([A-Z])/g, ' $1').replace(/^./, l => l.toUpperCase()).trim();

  const handleApprove = () => {
    if (isEditing && modifiedValue.trim()) {
      onApprove({ modified_value: modifiedValue.trim() });
    } else {
      onApprove({});
    }
  };

  const handleReject = () => {
    onReject();
  };

  const handleStartEdit = () => {
    setModifiedValue(proposed_value);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setModifiedValue('');
    setIsEditing(false);
  };

  return (
    <>
      <style jsx global>{`
        /* Position modal centered on screen */
        [data-testid="lg-modal"] {
          position: fixed !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          margin: 0 !important;
          width: 550px !important;
          max-width: 90vw !important;
          max-height: 90vh !important;
          box-shadow: 0 8px 32px rgba(0, 30, 43, 0.15), 0 4px 12px rgba(0, 30, 43, 0.1) !important;
        }
      `}</style>
      <Modal
        open={isOpen}
        setOpen={onClose}
      >
        <div style={{ padding: '4px' }}>
          {/* Header */}
          <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#FFF8E6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon glyph="Person" fill="#B7791F" size="large" />
            </div>
            <div>
              <H3 style={{ margin: 0 }}>Review Required</H3>
              <Body style={{ fontSize: '12px', color: '#889397' }}>
                Approve or modify the proposed change before execution
              </Body>
            </div>
          </div>

          {/* Task Info */}
          <div style={{
            padding: '12px',
            background: '#F9FBFA',
            borderRadius: '6px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '8px' }}>
              <Badge variant="blue">{taskLabel}</Badge>
              <Body style={{ fontSize: '12px', color: '#5C6C75' }}>
                Field: <span style={{ fontWeight: '600' }}>{fieldLabel}</span>
              </Body>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Body style={{ fontSize: '11px', color: '#889397' }}>
                Confidence: {(confidence * 100).toFixed(0)}%
              </Body>
              <div style={{
                flex: 1,
                height: '4px',
                background: '#E7EAEE',
                borderRadius: '2px',
                maxWidth: '100px'
              }}>
                <div style={{
                  width: `${confidence * 100}%`,
                  height: '100%',
                  background: confidence >= 0.8 ? '#00A35C' : confidence >= 0.6 ? '#FFC107' : '#CD4246',
                  borderRadius: '2px'
                }} />
              </div>
            </div>
          </div>

          {/* Value Comparison */}
          <div style={{ marginBottom: '16px' }}>
            {/* Original Value */}
            <div style={{ marginBottom: '12px' }}>
              <Body weight="medium" style={{ fontSize: '12px', color: '#5C6C75', marginBottom: '4px' }}>
                Current Value
              </Body>
              <div style={{
                padding: '10px 12px',
                background: '#FFEBEE',
                border: '1px solid #FFCDD2',
                borderRadius: '6px',
                fontFamily: 'Monaco, Consolas, monospace',
                fontSize: '13px',
                color: '#C62828'
              }}>
                {original_value || '(empty)'}
              </div>
            </div>

            {/* Arrow */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
              <Icon glyph="ArrowDown" fill="#889397" size="small" />
            </div>

            {/* Proposed Value */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <Body weight="medium" style={{ fontSize: '12px', color: '#5C6C75' }}>
                  {isEditing ? 'Your Modified Value' : 'Proposed Value'}
                </Body>
                {!isEditing && (
                  <button
                    onClick={handleStartEdit}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0B61A4',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Icon glyph="Edit" size="small" />
                    Edit
                  </button>
                )}
              </div>

              {isEditing ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <TextInput
                    label="Modified value"
                    hideLabel={true}
                    value={modifiedValue}
                    onChange={(e) => setModifiedValue(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Button size="small" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div style={{
                  padding: '10px 12px',
                  background: '#E8F5E9',
                  border: '1px solid #C8E6C9',
                  borderRadius: '6px',
                  fontFamily: 'Monaco, Consolas, monospace',
                  fontSize: '13px',
                  color: '#2E7D32'
                }}>
                  {proposed_value || '(empty)'}
                </div>
              )}
            </div>
          </div>

          {/* Reasoning */}
          {reasoning && (
            <div style={{ marginBottom: '20px' }}>
              <Body weight="medium" style={{ fontSize: '12px', color: '#5C6C75', marginBottom: '4px' }}>
                Agent Reasoning
              </Body>
              <div style={{
                padding: '10px 12px',
                background: '#F9FBFA',
                border: '1px solid #E7EAEE',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#5C6C75',
                lineHeight: '1.5',
                maxHeight: '180px',
                overflow: 'auto'
              }}>
                {reasoning}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            paddingTop: '16px',
            borderTop: '1px solid #E7EAEE'
          }}>
            <Button
              variant="danger"
              onClick={handleReject}
              disabled={isSubmitting}
            >
              Reject
            </Button>
            <Button
              variant="primary"
              onClick={handleApprove}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Applying...' : isEditing ? 'Approve with Edit' : 'Approve'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
