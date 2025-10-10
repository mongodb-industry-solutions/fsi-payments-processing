'use client';

import { useState, useMemo, useEffect } from 'react';
import TextInput from '@leafygreen-ui/text-input';
import Icon from '@leafygreen-ui/icon';
import Badge from '@leafygreen-ui/badge';
import { H2, Body } from '@leafygreen-ui/typography';
import { MESSAGE_LIBRARY, MESSAGE_CATEGORIES, searchMessages, getMessagesByCategory } from '../../data/messageLibrary';
import styles from './MessageBrowser.module.css';

export default function MessageBrowser({ isOpen, onClose, onSelectMessage }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Filter messages based on category and search
  const filteredMessages = useMemo(() => {
    let messages = MESSAGE_LIBRARY;

    // Filter by category
    if (activeCategory !== 'all') {
      messages = getMessagesByCategory(activeCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      messages = searchMessages(searchQuery);
    }

    return messages;
  }, [activeCategory, searchQuery]);

  const handleSelectMessage = (message) => {
    onSelectMessage(message);
    handleClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    setActiveCategory('all');
    setSelectedMessage(null);
    onClose();
  };

  const getCategoryColor = (categoryId) => {
    const category = MESSAGE_CATEGORIES.find(c => c.id === categoryId);
    return category?.color || '#667085';
  };

  // Don't render anything if not open
  if (!isOpen) return null;

  return (
    <>
      {/* Custom backdrop */}
      <div className={styles.backdrop} onClick={handleClose} />

      {/* Custom Modal */}
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <Icon glyph="Folder" size="large" className={styles.headerIcon} />
            <div className={styles.headerText}>
              <H2 className={styles.title}>Browse Sample Messages</H2>
              <Body className={styles.subtitle}>
                Select a payment message from our curated library to auto-configure
              </Body>
            </div>
          </div>
          <button className={styles.closeButton} onClick={handleClose} aria-label="Close">
            <Icon glyph="X" size="small" />
          </button>
        </div>

        {/* Search Bar */}
        <div className={styles.searchBar}>
          <TextInput
            type="search"
            placeholder="Search by format, name, or tag (e.g., MT103, cross-border, swift)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search messages"
            sizeVariant="large"
          />
        </div>

        {/* Category Tabs */}
        <div className={styles.categoryTabs}>
          <button
            className={`${styles.categoryTab} ${activeCategory === 'all' ? styles.active : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            <span className={styles.tabText}>All Messages</span>
            <span className={styles.tabCount}>{MESSAGE_LIBRARY.length}</span>
          </button>
          {MESSAGE_CATEGORIES.map(category => {
            const count = getMessagesByCategory(category.id).length;
            return (
              <button
                key={category.id}
                className={`${styles.categoryTab} ${activeCategory === category.id ? styles.active : ''}`}
                onClick={() => setActiveCategory(category.id)}
                style={{
                  '--category-color': category.color
                }}
              >
                <span className={styles.tabText}>{category.name}</span>
                <span className={styles.tabCount}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Message List (File Explorer Style) */}
        <div className={styles.messageList}>
          {filteredMessages.length === 0 ? (
            <div className={styles.emptyState}>
              <Icon glyph="ImportantWithCircle" size="xlarge" />
              <Body className={styles.emptyText}>
                {searchQuery
                  ? `No messages found matching "${searchQuery}"`
                  : 'No messages in this category'}
              </Body>
              <Body className={styles.emptyHint}>
                Try searching with different keywords or select a different category
              </Body>
            </div>
          ) : (
            <>
              {/* List Header */}
              <div className={styles.listHeader}>
                <div className={styles.headerColumn} style={{ flex: '2' }}>Name</div>
                <div className={styles.headerColumn} style={{ flex: '1' }}>Format</div>
                <div className={styles.headerColumn} style={{ flex: '2' }}>Description</div>
                <div className={styles.headerColumn} style={{ flex: '1' }}>Use Case</div>
              </div>

              {/* List Rows */}
              <div className={styles.listBody}>
                {filteredMessages.map(message => (
                  <div
                    key={message.id}
                    className={`${styles.listRow} ${selectedMessage?.id === message.id ? styles.selected : ''}`}
                    onClick={() => setSelectedMessage(message)}
                    onDoubleClick={() => handleSelectMessage(message)}
                  >
                    <div className={styles.rowColumn} style={{ flex: '2' }}>
                      <Icon glyph="File" className={styles.fileIcon} />
                      <span className={styles.fileName}>{message.name}</span>
                    </div>
                    <div className={styles.rowColumn} style={{ flex: '1' }}>
                      <Badge
                        variant="lightgray"
                        className={styles.formatBadge}
                        style={{ borderLeft: `3px solid ${getCategoryColor(message.category)}` }}
                      >
                        {message.sourceFormat}
                      </Badge>
                    </div>
                    <div className={styles.rowColumn} style={{ flex: '2' }}>
                      <span className={styles.description}>{message.description}</span>
                    </div>
                    <div className={styles.rowColumn} style={{ flex: '1' }}>
                      <span className={styles.useCase}>{message.useCase}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Preview Panel */}
        {selectedMessage && (
          <div className={styles.previewPanel}>
            <div className={styles.previewHeader}>
              <Body className={styles.previewTitle}>Message Preview</Body>
              <button
                className={styles.selectButton}
                onClick={() => handleSelectMessage(selectedMessage)}
              >
                Select This Message
              </button>
            </div>
            <pre className={styles.previewContent}>
              {selectedMessage.sampleMessage}
            </pre>
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerContent}>
            <Icon glyph="InfoWithCircle" size="small" />
            <Body className={styles.footerText}>
              Showing {filteredMessages.length} of {MESSAGE_LIBRARY.length} sample messages
            </Body>
          </div>
        </div>
      </div>
    </>
  );
}