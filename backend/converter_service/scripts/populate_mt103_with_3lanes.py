#!/usr/bin/env python3
"""
Populate MongoDB with MT103 to pacs.008 configuration
WITH 3-LANE PROCESSING: Rules, AI, and Human Review
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


def create_mt103_to_pacs008_3lane_config():
    """Create configuration with 3-lane processing (Rules, AI, Human)"""
    
    return {
        "_id": "MT103_to_pacs.008",  # Overwrite existing document
        
        # Parser configuration - same as before
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
                }
            }
        },
        
        # ENHANCED MAPPINGS WITH 3-LANE PROCESSING
        "mappings": [
            # RULES LANE - Direct mappings with high confidence
            {
                "source": "20",
                "targets": ["MsgId", "InstrId", "EndToEndId", "TxId"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "32A.currency",
                "targets": ["Currency"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "32A.amount",
                "targets": ["Amount"],
                "transform": "remove_comma",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "32A.value_date",
                "targets": ["IntrBkSttlmDt"],
                "transform": "date_format",
                "input_format": "%y%m%d",
                "output_format": "%Y-%m-%d",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "52A",
                "targets": ["DbtrAgt.BIC"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "71A",
                "targets": ["ChrgBr"],
                "transform": "map",
                "map": {
                    "SHA": "SHAR",
                    "OUR": "DEBT",
                    "BEN": "CRED"
                },
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            
            # RULES LANE - Complex but structured extractions
            {
                "source": "50K",
                "targets": ["DbtrAcct.Id"],
                "transform": "extract_account",
                "processing_lane": "RULES",
                "confidence": 0.95  # High confidence for structured extraction
            },
            {
                "source": "50K",
                "targets": ["DbtrNm"],
                "transform": "extract_name",
                "processing_lane": "RULES",
                "confidence": 0.95
            },
            {
                "source": "50K",
                "targets": ["DbtrAdr"],
                "transform": "extract_address",
                "processing_lane": "RULES",
                "confidence": 0.90
            },
            {
                "source": "59",
                "targets": ["CdtrAcct.Id"],
                "transform": "extract_account",
                "processing_lane": "RULES",
                "confidence": 0.95
            },
            {
                "source": "59",
                "targets": ["CdtrNm"],
                "transform": "extract_name",
                "processing_lane": "RULES",
                "confidence": 0.95
            },
            {
                "source": "59",
                "targets": ["CdtrAdr"],
                "transform": "extract_address",
                "processing_lane": "RULES",
                "confidence": 0.90
            },
            
            # AI LANE - Field 70 (Remittance Information)
            {
                "source": "70",
                "targets": ["RmtInf.Ustrd", "RmtInf.Structured"],
                "transform": "ai_extract",
                "processing_lane": "AI",
                "confidence_threshold": 0.8,  # Below this goes to human review
                "ai_config": {
                    "model": "claude-3-haiku",
                    "field_type": "remittance",
                    "prompt_template": """Analyze this payment remittance information and extract structured data:

Field 70 (Remittance Information):
{{field_value}}

Extract and return as JSON:
1. invoice_number: Any invoice number mentioned
2. payment_purpose: Brief description of what payment is for
3. reference_numbers: List of any PO, contract, order numbers
4. amounts: Any specific amounts mentioned
5. dates: Any dates mentioned
6. summary: Concise one-line summary (max 140 chars)

Example response:
{
  "invoice_number": "INV-2024-11-3847",
  "payment_purpose": "Electronic components purchase",
  "reference_numbers": ["PO-8934567", "CONTRACT-789"],
  "amounts": ["125,750.50 USD"],
  "dates": ["2024-11-15"],
  "summary": "Payment for electronic components, invoice INV-2024-11-3847"
}

Be precise and only extract what is clearly present in the text."""
                }
            }
        ],
        
        # AI Service Configuration
        "ai_service": {
            "provider": "bedrock",
            "region": "us-east-1",
            "models": {
                "claude-3-haiku": {
                    "model_id": "anthropic.claude-3-haiku-20240307-v1:0",
                    "max_tokens": 500,
                    "temperature": 0.1,
                    "cost_per_1k_input": 0.00025,
                    "cost_per_1k_output": 0.00125
                }
            },
            "prompt_templates": {
                "remittance": """Extract structured information from this payment remittance text:

{{field_value}}

Return a JSON object with these fields:
- invoice_number: The invoice number if present
- payment_purpose: Brief description of what the payment is for
- amount: Any amount mentioned
- reference_numbers: List of any reference numbers (PO, contract, etc.)
- summary: One-line summary (max 140 chars)

Example output:
{"invoice_number": "INV-2024-001", "payment_purpose": "Electronic components", "reference_numbers": ["PO-12345"], "summary": "Payment for electronic components, INV-2024-001"}""",
                
                "party_details": """Extract party information from this SWIFT field:

{{field_value}}

Return a JSON object with:
- account: Account number (remove leading /)
- name: Party name
- address: Full address as single string
- country: Country if identifiable

Be precise and extract only what's clearly present.""",
                
                "default": """Extract key information from this field:

{{field_value}}

Return a JSON object with the main data elements you can identify."""
            },
            "fallback_to_rules": True,  # If AI fails, use rules
            "cache_responses": True,
            "cache_ttl_seconds": 3600
        },
        
        # Human Review Configuration
        "human_review": {
            "enabled": True,
            "confidence_threshold": 0.8,  # Fields below this need review
            "required_fields": [],  # Always require review for these
            "review_reasons": {
                "low_confidence": "AI confidence below threshold",
                "missing_required": "Required field not found",
                "validation_failed": "Field validation failed",
                "ai_error": "AI processing error"
            }
        },
        
        # Processing Statistics Configuration
        "statistics": {
            "track_per_lane": True,
            "track_ai_costs": True,
            "track_processing_time": True,
            "track_confidence_scores": True
        },
        
        # Builder configuration - same as before
        "builder": {
            "type": "xml",
            "namespace": "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08",
            "defaults": {
                "field_defaults": {
                    "NbOfTxs": "1",
                    "SttlmMtd": "INDA",
                    "BIC": "NOTPROVIDED",
                    "Id": "",
                    "Nm": "NOT PROVIDED",
                    "AdrLine": ""
                },
                "pattern_defaults": [
                    {
                        "pattern": ".*\\.BIC$",
                        "value": "NOTPROVIDED"
                    },
                    {
                        "pattern": ".*\\.Nm$",
                        "value": "NOT PROVIDED"
                    }
                ]
            },
            "template": {
                "Document": {
                    "@xmlns": "{{namespace}}",
                    "FIToFICstmrCdtTrf": {
                        "GrpHdr": {
                            "MsgId": "{{MsgId}}",
                            "CreDtTm": "{{current_time}}",
                            "NbOfTxs": "1",
                            "SttlmInf": {
                                "SttlmMtd": "INDA"
                            }
                        },
                        "CdtTrfTxInf": {
                            "PmtId": {
                                "InstrId": "{{InstrId}}",
                                "EndToEndId": "{{EndToEndId}}",
                                "TxId": "{{TxId}}"
                            },
                            "IntrBkSttlmAmt": {
                                "@Ccy": "{{Currency}}",
                                "#text": "{{Amount}}"
                            },
                            "IntrBkSttlmDt": "{{IntrBkSttlmDt}}",
                            "ChrgBr": "{{ChrgBr}}",
                            "Dbtr": {
                                "Nm": "{{DbtrNm}}",
                                "PstlAdr": {
                                    "AdrLine": "{{DbtrAdr}}"
                                }
                            },
                            "DbtrAcct": {
                                "Id": {
                                    "Othr": {
                                        "Id": "{{DbtrAcct.Id}}"
                                    }
                                }
                            },
                            "DbtrAgt": {
                                "FinInstnId": {
                                    "BIC": "{{DbtrAgt.BIC}}"
                                }
                            },
                            "CdtrAgt": {
                                "FinInstnId": {
                                    "BIC": "NOTPROVIDED"
                                }
                            },
                            "Cdtr": {
                                "Nm": "{{CdtrNm}}",
                                "PstlAdr": {
                                    "AdrLine": "{{CdtrAdr}}"
                                }
                            },
                            "CdtrAcct": {
                                "Id": {
                                    "Othr": {
                                        "Id": "{{CdtrAcct.Id}}"
                                    }
                                }
                            },
                            "RmtInf": {
                                "Ustrd": "{{RmtInf.Ustrd}}"
                            }
                        }
                    }
                }
            }
        },
        
        # Metadata
        "metadata": {
            "created_at": datetime.utcnow(),
            "version": "3.0",
            "description": "MT103 to pacs.008 with 3-lane processing (Rules, AI, Human)",
            "features": [
                "3_lane_processing",
                "ai_extraction",
                "confidence_scoring",
                "human_review",
                "processing_statistics"
            ],
            "status": "active"
        }
    }


def populate_database():
    """Populate MongoDB with 3-lane conversion configuration"""
    
    print("=" * 70)
    print("POPULATING 3-LANE CONVERSION CONFIGURATION")
    print("=" * 70)
    
    # Connect to MongoDB using new service
    mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    database_name = os.getenv("DATABASE_NAME", "payment_converter")
    
    db_service = MongoDBService(mongodb_uri, database_name)
    collection = db_service.db['conversion_registry']
    
    # Check if configuration already exists
    existing = collection.find_one({"_id": "MT103_to_pacs.008"})
    
    if existing:
        print("\n⚠️  Configuration already exists for MT103_to_pacs.008")
        print("   Replacing with 3-lane version...")
        
        # Delete existing configuration
        collection.delete_one({"_id": "MT103_to_pacs.008"})
        print("✓ Deleted existing basic configuration")
    
    # Insert new configuration
    config = create_mt103_to_pacs008_3lane_config()
    result = collection.insert_one(config)
    
    if result.inserted_id:
        print(f"✓ Successfully inserted configuration with ID: {result.inserted_id}")
    else:
        print("❌ Failed to insert configuration")
        return
    
    # Verify insertion
    verify = collection.find_one({"_id": "MT103_to_pacs.008"})
    if verify:
        print("\n✅ 3-Lane Configuration successfully populated!")
        print(f"   - Parser fields: {len(verify['parser']['fields'])}")
        print(f"   - Total mappings: {len(verify['mappings'])}")
        
        # Count lanes
        lanes = {"RULES": 0, "AI": 0}
        for mapping in verify['mappings']:
            lane = mapping.get('processing_lane', 'RULES')
            lanes[lane] = lanes.get(lane, 0) + 1
        
        print(f"   - Rules lane mappings: {lanes['RULES']}")
        print(f"   - AI lane mappings: {lanes['AI']}")
        print(f"   - Human review threshold: {verify['human_review']['confidence_threshold']}")
    else:
        print("\n❌ Verification failed - configuration not found")


if __name__ == "__main__":
    populate_database()