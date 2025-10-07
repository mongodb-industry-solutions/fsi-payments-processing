'use client';

import { useState } from 'react';
import styles from './MongoDBShowcase.module.css';

export default function MongoDBShowcase() {
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className={styles.showcase}>
      {/* Header */}
      <div className={styles.header}>
        <h2>MongoDB in Action: Adaptive Payment Converter</h2>
        <p className={styles.subtitle}>
          Explore how MongoDB's flexible document model enables zero-code payment format conversion
        </p>
      </div>

      {/* Intro Section */}
      <div className={styles.introCard}>
        <h3>The Challenge</h3>
        <p>
          Payment format conversion typically requires hardcoded logic for each format pair.
          Adding MT192 → pacs.008? Write code. Adding ISO8583 → cain.001? Write more code.
        </p>
        <div className={styles.highlight}>
          <strong>This demo achieves 100% genericity:</strong> new formats require zero code changes.
          Only MongoDB configuration.
        </div>
      </div>

      {/* Feature Comparison Sections */}
      <div className={styles.featuresSection}>
        <h3>MongoDB Features in Action</h3>

        {/* Feature 1: Flexible Schema */}
        <div className={styles.featureCard}>
          <div className={styles.featureHeader} onClick={() => toggleSection('schema')}>
            <div className={styles.featureTitle}>
              <span className={styles.featureNumber}>1</span>
              <h4>Flexible Schema</h4>
            </div>
            <p className={styles.featureDescription}>
              Store any payment format structure without schema migrations
            </p>
            <button className={styles.expandButton}>
              {expandedSection === 'schema' ? 'Collapse' : 'View Comparison'}
            </button>
          </div>

          {expandedSection === 'schema' && (
            <div className={styles.featureContent}>
              <div className={styles.comparison}>
                <div className={styles.comparisonColumn}>
                  <h5>MongoDB</h5>
                  <pre className={styles.codeBlock}>
{`{
  "MT103": {
    parser: {...},
    mappings: [...]
  },
  "MT202": {
    parser: {...},
    mappings: [...]
  },
  "MT192": {
    parser: {...},
    mappings: [...]
  } ← Just add
}`}
                  </pre>
                  <div className={styles.advantage}>
                    No migrations. No downtime. Add instantly.
                  </div>
                </div>
                <div className={styles.comparisonColumn}>
                  <h5>PostgreSQL</h5>
                  <pre className={styles.codeBlock}>
{`ALTER TABLE conversions
  ADD COLUMN mt192_config JSONB;

CREATE TABLE mt192_mappings (
  id SERIAL PRIMARY KEY,
  field_name VARCHAR(50),
  target_field VARCHAR(100),
  ...
);

UPDATE app_code
  SET formats = formats + 'MT192';

-- Requires application restart`}
                  </pre>
                  <div className={styles.disadvantage}>
                    Schema migrations. Downtime risk. Code deployment.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feature 2: Document Model */}
        <div className={styles.featureCard}>
          <div className={styles.featureHeader} onClick={() => toggleSection('document')}>
            <div className={styles.featureTitle}>
              <span className={styles.featureNumber}>2</span>
              <h4>Document Model for Hierarchical Data</h4>
            </div>
            <p className={styles.featureDescription}>
              Payment formats are naturally nested and hierarchical
            </p>
            <button className={styles.expandButton}>
              {expandedSection === 'document' ? 'Collapse' : 'View Comparison'}
            </button>
          </div>

          {expandedSection === 'document' && (
            <div className={styles.featureContent}>
              <div className={styles.comparison}>
                <div className={styles.comparisonColumn}>
                  <h5>MongoDB: Store Natively</h5>
                  <pre className={styles.codeBlock}>
{`{
  "parser": {
    "field_20": {
      "pattern": "^:20:(.+)",
      "type": "string"
    },
    "field_50K": {
      "pattern": "^:50K:(.+)",
      "components": [
        "account",
        "name",
        "address",
        "city"
      ],
      "multiline": true
    }
  }
}`}
                  </pre>
                  <div className={styles.advantage}>
                    Natural structure. Single document. One query.
                  </div>
                </div>
                <div className={styles.comparisonColumn}>
                  <h5>PostgreSQL: Normalize Across Tables</h5>
                  <pre className={styles.codeBlock}>
{`conversion_configs
  (id, format_name)

parser_fields
  (id, config_id, field_name,
   pattern, type)

field_components
  (id, field_id, component_name,
   component_order)

-- Requires JOINs to reconstruct
SELECT c.*, p.*, fc.*
FROM conversion_configs c
JOIN parser_fields p
  ON c.id = p.config_id
LEFT JOIN field_components fc
  ON p.id = fc.field_id;`}
                  </pre>
                  <div className={styles.disadvantage}>
                    Complex joins. Multiple queries. Slower performance.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feature 3: Single Query vs Joins */}
        <div className={styles.featureCard}>
          <div className={styles.featureHeader} onClick={() => toggleSection('query')}>
            <div className={styles.featureTitle}>
              <span className={styles.featureNumber}>3</span>
              <h4>Single Document Queries vs Multi-Table Joins</h4>
            </div>
            <p className={styles.featureDescription}>
              Retrieve entire conversion config in one operation
            </p>
            <button className={styles.expandButton}>
              {expandedSection === 'query' ? 'Collapse' : 'View Comparison'}
            </button>
          </div>

          {expandedSection === 'query' && (
            <div className={styles.featureContent}>
              <div className={styles.comparison}>
                <div className={styles.comparisonColumn}>
                  <h5>MongoDB: Single Query</h5>
                  <pre className={styles.codeBlock}>
{`db.conversion_registry.findOne({
  "_id": "MT103_to_pacs.008"
})

// Returns everything:
{
  parser: { ... },
  mappings: [ ... ],
  builder: { ... },
  ai_config: { ... }
}

// Response time: < 10ms`}
                  </pre>
                  <div className={styles.advantage}>
                    One query. Complete data. Sub-10ms response.
                  </div>
                </div>
                <div className={styles.comparisonColumn}>
                  <h5>PostgreSQL: Multiple Joins</h5>
                  <pre className={styles.codeBlock}>
{`SELECT
  c.*,
  p.*,
  m.*,
  b.*,
  a.*
FROM conversions c
JOIN parsers p
  ON c.id = p.conversion_id
JOIN mappings m
  ON c.id = m.conversion_id
JOIN builders b
  ON c.id = b.conversion_id
LEFT JOIN ai_configs a
  ON c.id = a.conversion_id
WHERE c.name = 'MT103_to_pacs.008';

// Response time: 50-200ms+`}
                  </pre>
                  <div className={styles.disadvantage}>
                    Multiple joins. Slower. Complex queries.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feature 4: Native JSON */}
        <div className={styles.featureCard}>
          <div className={styles.featureHeader} onClick={() => toggleSection('json')}>
            <div className={styles.featureTitle}>
              <span className={styles.featureNumber}>4</span>
              <h4>Native JSON for Canonical Bridge Format</h4>
            </div>
            <p className={styles.featureDescription}>
              Universal intermediate format for multi-hop routing
            </p>
            <button className={styles.expandButton}>
              {expandedSection === 'json' ? 'Collapse' : 'View Comparison'}
            </button>
          </div>

          {expandedSection === 'json' && (
            <div className={styles.featureContent}>
              <div className={styles.explanation}>
                <p>
                  This demo uses Canonical JSON as a universal bridge: <strong>Any Format → JSON → Any Format</strong>
                </p>
                <p>
                  This enables multi-hop routing without direct format-to-format mappings.
                </p>
              </div>
              <div className={styles.comparison}>
                <div className={styles.comparisonColumn}>
                  <h5>MongoDB: First-Class JSON</h5>
                  <pre className={styles.codeBlock}>
{`// Store JSON natively
{
  "parties": {
    "debtor": {
      "name": "ACME Corp",
      "account": "US123..."
    }
  }
}

// Query deeply nested fields
db.conversions.find({
  "parties.debtor.name": "ACME Corp"
})

// No serialization overhead`}
                  </pre>
                  <div className={styles.advantage}>
                    Native JSON. Deep querying. Zero overhead.
                  </div>
                </div>
                <div className={styles.comparisonColumn}>
                  <h5>PostgreSQL: JSONB Workarounds</h5>
                  <pre className={styles.codeBlock}>
{`-- Store in JSONB column
CREATE TABLE conversions (
  id SERIAL,
  data JSONB
);

-- Query with JSONB operators
SELECT * FROM conversions
WHERE data->'parties'->'debtor'
  ->>'name' = 'ACME Corp';

-- Limited operators
-- Parse → Store → Parse again
-- Not a native data model`}
                  </pre>
                  <div className={styles.disadvantage}>
                    Bolted-on JSONB. Limited operators. Not native.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feature 5: Schema Evolution */}
        <div className={styles.featureCard}>
          <div className={styles.featureHeader} onClick={() => toggleSection('evolution')}>
            <div className={styles.featureTitle}>
              <span className={styles.featureNumber}>5</span>
              <h4>Zero-Downtime Schema Evolution</h4>
            </div>
            <p className={styles.featureDescription}>
              Add new fields to configs without downtime or migrations
            </p>
            <button className={styles.expandButton}>
              {expandedSection === 'evolution' ? 'Collapse' : 'View Comparison'}
            </button>
          </div>

          {expandedSection === 'evolution' && (
            <div className={styles.featureContent}>
              <div className={styles.comparison}>
                <div className={styles.comparisonColumn}>
                  <h5>MongoDB: Just Insert</h5>
                  <pre className={styles.codeBlock}>
{`db.conversion_registry.insertOne({
  "_id": "MT192_to_pacs.008",
  "parser": {...},
  "mappings": [...],
  "new_field": "anything",
  "another_field": {
    "any": "structure"
  }
})

// Works instantly
// No schema validation
// No migrations needed`}
                  </pre>
                  <div className={styles.advantage}>
                    Zero downtime. Instant changes. No migrations.
                  </div>
                </div>
                <div className={styles.comparisonColumn}>
                  <h5>PostgreSQL: Migration Required</h5>
                  <pre className={styles.codeBlock}>
{`BEGIN;
  ALTER TABLE
    conversion_configs
  ADD COLUMN
    new_field JSONB;

  -- Table may lock during migration
  -- Downtime for large tables
  -- Must plan maintenance window
COMMIT;

-- Update application code
-- Deploy new version
-- Restart services`}
                  </pre>
                  <div className={styles.disadvantage}>
                    Potential downtime. Planning required. Risky.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feature 6: AI/ML Storage */}
        <div className={styles.featureCard}>
          <div className={styles.featureHeader} onClick={() => toggleSection('ai')}>
            <div className={styles.featureTitle}>
              <span className={styles.featureNumber}>6</span>
              <h4>AI-Powered Configuration Storage</h4>
            </div>
            <p className={styles.featureDescription}>
              Store learned semantic patterns for intelligent auto-configuration
            </p>
            <button className={styles.expandButton}>
              {expandedSection === 'ai' ? 'Collapse' : 'View Comparison'}
            </button>
          </div>

          {expandedSection === 'ai' && (
            <div className={styles.featureContent}>
              <div className={styles.comparison}>
                <div className={styles.comparisonColumn}>
                  <h5>MongoDB: Flexible Pattern Storage</h5>
                  <pre className={styles.codeBlock}>
{`{
  "field_pattern": "^:20:",
  "semantic_meaning":
    "transaction_reference",
  "target_mappings": [
    "MsgId",
    "EndToEndId"
  ],
  "confidence_factors": {
    "position": 0.9,
    "context": 0.85
  },
  "learning_history": [
    { "date": "...", ... }
  ]
}

// Evolves over time
// No schema constraints`}
                  </pre>
                  <div className={styles.advantage}>
                    Flexible ML storage. AI can evolve freely.
                  </div>
                </div>
                <div className={styles.comparisonColumn}>
                  <h5>PostgreSQL: Rigid ML Schema</h5>
                  <pre className={styles.codeBlock}>
{`CREATE TABLE semantic_patterns (
  id SERIAL,
  field_pattern VARCHAR(100),
  semantic_meaning VARCHAR(50),
  -- Must define all fields upfront
  confidence_score DECIMAL(3,2)
);

CREATE TABLE target_mappings (
  id SERIAL,
  pattern_id INTEGER,
  target_field VARCHAR(100)
);

-- Adding new ML dimensions?
-- Requires schema migration
-- Blocks AI improvements`}
                  </pre>
                  <div className={styles.disadvantage}>
                    Rigid schema. Hard to evolve. Blocks innovation.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Result Section */}
      <div className={styles.resultCard}>
        <h3>The Result</h3>
        <p>
          This entire demo runs on pure MongoDB configuration. No hardcoded format logic.
          No code deployments for new formats. Just data.
        </p>
        <div className={styles.tryItSection}>
          <h4>Try It Yourself</h4>
          <ul>
            <li>Select Cross-Border Wire to see flexible schema handling different field structures</li>
            <li>Select Card Payment to see binary data handling (ISO8583 bitmap storage)</li>
            <li>Select Bank Transfer to see query performance in action</li>
            <li>Try Auto-Config to see AI-powered configuration with evolving patterns</li>
          </ul>
        </div>
      </div>

      {/* CTA */}
      <div className={styles.cta}>
        <p>Select a payment scenario from the left panel to explore these features</p>
      </div>
    </div>
  );
}