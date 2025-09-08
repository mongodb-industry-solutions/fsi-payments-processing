"""
Generic Path-Based Builder for Payment Format Conversion

This builder works with ANY target format by using field paths returned by AI.
Instead of hardcoded transformations, AI returns exact target field paths.

Example:
    AI returns: {"Dbtr/Nm": "ACME Corp", "DbtrAcct/Id/IBAN": "US123456"}
    Builder creates XML/JSON structure following those paths
"""

from typing import Dict, Any, List, Optional
import xml.etree.ElementTree as ET
from xml.dom import minidom
import json
from datetime import datetime
from .base_builder import BaseBuilder


class PathBuilder(BaseBuilder):
    """
    Universal builder that constructs messages using field paths.
    Supports XML (ISO 20022) and JSON formats.
    """
    
    # XML namespace mappings for different formats
    NAMESPACES = {
        "pacs.008": "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08",
        "pacs.009": "urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08",
        "pacs.002": "urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10",
        "pain.001": "urn:iso:std:iso:20022:tech:xsd:pain.001.001.09",
    }
    
    # Root elements for different formats
    ROOT_ELEMENTS = {
        "pacs.008": "FIToFICstmrCdtTrf",
        "pacs.009": "FICdtTrf",
        "pacs.002": "FIToFIPmtStsRpt",
        "pain.001": "CstmrCdtTrfInitn",
    }
    
    def __init__(self, target_format: str, db=None):
        """
        Initialize PathBuilder with target format.
        
        Args:
            target_format: Target format (e.g., "pacs.008", "pacs.009", "nacha", "iso8583")
            db: Database connector for configuration
        """
        self.target_format = target_format
        self.is_xml = target_format.startswith(("pacs", "pain", "camt"))
        super().__init__(db)
        
    @property
    def format_type(self) -> str:
        return self.target_format
    
    def build(self, converted_fields: Dict[str, Any], metadata: Dict[str, Any]) -> str:
        """
        Build target message from AI-provided field paths.
        
        Args:
            converted_fields: Dictionary with target paths as keys
                Example: {"Dbtr/Nm": "John Doe", "GrpHdr/MsgId": "123"}
            metadata: Processing metadata
            
        Returns:
            Formatted message string (XML or JSON)
        """
        if self.is_xml:
            return self._build_xml(converted_fields, metadata)
        else:
            return self._build_json(converted_fields, metadata)
    
    def _build_xml(self, fields: Dict[str, Any], metadata: Dict[str, Any]) -> str:
        """Build XML message from field paths."""
        
        # Create root Document element with namespace
        namespace = self.NAMESPACES.get(self.target_format, "")
        root = ET.Element("Document")
        if namespace:
            root.set("xmlns", namespace)
        
        # Add main message element
        root_element_name = self.ROOT_ELEMENTS.get(self.target_format, "Message")
        main_element = ET.SubElement(root, root_element_name)
        
        # Group fields by their paths and build XML structure
        self._build_xml_structure(main_element, fields, metadata)
        
        # Convert to pretty XML string
        xml_str = ET.tostring(root, encoding='unicode')
        dom = minidom.parseString(xml_str)
        return dom.toprettyxml(indent="    ")
    
    def _build_xml_structure(self, parent: ET.Element, fields: Dict[str, Any], metadata: Dict[str, Any]):
        """
        Recursively build XML structure from field paths.
        
        Handles paths like:
        - "GrpHdr/MsgId" -> <GrpHdr><MsgId>value</MsgId></GrpHdr>
        - "CdtTrfTxInf/Dbtr/Nm" -> nested structure
        - "IntrBkSttlmAmt@Ccy" -> attribute (@ denotes attribute)
        """
        # Process fields and organize by hierarchy
        structure = {}
        
        for path, value in fields.items():
            if value is None or value == "":
                continue
                
            # Split path into components
            parts = path.split('/')
            
            # Build nested dictionary structure
            current = structure
            for i, part in enumerate(parts[:-1]):
                if part not in current:
                    current[part] = {}
                current = current[part]
            
            # Handle final part (could be element or attribute)
            final_part = parts[-1]
            if '@' in final_part:
                # Attribute notation: ElementName@AttributeName
                elem_name, attr_name = final_part.split('@')
                if elem_name not in current:
                    current[elem_name] = {"@attributes": {}, "@value": None}
                elif not isinstance(current[elem_name], dict):
                    current[elem_name] = {"@attributes": {}, "@value": current[elem_name]}
                current[elem_name]["@attributes"][attr_name] = value
            else:
                # Regular element
                current[final_part] = value
        
        # Now build XML from structure
        self._structure_to_xml(parent, structure)
        
        # Add processing metadata as comments if requested
        if metadata.get("show_processing_info"):
            comment = f"Processed: Rules={metadata.get('rules_count', 0)}, AI={metadata.get('ai_count', 0)}"
            parent.append(ET.Comment(comment))
    
    def _structure_to_xml(self, parent: ET.Element, structure: Dict):
        """Convert nested dictionary structure to XML elements."""
        
        for key, value in structure.items():
            if key.startswith('@'):
                continue  # Skip attribute markers
                
            if isinstance(value, dict):
                # Check if this has attributes or nested elements
                if "@attributes" in value or "@value" in value:
                    # Element with attributes
                    elem = ET.SubElement(parent, key)
                    
                    # Set attributes
                    if "@attributes" in value:
                        for attr_name, attr_value in value["@attributes"].items():
                            elem.set(attr_name, str(attr_value))
                    
                    # Set text value
                    if "@value" in value and value["@value"] is not None:
                        elem.text = str(value["@value"])
                    
                    # Process any nested elements
                    nested = {k: v for k, v in value.items() 
                             if not k.startswith('@')}
                    if nested:
                        self._structure_to_xml(elem, nested)
                else:
                    # Regular nested element
                    elem = ET.SubElement(parent, key)
                    self._structure_to_xml(elem, value)
            
            elif isinstance(value, list):
                # Handle lists (multiple elements with same name)
                for item in value:
                    if isinstance(item, dict):
                        elem = ET.SubElement(parent, key)
                        self._structure_to_xml(elem, item)
                    else:
                        elem = ET.SubElement(parent, key)
                        elem.text = str(item)
            
            else:
                # Simple element with text content
                elem = ET.SubElement(parent, key)
                if value is not None:
                    elem.text = str(value)
    
    def _build_json(self, fields: Dict[str, Any], metadata: Dict[str, Any]) -> str:
        """Build JSON message from field paths."""
        
        # For JSON formats, paths use dot notation
        result = {}
        
        for path, value in fields.items():
            if value is None:
                continue
                
            # Convert slash notation to dot notation for JSON
            json_path = path.replace('/', '.')
            
            # Build nested structure
            parts = json_path.split('.')
            current = result
            
            for part in parts[:-1]:
                if part not in current:
                    current[part] = {}
                current = current[part]
            
            # Set the value
            current[parts[-1]] = value
        
        # Add metadata if requested
        if metadata.get("show_processing_info"):
            result["_metadata"] = {
                "processed_at": datetime.now().isoformat(),
                "rules_count": metadata.get('rules_count', 0),
                "ai_count": metadata.get('ai_count', 0),
                "processing_time": metadata.get('processing_time', 0)
            }
        
        return json.dumps(result, indent=2)
    
    def validate_output(self, message_output: str) -> Dict[str, Any]:
        """Validate the generated message."""
        
        validation_result = {
            "is_valid": True,
            "errors": [],
            "warnings": []
        }
        
        try:
            if self.is_xml:
                # Validate XML structure
                ET.fromstring(message_output)
                
                # Check for expected root elements
                if self.target_format in self.ROOT_ELEMENTS:
                    root_elem = self.ROOT_ELEMENTS[self.target_format]
                    if root_elem not in message_output:
                        validation_result["warnings"].append(
                            f"Expected root element '{root_elem}' not found"
                        )
            else:
                # Validate JSON structure
                json.loads(message_output)
                
        except ET.ParseError as e:
            validation_result["is_valid"] = False
            validation_result["errors"].append(f"Invalid XML: {str(e)}")
        except json.JSONDecodeError as e:
            validation_result["is_valid"] = False
            validation_result["errors"].append(f"Invalid JSON: {str(e)}")
        except Exception as e:
            validation_result["is_valid"] = False
            validation_result["errors"].append(f"Validation error: {str(e)}")
        
        return validation_result
    
    def get_field_mapping_summary(self) -> Dict[str, str]:
        """Get summary of field mappings for this format."""
        
        # This is now dynamic - AI provides the mappings
        return {
            "approach": "Dynamic AI-driven field mapping",
            "description": f"AI returns exact {self.target_format} field paths",
            "example": "AI returns 'Dbtr/Nm' for debtor name in pacs.008"
        }