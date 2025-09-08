"""
Generic Builder - Builds output format based on MongoDB template
No hardcoded structures or formats
"""

import json
import re
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Union
from datetime import datetime


class GenericBuilder:
    """Build any format based on template from MongoDB config"""
    
    def __init__(self, builder_config: Dict[str, Any]):
        """
        Initialize with builder configuration from MongoDB
        
        Args:
            builder_config: Builder configuration containing:
                - type: Output type (xml, json, csv, etc.)
                - template: Structure template with placeholders
                - namespace: Optional namespace for XML
                - defaults: Default values for missing fields
        """
        self.config = builder_config
        self.type = builder_config.get('type', 'xml')
        self.template = builder_config.get('template', {})
        self.namespace = builder_config.get('namespace', '')
        
        # Load defaults from MongoDB config
        defaults_config = builder_config.get('defaults', {})
        self.field_defaults = defaults_config.get('field_defaults', {})
        self.pattern_defaults = defaults_config.get('pattern_defaults', [])
    
    def build(self, transformed_fields: Dict[str, Any]) -> str:
        """
        Build output message based on template
        
        Args:
            transformed_fields: Dictionary of transformed fields
            
        Returns:
            Formatted output message string
        """
        if self.type == 'xml':
            return self._build_xml(transformed_fields)
        elif self.type == 'json':
            return self._build_json(transformed_fields)
        elif self.type == 'csv':
            return self._build_csv(transformed_fields)
        else:
            raise ValueError(f"Unsupported builder type: {self.type}")
    
    def _build_xml(self, fields: Dict[str, Any]) -> str:
        """Build XML output from template"""
        # Process template and substitute variables
        processed_template = self._process_template(self.template, fields)
        
        # Convert to XML
        root = self._dict_to_xml(processed_template)
        
        # Format as string with declaration
        xml_str = '<?xml version="1.0" encoding="UTF-8"?>\n'
        xml_str += self._prettify_xml(root)
        
        return xml_str
    
    def _dict_to_xml(self, data: Dict, parent: ET.Element = None) -> ET.Element:
        """Convert dictionary structure to XML elements"""
        
        for key, value in data.items():
            # Handle XML attributes (keys starting with @)
            if key.startswith('@'):
                if parent is not None:
                    parent.set(key[1:], str(value))
                continue
            
            # Handle text content
            if key == '#text':
                if parent is not None:
                    parent.text = str(value)
                continue
            
            # Special handling for arrays that should create multiple elements
            if isinstance(value, list):
                # Create multiple elements with the same tag name
                for item in value:
                    if parent is None:
                        # Root element case (shouldn't happen with arrays)
                        if self.namespace:
                            element = ET.Element(key, xmlns=self.namespace)
                        else:
                            element = ET.Element(key)
                        parent = element
                    else:
                        element = ET.SubElement(parent, key)
                    
                    if isinstance(item, dict):
                        self._dict_to_xml(item, element)
                    else:
                        # Simple value - set as text
                        element.text = str(item) if item else ''
                continue
            
            # Note: Strings with newlines should be handled by transformer/AI
            # Builder should receive arrays if multiple elements are needed
            
            # Create single element
            if parent is None:
                # Root element
                if self.namespace:
                    element = ET.Element(key, xmlns=self.namespace)
                else:
                    element = ET.Element(key)
                parent = element
            else:
                element = ET.SubElement(parent, key)
            
            # Process value
            if isinstance(value, dict):
                self._dict_to_xml(value, element)
            else:
                element.text = str(value) if value else ''
        
        return parent if parent else ET.Element('root')
    
    def _process_template(self, template: Any, fields: Dict[str, Any]) -> Any:
        """Process template and substitute variable placeholders"""
        
        if isinstance(template, dict):
            result = {}
            for key, value in template.items():
                # Process key (might contain variables)
                processed_key = self._substitute_variables(key, fields) if isinstance(key, str) else key
                # Process value recursively
                result[processed_key] = self._process_template(value, fields)
            return result
            
        elif isinstance(template, list):
            return [self._process_template(item, fields) for item in template]
            
        elif isinstance(template, str):
            # Check if this is a simple variable substitution
            if template.startswith('{{') and template.endswith('}}'):
                var_name = template[2:-2]
                # Return the actual value (could be array) instead of stringified
                if '.' in var_name:
                    parts = var_name.split('.')
                    value = fields
                    for part in parts:
                        if isinstance(value, dict) and part in value:
                            value = value[part]
                        else:
                            return self._get_default_value(var_name)
                    return value  # Return as-is, don't stringify
                elif var_name in fields:
                    return fields[var_name]  # Return as-is, don't stringify
                elif var_name == 'current_time':
                    return datetime.utcnow().isoformat()
                elif var_name == 'namespace':
                    return self.namespace
                else:
                    return self._get_default_value(var_name)
            else:
                # Complex string with multiple variables - use substitution
                return self._substitute_variables(template, fields)
            
        else:
            return template
    
    def _substitute_variables(self, text: str, fields: Dict[str, Any]) -> str:
        """Substitute {{variable}} placeholders with actual values"""
        
        import re
        
        def replace_var(match):
            var_name = match.group(1)
            
            # Handle nested field access (e.g., {{DbtrAgt.BIC}})
            if '.' in var_name:
                parts = var_name.split('.')
                value = fields
                for part in parts:
                    if isinstance(value, dict) and part in value:
                        value = value[part]
                    else:
                        # Field not found - use default or empty
                        return self._get_default_value(var_name)
                return str(value) if value is not None else ''
            
            # Handle simple field access
            if var_name in fields:
                value = fields[var_name]
                return str(value) if value is not None else ''
            
            # Handle special variables
            if var_name == 'current_time':
                return datetime.utcnow().isoformat()
            elif var_name == 'namespace':
                return self.namespace
            
            # Field not found - use default or empty
            return self._get_default_value(var_name)
        
        # Replace all {{variable}} patterns
        pattern = r'\{\{([^}]+)\}\}'
        return re.sub(pattern, replace_var, text)
    
    def _get_default_value(self, field_name: str) -> str:
        """Get default value for missing fields from MongoDB config"""
        
        # Check field-specific defaults
        for key, value in self.field_defaults.items():
            if field_name.endswith(key):
                return value
        
        # Check pattern-based defaults
        for pattern_def in self.pattern_defaults:
            if re.match(pattern_def['pattern'], field_name):
                return pattern_def['value']
        
        return ''
    
    def _prettify_xml(self, element: ET.Element, indent: str = '  ', level: int = 0) -> str:
        """Pretty print XML with proper indentation"""
        
        result = []
        
        # Opening tag with attributes
        tag = f"{indent * level}<{element.tag}"
        for key, value in element.attrib.items():
            tag += f' {key}="{value}"'
        
        # Check if element has children
        children = list(element)
        
        if not children and not element.text:
            # Self-closing tag
            result.append(f"{tag}/>")
        elif not children:
            # Tag with text only
            result.append(f"{tag}>{element.text or ''}</{element.tag}>")
        else:
            # Tag with children
            result.append(f"{tag}>")
            
            # Add text if present (before children)
            if element.text and element.text.strip():
                result.append(f"{indent * (level + 1)}{element.text.strip()}")
            
            # Add children
            for child in children:
                result.append(self._prettify_xml(child, indent, level + 1))
            
            # Closing tag
            result.append(f"{indent * level}</{element.tag}>")
        
        return '\n'.join(result)
    
    def _build_json(self, fields: Dict[str, Any]) -> str:
        """Build JSON output from template"""
        processed_template = self._process_template(self.template, fields)
        return json.dumps(processed_template, indent=2)
    
    def _build_csv(self, fields: Dict[str, Any]) -> str:
        """Build CSV output - simplified implementation"""
        # This would need more configuration for proper CSV building
        lines = []
        for key, value in fields.items():
            if not key.startswith('_'):  # Skip internal fields
                lines.append(f'"{key}","{value}"')
        return '\n'.join(lines)