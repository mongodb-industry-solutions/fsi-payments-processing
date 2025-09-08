#!/usr/bin/env python3
"""
Standardized script for adding new payment format conversions.
This ensures consistency and prevents common pitfalls.

Usage:
    python add_new_conversion.py --source MT202 --target pacs.009
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, UTC
from db.mdb import MongoDBConnector
import json
import argparse
from typing import Dict, List, Any
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ConversionConfigValidator:
    """Validates conversion configurations for consistency."""
    
    def __init__(self):
        self.errors = []
        self.warnings = []
    
    def validate_field_transformation(self, ft: Dict) -> bool:
        """Validate a single field transformation."""
        # Required fields
        if 'source_field' not in ft:
            self.errors.append(f"Missing 'source_field' in transformation")
            return False
        
        if 'source_type' not in ft:
            self.errors.append(f"Missing 'source_type' for field {ft.get('source_field')}")
            return False
        
        if ft['source_type'] not in ['rules', 'ai']:
            self.errors.append(f"Invalid source_type '{ft['source_type']}' for field {ft['source_field']}")
            return False
        
        if 'transformations' not in ft or not ft['transformations']:
            self.errors.append(f"Missing or empty 'transformations' for field {ft['source_field']}")
            return False
        
        # Validate each transformation
        for trans in ft['transformations']:
            if 'target_field' not in trans:
                self.errors.append(f"Missing 'target_field' in transformation for {ft['source_field']}")
                return False
            
            if 'transform_type' not in trans:
                self.errors.append(f"Missing 'transform_type' in transformation for {ft['source_field']}")
                return False
            
            # Check source_path consistency
            if 'source_path' not in trans:
                self.errors.append(f"Missing 'source_path' in transformation for {ft['source_field']}")
                return False
        
        return True
    
    def validate_prompt_structure(self, field_id: str, prompt: Dict) -> bool:
        """Validate prompt template structure."""
        if not isinstance(prompt, dict):
            self.errors.append(f"Prompt for field {field_id} must be a dictionary")
            return False
        
        if 'prompt_structure' not in prompt:
            self.errors.append(f"Missing 'prompt_structure' for field {field_id}")
            return False
        
        ps = prompt['prompt_structure']
        if 'instruction' not in ps:
            self.errors.append(f"Missing 'instruction' in prompt_structure for field {field_id}")
            return False
        
        if 'examples' in ps:
            for i, example in enumerate(ps['examples']):
                if 'input' not in example or 'output' not in example:
                    self.errors.append(f"Example {i} for field {field_id} missing 'input' or 'output'")
                    return False
                
                # Validate output is valid JSON
                try:
                    json.loads(example['output'])
                except json.JSONDecodeError:
                    self.errors.append(f"Example output for field {field_id} is not valid JSON: {example['output']}")
                    return False
        
        if 'output_format' not in prompt:
            self.warnings.append(f"Missing 'output_format' for field {field_id} (should be 'JSON')")
        
        return len(self.errors) == 0
    
    def validate_path_consistency(self, field_transformations: List[Dict], prompts: Dict) -> bool:
        """Ensure transformation paths match AI output structure."""
        for ft in field_transformations:
            if ft['source_type'] != 'ai':
                continue
            
            field_id = ft['source_field']
            
            # Check if prompt exists for AI field
            if field_id not in prompts:
                self.errors.append(f"AI field {field_id} missing prompt template")
                continue
            
            # Get expected output structure from prompt examples
            prompt = prompts[field_id]
            if 'prompt_structure' in prompt and 'examples' in prompt['prompt_structure']:
                examples = prompt['prompt_structure']['examples']
                if examples:
                    try:
                        expected_output = json.loads(examples[0]['output'])
                        
                        # Check each transformation path
                        for trans in ft['transformations']:
                            path = trans['source_path']
                            
                            # Skip if path starts with 'value.' (handled by orchestrator)
                            if path.startswith('value.'):
                                continue
                            
                            # Try to extract value using the path
                            if path and not self._can_extract_path(expected_output, path):
                                self.warnings.append(
                                    f"Path '{path}' may not exist in AI output for field {field_id}. "
                                    f"Expected structure: {json.dumps(expected_output, indent=2)}"
                                )
                    except json.JSONDecodeError:
                        pass
        
        return True
    
    def _can_extract_path(self, data: Any, path: str) -> bool:
        """Check if a path can be extracted from data."""
        if not path:
            return True
        
        parts = path.split('.')
        current = data
        
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return False
        
        return True
    
    def get_report(self) -> str:
        """Get validation report."""
        report = []
        
        if self.errors:
            report.append("❌ ERRORS (must fix):")
            for error in self.errors:
                report.append(f"  - {error}")
        
        if self.warnings:
            report.append("\n⚠️ WARNINGS (should review):")
            for warning in self.warnings:
                report.append(f"  - {warning}")
        
        if not self.errors and not self.warnings:
            report.append("✅ All validations passed!")
        
        return "\n".join(report)


class ConversionConfigBuilder:
    """Builder for creating consistent conversion configurations."""
    
    def __init__(self, source_format: str, target_format: str):
        self.source_format = source_format
        self.target_format = target_format
        self.field_transformations = []
        self.conversion_rules = []
        self.prompts = {}
        self.ai_fields = []
    
    def add_rules_field(self, source_field: str, mappings: List[Dict]) -> 'ConversionConfigBuilder':
        """Add a rules-based field mapping."""
        ft = {
            "source_field": source_field,
            "source_type": "rules",
            "transformations": []
        }
        
        for mapping in mappings:
            ft["transformations"].append({
                "source_path": mapping.get("source_path", ""),
                "target_field": mapping["target_field"],
                "transform_type": mapping.get("transform_type", "direct")
            })
        
        self.field_transformations.append(ft)
        
        # Also add to conversion_rules for backward compatibility
        for mapping in mappings:
            self.conversion_rules.append({
                "source_field": source_field,
                "target_field": mapping["target_field"],
                "mapping_type": mapping.get("transform_type", "direct")
            })
        
        return self
    
    def add_ai_field(self, 
                     source_field: str,
                     prompt_instruction: str,
                     output_structure: Dict,
                     transformations: List[Dict],
                     examples: List[Dict] = None,
                     model: str = "CLAUDE_HAIKU") -> 'ConversionConfigBuilder':
        """Add an AI-processed field with proper configuration."""
        
        # Build prompt template
        prompt = {
            "prompt_structure": {
                "system": f"You are an expert in {self.source_format} to {self.target_format} conversion.",
                "instruction": prompt_instruction,
                "examples": examples or []
            },
            "output_format": "JSON",
            "field": source_field,
            "description": f"Extract {source_field} for {self.source_format} to {self.target_format}"
        }
        
        # Ensure examples have the correct output structure
        if not examples and output_structure:
            # Generate example from output structure
            prompt["prompt_structure"]["examples"] = [{
                "input": f"<sample {source_field} content>",
                "output": json.dumps(output_structure)
            }]
        
        self.prompts[source_field] = prompt
        
        # Add field transformation
        ft = {
            "source_field": source_field,
            "source_type": "ai",
            "transformations": []
        }
        
        for trans in transformations:
            # Ensure path matches output structure
            ft["transformations"].append({
                "source_path": trans["source_path"],
                "target_field": trans["target_field"],
                "transform_type": trans.get("transform_type", "direct")
            })
        
        self.field_transformations.append(ft)
        
        # Add to AI fields configuration
        self.ai_fields.append({
            "field": source_field,
            "model": model,
            "strategy": "EXTRACTION",
            "confidence_threshold": 0.8
        })
        
        return self
    
    def build(self) -> Dict[str, Any]:
        """Build the complete configuration."""
        return {
            "conversion_config": {
                "source_format": self.source_format,
                "target_format": self.target_format,
                "is_active": True,  # Always set to true
                "field_transformations": self.field_transformations,
                "prompts": self.prompts,
                "ai_fields": self.ai_fields,
                "created_at": datetime.now(UTC),
                "version": "1.0.0"
            },
            "conversion_rules": {
                "source_format": self.source_format,
                "target_format": self.target_format,
                "is_active": True,
                "field_mappings": self.conversion_rules,
                "created_at": datetime.now(UTC)
            }
        }
    
    def validate(self) -> tuple[bool, str]:
        """Validate the configuration."""
        validator = ConversionConfigValidator()
        
        # Validate field transformations
        for ft in self.field_transformations:
            validator.validate_field_transformation(ft)
        
        # Validate prompts
        for field_id, prompt in self.prompts.items():
            validator.validate_prompt_structure(field_id, prompt)
        
        # Validate path consistency
        validator.validate_path_consistency(self.field_transformations, self.prompts)
        
        report = validator.get_report()
        is_valid = len(validator.errors) == 0
        
        return is_valid, report


def add_conversion_to_mongodb(config: Dict, db: MongoDBConnector) -> bool:
    """Add validated configuration to MongoDB."""
    try:
        # Add conversion_config
        conv_config = config["conversion_config"]
        db.get_collection("conversion_configs").replace_one(
            {
                "source_format": conv_config["source_format"],
                "target_format": conv_config["target_format"]
            },
            conv_config,
            upsert=True
        )
        logger.info(f"✅ Added conversion_config for {conv_config['source_format']} → {conv_config['target_format']}")
        
        # Add conversion_rules
        conv_rules = config["conversion_rules"]
        if conv_rules["field_mappings"]:  # Only add if there are rules
            db.get_collection("conversion_rules").replace_one(
                {
                    "source_format": conv_rules["source_format"],
                    "target_format": conv_rules["target_format"]
                },
                conv_rules,
                upsert=True
            )
            logger.info(f"✅ Added conversion_rules with {len(conv_rules['field_mappings'])} mappings")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to add configuration: {e}")
        return False


def example_mt202_to_pacs009():
    """Example of adding MT202 to pacs.009 conversion."""
    builder = ConversionConfigBuilder("MT202", "pacs.009")
    
    # Add rules-based fields
    builder.add_rules_field("20", [
        {"target_field": "MsgId"},
        {"target_field": "InstrId"},
        {"target_field": "TxId"}
    ])
    
    builder.add_rules_field("21", [
        {"target_field": "EndToEndId"},
        {"target_field": "RelatedReference"}
    ])
    
    builder.add_rules_field("32A", [
        {"source_path": "date", "target_field": "IntrBkSttlmDt", "transform_type": "date_format"},
        {"source_path": "currency", "target_field": "IntrBkSttlmAmtCcy"},
        {"source_path": "amount", "target_field": "IntrBkSttlmAmt"}
    ])
    
    # Add AI-processed fields with proper structure
    builder.add_ai_field(
        source_field="52",
        prompt_instruction="""Extract Ordering Institution from MT202 field 52.
Return JSON with exact structure: {"field52": {"accountOwner": "institution name"}}""",
        output_structure={"field52": {"accountOwner": "ACME BANK NEW YORK"}},
        transformations=[
            {"source_path": "field52.accountOwner", "target_field": "InstructingAgent"},
            {"source_path": "field52.accountOwner", "target_field": "OrderingInstitution"}
        ],
        examples=[{
            "input": "/12345678\nACME BANK NEW YORK\n100 WALL STREET",
            "output": '{"field52": {"accountOwner": "ACME BANK NEW YORK"}}'
        }]
    )
    
    builder.add_ai_field(
        source_field="56",
        prompt_instruction="""Extract Intermediary Institution from MT202 field 56.
Return JSON with exact structure: {"field56": {"accountName": "institution name"}}""",
        output_structure={"field56": {"accountName": "MIDLAND BANK PLC"}},
        transformations=[
            {"source_path": "field56.accountName", "target_field": "IntermediaryAgent1"},
            {"source_path": "field56.accountName", "target_field": "IntermediaryInstitution"}
        ]
    )
    
    builder.add_ai_field(
        source_field="57",
        prompt_instruction="""Extract Account with Institution from MT202 field 57.
Return JSON with exact structure: {"financialInstitutionIdentification": {"bic": "BIC code"}}""",
        output_structure={"financialInstitutionIdentification": {"bic": "DEUTDEFFXXX"}},
        transformations=[
            {"source_path": "financialInstitutionIdentification.bic", "target_field": "CreditorAgentBIC"},
            {"source_path": "financialInstitutionIdentification.bic", "target_field": "AccountWithInstitution"}
        ]
    )
    
    builder.add_ai_field(
        source_field="58",
        prompt_instruction="""Extract Beneficiary Institution from MT202 field 58.
Return JSON with exact structure: {"field58": {"accountOwner": "name", "accountNumber": "number"}}""",
        output_structure={"field58": {"accountOwner": "BARCLAYS BANK", "accountNumber": "DE89370400440532013000"}},
        transformations=[
            {"source_path": "field58.accountOwner", "target_field": "BeneficiaryInstitution"},
            {"source_path": "field58.accountOwner", "target_field": "Creditor"},
            {"source_path": "field58.accountNumber", "target_field": "CreditorAccount"}
        ]
    )
    
    # Fields 70 and 72 with empty path (use entire value)
    builder.add_ai_field(
        source_field="70",
        prompt_instruction="Extract remittance information from field 70. Return as JSON.",
        output_structure={"payment_reference": "INV-123", "details": "Payment for goods"},
        transformations=[
            {"source_path": "", "target_field": "RemittanceInformation", "transform_type": "json_to_string"}
        ]
    )
    
    builder.add_ai_field(
        source_field="72",
        prompt_instruction="Extract sender to receiver information from field 72. Return as JSON.",
        output_structure={"instruction": "URGENT", "reference": "ABC-123"},
        transformations=[
            {"source_path": "", "target_field": "InstructionInformation", "transform_type": "json_to_string"}
        ]
    )
    
    return builder


def main():
    """Main function to add a new conversion."""
    parser = argparse.ArgumentParser(description="Add new payment format conversion")
    parser.add_argument("--source", required=True, help="Source format (e.g., MT202)")
    parser.add_argument("--target", required=True, help="Target format (e.g., pacs.009)")
    parser.add_argument("--example", action="store_true", help="Use example configuration")
    parser.add_argument("--validate-only", action="store_true", help="Only validate, don't save")
    
    args = parser.parse_args()
    
    logger.info(f"🔧 Adding conversion: {args.source} → {args.target}")
    
    if args.example and args.source == "MT202" and args.target == "pacs.009":
        logger.info("Using example MT202 → pacs.009 configuration")
        builder = example_mt202_to_pacs009()
    else:
        logger.error("Please implement configuration for this format pair or use --example for MT202 → pacs.009")
        return False
    
    # Validate configuration
    logger.info("\n🔍 Validating configuration...")
    is_valid, report = builder.validate()
    
    print("\n" + "=" * 60)
    print("VALIDATION REPORT")
    print("=" * 60)
    print(report)
    print("=" * 60)
    
    if not is_valid:
        logger.error("\n❌ Configuration has errors. Please fix them before proceeding.")
        return False
    
    if args.validate_only:
        logger.info("\n✅ Validation complete (--validate-only mode)")
        return True
    
    # Build configuration
    config = builder.build()
    
    # Save to MongoDB
    logger.info("\n💾 Saving to MongoDB...")
    db = MongoDBConnector()
    
    if add_conversion_to_mongodb(config, db):
        logger.info("\n✅ Conversion configuration successfully added!")
        logger.info(f"Configuration saved for: {args.source} → {args.target}")
        
        # Summary
        conv_config = config["conversion_config"]
        logger.info("\n📊 Summary:")
        logger.info(f"  Total field transformations: {len(conv_config['field_transformations'])}")
        logger.info(f"  Rules-based fields: {sum(1 for ft in conv_config['field_transformations'] if ft['source_type'] == 'rules')}")
        logger.info(f"  AI-processed fields: {sum(1 for ft in conv_config['field_transformations'] if ft['source_type'] == 'ai')}")
        logger.info(f"  Prompt templates: {len(conv_config['prompts'])}")
        
        return True
    else:
        logger.error("\n❌ Failed to save configuration")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)