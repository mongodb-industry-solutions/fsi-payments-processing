#!/usr/bin/env python3
"""
Add proper prompt templates for MT202 institution fields to ensure AI outputs
match the expected transformation paths.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, UTC
from db.mdb import MongoDBConnector
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def add_mt202_prompts(db: MongoDBConnector):
    """Add specific prompts for MT202 institution fields."""
    
    # Define prompts that output the exact structure expected by transformations
    prompts = {
        "52": {
            "prompt_structure": {
                "system": "You are an expert in SWIFT MT202 message processing and ISO 20022 conversion.",
                "instruction": """Extract and structure the Ordering Institution information from this MT202 field 52.

Field 52 contains the ordering institution details in one of these formats:
- Option A: BIC code only
- Option D: Account number and institution details

Parse the field and return a JSON object with this exact structure:
{
  "field52": {
    "accountOwner": "institution name or BIC"
  }
}

If the field contains multiple lines, the first line (starting with /) is the account, 
and subsequent lines are the institution name and address. Extract the institution name.""",
                "examples": [
                    {
                        "input": "/12345678\nACME BANK NEW YORK\n100 WALL STREET\nNEW YORK, NY 10005",
                        "output": '{"field52": {"accountOwner": "ACME BANK NEW YORK"}}'
                    },
                    {
                        "input": "CHASUS33XXX",
                        "output": '{"field52": {"accountOwner": "CHASUS33XXX"}}'
                    }
                ]
            },
            "output_format": "JSON",
            "field": "52",
            "description": "Ordering Institution extraction for MT202"
        },
        "56": {
            "prompt_structure": {
                "system": "You are an expert in SWIFT MT202 message processing and ISO 20022 conversion.",
                "instruction": """Extract and structure the Intermediary Institution information from this MT202 field 56.

Field 56 contains the intermediary institution details in one of these formats:
- Option A: BIC code only
- Option C: Account number prefix
- Option D: Account number and institution details

Parse the field and return a JSON object with this exact structure:
{
  "field56": {
    "accountName": "institution name or BIC"
  }
}

If the field contains multiple lines, extract the institution name from the appropriate line.""",
                "examples": [
                    {
                        "input": "/GB98765432\nMIDLAND BANK PLC\n25 OLD BROAD STREET\nLONDON EC2N 1HN",
                        "output": '{"field56": {"accountName": "MIDLAND BANK PLC"}}'
                    },
                    {
                        "input": "MIDLGB22XXX",
                        "output": '{"field56": {"accountName": "MIDLGB22XXX"}}'
                    }
                ]
            },
            "output_format": "JSON",
            "field": "56",
            "description": "Intermediary Institution extraction for MT202"
        },
        "57": {
            "prompt_structure": {
                "system": "You are an expert in SWIFT MT202 message processing and ISO 20022 conversion.",
                "instruction": """Extract and structure the Account with Institution information from this MT202 field 57.

Field 57 contains the account with institution details in one of these formats:
- Option A: BIC code only
- Option B: Location code
- Option C: Account number prefix
- Option D: Account number and institution details

Parse the field and return a JSON object with this exact structure:
{
  "financialInstitutionIdentification": {
    "bic": "BIC code or institution name"
  }
}

Extract the BIC code if present, otherwise use the institution name.""",
                "examples": [
                    {
                        "input": "DEUTDEFFXXX",
                        "output": '{"financialInstitutionIdentification": {"bic": "DEUTDEFFXXX"}}'
                    },
                    {
                        "input": "/DE12345678901234\nDEUTSCHE BANK AG\nTAUNUSANLAGE 12\nFRANKFURT",
                        "output": '{"financialInstitutionIdentification": {"bic": "DEUTSCHE BANK AG"}}'
                    }
                ]
            },
            "output_format": "JSON",
            "field": "57",
            "description": "Account with Institution extraction for MT202"
        },
        "58": {
            "prompt_structure": {
                "system": "You are an expert in SWIFT MT202 message processing and ISO 20022 conversion.",
                "instruction": """Extract and structure the Beneficiary Institution information from this MT202 field 58.

Field 58 contains the beneficiary institution details in one of these formats:
- Option A: BIC code only
- Option D: Account number and institution details

Parse the field and return a JSON object with this exact structure:
{
  "field58": {
    "accountOwner": "institution name or BIC",
    "accountNumber": "account number if present"
  }
}

If the field starts with /, extract it as the account number. Extract the institution name from subsequent lines.""",
                "examples": [
                    {
                        "input": "/DE89370400440532013000\nBARCLAYS BANK FRANKFURT\nTAUNUSANLAGE 12\nFRANKFURT",
                        "output": '{"field58": {"accountOwner": "BARCLAYS BANK FRANKFURT", "accountNumber": "DE89370400440532013000"}}'
                    },
                    {
                        "input": "BARCDEFXXXX",
                        "output": '{"field58": {"accountOwner": "BARCDEFXXXX", "accountNumber": ""}}'
                    }
                ]
            },
            "output_format": "JSON",
            "field": "58",
            "description": "Beneficiary Institution extraction for MT202"
        },
        "70": {
            "prompt_structure": {
                "system": "You are an expert in SWIFT MT202 message processing and ISO 20022 conversion.",
                "instruction": """Extract and structure the Remittance Information from this MT202 field 70.

Field 70 contains payment details and remittance information. Parse and structure the information into a clear format.

Return the extracted information as a JSON object with relevant details.""",
                "examples": [
                    {
                        "input": "/INV/2024-11-3847 DATED 15.11.2024\n/PO/8934567 QTY 5000 UNITS",
                        "output": '{"invoice": "2024-11-3847", "date": "15.11.2024", "purchase_order": "8934567", "quantity": "5000 UNITS"}'
                    }
                ]
            },
            "output_format": "JSON",
            "field": "70",
            "description": "Remittance Information extraction for MT202"
        },
        "72": {
            "prompt_structure": {
                "system": "You are an expert in SWIFT MT202 message processing and ISO 20022 conversion.",
                "instruction": """Extract and structure the Sender to Receiver Information from this MT202 field 72.

Field 72 contains instructions and information from sender to receiver. Parse and structure the information.

Return the extracted information as a JSON object with relevant details.""",
                "examples": [
                    {
                        "input": "/INS/URGENT - SAME DAY VALUE\n/BNF/BENEFICIARY REF: ABC-123",
                        "output": '{"instruction": "URGENT - SAME DAY VALUE", "beneficiary_reference": "ABC-123"}'
                    }
                ]
            },
            "output_format": "JSON",
            "field": "72",
            "description": "Sender to Receiver Information extraction for MT202"
        }
    }
    
    # Get the collection
    collection = db.get_collection('conversion_configs')
    
    # Update the conversion config with prompts
    result = collection.update_one(
        {'source_format': 'MT202', 'target_format': 'pacs.009'},
        {'$set': {
            'prompts': prompts,
            'updated_at': datetime.now(UTC),
            'prompt_version': '2.0.0'
        }}
    )
    
    logger.info(f"✅ Added prompts for {len(prompts)} fields")
    logger.info(f"Updated {result.modified_count} document(s)")
    
    # Also ensure AI fields are properly configured
    ai_fields = []
    for field_id in ['52', '56', '57', '58', '70', '72']:
        ai_fields.append({
            "field": field_id,
            "model": "CLAUDE_HAIKU",  # Use Haiku for cost optimization
            "strategy": "EXTRACTION",
            "confidence_threshold": 0.8
        })
    
    # Update ai_fields in the config
    result2 = collection.update_one(
        {'source_format': 'MT202', 'target_format': 'pacs.009'},
        {'$set': {
            'ai_fields': ai_fields
        }}
    )
    
    logger.info(f"✅ Updated AI fields configuration")
    
    return True


def verify_prompts(db: MongoDBConnector):
    """Verify the prompts were added correctly."""
    
    collection = db.get_collection('conversion_configs')
    config = collection.find_one({
        'source_format': 'MT202',
        'target_format': 'pacs.009'
    })
    
    if config and 'prompts' in config:
        prompts = config['prompts']
        logger.info(f"\n📋 Prompts configured for fields: {list(prompts.keys())}")
        
        # Check each critical field
        for field in ['52', '56', '57', '58']:
            if field in prompts:
                logger.info(f"  ✅ Field {field}: Prompt configured")
                # Show expected output structure
                if 'examples' in prompts[field].get('prompt_structure', {}):
                    examples = prompts[field]['prompt_structure']['examples']
                    if examples:
                        logger.info(f"     Expected output: {examples[0].get('output', 'N/A')[:80]}...")
            else:
                logger.warning(f"  ⚠️ Field {field}: No prompt configured")
    else:
        logger.error("❌ No prompts found in configuration")
    
    return True


def main():
    """Run the prompt addition script."""
    logger.info("🔧 Adding MT202 prompt templates...")
    
    db = MongoDBConnector()
    
    if not add_mt202_prompts(db):
        logger.error("Failed to add prompts")
        return False
    
    logger.info("\n🔍 Verifying prompts...")
    verify_prompts(db)
    
    logger.info("\n✅ MT202 prompts successfully configured!")
    logger.info("The AI will now output data in the correct format for field transformations.")
    
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)