"""
MT202 Parser - Parses SWIFT MT202 COV (Cover Payment) messages

MT202 is used for financial institution transfers to cover customer payments.
Key differences from MT103:
- Field 21: Related Reference (mandatory)
- No ordering customer (50K is optional ordering institution)
- Field 52A/D: Ordering Institution
- Field 56A/D: Intermediary Institution
- Field 57A/B/D: Account with Institution
- Field 58A/D: Beneficiary Institution
"""

import re
from typing import Dict, Any, Optional
from datetime import datetime
from .base_parser import BaseParser


class MT202Parser(BaseParser):
    """Parser for SWIFT MT202 messages."""
    
    def __init__(self, db_connector=None):
        """Initialize MT202 parser."""
        super().__init__(db_connector)
        self.source_format = "MT202"
        
    def parse(self, raw_message: str) -> Dict[str, Any]:
        """
        Parse MT202 message into structured fields.
        
        Args:
            raw_message: Raw MT202 message string
            
        Returns:
            Dictionary of parsed fields
        """
        # Clean the message
        message = raw_message.strip()
        
        # Initialize result
        parsed_fields = {}
        
        # Extract blocks
        blocks = self._extract_blocks(message)
        
        # Parse block 4 (message text)
        if '4' in blocks:
            field_text = blocks['4']
            
            # Field 20: Transaction Reference Number (Mandatory)
            field_20 = self._extract_field(field_text, '20')
            if field_20:
                parsed_fields['20'] = field_20.strip()
            
            # Field 21: Related Reference (Mandatory for MT202)
            field_21 = self._extract_field(field_text, '21')
            if field_21:
                parsed_fields['21'] = field_21.strip()
            
            # Field 13C: Time Indication (Optional)
            field_13c = self._extract_field(field_text, '13C')
            if field_13c:
                parsed_fields['13C'] = field_13c.strip()
            
            # Field 32A: Value Date, Currency Code, and Amount (Mandatory)
            field_32a = self._extract_field(field_text, '32A')
            if field_32a:
                parsed_32a = self._parse_32a(field_32a)
                if parsed_32a:
                    parsed_fields['32A'] = parsed_32a
                    # Also store individual components for easier access
                    parsed_fields['32A_date'] = parsed_32a['date']
                    parsed_fields['32A_currency'] = parsed_32a['currency']
                    parsed_fields['32A_amount'] = parsed_32a['amount']
            
            # Field 52A/D: Ordering Institution (Optional)
            field_52 = self._extract_field_variants(field_text, '52', ['A', 'D'])
            if field_52:
                parsed_fields['52'] = field_52['value']
                parsed_fields['52_option'] = field_52['option']
            
            # Field 53A/B/D: Sender's Correspondent (Optional)
            field_53 = self._extract_field_variants(field_text, '53', ['A', 'B', 'D'])
            if field_53:
                parsed_fields['53'] = field_53['value']
                parsed_fields['53_option'] = field_53['option']
            
            # Field 54A/B/D: Receiver's Correspondent (Optional)
            field_54 = self._extract_field_variants(field_text, '54', ['A', 'B', 'D'])
            if field_54:
                parsed_fields['54'] = field_54['value']
                parsed_fields['54_option'] = field_54['option']
            
            # Field 56A/C/D: Intermediary Institution (Optional)
            field_56 = self._extract_field_variants(field_text, '56', ['A', 'C', 'D'])
            if field_56:
                parsed_fields['56'] = field_56['value']
                parsed_fields['56_option'] = field_56['option']
            
            # Field 57A/B/C/D: Account with Institution (Optional)
            field_57 = self._extract_field_variants(field_text, '57', ['A', 'B', 'C', 'D'])
            if field_57:
                parsed_fields['57'] = field_57['value']
                parsed_fields['57_option'] = field_57['option']
            
            # Field 58A/D: Beneficiary Institution (Mandatory)
            field_58 = self._extract_field_variants(field_text, '58', ['A', 'D'])
            if field_58:
                parsed_fields['58'] = field_58['value']
                parsed_fields['58_option'] = field_58['option']
            
            # Field 70: Remittance Information (Optional)
            field_70 = self._extract_field(field_text, '70')
            if field_70:
                parsed_fields['70'] = field_70.strip()
            
            # Field 72: Sender to Receiver Information (Optional)
            field_72 = self._extract_field(field_text, '72')
            if field_72:
                parsed_fields['72'] = field_72.strip()
        
        # Parse other blocks for metadata
        if '1' in blocks:
            parsed_fields['block1'] = blocks['1']
            # Extract sender BIC from block 1
            sender_match = re.search(r'F01([A-Z]{8,11})', blocks['1'])
            if sender_match:
                parsed_fields['sender_bic'] = sender_match.group(1)
        
        if '2' in blocks:
            parsed_fields['block2'] = blocks['2']
            # Extract receiver BIC from block 2
            receiver_match = re.search(r'I202([A-Z]{8,11})', blocks['2'])
            if receiver_match:
                parsed_fields['receiver_bic'] = receiver_match.group(1)
        
        if '3' in blocks:
            parsed_fields['block3'] = blocks['3']
        
        if '5' in blocks:
            parsed_fields['block5'] = blocks['5']
        
        return parsed_fields
    
    def _extract_blocks(self, message: str) -> Dict[str, str]:
        """Extract SWIFT message blocks."""
        blocks = {}
        
        # Pattern to match blocks {1:...} {2:...} etc
        block_pattern = r'\{(\d):([^}]*)\}'
        matches = re.finditer(block_pattern, message)
        
        for match in matches:
            block_num = match.group(1)
            block_content = match.group(2)
            blocks[block_num] = block_content
        
        # Special handling for block 4 (message text)
        block4_pattern = r'\{4:\s*\n(.*?)(?:\n-\}|\Z)'
        block4_match = re.search(block4_pattern, message, re.DOTALL)
        if block4_match:
            blocks['4'] = block4_match.group(1)
        
        return blocks
    
    def _extract_field(self, text: str, field_code: str) -> Optional[str]:
        """Extract a specific field from the message text."""
        # Pattern for fields like :20:, :21:, :70:, etc.
        pattern = rf':({field_code}):(.*?)(?=\n:|$)'
        match = re.search(pattern, text, re.MULTILINE | re.DOTALL)
        
        if match:
            return match.group(2).strip()
        return None
    
    def _extract_field_variants(self, text: str, field_code: str, options: list) -> Optional[Dict[str, str]]:
        """Extract field with option variants (e.g., 52A, 52D)."""
        for option in options:
            field_value = self._extract_field(text, f'{field_code}{option}')
            if field_value:
                return {
                    'value': field_value,
                    'option': option
                }
        return None
    
    def _parse_32a(self, field_value: str) -> Optional[Dict[str, Any]]:
        """
        Parse field 32A (Value Date, Currency Code, and Amount).
        Format: YYMMDDCCCAMOUNT
        Example: 241215USD125750,50
        """
        # Pattern: 6 digits for date, 3 letters for currency, amount
        pattern = r'^(\d{6})([A-Z]{3})([\d,\.]+)$'
        match = re.match(pattern, field_value.strip())
        
        if match:
            date_str = match.group(1)
            currency = match.group(2)
            amount_str = match.group(3).replace(',', '.')
            
            # Parse date (YYMMDD)
            try:
                year = int('20' + date_str[:2])  # Assumes 20xx
                month = int(date_str[2:4])
                day = int(date_str[4:6])
                date = f"{year:04d}-{month:02d}-{day:02d}"
            except:
                date = date_str
            
            # Parse amount
            try:
                amount = float(amount_str)
            except:
                amount = amount_str
            
            return {
                'date': date,
                'currency': currency,
                'amount': amount
            }
        
        return None
    
    def validate(self, parsed_fields: Dict[str, Any]) -> bool:
        """
        Validate MT202 message has required fields.
        
        Args:
            parsed_fields: Dictionary of parsed fields
            
        Returns:
            True if valid, False otherwise
        """
        # MT202 mandatory fields
        required_fields = ['20', '21', '32A', '58']  # Transaction ref, Related ref, Amount, Beneficiary Institution
        
        for field in required_fields:
            if field not in parsed_fields:
                return False
        
        return True
    
    def get_parser_metadata(self) -> Dict[str, Any]:
        """Get metadata about this parser."""
        return {
            "parser_type": "MT202",
            "version": "1.0.0",
            "supported_fields": [
                "20", "21", "13C", "32A",
                "52A", "52D",
                "53A", "53B", "53D",
                "54A", "54B", "54D",
                "56A", "56C", "56D",
                "57A", "57B", "57C", "57D",
                "58A", "58D",
                "70", "72"
            ],
            "mandatory_fields": ["20", "21", "32A", "58"],
            "description": "Parser for SWIFT MT202 COV (Cover Payment) messages"
        }
    
    @property
    def format_type(self) -> str:
        """Return the format type for this parser."""
        return "MT202"