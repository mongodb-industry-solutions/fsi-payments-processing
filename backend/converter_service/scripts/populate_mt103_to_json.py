#!/usr/bin/env python3
"""
Populate MongoDB with MT103 to Canonical JSON configuration
This enables MT103 messages to be converted to the canonical JSON intermediate format
"""

import sys
import os
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent))

from converter_service.services.db_service import MongoDBService
from datetime import datetime
import json

# Load environment variables
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env')


def create_mt103_to_json_config():
    """Create configuration for MT103 to Canonical JSON conversion"""
    
    return {
        "_id": "MT103_to_JSON",
        
        # Parser configuration - reuse from existing MT103
        "parser": {
            "type": "regex",
            "block_pattern": r"\{([1-4]):([^}]*)\}",
            "content_block": "4",
            "fields": {
                "20": {
                    "pattern": r":20:([^\n:]+)",
                    "name": "transaction_reference"
                },
                "23B": {
                    "pattern": r":23B:([^\n:]+)",
                    "name": "bank_operation_code"
                },
                "32A": {
                    "pattern": r":32A:([^\n:]+)",
                    "name": "value_date_amount",
                    "components": {
                        "value_date": [0, 6],
                        "currency": [6, 9],
                        "amount": [9, None]
                    }
                },
                "50K": {
                    "pattern": r":50K:([^\n:]+(?:\n(?!:)[^\n:]+)*)",
                    "name": "ordering_customer",
                    "multiline": True
                },
                "52A": {
                    "pattern": r":52A:([^\n:]+)",
                    "name": "ordering_institution_bic"
                },
                "53A": {
                    "pattern": r":53A:([^\n:]+)",
                    "name": "senders_correspondent"
                },
                "59": {
                    "pattern": r":59:([^\n:]+(?:\n(?!:)[^\n:]+)*)",
                    "name": "beneficiary",
                    "multiline": True
                },
                "70": {
                    "pattern": r":70:([^\n:]+(?:\n(?!:)[^\n:]+)*)",
                    "name": "remittance_information",
                    "multiline": True
                },
                "71A": {
                    "pattern": r":71A:([^\n:]+)",
                    "name": "details_of_charges"
                },
                "72": {
                    "pattern": r":72:([\s\S]+?)(?=\n:|$|\n-})",
                    "name": "sender_to_receiver_info",
                    "multiline": True
                }
            }
        },
        
        # Mappings to Canonical JSON structure
        "mappings": [
            # === HEADER SECTION ===
            {
                "source": "_constant",
                "targets": ["header.message_type"],
                "transform": "set_value",
                "transform_config": {"value": "customer_transfer"},
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "_constant",
                "targets": ["header.source_format"],
                "transform": "set_value",
                "transform_config": {"value": "MT103"},
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "20",
                "targets": ["header.source_reference"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "20",
                "targets": ["header.message_id"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "_timestamp",
                "targets": ["header.creation_datetime"],
                "transform": "current_timestamp",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            
            # === TRANSACTION SECTION ===
            {
                "source": "20",
                "targets": ["transaction.transaction_id"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "20",
                "targets": ["transaction.end_to_end_id"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "23B",
                "targets": ["transaction.transaction_type.code"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            
            # === REFERENCES SECTION ===
            {
                "source": "20",
                "targets": ["references.transaction_reference"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "20",
                "targets": ["references.message_reference"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            
            # === AMOUNTS SECTION ===
            {
                "source": "32A.amount",
                "targets": ["amounts.instructed.value"],
                "transform": "remove_comma",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "32A.currency",
                "targets": ["amounts.instructed.currency"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "32A.amount",
                "targets": ["amounts.settlement.value"],
                "transform": "remove_comma",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "32A.currency",
                "targets": ["amounts.settlement.currency"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            
            # === DATES SECTION ===
            {
                "source": "32A.value_date",
                "targets": ["dates.value_date"],
                "transform": "date_format",
                "transform_config": {
                    "input_format": "%y%m%d",
                    "output_format": "%Y-%m-%d"
                },
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "32A.value_date",
                "targets": ["dates.execution_date"],
                "transform": "date_format",
                "transform_config": {
                    "input_format": "%y%m%d",
                    "output_format": "%Y-%m-%d"
                },
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            
            # === PARTIES SECTION - DEBTOR ===
            {
                "source": "50K",
                "targets": ["parties.debtor"],
                "transform": "parse_party_field",
                "processing_lane": "RULES",
                "confidence": 0.95
            },
            
            # === PARTIES SECTION - DEBTOR AGENT ===
            {
                "source": "52A",
                "targets": ["parties.debtor_agent.bic"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            
            # === PARTIES SECTION - INTERMEDIARIES ===
            {
                "source": "53A",
                "targets": ["parties.intermediaries[0].agent.bic"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "_constant",
                "targets": ["parties.intermediaries[0].role"],
                "transform": "set_value",
                "transform_config": {"value": "correspondent"},
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "_constant",
                "targets": ["parties.intermediaries[0].sequence"],
                "transform": "set_value",
                "transform_config": {"value": 1},
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            
            # === PARTIES SECTION - CREDITOR ===
            {
                "source": "59",
                "targets": ["parties.creditor"],
                "transform": "parse_party_field",
                "processing_lane": "RULES",
                "confidence": 0.95
            },
            
            # === CHARGES SECTION ===
            {
                "source": "71A",
                "targets": ["charges.bearer_code"],
                "transform": "map_charge_bearer",
                "transform_config": {
                    "mapping": {
                        "SHA": "SHAR",
                        "OUR": "DEBT",
                        "BEN": "CRED"
                    }
                },
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            
            # === REMITTANCE SECTION (AI LANE) ===
            {
                "source": "70",
                "targets": ["remittance"],
                "transform": "ai_extract",
                "processing_lane": "AI",
                "field_type": "remittance_to_json",
                "confidence_threshold": 0.8
            },
            
            # === INSTRUCTIONS SECTION (AI LANE) ===
            {
                "source": "72",
                "targets": ["instructions"],
                "transform": "ai_extract",
                "processing_lane": "AI",
                "field_type": "instructions_to_json",
                "confidence_threshold": 0.75
            },
            
            # === ORIGINAL FIELDS (PRESERVE ALL) ===
            {
                "source": "20",
                "targets": ["original_fields.20"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "23B",
                "targets": ["original_fields.23B"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "32A",
                "targets": ["original_fields.32A"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "50K",
                "targets": ["original_fields.50K"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "52A",
                "targets": ["original_fields.52A"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "53A",
                "targets": ["original_fields.53A"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "59",
                "targets": ["original_fields.59"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "70",
                "targets": ["original_fields.70"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "71A",
                "targets": ["original_fields.71A"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "72",
                "targets": ["original_fields.72"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            }
        ],
        
        # Builder configuration for JSON output
        "builder": {
            "type": "json",
            "template": {
                "header": {
                    "message_type": "{{header.message_type}}",
                    "message_id": "{{header.message_id}}",
                    "creation_datetime": "{{header.creation_datetime}}",
                    "source_format": "{{header.source_format}}",
                    "source_reference": "{{header.source_reference}}"
                },
                "transaction": {
                    "transaction_id": "{{transaction.transaction_id}}",
                    "end_to_end_id": "{{transaction.end_to_end_id}}",
                    "instruction_id": "{{transaction.instruction_id}}",
                    "transaction_type": {
                        "code": "{{transaction.transaction_type.code}}"
                    }
                },
                "parties": {
                    "debtor": "{{parties.debtor}}",
                    "debtor_agent": {
                        "bic": "{{parties.debtor_agent.bic}}"
                    },
                    "creditor": "{{parties.creditor}}",
                    "creditor_agent": {
                        "bic": "{{parties.creditor_agent.bic}}"
                    },
                    "intermediaries": "{{parties.intermediaries}}"
                },
                "amounts": {
                    "instructed": {
                        "value": "{{amounts.instructed.value}}",
                        "currency": "{{amounts.instructed.currency}}"
                    },
                    "settlement": {
                        "value": "{{amounts.settlement.value}}",
                        "currency": "{{amounts.settlement.currency}}"
                    }
                },
                "dates": {
                    "value_date": "{{dates.value_date}}",
                    "execution_date": "{{dates.execution_date}}"
                },
                "remittance": "{{remittance}}",
                "instructions": "{{instructions}}",
                "references": {
                    "message_reference": "{{references.message_reference}}",
                    "transaction_reference": "{{references.transaction_reference}}"
                },
                "charges": {
                    "bearer_code": "{{charges.bearer_code}}"
                },
                "original_fields": "{{original_fields}}",
                "processing_metadata": "{{_processing_metadata}}"
            }
        },
        
        # AI Service configuration for complex field extraction
        "ai_service": {
            "provider": "bedrock",
            "region": "us-east-1",
            "models": {
                "claude-3-haiku": {
                    "model_id": "anthropic.claude-3-haiku-20240307-v1:0",
                    "max_tokens": 1000,
                    "temperature": 0.1,
                    "complexity_threshold": {
                        "lines": 6,
                        "chars": 600
                    }
                }
            },
            "field_types": {
                "remittance_to_json": {
                    "description": "Extract remittance information to canonical JSON format",
                    "used_by": ["MT103"],
                    "prompt_template": """Convert this remittance information (MT103 Field 70) to canonical JSON format:

{{field_value}}

Return a JSON object with this EXACT structure:
{
  "unstructured": [
    // Original lines as array of strings
  ],
  "structured": {
    "invoice_number": "extracted invoice if found",
    "invoice_date": "YYYY-MM-DD format if found",
    "purchase_order": "PO number if found",
    "payment_purpose": "brief description",
    "additional_info": {
      // Any other structured data found
    }
  }
}

Rules:
1. PRESERVE original text in "unstructured" array (one line per array element)
2. Extract structured data where identifiable
3. Use null for missing optional fields
4. Dates must be in YYYY-MM-DD format

Return ONLY the JSON object.""",
                    "validation_rules": {
                        "expected_fields": ["unstructured", "structured"],
                        "confidence_adjustments": {
                            "has_invoice": 0.1,
                            "has_structured": 0.05
                        }
                    }
                },
                
                "instructions_to_json": {
                    "description": "Extract sender-to-receiver instructions to canonical JSON format",
                    "used_by": ["MT103"],
                    "prompt_template": """Convert these sender-to-receiver instructions (MT103 Field 72) to canonical JSON format:

{{field_value}}

Parse the instructions and return a JSON object with this structure:
{
  "sender_to_receiver": [
    // Original lines as array
  ],
  "for_creditor_agent": [
    // Lines starting with /ACC/ or /REC/
  ],
  "for_debtor_agent": [
    // Lines for debtor agent if any
  ],
  "regulatory_reporting": [
    // Regulatory info if any
  ]
}

Rules:
1. Lines starting with /ACC/ or /REC/ go to "for_creditor_agent"
2. Lines starting with /INS/ or /BNF/ stay in "sender_to_receiver"
3. Preserve exact text including codes
4. Use empty arrays [] for missing categories

Return ONLY the JSON object.""",
                    "validation_rules": {
                        "expected_fields": ["sender_to_receiver"],
                        "confidence_adjustments": {
                            "has_codes": 0.1
                        }
                    }
                }
            },
            "confidence_config": {
                "hybrid_model": {
                    "enabled": true,
                    "weights": {
                        "ai_confidence": 0.7,
                        "validation_confidence": 0.3
                    }
                },
                "fallback_confidence": {
                    "no_ai_confidence": 0.5,
                    "extraction_failed": 0.3
                }
            }
        },
        
        # Human review configuration
        "human_review": {
            "enabled": true,
            "default_threshold": 0.8,
            "field_overrides": {
                "70": 0.85,  # Higher threshold for remittance
                "72": 0.75   # Lower threshold for instructions
            }
        },
        
        # Metadata
        "metadata": {
            "version": "1.0",
            "created_at": datetime.utcnow().isoformat(),
            "created_by": "populate_mt103_to_json.py",
            "tested": false,
            "production_ready": false,
            "description": "MT103 to Canonical JSON conversion configuration"
        }
    }


def main():
    """Main function to populate the configuration"""
    try:
        # Initialize database service
        db_service = MongoDBService()
        
        # Create configuration
        config = create_mt103_to_json_config()
        
        # Insert or update in MongoDB
        result = db_service.db['conversion_registry'].replace_one(
            {'_id': config['_id']},
            config,
            upsert=True
        )
        
        if result.modified_count > 0:
            print(f"✅ Updated existing configuration: {config['_id']}")
        elif result.upserted_id:
            print(f"✅ Created new configuration: {config['_id']}")
        else:
            print(f"ℹ️ Configuration unchanged: {config['_id']}")
        
        # Verify the configuration
        saved_config = db_service.db['conversion_registry'].find_one({'_id': config['_id']})
        if saved_config:
            print(f"✅ Configuration verified in database")
            print(f"   - Mappings: {len(saved_config.get('mappings', []))} rules")
            print(f"   - AI fields: 2 (remittance, instructions)")
            print(f"   - Parser fields: {len(saved_config['parser']['fields'])} fields")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()