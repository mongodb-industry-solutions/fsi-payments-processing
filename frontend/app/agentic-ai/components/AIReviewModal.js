'use client';

import React, { useState } from 'react';
import { H3, Body } from '@leafygreen-ui/typography';
import Modal from '@leafygreen-ui/modal';
import Button from '@leafygreen-ui/button';
import Icon from '@leafygreen-ui/icon';
import Badge from '@leafygreen-ui/badge';

/**
 * AIReviewModal Component
 * Shows AI-extracted fields for human review before proceeding with conversion
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Callback to close modal (on cancel)
 * @param {Function} props.onApprove - Callback when approved (receives corrections object or null)
 * @param {Function} props.onReject - Callback when rejected
 * @param {Object} props.reviewData - Data from ai_review_required event
 * @param {boolean} props.isSubmitting - Whether submit is in progress
 */
export default function AIReviewModal({
  isOpen,
  onClose,
  onApprove,
  onReject,
  reviewData = {},
  isSubmitting = false
}) {
  // Track expanded field details
  const [expandedFields, setExpandedFields] = useState(new Set());

  // Handle null reviewData
  const safeReviewData = reviewData || {};
  const {
    fields = [],
    message = 'AI-processed fields require human verification'
  } = safeReviewData;

  const toggleFieldExpand = (index) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleApprove = () => {
    // For now, just approve without corrections
    // Could be extended to support inline editing
    onApprove(null);
  };

  const handleReject = () => {
    onReject();
  };

  // Format field type for display
  const formatFieldType = (fieldType) => {
    const typeMap = {
      'remittance': 'Remittance Info',
      'instructions': 'Bank Instructions',
      'merchantInfo': 'Merchant Details',
      'purpose': 'Payment Purpose'
    };
    return typeMap[fieldType] || fieldType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
  };

  // Get confidence color
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.85) return '#00A35C';
    if (confidence >= 0.7) return '#FFC107';
    return '#CD4246';
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
              background: '#E3F2FD',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon glyph="Sparkle" fill="#1565C0" size="large" />
            </div>
            <div>
              <H3 style={{ margin: 0 }}>AI Extraction Review</H3>
              <Body style={{ fontSize: '12px', color: '#889397' }}>
                {message}
              </Body>
            </div>
          </div>

          {/* Info Banner */}
          <div style={{
            padding: '12px',
            background: '#FFF8E6',
            border: '1px solid #FFE082',
            borderRadius: '6px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <Icon glyph="InfoWithCircle" fill="#F57C00" size="small" style={{ marginTop: '2px' }} />
            <Body style={{ fontSize: '12px', color: '#E65100', margin: 0 }}>
              The AI extracted data from unstructured payment fields. Review the extractions below before the conversion proceeds to the target format.
            </Body>
          </div>

          {/* Fields List */}
          <div style={{ marginBottom: '20px', maxHeight: '400px', overflowY: 'auto' }}>
            {fields.length === 0 ? (
              <Body style={{ color: '#889397', fontStyle: 'italic' }}>No fields to review</Body>
            ) : (
              fields.map((field, index) => (
                <div
                  key={index}
                  style={{
                    border: '1px solid #E7EAEE',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    overflow: 'hidden'
                  }}
                >
                  {/* Field Header - Clickable */}
                  <div
                    onClick={() => toggleFieldExpand(index)}
                    style={{
                      padding: '12px',
                      background: '#F9FBFA',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <Badge variant="blue">{formatFieldType(field.field_type)}</Badge>
                      <Body style={{ fontSize: '12px', color: '#5C6C75' }}>
                        Field {field.source_field || index + 1}
                      </Body>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Icon
                        glyph={expandedFields.has(index) ? 'ChevronUp' : 'ChevronDown'}
                        fill="#889397"
                        size="small"
                      />
                    </div>
                  </div>

                  {/* Field Details - Expandable */}
                  {expandedFields.has(index) && (
                    <div style={{ padding: '12px', borderTop: '1px solid #E7EAEE' }}>
                      {/* Original Input */}
                      <div style={{ marginBottom: '12px' }}>
                        <Body weight="medium" style={{ fontSize: '11px', color: '#889397', marginBottom: '4px' }}>
                          ORIGINAL INPUT
                        </Body>
                        <div style={{
                          padding: '8px 10px',
                          background: '#FAFAFA',
                          border: '1px solid #E0E0E0',
                          borderRadius: '4px',
                          fontFamily: 'Monaco, Consolas, monospace',
                          fontSize: '12px',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {field.input_text || '(no input)'}
                        </div>
                      </div>

                      {/* AI Extraction */}
                      <div>
                        <Body weight="medium" style={{ fontSize: '11px', color: '#889397', marginBottom: '4px' }}>
                          AI EXTRACTION
                        </Body>
                        <div style={{
                          padding: '8px 10px',
                          background: '#E8F5E9',
                          border: '1px solid #C8E6C9',
                          borderRadius: '4px',
                          fontFamily: 'Monaco, Consolas, monospace',
                          fontSize: '12px',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {typeof field.ai_response === 'object'
                            ? JSON.stringify(field.ai_response, null, 2)
                            : field.ai_response || '(no extraction)'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Summary */}
          <div style={{
            padding: '12px',
            background: '#F5F7FA',
            borderRadius: '6px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Body style={{ fontSize: '12px', color: '#5C6C75' }}>
              <strong>{fields.length}</strong> field{fields.length !== 1 ? 's' : ''} extracted by AI
            </Body>
            <Body style={{ fontSize: '11px', color: '#889397' }}>
              Click fields above to expand details
            </Body>
          </div>

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
              {isSubmitting ? 'Processing...' : 'Approve & Continue'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
