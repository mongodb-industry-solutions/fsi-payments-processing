"""
pacs.009 Builder - Builds ISO 20022 pacs.009.001.08 (Financial Institution Credit Transfer) messages

pacs.009 is used for credit transfers between financial institutions.
It's the ISO 20022 equivalent of MT202.
"""

import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Dict, Any, Optional
from .base_builder import BaseBuilder


class Pacs009Builder(BaseBuilder):
    """Builder for ISO 20022 pacs.009 messages."""
    
    def __init__(self, db_connector=None):
        """Initialize pacs.009 builder."""
        super().__init__(db_connector)
        self.target_format = "pacs.009"
        self.namespace = "urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08"
        
    def build(self, fields: Dict[str, Any]) -> str:
        """
        Build pacs.009 XML message from field dictionary.
        
        Args:
            fields: Dictionary of fields to build message from
            
        Returns:
            XML string in pacs.009 format
        """
        # Create root element with namespace
        root = ET.Element("Document", xmlns=self.namespace)
        fi_cdt_trf = ET.SubElement(root, "FICdtTrf")
        
        # Build Group Header
        self._build_group_header(fi_cdt_trf, fields)
        
        # Build Credit Transfer Transaction Information
        self._build_credit_transfer(fi_cdt_trf, fields)
        
        # Convert to string with proper formatting
        return self._format_xml(root)
    
    def _build_group_header(self, parent: ET.Element, fields: Dict[str, Any]):
        """Build Group Header section."""
        grp_hdr = ET.SubElement(parent, "GrpHdr")
        
        # Message Identification (from field 20 or generated)
        msg_id = fields.get("MsgId", fields.get("20", f"PACS009-{datetime.now().strftime('%Y%m%d%H%M%S')}"))
        ET.SubElement(grp_hdr, "MsgId").text = msg_id
        
        # Creation Date Time
        ET.SubElement(grp_hdr, "CreDtTm").text = datetime.now().isoformat()
        
        # Number of Transactions
        ET.SubElement(grp_hdr, "NbOfTxs").text = "1"
        
        # Total Interbank Settlement Amount (from field 32A)
        if "Amount" in fields and "Currency" in fields:
            ttl_intr_bk_sttlm_amt = ET.SubElement(grp_hdr, "TtlIntrBkSttlmAmt")
            ttl_intr_bk_sttlm_amt.text = str(fields["Amount"])
            ttl_intr_bk_sttlm_amt.set("Ccy", fields["Currency"])
        
        # Interbank Settlement Date
        if "SettlementDate" in fields:
            ET.SubElement(grp_hdr, "IntrBkSttlmDt").text = fields["SettlementDate"]
        
        # Settlement Information
        sttlm_inf = ET.SubElement(grp_hdr, "SttlmInf")
        ET.SubElement(sttlm_inf, "SttlmMtd").text = "INDA"  # Instructed Agent
        
        # Instructing Agent (from field 52 - Ordering Institution in MT202)
        if "InstructingAgent" in fields or "OrderingInstitution" in fields:
            instg_agt = ET.SubElement(grp_hdr, "InstgAgt")
            fin_instn_id = ET.SubElement(instg_agt, "FinInstnId")
            bic = fields.get("InstructingAgentBIC", fields.get("OrderingInstitutionBIC", ""))
            if bic:
                ET.SubElement(fin_instn_id, "BIC").text = bic
            else:
                ET.SubElement(fin_instn_id, "BIC").text = "NOTPROVIDED"
        
        # Instructed Agent (from field 58 - Beneficiary Institution in MT202)
        if "InstructedAgent" in fields or "BeneficiaryInstitution" in fields:
            instd_agt = ET.SubElement(grp_hdr, "InstdAgt")
            fin_instn_id = ET.SubElement(instd_agt, "FinInstnId")
            bic = fields.get("InstructedAgentBIC", fields.get("BeneficiaryInstitutionBIC", ""))
            if bic:
                ET.SubElement(fin_instn_id, "BIC").text = bic
            else:
                ET.SubElement(fin_instn_id, "BIC").text = "NOTPROVIDED"
    
    def _build_credit_transfer(self, parent: ET.Element, fields: Dict[str, Any]):
        """Build Credit Transfer Transaction Information section."""
        cdt_trf_tx_inf = ET.SubElement(parent, "CdtTrfTxInf")
        
        # Payment Identification
        pmt_id = ET.SubElement(cdt_trf_tx_inf, "PmtId")
        
        # Instruction ID (from field 20)
        instr_id = fields.get("InstrId", fields.get("20", ""))
        if instr_id:
            ET.SubElement(pmt_id, "InstrId").text = instr_id
        
        # End to End ID (from field 21 - Related Reference)
        end_to_end_id = fields.get("EndToEndId", fields.get("RelatedReference", fields.get("21", "")))
        if end_to_end_id:
            ET.SubElement(pmt_id, "EndToEndId").text = end_to_end_id
        
        # Transaction ID
        tx_id = fields.get("TxId", fields.get("20", ""))
        if tx_id:
            ET.SubElement(pmt_id, "TxId").text = tx_id
        
        # UETR (Unique End-to-end Transaction Reference) if available
        if "UETR" in fields:
            ET.SubElement(pmt_id, "UETR").text = fields["UETR"]
        
        # Payment Type Information
        if "PaymentType" in fields:
            pmt_tp_inf = ET.SubElement(cdt_trf_tx_inf, "PmtTpInf")
            if "ServiceLevel" in fields:
                svc_lvl = ET.SubElement(pmt_tp_inf, "SvcLvl")
                ET.SubElement(svc_lvl, "Cd").text = fields["ServiceLevel"]
        
        # Interbank Settlement Amount (from 32A)
        if "Amount" in fields and "Currency" in fields:
            intr_bk_sttlm_amt = ET.SubElement(cdt_trf_tx_inf, "IntrBkSttlmAmt")
            intr_bk_sttlm_amt.text = str(fields["Amount"])
            intr_bk_sttlm_amt.set("Ccy", fields["Currency"])
        
        # Interbank Settlement Date
        if "SettlementDate" in fields:
            ET.SubElement(cdt_trf_tx_inf, "IntrBkSttlmDt").text = fields["SettlementDate"]
        
        # Settlement Priority
        if "SettlementPriority" in fields:
            ET.SubElement(cdt_trf_tx_inf, "SttlmPrty").text = fields["SettlementPriority"]
        
        # Instructing Agent (field 52 in MT202)
        if "InstructingAgent" in fields or "OrderingInstitution" in fields:
            instg_agt = ET.SubElement(cdt_trf_tx_inf, "InstgAgt")
            fin_instn_id = ET.SubElement(instg_agt, "FinInstnId")
            name = fields.get("InstructingAgent", fields.get("OrderingInstitution", ""))
            if name:
                ET.SubElement(fin_instn_id, "Nm").text = name
            bic = fields.get("InstructingAgentBIC", "")
            if bic:
                ET.SubElement(fin_instn_id, "BIC").text = bic
        
        # Instructed Agent (field 58 in MT202)
        if "InstructedAgent" in fields or "BeneficiaryInstitution" in fields:
            instd_agt = ET.SubElement(cdt_trf_tx_inf, "InstdAgt")
            fin_instn_id = ET.SubElement(instd_agt, "FinInstnId")
            name = fields.get("InstructedAgent", fields.get("BeneficiaryInstitution", ""))
            if name:
                ET.SubElement(fin_instn_id, "Nm").text = name
            bic = fields.get("InstructedAgentBIC", "")
            if bic:
                ET.SubElement(fin_instn_id, "BIC").text = bic
        
        # Intermediary Agent 1 (field 56 in MT202)
        if "IntermediaryAgent1" in fields or "IntermediaryInstitution" in fields:
            intrmy_agt1 = ET.SubElement(cdt_trf_tx_inf, "IntrmyAgt1")
            fin_instn_id = ET.SubElement(intrmy_agt1, "FinInstnId")
            name = fields.get("IntermediaryAgent1", fields.get("IntermediaryInstitution", ""))
            if name:
                ET.SubElement(fin_instn_id, "Nm").text = name
            bic = fields.get("IntermediaryAgent1BIC", "")
            if bic:
                ET.SubElement(fin_instn_id, "BIC").text = bic
        
        # Creditor Agent (field 57 in MT202 - Account with Institution)
        if "CreditorAgent" in fields or "AccountWithInstitution" in fields:
            cdtr_agt = ET.SubElement(cdt_trf_tx_inf, "CdtrAgt")
            fin_instn_id = ET.SubElement(cdtr_agt, "FinInstnId")
            name = fields.get("CreditorAgent", fields.get("AccountWithInstitution", ""))
            if name:
                ET.SubElement(fin_instn_id, "Nm").text = name
            bic = fields.get("CreditorAgentBIC", "")
            if bic:
                ET.SubElement(fin_instn_id, "BIC").text = bic
        
        # Creditor (Beneficiary Institution - field 58 in MT202)
        if "Creditor" in fields or "BeneficiaryInstitution" in fields:
            cdtr = ET.SubElement(cdt_trf_tx_inf, "Cdtr")
            name = fields.get("Creditor", fields.get("BeneficiaryInstitution", ""))
            if name:
                ET.SubElement(cdtr, "Nm").text = name
            
            # Creditor Account if available
            if "CreditorAccount" in fields:
                cdtr_acct = ET.SubElement(cdt_trf_tx_inf, "CdtrAcct")
                acct_id = ET.SubElement(cdtr_acct, "Id")
                
                # Check if it's IBAN or Other
                acct_num = fields["CreditorAccount"]
                if acct_num.startswith("IBAN") or len(acct_num) > 15:
                    ET.SubElement(acct_id, "IBAN").text = acct_num.replace("IBAN", "")
                else:
                    othr = ET.SubElement(acct_id, "Othr")
                    ET.SubElement(othr, "Id").text = acct_num
        
        # Remittance Information (field 70 in MT202)
        if "RemittanceInformation" in fields or "RemittanceInfo" in fields:
            rmt_inf = ET.SubElement(cdt_trf_tx_inf, "RmtInf")
            info = fields.get("RemittanceInformation", fields.get("RemittanceInfo", ""))
            if info:
                ET.SubElement(rmt_inf, "Ustrd").text = info
        
        # Instruction for Next Agent (field 72 in MT202)
        if "InstructionInformation" in fields or "SenderToReceiverInfo" in fields:
            instr_for_nxt_agt = ET.SubElement(cdt_trf_tx_inf, "InstrForNxtAgt")
            info = fields.get("InstructionInformation", fields.get("SenderToReceiverInfo", ""))
            if info:
                ET.SubElement(instr_for_nxt_agt, "InstrInf").text = info
    
    def _format_xml(self, root: ET.Element) -> str:
        """Format XML with proper indentation and declaration."""
        # Create string from element tree
        xml_str = ET.tostring(root, encoding='unicode')
        
        # Parse and reformat with minidom for pretty printing
        import xml.dom.minidom as minidom
        dom = minidom.parseString(xml_str)
        
        # Add XML declaration
        pretty_xml = dom.toprettyxml(indent="  ", encoding=None)
        
        # Remove extra blank lines
        lines = [line for line in pretty_xml.split('\n') if line.strip()]
        
        # Add proper XML declaration
        result = '<?xml version="1.0" encoding="UTF-8"?>\n'
        result += '\n'.join(lines[1:])  # Skip the declaration from toprettyxml
        
        return result
    
    def build_with_metadata(self, fields: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build message with additional metadata.
        
        Args:
            fields: Dictionary of fields
            metadata: Additional metadata
            
        Returns:
            Dictionary with message and metadata
        """
        message = self.build(fields)
        
        return {
            "message_output": message,
            "format": "pacs.009",
            "version": "001.08",
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata,
            "field_count": len(fields),
            "namespace": self.namespace
        }
    
    def validate(self, fields: Dict[str, Any]) -> bool:
        """
        Validate that required fields are present.
        
        Args:
            fields: Dictionary of fields
            
        Returns:
            True if valid, False otherwise
        """
        # Minimum required fields for pacs.009
        required = [
            # Either field names from conversion or MT202 field codes
            ["MsgId", "20"],  # Message ID
            ["Amount", "32A_amount"],  # Amount
            ["Currency", "32A_currency"],  # Currency
        ]
        
        for field_options in required:
            if not any(field in fields for field in field_options):
                return False
        
        return True
    
    def get_builder_metadata(self) -> Dict[str, Any]:
        """Get metadata about this builder."""
        return {
            "builder_type": "pacs.009",
            "version": "1.0.0",
            "iso_version": "001.08",
            "namespace": self.namespace,
            "supported_fields": [
                "MsgId", "CreDtTm", "NbOfTxs", "TtlIntrBkSttlmAmt",
                "IntrBkSttlmDt", "SttlmMtd", "InstgAgt", "InstdAgt",
                "InstrId", "EndToEndId", "TxId", "UETR",
                "IntrBkSttlmAmt", "IntrmyAgt1", "CdtrAgt", "Cdtr",
                "CdtrAcct", "RmtInf", "InstrForNxtAgt"
            ],
            "description": "Builder for ISO 20022 pacs.009 (Financial Institution Credit Transfer) messages"
        }
    
    @property
    def format_type(self) -> str:
        """Return the format type for this builder."""
        return "pacs.009"