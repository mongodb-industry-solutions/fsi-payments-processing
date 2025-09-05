import re
from typing import Dict, Any
from .base_parser import BaseParser


class MT103Parser(BaseParser):
    """Parser for SWIFT MT103 messages with MongoDB integration
    
    Note: This is the first parser implementation for the demo.
    Future parsers (MT202, ISO8583, ACH, etc.) will follow the same pattern.
    """
    
    @property
    def format_type(self) -> str:
        return "MT103"  # Demo focuses on MT103, but architecture supports any format
    
    def parse(self, raw_message: str) -> Dict[str, Any]:
        """Parse MT103 message into structured fields"""
        fields = {}
        
        # Parse SWIFT blocks
        blocks = self._parse_blocks(raw_message)
        
        # Extract Block 4 (message content)
        if '4' not in blocks:
            raise ValueError("Invalid MT103 format - no block 4 found")
        
        content = blocks['4']
        
        # Get field patterns from MongoDB if available, else use defaults
        field_patterns = self._get_field_patterns()
        
        # Extract each field
        for field_num, pattern in field_patterns.items():
            match = re.search(pattern, content)
            if match:
                # Special handling for structured fields
                if field_num == '32A' and len(match.group(1)) >= 9:
                    fields[field_num] = self._parse_32A(match.group(1))
                else:
                    fields[field_num] = match.group(1).strip()
        
        return fields
    
    def _parse_blocks(self, raw_message: str) -> Dict[str, str]:
        """Parse SWIFT message blocks"""
        blocks = {}
        block_pattern = r'\{([1-4]):([^}]*)\}'
        matches = re.findall(block_pattern, raw_message)
        
        for block_num, block_content in matches:
            blocks[block_num] = block_content.strip()
        
        return blocks
    
    def _get_field_patterns(self) -> Dict[str, str]:
        """Get field extraction patterns - can be overridden from MongoDB"""
        # Check if we have custom patterns in MongoDB
        if self.format_config and 'field_patterns' in self.format_config:
            return self.format_config['field_patterns']
        
        # Default MT103 field patterns
        return {
            '20': r':20:([^\n:]+)',                           # Transaction Reference
            '23B': r':23B:([^\n:]+)',                         # Bank Operation Code
            '32A': r':32A:([^\n:]+)',                         # Value Date/Currency/Amount
            '50K': r':50K:([^\n:]+(?:\n(?!:)[^\n:]+)*)',      # Ordering Customer
            '52A': r':52A:([^\n:]+)',                         # Ordering Institution
            '53A': r':53A:([^\n:]+)',                         # Sender's Correspondent
            '59': r':59:([^\n:]+(?:\n(?!:)[^\n:]+)*)',        # Beneficiary
            '70': r':70:([^\n:]+(?:\n(?!:)[^\n:]+)*)',        # Remittance Information
            '71A': r':71A:([^\n:]+)',                         # Details of Charges
            '72': r':72:([^\n:]+(?:\n(?!:)[^\n:]+)*)'         # Sender to Receiver Info
        }
    
    def _parse_32A(self, field_value: str) -> Dict[str, str]:
        """Parse Field 32A into structured components"""
        return {
            'value_date': field_value[:6],                    # YYMMDD
            'currency': field_value[6:9],                     # CCC
            'amount': field_value[9:].replace(',', '.'),      # Amount
            'raw_value': field_value                          # Keep original for reference
        }
    
    def get_field_descriptions(self) -> Dict[str, str]:
        """Get human-readable descriptions for each field"""
        return {
            '20': 'Transaction Reference Number',
            '23B': 'Bank Operation Code',
            '32A': 'Value Date, Currency and Amount',
            '50K': 'Ordering Customer',
            '52A': 'Ordering Institution',
            '53A': 'Sender\'s Correspondent',
            '59': 'Beneficiary Customer',
            '70': 'Remittance Information',
            '71A': 'Details of Charges',
            '72': 'Sender to Receiver Information'
        }
    
    def validate_required_fields(self, parsed_fields: Dict[str, Any]) -> Dict[str, Any]:
        """Validate that required MT103 fields are present"""
        required_fields = ['20', '23B', '32A', '50K', '59']
        validation_result = {
            'is_valid': True,
            'missing_fields': [],
            'warnings': []
        }
        
        for field in required_fields:
            if field not in parsed_fields:
                validation_result['is_valid'] = False
                validation_result['missing_fields'].append(field)
        
        # Validate Field 32A structure
        if '32A' in parsed_fields and isinstance(parsed_fields['32A'], dict):
            if len(parsed_fields['32A']['value_date']) != 6:
                validation_result['warnings'].append('Field 32A: Invalid date format')
            if len(parsed_fields['32A']['currency']) != 3:
                validation_result['warnings'].append('Field 32A: Invalid currency code')
        
        return validation_result