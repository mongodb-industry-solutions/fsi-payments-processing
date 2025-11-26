"""
Agent implementations for payment agent system.

This module contains all agent definitions using LangGraph's create_react_agent.
Agents use LLM reasoning (ReAct pattern) to make decisions, NOT hardcoded if/else logic.

Architecture:
- Supervisor Agent: Routes tasks to specialized agents based on LLM reasoning
- Resolution Agent: Determines correct values for problematic fields (uses tools)
- Execution Agent: Applies changes to database (uses tools)

Key Concepts:
- create_react_agent: Prebuilt ReAct agent from LangGraph
- Each agent receives AgentState and returns state updates
- Supervisor makes routing decisions via LLM, not hardcoded logic
- Tools are automatically bound to agents
"""

import logging
import json
from typing import Dict, Any
from langchain_aws import ChatBedrock
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from config.settings import settings

logger = logging.getLogger(__name__)


# =============================================================================
# LLM INITIALIZATION
# =============================================================================


def create_llm(temperature: float = None, model_id: str = None) -> ChatBedrock:
    """
    Create a ChatBedrock LLM instance for agents.

    Args:
        temperature: Temperature for LLM (0.0-1.0). Uses settings default if not provided.
        model_id: Bedrock model ID. Uses Claude 3.5 Sonnet if not provided.

    Returns:
        ChatBedrock instance configured for the agent
    """
    return ChatBedrock(
        model_id=model_id or "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
        region_name=settings.aws_region,
        model_kwargs={
            "temperature": temperature if temperature is not None else settings.agent_temperature,
            "max_tokens": 4096
        }
    )


# =============================================================================
# SUPERVISOR AGENT
# =============================================================================


def create_supervisor_agent():
    """
    Create the Supervisor Agent.

    The Supervisor Agent is responsible for:
    1. Analyzing the incoming payment issue (task_type)
    2. Understanding the payment context and field that needs attention
    3. Deciding which specialized agent should handle the task
    4. Routing to either Resolution Agent or Execution Agent

    The supervisor uses LLM reasoning to make routing decisions based on:
    - task_type: What kind of problem needs solving
    - payment_data: Current payment information
    - field_name: Which field needs attention
    - conversion_context: Metadata about the payment conversion

    Routing Logic (via LLM reasoning):
    - Resolution Agent: For tasks that need to DETERMINE a correct value
      Examples: transliteration, IFSC lookup, data enrichment
    - Execution Agent: For tasks that need to APPLY a known value
      Examples: direct updates, applying pre-determined corrections

    The supervisor does NOT have tools - it only routes based on reasoning.
    """

    # System prompt that defines the supervisor's role and decision-making
    system_prompt = """You are a Supervisor Agent for a payment processing system.

Your role is to analyze payment issues and route them to the appropriate specialized agent.

AVAILABLE AGENTS:
1. Resolution Agent - Use when you need to DETERMINE the correct value for a field
   - Tasks: company name lookup, transliteration, IFSC code lookup, data enrichment
   - Has tools (in priority order):
     * lookup_company_katakana: Fast DB lookup for known company Katakana names
     * transliterate_text: AI-based transliteration (fallback if DB lookup fails)
     * lookup_ifsc: Look up IFSC codes for Indian banks
   - Use for: "japan_transliteration", "india_ifsc", similar research tasks

2. Execution Agent - Use when you need to APPLY a known value to the database
   - Tasks: updating fields, applying corrections
   - Has tools: update_payment_field
   - Use for: direct updates after Resolution Agent has determined the value

TASK TYPES YOU'LL SEE:
- "japan_transliteration": Need Japanese katakana for company/person names → Route to RESOLUTION
  (Resolution Agent will first try lookup_company_katakana, then fallback to transliterate_text)
- "india_ifsc": Need to look up IFSC code for Indian bank → Route to RESOLUTION
- "direct_update": Need to apply a known value → Route to EXECUTION

DECISION PROCESS:
1. Read the task_type, payment_data, and field_name from the state
2. Understand what needs to be done
3. Determine if we need to FIND a value (Resolution) or APPLY a value (Execution)
4. Make your decision and explain your reasoning

IMPORTANT:
- Use your reasoning ability - do NOT use hardcoded if/else logic
- Consider the context and nature of the task
- Explain your decision clearly
- Your response should indicate which agent to route to: "ROUTE_TO_RESOLUTION" or "ROUTE_TO_EXECUTION"

When you've made your decision, respond with:
DECISION: ROUTE_TO_[RESOLUTION|EXECUTION]
REASONING: [Your explanation of why you chose this agent]
"""

    # Create LLM for supervisor (using Sonnet for better reasoning)
    llm = create_llm(temperature=0.1)

    # Supervisor doesn't need tools - it just routes
    # Create a simple callable that uses the LLM to make routing decisions
    def supervisor_node(state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Supervisor node that analyzes the task and decides routing.

        Args:
            state: Current AgentState with payment_data, task_type, etc.

        Returns:
            Updated state with routing decision
        """
        logger.info(f"Supervisor analyzing task: {state.get('task_type')}")

        # Extract key information from state
        task_type = state.get("task_type", "unknown")
        field_name = state.get("field_name", "unknown")
        payment_data = state.get("payment_data", {})
        conversion_context = state.get("conversion_context", {})

        # Build context message for the LLM
        context_message = f"""
PAYMENT ISSUE TO ANALYZE:
- Task Type: {task_type}
- Field to Address: {field_name}
- Current Value: {payment_data.get(field_name, 'N/A')}
- Payment Reference: {payment_data.get('transaction_ref', 'N/A')}
- Source Format: {conversion_context.get('source_format', 'N/A')}
- Target Format: {conversion_context.get('target_format', 'N/A')}

PAYMENT DETAILS:
- Debtor: {payment_data.get('debtor_name', 'N/A')}
- Creditor: {payment_data.get('creditor_name', 'N/A')}
- Amount: {payment_data.get('amount', 'N/A')} {payment_data.get('currency', '')}

Based on this information, which agent should handle this task?
"""

        # Invoke LLM to make routing decision
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=context_message)
        ]

        try:
            response = llm.invoke(messages)
            decision_text = response.content

            logger.info(f"Supervisor decision: {decision_text}")

            # Parse the decision
            if "ROUTE_TO_RESOLUTION" in decision_text:
                next_agent = "resolution"
            elif "ROUTE_TO_EXECUTION" in decision_text:
                next_agent = "execution"
            else:
                # Default to resolution for research tasks
                logger.warning(f"Unclear decision, defaulting to resolution: {decision_text}")
                next_agent = "resolution"

            # Return state update with routing decision
            return {
                "messages": [
                    HumanMessage(
                        content=f"Supervisor routed task '{task_type}' to {next_agent} agent. Reasoning: {decision_text}"
                    )
                ],
                "next_agent": next_agent  # This will be used by the graph for routing
            }

        except Exception as e:
            logger.error(f"Error in supervisor routing: {e}")
            # Default to resolution on error
            return {
                "messages": [
                    HumanMessage(content=f"Supervisor error: {e}. Defaulting to resolution agent.")
                ],
                "next_agent": "resolution"
            }

    return supervisor_node


# =============================================================================
# RESOLUTION AGENT
# =============================================================================


def create_resolution_agent():
    """
    Create the Resolution Agent using create_react_agent.

    The Resolution Agent is responsible for:
    1. Analyzing payment issues that need research or data enrichment
    2. Using tools to DETERMINE the correct value for a field
    3. Returning a proposed solution with confidence

    Available Tools:
    - transliterate_text: Convert names to Japanese katakana
    - lookup_ifsc: Look up IFSC codes for Indian banks

    The agent uses the ReAct pattern:
    1. Reason about the problem
    2. Decide which tool(s) to use
    3. Act by calling tools
    4. Observe tool results
    5. Repeat until solution is found

    Returns:
        ReAct agent that can resolve payment issues
    """
    from tools import transliterate_text, lookup_company_katakana, lookup_ifsc

    # System prompt that defines the Resolution Agent's role
    system_prompt = """You are a Resolution Agent for a payment processing system.

Your role is to analyze payment issues and DETERMINE the correct values using your tools.

AVAILABLE TOOLS (use in this priority order):
1. lookup_company_katakana - Look up pre-translated Katakana names from database
   - ALWAYS TRY THIS FIRST for Japan-bound payments with company names
   - Fast, accurate, uses official registered names
   - If found=False, fallback to transliterate_text

2. transliterate_text - Convert Western text to Japanese katakana or hiragana using AI
   - Use as FALLBACK when lookup_company_katakana returns found=False
   - Use for person names or unknown companies
   - Katakana is standard for foreign names/companies

3. lookup_ifsc - Look up IFSC codes for Indian bank branches
   - Use for India-bound payments that need IFSC codes
   - IFSC codes are mandatory for NEFT, RTGS, IMPS transfers

YOUR PROCESS:
1. Understand the task from the payment context
2. Identify what value needs to be determined
3. Choose and use the appropriate tool(s)
4. Analyze the tool results
5. Provide a clear solution with confidence assessment

IMPORTANT GUIDELINES:
- Use your reasoning ability to understand the context
- Don't make assumptions - use tools to get accurate data
- If a tool returns an error or no result, explain what went wrong
- Provide confidence scores based on tool results
- Be thorough but efficient - don't call unnecessary tools

When you've determined the solution, summarize:
- What field needs to be updated
- What the new value should be
- Why this is the correct value
- Your confidence level (0-1)
"""

    # Create LLM for Resolution Agent
    llm = create_llm(temperature=0.1)

    # Create tools list (DB lookup first, then AI fallback, then IFSC)
    tools = [lookup_company_katakana, transliterate_text, lookup_ifsc]

    # Create the ReAct agent with tools
    agent = create_react_agent(
        model=llm,
        tools=tools,
        prompt=system_prompt
    )

    # Wrap the agent in a node function that handles state properly
    def resolution_node(state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Resolution Agent node that determines correct values using tools.

        Args:
            state: Current AgentState with payment_data, task_type, field_name

        Returns:
            Updated state with solution
        """
        logger.info(f"Resolution Agent processing task: {state.get('task_type')}")

        # Extract information from state
        task_type = state.get("task_type", "unknown")
        field_name = state.get("field_name", "unknown")
        payment_data = state.get("payment_data", {})
        original_value = state.get("original_value", "")

        # Build context message for the agent
        context_message = f"""
TASK: {task_type}
FIELD TO RESOLVE: {field_name}
CURRENT VALUE: {original_value or payment_data.get(field_name, 'N/A')}

PAYMENT CONTEXT:
- Transaction Reference: {payment_data.get('transaction_ref', 'N/A')}
- Debtor: {payment_data.get('debtor_name', 'N/A')}
- Creditor: {payment_data.get('creditor_name', 'N/A')}
- Amount: {payment_data.get('amount', 'N/A')} {payment_data.get('currency', '')}
- Creditor Bank: {payment_data.get('creditor_bank', 'N/A')}

Your task is to determine the correct value for the '{field_name}' field.
Use your tools to research and find the accurate information.
"""

        try:
            # Invoke the ReAct agent
            # create_react_agent expects messages in state
            agent_input = {
                "messages": [HumanMessage(content=context_message)]
            }

            agent_result = agent.invoke(agent_input)

            # Extract the final message from the agent
            messages = agent_result.get("messages", [])
            final_message = messages[-1] if messages else None

            logger.info(f"Resolution Agent completed: {final_message.content if final_message else 'No response'}")

            # Extract tool results from messages
            tool_results = []
            tool_result_values = {}

            for msg in messages:
                # Extract tool CALLS (existing logic)
                if hasattr(msg, 'tool_calls') and msg.tool_calls:
                    for tool_call in msg.tool_calls:
                        tool_results.append({
                            "tool": tool_call.get("name"),
                            "args": tool_call.get("args"),
                        })

                # NEW: Extract tool RESULTS from ToolMessage objects
                if isinstance(msg, ToolMessage):
                    try:
                        result_data = json.loads(msg.content)
                        tool_name = msg.name or "unknown"
                        tool_result_values[tool_name] = result_data
                        logger.info(f"Extracted tool result from {tool_name}: {result_data}")
                    except json.JSONDecodeError as e:
                        logger.warning(f"Failed to parse tool result: {e}")
                    except Exception as e:
                        logger.error(f"Error extracting tool result: {e}")

            # NEW: Populate proposed_value based on task_type
            proposed_value = ""

            if task_type == "japan_transliteration" and "transliterate_text" in tool_result_values:
                proposed_value = tool_result_values["transliterate_text"].get("transliterated", "")
                logger.info(f"Extracted Japanese transliteration: {proposed_value}")

            elif task_type == "india_ifsc" and "lookup_ifsc" in tool_result_values:
                proposed_value = tool_result_values["lookup_ifsc"].get("ifsc", "")
                logger.info(f"Extracted IFSC code: {proposed_value}")

            else:
                # Fallback: keep empty for backward compatibility
                logger.warning(f"Unknown task_type '{task_type}' or no tool results, proposed_value empty")

            # Parse the agent's response to extract solution
            solution = {
                "field_name": field_name,
                "proposed_value": proposed_value,  # NOW POPULATED from tool results
                "reasoning": final_message.content if final_message else "No response from agent",
                "confidence": 0.8,  # Default confidence
                "tool_results": tool_results
            }

            logger.info(f"Resolution complete - proposed_value: '{proposed_value}'")

            # Return state update
            return {
                "messages": messages,  # Include all agent messages
                "solution": solution
            }

        except Exception as e:
            logger.error(f"Error in Resolution Agent: {e}")
            return {
                "messages": [
                    HumanMessage(content=f"Resolution Agent error: {e}")
                ],
                "solution": {
                    "field_name": field_name,
                    "proposed_value": "",
                    "reasoning": f"Error: {e}",
                    "confidence": 0.0,
                    "tool_results": []
                }
            }

    return resolution_node


# =============================================================================
# EXECUTION AGENT
# =============================================================================


def create_execution_agent():
    """
    Create the Execution Agent using create_react_agent.

    The Execution Agent is responsible for:
    1. Taking solutions from Resolution Agent
    2. Applying changes to the payment database
    3. Validating that updates were successful
    4. Returning execution results

    Available Tools:
    - update_payment_field: Update a specific field in payment record

    The agent uses the ReAct pattern:
    1. Reason about what needs to be applied
    2. Decide on the update strategy
    3. Act by calling update tool
    4. Observe update results
    5. Confirm success or report issues

    Returns:
        ReAct agent that can execute payment updates
    """
    from tools import update_payment_field

    # System prompt that defines the Execution Agent's role
    system_prompt = """You are an Execution Agent for a payment processing system.

Your role is to APPLY solutions by updating payment records in the database.

AVAILABLE TOOLS:
1. update_payment_field - Update a specific field in a payment record
   - Requires: payment_id, field_name, new_value
   - Returns: update status, old value, new value, timestamp

YOUR PROCESS:
1. Understand what update needs to be applied from the context
2. Verify you have all required information (payment_id, field_name, new_value)
3. Use update_payment_field tool to apply the change
4. Verify the update was successful
5. Report the result clearly

IMPORTANT GUIDELINES:
- Always verify you have the correct payment_id before updating
- Use the exact field_name from canonical JSON vocabulary
- Check that update_payment_field returns updated=True
- If update fails, explain what went wrong clearly
- Provide audit trail information (old value, new value, timestamp)

When you've completed the update, summarize:
- What field was updated
- Old value vs new value
- Whether update succeeded
- Timestamp of the change
"""

    # Create LLM for Execution Agent
    llm = create_llm(temperature=0.0)  # Use 0.0 for deterministic updates

    # Create tools list
    tools = [update_payment_field]

    # Create the ReAct agent with tools
    agent = create_react_agent(
        model=llm,
        tools=tools,
        prompt=system_prompt
    )

    # Wrap the agent in a node function that handles state properly
    def execution_node(state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execution Agent node that applies updates to database.

        Args:
            state: Current AgentState with solution, payment_data, conversion_context

        Returns:
            Updated state with result
        """
        logger.info(f"Execution Agent applying solution")

        # Extract information from state
        solution = state.get("solution", {})
        payment_data = state.get("payment_data", {})
        conversion_context = state.get("conversion_context", {})
        field_name = state.get("field_name", "unknown")

        # Get payment ID from conversion context
        # Use conversion_run_id (UUID) if available (new behavior for independence)
        # Otherwise fall back to conversion_id (backward compatibility)
        payment_id = conversion_context.get("conversion_run_id") or conversion_context.get("conversion_id", payment_data.get("transaction_ref", "unknown"))

        # Get proposed value from solution
        proposed_value = solution.get("proposed_value", "")

        # If proposed_value is empty, try to extract from reasoning or tool results
        if not proposed_value and solution.get("tool_results"):
            # This is a fallback - in real implementation, Resolution Agent should provide proposed_value
            logger.warning("No proposed_value in solution, will rely on agent to extract from context")

        # Build context message for the agent
        context_message = f"""
EXECUTION TASK: Apply the determined solution to the payment record

PAYMENT INFORMATION:
- Payment ID: {payment_id}
- Field to Update: {field_name}
- Current Value: {payment_data.get(field_name, 'N/A')}

SOLUTION FROM RESOLUTION AGENT:
- Proposed New Value: {proposed_value or 'See reasoning below'}
- Confidence: {solution.get('confidence', 'N/A')}
- Reasoning: {solution.get('reasoning', 'N/A')[:200]}...

Your task is to apply this solution by updating the '{field_name}' field in payment '{payment_id}'.
Extract the new value from the solution and use update_payment_field to apply it.
"""

        try:
            # Invoke the ReAct agent
            agent_input = {
                "messages": [HumanMessage(content=context_message)]
            }

            agent_result = agent.invoke(agent_input)

            # Extract messages from agent
            messages = agent_result.get("messages", [])
            final_message = messages[-1] if messages else None

            logger.info(f"Execution Agent completed: {final_message.content if final_message else 'No response'}")

            # Parse the agent's response to extract execution result
            result = {
                "field_name": field_name,
                "payment_id": payment_id,
                "success": False,  # Will be updated based on tool results
                "old_value": "",
                "new_value": "",
                "timestamp": "",
                "reasoning": final_message.content if final_message else "No response from agent"
            }

            # Extract tool results to check if update succeeded
            for msg in messages:
                if hasattr(msg, 'tool_calls') and msg.tool_calls:
                    # Agent called update_payment_field
                    result["success"] = True  # Assume success if tool was called

            # Look for ToolMessage responses which contain actual tool results
            for msg in messages:
                if msg.__class__.__name__ == "ToolMessage":
                    # Parse the tool response
                    import json
                    try:
                        tool_response = json.loads(msg.content)
                        result["success"] = tool_response.get("updated", False)
                        result["old_value"] = tool_response.get("old_value", "")
                        result["new_value"] = tool_response.get("new_value", "")
                        result["timestamp"] = tool_response.get("timestamp", "")
                    except:
                        # If can't parse, just use the content as-is
                        result["success"] = "updated" in msg.content.lower() and "true" in msg.content.lower()

            # Return state update
            return {
                "messages": messages,  # Include all agent messages
                "result": result
            }

        except Exception as e:
            logger.error(f"Error in Execution Agent: {e}")
            return {
                "messages": [
                    HumanMessage(content=f"Execution Agent error: {e}")
                ],
                "result": {
                    "field_name": field_name,
                    "payment_id": payment_id,
                    "success": False,
                    "old_value": "",
                    "new_value": "",
                    "timestamp": "",
                    "reasoning": f"Error: {e}"
                }
            }

    return execution_node


# =============================================================================
# AGENT REGISTRY
# =============================================================================


def get_supervisor() -> Any:
    """
    Get the supervisor agent.

    Returns:
        Supervisor agent node function
    """
    return create_supervisor_agent()


def get_resolution_agent() -> Any:
    """
    Get the resolution agent.

    Returns:
        Resolution agent node function
    """
    return create_resolution_agent()


def get_execution_agent() -> Any:
    """
    Get the execution agent.

    Returns:
        Execution agent node function
    """
    return create_execution_agent()
