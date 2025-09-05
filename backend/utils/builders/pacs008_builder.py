from datetime import datetime
from typing import Dict, Any
import xml.etree.ElementTree as ET
from xml.dom import minidom
from .base_builder import BaseBuilder


class Pacs008Builder(BaseBuilder):
    """Builder for ISO 20022 pacs.008 messages with MongoDB integration
    
    Note: This is the first builder implementation for the demo.
    Future builders (pacs.002, NACHA, crypto formats) will follow the same pattern.
    """
    
    NAMESPACE = "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08"  # ISO 20022 standard
    
    @property
    def format_type(self) -> str:
        return "pacs.008"
    
    def build(self, converted_fields: Dict[str, Any], metadata: Dict[str, Any]) -> str:
        """Build pacs.008 XML from converted fields"""
        
        # Create root element with namespace
        root = ET.Element("Document", xmlns=self.NAMESPACE)
        fi_to_fi = ET.SubElement(root, "FIToFICstmrCdtTrf")
        
        # Group Header
        grp_hdr = ET.SubElement(fi_to_fi, "GrpHdr")
        ET.SubElement(grp_hdr, "MsgId").text = converted_fields.get("MsgId", "")
        ET.SubElement(grp_hdr, "CreDtTm").text = datetime.now().isoformat()
        ET.SubElement(grp_hdr, "NbOfTxs").text = "1"
        
        # Add processing metadata as XML comment for demo
        if metadata.get("show_processing_info"):
            comment = f"Processed by: Rules={metadata.get('rules_count', 0)}, AI={metadata.get('ai_count', 0)}, Cost=${metadata.get('total_cost', 0)}"
            grp_hdr.append(ET.Comment(comment))
        
        sttlm_inf = ET.SubElement(grp_hdr, "SttlmInf")
        ET.SubElement(sttlm_inf, "SttlmMtd").text = "INDA"
        
        # Credit Transfer Transaction Information
        cdt_trf_tx_inf = ET.SubElement(fi_to_fi, "CdtTrfTxInf")
        
        # Payment ID
        pmt_id = ET.SubElement(cdt_trf_tx_inf, "PmtId")
        ET.SubElement(pmt_id, "InstrId").text = converted_fields.get("InstrId", "")
        ET.SubElement(pmt_id, "EndToEndId").text = converted_fields.get("EndToEndId", "")
        ET.SubElement(pmt_id, "TxId").text = converted_fields.get("TxId", "")
        
        # Amount (from parsed field 32A)
        if "Amount" in converted_fields:
            amt = ET.SubElement(cdt_trf_tx_inf, "IntrBkSttlmAmt")
            amt.set("Ccy", converted_fields.get("Currency", "USD"))
            amt.text = str(converted_fields.get("Amount", "0.00"))
        
        # Settlement Date
        if "SettlementDate" in converted_fields:
            ET.SubElement(cdt_trf_tx_inf, "IntrBkSttlmDt").text = converted_fields["SettlementDate"]
        
        # Charge Bearer (from field 71A)
        charge_map = {"OUR": "DEBT", "BEN": "CRED", "SHA": "SHAR"}
        charge_code = converted_fields.get("ChargeBearer", "SHAR")
        ET.SubElement(cdt_trf_tx_inf, "ChrgBr").text = charge_map.get(charge_code, charge_code)
        
        # Add party elements (Debtor/Creditor from AI-processed fields)
        self._add_party_elements(cdt_trf_tx_inf, converted_fields, metadata)
        
        # Add remittance information if available (from AI-processed field 70)
        if "RemittanceInfo" in converted_fields:
            rmt_inf = ET.SubElement(cdt_trf_tx_inf, "RmtInf")
            ET.SubElement(rmt_inf, "Ustrd").text = converted_fields["RemittanceInfo"]
            
            # Add confidence as comment if from AI
            if metadata.get("field_confidence", {}).get("RemittanceInfo"):
                confidence = metadata["field_confidence"]["RemittanceInfo"]
                rmt_inf.append(ET.Comment(f"AI Confidence: {confidence:.2f}"))
        
        # Convert to pretty XML string
        xml_str = ET.tostring(root, encoding='unicode')
        dom = minidom.parseString(xml_str)
        return dom.toprettyxml(indent="    ")
    
    def _add_party_elements(self, parent: ET.Element, fields: Dict, metadata: Dict):
        """Add debtor and creditor elements from AI/Rules processed fields"""
        
        # Debtor (from field 50K - usually AI processed)
        if "DebtorName" in fields or "DebtorAddress" in fields:
            dbtr = ET.SubElement(parent, "Dbtr")
            if "DebtorName" in fields:
                ET.SubElement(dbtr, "Nm").text = fields["DebtorName"]
            if "DebtorAddress" in fields:
                pstl_adr = ET.SubElement(dbtr, "PstlAdr")
                # Parse address from AI result
                addr_lines = fields["DebtorAddress"].split('\n')
                for line in addr_lines[:2]:  # Max 2 address lines in pacs.008
                    if line.strip():
                        ET.SubElement(pstl_adr, "AdrLine").text = line.strip()
        
        # Debtor Account
        if "DebtorAccount" in fields:
            dbtr_acct = ET.SubElement(parent, "DbtrAcct")
            id_elem = ET.SubElement(dbtr_acct, "Id")
            ET.SubElement(id_elem, "IBAN").text = fields["DebtorAccount"]
        
        # Debtor Agent (from field 52A)
        if "DebtorAgent" in fields:
            dbtr_agt = ET.SubElement(parent, "DbtrAgt")
            fin_instn_id = ET.SubElement(dbtr_agt, "FinInstnId")
            ET.SubElement(fin_instn_id, "BIC").text = fields["DebtorAgent"]
        
        # Creditor Agent (from field 57A or default)
        if "CreditorAgent" in fields:
            cdtr_agt = ET.SubElement(parent, "CdtrAgt")
            fin_instn_id = ET.SubElement(cdtr_agt, "FinInstnId")
            ET.SubElement(fin_instn_id, "BIC").text = fields["CreditorAgent"]
        
        # Creditor (from field 59 - usually AI processed)  
        if "CreditorName" in fields or "CreditorAddress" in fields:
            cdtr = ET.SubElement(parent, "Cdtr")
            if "CreditorName" in fields:
                ET.SubElement(cdtr, "Nm").text = fields["CreditorName"]
            if "CreditorAddress" in fields:
                pstl_adr = ET.SubElement(cdtr, "PstlAdr")
                addr_lines = fields["CreditorAddress"].split('\n')
                for line in addr_lines[:2]:
                    if line.strip():
                        ET.SubElement(pstl_adr, "AdrLine").text = line.strip()
        
        # Creditor Account
        if "CreditorAccount" in fields:
            cdtr_acct = ET.SubElement(parent, "CdtrAcct")
            id_elem = ET.SubElement(cdtr_acct, "Id")
            ET.SubElement(id_elem, "IBAN").text = fields["CreditorAccount"]
    
    def validate_output(self, message_output: str) -> Dict[str, Any]:
        """Validate the pacs.008 XML output"""
        validation_result = super().validate_output(message_output)
        
        # Check for XML validity
        try:
            ET.fromstring(message_output)
        except ET.ParseError as e:
            validation_result["is_valid"] = False
            validation_result["errors"].append(f"Invalid XML: {str(e)}")
        
        # Check for required pacs.008 elements
        required_elements = ["Document", "FIToFICstmrCdtTrf", "GrpHdr", "CdtTrfTxInf"]
        for elem in required_elements:
            if elem not in message_output:
                validation_result["warnings"].append(f"Missing element: {elem}")
        
        return validation_result
    
    def get_field_mapping_summary(self) -> Dict[str, str]:
        """Get summary of how MT103 fields map to pacs.008 elements"""
        return {
            "20": "MsgId, InstrId, EndToEndId",
            "23B": "Used for transaction type determination",
            "32A": "IntrBkSttlmAmt (Amount + Currency), IntrBkSttlmDt",
            "50K": "Dbtr (Name + Address) via AI",
            "52A": "DbtrAgt (BIC)",
            "53A": "Intermediary (if needed)",
            "59": "Cdtr (Name + Address) via AI", 
            "70": "RmtInf (Remittance Information) via AI",
            "71A": "ChrgBr (Charge Bearer)",
            "72": "Additional information (if needed)"
        }