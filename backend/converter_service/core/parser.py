"""
Generic Parser - Completely driven by MongoDB configuration
No hardcoded field definitions or patterns
"""

import re
from typing import Dict, Any, Optional


class GenericParser:
    """Parse any format based on patterns from MongoDB config"""
    
    def __init__(self, parser_config: Dict[str, Any]):
        """
        Initialize with parser configuration from MongoDB
        
        Args:
            parser_config: Parser configuration containing:
                - type: Parser type (regex, json, xml, etc.)
                - fields: Field extraction patterns
                - block_pattern: Optional pattern for block-based formats
        """
        self.config = parser_config
        self.type = parser_config.get('type', 'regex')
        self.fields = parser_config.get('fields', {})
        
    def parse(self, raw_message: str) -> Dict[str, Any]:
        """
        Parse raw message based on configuration
        
        Args:
            raw_message: Raw input message
            
        Returns:
            Dictionary of parsed fields
        """
        if self.type == 'regex':
            return self._parse_regex(raw_message)
        elif self.type == 'json':
            return self._parse_json(raw_message)
        elif self.type == 'xml':
            return self._parse_xml(raw_message)
        else:
            raise ValueError(f"Unsupported parser type: {self.type}")
    
    def _parse_regex(self, raw_message: str) -> Dict[str, Any]:
        """Parse using regex patterns"""
        parsed_fields = {}
        
        # Handle block-based formats (like SWIFT)
        content = raw_message
        if 'block_pattern' in self.config:
            blocks = self._extract_blocks(raw_message)
            content_block = self.config.get('content_block', '4')
            if content_block in blocks:
                content = blocks[content_block]
            else:
                content = raw_message
        
        # Extract each field using patterns from config
        for field_id, field_config in self.fields.items():
            pattern = field_config.get('pattern')
            if not pattern:
                continue
                
            match = re.search(pattern, content)
            if match:
                value = match.group(1).strip() if match.groups() else match.group(0)
                
                # Handle composite fields (like 32A)
                if 'components' in field_config:
                    parsed_value = self._parse_components(value, field_config['components'])
                    parsed_fields[field_id] = parsed_value
                # Handle multiline fields
                elif field_config.get('multiline'):
                    parsed_fields[field_id] = self._parse_multiline(value)
                else:
                    parsed_fields[field_id] = value
        
        return parsed_fields
    
    def _extract_blocks(self, raw_message: str) -> Dict[str, str]:
        """Extract blocks from block-based formats"""
        blocks = {}
        block_pattern = self.config.get('block_pattern', r'\{([1-4]):([^}]*)\}')
        matches = re.findall(block_pattern, raw_message)
        
        for block_num, block_content in matches:
            blocks[block_num] = block_content.strip()
        
        return blocks
    
    def _parse_components(self, value: str, components: Dict[str, Any]) -> Dict[str, str]:
        """Parse composite fields into components"""
        result = {'raw': value}
        
        for component_name, indices in components.items():
            if isinstance(indices, list) and len(indices) == 2:
                start, end = indices
                if end is None:
                    result[component_name] = value[start:]
                else:
                    result[component_name] = value[start:end]
            elif isinstance(indices, dict):
                # More complex parsing logic from config
                if 'pattern' in indices:
                    match = re.search(indices['pattern'], value)
                    if match:
                        result[component_name] = match.group(1)
        
        # Special handling for amount fields - remove commas
        if 'amount' in result:
            result['amount'] = result['amount'].replace(',', '.')
        
        return result
    
    def _parse_multiline(self, value: str) -> Dict[str, Any]:
        """Parse multiline fields into structured data"""
        lines = value.split('\n')
        result = {
            'raw': value,
            'lines': lines,
            'line_count': len(lines)
        }
        
        # Extract account if first line starts with /
        if lines and lines[0].startswith('/'):
            result['account'] = lines[0][1:]  # Remove the leading /
            result['name'] = lines[1] if len(lines) > 1 else ''
            result['address'] = '\n'.join(lines[2:]) if len(lines) > 2 else ''
        else:
            result['name'] = lines[0] if lines else ''
            result['address'] = '\n'.join(lines[1:]) if len(lines) > 1 else ''
        
        return result
    
    def _parse_json(self, raw_message: str) -> Dict[str, Any]:
        """Parse JSON format messages with error handling"""
        try:
            import json
            parsed = json.loads(raw_message)
            if not isinstance(parsed, dict):
                # Wrap non-dict results in a dict
                return {"data": parsed}
            return parsed
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON format: {e}")
        except Exception as e:
            raise ValueError(f"Error parsing JSON: {e}")
    
    def _parse_xml(self, raw_message: str) -> Dict[str, Any]:
        """Parse XML format - not yet implemented for demo"""
        raise NotImplementedError(
            "XML parsing is not yet implemented. "
            "Please use MT (regex) or JSON formats for now."
        )