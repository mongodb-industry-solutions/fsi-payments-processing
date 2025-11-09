"""Extractor - Pattern-based field extraction"""

import re
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class Extractor:
    """
    Extract fields from messages using regex patterns.
    
    Handles various message formats (SWIFT, XML, JSON, etc.) using
    configurable regex patterns from MongoDB.
    """
    
    def extract(self, message: str, patterns: Dict[str, str]) -> Dict[str, Any]:
        """
        Extract fields from message using regex patterns.
        
        Args:
            message: Source message text (SWIFT, XML, JSON, etc.)
            patterns: Dictionary of field_id -> regex_pattern from config
            
        Returns:
            Dictionary of field_id -> extracted_value
            
        Example:
            patterns = {
                "20": r":20:([^\n:]+)",
                "32A": r":32A:([^\n:]+)"
            }
            result = extractor.extract(message, patterns)
            # Returns: {"20": "REF123", "32A": "241215USD10000"}
        """
        extracted_fields = {}
        
        if not message or not patterns:
            logger.warning("Empty message or patterns provided")
            return extracted_fields
        
        for field_id, pattern in patterns.items():
            try:
                # Use MULTILINE and DOTALL flags for complex patterns
                match = re.search(pattern, message, re.MULTILINE | re.DOTALL)
                
                if match:
                    # Get first capture group
                    extracted_value = match.group(1).strip()
                    extracted_fields[field_id] = extracted_value
                    logger.debug(f"Extracted {field_id}: {extracted_value[:50]}...")
                else:
                    logger.debug(f"No match for field {field_id}")
                    
            except re.error as e:
                logger.error(f"Invalid regex pattern for field {field_id}: {e}")
            except IndexError:
                logger.warning(f"Pattern for {field_id} has no capture group")
            except Exception as e:
                logger.error(f"Error extracting field {field_id}: {e}")
        
        logger.info(f"Extracted {len(extracted_fields)} fields from message")
        return extracted_fields
    
    def validate_patterns(self, patterns: Dict[str, str]) -> Dict[str, bool]:
        """
        Validate regex patterns before extraction.
        
        Args:
            patterns: Dictionary of field_id -> regex_pattern
            
        Returns:
            Dictionary of field_id -> is_valid (bool)
        """
        validation_results = {}
        
        for field_id, pattern in patterns.items():
            try:
                re.compile(pattern)
                validation_results[field_id] = True
            except re.error:
                validation_results[field_id] = False
                logger.error(f"Invalid pattern for {field_id}: {pattern}")
        
        return validation_results
