"""
LangGraph workflow for payment agent system.

This module creates the multi-agent workflow using LangGraph's StateGraph.
The workflow orchestrates the Supervisor, Resolution, and Execution agents.

Workflow Structure:
1. START → Supervisor (analyzes task and routes)
2. Supervisor → Resolution Agent (if task needs research/determination)
   OR
   Supervisor → Execution Agent (if task is direct update)
3. Resolution → Human Review (interrupt for approval)
4. Human Review → Execution (if approved)
5. Execution → END

Key Concepts:
- StateGraph: Defines nodes and edges
- Conditional edges: Routes based on state values
- AgentState: Shared state flows through all nodes
- interrupt(): Pauses workflow for human approval before execution
"""

import logging
from typing import Dict, Any, Literal
from langgraph.graph import StateGraph, END
from langgraph.types import interrupt
from langgraph.checkpoint.memory import MemorySaver
from state import AgentState
from agents import get_supervisor, get_resolution_agent, get_execution_agent

logger = logging.getLogger(__name__)


# =============================================================================
# HUMAN REVIEW NODE
# =============================================================================


def human_review_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Human-in-the-loop review node.

    Pauses workflow execution and presents the proposed change to a human
    reviewer for approval, rejection, or modification before applying.

    Args:
        state: Current AgentState with solution from resolution agent

    Returns:
        Updated state with human review decision, or result if rejected
    """
    solution = state.get("solution", {})
    field_name = solution.get("field_name", state.get("field_name", "unknown"))
    proposed_value = solution.get("proposed_value", "")
    confidence = solution.get("confidence", 0)
    problem = state.get("problem", "")
    original_value = state.get("original_value", "")

    logger.info(f"Human review requested for {field_name}: {original_value} → {proposed_value}")

    # Interrupt execution and wait for human input
    # This returns control to the caller with review data
    review_decision = interrupt({
        "type": "review_required",
        "problem": problem,  # Rich problem description for autonomous display
        "field": field_name,
        "original_value": original_value,
        "proposed_value": proposed_value,
        "confidence": confidence,
        "reasoning": solution.get("reasoning", "")[:500],
        "tool_results": solution.get("tool_results", [])
    })

    # When resumed, review_decision contains human's response
    # Expected format: {"approved": True/False, "modified_value": "..." (optional)}

    logger.info(f"Human review decision received: {review_decision}")

    if not review_decision.get("approved", False):
        logger.info(f"Human rejected change to {field_name}")
        return {
            "result": {
                "field_name": field_name,
                "success": False,
                "old_value": original_value,
                "new_value": "",
                "reasoning": "Rejected by human reviewer"
            },
            "human_review": review_decision,
            "review_requested": True
        }

    # If human provided a modified value, update the solution
    if review_decision.get("modified_value"):
        modified_value = review_decision["modified_value"]
        logger.info(f"Human modified value from '{proposed_value}' to '{modified_value}'")

        # Update solution with human-modified value
        updated_solution = {**solution, "proposed_value": modified_value}
        return {
            "solution": updated_solution,
            "human_review": review_decision,
            "review_requested": True
        }

    # Approved without modification
    logger.info(f"Human approved change to {field_name}")
    return {
        "human_review": review_decision,
        "review_requested": True
    }


def route_after_human_review(state: AgentState) -> Literal["execution", "__end__"]:
    """
    Route after human review based on approval decision.

    Args:
        state: Current AgentState with human_review decision

    Returns:
        "execution" if approved, "__end__" if rejected
    """
    human_review = state.get("human_review", {})
    result = state.get("result", {})

    # If result already set with success=False, human rejected
    if result and result.get("success") == False:
        logger.info("Human rejected - ending workflow")
        return "__end__"

    # If approved, proceed to execution
    if human_review.get("approved", False):
        logger.info("Human approved - proceeding to execution")
        return "execution"

    # Default: end if unclear
    logger.warning("Unclear human review decision, ending workflow")
    return "__end__"


# =============================================================================
# ROUTING FUNCTIONS
# =============================================================================


def route_after_supervisor(state: AgentState) -> Literal["resolution", "execution"]:
    """
    Route to the appropriate agent based on supervisor's decision.

    Args:
        state: Current AgentState with next_agent field from supervisor

    Returns:
        "resolution" or "execution" indicating which agent to route to
    """
    next_agent = state.get("next_agent", "resolution")

    logger.info(f"Routing from supervisor to: {next_agent}")

    # Default to resolution if unclear
    if next_agent not in ["resolution", "execution"]:
        logger.warning(f"Unknown next_agent '{next_agent}', defaulting to resolution")
        return "resolution"

    return next_agent


def route_after_resolution(state: AgentState) -> Literal["execution", END]:
    """
    Route after Resolution Agent completes.

    For minimal workflow: Resolution → Execution → END

    Args:
        state: Current AgentState with solution from resolution agent

    Returns:
        "execution" to apply the solution
    """
    solution = state.get("solution", {})

    # Check if we have a valid solution
    if solution.get("reasoning"):
        logger.info("Resolution complete, routing to execution")
        return "execution"
    else:
        logger.warning("No solution from resolution, ending workflow")
        return END


# =============================================================================
# WORKFLOW CREATION
# =============================================================================


def create_workflow(checkpointer=None) -> StateGraph:
    """
    Create the payment agent workflow using LangGraph StateGraph.

    Workflow Flow:
    1. START → supervisor
    2. supervisor → resolution OR execution (conditional)
    3. resolution → human_review (interrupt for approval)
    4. human_review → execution (if approved) OR END (if rejected)
    5. execution → END

    Args:
        checkpointer: Optional checkpointer for persistence. If None, uses MemorySaver.
                      Required for interrupt() to work properly.

    Returns:
        Compiled StateGraph ready to invoke
    """

    logger.info("Creating payment agent workflow with human-in-the-loop")

    # Create the state graph
    workflow = StateGraph(AgentState)

    # Add nodes for each agent
    workflow.add_node("supervisor", get_supervisor())
    workflow.add_node("resolution", get_resolution_agent())
    workflow.add_node("human_review", human_review_node)  # NEW: Human review before execution
    workflow.add_node("execution", get_execution_agent())

    # Set entry point
    workflow.set_entry_point("supervisor")

    # Add conditional edge from supervisor based on routing decision
    workflow.add_conditional_edges(
        "supervisor",
        route_after_supervisor,
        {
            "resolution": "resolution",
            "execution": "execution"
        }
    )

    # Resolution → Human Review (always require approval before execution)
    workflow.add_edge("resolution", "human_review")

    # Human Review → Execution (if approved) or END (if rejected)
    workflow.add_conditional_edges(
        "human_review",
        route_after_human_review,
        {
            "execution": "execution",
            "__end__": END
        }
    )

    # Add edge from execution to end
    workflow.add_edge("execution", END)

    # Use provided checkpointer or create default MemorySaver
    # Checkpointer is REQUIRED for interrupt() to persist state
    if checkpointer is None:
        checkpointer = MemorySaver()
        logger.info("Using default MemorySaver checkpointer")

    # Compile the workflow with checkpointer
    compiled_workflow = workflow.compile(checkpointer=checkpointer)

    logger.info("Payment agent workflow created successfully with human-in-the-loop")

    return compiled_workflow


# =============================================================================
# WORKFLOW SINGLETON
# =============================================================================


_workflow = None


def get_workflow() -> StateGraph:
    """
    Get or create the payment agent workflow singleton.

    Returns:
        Compiled StateGraph workflow
    """
    global _workflow

    if _workflow is None:
        _workflow = create_workflow()

    return _workflow
