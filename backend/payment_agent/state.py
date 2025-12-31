"""
State definition for payment agent system.

This module defines AgentState, the shared state that flows through all agents
in the LangGraph workflow. The state uses TypedDict with Annotated fields to
enable proper message accumulation using operator.add.

Key Concepts:
- AgentState is a TypedDict containing all shared data
- messages field uses operator.add to accumulate conversation history
- payment_data contains the flat canonical JSON from payment_converter_v2
- Each agent reads from state, does work, and returns updated fields
"""

from typing import TypedDict, Annotated, List, Optional, Any, Dict
from langchain_core.messages import BaseMessage
import operator


class AgentState(TypedDict):
    """
    Shared state for payment agent system.

    This state flows through the entire LangGraph workflow, being passed from
    agent to agent. Each agent receives the current state, performs its work,
    and returns updated fields that are merged back into the state.

    State Fields:
    - messages: Conversation history between agents (accumulates via operator.add)
    - payment_data: Flat canonical JSON from payment_converter_v2 (~40 fields)
    - problem: Rich description of the issue for autonomous agent analysis
    - task_type: (Legacy) Type of task - prefer using problem instead
    - field_name: Name of the field to modify in payment_data
    - original_value: Original field value before modification (for audit)
    - conversion_context: Metadata from converter (source, target, etc.)
    - solution: Resolution agent's proposed solution
    - result: Execution agent's final result
    """

    # Message history - accumulates with operator.add
    # This ensures each agent's messages are appended, not overwritten
    messages: Annotated[List[BaseMessage], operator.add]

    # The canonical JSON payment from payment_converter_v2
    # This is a flat dictionary with ~40 fields like:
    # - transaction_ref, amount, currency, value_date (required)
    # - debtor_name, debtor_account, debtor_bank
    # - creditor_name, creditor_account, creditor_bank
    # - remittance_info, charge_bearer, etc.
    payment_data: Dict[str, Any]

    # Problem description for autonomous agent analysis
    # Rich text describing what needs to be resolved
    problem: Optional[str]

    # Task identification (legacy - prefer using problem for autonomous agents)
    task_type: str  # "japan_transliteration", "india_ifsc", etc.

    # Field to be modified
    field_name: str  # Direct field name (e.g., "creditor_name", "creditor_bank")

    # Original value before agent modification (for audit trail)
    original_value: Optional[str]

    # Context from payment_converter_v2 about the conversion
    conversion_context: Dict[str, Any]  # source_format, target_format, conversion_id, etc.

    # Supervisor routing decision
    next_agent: Optional[str]  # "resolution" or "execution"

    # Agent outputs
    solution: Dict[str, Any]  # Resolution agent's proposed fix
    result: Dict[str, Any]  # Execution agent's result

    # Human-in-the-loop review
    human_review: Optional[Dict[str, Any]]  # Human's review decision: {"approved": bool, "modified_value": str}
    review_requested: Optional[bool]  # Flag indicating review was requested


# Type hints for clarity
AgentStateUpdate = Dict[str, Any]  # Partial state updates returned by agents