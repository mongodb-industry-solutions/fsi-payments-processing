"""
Payment samples API endpoints
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from db.mdb import MongoDBConnector
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/")
async def get_payment_samples(
    format_code: Optional[str] = Query(None, description="Filter by format code"),
    format_type: Optional[str] = Query(None, description="Filter by format type (source/target)"),
    include_free_text: bool = Query(True, description="Include free text field samples")
):
    """
    Retrieve payment samples from MongoDB
    
    Args:
        format_code: Optional filter by format code (e.g., MT103, pacs.008)
        format_type: Optional filter by format type (source or target)
        include_free_text: Whether to include samples with free text fields
    
    Returns:
        List of payment samples matching the criteria
    """
    try:
        db = MongoDBConnector()
        
        # Build query
        query = {}
        if format_code:
            query["format_code"] = format_code
        if format_type:
            query["format_type"] = format_type
        if include_free_text:
            # Only include samples that have free text fields highlighted
            query["fields_highlight"] = {"$exists": True, "$ne": []}
        
        # Fetch samples
        samples = db.find("payment_samples", query)
        
        # Transform samples for response
        result = []
        for sample in samples:
            # Remove MongoDB internal fields
            sample.pop("_id", None)
            
            # Add format metadata if available
            if sample.get("format_type") == "source":
                format_results = db.find("source_formats", {"format_code": sample["format_code"]})
                format_info = format_results[0] if format_results else None
            else:
                format_results = db.find("target_formats", {"format_code": sample["format_code"]})
                format_info = format_results[0] if format_results else None
            
            if format_info:
                sample["format_metadata"] = {
                    "name": format_info.get("format_name"),
                    "version": format_info.get("version"),
                    "free_text_fields": format_info.get("free_text_fields", []),
                    "ai_suitable_fields": format_info.get("ai_suitable_fields", [])
                }
            
            result.append(sample)
        
        return {
            "success": True,
            "samples": result,
            "count": len(result)
        }
        
    except Exception as e:
        logger.error(f"Error fetching payment samples: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{format_code}")
async def get_sample_by_format(
    format_code: str,
    sample_name: Optional[str] = Query(None, description="Specific sample name")
):
    """
    Get sample data for a specific format
    
    Args:
        format_code: Payment format code (e.g., MT103, pacs.008)
        sample_name: Optional specific sample name
    
    Returns:
        Sample data for the specified format
    """
    try:
        db = MongoDBConnector()
        
        query = {"format_code": format_code}
        if sample_name:
            query["sample_name"] = sample_name
        
        # Get the first matching sample or specific sample
        samples = db.find("payment_samples", query)
        sample = samples[0] if samples else None
        
        if not sample:
            # If no sample in DB, return a basic template
            logger.warning(f"No sample found for format {format_code}, returning template")
            return {
                "success": True,
                "format_code": format_code,
                "sample_data": get_fallback_sample(format_code),
                "is_template": True,
                "message": "Using template as no sample exists in database"
            }
        
        # Remove MongoDB internal fields
        sample.pop("_id", None)
        
        # Get format metadata
        format_info = None
        if sample.get("format_type") == "source":
            format_results = db.find("source_formats", {"format_code": format_code})
            format_info = format_results[0] if format_results else None
        else:
            format_results = db.find("target_formats", {"format_code": format_code})
            format_info = format_results[0] if format_results else None
        
        return {
            "success": True,
            "format_code": format_code,
            "sample": sample,
            "format_info": {
                "name": format_info.get("format_name") if format_info else None,
                "free_text_fields": format_info.get("free_text_fields", []) if format_info else [],
                "ai_suitable_fields": format_info.get("ai_suitable_fields", []) if format_info else []
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching sample for format {format_code}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/preview/{format_code}")
async def get_sample_preview(format_code: str):
    """
    Get a preview of sample data for display in UI
    
    Args:
        format_code: Payment format code
    
    Returns:
        Preview-formatted sample data
    """
    try:
        db = MongoDBConnector()
        
        # Get the most recent sample for this format
        # Note: MongoDB connector's find() doesn't support sort, so we'll get all and sort in Python
        samples = db.find("payment_samples", {"format_code": format_code})
        if samples:
            # Sort by created_at descending and take the first
            samples.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            sample = samples[0]
        else:
            sample = None
        
        if not sample:
            return {
                "success": True,
                "format_code": format_code,
                "preview": get_fallback_sample(format_code),
                "is_template": True
            }
        
        # Return just the sample data for preview
        return {
            "success": True,
            "format_code": format_code,
            "preview": sample.get("sample_data", ""),
            "sample_name": sample.get("sample_name", ""),
            "has_free_text": bool(sample.get("fields_highlight")),
            "free_text_fields": sample.get("fields_highlight", [])
        }
        
    except Exception as e:
        logger.error(f"Error getting sample preview for {format_code}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def get_fallback_sample(format_code: str) -> str:
    """
    Get a basic fallback sample if none exists in database
    """
    fallback_samples = {
        "MT103": """{1:F01BANKUSAAAXXX0000000000}{2:I103BANKUSBBXXXXN}{3:{108:1234567890123456}}{4:
:20:REF123456
:23B:CRED
:32A:241215USD10000,00
:50K:/1234567890
SENDER NAME
SENDER ADDRESS
:59:/0987654321
BENEFICIARY NAME
BENEFICIARY ADDRESS
:70:PAYMENT DETAILS
:71A:OUR
-}""",
        "ISO8583": "0200B23A80012AC180020000000000000000161234567890123456120150120150120111300000001000012345612345606051105511092700",
        "pacs.008": """<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>MSG123456</MsgId>
      <CreDtTm>2024-12-15T10:00:00</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <InstrId>INSTR123</InstrId>
        <EndToEndId>E2E123</EndToEndId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="USD">10000.00</IntrBkSttlmAmt>
      <Dbtr><Nm>Debtor Name</Nm></Dbtr>
      <Cdtr><Nm>Creditor Name</Nm></Cdtr>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>""",
        "ACH": """101 091000019 1234567892024121510A094101BANK NAME              COMPANY NAME           
5225COMPANY NAME            1234567890CCDPAYROLL         241215   1123456780000001
6270910000191234567890000000010000000000000000001JOHN DOE                0123456780000001
82250000010037530864000000001000000000000000001234567890                     123456780000001
9000001000001000000010037530864000000001000000000000000000                                       
9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999"""
    }
    
    return fallback_samples.get(format_code, "# No sample available for this format")