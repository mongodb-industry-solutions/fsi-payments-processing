#!/usr/bin/env python3
"""
Populate MongoDB with MT202 to pacs.009 configuration
WITH 3-LANE PROCESSING: Rules, AI, and Human Review

MT202 is a Financial Institution Transfer message used for bank-to-bank transfers.
pacs.009 is the ISO 20022 equivalent for Financial Institution Core Credit Transfer.
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


def create_mt202_to_pacs009_3lane_config():
    """Create configuration with 3-lane processing (Rules, AI, Human)"""
    
    return {
        "_id": "MT202_to_pacs.009",  # Unique document ID
        
        # Parser configuration for MT202
        "parser": {
            "type": "regex",
            "block_pattern": r"\{([1-4]):([^}]*)\}",
            "content_block": "4",
            "fields": {
                "20": {
                    "pattern": r":20:([^\n:]+)",
                    "name": "transaction_reference"
                },
                "21": {
                    "pattern": r":21:([^\n:]+)",
                    "name": "related_reference"
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
                "52A": {
                    "pattern": r":52A:([^\n:]+)",
                    "name": "ordering_institution_a"
                },
                "52D": {
                    "pattern": r":52D:([^\n:]+(?:\n(?!:)[^\n:]+)*)",
                    "name": "ordering_institution_d",
                    "multiline": True
                },
                "53A": {
                    "pattern": r":53A:([^\n:]+)",
                    "name": "senders_correspondent_a"
                },
                "53B": {
                    "pattern": r":53B:([^\n:]+)",
                    "name": "senders_correspondent_b"
                },
                "53D": {
                    "pattern": r":53D:([^\n:]+(?:\n(?!:)[^\n:]+)*)",
                    "name": "senders_correspondent_d",
                    "multiline": True
                },
                "54A": {
                    "pattern": r":54A:([^\n:]+)",
                    "name": "receivers_correspondent_a"
                },
                "54B": {
                    "pattern": r":54B:([^\n:]+)",
                    "name": "receivers_correspondent_b"
                },
                "54D": {
                    "pattern": r":54D:([^\n:]+(?:\n(?!:)[^\n:]+)*)",
                    "name": "receivers_correspondent_d",
                    "multiline": True
                },
                "56A": {
                    "pattern": r":56A:([^\n:]+)",
                    "name": "intermediary_a"
                },
                "56D": {
                    "pattern": r":56D:([^\n:]+(?:\n(?!:)[^\n:]+)*)",
                    "name": "intermediary_d",
                    "multiline": True
                },
                "57A": {
                    "pattern": r":57A:([^\n:]+)",
                    "name": "account_with_institution_a"
                },
                "57B": {
                    "pattern": r":57B:([^\n:]+)",
                    "name": "account_with_institution_b"
                },
                "57D": {
                    "pattern": r":57D:([^\n:]+(?:\n(?!:)[^\n:]+)*)",
                    "name": "account_with_institution_d",
                    "multiline": True
                },
                "58A": {
                    "pattern": r":58A:([^\n:]+)",
                    "name": "beneficiary_institution_a"
                },
                "58D": {
                    "pattern": r":58D:([^\n:]+(?:\n(?!:)[^\n:]+)*)",
                    "name": "beneficiary_institution_d",
                    "multiline": True
                },
                "72": {
                    "pattern": r":72:([\s\S]+?)(?=\n:|$|\n-})",
                    "name": "sender_to_receiver_info",
                    "multiline": True
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
                "source": "21",
                "targets": ["PmtTpInf.InstrPrty"],
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
                "transform_config": {
                    "input_format": "%y%m%d",
                    "output_format": "%Y-%m-%d"
                },
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            
            # Ordering Institution (52A/D) -> InstgAgt
            {
                "source": "52A",
                "targets": ["InstgAgt.FinInstnId.BICFI"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "52D",
                "targets": ["InstgAgt.FinInstnId.Nm"],
                "transform": "extract_name",
                "processing_lane": "RULES",
                "confidence": 0.95
            },
            {
                "source": "52D",
                "targets": ["InstgAgt.FinInstnId.PstlAdr"],
                "transform": "extract_lines",
                "transform_config": {
                    "start_line": 2  # Skip account (line 0) and name (line 1)
                },
                "processing_lane": "RULES",
                "confidence": 0.9
            },
            
            # Sender's Correspondent (53A/B/D) -> InstdAgt
            {
                "source": "53A",
                "targets": ["InstdAgt.FinInstnId.BICFI"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "53B",
                "targets": ["InstdAgt.FinInstnId.ClrSysMmbId.MmbId"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 0.95
            },
            {
                "source": "53D",
                "targets": ["InstdAgt.FinInstnId.Nm"],
                "transform": "extract_name",
                "processing_lane": "RULES",
                "confidence": 0.95
            },
            {
                "source": "53D",
                "targets": ["InstdAgt.FinInstnId.PstlAdr"],
                "transform": "extract_lines",
                "transform_config": {
                    "start_line": 2
                },
                "processing_lane": "RULES",
                "confidence": 0.9
            },
            
            # Receiver's Correspondent (54A/B/D) -> PrvsInstgAgt1
            {
                "source": "54A",
                "targets": ["PrvsInstgAgt1.FinInstnId.BICFI"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "54B",
                "targets": ["PrvsInstgAgt1.FinInstnId.ClrSysMmbId.MmbId"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 0.95
            },
            {
                "source": "54D",
                "targets": ["PrvsInstgAgt1.FinInstnId.Nm"],
                "transform": "extract_name",
                "processing_lane": "RULES",
                "confidence": 0.95
            },
            {
                "source": "54D",
                "targets": ["PrvsInstgAgt1.FinInstnId.PstlAdr"],
                "transform": "extract_lines",
                "transform_config": {
                    "start_line": 2
                },
                "processing_lane": "RULES",
                "confidence": 0.9
            },
            
            # Intermediary (56A/D) -> IntrmyAgt1
            {
                "source": "56A",
                "targets": ["IntrmyAgt1.FinInstnId.BICFI"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "56D",
                "targets": ["IntrmyAgt1.FinInstnId.Nm"],
                "transform": "extract_name",
                "processing_lane": "RULES",
                "confidence": 0.95
            },
            {
                "source": "56D",
                "targets": ["IntrmyAgt1.FinInstnId.PstlAdr"],
                "transform": "extract_lines",
                "transform_config": {
                    "start_line": 2
                },
                "processing_lane": "RULES",
                "confidence": 0.9
            },
            
            # Account With Institution (57A/B/D) -> CdtrAgt
            {
                "source": "57A",
                "targets": ["CdtrAgt.FinInstnId.BICFI"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "57B",
                "targets": ["CdtrAgt.FinInstnId.ClrSysMmbId.MmbId"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 0.95
            },
            {
                "source": "57D",
                "targets": ["CdtrAgt.FinInstnId.Nm"],
                "transform": "extract_name",
                "processing_lane": "RULES",
                "confidence": 0.95
            },
            {
                "source": "57D",
                "targets": ["CdtrAgt.FinInstnId.PstlAdr"],
                "transform": "extract_lines",
                "transform_config": {
                    "start_line": 2
                },
                "processing_lane": "RULES",
                "confidence": 0.9
            },
            
            # Beneficiary Institution (58A/D) -> Cdtr
            {
                "source": "58A",
                "targets": ["Cdtr.FinInstnId.BICFI"],
                "transform": "copy",
                "processing_lane": "RULES",
                "confidence": 1.0
            },
            {
                "source": "58D",
                "targets": ["Cdtr.FinInstnId.Nm"],
                "transform": "extract_name",
                "processing_lane": "RULES",
                "confidence": 0.95
            },
            {
                "source": "58D",
                "targets": ["Cdtr.FinInstnId.PstlAdr"],
                "transform": "extract_lines",
                "transform_config": {
                    "start_line": 2
                },
                "processing_lane": "RULES",
                "confidence": 0.9
            },
            
            # AI LANE - Field 72 (Sender to Receiver Information)
            {
                "source": "72",
                "targets": ["InstrForNxtAgt", "InstrForCdtrAgt"],
                "transform": "ai_extract",
                "processing_lane": "AI",
                "field_type": "bank_to_bank_info",  # Moved to root level
                "confidence_threshold": 0.75
            }
        ],
        
        # AI Service Configuration (same as MT103)
        "ai_service": {
            "provider": "bedrock",
            "region": "us-east-1",
            "models": {
                "claude-3-haiku": {
                    "model_id": "anthropic.claude-3-haiku-20240307-v1:0",
                    "max_tokens": 1000,
                    "temperature": 0.1,
                    "cost_per_1k_input": 0.00025,
                    "cost_per_1k_output": 0.00125,
                    "complexity_threshold": {
                        "lines": 6,
                        "chars": 600
                    }
                },
                "claude-3-sonnet": {
                    "model_id": "anthropic.claude-3-sonnet-20240229-v1:0",
                    "max_tokens": 2000,
                    "temperature": 0.1,
                    "cost_per_1k_input": 0.003,
                    "cost_per_1k_output": 0.015,
                    "complexity_threshold": {
                        "lines": 999,
                        "chars": 9999
                    }
                }
            },
            "field_types": {
                "bank_to_bank_info": {
                    "description": "MT202 Field 72 bank-to-bank instructions",
                    "used_by": ["MT202"],
                    "prompt_template": """Extract and map bank-to-bank instructions from field 72:

{{field_value}}

Return ONLY a valid JSON object with NO other text. Map each instruction to the appropriate target field.

Instructions should be mapped as follows:
- /BNF/, /INTA/, /INTC/ -> InstrForNxtAgt (Instructions for Next Agent)
- /ACC/, /INS/, /REC/ -> InstrForCdtrAgt (Instructions for Creditor Agent)
- /RFB/ -> Related reference information
- Others -> Unmapped

Return JSON with these exact fields:
{
  "InstrForNxtAgt": ["full instruction line 1", "full instruction line 2"],
  "InstrForCdtrAgt": ["full instruction line if any"],
  "RelatedRef": "",
  "Unmapped": [],
  "confidence_scores": {
    "overall": (0.0-1.0 based on your confidence)
  }
}

For confidence scores:
- Use 1.0 when mapping is certain
- Use 0.7-0.9 when reasonably confident
- Use 0.5 when unsure about mapping
- Use <0.5 when very uncertain

Return ONLY the JSON object, no other text.""",
                    "validation_rules": {
                        "expected_fields": ["InstrForNxtAgt", "InstrForCdtrAgt"],
                        "field_patterns": {
                            "instruction_codes": "^\\[.*\\]$"
                        },
                        "boost_if_matches": 0.1,
                        "penalty_if_missing": 0.15
                    }
                },
                
                "institution_details": {
                    "description": "Institution information extraction (MT202)",
                    "used_by": ["MT202"],
                    "prompt_template": """Extract institution information from this SWIFT field:

{{field_value}}

Return a JSON object with:
- bic: BIC code if present
- name: Institution name
- address: Full address as array of lines
- account: Account number if present
- confidence_scores: Your confidence level (0.0-1.0) for each field and overall

Example output:
{
  "bic": "DEUTDEFFXXX",
  "name": "DEUTSCHE BANK AG",
  "address": ["FRANKFURT", "GERMANY"],
  "account": "",
  "confidence_scores": {
    "bic": 1.0,
    "name": 0.95,
    "address": 0.9,
    "overall": 0.95
  }
}""",
                    "validation_rules": {
                        "expected_fields": ["name"],
                        "field_patterns": {
                            "bic": "^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$",
                            "name": ".{2,}"
                        },
                        "boost_if_matches": 0.05,
                        "penalty_if_missing": 0.15
                    }
                },
                
                "remittance": {
                    "description": "Payment remittance information extraction (MT103 Field 70)",
                    "used_by": ["MT103"],
                    "prompt_template": """Extract and preserve remittance information line-by-line:

{{field_value}}

Return ONLY a valid JSON object with NO other text. Split the remittance text into individual lines.

CRITICAL: Preserve the original line structure. Each line of the input should become a separate array element in the Ustrd field.

Return JSON with these exact fields:
1. Ustrd: Array of strings, each line from the original text (preserve order)
2. invoice_number: The invoice number if found (optional)
3. payment_purpose: Brief description if identifiable (optional)
4. confidence_scores: Your confidence (0.0-1.0) for extraction quality

For confidence scores:
- Use 1.0 when certain
- Use 0.7-0.9 when reasonably confident
- Use 0.5 when guessing
- Use <0.5 when very uncertain

Example input:
INV-2024-11-3847 DATED 15.11.2024
PAYMENT FOR ELECTRONIC COMPONENTS
ORDER PO-8934567 QTY 5000 UNITS

Example output:
{
  "Ustrd": [
    "INV-2024-11-3847 DATED 15.11.2024",
    "PAYMENT FOR ELECTRONIC COMPONENTS",
    "ORDER PO-8934567 QTY 5000 UNITS"
  ],
  "invoice_number": "INV-2024-11-3847",
  "payment_purpose": "Electronic components",
  "confidence_scores": {
    "Ustrd": 1.0,
    "invoice_number": 0.95,
    "payment_purpose": 0.90,
    "overall": 0.95
  }
}

Return ONLY the JSON object, no other text.""",
                    "validation_rules": {
                        "expected_fields": ["invoice_number", "payment_purpose", "summary"],
                        "field_patterns": {
                            "invoice_number": "^(INV-|Invoice#?|Inv#?)\\d+",
                            "payment_purpose": ".{5,}",
                            "summary": ".{10,140}"
                        },
                        "boost_if_matches": 0.1,
                        "penalty_if_missing": 0.2
                    }
                },
                
                "sender_receiver_info": {
                    "description": "MT103 Field 72 sender-to-receiver instructions",
                    "used_by": ["MT103"],
                    "prompt_template": """Extract and map sender-to-receiver instructions from field 72:

{{field_value}}

Return ONLY a valid JSON object with NO other text. Map each instruction line to the appropriate target field.

Instructions should be mapped as follows:
- /ACC/, /INS/, /REC/, /CUST/ -> InstrForCdtrAgt (Instructions for Creditor Agent)
- /INTA/, /INTC/ -> InstrForNxtAgt (Instructions for Next Agent)  
- /DEBIT/, /DBTR/ -> InstrForDbtrAgt (Instructions for Debtor Agent)
- Others -> Unmapped

Return JSON with these exact fields:
{
  "InstrForCdtrAgt": ["full instruction line 1", "full instruction line 2"],
  "InstrForNxtAgt": ["full instruction line if any"],
  "InstrForDbtrAgt": [],
  "Unmapped": [],
  "confidence_scores": {
    "overall": (0.0-1.0 based on your confidence)
  }
}

For confidence scores:
- Use 1.0 when mapping is certain
- Use 0.7-0.9 when reasonably confident
- Use 0.5 when unsure about mapping
- Use <0.5 when very uncertain

Example input:
/ACC/URGENT PROCESSING REQUIRED
/REC/NOTIFY ACCOUNTS@GLOBALSUPPLIES.DE

Example output:
{
  "InstrForCdtrAgt": [
    "/ACC/URGENT PROCESSING REQUIRED",
    "/REC/NOTIFY ACCOUNTS@GLOBALSUPPLIES.DE"
  ],
  "InstrForNxtAgt": [],
  "InstrForDbtrAgt": [],
  "Unmapped": [],
  "confidence_scores": {
    "overall": 0.95
  }
}

Return ONLY the JSON object, no other text.""",
                    "validation_rules": {
                        "expected_fields": ["instruction_codes", "summary"],
                        "field_patterns": {
                            "instruction_codes": "^\\[.*\\]$",
                            "summary": ".{5,}"
                        },
                        "boost_if_matches": 0.1,
                        "penalty_if_missing": 0.15
                    }
                },
                
                "party_details": {
                    "description": "Party identification information extraction (currently unused)",
                    "used_by": [],
                    "prompt_template": """Extract party information from this SWIFT field:

{{field_value}}

Return a JSON object with:
- account: Account number (remove leading /)
- name: Party name
- address: Full address as single string
- country: Country if identifiable
- confidence_scores: Your confidence level (0.0-1.0) for each field and overall

Be precise and extract only what's clearly present.

Example output:
{
  "account": "US64209876543210987654",
  "name": "ACME TECHNOLOGIES INC",
  "address": "1234 INNOVATION DRIVE, SILICON VALLEY CA 94025",
  "country": "USA",
  "confidence_scores": {
    "account": 0.98,
    "name": 1.0,
    "address": 0.95,
    "country": 0.99,
    "overall": 0.98
  }
}""",
                    "validation_rules": {
                        "expected_fields": ["account", "name", "address"],
                        "field_patterns": {
                            "account": ".{5,}",
                            "name": ".{2,}",
                            "address": ".{5,}"
                        },
                        "boost_if_matches": 0.05,
                        "penalty_if_missing": 0.15
                    }
                },
                
                "default": {
                    "description": "Fallback field type for unspecified extractions",
                    "used_by": ["ALL"],
                    "prompt_template": """Extract key information from this field:

{{field_value}}

Return a JSON object with the main data elements you can identify.
Include a 'confidence_scores' object with your confidence (0.0-1.0) for each field and an 'overall' score.""",
                    "validation_rules": {
                        "expected_fields": [],
                        "field_patterns": {}
                    }
                }
            },
            # Backward compatibility: Keep prompt_templates pointing to field_types
            "prompt_templates": {
                "bank_to_bank_info": "See field_types.bank_to_bank_info.prompt_template",
                "institution_details": "See field_types.institution_details.prompt_template",
                "remittance": "See field_types.remittance.prompt_template",
                "sender_receiver_info": "See field_types.sender_receiver_info.prompt_template",
                "party_details": "See field_types.party_details.prompt_template",
                "default": "See field_types.default.prompt_template"
            },
            "confidence_config": {
                "hybrid_model": {
                    "enabled": True,
                    "weights": {
                        "ai_confidence": 0.7,
                        "validation_confidence": 0.3
                    }
                },
                "validation_rules": {
                    "bank_to_bank_info": {
                        "expected_fields": ["InstrForNxtAgt", "InstrForCdtrAgt"],
                        "field_patterns": {
                            "instruction_codes": "^\\[.*\\]$"
                        },
                        "boost_if_matches": 0.1,
                        "penalty_if_missing": 0.15
                    },
                    "institution_details": {
                        "expected_fields": ["name"],
                        "field_patterns": {
                            "bic": "^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$",
                            "name": ".{2,}"
                        },
                        "boost_if_matches": 0.05,
                        "penalty_if_missing": 0.15
                    },
                    "default": {
                        "expected_fields": [],
                        "field_patterns": {}
                    }
                },
                "fallback_confidence": {
                    "no_ai_confidence": 0.5,
                    "extraction_failed": 0.3
                }
            },
            "fallback_to_rules": True,
            "cache_responses": True,
            "cache_ttl_seconds": 3600
        },
        
        # Human Review Configuration
        "human_review": {
            "enabled": True,
            "confidence_threshold": 0.8,
            "required_fields": [],
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
        
        # Builder configuration for pacs.009
        "builder": {
            "type": "xml",
            "namespace": "urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08",
            "defaults": {
                "field_defaults": {
                    "NbOfTxs": "1",
                    "SttlmMtd": "INDA",
                    "BIC": "NOTPROVIDED",
                    "BICFI": "NOTPROVIDED",
                    "Nm": "NOT PROVIDED",
                    "InstrPrty": "NORM",
                    "SvcLvl.Cd": "SEPA"
                },
                "pattern_defaults": [
                    {
                        "pattern": ".*\\.BICFI$",
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
                    "FICdtTrf": {
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
                            "PmtTpInf": {
                                "InstrPrty": "{{PmtTpInf.InstrPrty}}",
                                "SvcLvl": {
                                    "Cd": "SEPA"
                                }
                            },
                            "IntrBkSttlmAmt": {
                                "@Ccy": "{{Currency}}",
                                "#text": "{{Amount}}"
                            },
                            "IntrBkSttlmDt": "{{IntrBkSttlmDt}}",
                            "InstgAgt": {
                                "FinInstnId": {
                                    "BICFI": "{{InstgAgt.FinInstnId.BICFI}}",
                                    "Nm": "{{InstgAgt.FinInstnId.Nm}}",
                                    "PstlAdr": {
                                        "AdrLine": "{{InstgAgt.FinInstnId.PstlAdr}}"
                                    }
                                }
                            },
                            "InstdAgt": {
                                "FinInstnId": {
                                    "BICFI": "{{InstdAgt.FinInstnId.BICFI}}",
                                    "ClrSysMmbId": {
                                        "MmbId": "{{InstdAgt.FinInstnId.ClrSysMmbId.MmbId}}"
                                    },
                                    "Nm": "{{InstdAgt.FinInstnId.Nm}}",
                                    "PstlAdr": {
                                        "AdrLine": "{{InstdAgt.FinInstnId.PstlAdr}}"
                                    }
                                }
                            },
                            "PrvsInstgAgt1": {
                                "FinInstnId": {
                                    "BICFI": "{{PrvsInstgAgt1.FinInstnId.BICFI}}",
                                    "ClrSysMmbId": {
                                        "MmbId": "{{PrvsInstgAgt1.FinInstnId.ClrSysMmbId.MmbId}}"
                                    },
                                    "Nm": "{{PrvsInstgAgt1.FinInstnId.Nm}}",
                                    "PstlAdr": {
                                        "AdrLine": "{{PrvsInstgAgt1.FinInstnId.PstlAdr}}"
                                    }
                                }
                            },
                            "IntrmyAgt1": {
                                "FinInstnId": {
                                    "BICFI": "{{IntrmyAgt1.FinInstnId.BICFI}}",
                                    "Nm": "{{IntrmyAgt1.FinInstnId.Nm}}",
                                    "PstlAdr": {
                                        "AdrLine": "{{IntrmyAgt1.FinInstnId.PstlAdr}}"
                                    }
                                }
                            },
                            "CdtrAgt": {
                                "FinInstnId": {
                                    "BICFI": "{{CdtrAgt.FinInstnId.BICFI}}",
                                    "ClrSysMmbId": {
                                        "MmbId": "{{CdtrAgt.FinInstnId.ClrSysMmbId.MmbId}}"
                                    },
                                    "Nm": "{{CdtrAgt.FinInstnId.Nm}}",
                                    "PstlAdr": {
                                        "AdrLine": "{{CdtrAgt.FinInstnId.PstlAdr}}"
                                    }
                                }
                            },
                            "Cdtr": {
                                "FinInstnId": {
                                    "BICFI": "{{Cdtr.FinInstnId.BICFI}}",
                                    "Nm": "{{Cdtr.FinInstnId.Nm}}",
                                    "PstlAdr": {
                                        "AdrLine": "{{Cdtr.FinInstnId.PstlAdr}}"
                                    }
                                }
                            },
                            "InstrForNxtAgt": {
                                "InstrInf": "{{InstrForNxtAgt}}"
                            },
                            "InstrForCdtrAgt": {
                                "InstrInf": "{{InstrForCdtrAgt}}"
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
            "description": "MT202 to pacs.009 with 3-lane processing (Rules, AI, Human)",
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
    """Populate MongoDB with MT202 to pacs.009 conversion configuration"""
    
    print("=" * 70)
    print("POPULATING MT202 TO PACS.009 CONVERSION CONFIGURATION")
    print("=" * 70)
    
    # Connect to MongoDB using new service
    mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    database_name = os.getenv("DATABASE_NAME", "payment_converter")
    
    db_service = MongoDBService(mongodb_uri, database_name)
    collection = db_service.db['conversion_registry']
    
    # Check if configuration already exists
    existing = collection.find_one({"_id": "MT202_to_pacs.009"})
    
    if existing:
        print("\n⚠️  Configuration already exists for MT202_to_pacs.009")
        print("   Replacing with new version...")
        
        # Delete existing configuration
        collection.delete_one({"_id": "MT202_to_pacs.009"})
        print("✓ Deleted existing configuration")
    
    # Insert new configuration
    config = create_mt202_to_pacs009_3lane_config()
    result = collection.insert_one(config)
    
    if result.inserted_id:
        print(f"✓ Successfully inserted configuration with ID: {result.inserted_id}")
    else:
        print("❌ Failed to insert configuration")
        return
    
    # Verify insertion
    verify = collection.find_one({"_id": "MT202_to_pacs.009"})
    if verify:
        print("\n✅ MT202 to pacs.009 Configuration successfully populated!")
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
        print(f"   - Target format: pacs.009 (FI to FI Core Credit Transfer)")
    else:
        print("\n❌ Verification failed - configuration not found")


if __name__ == "__main__":
    populate_database()