"""
MongoDB-driven universal parser that reads parsing rules from database.
This parser can handle any format defined in the parser_configs collection.
"""

import re
from typing import Dict, Any, Optional
from .base_parser import BaseParser
import logging

logger = logging.getLogger(__name__)


class MongoDBDrivenParser(BaseParser):
    """Universal parser driven entirely by MongoDB configuration"""
    
    def __init__(self, db_connector, format_type: str):
        """Initialize parser with format type and load config from MongoDB"""
        self._format_type = format_type  # Set this before calling super().__init__
        super().__init__(db_connector)
        self.parser_config = self._load_parser_config()
        
        if not self.parser_config:
            raise ValueError(f"No parser configuration found for format: {format_type}")
        
        logger.info(f"Loaded parser config for {format_type} with {len(self.parser_config.get('field_patterns', {}))} fields")
    
    @property
    def format_type(self) -> str:
        """Return the format type this parser handles"""
        return self._format_type
    
    def _load_parser_config(self) -> Optional[Dict]:
        """Load parser configuration from MongoDB"""
        configs = self.db.find("parser_configs", {
            "format": self._format_type,
            "is_active": True
        })
        
        if configs:
            return configs[0]
        return None
    
    def parse(self, raw_message: str) -> Dict[str, Any]:
        """Parse message using MongoDB-defined rules"""
        if not self.parser_config:
            raise ValueError(f"No parser configuration loaded for {self._format_type}")
        
        parsed_fields = {}
        
        # Extract message blocks if block parser is defined
        message_content = raw_message
        if 'block_parser' in self.parser_config:
            blocks = self._parse_blocks(raw_message)
            content_block = self.parser_config['block_parser'].get('content_block', '4')
            
            if content_block not in blocks:
                raise ValueError(f"Required content block {content_block} not found in message")
            
            message_content = blocks[content_block]
        
        # Extract fields using configured patterns
        field_patterns = self.parser_config.get('field_patterns', {})
        
        for field_id, field_config in field_patterns.items():
            pattern = field_config.get('pattern')
            field_type = field_config.get('type', 'regex')
            
            if not pattern:
                logger.warning(f"No pattern defined for field {field_id}")
                continue
            
            # Extract field based on type
            field_value = self._extract_field(
                message_content, 
                pattern, 
                field_type, 
                field_config
            )
            
            if field_value is not None:
                parsed_fields[field_id] = field_value
                logger.debug(f"Extracted field {field_id}: {str(field_value)[:50]}...")
        
        # Validate required fields
        self._validate_required_fields(parsed_fields)
        
        return parsed_fields
    
    def _parse_blocks(self, raw_message: str) -> Dict[str, str]:
        """Parse message blocks using configured pattern"""
        blocks = {}
        
        block_pattern = self.parser_config['block_parser'].get('pattern')
        if not block_pattern:
            return {'default': raw_message}
        
        matches = re.findall(block_pattern, raw_message)
        
        for block_id, block_content in matches:
            blocks[block_id] = block_content.strip()
        
        return blocks
    
    def _extract_field(self, message: str, pattern: str, field_type: str, config: Dict) -> Any:
        """Extract field value based on configured extraction type"""
        
        if field_type == 'regex':
            return self._extract_regex(message, pattern)
        
        elif field_type == 'multiline':
            return self._extract_multiline(message, pattern)
        
        elif field_type == 'structured':
            # For structured fields like 32A with components
            raw_value = self._extract_regex(message, pattern)
            if raw_value and 'components' in config:
                return self._parse_structured_field(raw_value, config['components'])
            return raw_value
        
        elif field_type == 'fixed_position':
            # For fixed-position formats (future use)
            return self._extract_fixed_position(message, config)
        
        else:
            logger.warning(f"Unknown field type: {field_type}")
            return None
    
    def _extract_regex(self, message: str, pattern: str) -> Optional[str]:
        """Extract field using regex pattern"""
        try:
            match = re.search(pattern, message)
            if match:
                return match.group(1).strip()
        except Exception as e:
            logger.error(f"Regex extraction failed for pattern {pattern}: {e}")
        return None
    
    def _extract_multiline(self, message: str, pattern: str) -> Optional[str]:
        """Extract multiline field using regex with DOTALL flag"""
        try:
            match = re.search(pattern, message, re.DOTALL)
            if match:
                return match.group(1).strip()
        except Exception as e:
            logger.error(f"Multiline extraction failed for pattern {pattern}: {e}")
        return None
    
    def _parse_structured_field(self, raw_value: str, components: Dict) -> Dict[str, str]:
        """Parse structured field into components"""
        result = {'raw_value': raw_value}
        
        for component_name, component_config in components.items():
            start = component_config.get('start', 0)
            length = component_config.get('length')
            
            if length == 'remaining':
                component_value = raw_value[start:]
            elif isinstance(length, int):
                component_value = raw_value[start:start + length]
            else:
                component_value = raw_value[start:]
            
            result[component_name] = component_value.strip()
        
        return result
    
    def _extract_fixed_position(self, message: str, config: Dict) -> Optional[str]:
        """Extract field from fixed position (for future formats like ISO8583)"""
        position = config.get('position', [])
        if len(position) == 2:
            start, length = position
            return message[start:start + length].strip()
        return None
    
    def _validate_required_fields(self, parsed_fields: Dict[str, Any]):
        """Validate that all required fields are present"""
        validation_rules = self.parser_config.get('validation_rules', {})
        required_fields = validation_rules.get('required_fields', [])
        
        missing_fields = []
        for field_id in required_fields:
            if field_id not in parsed_fields:
                missing_fields.append(field_id)
        
        if missing_fields:
            logger.warning(f"Missing required fields: {missing_fields}")
    
    def get_field_info(self, field_id: str) -> Dict[str, Any]:
        """Get information about a specific field"""
        field_patterns = self.parser_config.get('field_patterns', {})
        
        if field_id in field_patterns:
            return field_patterns[field_id]
        
        return {}
    
    def get_all_field_ids(self) -> list:
        """Get list of all configured field IDs"""
        return list(self.parser_config.get('field_patterns', {}).keys())