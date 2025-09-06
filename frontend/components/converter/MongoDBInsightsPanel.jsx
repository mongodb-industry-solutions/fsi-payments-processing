"use client";

import { useState } from "react";
import Badge from "@leafygreen-ui/badge";
import Icon from "@leafygreen-ui/icon";
import IconButton from "@leafygreen-ui/icon-button";
import { Body, Overline, H3 } from "@leafygreen-ui/typography";
import styles from "./MongoDBInsightsPanel.module.css";

export default function MongoDBInsightsPanel({ 
  sourceFormat, 
  targetFormat,
  processingTime,
  conversionId 
}) {
  const [expandedQueries, setExpandedQueries] = useState(new Set());
  const [copiedQuery, setCopiedQuery] = useState(null);

  const toggleQueryExpansion = (queryId) => {
    const newExpanded = new Set(expandedQueries);
    if (newExpanded.has(queryId)) {
      newExpanded.delete(queryId);
    } else {
      newExpanded.add(queryId);
    }
    setExpandedQueries(newExpanded);
  };

  const handleCopyQuery = (query, queryId) => {
    navigator.clipboard.writeText(JSON.stringify(query, null, 2));
    setCopiedQuery(queryId);
    setTimeout(() => setCopiedQuery(null), 2000);
  };

  // MongoDB operations data (simulated for demo)
  const operations = [
    {
      id: 'parser_lookup',
      collection: 'parser_configs',
      operation: 'findOne',
      query: {
        format_code: sourceFormat,
        is_active: true
      },
      executionTime: 12,
      documentsScanned: 3,
      indexUsed: 'format_code_1',
      stage: 'Parser Selection'
    },
    {
      id: 'rules_lookup',
      collection: 'conversion_rules',
      operation: 'find',
      query: {
        source_format: sourceFormat,
        target_format: targetFormat,
        is_active: true
      },
      executionTime: 18,
      documentsScanned: 47,
      documentsReturned: 15,
      indexUsed: 'source_target_composite',
      stage: 'Rules Retrieval'
    },
    {
      id: 'field_routing',
      collection: 'field_model_routing',
      operation: 'aggregate',
      pipeline: [
        {
          $match: {
            source_format: sourceFormat,
            confidence_threshold: { $lte: 0.8 }
          }
        },
        {
          $lookup: {
            from: 'prompt_templates',
            localField: 'prompt_id',
            foreignField: '_id',
            as: 'prompt'
          }
        },
        {
          $project: {
            field_id: 1,
            model: 1,
            'prompt.template': 1
          }
        }
      ],
      executionTime: 25,
      documentsScanned: 12,
      documentsReturned: 5,
      indexUsed: 'field_routing_index',
      stage: 'AI Field Routing'
    },
    {
      id: 'builder_lookup',
      collection: 'builder_configs',
      operation: 'findOne',
      query: {
        format_code: targetFormat,
        is_active: true
      },
      executionTime: 8,
      documentsScanned: 2,
      indexUsed: 'format_code_1',
      stage: 'Builder Selection'
    },
    {
      id: 'conversion_store',
      collection: 'conversions',
      operation: 'insertOne',
      document: {
        _id: conversionId,
        source_format: sourceFormat,
        target_format: targetFormat,
        status: 'completed',
        created_at: new Date().toISOString()
      },
      executionTime: 15,
      stage: 'Result Storage'
    }
  ];

  const totalExecutionTime = operations.reduce((sum, op) => sum + op.executionTime, 0);
  const totalDocumentsScanned = operations.reduce((sum, op) => sum + (op.documentsScanned || 0), 0);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <H3 className={styles.title}>
          <Icon glyph="Database" />
          MongoDB Operations Insights
        </H3>
        <Badge variant="darkgreen">
          {operations.length} operations executed
        </Badge>
      </div>

      {/* Summary Metrics */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <Overline>Total Query Time</Overline>
          <div className={styles.summaryValue}>{totalExecutionTime}ms</div>
          <div className={styles.summarySubtext}>
            {Math.round((totalExecutionTime / processingTime) * 100)}% of total
          </div>
        </div>
        <div className={styles.summaryCard}>
          <Overline>Documents Scanned</Overline>
          <div className={styles.summaryValue}>{totalDocumentsScanned}</div>
          <div className={styles.summarySubtext}>Across all operations</div>
        </div>
        <div className={styles.summaryCard}>
          <Overline>Collections Accessed</Overline>
          <div className={styles.summaryValue}>
            {new Set(operations.map(op => op.collection)).size}
          </div>
          <div className={styles.summarySubtext}>Unique collections</div>
        </div>
        <div className={styles.summaryCard}>
          <Overline>Index Hit Rate</Overline>
          <div className={styles.summaryValue}>100%</div>
          <div className={styles.summarySubtext}>All queries indexed</div>
        </div>
      </div>

      {/* Operations Timeline */}
      <div className={styles.operations}>
        <Overline className={styles.sectionTitle}>Operation Timeline</Overline>
        
        {operations.map((op, index) => (
          <div key={op.id} className={styles.operation}>
            <div className={styles.operationHeader}>
              <div className={styles.operationInfo}>
                <div className={styles.operationNumber}>{index + 1}</div>
                <div>
                  <div className={styles.operationName}>
                    <span className={styles.collection}>{op.collection}</span>
                    <span className={styles.separator}>.</span>
                    <span className={styles.method}>{op.operation}()</span>
                  </div>
                  <Overline className={styles.stage}>{op.stage}</Overline>
                </div>
              </div>
              
              <div className={styles.operationMetrics}>
                <Badge variant="blue">
                  <Icon glyph="Clock" size="small" />
                  {op.executionTime}ms
                </Badge>
                {op.indexUsed && (
                  <Badge variant="green">
                    <Icon glyph="Database" size="small" />
                    {op.indexUsed}
                  </Badge>
                )}
                {op.documentsReturned && (
                  <Badge variant="lightgray">
                    {op.documentsReturned} docs
                  </Badge>
                )}
                <IconButton
                  size="xsmall"
                  onClick={() => toggleQueryExpansion(op.id)}
                  aria-label={expandedQueries.has(op.id) ? "Collapse" : "Expand"}
                >
                  <Icon glyph={expandedQueries.has(op.id) ? "ChevronUp" : "ChevronDown"} />
                </IconButton>
              </div>
            </div>

            {expandedQueries.has(op.id) && (
              <div className={styles.queryDetails}>
                <div className={styles.queryHeader}>
                  <Overline>MongoDB Query</Overline>
                  <IconButton
                    size="xsmall"
                    onClick={() => handleCopyQuery(op.query || op.pipeline || op.document, op.id)}
                    aria-label="Copy query"
                  >
                    <Icon glyph={copiedQuery === op.id ? "Checkmark" : "Copy"} />
                  </IconButton>
                </div>
                <pre className={styles.queryCode}>
                  {op.operation === 'aggregate' 
                    ? `db.${op.collection}.aggregate(${JSON.stringify(op.pipeline, null, 2)})`
                    : op.operation === 'insertOne'
                    ? `db.${op.collection}.insertOne(${JSON.stringify(op.document, null, 2)})`
                    : `db.${op.collection}.${op.operation}(${JSON.stringify(op.query, null, 2)})`
                  }
                </pre>
                
                <div className={styles.queryMetrics}>
                  <div className={styles.metric}>
                    <Overline>Execution Time:</Overline>
                    <span>{op.executionTime}ms</span>
                  </div>
                  {op.documentsScanned && (
                    <div className={styles.metric}>
                      <Overline>Documents Scanned:</Overline>
                      <span>{op.documentsScanned}</span>
                    </div>
                  )}
                  {op.documentsReturned && (
                    <div className={styles.metric}>
                      <Overline>Documents Returned:</Overline>
                      <span>{op.documentsReturned}</span>
                    </div>
                  )}
                  {op.indexUsed && (
                    <div className={styles.metric}>
                      <Overline>Index Used:</Overline>
                      <span className={styles.indexName}>{op.indexUsed}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Collections Used */}
      <div className={styles.collections}>
        <Overline className={styles.sectionTitle}>MongoDB Collections Utilized</Overline>
        <div className={styles.collectionGrid}>
          {Array.from(new Set(operations.map(op => op.collection))).map(collection => (
            <div key={collection} className={styles.collectionCard}>
              <Icon glyph="Folder" className={styles.collectionIcon} />
              <div>
                <div className={styles.collectionName}>{collection}</div>
                <Overline className={styles.collectionOps}>
                  {operations.filter(op => op.collection === collection).length} operations
                </Overline>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MongoDB Features */}
      <div className={styles.features}>
        <Overline className={styles.sectionTitle}>MongoDB Features in Use</Overline>
        <div className={styles.featuresList}>
          <Badge variant="darkgreen">
            <Icon glyph="Checkmark" />
            Aggregation Pipelines
          </Badge>
          <Badge variant="darkgreen">
            <Icon glyph="Checkmark" />
            Compound Indexes
          </Badge>
          <Badge variant="darkgreen">
            <Icon glyph="Checkmark" />
            $lookup Joins
          </Badge>
          <Badge variant="darkgreen">
            <Icon glyph="Checkmark" />
            Document Validation
          </Badge>
          <Badge variant="darkgreen">
            <Icon glyph="Checkmark" />
            Atlas Search
          </Badge>
        </div>
      </div>
    </div>
  );
}