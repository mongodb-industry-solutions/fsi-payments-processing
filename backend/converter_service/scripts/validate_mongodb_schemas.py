#!/usr/bin/env python3
"""
MongoDB Schema Validation Script
Validates conversion configurations against both current practice and best practices
"""

import sys
import os
import re
from typing import Dict, List, Tuple, Any
from datetime import datetime
import json
from collections import defaultdict

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.db_service import MongoDBService
from config.settings import get_settings
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SchemaValidator:
    """Validates MongoDB schemas and configurations"""
    
    def __init__(self):
        settings = get_settings()
        self.db_service = MongoDBService(settings.mongodb_uri, settings.database_name)
        self.validation_results = {
            "conversion_registry": [],
            "semantic_patterns": [],
            "conversion_graph": [],
            "conversion_paths": [],
            "canonical_json": []
        }
        self.stats = defaultdict(int)
    
    def validate_conversion_registry(self) -> List[Dict[str, Any]]:
        """Validate all conversion_registry configurations"""
        logger.info("=== Validating conversion_registry ===")
        results = []
        
        configs = list(self.db_service.db.conversion_registry.find({}))
        self.stats["total_configs"] = len(configs)
        
        for config in configs:
            config_id = config.get("_id", "unknown")
            errors = []
            warnings = []
            info = []
            
            # 1. Check required fields
            required = ["_id", "parser", "mappings", "builder"]
            for field in required:
                if field not in config:
                    errors.append(f"Missing required field: {field}")
            
            # 2. Validate ID format
            if "_id" in config:
                if not re.match(r'^[A-Za-z0-9\.]+_to_[A-Za-z0-9\.]+$', config["_id"]):
                    errors.append(f"Invalid ID format: {config['_id']}")
            
            # 3. Check parser
            if "parser" in config:
                parser = config["parser"]
                if "type" not in parser:
                    errors.append("Parser missing 'type' field")
                elif parser["type"] not in ["regex", "xml", "json", "template"]:
                    warnings.append(f"Unknown parser type: {parser['type']}")
                
                if "fields" not in parser or not parser["fields"]:
                    errors.append("Parser has no fields defined")
            
            # 4. Check mappings
            if "mappings" in config:
                if not config["mappings"]:
                    errors.append("Mappings array is empty")
                
                for i, mapping in enumerate(config["mappings"]):
                    # Check required mapping fields
                    if "source" not in mapping:
                        errors.append(f"Mapping {i}: Missing 'source'")
                    if "targets" not in mapping:
                        errors.append(f"Mapping {i}: Missing 'targets'")
                    if "processing_lane" not in mapping:
                        warnings.append(f"Mapping {i}: Missing 'processing_lane' (will default to RULES)")
                    
                    # Check for nested paths vs flat variables
                    if "targets" in mapping:
                        for target in mapping["targets"]:
                            if "." in target:
                                # Check if this is for XML (pacs/ISO20022)
                                if config_id.endswith(("_to_pacs.008", "_to_pacs.009", "_to_CHAPS", "_to_TARGET2")):
                                    info.append(f"Mapping {i}: Target '{target}' uses XML path notation (valid for pacs)")
                                elif config_id.endswith("_to_JSON"):
                                    info.append(f"Mapping {i}: Target '{target}' uses nested JSON path")
                                else:
                                    warnings.append(
                                        f"Mapping {i}: Target '{target}' uses nested path. "
                                        f"Consider flat variables for template-based approach"
                                    )
                    
                    # Validate processing lane
                    if "processing_lane" in mapping:
                        if mapping["processing_lane"] not in ["RULES", "AI", "HUMAN"]:
                            errors.append(f"Mapping {i}: Invalid processing_lane: {mapping['processing_lane']}")
                        
                        # AI lane validation
                        if mapping["processing_lane"] == "AI":
                            if "field_type" not in mapping:
                                warnings.append(f"Mapping {i}: AI lane should have 'field_type'")
                            if mapping.get("transform") != "ai_extract":
                                warnings.append(f"Mapping {i}: AI lane should use 'ai_extract' transform")
            
            # 5. Check builder
            if "builder" in config:
                builder = config["builder"]
                if "type" not in builder:
                    errors.append("Builder missing 'type' field")
                
                # Check for template vs structure
                has_template = "template" in builder
                has_structure = "structure" in builder
                
                if has_structure and not has_template:
                    warnings.append("Builder uses deprecated 'structure'. Should use 'template' with {{placeholders}}")
                elif has_template:
                    info.append("Builder correctly uses 'template' approach")
                    
                    # Validate template placeholders match targets
                    if "mappings" in config:
                        template_str = str(builder["template"])
                        placeholders = set(re.findall(r'{{([^}]+)}}', template_str))
                        
                        target_vars = set()
                        for mapping in config["mappings"]:
                            if "targets" in mapping:
                                target_vars.update(mapping["targets"])
                        
                        # System variables
                        system_vars = {"current_time", "sender_bic", "receiver_bic", "message_id"}
                        
                        # Check for orphaned placeholders
                        orphaned = placeholders - target_vars - system_vars
                        if orphaned:
                            warnings.append(f"Template has undefined placeholders: {orphaned}")
                        
                        # Check for unused variables
                        unused = target_vars - placeholders - system_vars
                        if unused and len(unused) < len(target_vars) * 0.5:  # Only warn if less than 50% unused
                            info.append(f"Some mappings create unused variables: {list(unused)[:5]}...")
            
            # 6. Check AI service configuration
            has_ai_mappings = any(
                m.get("processing_lane") == "AI" 
                for m in config.get("mappings", [])
            )
            
            if has_ai_mappings and "ai_service" not in config:
                warnings.append("Has AI mappings but missing 'ai_service' configuration")
            
            # Compile results
            result = {
                "config_id": config_id,
                "errors": errors,
                "warnings": warnings,
                "info": info,
                "valid": len(errors) == 0
            }
            
            # Update stats
            if errors:
                self.stats["configs_with_errors"] += 1
            if warnings:
                self.stats["configs_with_warnings"] += 1
            
            results.append(result)
        
        return results
    
    def validate_semantic_patterns(self) -> List[Dict[str, Any]]:
        """Validate semantic_patterns collection"""
        logger.info("=== Validating semantic_patterns ===")
        results = []
        
        patterns = list(self.db_service.db.semantic_patterns.find({}))
        self.stats["total_patterns"] = len(patterns)
        
        for pattern in patterns:
            pattern_id = pattern.get("_id", "unknown")
            errors = []
            warnings = []
            
            # Check required fields
            required = ["_id", "concept", "description", "known_fields"]
            for field in required:
                if field not in pattern:
                    errors.append(f"Missing required field: {field}")
            
            # Validate learned patterns structure
            if "learned_patterns" in pattern:
                for format_name, format_pattern in pattern["learned_patterns"].items():
                    if not isinstance(format_pattern, dict):
                        errors.append(f"Invalid pattern structure for format: {format_name}")
                    else:
                        # Check pattern fields
                        if "field" not in format_pattern:
                            warnings.append(f"Pattern for {format_name} missing 'field'")
                        if "targets" in format_pattern:
                            for target in format_pattern["targets"]:
                                if "." in target and format_name not in ["pacs.008", "pacs.009", "JSON"]:
                                    warnings.append(f"Pattern {format_name}: Target '{target}' uses nested path")
            
            result = {
                "pattern_id": pattern_id,
                "errors": errors,
                "warnings": warnings,
                "valid": len(errors) == 0
            }
            
            if errors:
                self.stats["patterns_with_errors"] += 1
            
            results.append(result)
        
        return results
    
    def validate_conversion_graph(self) -> List[Dict[str, Any]]:
        """Validate conversion_graph collection"""
        logger.info("=== Validating conversion_graph ===")
        results = []
        
        edges = list(self.db_service.db.conversion_graph.find({}))
        self.stats["total_edges"] = len(edges)
        
        # Get all conversion configs
        all_configs = set(self.db_service.db.conversion_registry.distinct("_id"))
        
        for edge in edges:
            errors = []
            warnings = []
            
            # Check required fields
            required = ["source", "target", "conversion_id"]
            for field in required:
                if field not in edge:
                    errors.append(f"Missing required field: {field}")
            
            # Validate conversion_id exists
            if "conversion_id" in edge:
                if edge["conversion_id"] not in all_configs:
                    errors.append(f"Conversion config '{edge['conversion_id']}' not found in registry")
                
                # Check consistency
                expected_id = f"{edge.get('source', '')}_{edge.get('target', '')}"
                if not edge["conversion_id"].startswith(edge.get("source", "")):
                    warnings.append(f"Conversion ID doesn't match source: {edge['conversion_id']}")
            
            result = {
                "edge": f"{edge.get('source', '?')} → {edge.get('target', '?')}",
                "errors": errors,
                "warnings": warnings,
                "valid": len(errors) == 0
            }
            
            if errors:
                self.stats["edges_with_errors"] += 1
            
            results.append(result)
        
        return results
    
    def validate_conversion_paths(self) -> List[Dict[str, Any]]:
        """Validate conversion_paths collection"""
        logger.info("=== Validating conversion_paths ===")
        results = []
        
        paths = list(self.db_service.db.conversion_paths.find({}))
        self.stats["total_paths"] = len(paths)
        
        for path_doc in paths:
            path_id = path_doc.get("_id", "unknown")
            errors = []
            warnings = []
            
            # Check required fields
            required = ["source", "target", "path", "hop_count"]
            for field in required:
                if field not in path_doc:
                    errors.append(f"Missing required field: {field}")
            
            # Validate path structure
            if "path" in path_doc:
                if not isinstance(path_doc["path"], list):
                    errors.append("Path must be an array")
                elif len(path_doc["path"]) == 0:
                    errors.append("Path is empty")
                else:
                    # Validate each step
                    for i, step in enumerate(path_doc["path"]):
                        if "conversion_id" not in step:
                            errors.append(f"Step {i}: Missing conversion_id")
                
                # Check hop count consistency
                if "hop_count" in path_doc:
                    if path_doc["hop_count"] != len(path_doc["path"]):
                        warnings.append(f"Hop count mismatch: {path_doc['hop_count']} != {len(path_doc['path'])}")
            
            result = {
                "path_id": path_id,
                "errors": errors,
                "warnings": warnings,
                "valid": len(errors) == 0
            }
            
            if errors:
                self.stats["paths_with_errors"] += 1
            
            results.append(result)
        
        return results
    
    def validate_canonical_json_structure(self) -> List[Dict[str, Any]]:
        """Validate canonical JSON structure in X_to_JSON configs"""
        logger.info("=== Validating Canonical JSON Structure ===")
        results = []
        
        # Find all X_to_JSON configs
        json_configs = list(self.db_service.db.conversion_registry.find(
            {"_id": {"$regex": "_to_JSON$"}}
        ))
        
        canonical_structure = {
            "header": ["message_type", "timestamp"],
            "transaction": ["reference"],
            "amounts": ["instructed"],
            "dates": ["value_date"],
            "processing_metadata": ["conversion_timestamp", "source_format", "target_format"]
        }
        
        for config in json_configs:
            config_id = config["_id"]
            errors = []
            warnings = []
            info = []
            
            if "builder" in config and "template" in config["builder"]:
                template = config["builder"]["template"]
                
                # Check required top-level fields
                for required_field in canonical_structure.keys():
                    if required_field not in template:
                        if required_field in ["header", "transaction", "amounts", "dates", "processing_metadata"]:
                            errors.append(f"Missing required canonical field: {required_field}")
                        else:
                            warnings.append(f"Missing optional canonical field: {required_field}")
                
                # Check for unexpected top-level fields
                allowed_fields = {
                    "header", "transaction", "parties", "amounts", "dates",
                    "remittance", "instructions", "references", "charges",
                    "regulatory", "original_fields", "processing_metadata"
                }
                
                if isinstance(template, dict):
                    unexpected = set(template.keys()) - allowed_fields
                    if unexpected:
                        warnings.append(f"Non-canonical top-level fields: {unexpected}")
            
            result = {
                "config_id": config_id,
                "errors": errors,
                "warnings": warnings,
                "info": info,
                "valid": len(errors) == 0
            }
            
            results.append(result)
        
        return results
    
    def generate_report(self) -> str:
        """Generate validation report"""
        report = []
        report.append("=" * 80)
        report.append("MongoDB Schema Validation Report")
        report.append(f"Generated: {datetime.now().isoformat()}")
        report.append("=" * 80)
        
        # Overall statistics
        report.append("\n## Overall Statistics")
        report.append(f"- Total configs: {self.stats['total_configs']}")
        report.append(f"- Configs with errors: {self.stats['configs_with_errors']}")
        report.append(f"- Configs with warnings: {self.stats['configs_with_warnings']}")
        report.append(f"- Total patterns: {self.stats['total_patterns']}")
        report.append(f"- Total graph edges: {self.stats['total_edges']}")
        report.append(f"- Total cached paths: {self.stats['total_paths']}")
        
        # Conversion registry details
        report.append("\n## Conversion Registry Validation")
        for result in self.validation_results["conversion_registry"]:
            if result["errors"] or result["warnings"]:
                report.append(f"\n### {result['config_id']}")
                if result["errors"]:
                    report.append("❌ ERRORS:")
                    for error in result["errors"]:
                        report.append(f"  - {error}")
                if result["warnings"]:
                    report.append("⚠️  WARNINGS:")
                    for warning in result["warnings"]:
                        report.append(f"  - {warning}")
        
        # Semantic patterns details
        if any(r["errors"] for r in self.validation_results["semantic_patterns"]):
            report.append("\n## Semantic Patterns Validation")
            for result in self.validation_results["semantic_patterns"]:
                if result["errors"]:
                    report.append(f"\n### {result['pattern_id']}")
                    report.append("❌ ERRORS:")
                    for error in result["errors"]:
                        report.append(f"  - {error}")
        
        # Graph validation
        if any(r["errors"] for r in self.validation_results["conversion_graph"]):
            report.append("\n## Conversion Graph Validation")
            for result in self.validation_results["conversion_graph"]:
                if result["errors"]:
                    report.append(f"\n### Edge: {result['edge']}")
                    for error in result["errors"]:
                        report.append(f"  - {error}")
        
        # Canonical JSON validation
        if self.validation_results["canonical_json"]:
            report.append("\n## Canonical JSON Structure Validation")
            for result in self.validation_results["canonical_json"]:
                if result["errors"] or result["warnings"]:
                    report.append(f"\n### {result['config_id']}")
                    if result["errors"]:
                        report.append("❌ ERRORS:")
                        for error in result["errors"]:
                            report.append(f"  - {error}")
                    if result["warnings"]:
                        report.append("⚠️  WARNINGS:")
                        for warning in result["warnings"]:
                            report.append(f"  - {warning}")
        
        # Summary
        report.append("\n" + "=" * 80)
        total_errors = sum(
            len(r.get("errors", [])) 
            for results in self.validation_results.values() 
            for r in results
        )
        
        if total_errors == 0:
            report.append("✅ VALIDATION PASSED - No critical errors found")
        else:
            report.append(f"❌ VALIDATION FAILED - {total_errors} errors found")
        
        return "\n".join(report)
    
    def run_validation(self) -> None:
        """Run all validations"""
        logger.info("Starting MongoDB schema validation...")
        
        # Run validations
        self.validation_results["conversion_registry"] = self.validate_conversion_registry()
        self.validation_results["semantic_patterns"] = self.validate_semantic_patterns()
        self.validation_results["conversion_graph"] = self.validate_conversion_graph()
        self.validation_results["conversion_paths"] = self.validate_conversion_paths()
        self.validation_results["canonical_json"] = self.validate_canonical_json_structure()
        
        # Generate and print report
        report = self.generate_report()
        print(report)
        
        # Save report to file
        report_file = "validation_report.txt"
        with open(report_file, "w") as f:
            f.write(report)
        logger.info(f"Report saved to {report_file}")
        
        # Return exit code
        total_errors = sum(
            len(r.get("errors", [])) 
            for results in self.validation_results.values() 
            for r in results
        )
        
        return 0 if total_errors == 0 else 1


def main():
    """Main function"""
    try:
        validator = SchemaValidator()
        exit_code = validator.run_validation()
        sys.exit(exit_code)
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()