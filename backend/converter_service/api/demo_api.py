"""
Demo API Endpoints
Separate endpoints for demonstration purposes with enhanced visualization
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from typing import Dict, Any, Optional, List
import asyncio
import json
import logging
from datetime import datetime

from ..core.converter import UniversalConverter
from ..services.db_service import MongoDBService
from ..config.feature_flags import feature_flags
from ..config.settings import get_settings
from ..utils.progress_tracker import ProgressTracker, ProcessingStage, FieldStatus
from ..utils.demo_fallback_enhancer import DemoFallbackEnhancer
from ..models.requests import ConversionRequest
from ..models.responses import ConversionResponse
from ..services.payment_journey_builder import PaymentJourneyBuilder
from ..services.country_router import CountryRouter

logger = logging.getLogger(__name__)

# Create demo router
router = APIRouter(prefix="/api/v1/demo", tags=["demo"])

# Store active WebSocket connections
active_connections: Dict[str, WebSocket] = {}

# Store recent conversions for demo reference (with max size limit)
recent_conversions: Dict[str, Dict[str, Any]] = {}
MAX_RECENT_CONVERSIONS = 20  # Limit stored conversions

# Initialize journey builder
journey_builder = PaymentJourneyBuilder()


@router.get("/status")
async def get_demo_status():
    """Check if demo mode is enabled and get feature flags"""
    return {
        "demo_enabled": feature_flags.is_demo_mode(),
        "features": feature_flags.get_all_flags(),
        "message": "Demo mode is active" if feature_flags.is_demo_mode() else "Demo mode is disabled"
    }


@router.post("/convert")
async def demo_convert_with_visualization(request: ConversionRequest):
    """
    Enhanced conversion endpoint with full visualization data.
    Shows real-time processing details for demo purposes.
    """
    
    if not feature_flags.is_demo_mode():
        raise HTTPException(status_code=403, detail="Demo mode is not enabled")
    
    try:
        # Initialize progress tracker
        progress_tracker = ProgressTracker()
        conversion_id = progress_tracker.conversion_id
        
        # Initialize database connection
        settings = get_settings()
        db_service = MongoDBService(
            connection_string=settings.mongodb_uri,
            database_name=settings.database_name
        )
        
        # Start parsing stage
        progress_tracker.start_stage(ProcessingStage.PARSING, 
                                    f"Parsing {request.source_format} message")
        
        # Initialize converter with demo enhancements
        converter = UniversalConverter(
            db_service,
            request.source_format,
            request.target_format
        )
        
        # Inject progress tracker into transformer if demo mode
        if hasattr(converter.transformer, 'set_progress_tracker'):
            converter.transformer.set_progress_tracker(progress_tracker)
        
        # Enhanced conversion with progress tracking
        demo_result = await _perform_demo_conversion(
            converter, 
            request.message,
            progress_tracker
        )
        
        # Get complete visualization data
        progress_summary = progress_tracker.get_summary()
        lane_visualization = progress_tracker.get_lane_visualization()
        
        # Store for later retrieval (with size limit)
        recent_conversions[conversion_id] = {
            "result": demo_result,
            "progress": progress_summary,
            "lanes": lane_visualization,
            "timestamp": datetime.now().isoformat()
        }
        
        # Clean up old conversions if we exceed the limit
        if len(recent_conversions) > MAX_RECENT_CONVERSIONS:
            # Remove oldest conversions
            sorted_ids = sorted(recent_conversions.keys(), 
                              key=lambda x: recent_conversions[x]["timestamp"])
            for old_id in sorted_ids[:len(recent_conversions) - MAX_RECENT_CONVERSIONS]:
                del recent_conversions[old_id]
        
        # Add journey visualization based on payment type and form data
        journey_data = None
        try:
            # Determine payment type from formats
            payment_type_id = _determine_payment_type(request.source_format, request.target_format)

            # Extract form data from request (if provided in metadata)
            form_data = getattr(request, 'metadata', {}).get('form_data', {})
            if not form_data:
                # Use parsed fields as form data for complexity assessment
                form_data = parsed_fields if 'parsed_fields' in locals() else {}

            # Get journey visualization
            journey_data = journey_builder.get_journey(
                payment_type_id=payment_type_id,
                form_data=form_data
            )
        except Exception as e:
            logger.warning(f"Could not generate journey visualization: {e}")
            journey_data = {"error": "Journey visualization unavailable"}

        # Combine standard result with demo enhancements
        response = {
            **demo_result,
            "demo_insights": {
                "conversion_id": conversion_id,
                "progress_summary": progress_summary,
                "lane_visualization": lane_visualization,
                "processing_timeline": progress_tracker.stage_timeline,
                "field_details": progress_tracker.field_progress,
                "total_processing_time": progress_summary["processing_time_seconds"]
            },
            "journey_visualization": journey_data
        }

        return response
        
    except Exception as e:
        logger.error(f"Demo conversion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _perform_demo_conversion(converter: UniversalConverter, 
                                  message: str,
                                  progress_tracker: ProgressTracker) -> Dict[str, Any]:
    """
    Perform conversion with detailed progress tracking.
    This wraps the standard conversion with demo enhancements.
    """
    
    # Parse message
    progress_tracker.start_stage(ProcessingStage.PARSING)
    parsed_fields = converter.parser.parse(message)
    progress_tracker.complete_stage(ProcessingStage.PARSING, 
                                   {"fields_found": len(parsed_fields)})
    
    # Add small delay for demo visibility
    if feature_flags.ENABLE_DEMO_MODE:
        await asyncio.sleep(0.3)  # Small delay to show parsing
    
    # Transform fields with detailed tracking
    progress_tracker.start_stage(ProcessingStage.TRANSFORMING)
    
    # Track each field transformation
    for mapping in converter.transformer.mappings:
        field_name = mapping.get('source')
        lane = mapping.get('processing_lane', 'RULES')
        
        if field_name and field_name in parsed_fields:
            progress_tracker.start_field_processing(field_name, lane, {
                "transform": mapping.get('transform', 'copy'),
                "targets": mapping.get('targets', [])
            })
            
            # Add delay for AI fields to show processing
            if lane == 'AI' and feature_flags.ENABLE_DEMO_MODE:
                await asyncio.sleep(0.5)  # Show AI processing happening
    
    # Perform actual transformation
    transformed_fields = converter.transformer.transform(parsed_fields)
    
    # Complete field tracking based on transformer results
    processing_summary = converter.transformer.get_processing_summary()
    
    for field_name in progress_tracker.field_progress:
        confidence = processing_summary['confidence_scores'].get(field_name, 1.0)
        status = FieldStatus.REVIEW_NEEDED if confidence < 0.8 else FieldStatus.COMPLETED
        progress_tracker.complete_field_processing(field_name, status, None, confidence)
    
    progress_tracker.complete_stage(ProcessingStage.TRANSFORMING,
                                   {"fields_transformed": len(transformed_fields)})
    
    # Build output
    progress_tracker.start_stage(ProcessingStage.BUILDING)
    output_message = converter.builder.build(transformed_fields)
    progress_tracker.complete_stage(ProcessingStage.BUILDING)

    # Enhance output with intelligent demo defaults (if enabled)
    if feature_flags.is_demo_mode() and feature_flags.ENABLE_DEMO_FALLBACK:
        output_message = DemoFallbackEnhancer.enhance_conversion_output(
            output_message,
            converter.source_format,
            converter.target_format
        )

    # Mark as complete
    progress_tracker.start_stage(ProcessingStage.COMPLETE)

    return {
        "success": True,
        "converted_message": output_message,
        "metadata": {
            "source_format": converter.source_format,
            "target_format": converter.target_format,
            "parsed_fields_count": len(parsed_fields),
            "transformed_fields_count": len(transformed_fields),
            "demo_enhanced": feature_flags.is_demo_mode(),
            **processing_summary
        }
    }


@router.get("/conversion/{conversion_id}/ai-reasoning")
async def get_ai_reasoning_for_conversion(conversion_id: str):
    """
    Get actual AI reasoning from a specific conversion.
    Shows real reasoning from the AI service.
    """
    
    if not feature_flags.SHOW_AI_REASONING:
        raise HTTPException(status_code=403, 
                          detail="AI reasoning visualization is not enabled")
    
    if conversion_id not in recent_conversions:
        raise HTTPException(status_code=404, 
                          detail="Conversion not found")
    
    conversion_data = recent_conversions[conversion_id]
    field_details = conversion_data["progress"]["field_details"]
    
    # Extract AI fields and their reasoning
    ai_fields = {}
    for field_name, details in field_details.items():
        if details.get("lane") == "AI":
            ai_fields[field_name] = {
                "field": field_name,
                "lane": "AI",
                "confidence": details.get("confidence"),
                "reasoning": details.get("ai_reasoning", {
                    "message": "AI reasoning would be captured here from the actual AI service",
                    "note": "Enable SHOW_AI_REASONING in transformer to capture full details"
                })
            }
    
    if not ai_fields:
        return {
            "conversion_id": conversion_id,
            "message": "No AI fields processed in this conversion",
            "all_fields_used_rules": True
        }
    
    return {
        "conversion_id": conversion_id,
        "ai_fields": ai_fields,
        "total_ai_fields": len(ai_fields)
    }


@router.get("/conversion/{conversion_id}/confidence")
async def get_confidence_breakdown_for_conversion(conversion_id: str):
    """
    Get actual confidence breakdown from a specific conversion.
    Shows real confidence calculations.
    """
    
    if not feature_flags.SHOW_CONFIDENCE_BREAKDOWN:
        raise HTTPException(status_code=403,
                          detail="Confidence breakdown visualization is not enabled")
    
    if conversion_id not in recent_conversions:
        raise HTTPException(status_code=404, 
                          detail="Conversion not found")
    
    conversion_data = recent_conversions[conversion_id]
    confidence_scores = conversion_data["result"]["metadata"].get("confidence_scores", {})
    field_details = conversion_data["progress"]["field_details"]
    
    # Build confidence breakdown from actual data
    breakdown = {}
    for field_name, confidence in confidence_scores.items():
        field_info = field_details.get(field_name, {})
        breakdown[field_name] = {
            "field": field_name,
            "final_confidence": confidence,
            "lane": field_info.get("lane", "RULES"),
            "needs_review": confidence < 0.8,
            "processing_time": field_info.get("processing_time"),
            "confidence_factors": field_info.get("confidence_breakdown", {
                "note": "Detailed breakdown available when transformer captures it"
            })
        }
    
    return {
        "conversion_id": conversion_id,
        "confidence_breakdown": breakdown,
        "summary": {
            "average_confidence": sum(confidence_scores.values()) / len(confidence_scores) if confidence_scores else 1.0,
            "fields_needing_review": sum(1 for c in confidence_scores.values() if c < 0.8),
            "high_confidence_fields": sum(1 for c in confidence_scores.values() if c >= 0.9)
        }
    }


@router.get("/conversion/{conversion_id}/lanes")
async def get_lane_distribution_for_conversion(conversion_id: str):
    """
    Get actual lane distribution from a specific conversion.
    Shows real processing lane usage.
    """
    
    if not feature_flags.SHOW_LANE_VISUALIZATION:
        raise HTTPException(status_code=403,
                          detail="Lane visualization is not enabled")
    
    if conversion_id not in recent_conversions:
        raise HTTPException(status_code=404, 
                          detail="Conversion not found")
    
    conversion_data = recent_conversions[conversion_id]
    lane_data = conversion_data["lanes"]
    processing_stats = conversion_data["result"]["metadata"].get("processing_stats", {})
    
    # Use actual data from the conversion
    distribution = {}
    
    for lane_name in ["RULES", "AI", "HUMAN"]:
        lane_key = f"{lane_name.lower()}_lane"
        stats = processing_stats.get(lane_key, {})
        fields = lane_data["lanes"].get(lane_name, [])
        
        distribution[lane_name] = {
            "count": stats.get("count", len(fields)),
            "fields": stats.get("fields", [f["field"] for f in fields]),
            "percentage": 0,  # Will calculate below
            "average_confidence": sum(f.get("confidence", 0) for f in fields) / len(fields) if fields else 0,
            "processing_details": fields
        }
    
    # Calculate percentages
    total_fields = sum(d["count"] for d in distribution.values())
    if total_fields > 0:
        for lane_data in distribution.values():
            lane_data["percentage"] = (lane_data["count"] / total_fields) * 100
    
    return {
        "conversion_id": conversion_id,
        "distribution": distribution,
        "total_fields": total_fields,
        "timestamp": conversion_data["timestamp"],
        "insights": {
            "primary_lane": max(distribution.items(), key=lambda x: x[1]["count"])[0] if distribution else "RULES",
            "ai_usage": "high" if distribution.get("AI", {}).get("percentage", 0) > 20 else "moderate" if distribution.get("AI", {}).get("percentage", 0) > 10 else "minimal",
            "human_intervention_required": distribution.get("HUMAN", {}).get("count", 0) > 0
        }
    }


@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """
    WebSocket endpoint for real-time progress updates.
    Allows frontend to receive live processing updates.
    """
    
    if not feature_flags.ENABLE_WEBSOCKET:
        await websocket.close(code=4003, reason="WebSocket support is not enabled")
        return
    
    await websocket.accept()
    active_connections[client_id] = websocket
    
    try:
        while True:
            # Keep connection alive and wait for messages
            data = await websocket.receive_text()
            
            # Handle different message types
            message = json.loads(data)
            if message.get("type") == "subscribe":
                conversion_id = message.get("conversion_id")
                await websocket.send_text(json.dumps({
                    "type": "subscribed",
                    "conversion_id": conversion_id
                }))
            
    except WebSocketDisconnect:
        del active_connections[client_id]
        logger.info(f"Client {client_id} disconnected")


async def broadcast_progress(update: Dict[str, Any]):
    """
    Broadcast progress updates to all connected WebSocket clients.
    Called by progress tracker callbacks.
    """
    
    if not active_connections:
        return
    
    message = json.dumps(update)
    
    # Send to all connected clients
    disconnected = []
    for client_id, websocket in active_connections.items():
        try:
            await websocket.send_text(message)
        except:
            disconnected.append(client_id)
    
    # Clean up disconnected clients
    for client_id in disconnected:
        del active_connections[client_id]


def _determine_payment_type(source_format: str, target_format: str) -> str:
    """
    Determine payment type ID based on source and target formats.
    Maps format pairs to payment types from demo_scenarios.json
    """
    format_mapping = {
        ("MT103", "pacs.008"): "cross_border",
        ("MT202", "pacs.009"): "bank_transfer",
        ("ISO8583_0200", "cain.001"): "card_payment",
        ("MT205", "pacs.009"): "fx_settlement",
        ("pacs.008", "TARGET2"): "instant_payment"
    }

    # Return matching payment type or default to cross_border
    return format_mapping.get((source_format, target_format), "cross_border")


@router.get("/journeys/payment-types")
async def get_journey_payment_types():
    """
    Get available payment types with their journey counts.
    """
    return journey_builder.get_available_payment_types()


@router.get("/journeys/{payment_type_id}")
async def get_payment_type_journeys(payment_type_id: str):
    """
    Get all possible journeys for a specific payment type.
    """
    payment_type = journey_builder.payment_types.get(payment_type_id)
    if not payment_type:
        raise HTTPException(status_code=404, detail=f"Payment type '{payment_type_id}' not found")

    return {
        "payment_type": payment_type_id,
        "display_name": payment_type.get("display_name"),
        "source_format": payment_type.get("source_format"),
        "target_format": payment_type.get("target_format"),
        "journeys": payment_type.get("possible_journeys", [])
    }


@router.get("/recent-conversions")
async def get_recent_conversions():
    """
    Get list of recent conversions for demo reference.
    Useful for accessing specific conversion details.
    """
    
    if not feature_flags.ENABLE_DEMO_MODE:
        raise HTTPException(status_code=403, detail="Demo mode is not enabled")
    
    # Clean up old conversions (older than 10 minutes)
    current_time = datetime.now()
    expired = []
    for conv_id, data in recent_conversions.items():
        conv_time = datetime.fromisoformat(data["timestamp"])
        if (current_time - conv_time).seconds > 600:  # 10 minutes
            expired.append(conv_id)
    
    for conv_id in expired:
        del recent_conversions[conv_id]
    
    # Return summary of recent conversions
    return {
        "conversions": [
            {
                "conversion_id": conv_id,
                "source_format": data["result"]["metadata"]["source_format"],
                "target_format": data["result"]["metadata"]["target_format"],
                "timestamp": data["timestamp"],
                "success": data["result"]["success"],
                "fields_count": data["result"]["metadata"]["parsed_fields_count"],
                "processing_time": data["progress"]["processing_time_seconds"]
            }
            for conv_id, data in recent_conversions.items()
        ],
        "total": len(recent_conversions)
    }


# ============================================================
# DEMO RESET AND LIVE EDIT ENDPOINTS
# ============================================================

@router.post("/reset")
async def reset_demo_environment(
    preview_only: bool = False,
    reset_type: str = "auto_generated"
):
    """
    Reset demo environment to clean state.
    Removes auto-generated configurations while preserving base configs.

    Args:
        preview_only: If true, shows what would be removed without actually removing
        reset_type: Type of reset - "auto_generated" | "demo_formats" | "all"

    Returns:
        Reset statistics or preview of what would be removed
    """

    if not feature_flags.is_demo_mode():
        raise HTTPException(status_code=403, detail="Demo mode is not enabled")

    try:
        from ..services.demo_reset_service import DemoResetService

        # Initialize reset service
        settings = get_settings()
        reset_service = DemoResetService(
            mongodb_uri=settings.mongodb_uri,
            database_name=settings.database_name
        )

        if preview_only:
            # Return preview of what would be removed
            preview = reset_service.get_reset_preview(reset_type)
            return {
                "success": True,
                "preview": True,
                **preview
            }
        else:
            # Execute the reset
            result = reset_service.reset_to_base_state(reset_type)

            # Clear recent conversions cache if reset successful
            if result.get("success"):
                recent_conversions.clear()
                logger.info(f"Demo reset completed: {result['configs_removed']} configs removed")

            return result

    except Exception as e:
        logger.error(f"Error during demo reset: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reset/preview")
async def preview_demo_reset(reset_type: str = "auto_generated"):
    """
    Preview what would be removed during a demo reset.
    Useful for checking state before reset.
    """
    return await reset_demo_environment(preview_only=True, reset_type=reset_type)


@router.post("/live-edit")
async def live_edit_configuration(request: Dict[str, Any]):
    """
    Simulate human review and live editing of auto-generated configuration.
    Demonstrates real-time configuration updates without downtime.

    Request body:
    {
        "config_id": "MT205_to_pacs.009",
        "add_mappings": [...],
        "remove_mappings": [...],
        "update_mappings": {...},
        "update_confidence": 0.85,
        "reviewer_name": "Demo Reviewer"
    }
    """

    if not feature_flags.is_demo_mode():
        raise HTTPException(status_code=403, detail="Demo mode is not enabled")

    try:
        config_id = request.get("config_id")
        if not config_id:
            raise HTTPException(status_code=400, detail="config_id is required")

        # Initialize database connection
        settings = get_settings()
        db_service = MongoDBService(
            connection_string=settings.mongodb_uri,
            database_name=settings.database_name
        )

        # Get the configuration
        config = db_service.db.conversion_registry.find_one({"_id": config_id})
        if not config:
            raise HTTPException(status_code=404, detail=f"Configuration {config_id} not found")

        # Build update document
        update_doc = {}

        # Add new mappings
        if "add_mappings" in request and request["add_mappings"]:
            current_mappings = config.get("mappings", [])
            new_mappings = request["add_mappings"]
            update_doc["mappings"] = current_mappings + new_mappings

        # Remove mappings
        if "remove_mappings" in request and request["remove_mappings"]:
            current_mappings = update_doc.get("mappings", config.get("mappings", []))
            fields_to_remove = request["remove_mappings"]
            update_doc["mappings"] = [
                m for m in current_mappings
                if m.get("source") not in fields_to_remove
            ]

        # Update specific mappings
        if "update_mappings" in request and request["update_mappings"]:
            current_mappings = update_doc.get("mappings", config.get("mappings", []))
            updates = request["update_mappings"]

            for mapping in current_mappings:
                field = mapping.get("source")
                if field in updates:
                    mapping.update(updates[field])

            update_doc["mappings"] = current_mappings

        # Recalculate confidence based on updated mappings
        # Instead of accepting confidence as input, calculate it
        final_mappings = update_doc.get("mappings", config.get("mappings", []))

        # Calculate new confidence based on field coverage
        total_fields = len(final_mappings)
        high_confidence_fields = len([m for m in final_mappings if m.get("confidence", 0.5) >= 0.8])

        # Simple confidence calculation for demo
        # (In production, this would use the semantic_learning_service._calculate_overall_confidence)
        if total_fields > 0:
            field_coverage = len(final_mappings) / max(10, len(final_mappings))  # Assume ~10 fields expected
            avg_field_confidence = sum(m.get("confidence", 0.95) for m in final_mappings) / len(final_mappings)
            new_confidence = round(field_coverage * avg_field_confidence * 0.95, 2)  # 0.95 for human review boost
        else:
            new_confidence = 0.0

        # Update metadata with recalculated confidence
        if "metadata" not in update_doc:
            update_doc["metadata"] = config.get("metadata", {})
        update_doc["metadata"]["generation_confidence"] = new_confidence
        update_doc["metadata"]["human_reviewed"] = True
        update_doc["metadata"]["review_timestamp"] = datetime.utcnow()
        update_doc["metadata"]["reviewer"] = request.get("reviewer_name", "Demo Reviewer")

        # Log the confidence change
        old_confidence = config.get("metadata", {}).get("generation_confidence", 0)
        logger.info(f"Confidence updated from {old_confidence:.2f} to {new_confidence:.2f} after human review")

        # Apply updates to MongoDB
        if update_doc:
            result = db_service.db.conversion_registry.update_one(
                {"_id": config_id},
                {"$set": update_doc}
            )

            if result.modified_count > 0:
                logger.info(f"Configuration {config_id} updated via live edit")

                return {
                    "success": True,
                    "config_id": config_id,
                    "modifications": {
                        "mappings_added": len(request.get("add_mappings", [])),
                        "mappings_removed": len(request.get("remove_mappings", [])),
                        "mappings_updated": len(request.get("update_mappings", {})),
                        "total_mappings": len(final_mappings)
                    },
                    "confidence": {
                        "before": old_confidence,
                        "after": new_confidence,
                        "improvement": round(new_confidence - old_confidence, 2)
                    },
                    "message": f"Configuration updated successfully. Confidence improved from {old_confidence:.1%} to {new_confidence:.1%}. Changes are immediately active via Change Streams."
                }
            else:
                return {
                    "success": False,
                    "config_id": config_id,
                    "message": "No changes were applied"
                }
        else:
            return {
                "success": False,
                "config_id": config_id,
                "message": "No updates specified"
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during live edit: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/auto-config/{config_id}/status")
async def get_auto_config_status(config_id: str):
    """
    Get detailed status of an auto-generated configuration.
    Shows what was recognized, what's missing, and confidence scores.
    """

    if not feature_flags.is_demo_mode():
        raise HTTPException(status_code=403, detail="Demo mode is not enabled")

    try:
        # Initialize database connection
        settings = get_settings()
        db_service = MongoDBService(
            connection_string=settings.mongodb_uri,
            database_name=settings.database_name
        )

        # Get the configuration
        config = db_service.db.conversion_registry.find_one({"_id": config_id})
        if not config:
            raise HTTPException(status_code=404, detail=f"Configuration {config_id} not found")

        # Analyze the configuration
        mappings = config.get("mappings", [])
        metadata = config.get("metadata", {})

        # Categorize mappings by confidence
        high_confidence = []
        medium_confidence = []
        low_confidence = []

        for mapping in mappings:
            confidence = mapping.get("confidence", 1.0)
            field_summary = {
                "source": mapping.get("source"),
                "targets": mapping.get("targets", []),
                "confidence": confidence,
                "lane": mapping.get("processing_lane", "RULES")
            }

            if confidence >= 0.8:
                high_confidence.append(field_summary)
            elif confidence >= 0.5:
                medium_confidence.append(field_summary)
            else:
                low_confidence.append(field_summary)

        # Identify recognized patterns
        recognized_patterns = []
        for mapping in mappings:
            if mapping.get("pattern_matched"):
                recognized_patterns.append({
                    "field": mapping.get("source"),
                    "pattern": mapping.get("pattern_matched"),
                    "confidence": mapping.get("confidence", 1.0)
                })

        # Calculate overall statistics
        total_fields = len(mappings)
        avg_confidence = sum(m.get("confidence", 1.0) for m in mappings) / total_fields if total_fields > 0 else 0

        # Determine review status
        needs_review = avg_confidence < 0.8 or len(low_confidence) > 0
        review_reasons = []
        if avg_confidence < 0.8:
            review_reasons.append(f"Overall confidence below threshold: {avg_confidence:.2%}")
        if len(low_confidence) > 0:
            review_reasons.append(f"{len(low_confidence)} fields with low confidence")

        return {
            "config_id": config_id,
            "auto_generated": metadata.get("auto_generated", False),
            "generation_confidence": metadata.get("generation_confidence", 0),
            "based_on": metadata.get("based_on"),
            "similar_to": metadata.get("similar_to"),
            "human_reviewed": metadata.get("human_reviewed", False),
            "statistics": {
                "total_fields": total_fields,
                "average_confidence": avg_confidence,
                "high_confidence_fields": len(high_confidence),
                "medium_confidence_fields": len(medium_confidence),
                "low_confidence_fields": len(low_confidence)
            },
            "field_breakdown": {
                "high_confidence": high_confidence,
                "medium_confidence": medium_confidence,
                "low_confidence": low_confidence
            },
            "recognized_patterns": recognized_patterns,
            "needs_review": needs_review,
            "review_reasons": review_reasons,
            "lane_distribution": {
                "RULES": len([m for m in mappings if m.get("processing_lane", "RULES") == "RULES"]),
                "AI": len([m for m in mappings if m.get("processing_lane") == "AI"]),
                "HUMAN": len([m for m in mappings if m.get("processing_lane") == "HUMAN"])
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting auto-config status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/auto-generated-configs")
async def list_auto_generated_configs():
    """
    List all auto-generated configurations in the system.
    Useful for demo management and cleanup.
    """

    if not feature_flags.is_demo_mode():
        raise HTTPException(status_code=403, detail="Demo mode is not enabled")

    try:
        from ..services.demo_reset_service import DemoResetService

        settings = get_settings()
        reset_service = DemoResetService(
            mongodb_uri=settings.mongodb_uri,
            database_name=settings.database_name
        )

        configs = reset_service.get_auto_generated_configs()

        return {
            "success": True,
            "total": len(configs),
            "configs": configs
        }

    except Exception as e:
        logger.error(f"Error listing auto-generated configs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# GEOGRAPHIC DEMO ENDPOINTS
# ============================================================

@router.get("/geographic/scenarios")
async def get_geographic_scenarios():
    """Get predefined geographic demo scenarios"""
    if not feature_flags.is_demo_mode():
        raise HTTPException(status_code=403, detail="Demo mode is not enabled")

    try:
        # Initialize database connection
        settings = get_settings()
        db_service = MongoDBService(
            connection_string=settings.mongodb_uri,
            database_name=settings.database_name
        )

        # Create country router instance
        country_router = CountryRouter(db_service)

        # Get demo scenarios
        scenarios = country_router.get_demo_scenarios()

        return {
            "success": True,
            "scenarios": scenarios,
            "total": len(scenarios)
        }

    except Exception as e:
        logger.error(f"Error getting geographic scenarios: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/geographic/countries")
async def get_country_formats():
    """Get country format mappings for map visualization"""
    if not feature_flags.is_demo_mode():
        raise HTTPException(status_code=403, detail="Demo mode is not enabled")

    try:
        # Initialize database connection
        settings = get_settings()
        db_service = MongoDBService(
            connection_string=settings.mongodb_uri,
            database_name=settings.database_name
        )

        # Create country router instance
        country_router = CountryRouter(db_service)

        # Get country formats
        country_formats = country_router.get_country_formats()

        return {
            "success": True,
            "countries": country_formats,
            "total": len(country_formats)
        }

    except Exception as e:
        logger.error(f"Error getting country formats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/geographic/execute-corridor")
async def execute_corridor(
    request: Dict[str, Any]
):
    """Execute real conversion for geographic corridor"""
    if not feature_flags.is_demo_mode():
        raise HTTPException(status_code=403, detail="Demo mode is not enabled")

    try:
        # Extract parameters
        source_country = request.get("source_country")
        target_country = request.get("target_country")
        scenario_id = request.get("scenario_id")

        if not source_country or not target_country:
            raise HTTPException(
                status_code=400,
                detail="source_country and target_country are required"
            )

        # Initialize database connection
        settings = get_settings()
        db_service = MongoDBService(
            connection_string=settings.mongodb_uri,
            database_name=settings.database_name
        )

        # Create country router instance
        country_router = CountryRouter(db_service)

        # Execute corridor demo
        result = await country_router.execute_corridor_demo(
            source_country=source_country,
            target_country=target_country,
            scenario_id=scenario_id
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing corridor demo: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/geographic/sample-messages")
async def get_sample_messages():
    """Get sample messages for each format used in demos"""
    if not feature_flags.is_demo_mode():
        raise HTTPException(status_code=403, detail="Demo mode is not enabled")

    try:
        # Initialize database connection
        settings = get_settings()
        db_service = MongoDBService(
            connection_string=settings.mongodb_uri,
            database_name=settings.database_name
        )

        # Create country router instance
        country_router = CountryRouter(db_service)

        # Get sample messages
        sample_messages = country_router.get_sample_messages()

        return {
            "success": True,
            "messages": sample_messages,
            "total": len(sample_messages)
        }

    except Exception as e:
        logger.error(f"Error getting sample messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))