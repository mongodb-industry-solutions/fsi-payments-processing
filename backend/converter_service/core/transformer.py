"""
Transformer - Applies mapping rules from MongoDB configuration
Handles field transformations, mappings, and 3-lane processing (Rules, AI, Human)
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, UTC
import re
import logging
import json

logger = logging.getLogger(__name__)


class Transformer:
    """Transform parsed fields based on mapping rules from MongoDB"""
    
    def __init__(self, mappings: List[Dict[str, Any]], ai_service=None, human_review_config=None):
        """
        Initialize with mapping rules from MongoDB
        
        Args:
            mappings: List of mapping rules
            ai_service: Optional AI service for complex extractions
            human_review_config: Configuration for human review thresholds
        """
        self.mappings = mappings
        self.ai_service = ai_service
        self.human_review_config = human_review_config or {}
        
        # Initialize processing statistics
        self.processing_stats = {
            "rules_lane": {"count": 0, "fields": []},
            "ai_lane": {"count": 0, "fields": [], "cost": 0.0},
            "human_lane": {"count": 0, "fields": [], "reasons": []}
        }
        
        # Track confidence scores
        self.confidence_scores = {}
        
        # Track fields requiring human review
        self.human_review_fields = []
    
    def transform(self, parsed_fields: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply transformation rules to parsed fields with 3-lane processing
        
        Args:
            parsed_fields: Dictionary of parsed fields
            
        Returns:
            Dictionary of transformed fields ready for building
        """
        transformed = {}
        
        for mapping in self.mappings:
            source_field = mapping.get('source')
            target_fields = mapping.get('targets', [])
            transform_type = mapping.get('transform', 'copy')
            processing_lane = mapping.get('processing_lane', 'RULES')
            
            # Get source value (handle nested fields)
            source_value = self._get_field_value(parsed_fields, source_field)
            
            if source_value is None:
                continue
            
            # Process based on lane
            if processing_lane == 'AI' and transform_type == 'ai_extract':
                # AI Lane processing
                transformed_value, confidence = self._process_ai_lane(
                    source_value, 
                    source_field,
                    mapping
                )
                self.processing_stats['ai_lane']['count'] += 1
                self.processing_stats['ai_lane']['fields'].append(source_field)
                
            else:
                # Rules Lane processing
                transformed_value = self._apply_transformation(
                    source_value, 
                    transform_type, 
                    mapping
                )
                confidence = mapping.get('confidence', 1.0)
                self.processing_stats['rules_lane']['count'] += 1
                self.processing_stats['rules_lane']['fields'].append(source_field)
            
            # Store confidence score
            self.confidence_scores[source_field] = confidence
            
            # Check if human review needed
            threshold = mapping.get('confidence_threshold', 
                                   self.human_review_config.get('confidence_threshold', 0.8))
            
            if confidence < threshold:
                self.human_review_fields.append({
                    'field': source_field,
                    'confidence': confidence,
                    'reason': 'low_confidence',
                    'threshold': threshold
                })
                self.processing_stats['human_lane']['count'] += 1
                self.processing_stats['human_lane']['fields'].append(source_field)
                self.processing_stats['human_lane']['reasons'].append(
                    f"{source_field}: confidence {confidence:.2f} < threshold {threshold}"
                )
            
            # Map to target fields
            if isinstance(transformed_value, dict):
                # Multiple values returned (e.g., from AI extraction)
                for key, value in transformed_value.items():
                    for target in target_fields:
                        if key in target or target.endswith(key):
                            self._set_field_value(transformed, target, value)
            else:
                # Single value - map to all target fields
                for target in target_fields:
                    self._set_field_value(transformed, target, transformed_value)
        
        # Add system-generated fields
        transformed['current_time'] = datetime.now(UTC).isoformat()
        transformed['namespace'] = "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08"
        
        return transformed
    
    def _process_ai_lane(self, value: Any, field_name: str, mapping: Dict) -> Tuple[Any, float]:
        """
        Process field through AI lane
        
        Returns:
            Tuple of (transformed_value, confidence_score)
        """
        if not self.ai_service:
            logger.warning(f"AI service not available for field {field_name}, using fallback")
            return self._simple_extraction(value, mapping.get('targets', [])), 0.5
        
        try:
            ai_config = mapping.get('ai_config', {})
            
            # Call AI service
            result = self.ai_service.extract_field_data(
                field_value=str(value) if not isinstance(value, dict) else value.get('raw', str(value)),
                field_type=ai_config.get('field_type', 'default'),
                prompt_template=ai_config.get('prompt_template')
            )
            
            if result.get('success'):
                data = result.get('data', {})
                confidence = result.get('confidence', 0.7)
                
                # Update cost tracking
                self.processing_stats['ai_lane']['cost'] += 0.0001  # Estimate
                
                # For remittance, return the summary for Ustrd field
                if ai_config.get('field_type') == 'remittance':
                    return {
                        'Ustrd': data.get('summary', str(value)),
                        'Structured': json.dumps(data)  # Store structured data too
                    }, confidence
                
                return data, confidence
            else:
                logger.error(f"AI extraction failed for field {field_name}")
                return self._simple_extraction(value, mapping.get('targets', [])), 0.3
                
        except Exception as e:
            logger.error(f"AI processing error for field {field_name}: {e}")
            return self._simple_extraction(value, mapping.get('targets', [])), 0.3
    
    def get_processing_summary(self) -> Dict[str, Any]:
        """Get summary of processing statistics"""
        return {
            "processing_stats": self.processing_stats,
            "confidence_scores": self.confidence_scores,
            "human_review_required": len(self.human_review_fields) > 0,
            "human_review_fields": self.human_review_fields,
            "total_fields_processed": (
                self.processing_stats['rules_lane']['count'] +
                self.processing_stats['ai_lane']['count']
            )
        }
    
    def _get_field_value(self, fields: Dict[str, Any], field_path: str) -> Any:
        """
        Get field value from parsed fields, handling nested paths
        
        Examples:
            "20" -> fields["20"]
            "32A.amount" -> fields["32A"]["amount"]
            "50K.account" -> fields["50K"]["account"]
        """
        if '.' in field_path:
            parts = field_path.split('.')
            value = fields
            for part in parts:
                if isinstance(value, dict) and part in value:
                    value = value[part]
                else:
                    return None
            return value
        else:
            return fields.get(field_path)
    
    def _set_field_value(self, fields: Dict[str, Any], field_path: str, value: Any):
        """
        Set field value in transformed fields, handling nested paths
        
        Examples:
            "MsgId" -> fields["MsgId"] = value
            "DbtrAgt.BIC" -> fields["DbtrAgt"]["BIC"] = value
        """
        if '.' in field_path:
            parts = field_path.split('.')
            current = fields
            for part in parts[:-1]:
                if part not in current:
                    current[part] = {}
                current = current[part]
            current[parts[-1]] = value
        else:
            fields[field_path] = value
    
    def _apply_transformation(self, value: Any, transform_type: str, mapping: Dict) -> Any:
        """Apply specific transformation to a value"""
        
        if transform_type == 'copy':
            return value
            
        elif transform_type == 'remove_comma':
            if isinstance(value, str):
                return value.replace(',', '.')
            return value
            
        elif transform_type == 'map':
            # Value mapping (e.g., SHA -> SHAR)
            mapping_dict = mapping.get('map', {})
            return mapping_dict.get(str(value), value)
            
        elif transform_type == 'date_format':
            # Date format conversion
            input_format = mapping.get('input_format', '%y%m%d')
            output_format = mapping.get('output_format', '%Y-%m-%d')
            try:
                dt = datetime.strptime(str(value), input_format)
                return dt.strftime(output_format)
            except:
                return value
                
        elif transform_type == 'extract_account':
            # Extract account from multiline field
            if isinstance(value, dict) and 'account' in value:
                return value['account']
            elif isinstance(value, str) and value.startswith('/'):
                return value[1:]  # Remove leading /
            elif isinstance(value, dict) and 'lines' in value:
                lines = value['lines']
                if lines and lines[0].startswith('/'):
                    return lines[0][1:]
            return ''
            
        elif transform_type == 'extract_name':
            # Extract name from multiline field
            if isinstance(value, dict) and 'name' in value:
                return value['name']
            elif isinstance(value, dict) and 'lines' in value:
                lines = value['lines']
                if lines and lines[0].startswith('/'):
                    return lines[1] if len(lines) > 1 else ''
                return lines[0] if lines else ''
            elif isinstance(value, str):
                lines = value.split('\n')
                # Skip account line if it starts with /
                if lines and lines[0].startswith('/'):
                    return lines[1] if len(lines) > 1 else ''
                return lines[0] if lines else ''
            return ''
            
        elif transform_type == 'extract_address':
            # Extract address from multiline field
            if isinstance(value, dict) and 'address' in value:
                return value['address']
            elif isinstance(value, dict) and 'lines' in value:
                lines = value['lines']
                # Skip account and name lines
                start_idx = 1 if lines and lines[0].startswith('/') else 0
                start_idx += 1  # Skip name line
                if len(lines) > start_idx:
                    return ', '.join(lines[start_idx:])
            elif isinstance(value, str):
                lines = value.split('\n')
                start_idx = 1 if lines and lines[0].startswith('/') else 0
                start_idx += 1  # Skip name
                if len(lines) > start_idx:
                    return ', '.join(lines[start_idx:])
            return ''
            
        elif transform_type == 'ai_extract':
            # This should be handled by _process_ai_lane
            # If we get here, AI service wasn't available
            return self._simple_extraction(value, mapping.get('targets', []))
            
        else:
            # Unknown transformation - return as is
            return value
    
    def _simple_extraction(self, value: Any, targets: List[str]) -> Any:
        """Simple extraction logic when AI is not available"""
        if isinstance(value, dict):
            # Already structured multiline field
            if 'raw' in value:
                return value.get('raw', str(value))
            if 'lines' in value:
                return '\n'.join(value['lines'])
        return str(value)