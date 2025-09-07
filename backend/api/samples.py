"""
Payment samples API endpoints
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from db.mdb import MongoDBConnector
from functools import lru_cache
import time
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
        
        # Fetch formats with embedded samples
        formats = db.find("formats", query)
        
        # Extract samples from formats
        result = []
        for format_doc in formats:
            for sample in format_doc.get("samples", []):
                sample_data = {
                    "format_code": format_doc["format_code"],
                    "format_type": format_doc["type"],
                    "sample_name": sample.get("name", ""),
                    "description": sample.get("description", ""),
                    "sample_data": sample.get("message", ""),
                    "is_default": sample.get("is_default", False),
                    "format_metadata": {
                        "name": format_doc.get("name", format_doc["format_code"]),
                        "version": format_doc.get("metadata", {}).get("version", "latest"),
                        "free_text_fields": format_doc.get("free_text_fields", []),
                        "ai_suitable_fields": format_doc.get("ai_suitable_fields", [])
                    }
                }
                result.append(sample_data)
        
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
        
        # Get format with embedded samples
        formats = db.find("formats", {"format_code": format_code})
        format_doc = formats[0] if formats else None
        
        sample = None
        if format_doc and format_doc.get("samples"):
            if sample_name:
                # Find specific sample by name
                for s in format_doc["samples"]:
                    if s.get("name") == sample_name:
                        sample = s
                        break
            else:
                # Get first sample or default
                for s in format_doc["samples"]:
                    if s.get("is_default", False):
                        sample = s
                        break
                if not sample:
                    sample = format_doc["samples"][0]
        
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
        
        # Build sample response
        sample_data = {
            "format_code": format_code,
            "format_type": format_doc["type"] if format_doc else "unknown",
            "sample_name": sample.get("name", ""),
            "description": sample.get("description", ""),
            "sample_data": sample.get("message", ""),
            "is_default": sample.get("is_default", False)
        }
        
        return {
            "success": True,
            "format_code": format_code,
            "sample": sample_data,
            "format_info": {
                "name": format_doc.get("name", format_code) if format_doc else None,
                "free_text_fields": format_doc.get("free_text_fields", []) if format_doc else [],
                "ai_suitable_fields": format_doc.get("ai_suitable_fields", []) if format_doc else []
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching sample for format {format_code}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# In-memory cache for format previews (TTL: 5 minutes)
_preview_cache = {}
_cache_ttl = 300  # 5 minutes

def get_cached_preview(format_code: str) -> Optional[Dict]:
    """Get preview from cache if not expired"""
    if format_code in _preview_cache:
        cached_data, timestamp = _preview_cache[format_code]
        if time.time() - timestamp < _cache_ttl:
            return cached_data
    return None

def set_cached_preview(format_code: str, data: Dict):
    """Store preview in cache with timestamp"""
    _preview_cache[format_code] = (data, time.time())

@router.get("/preview/{format_code}")
async def get_sample_preview(format_code: str):
    """
    Get a preview of sample data for display in UI
    
    Args:
        format_code: Payment format code
    
    Returns:
        Preview-formatted sample data
    """
    # Check cache first
    cached = get_cached_preview(format_code)
    if cached:
        logger.debug(f"Returning cached preview for {format_code}")
        return cached
    
    try:
        db = MongoDBConnector()
        
        # Get format with embedded samples
        formats = db.find("formats", {"format_code": format_code})
        format_doc = formats[0] if formats else None
        
        sample = None
        if format_doc and format_doc.get("samples"):
            # Get default or first sample
            for s in format_doc["samples"]:
                if s.get("is_default", False):
                    sample = s
                    break
            if not sample and format_doc["samples"]:
                sample = format_doc["samples"][0]
        
        if not sample:
            result = {
                "success": True,
                "format_code": format_code,
                "preview": get_fallback_sample(format_code),
                "is_template": True
            }
            # Cache the template result too
            set_cached_preview(format_code, result)
            return result
        
        # Return just the sample data for preview
        result = {
            "success": True,
            "format_code": format_code,
            "preview": sample.get("message", ""),
            "sample_name": sample.get("name", ""),
            "has_free_text": bool(sample.get("fields_highlight")),
            "free_text_fields": sample.get("fields_highlight", [])
        }
        
        # Cache the result
        set_cached_preview(format_code, result)
        return result
        
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