"""Human-in-the-loop review endpoints — agent resume and AI field review."""

from fastapi import APIRouter, status
from fastapi.responses import StreamingResponse
import logging
import json
import time

from src.api.models import ResumeAgentRequest, ResumeAIReviewRequest
from src.api.dependencies import (
    converter,
    mongodb_service,
    agent_client,
    SSE_HEADERS,
)
from src.api.state import pending_conversions, pending_ai_reviews
from src.exceptions import CountryValidationException

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/api/v1/agent/resume-stream", status_code=status.HTTP_200_OK)
async def resume_agent_workflow_stream(request: ResumeAgentRequest):
    """
    Resume the payment agent workflow after human review, streaming execution events.

    Continues with execution agent → hop 2 conversion → final result.
    """

    async def event_generator():
        try:
            logger.info(f"Streaming resume: thread_id={request.thread_id}, approved={request.decision.approved}")

            pending = pending_conversions.get(request.thread_id)
            if not pending:
                yield f"data: {json.dumps({'type': 'error', 'message': f'No pending conversion found for thread_id: {request.thread_id}'})}\n\n"
                return

            conversion_run_id = pending.get("conversion_run_id")
            target_format = pending.get("target_format")
            original_message = pending.get("original_message")
            use_ai = pending.get("use_ai", True)
            start_time = pending.get("start_time", time.time())
            hop1_details = pending.get("hop1_details", {})

            if not request.decision.approved:
                logger.info("Human rejected - skipping execution and hop 2")
                yield f"data: {json.dumps({'type': 'review_rejected', 'message': 'Human rejected proposed change'})}\n\n"
                pending_conversions.delete(request.thread_id)
                return

            yield f"data: {json.dumps({'type': 'review_approved', 'message': 'Human approved proposed change'})}\n\n"

            validation_exception = pending.get("validation_exception", {})
            field_name = validation_exception.get("field_name", "field")
            proposed_value = pending.get("proposed_value", "")

            msg = f"Execution agent applying '{proposed_value}' to {field_name}"
            yield f"data: {json.dumps({'type': 'agent_execution_start', 'message': msg, 'field': field_name, 'approved_value': proposed_value})}\n\n"

            # Stream execution events from payment agent
            final_state = {}
            async for event in agent_client.resume_workflow_stream(
                thread_id=request.thread_id,
                approved=request.decision.approved,
                modified_value=request.decision.modified_value
            ):
                if "execution" in event:
                    execution_state = event["execution"]
                    final_state.update(execution_state)
                    result = execution_state.get("result", {})
                    yield f"data: {json.dumps({'type': 'agent_execution', 'conversion_run_id': conversion_run_id, 'status': 'complete', 'field': result.get('field_name', ''), 'old_value': result.get('old_value', ''), 'new_value': result.get('new_value', ''), 'reasoning': result.get('reasoning', ''), 'details': {'field_name': result.get('field_name'), 'old_value': result.get('old_value'), 'new_value': result.get('new_value'), 'reasoning': result.get('reasoning'), 'success': result.get('success')}})}\n\n"

                elif "human_review" in event:
                    final_state.update(event["human_review"])

                elif event.get("type") == "complete":
                    logger.info("Agent execution complete, starting hop 2")

                elif event.get("type") == "error":
                    yield f"data: {json.dumps(event)}\n\n"
                    return

            # Hop 2: JSON → target_format
            hop2_start = time.time()
            yield f"data: {json.dumps({'type': 'hop2_start', 'source': 'JSON', 'target': target_format})}\n\n"

            cached_json = await mongodb_service.get_canonical_json(
                original_message,
                conversion_run_id=conversion_run_id
            )

            if not cached_json or not cached_json.get('jsonData'):
                yield f"data: {json.dumps({'type': 'error', 'message': 'Failed to retrieve corrected JSON from MongoDB'})}\n\n"
                return

            hop2_result = await converter.convert(
                source_format="JSON",
                target_format=target_format,
                message=cached_json['jsonData'],
                original_source_message=original_message,
                conversion_run_id=conversion_run_id,
                use_ai=use_ai
            )

            hop2_time = time.time() - hop2_start
            yield f"data: {json.dumps({'type': 'hop2_complete', 'time': round(hop2_time, 2), 'detailed_processing': hop2_result.get('detailed_processing', {})})}\n\n"

            total_time = time.time() - start_time
            stats = hop2_result["processing_stats"]
            lane_dist = stats.get("lane_distribution", {})

            yield f"data: {json.dumps({'type': 'complete', 'success': True, 'conversion_run_id': conversion_run_id, 'output': hop2_result['converted_message'], 'processing_stats': {'rules_lane': lane_dist.get('RULES', 0), 'ai_lane': lane_dist.get('AI', 0), 'human_lane': lane_dist.get('HUMAN', 0)}, 'total_time': round(total_time, 2), 'hop1_details': hop1_details, 'hop2_details': hop2_result.get('detailed_processing', {})})}\n\n"

            pending_conversions.delete(request.thread_id)
            logger.info(f"Streaming resume complete: total_time={total_time:.2f}s")

        except Exception as e:
            logger.error(f"Error in streaming resume: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@router.post("/api/v1/ai-review/resume-stream", status_code=status.HTTP_200_OK)
async def resume_ai_review_stream(request: ResumeAIReviewRequest):
    """
    Resume conversion after human review of AI-extracted fields.

    Applies corrections, runs country validation, then continues to hop 2.
    """

    async def event_generator():
        try:
            logger.info(f"AI review resume: run_id={request.conversion_run_id}, approved={request.decision.approved}")

            pending = pending_ai_reviews.get(request.conversion_run_id)
            if not pending:
                yield f"data: {json.dumps({'type': 'error', 'message': f'No pending AI review found for conversion_run_id: {request.conversion_run_id}'})}\n\n"
                return

            hop1_result = pending.get("hop1_result")
            req_data = pending.get("request")
            start_time = pending.get("start_time", time.time())
            conversion_run_id = request.conversion_run_id

            if not request.decision.approved:
                logger.info("Human rejected AI extractions - conversion stopped")
                yield f"data: {json.dumps({'type': 'ai_review_rejected', 'message': 'Human rejected AI extractions - conversion cancelled'})}\n\n"
                pending_ai_reviews.delete(conversion_run_id)
                return

            yield f"data: {json.dumps({'type': 'ai_review_approved', 'message': 'Human approved AI extractions - proceeding with conversion'})}\n\n"

            # Apply corrections if provided
            if request.decision.corrections:
                logger.info(f"Applying corrections to canonical JSON: {request.decision.corrections}")
                hop1_json = json.loads(hop1_result['converted_message']) if isinstance(
                    hop1_result['converted_message'], str
                ) else hop1_result['converted_message']

                for field_path, new_value in request.decision.corrections.items():
                    keys = field_path.split('.')
                    target = hop1_json
                    for key in keys[:-1]:
                        target = target.setdefault(key, {})
                    target[keys[-1]] = new_value

                hop1_result['converted_message'] = json.dumps(hop1_json)

                # TODO: mongodb_service.update_canonical_json is not defined
                # anywhere — this call is a pre-existing demo bug. When it is
                # implemented, write directly with camelCase keys (jsonData.*,
                # metadata.auditTrail.*, etc.). Track in a separate ticket;
                # do not silently no-op.
                await mongodb_service.update_canonical_json(
                    original_message=req_data['message'],
                    json_data=hop1_result['converted_message'],
                    conversion_run_id=conversion_run_id,
                    field_name="ai_review_corrections",
                    new_value=str(request.decision.corrections),
                    reason="Human corrections during AI review"
                )

            # Country validation (deferred from hop1)
            try:
                from src.validators.country_rules import validate_country_rules
                validate_country_rules(
                    canonical_json=json.loads(hop1_result['converted_message']),
                    conversion_id=f"{req_data['source_format']}_to_JSON",
                    source_format=req_data['source_format'],
                    target_format="JSON",
                    conversion_run_id=conversion_run_id,
                    detailed_processing=hop1_result.get('detailed_processing', {})
                )
                logger.info("Country validation passed after AI review")
            except CountryValidationException as e:
                logger.info(f"Country validation failed after AI review: {e.field_name}")
                yield f"data: {json.dumps({'type': 'validation_failed', 'country': e.conversion_context.get('additional_context', {}).get('country'), 'field': e.field_name, 'problem': e.problem, 'original_value': e.original_value})}\n\n"
                yield f"data: {json.dumps({'type': 'agent_start', 'problem': e.problem[:100] + '...' if len(e.problem) > 100 else e.problem, 'field': e.field_name})}\n\n"

                final_state = {}
                async for event in agent_client.process_payment_stream_with_review(
                    problem=e.problem,
                    field_name=e.field_name,
                    original_value=e.original_value,
                    payment_data=e.payment_data,
                    conversion_context=e.conversion_context
                ):
                    if "supervisor" in event:
                        supervisor_state = event["supervisor"]
                        final_state.update(supervisor_state)
                        messages = supervisor_state.get("messages", [])
                        reasoning = messages[-1].get("content", "") if messages else ""
                        next_agent = supervisor_state.get("next_agent", "")
                        yield f"data: {json.dumps({'type': 'agent_supervisor', 'status': 'routing', 'reasoning': reasoning, 'next_agent': next_agent, 'problem': e.problem[:100], 'details': {'messages_count': len(messages)}})}\n\n"

                    elif "resolution" in event:
                        resolution_state = event["resolution"]
                        final_state.update(resolution_state)
                        messages = resolution_state.get("messages", [])
                        for msg in messages:
                            if "tool_calls" in msg and msg.get("tool_calls"):
                                for tool_call in msg["tool_calls"]:
                                    yield f"data: {json.dumps({'type': 'tool_call', 'tool': tool_call.get('name', 'unknown'), 'args': tool_call.get('args', {}), 'reasoning': msg.get('content', ''), 'details': tool_call.get('args', {})})}\n\n"
                            if msg.get("type") == "tool":
                                try:
                                    tool_result = json.loads(msg.get("content", "{}"))
                                except Exception:
                                    tool_result = str(msg.get("content", ""))
                                yield f"data: {json.dumps({'type': 'tool_result', 'tool': msg.get('name', 'unknown'), 'result': tool_result, 'details': tool_result})}\n\n"
                        solution = resolution_state.get("solution", {})
                        if solution and solution.get("reasoning"):
                            yield f"data: {json.dumps({'type': 'agent_resolution', 'status': 'complete', 'proposed_value': solution.get('proposed_value', ''), 'confidence': solution.get('confidence', 0), 'reasoning': solution.get('reasoning', ''), 'details': solution})}\n\n"

                    elif "execution" in event:
                        execution_state = event["execution"]
                        final_state.update(execution_state)
                        result = execution_state.get("result", {})
                        yield f"data: {json.dumps({'type': 'agent_execution', 'conversion_run_id': conversion_run_id, 'status': 'complete', 'field': result.get('field_name', ''), 'old_value': result.get('old_value', ''), 'new_value': result.get('new_value', ''), 'reasoning': result.get('reasoning', ''), 'details': result})}\n\n"

                    elif event.get("type") == "review_required":
                        logger.info(f"Agent review required during AI resume: {event}")
                        pending_conversions.set(event.get("thread_id"), {
                            "conversion_run_id": conversion_run_id,
                            "source_format": req_data['source_format'],
                            "target_format": req_data['target_format'],
                            "original_message": req_data['message'],
                            "use_ai": req_data.get('use_ai', True),
                            "validation_exception": {
                                "problem": e.problem,
                                "field_name": e.field_name,
                                "original_value": e.original_value,
                                "conversion_context": e.conversion_context
                            },
                            "start_time": start_time,
                            "hop1_details": hop1_result.get('detailed_processing', {}),
                            "proposed_value": event.get("proposed_value", "")
                        })
                        yield f"data: {json.dumps(event)}\n\n"
                        pending_ai_reviews.delete(conversion_run_id)
                        return

                    elif event.get("type") == "complete":
                        agent_result = final_state.get("result", {})
                        yield f"data: {json.dumps({'type': 'agent_complete', 'new_value': agent_result.get('new_value'), 'field': e.field_name, 'success': agent_result.get('success', True)})}\n\n"

                    elif event.get("type") == "error":
                        yield f"data: {json.dumps({'type': 'error', 'message': event.get('message')})}\n\n"
                        return

                cached_json = await mongodb_service.get_canonical_json(req_data['message'], conversion_run_id=conversion_run_id)
                hop1_result['converted_message'] = cached_json['jsonData']

            # Hop 2: JSON → Target format
            yield f"data: {json.dumps({'type': 'hop2_start', 'source': 'JSON', 'target': req_data['target_format']})}\n\n"

            hop2_start = time.time()
            hop2_result = await converter.convert(
                source_format="JSON",
                target_format=req_data['target_format'],
                message=hop1_result['converted_message'],
                original_source_message=req_data['message'],
                conversion_run_id=conversion_run_id,
                use_ai=req_data.get('use_ai', True)
            )

            hop2_time = time.time() - hop2_start
            yield f"data: {json.dumps({'type': 'hop2_complete', 'time': round(hop2_time, 2), 'detailed_processing': hop2_result.get('detailed_processing', {})})}\n\n"

            total_time = time.time() - start_time
            stats = hop2_result["processing_stats"]
            lane_dist = stats.get("lane_distribution", {})

            yield f"data: {json.dumps({'type': 'complete', 'success': True, 'conversion_run_id': conversion_run_id, 'output': hop2_result['converted_message'], 'processing_stats': {'rules_lane': lane_dist.get('RULES', 0), 'ai_lane': lane_dist.get('AI', 0), 'human_lane': lane_dist.get('HUMAN', 0)}, 'confidence_scores': hop2_result.get('confidence_scores', {}), 'total_time': round(total_time, 2), 'hop1_details': hop1_result.get('detailed_processing', {}), 'hop2_details': hop2_result.get('detailed_processing', {}), 'human_reviewed': True})}\n\n"

            pending_ai_reviews.delete(conversion_run_id)
            logger.info(f"AI review resume complete: total_time={total_time:.2f}s")

        except Exception as e:
            logger.error(f"Error in AI review resume: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )
