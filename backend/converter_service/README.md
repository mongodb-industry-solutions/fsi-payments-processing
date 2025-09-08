# Converter Service

A generic, MongoDB-driven payment format conversion service with AI-powered field processing.

## Overview

This service provides a fully configurable payment message converter that supports:
- **3-Lane Processing**: Rules-based, AI-assisted, and Human Review lanes
- **Zero Hardcoding**: All conversion logic stored in MongoDB
- **Multiple Formats**: Extensible to any payment format (MT103, ISO 20022, ISO 8583, etc.)
- **AI Integration**: AWS Bedrock for intelligent field extraction

## Architecture

```
converter_service/
├── api/              # FastAPI endpoints
├── core/             # Core conversion components
│   ├── converter.py  # Main converter orchestrator
│   ├── parser.py     # Generic pattern-based parser
│   ├── transformer.py # 3-lane field transformer
│   └── builder.py    # Template-based output builder
├── services/         # External service integrations
│   ├── ai_service.py # AWS Bedrock integration
│   └── db_service.py # MongoDB abstraction
├── models/           # Pydantic models
├── config/           # Configuration management
├── utils/            # Utilities and exceptions
└── scripts/          # Setup and utility scripts
```

## Quick Start

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Or using uv
uv sync
```

### Configuration

Create a `.env` file:

```env
MONGODB_URI=mongodb://localhost:27017
DATABASE_NAME=payment_converter
AWS_REGION=us-east-1
ENABLE_AI_PROCESSING=true
AI_CONFIDENCE_THRESHOLD=0.8
```

### Running the Service

```bash
# Standalone service
uvicorn converter_service.main:app --host 0.0.0.0 --port 8001

# Or as part of main backend
python -m converter_service
```

## API Endpoints

### Convert Message
```bash
POST /api/v1/converter/convert
{
  "source_format": "MT103",
  "target_format": "pacs.008",
  "message": "{1:F01CHASUS33XXXX...}",
  "save_result": true
}
```

### Get Supported Formats
```bash
GET /api/v1/converter/formats
```

### Get Conversion Configuration
```bash
GET /api/v1/converter/config/{conversion_id}
```

### Health Check
```bash
GET /api/v1/converter/health
```

## MongoDB Configuration

All conversion logic is stored in the `conversion_registry` collection:

```javascript
{
  "_id": "MT103_to_pacs.008",
  "parser": {
    "type": "regex",
    "fields": {
      "20": { "pattern": ":20:([^\\n]+)", "name": "Transaction Reference" },
      "32A": { "pattern": ":32A:(\\d{6})([A-Z]{3})([\\d,\\.]+)", "name": "Value Date/Currency/Amount" }
    }
  },
  "mappings": [
    {
      "source": "20",
      "target": "MsgId",
      "type": "direct"
    },
    {
      "source": "70",
      "target": "RmtInf.Ustrd",
      "type": "AI",
      "ai_config": {
        "field_type": "remittance",
        "confidence_threshold": 0.8
      }
    }
  ],
  "builder": {
    "type": "xml",
    "template": {
      "Document": {
        "@xmlns": "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08",
        "FIToFICstmrCdtTrf": {
          "GrpHdr": {
            "MsgId": "{{MsgId}}"
          }
        }
      }
    }
  }
}
```

## 3-Lane Processing

### Rules Lane
- Direct field mappings
- Regex transformations
- Date/amount formatting

### AI Lane
- Unstructured text extraction
- Semantic field matching
- Confidence scoring

### Human Review Lane
- Low confidence fields (< 0.8)
- Missing mandatory fields
- Complex business rules

## Adding New Conversions

1. Insert configuration into MongoDB:
```javascript
db.conversion_registry.insertOne({
  "_id": "NEW_FORMAT_to_TARGET",
  "parser": { /* parser config */ },
  "mappings": [ /* field mappings */ ],
  "builder": { /* output template */ }
})
```

2. No code changes required!

## Performance

- **Baseline**: ~0.008 seconds for rules-only conversion
- **With AI**: ~0.5-1.0 seconds for AI field extraction
- **Single DB Query**: Entire configuration loaded in one query

## Testing

```bash
# Run unit tests
pytest tests/

# Run integration tests
pytest tests/integration/

# Test specific conversion
python scripts/test_conversion.py MT103_to_pacs.008
```

## Dependencies

- **FastAPI**: REST API framework
- **Pydantic**: Data validation
- **PyMongo**: MongoDB driver
- **boto3**: AWS SDK (for Bedrock)
- **python-dotenv**: Environment management

## License

Proprietary - Demo purposes only