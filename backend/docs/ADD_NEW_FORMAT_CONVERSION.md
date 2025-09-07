# How to Add New Payment Format Conversions

This guide documents the exact steps needed to add a new payment format conversion to the system, using MT202 to pacs.009 as a real example.

## Overview

The payment conversion system is **configuration-driven** and supports any format pair through:
1. **Parser** - Extracts fields from source format
2. **Builder** - Constructs target format from fields
3. **MongoDB Configurations** - Defines field mappings, AI processing, and transformation rules

## Step-by-Step Guide

### Step 1: Create the Parser (for new source formats)

Create a parser in `backend/utils/parsers/` that extends `BaseParser`:

```python
# backend/utils/parsers/mt202_parser.py
from .base_parser import BaseParser

class MT202Parser(BaseParser):
    def __init__(self, db_connector=None):
        super().__init__(db_connector)
        self.source_format = "MT202"
    
    def parse(self, raw_message: str) -> Dict[str, Any]:
        # Parse the raw message into fields
        # Return dictionary with field IDs as keys
        pass
    
    @property
    def format_type(self) -> str:
        return "MT202"
```

**Key requirements:**
- Must implement `parse()` method
- Must implement `format_type` property
- Return flat dictionary of parsed fields

### Step 2: Create the Builder (for new target formats)

Create a builder in `backend/utils/builders/` that extends `BaseBuilder`:

```python
# backend/utils/builders/pacs009_builder.py
from .base_builder import BaseBuilder

class Pacs009Builder(BaseBuilder):
    def __init__(self, db_connector=None):
        super().__init__(db_connector)
        self.target_format = "pacs.009"
    
    def build(self, fields: Dict[str, Any]) -> str:
        # Build the target format from fields
        # Return the formatted message (XML, JSON, etc.)
        pass
    
    @property
    def format_type(self) -> str:
        return "pacs.009"
```

**Key requirements:**
- Must implement `build()` method
- Must implement `format_type` property
- Accept flat dictionary of fields, return formatted output

### Step 3: Register Parser and Builder

Add registration in `backend/api/conversion.py`:

```python
# For parsers (around line 100-110)
elif source_format == "MT202":
    from utils.parsers.mt202_parser import MT202Parser
    orchestrator.set_parser(MT202Parser(db))
    logger.info(f"Using MT202Parser")

# For builders (around line 125-135)
elif target_format == "pacs.009":
    from utils.builders.pacs009_builder import Pacs009Builder
    orchestrator.set_builder(Pacs009Builder(db))
    logger.info(f"Using Pacs009Builder")
```

### Step 4: Add Conversion Configuration to MongoDB

Run this script to add the conversion configuration:

```python
from db.mdb import MongoDBConnector
from datetime import datetime, UTC

db = MongoDBConnector()

# Add conversion_configs document
config = {
    "source_format": "MT202",
    "target_format": "pacs.009",
    "is_active": True,
    "field_transformations": [
        # Rules-based fields (source_type: "rules")
        {
            "source_field": "20",
            "source_type": "rules",
            "transformations": [
                {
                    "source_path": "",
                    "target_field": "MsgId",
                    "transform_type": "direct"
                }
            ]
        },
        # AI-processed fields (source_type: "ai")
        {
            "source_field": "52",
            "source_type": "ai",
            "transformations": [
                {
                    "source_path": "value.institution_name",
                    "target_field": "InstructingAgent",
                    "transform_type": "direct"
                },
                {
                    "source_path": "value.bic",
                    "target_field": "InstructingAgentBIC",
                    "transform_type": "direct"
                }
            ]
        }
        # Add more field transformations...
    ],
    "created_at": datetime.now(UTC),
    "version": "1.0.0"
}

db.insert_one("conversion_configs", config)
```

**Field Transformation Structure:**
- `source_field`: Field ID from parser output
- `source_type`: "rules" (direct mapping) or "ai" (needs AI processing)
- `transformations`: Array of transformations to apply
  - `source_path`: Path to extract value (e.g., "value.bic" for nested)
  - `target_field`: Field name for builder
  - `transform_type`: "direct", "address_format", "remittance_format", "json_to_string"

### Step 5: Add Conversion Rules (for rules-based mappings)

```python
# Add conversion rules for simple 1:1 mappings
rule = {
    "source_format": "MT202",
    "target_format": "pacs.009",
    "field_mappings": [
        {
            "source_field": "20",
            "target_field": "MsgId",
            "mapping_type": "direct"
        },
        {
            "source_field": "21",
            "target_field": "RelatedReference",
            "mapping_type": "direct"
        },
        {
            "source_field": "32A",
            "target_field": "IntrBkSttlmAmt",
            "mapping_type": "structured",
            "field_map": {
                "amount": "Amount",
                "currency": "Currency",
                "date": "SettlementDate"
            }
        }
    ],
    "is_active": True,
    "created_at": datetime.now(UTC)
}

db.insert_one("conversion_rules", rule)
```

### Step 6: Add AI Processing Configuration

For fields that need AI processing, add prompt templates and routing:

```python
# Add prompt templates
prompt_template = {
    "source_format": "MT202",
    "target_format": "pacs.009",
    "prompts": {
        "52": "Extract institution details from MT202 field 52: {content}. Return JSON with: institution_name, bic",
        "56": "Extract institution details from MT202 field 56: {content}. Return JSON with: institution_name, bic",
        "70": "Extract payment info from field 70: {content}. Return JSON with: payment_reference, payment_details"
    },
    "is_active": True,
    "created_at": datetime.now(UTC)
}

db.insert_one("prompt_templates", prompt_template)

# Add field model routing
routing = {
    "source_format": "MT202",
    "target_format": "pacs.009",
    "field_strategies": {
        "52": {"model": "CLAUDE_HAIKU", "confidence_threshold": 0.85},
        "56": {"model": "CLAUDE_HAIKU", "confidence_threshold": 0.85},
        "70": {"model": "CLAUDE_HAIKU", "confidence_threshold": 0.85}
    },
    "is_active": True,
    "created_at": datetime.now(UTC)
}

db.insert_one("field_model_routing", routing)
```

### Step 7: Test the Conversion

```bash
# Test with curl
curl -X POST "http://localhost:8000/api/v1/convert/" \
  -H "Content-Type: application/json" \
  -d '{
    "source_format": "MT202",
    "target_format": "pacs.009",
    "message": "YOUR_MT202_MESSAGE_HERE"
  }' | python3 -m json.tool
```

## Processing Flow

1. **Parser** extracts fields from source message
2. **Rules Engine** applies direct mappings from `conversion_rules`
3. **AI Processor** handles fields marked as `source_type: "ai"` in `conversion_configs`
4. **Field Transformer** applies transformations from `conversion_configs`
5. **Builder** constructs target format from processed fields

## Key Collections in MongoDB

### conversion_configs
- Defines field transformations
- Specifies which fields need AI (`source_type: "ai"`)
- Contains transformation logic (paths, types, formats)

### conversion_rules
- Simple 1:1 field mappings
- Handled by rules engine (fast, no AI needed)

### prompt_templates
- AI prompts for each field
- Used when `source_type: "ai"` in conversion_configs

### field_model_routing
- Specifies which AI model to use per field
- Sets confidence thresholds

## Important Notes

1. **Field Processing Priority:**
   - Fields in `conversion_rules` are processed first (Rules Lane)
   - Fields marked as `source_type: "ai"` in `conversion_configs` go to AI Lane
   - Unmatched fields go to Human Review Lane

2. **AI Processing:**
   - Only fields explicitly marked as `source_type: "ai"` are sent to AI
   - Requires both `prompt_templates` and `field_model_routing` entries
   - AI results are cached in MongoDB

3. **Transform Types:**
   - `direct`: Copy value as-is
   - `address_format`: Format address from structured data
   - `remittance_format`: Format payment reference info
   - `json_to_string`: Convert JSON object to string
   - `join_array`: Join array elements with separator

4. **Debugging:**
   - Check logs for field routing decisions
   - Verify MongoDB configurations are active (`is_active: true`)
   - Ensure AWS SSO token is valid for AI calls

## Complete Example: MT202 to pacs.009

See the actual implementation:
- Parser: `backend/utils/parsers/mt202_parser.py`
- Builder: `backend/utils/builders/pacs009_builder.py`
- Migration script: `backend/scripts/add_field_transformations.py`

This conversion supports:
- 20 parsed fields from MT202
- 6 fields processed by AI (institutions, remittance info)
- 3 fields processed by rules
- Full XML generation for pacs.009

## Common Pitfalls and Solutions

### 1. AI Field Path Mismatch Issue
**Problem:** AI fields not appearing in output despite being processed successfully.

**Root Cause:** The AI processor returns data wrapped in `{"value": ..., "confidence": ...}` structure, but field transformations may expect different path formats.

**Examples of Path Formats:**
- **MT103 style:** Uses `value.fieldName` paths (e.g., `value.name`, `value.bic`)
- **MT202 style:** Uses direct field paths (e.g., `field52.accountOwner`, `financialInstitutionIdentification.bic`)

**Solution:** The converter orchestrator handles both styles automatically:
- Paths starting with `value.` extract from the wrapper directly
- Other paths extract from the inner `value` object

**Prevention:** When adding new conversions:
1. Define clear prompt templates that output consistent JSON structures
2. Match transformation paths to the actual AI output structure
3. Test AI output structure before defining transformation paths

### 2. Missing Prompt Templates for AI Fields
**Problem:** AI fields return generic/incorrect data.

**Root Cause:** No specific prompt templates defined, so AI uses generic extraction.

**Solution:** Always define explicit prompts in `conversion_configs`:
```python
"prompts": {
    "52": {
        "prompt_structure": {
            "instruction": "Extract specific structure...",
            "examples": [{"input": "...", "output": "..."}]
        },
        "output_format": "JSON"
    }
}
```

### 3. Parser Output Structure Issues
**Problem:** Fields not being processed correctly by rules or AI.

**Root Cause:** Parser returning nested structures when flat structure expected.

**Solution:** 
- Parsers should return flat dictionaries for simple fields
- For structured fields (like 32A), return nested dict but ensure transformation handles it
- Use field variants correctly (e.g., store both `52` and `52_option`)

### 4. MongoDB Configuration Not Active
**Problem:** Configurations exist but aren't being used.

**Root Cause:** Missing or false `is_active` flag.

**Solution:** Always set `is_active: true` in all configuration documents.

### 5. Field Transformation Type Misunderstanding
**Problem:** Values not appearing or formatted incorrectly in output.

**Root Cause:** Wrong `transform_type` or missing path configuration.

**Key Transform Types:**
- `direct`: Simple copy (most common)
- `json_to_string`: For complex objects that need string representation
- `address_format`: For structured address data
- Empty path `""`: Use the entire field value

### 6. Backend Server Not Reloading
**Problem:** Code changes not taking effect.

**Solution:** Run backend with `--reload` flag during development:
```bash
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 7. AI Fields Configuration Structure
**Problem:** AI fields not being recognized.

**Root Cause:** Wrong structure in `conversion_configs`.

**Correct Structure:**
```python
"ai_fields": [
    {
        "field": "52",
        "model": "CLAUDE_HAIKU",
        "strategy": "EXTRACTION",
        "confidence_threshold": 0.8
    }
]
```

### 8. Testing Individual Components
**Problem:** Hard to debug which component is failing.

**Solution:** Test each component separately:
1. Test parser output: `debug_mt202_parsing.py`
2. Test AI output: `debug_ai_output.py`  
3. Test transformations: `debug_field_transformations.py`
4. Test full pipeline: `test_mt202_conversion.py`

## Checklist for New Conversions

- [ ] Create parser class (if new source format)
- [ ] Create builder class (if new target format)
- [ ] Register parser in api/conversion.py
- [ ] Register builder in api/conversion.py
- [ ] Add conversion_configs with field_transformations
- [ ] Add conversion_rules for simple mappings
- [ ] Add prompt_templates for AI fields
- [ ] Add field_model_routing for AI fields
- [ ] Test end-to-end conversion
- [ ] Verify field distribution (Rules/AI/Human lanes)
- [ ] **Test AI output structure matches transformation paths**
- [ ] **Verify all configurations have `is_active: true`**
- [ ] **Create debug scripts for troubleshooting**