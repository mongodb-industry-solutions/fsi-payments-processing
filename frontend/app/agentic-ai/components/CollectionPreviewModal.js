'use client';

import React from 'react';
import { H3, Body } from '@leafygreen-ui/typography';
import Modal from '@leafygreen-ui/modal';

/**
 * Format collection name for display: snake_case → Title Case
 */
function formatCollectionName(name) {
  return name
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * CollectionPreviewModal
 * Shows sample documents from a MongoDB collection the agent queries.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {string} props.collectionName
 * @param {Array} props.documents - Array of plain objects
 */
export default function CollectionPreviewModal({
  isOpen,
  onClose,
  collectionName,
  documents = [],
}) {
  return (
    <>
      <style jsx global>{`
        [data-testid="lg-modal"].collection-preview-modal {
          position: fixed !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          margin: 0 !important;
          width: 640px !important;
          max-width: 95vw !important;
          max-height: 90vh !important;
        }
        .collection-preview-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .collection-preview-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .collection-preview-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
        .collection-preview-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.2);
        }
      `}</style>
      <Modal open={isOpen} setOpen={onClose} className="collection-preview-modal">
        <div
          className="collection-preview-scroll"
          style={{ padding: '20px', maxHeight: '85vh', overflowY: 'auto' }}
        >
          {/* Header */}
          <div style={{ marginBottom: '16px' }}>
            <H3>MongoDB Collection Preview</H3>
            <Body style={{ fontSize: '12px', color: '#889397', marginTop: '4px' }}>
              Showing {documents.length} sample document{documents.length !== 1 ? 's' : ''} from{' '}
              <span style={{ fontWeight: '600', color: '#00684A' }}>
                {formatCollectionName(collectionName || '')}
              </span>
            </Body>
          </div>

          {/* Documents */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {documents.map((doc, idx) => (
              <div key={idx}>
                <div
                  style={{
                    padding: '6px 12px',
                    background: '#E8F5E9',
                    borderRadius: '6px 6px 0 0',
                    borderBottom: '2px solid #00684A',
                  }}
                >
                  <Body weight="bold" style={{ fontSize: '12px', color: '#00684A' }}>
                    Document {idx + 1}
                  </Body>
                </div>
                <div
                  style={{
                    background: '#FAFAFA',
                    border: '1px solid #E7EAEE',
                    borderTop: 'none',
                    borderRadius: '0 0 6px 6px',
                    padding: '12px',
                  }}
                >
                  <pre
                    style={{
                      margin: 0,
                      fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                      fontSize: '11px',
                      lineHeight: '1.5',
                      color: '#1C2D38',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {JSON.stringify(doc, null, 2)}
                  </pre>
                </div>
              </div>
            ))}

            {documents.length === 0 && (
              <Body style={{ fontSize: '12px', color: '#889397', textAlign: 'center', padding: '24px' }}>
                No documents found in this collection.
              </Body>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
