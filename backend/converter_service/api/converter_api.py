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
    try:
        # Initialize converter
        converter = UniversalConverter(
            db_connector=db_service,
            source_format=request.source_format,
            target_format=request.target_format
        )
        
        # Perform conversion
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
        logger.error(f"Configuration error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Conversion failed: {e}")
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")


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