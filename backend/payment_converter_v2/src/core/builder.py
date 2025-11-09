"""Builder - Output format construction (XML/JSON)"""

import json
import logging
from typing import Dict, Any
from xml.etree import ElementTree as ET
from xml.dom import minidom

logger = logging.getLogger(__name__)


class Builder:
    """
    Build output messages from internal fields.
    
    Supports:
    - XML output (ISO 20022, etc.)
    - JSON output (canonical format)
    """
    
    def build(
        self,
        internal_fields: Dict[str, Any],
        output_paths: Dict[str, str],
        format_type: str = "xml"
    ) -> str:
        """
        Build output message from internal fields.
        
        Args:
            internal_fields: Transformed internal fields
            output_paths: Mapping of field_name -> output_path
            format_type: Output format ("xml" or "json")
            
        Returns:
            Formatted output message string
            
        Example:
            internal_fields = {"transaction_ref": "REF123", "amount": "10000"}
            output_paths = {
                "transaction_ref": "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.InstrId",
                "amount": "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text"
            }
            result = builder.build(internal_fields, output_paths, "xml")
        """
        if format_type.lower() == "json":
            return self._build_json(internal_fields, output_paths)
        else:
            return self._build_xml(internal_fields, output_paths)
    
    def _build_xml(
        self,
        fields: Dict[str, Any],
        paths: Dict[str, str]
    ) -> str:
        """
        Build XML output from fields and paths.
        
        Args:
            fields: Internal field values
            paths: Field name -> XML path mappings
            
        Returns:
            Formatted XML string
            
        Path format:
        - "Document.Element.SubElement" → nested elements
        - "#text" → text content of element
        - "@AttrName" → attribute
        """
        # Build nested dictionary structure
        root_data = {}
        
        for field_name, field_value in fields.items():
            if field_name not in paths:
                logger.warning(f"No output path for field: {field_name}")
                continue
            
            path = paths[field_name]
            self._set_nested_value(root_data, path, field_value)
        
        # Convert to XML
        if not root_data:
            logger.warning("No data to build XML")
            return "<Document />"
        
        # Get root element name (usually "Document")
        root_name = list(root_data.keys())[0] if root_data else "Document"
        root = ET.Element(root_name)
        
        # Build XML recursively
        self._dict_to_xml(root, root_data[root_name] if root_name in root_data else {})
        
        # Pretty print
        xml_string = self._prettify_xml(root)
        
        logger.info(f"Built XML output ({len(xml_string)} chars)")
        return xml_string
    
    def _set_nested_value(self, data: Dict, path: str, value: Any):
        """
        Set value at nested path in dictionary.
        
        Args:
            data: Root dictionary
            path: Dot-separated path (e.g., "Document.Element.SubElement")
            value: Value to set
            
        Handles:
        - #text for element text content
        - @Attr for attributes
        """
        parts = path.split('.')
        current = data
        
        # Navigate to parent
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        
        # Set final value
        final_key = parts[-1]
        
        if final_key == '#text':
            # Text content
            current['#text'] = str(value) if value is not None else ''
        elif final_key.startswith('@'):
            # Attribute
            if '@attrs' not in current:
                current['@attrs'] = {}
            attr_name = final_key[1:]  # Remove @
            current['@attrs'][attr_name] = str(value) if value is not None else ''
        else:
            # Regular element
            current[final_key] = value
    
    def _dict_to_xml(self, parent: ET.Element, data: Dict):
        """
        Convert dictionary to XML elements recursively.
        
        Args:
            parent: Parent XML element
            data: Dictionary data to convert
        """
        for key, value in data.items():
            if key == '#text':
                # Set text content
                parent.text = str(value) if value is not None else ''
            elif key == '@attrs':
                # Set attributes
                if isinstance(value, dict):
                    for attr_name, attr_value in value.items():
                        parent.set(attr_name, str(attr_value) if attr_value is not None else '')
            elif isinstance(value, dict):
                # Create child element
                child = ET.SubElement(parent, key)
                self._dict_to_xml(child, value)
            elif isinstance(value, list):
                # Create multiple child elements
                for item in value:
                    child = ET.SubElement(parent, key)
                    if isinstance(item, dict):
                        self._dict_to_xml(child, item)
                    else:
                        child.text = str(item) if item is not None else ''
            else:
                # Simple value
                child = ET.SubElement(parent, key)
                child.text = str(value) if value is not None else ''
    
    def _prettify_xml(self, element: ET.Element) -> str:
        """
        Pretty print XML element.
        
        Args:
            element: XML element
            
        Returns:
            Formatted XML string with indentation
        """
        rough_string = ET.tostring(element, encoding='unicode')
        
        try:
            reparsed = minidom.parseString(rough_string)
            pretty_string = reparsed.toprettyxml(indent="  ")
            
            # Remove XML declaration and empty lines
            lines = [line for line in pretty_string.split('\n') if line.strip()]
            if lines and lines[0].startswith('<?xml'):
                lines = lines[1:]
            
            return '\n'.join(lines)
        except Exception as e:
            logger.warning(f"Pretty print failed: {e}, returning raw XML")
            return rough_string
    
    def _build_json(
        self,
        fields: Dict[str, Any],
        paths: Dict[str, str]
    ) -> str:
        """
        Build JSON output from fields and paths.
        
        Args:
            fields: Internal field values
            paths: Field name -> JSON path mappings
            
        Returns:
            Formatted JSON string
            
        Path format:
        - "transaction.payment_id" → nested objects
        - "parties.debtor.name" → nested objects
        """
        root_data = {}
        
        for field_name, field_value in fields.items():
            if field_name not in paths:
                logger.warning(f"No output path for field: {field_name}")
                continue
            
            path = paths[field_name]
            self._set_nested_value(root_data, path, field_value)
        
        # Convert to JSON
        json_string = json.dumps(root_data, indent=2, ensure_ascii=False)
        
        logger.info(f"Built JSON output ({len(json_string)} chars)")
        return json_string
    
    def validate_output(self, output: str, format_type: str) -> bool:
        """
        Validate output format.
        
        Args:
            output: Output string
            format_type: "xml" or "json"
            
        Returns:
            True if valid
        """
        try:
            if format_type.lower() == "json":
                json.loads(output)
                return True
            else:  # xml
                ET.fromstring(output)
                return True
        except Exception as e:
            logger.error(f"Invalid {format_type}: {e}")
            return False
