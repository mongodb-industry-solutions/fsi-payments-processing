"""
MongoDB-driven universal builder that reads building rules from database.
This builder can handle any format defined in the builder_configs collection.
"""

import re
from typing import Dict, Any, Optional
from datetime import datetime, UTC
from .base_builder import BaseBuilder
import xml.etree.ElementTree as ET
from xml.dom import minidom
import logging

logger = logging.getLogger(__name__)


class MongoDBDrivenBuilder(BaseBuilder):
    """Universal builder driven entirely by MongoDB configuration"""
    
    def __init__(self, db_connector, format_type: str):
        """Initialize builder with format type and load config from MongoDB"""
        self._format_type = format_type  # Set this before calling super().__init__
        super().__init__(db_connector)
        self.builder_config = self._load_builder_config()
        
        if not self.builder_config:
            raise ValueError(f"No builder configuration found for format: {format_type}")
        
        logger.info(f"Loaded builder config for {format_type} with {len(self.builder_config.get('field_mappings', []))} mappings")
    
    @property
    def format_type(self) -> str:
        """Return the format type this builder creates"""
        return self._format_type
    
    def _load_builder_config(self) -> Optional[Dict]:
        """Load builder configuration from MongoDB"""
        configs = self.db.find("builder_configs", {
            "format": self._format_type,
            "is_active": True
        })
        
        if configs:
            return configs[0]
        return None
    
    def build(self, converted_fields: Dict[str, Any], metadata: Dict[str, Any]) -> str:
        """Build message using MongoDB-defined template and rules"""
        if not self.builder_config:
            raise ValueError(f"No builder configuration loaded for {self._format_type}")
        
        # Get template
        template = self.builder_config.get('template', '')
        if not template:
            raise ValueError(f"No template defined for {self._format_type}")
        
        # Process each field mapping
        field_mappings = self.builder_config.get('field_mappings', [])
        
        for mapping in field_mappings:
            placeholder = mapping.get('placeholder')
            source = mapping.get('source')
            formatter = mapping.get('formatter', 'direct')
            default_value = mapping.get('default', '')
            
            if not placeholder:
                continue
            
            # Get value based on source type
            value = self._get_source_value(source, converted_fields, metadata, mapping)
            
            # Apply formatter
            if value is not None:
                value = self._format_value(value, formatter, mapping)
            elif default_value:
                value = self._get_default_value(default_value, metadata)
            else:
                value = ''
            
            # Replace placeholder in template
            template = template.replace(placeholder, str(value))
        
        # Clean up any remaining placeholders (optional fields not provided)
        template = self._clean_empty_placeholders(template)
        
        # Format based on output type
        output_type = self.builder_config.get('xml_config', {}).get('pretty_print', False)
        if output_type and 'xml' in self._format_type.lower():
            template = self._format_xml(template)
        
        return template
    
    def _get_source_value(self, source: str, fields: Dict, metadata: Dict, mapping: Dict) -> Any:
        """Get value based on source type"""
        if not source:
            return None
        
        if source == '_constant':
            return mapping.get('value', '')
        elif source == '_generated':
            return self._generate_value(mapping.get('generator'), metadata)
        elif source in fields:
            value = fields[source]
            # If value is a dict with 'value' key (AI-processed field), extract the actual value
            if isinstance(value, dict) and 'value' in value:
                return value['value']
            return value
        else:
            # Handle nested fields (e.g., "32A.currency")
            if '.' in source:
                parts = source.split('.')
                value = fields
                for part in parts:
                    if isinstance(value, dict) and part in value:
                        value = value[part]
                        # Check if this is an AI field structure
                        if isinstance(value, dict) and 'value' in value:
                            value = value['value']
                    else:
                        return None
                return value
            return None
    
    def _generate_value(self, generator: str, metadata: Dict) -> str:
        """Generate values dynamically"""
        if generator == 'iso_timestamp':
            return datetime.now(UTC).isoformat()
        elif generator == 'iso_date':
            return datetime.now(UTC).date().isoformat()
        elif generator == 'unique_id':
            import uuid
            return str(uuid.uuid4())
        else:
            return ''
    
    def _get_default_value(self, default: str, metadata: Dict) -> str:
        """Get default value"""
        if default == '_today':
            return datetime.now(UTC).date().isoformat()
        elif default == '_now':
            return datetime.now(UTC).isoformat()
        else:
            return default
    
    def _format_value(self, value: Any, formatter: str, mapping: Dict) -> str:
        """Format value based on formatter type"""
        if formatter == 'direct':
            return str(value)
        
        elif formatter == 'uppercase':
            return str(value).upper()
        
        elif formatter == 'lowercase':
            return str(value).lower()
        
        elif formatter.startswith('decimal'):
            # Format as decimal with specified places (e.g., "decimal:2")
            try:
                places = 2
                if ':' in formatter:
                    places = int(formatter.split(':')[1])
                return f"{float(str(value).replace(',', '')):.{places}f}"
            except:
                return str(value)
        
        elif formatter == 'iso_date':
            # Convert various date formats to ISO
            return str(value)[:10] if len(str(value)) >= 10 else str(value)
        
        elif formatter == 'extract_first_line':
            # Extract first line from multiline text
            lines = str(value).split('\n')
            return lines[0].strip() if lines else ''
        
        elif formatter.startswith('extract_line'):
            # Extract specific line number (e.g., "extract_line:1")
            try:
                line_num = 1
                if ':' in formatter:
                    line_num = int(formatter.split(':')[1])
                lines = str(value).split('\n')
                if line_num <= len(lines):
                    return lines[line_num - 1].strip()
                return ''
            except:
                return ''
        
        elif formatter == 'extract_account':
            # Extract account number from text (looking for /XXX... pattern)
            match = re.search(r'/([A-Z0-9]+)', str(value))
            return match.group(1) if match else str(value).split('\n')[0] if '\n' in str(value) else str(value)
        
        elif formatter == 'map':
            # Map value using provided mapping
            mapping_dict = mapping.get('mapping', {})
            mapped_value = mapping_dict.get(str(value), str(value))
            return mapped_value
        
        else:
            logger.warning(f"Unknown formatter: {formatter}")
            return str(value)
    
    def _clean_empty_placeholders(self, template: str) -> str:
        """Remove any remaining placeholders and clean up empty XML elements"""
        # Remove remaining placeholders
        template = re.sub(r'\{\{[^}]+\}\}', '', template)
        
        # Clean up empty XML elements (optional - be careful with this)
        # This is a simple approach - more sophisticated cleaning might be needed
        if 'xml' in self._format_type.lower():
            # Remove empty simple elements like <Tag></Tag>
            template = re.sub(r'<([^/>]+)>\s*</\1>', '', template)
            # Remove empty self-closing tags like <Tag/>
            template = re.sub(r'<[^/>]+/>', '', template)
        
        return template
    
    def _format_xml(self, xml_string: str) -> str:
        """Pretty-print XML"""
        try:
            # Parse and pretty-print
            dom = minidom.parseString(xml_string)
            return dom.toprettyxml(indent="    ")
        except:
            # If parsing fails, return as-is
            return xml_string
    
    def get_required_fields(self) -> list:
        """Get list of required fields for this builder"""
        required = []
        for mapping in self.builder_config.get('field_mappings', []):
            if mapping.get('required', False):
                required.append(mapping.get('source'))
        return required
    
    def validate_inputs(self, fields: Dict[str, Any]) -> Dict[str, Any]:
        """Validate that required fields are present"""
        validation_result = {
            'is_valid': True,
            'missing_fields': [],
            'warnings': []
        }
        
        required_fields = self.get_required_fields()
        for field in required_fields:
            if field not in fields or fields[field] is None or fields[field] == '':
                validation_result['is_valid'] = False
                validation_result['missing_fields'].append(field)
        
        return validation_result