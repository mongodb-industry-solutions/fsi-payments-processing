"""
Demo Interactive API
API endpoints for the payment builder demo system
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime

from ..services.payment_builder_service import PaymentBuilder
from ..services.db_service import MongoDBService
from ..core.converter import UniversalConverter
from ..services.conversion_router import ConversionRouter
from ..config.settings import get_settings
from ..config.feature_flags import feature_flags
from ..models.demo_models import (
    BuildPaymentRequest,
    BuildPaymentResponse,
    ExecutePaymentRequest,
    ExecutePaymentResponse,
    GetFormSchemaResponse,
    PaymentTypeSummary,
    ValidationResult
)

logger = logging.getLogger(__name__)

# Create router for demo interactive endpoints
router = APIRouter(prefix="/api/v1/demo", tags=["demo-interactive"])

# Initialize payment builder service
payment_builder = PaymentBuilder()


@router.get("/payment/types", response_model=List[PaymentTypeSummary])
async def get_payment_types():
    """
    Get list of available payment types for user selection.
    Returns user-friendly payment options like Cross-Border, Card Payment, etc.
    """
    try:
        payment_types = payment_builder.get_payment_types()
        logger.info(f"Returning {len(payment_types)} payment types")
        return payment_types
    except Exception as e:
        logger.error(f"Error getting payment types: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/payment/types/{payment_type}/form", response_model=GetFormSchemaResponse)
async def get_payment_form(
    payment_type: str,
    prefill: bool = Query(False, description="Include demo values for quick testing")
):
    """
    Get dynamic form schema for a specific payment type.

    Args:
        payment_type: ID of the payment type (e.g., 'cross_border')
        prefill: If true, includes pre-filled demo values

    Returns:
        Form schema with field definitions and optional demo values
    """
    try:
        form_data = payment_builder.get_form_schema(payment_type, include_demo_values=prefill)

        if not form_data:
            raise HTTPException(
                status_code=404,
                detail=f"Payment type '{payment_type}' not found"
            )

        logger.info(f"Returning form schema for {payment_type} (prefill={prefill})")
        return form_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting form schema: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/payment/types/{payment_type}/demo-values")
async def get_demo_values(payment_type: str):
    """
    Get just the demo values for a payment type.
    Useful for 'Load Example' button functionality.
    """
    try:
        demo_values = payment_builder.get_demo_values(payment_type)

        if demo_values is None:
            raise HTTPException(
                status_code=404,
                detail=f"Payment type '{payment_type}' not found"
            )

        return {
            "payment_type": payment_type,
            "scenario": demo_values.get("scenario_name", "Demo Transaction"),
            "demo_values": demo_values.get("values", {}),
            "editable": True,
            "note": "All fields are editable - modify as needed"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting demo values: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/payment/build", response_model=BuildPaymentResponse)
async def build_payment(request: BuildPaymentRequest):
    """
    Build a payment message from user input and template.

    This endpoint:
    1. Takes user form data
    2. Validates against schema
    3. Substitutes into message template
    4. Returns built message ready for conversion
    """
    try:
        # Validate form data
        validation_result = payment_builder.validate_form_data(
            request.payment_type,
            request.form_data
        )

        if not validation_result["valid"]:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Validation failed",
                    "errors": validation_result["errors"]
                }
            )

        # Build the payment message
        result = payment_builder.build_payment_message(
            request.payment_type,
            request.form_data
        )

        logger.info(f"Built {request.payment_type} message ({result['metadata']['message_length']} bytes)")

        return BuildPaymentResponse(**result)

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error building payment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/payment/validate")
async def validate_payment_data(
    payment_type: str,
    form_data: Dict[str, Any]
) -> ValidationResult:
    """
    Validate form data without building the message.
    Useful for real-time validation in the UI.
    """
    try:
        result = payment_builder.validate_form_data(payment_type, form_data)
        return ValidationResult(**result)

    except Exception as e:
        logger.error(f"Error validating payment data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/payment/execute", response_model=ExecutePaymentResponse)
async def execute_payment(request: ExecutePaymentRequest):
    """
    Build and execute a payment conversion.

    This endpoint:
    1. Builds the payment message from user input
    2. Runs it through the converter
    3. Returns conversion result with full tracking
    """
    try:
        # Check if demo mode is enabled
        if not feature_flags.is_demo_mode():
            raise HTTPException(
                status_code=403,
                detail="Demo mode is not enabled"
            )

        # First, build the payment message
        build_result = payment_builder.build_payment_message(
            request.payment_type,
            request.form_data
        )

        if not build_result["success"]:
            raise HTTPException(
                status_code=400,
                detail="Failed to build payment message"
            )

        # Get database connection
        settings = get_settings()
        db_service = MongoDBService(
            connection_string=settings.mongodb_uri,
            database_name=settings.database_name
        )

        # Initialize converter
        source_format = build_result["source_format"]
        target_format = build_result["target_format"]

        # Check if direct conversion exists
        conversion_id = f"{source_format}_to_{target_format}"
        direct_config_exists = db_service.db['conversion_registry'].find_one({'_id': conversion_id}) is not None

        # Use ConversionRouter if no direct conversion exists
        if not direct_config_exists:
            logger.info(f"No direct conversion found for {source_format} → {target_format}, attempting multi-hop routing")
            router_service = ConversionRouter(db_service)
            conversion_result = router_service.convert(
                source_format=source_format,
                target_format=target_format,
                message=build_result["message"]
            )
        else:
            # Use existing UniversalConverter for direct conversions
            try:
                converter = UniversalConverter(
                    db_service,
                    source_format,
                    target_format
                )
                conversion_result = converter.convert(build_result["message"])
            except ValueError as e:
                # This shouldn't happen if direct_config_exists is true, but handle it anyway
                logger.error(f"Unexpected error with direct conversion: {e}")
                conversion_result = {
                    "success": False,
                    "error": f"Conversion from {source_format} to {target_format} failed: {str(e)}",
                    "metadata": {}
                }

        # Prepare response
        response = ExecutePaymentResponse(
            success=conversion_result["success"],
            payment_type=request.payment_type,
            source_format=source_format,
            target_format=target_format,
            source_message=build_result["message"],
            converted_message=conversion_result.get("converted_message"),
            conversion_metadata=conversion_result.get("metadata", {}),
            processing_stats=conversion_result.get("metadata", {}).get("processing_stats"),
            confidence_scores=conversion_result.get("metadata", {}).get("confidence_scores"),
            human_review_required=conversion_result.get("metadata", {}).get("human_review_required", False)
        )

        # Add demo insights if visualization is enabled
        if feature_flags.SHOW_LANE_VISUALIZATION:
            response.demo_insights = {
                "lane_distribution": conversion_result.get("metadata", {}).get("processing_stats"),
                "processing_time": conversion_result.get("metadata", {}).get("processing_time_seconds"),
                "fields_processed": conversion_result.get("metadata", {}).get("transformed_fields_count")
            }

        logger.info(f"Executed {request.payment_type} conversion: {source_format} → {target_format}")

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing payment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/payment/journey/{payment_type}")
async def get_payment_journey(payment_type: str):
    """
    Get visualization data for payment journey.
    Shows how a payment flows through the system.
    """
    try:
        scenario = payment_builder.get_payment_scenario(payment_type)

        if not scenario:
            raise HTTPException(
                status_code=404,
                detail=f"Payment type '{payment_type}' not found"
            )

        # Build journey visualization based on payment type
        journey = {
            "payment_type": payment_type,
            "display_name": scenario["display_name"],
            "source_format": scenario["source_format"],
            "target_format": scenario["target_format"],
            "hops": []
        }

        # Add processing hops based on payment type
        if payment_type == "instant_payment":
            # Multi-hop through JSON
            journey["hops"] = [
                {
                    "hop_number": 1,
                    "description": "Parse pacs.008 XML",
                    "format_in": "pacs.008",
                    "format_out": "parsed_fields",
                    "processing_time_ms": 50,
                    "processing_lane": "RULES"
                },
                {
                    "hop_number": 2,
                    "description": "Convert to Canonical JSON",
                    "format_in": "parsed_fields",
                    "format_out": "JSON",
                    "processing_time_ms": 100,
                    "processing_lane": "RULES"
                },
                {
                    "hop_number": 3,
                    "description": "Transform JSON to TARGET2",
                    "format_in": "JSON",
                    "format_out": "TARGET2",
                    "processing_time_ms": 150,
                    "processing_lane": "RULES"
                }
            ]
        else:
            # Direct conversion
            journey["hops"] = [
                {
                    "hop_number": 1,
                    "description": f"Parse {scenario['source_format']}",
                    "format_in": scenario["source_format"],
                    "format_out": "parsed_fields",
                    "processing_time_ms": 50,
                    "processing_lane": "RULES"
                },
                {
                    "hop_number": 2,
                    "description": "Transform fields",
                    "format_in": "parsed_fields",
                    "format_out": "transformed_fields",
                    "processing_time_ms": 200,
                    "processing_lane": "MIXED"
                },
                {
                    "hop_number": 3,
                    "description": f"Build {scenario['target_format']}",
                    "format_in": "transformed_fields",
                    "format_out": scenario["target_format"],
                    "processing_time_ms": 50,
                    "processing_lane": "RULES"
                }
            ]

        journey["total_hops"] = len(journey["hops"])
        journey["total_time_ms"] = sum(h["processing_time_ms"] for h in journey["hops"])
        journey["complexity_score"] = min(len(journey["hops"]) / 5.0, 1.0)

        return journey

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting payment journey: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/payment/stats")
async def get_payment_statistics():
    """
    Get statistics about payment builder usage.
    Useful for demo dashboard.
    """
    try:
        payment_types = payment_builder.get_payment_types()

        stats = {
            "total_payment_types": len(payment_types),
            "configured_conversions": 0,
            "demo_ready": True,
            "features": {
                "multi_hop_routing": True,
                "ai_processing": get_settings().enable_ai_processing,
                "human_review": get_settings().enable_human_review,
                "real_time_tracking": True
            },
            "payment_types": [pt["name"] for pt in payment_types]
        }

        # Count configured conversions
        settings = get_settings()
        try:
            db_service = MongoDBService(
                connection_string=settings.mongodb_uri,
                database_name=settings.database_name
            )
            # Count conversion configs
            configs = db_service.db["conversion_registry"].count_documents({})
            stats["configured_conversions"] = configs
        except:
            pass

        return stats

    except Exception as e:
        logger.error(f"Error getting payment statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))