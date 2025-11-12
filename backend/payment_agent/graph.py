"""
LangGraph workflow for payment agent system.

This module creates the multi-agent workflow using LangGraph's StateGraph.
The workflow orchestrates the Supervisor, Resolution, and Execution agents.

Workflow Structure:
1. START → Supervisor (analyzes task and routes)
2. Supervisor → Resolution Agent (if task needs research/determination)
   OR
   Supervisor → Execution Agent (if task is direct update)
3. Resolution → Execution (after determining solution)
4. Execution → END

Key Concepts:
- StateGraph: Defines nodes and edges
- Conditional edges: Routes based on state values
- AgentState: Shared state flows through all nodes
"""

import logging
from typing import Dict, Any, Literal
from langgraph.graph import StateGraph, END
from state import AgentState
from agents import get_supervisor, get_resolution_agent, get_execution_agent

logger = logging.getLogger(__name__)


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


def create_workflow() -> StateGraph:
    """
    Create the payment agent workflow using LangGraph StateGraph.

    Workflow Flow:
    1. START → supervisor
    2. supervisor → resolution OR execution (conditional)
    3. resolution → execution
    4. execution → END

    Returns:
        Compiled StateGraph ready to invoke
    """

    logger.info("Creating payment agent workflow")

    # Create the state graph
    workflow = StateGraph(AgentState)

    # Add nodes for each agent
    workflow.add_node("supervisor", get_supervisor())
    workflow.add_node("resolution", get_resolution_agent())
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

    # Add conditional edge from resolution to execution or end
    workflow.add_conditional_edges(
        "resolution",
        route_after_resolution,
        {
            "execution": "execution",
            END: END
        }
    )

    # Add edge from execution to end
    workflow.add_edge("execution", END)

    # Compile the workflow
    compiled_workflow = workflow.compile()

    logger.info("Payment agent workflow created successfully")

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
