"""
Converter API - FastAPI endpoints for payment format conversion
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, Optional
import logging
import os
from datetime import datetime

from ..models.requests import ConversionRequest
from ..models.responses import ConversionResponse
from ..core.converter import UniversalConverter
from ..services.conversion_router import ConversionRouter
from ..services.db_service import get_mongodb_service
from ..config.settings import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/converter", tags=["converter"])


def get_db_service():
    """Dependency to get database service"""
    settings = get_settings()
    return get_mongodb_service(
        connection_string=settings.mongodb_uri,
        database_name=settings.database_name
    )


@router.post("/convert", response_model=ConversionResponse)
async def convert_message(
    request: ConversionRequest,
    db_service = Depends(get_db_service)
) -> ConversionResponse:
    """
    Convert payment message from source to target format
    
    Args:
        request: Conversion request with source format, target format, and message
        
    Returns:
        ConversionResponse with converted message and metadata
    """
    # Input validation
    MAX_MESSAGE_SIZE = 1_000_000  # 1MB limit
    
    if len(request.message) > MAX_MESSAGE_SIZE:
        raise HTTPException(
            status_code=400, 
            detail=f"Message too large. Maximum size is {MAX_MESSAGE_SIZE:,} characters"
        )
    
    if not request.message.strip():
        raise HTTPException(
            status_code=400, 
            detail="Message cannot be empty"
        )
    
    # Basic format validation for SWIFT messages
    if request.source_format.startswith("MT"):
        if not (request.message.startswith("{") or ":" in request.message):
            raise HTTPException(
                status_code=400,
                detail="Invalid SWIFT message format. Expected blocks starting with { or field tags with :"
            )
    
    try:
        # Check if direct conversion exists
        conversion_id = f"{request.source_format}_to_{request.target_format}"
        direct_config_exists = db_service.db['conversion_registry'].find_one({'_id': conversion_id}) is not None

        # Use ConversionRouter if explicitly requested OR if no direct conversion exists
        if request.use_router or not direct_config_exists:
            if not direct_config_exists:
                logger.info(f"No direct conversion found for {request.source_format} → {request.target_format}, attempting multi-hop routing")
            else:
                logger.info(f"Using ConversionRouter as requested for {request.source_format} → {request.target_format}")

            router_service = ConversionRouter(db_service)
            result = router_service.convert(
                source_format=request.source_format,
                target_format=request.target_format,
                message=request.message,
                options=request.options
            )
        else:
            # Use existing UniversalConverter directly
            converter = UniversalConverter(
                db_connector=db_service,
                source_format=request.source_format,
                target_format=request.target_format
            )
            result = converter.convert(request.message)
        
        # Save result to database if requested
        if request.save_result:
            result['request_id'] = request.request_id
            result['timestamp'] = datetime.utcnow()
            db_service.save_conversion_result(result)
        
        # Build response
        return ConversionResponse(
            success=result['success'],
            converted_message=result.get('converted_message'),
            metadata=result.get('metadata', {}),
            error=result.get('error'),
            request_id=request.request_id
        )
        
    except ValueError as e:
        # Configuration or validation errors
        logger.error(f"Configuration error: {e}")
        error_msg = str(e)
        
        # Provide helpful error messages
        if "No configuration found" in error_msg:
            raise HTTPException(
                status_code=404,
                detail=f"Conversion from {request.source_format} to {request.target_format} is not configured. "
                       f"Please check available formats at /api/v1/converter/formats"
            )
        elif "Invalid JSON format" in error_msg:
            raise HTTPException(status_code=400, detail="Invalid JSON message format")
        elif "XML parsing" in error_msg:
            raise HTTPException(status_code=501, detail=error_msg)
        else:
            raise HTTPException(status_code=400, detail=error_msg)
            
    except NotImplementedError as e:
        # Feature not implemented
        logger.error(f"Feature not implemented: {e}")
        raise HTTPException(status_code=501, detail=str(e))
        
    except Exception as e:
        # Generic server error - don't expose internal details
        logger.error(f"Conversion failed with error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail="An error occurred during conversion. Please check your message format and try again."
        )


@router.get("/formats")
async def get_supported_formats(db_service = Depends(get_db_service)) -> Dict[str, Any]:
    """
    Get list of supported conversion formats
    
    Returns:
        Dictionary with supported source and target formats
    """
    try:
        # Query conversion registry for all configured conversions
        conversions = db_service.db['conversion_registry'].find({}, {'_id': 1})
        
        formats = {
            'source_formats': set(),
            'target_formats': set(),
            'conversion_pairs': []
        }
        
        for conv in conversions:
            conversion_id = conv['_id']
            if '_to_' in conversion_id:
                source, target = conversion_id.split('_to_')
                formats['source_formats'].add(source)
                formats['target_formats'].add(target)
                formats['conversion_pairs'].append({
                    'source': source,
                    'target': target,
                    'id': conversion_id
                })
        
        # Convert sets to lists for JSON serialization
        formats['source_formats'] = list(formats['source_formats'])
        formats['target_formats'] = list(formats['target_formats'])
        
        return formats
        
    except Exception as e:
        logger.error(f"Failed to get formats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get formats: {str(e)}")


@router.get("/config/{conversion_id}")
async def get_conversion_config(
    conversion_id: str,
    db_service = Depends(get_db_service)
) -> Dict[str, Any]:
    """
    Get configuration for a specific conversion
    
    Args:
        conversion_id: Conversion identifier (e.g., "MT103_to_pacs.008")
        
    Returns:
        Configuration dictionary
    """
    try:
        config = db_service.get_conversion_config(conversion_id)
        
        if not config:
            raise HTTPException(
                status_code=404,
                detail=f"Configuration not found for conversion: {conversion_id}"
            )
        
        return config
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get config: {str(e)}")


@router.get("/health")
async def health_check(db_service = Depends(get_db_service)) -> Dict[str, str]:
    """
    Health check endpoint
    
    Returns:
        Health status
    """
    try:
        # Check database connection
        db_service.db.command('ping')
        return {
            "status": "healthy",
            "service": "converter",
            "database": "connected"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "service": "converter",
            "database": "disconnected",
            "error": str(e)
        }


@router.get("/insights")
async def get_conversion_insights(
    db_service = Depends(get_db_service)
) -> Dict[str, Any]:
    """
    Get insights from conversion configurations
    
    Returns:
        Dictionary with configuration insights and statistics
    """
    try:
        # Get all conversion configurations
        configs = list(db_service.db['conversion_registry'].find({}))
        
        # Get semantic patterns
        patterns = list(db_service.db['semantic_patterns'].find({}))
        
        # Calculate statistics from configurations
        total_configs = len(configs)
        format_pairs = []
        total_mappings = 0
        processing_stats = {"RULES": 0, "AI": 0, "HUMAN": 0}
        
        for config in configs:
            config_id = config.get('_id', '')
            if '_to_' in config_id:
                source, target = config_id.split('_to_')
                format_pairs.append({
                    "source": source,
                    "target": target,
                    "id": config_id
                })
            
            # Count mappings by processing lane
            mappings = config.get('mappings', [])
            total_mappings += len(mappings)
            for mapping in mappings:
                lane = mapping.get('processing_lane', 'RULES')
                processing_stats[lane] = processing_stats.get(lane, 0) + 1
        
        return {
            "total_configurations": total_configs,
            "total_semantic_patterns": len(patterns),
            "format_pairs": format_pairs,
            "total_field_mappings": total_mappings,
            "processing_distribution": {
                "rules": processing_stats.get('RULES', 0),
                "ai": processing_stats.get('AI', 0),
                "human": processing_stats.get('HUMAN', 0)
            },
            "ai_enabled_formats": [fp for fp in format_pairs if processing_stats.get('AI', 0) > 0],
            "patterns_learned": [p.get('_id') for p in patterns[:10]]  # First 10 pattern names
        }
        
    except Exception as e:
        logger.error(f"Failed to get insights: {e}")
        return {
            "error": str(e),
            "total_configurations": 0,
            "processing_distribution": {"rules": 0, "ai": 0, "human": 0}
        }


@router.get("/samples/{format_code}")
async def get_format_sample(
    format_code: str,
    db_service = Depends(get_db_service)
) -> Dict[str, Any]:
    """
    Get sample message for a specific format
    
    Args:
        format_code: Format code (e.g., "MT103", "pacs.008")
        
    Returns:
        Sample message and metadata
    """
    samples = {
        "MT103": """{1:F01CHASUS33XXXX0000000000}{2:I103DEUTDEFFXXXXN}{3:{108:ILOVESEPA}}{4:
:20:TEST001
:23B:CRED
:32A:241215USD125750,50
:50K:/US64209876543210987654
ACME TECHNOLOGIES INC
1234 INNOVATION DRIVE
SILICON VALLEY CA 94025
USA
:52A:CHASUS33XXX
:53A:DEUTDEFFXXX
:59:/DE89370400440532013000
GLOBAL SUPPLIES GMBH
INDUSTRIESTRASSE 78
60329 FRANKFURT
GERMANY
:70:INV-2024-11-3847 DATED 15.11.2024
PAYMENT FOR ELECTRONIC COMPONENTS
ORDER PO-8934567 QTY 5000 UNITS
:71A:SHA
:72:/ACC/URGENT PROCESSING REQUIRED
/REC/NOTIFY ACCOUNTS@GLOBALSUPPLIES.DE
-}""",
        "MT202": """{1:F01CHASUS33AXXX0000000000}{2:I202DEUTDEFFXXXXN}{3:{108:PRIORITY}}{4:
:20:MT202TEST
:21:REF2024MT202001
:32A:241215EUR500000,00
:52A:CHASUS33XXX
:57A:DEUTDEFFXXX
:58A:/DE12345678901234567890
BENEFICIARY INSTITUTION
:72:/BNF/TREASURY OPERATIONS
/INS/PRIORITY PROCESSING
-}""",
        "pacs.008": """<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>TEST001</MsgId>
      <CreDtTm>2024-12-15T10:00:00</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <EndToEndId>TEST001</EndToEndId>
        <TxId>TEST001</TxId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="USD">125750.50</IntrBkSttlmAmt>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>""",
        "pacs.009": """<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>MT202TEST</MsgId>
      <CreDtTm>2024-12-15T10:00:00</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
    </GrpHdr>
  </FIToFICstmrCdtTrf>
</Document>"""
    }
    
    if format_code not in samples:
        raise HTTPException(status_code=404, detail=f"Sample not found for format: {format_code}")
    
    return {
        "format_code": format_code,
        "sample": samples[format_code],
        "description": f"Sample {format_code} message for testing"
    }


@router.get("/convert/{conversion_id}/details")
async def get_conversion_details(
    conversion_id: str,
    db_service = Depends(get_db_service)
) -> Dict[str, Any]:
    """
    Get detailed field mappings from conversion configuration
    
    Args:
        conversion_id: Either a UUID from actual conversion or format pair (e.g., "MT103_to_pacs.008")
        
    Returns:
        Detailed field mapping information from configuration
    """
    try:
        # Check if this is a UUID (actual conversion) or format pair
        config = None
        actual_conversion_data = None
        
        # Try to parse as UUID first (actual conversion result)
        import uuid
        try:
            uuid.UUID(conversion_id)
            # This is a UUID - try to get the actual conversion result
            # For now, we'll just use the format pair from the conversion
            # In a real system, you'd store conversion results and retrieve them here
            logger.info(f"UUID conversion ID received: {conversion_id}")
            # Default to MT103_to_pacs.008 for demo purposes
            # In production, you'd retrieve the actual conversion from a database
            conversion_id = "MT103_to_pacs.008"
        except ValueError:
            # Not a UUID, treat as format pair
            pass
        
        # Get configuration from conversion_registry
        config = db_service.get_conversion_config(conversion_id)
        
        if not config:
            # Try alternative format (e.g., MT103_to_pacs.008 or MT103-to-pacs.008)
            alt_conversion_id = conversion_id.replace("-", "_") if "-" in conversion_id else conversion_id.replace("_", "-")
            config = db_service.get_conversion_config(alt_conversion_id)
            if config:
                conversion_id = alt_conversion_id
        
        if not config:
            raise HTTPException(
                status_code=404,
                detail=f"Configuration not found for: {conversion_id}"
            )
        
        # Extract field details from mappings
        field_details = []
        for mapping in config.get('mappings', []):
            field_details.append({
                "field_id": mapping.get('source'),
                "target_fields": mapping.get('targets', []),
                "processing_lane": mapping.get('processing_lane', 'RULES'),
                "transform": mapping.get('transform', 'copy'),
                "confidence_threshold": mapping.get('confidence_threshold', 1.0),
                "field_type": mapping.get('field_type')  # For AI fields
            })
        
        # Calculate summary statistics
        processing_summary = {
            "rules_fields": len([f for f in field_details if f['processing_lane'] == 'RULES']),
            "ai_fields": len([f for f in field_details if f['processing_lane'] == 'AI']),
            "human_review_fields": len([f for f in field_details if f['processing_lane'] == 'HUMAN'])
        }
        
        return {
            "conversion_id": conversion_id,
            "field_details": field_details,
            "total_fields": len(field_details),
            "processing_summary": processing_summary,
            "ai_enabled": processing_summary['ai_fields'] > 0,
            "human_review_enabled": config.get('human_review', {}).get('enabled', False)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get conversion details: {e}")
        raise HTTPException(status_code=500, detail=str(e))