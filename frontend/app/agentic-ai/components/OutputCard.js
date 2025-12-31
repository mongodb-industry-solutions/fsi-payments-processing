'use client';

import React, { useState } from 'react';
import { H3, Body } from '@leafygreen-ui/typography';
import Button from '@leafygreen-ui/button';
import Icon from '@leafygreen-ui/icon';
import Badge from '@leafygreen-ui/badge';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * Format XML with basic indentation
 */
function formatXML(xml) {
  const PADDING = '  ';
  const reg = /(>)(<)(\/*)/g;
  let pad = 0;

  xml = xml.replace(reg, '$1\n$2$3');

  return xml.split('\n').map((node) => {
    let indent = 0;
    if (node.match(/.+<\/\w[^>]*>$/)) {
      indent = 0;
    } else if (node.match(/^<\/\w/)) {
      if (pad !== 0) {
        pad -= 1;
      }
    } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
      indent = 1;
    } else {
      indent = 0;
    }

    const padding = PADDING.repeat(pad);
    pad += indent;

    return padding + node;
  }).join('\n');
}

/**
 * Detect content type (XML or JSON)
 */
function detectContentType(content) {
  const trimmed = content.trim();
  if (trimmed.startsWith('<')) return 'xml';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  return 'text';
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

/**
 * Download text as file
 */
function downloadAsFile(content, filename) {
  const blob = new Blob([content], { type: 'text/xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * OutputCard Component
 * Displays conversion output as an expandable card with copy/download functionality
 *
 * @param {Object} props
 * @param {string} props.output - The converted message output (XML/JSON)
 * @param {Object} props.stats - Processing statistics (optional)
 * @param {number} props.totalTime - Total processing time in seconds
 * @param {string} props.targetFormat - Target format name
 */
export default function OutputCard({ output, stats, totalTime, targetFormat }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(output);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleDownload = () => {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `conversion_${targetFormat}_${timestamp}.xml`;
    downloadAsFile(output, filename);
  };

  const formattedOutput = formatXML(output);
  const previewLines = formattedOutput.split('\n').slice(0, 5).join('\n');

  return (
    <div
      style={{
        marginTop: '16px',
        padding: '16px',
        background: 'linear-gradient(135deg, #E3FCF7 0%, #F9FBFA 100%)',
        border: '2px solid #00A35C',
        borderRadius: '12px'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isExpanded ? '16px' : '0',
          cursor: 'pointer'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Icon glyph="CheckmarkWithCircle" fill="#00A35C" size="large" />
          <div>
            <H3>Payment Complete</H3>
            <Body style={{ fontSize: '12px', color: '#5C6C75', marginTop: '2px' }}>
              Processed in {totalTime?.toFixed(2)}s
            </Body>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Badge variant="green">Success</Badge>
          <Icon
            glyph={isExpanded ? 'ChevronUp' : 'ChevronDown'}
            fill="#889397"
          />
        </div>
      </div>

      {/* Stats Summary (collapsed view) */}
      {!isExpanded && stats && (
        <div style={{
          display: 'flex',
          gap: '16px',
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(0, 163, 92, 0.2)'
        }}>
          {stats.hops_executed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon glyph="Refresh" size="small" fill="#00A35C" />
              <Body style={{ fontSize: '12px' }}>{stats.hops_executed} hops</Body>
            </div>
          )}
          {stats.agents_called && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon glyph="Person" size="small" fill="#00A35C" />
              <Body style={{ fontSize: '12px' }}>{stats.agents_called} agents</Body>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon glyph="Code" size="small" fill="#00A35C" />
            <Body style={{ fontSize: '12px' }}>{targetFormat}</Body>
          </div>
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div>
          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '12px'
          }}>
            <Button
              size="small"
              leftGlyph={<Icon glyph={copySuccess ? 'Checkmark' : 'Copy'} />}
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
            >
              {copySuccess ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              size="small"
              leftGlyph={<Icon glyph="Download" />}
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
            >
              Download
            </Button>
          </div>

          {/* Output Display with Syntax Highlighting */}
          <div style={{
            background: 'white',
            borderRadius: '6px',
            border: '1px solid #E7EAEE',
            overflow: 'hidden',
            maxHeight: '400px'
          }}>
            <SyntaxHighlighter
              language={detectContentType(output)}
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                padding: '16px',
                fontSize: '12px',
                lineHeight: '1.6',
                maxHeight: '400px',
                overflow: 'auto'
              }}
              showLineNumbers={false}
              wrapLines={true}
              wrapLongLines={true}
            >
              {formattedOutput}
            </SyntaxHighlighter>
          </div>

        </div>
      )}
    </div>
  );
}
