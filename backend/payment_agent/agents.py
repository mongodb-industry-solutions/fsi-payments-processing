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
import re
from typing import Dict, Any
from langchain_aws import ChatBedrock
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from config.settings import settings

logger = logging.getLogger(__name__)


# =============================================================================
# SHARED UTILITIES
# =============================================================================


def clean_markdown(text: str) -> str:
    """
    Strip markdown formatting from LLM responses for clean frontend display.

    Removes bold/italic markers, headings, separator lines, internal parsing
    markers (FINAL_VALUE, CONFIDENCE, SOURCE), and converts markdown tables
    to a simple list format.
    """
    # Remove ** markdown bold markers
    text = re.sub(r'\*\*', '', text)
    # Remove * markdown italic markers (but preserve bullet points)
    text = re.sub(r'(?<!\n)\*(?!\s)', '', text)
    # Remove ## markdown heading markers
    text = re.sub(r'^#{1,6}\s*', '', text, flags=re.MULTILINE)
    # Remove internal parsing markers
    text = re.sub(r'^FINAL_VALUE:.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^CONFIDENCE:.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^SOURCE:.*$', '', text, flags=re.MULTILINE)
    # Remove separator lines (---)
    text = re.sub(r'^-{2,}$', '', text, flags=re.MULTILINE)
    # Remove table header separator lines (|---|---|)
    text = re.sub(r'^\|[-:\s|]+\|$', '', text, flags=re.MULTILINE)

    # Convert table rows "| Key | Value |" to "- Key: Value"
    def convert_table_row(match):
        cells = [c.strip() for c in match.group(0).split('|') if c.strip()]
        if len(cells) == 2:
            return f"- {cells[0]}: {cells[1]}"
        elif len(cells) > 0:
            return f"- {' | '.join(cells)}"
        return ''

    text = re.sub(r'^\|[^|]+\|[^|]*\|$', convert_table_row, text, flags=re.MULTILINE)
    # Clean up excessive blank lines
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    return text


# =============================================================================
# LLM INITIALIZATION
# =============================================================================


def create_llm(temperature: float = None, model_id: str = None) -> ChatBedrock:
    """
    Create a ChatBedrock LLM instance for agents.

    Args:
        temperature: Temperature for LLM (0.0-1.0). Uses settings default if not provided.
        model_id: Bedrock model ID. Uses settings.agent_model_id if not provided.

    Returns:
        ChatBedrock instance configured for the agent
    """
    resolved_model_id = model_id or settings.agent_model_id

    # When using inference profile ARN, must specify provider
    kwargs = {
        "model_id": resolved_model_id,
        "region_name": settings.aws_region,
        "model_kwargs": {
            "temperature": temperature if temperature is not None else settings.agent_temperature,
            "max_tokens": 4096
        }
    }

    # Add provider for ARN-based model IDs (inference profiles)
    if resolved_model_id.startswith("arn:"):
        kwargs["provider"] = "anthropic"

    return ChatBedrock(**kwargs)


# =============================================================================
# SUPERVISOR AGENT
# =============================================================================


def create_supervisor_agent():
    """
    Create the Supervisor Agent.

    The Supervisor Agent is responsible for:
    1. Analyzing the incoming payment PROBLEM (not predefined task types)
    2. Understanding the payment context and what needs to be resolved
    3. Deciding which specialized agent should handle the problem
    4. Routing to either Resolution Agent or Execution Agent

    The supervisor uses LLM reasoning to make routing decisions based on:
    - problem: Rich description of the issue for autonomous analysis
    - payment_data: Current payment information
    - field_name: Which field needs attention
    - conversion_context: Metadata about the payment conversion

    Routing Logic (via LLM reasoning):
    - Resolution Agent: For problems that require FINDING/DETERMINING a value
    - Execution Agent: For problems that require APPLYING a known value

    The supervisor does NOT have tools - it only routes based on reasoning.
    """

    # System prompt for autonomous problem analysis
    system_prompt = """You are a Supervisor Agent for a payment processing system.

Your role is to analyze payment PROBLEMS and route them to the appropriate specialized agent.

AVAILABLE AGENTS:

1. Resolution Agent - Route here when the problem requires FINDING or DETERMINING a value
   The Resolution Agent has these tools available:
   - atlas_search: Search MongoDB for exact or fuzzy matches (companies, IFSC codes, entities)
   - vector_search: Semantic search for classifying text into categories (e.g., purpose codes)
   - transliterate_text: AI-powered text transliteration to Japanese

2. Execution Agent - Route here when a value is ALREADY KNOWN and just needs to be applied
   The Execution Agent has these tools:
   - update_payment_field: Update a field in the payment record

DECISION PROCESS:
1. Read the PROBLEM description carefully
2. Understand what type of resolution is needed
3. Ask yourself: "Do we need to FIND something, or APPLY something?"
   - If we need to FIND/LOOKUP/DETERMINE/TRANSLATE/VERIFY → RESOLUTION
   - If we already have the value and just need to UPDATE → EXECUTION
4. Make your decision based on the problem nature, NOT keywords

EXAMPLES OF REASONING:
- "Name contains Western characters, needs Japanese script" → Need to FIND the Japanese version → RESOLUTION
- "IFSC code is missing for Indian bank" → Need to LOOK UP the code → RESOLUTION
- "Trading name needs verification against legal registry" → Need to VERIFY/FIND legal name → RESOLUTION
- "Apply the corrected value X to field Y" → Value is known, just UPDATE → EXECUTION

When you've made your decision, respond with:
DECISION: ROUTE_TO_[RESOLUTION|EXECUTION]
REASONING: [Brief explanation of why this routing makes sense for the problem]
"""

    # Create LLM for supervisor
    llm = create_llm(temperature=0.1)

    def supervisor_node(state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Supervisor node that analyzes the problem and decides routing.

        Args:
            state: Current AgentState with problem, payment_data, etc.

        Returns:
            Updated state with routing decision
        """
        # Extract problem (new) or fall back to task_type (legacy)
        problem = state.get("problem", "")
        task_type = state.get("task_type", "")  # Legacy support
        field_name = state.get("field_name", "unknown")
        original_value = state.get("original_value", "")
        payment_data = state.get("payment_data", {})
        conversion_context = state.get("conversion_context", {})

        logger.info(f"Supervisor analyzing problem for field: {field_name}")

        # Build context message for the LLM
        context_message = f"""
PROBLEM TO ANALYZE:
{problem if problem else f"Task type: {task_type}"}

FIELD INFORMATION:
- Field Name: {field_name}
- Current Value: {original_value}

PAYMENT CONTEXT:
- Debtor: {payment_data.get('debtorName', 'N/A')}
- Creditor: {payment_data.get('creditorName', 'N/A')}
- Amount: {payment_data.get('amount', 'N/A')} {payment_data.get('currency', '')}
- Source Format: {conversion_context.get('source_format', 'N/A')}
- Target Format: {conversion_context.get('target_format', 'N/A')}

Analyze this problem and decide which agent should handle it.
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
                # Default to resolution for problems that need investigation
                logger.warning(f"Unclear decision, defaulting to resolution: {decision_text}")
                next_agent = "resolution"

            # Return state update with routing decision
            return {
                "messages": [
                    HumanMessage(
                        content=f"Supervisor analyzed problem and routed to {next_agent} agent. Reasoning: {decision_text}"
                    )
                ],
                "next_agent": next_agent
            }

        except Exception as e:
            logger.error(f"Error in supervisor routing: {e}")
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
    1. Analyzing payment PROBLEMS autonomously
    2. Deciding which tools might help solve the problem
    3. Using tools to DETERMINE the correct value for a field
    4. Returning a proposed solution with confidence

    The agent reasons about the problem and discovers appropriate tools
    rather than following predefined task_type mappings.

    Returns:
        ReAct agent that can resolve payment issues autonomously
    """
    from tools import transliterate_text, atlas_search, vector_search

    # System prompt for autonomous problem solving
    system_prompt = """You are a Resolution Agent for a payment processing system.

Your role is to analyze payment PROBLEMS and DETERMINE correct values using your tools.

AVAILABLE TOOLS:

1. atlas_search(collection: str, query: str, search_fields: list, fuzzy: bool = True)
   - KEYWORD-BASED database lookup
   - Collections: "bankDetails" (has name_english, name_katakana), "ifscCodes", "registeredEntities"
   - fuzzy=False: exact match (confidence: 1.0)
   - fuzzy=True: typo-tolerant (confidence: 0.7-0.95)
   - Returns: found (bool), top_result (dict), confidence

2. vector_search(collection: str, query: str, index_name: str = None)
   - SEMANTIC database lookup - matches by meaning, not exact keywords
   - Use for conceptual matching (e.g., "paying wages" → "Salary Payment")
   - Returns: found (bool), top_result, similarity_score, confidence

3. transliterate_text(text: str, target_script: str)
   - AI GENERATION - creates new text via LLM (slower, use as last resort)
   - target_script: "katakana" or "hiragana"
   - Returns: transliterated text

UNIVERSAL PRINCIPLE - DATABASE FIRST, AI GENERATION LAST:
Both atlas_search and vector_search query EXISTING data in the database.
Only transliterate_text GENERATES new data via AI - use it only when database has no match.

YOUR PROCESS:
1. UNDERSTAND the problem - what value do I need?
2. SEARCH DATABASE FIRST:
   - Use atlas_search or vector_search (whichever fits the query type)
   - If found=True → USE that result, you're DONE
   - If found=False → proceed to step 3
3. ONLY IF DATABASE RETURNS found=False:
   - Use transliterate_text to generate via AI
4. STOP after finding a valid result - don't call additional tools unnecessarily

CRITICAL RULES:
- Call ONE tool, wait for result, then decide next action
- If database search returns found=True, DO NOT call transliterate_text
- Explain your reasoning before each tool call

After finding your answer, respond with:

FINAL_VALUE: <the exact value to use>
CONFIDENCE: <0.0 to 1.0>
SOURCE: <which tool provided this value>
"""

    # Create LLM for Resolution Agent
    llm = create_llm(temperature=0.1)

    # Create tools list
    tools = [atlas_search, vector_search, transliterate_text]

    # Create the ReAct agent with tools
    agent = create_react_agent(
        model=llm,
        tools=tools,
        prompt=system_prompt
    )

    def resolution_node(state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Resolution Agent node that determines correct values using tools.

        Args:
            state: Current AgentState with problem, payment_data, field_name

        Returns:
            Updated state with solution
        """
        # Extract problem (new) or fall back to task_type (legacy)
        problem = state.get("problem", "")
        task_type = state.get("task_type", "")  # Legacy support
        field_name = state.get("field_name", "unknown")
        payment_data = state.get("payment_data", {})
        original_value = state.get("original_value", "")

        logger.info(f"Resolution Agent analyzing problem for field: {field_name}")

        # Build context message for the agent
        context_message = f"""
PROBLEM TO SOLVE:
{problem if problem else f"Task: {task_type}"}

FIELD TO RESOLVE: {field_name}
CURRENT VALUE: {original_value}

PAYMENT CONTEXT:
- Transaction Reference: {payment_data.get('transactionRef', 'N/A')}
- Debtor: {payment_data.get('debtorName', 'N/A')}
- Creditor: {payment_data.get('creditorName', 'N/A')}
- Amount: {payment_data.get('amount', 'N/A')} {payment_data.get('currency', '')}
- Creditor Bank: {payment_data.get('creditorBank', 'N/A')}

Analyze this problem and use your tools to find the correct value for '{field_name}'.
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

            # Parse agent's final decision from its response
            # The agent autonomously decides which tool result to use
            proposed_value = ""
            confidence = 0.5
            source = "unknown"

            if final_message and final_message.content:
                response_text = final_message.content

                # Parse FINAL_VALUE from agent's response (handle markdown formatting like **FINAL_VALUE:**)
                value_match = re.search(r'\*{0,2}FINAL_VALUE:?\*{0,2}:?\s*\*{0,2}(.+?)\*{0,2}(?:\n|$)', response_text)
                conf_match = re.search(r'\*{0,2}CONFIDENCE:?\*{0,2}:?\s*\*{0,2}([\d.]+)', response_text)
                source_match = re.search(r'\*{0,2}SOURCE:?\*{0,2}:?\s*\*{0,2}(\w+)', response_text)

                if value_match:
                    # Strip markdown formatting (**, *, etc.) from the value
                    proposed_value = re.sub(r'\*+', '', value_match.group(1)).strip()
                    logger.info(f"Agent chose value: {proposed_value}")

                if conf_match:
                    try:
                        confidence = float(conf_match.group(1))
                    except ValueError:
                        confidence = 0.5

                if source_match:
                    source = source_match.group(1)
                    logger.info(f"Agent source: {source}, confidence: {confidence}")

            # Fallback: extract from tool results if FINAL_VALUE not parsed
            if not proposed_value and tool_result_values:
                logger.info(f"FINAL_VALUE not in response, extracting from tool results: {list(tool_result_values.keys())}")

                # Check atlas_search first (database result has priority)
                if "atlas_search" in tool_result_values:
                    result = tool_result_values["atlas_search"]
                    if result.get("found") and result.get("top_result"):
                        top = result["top_result"]
                        # Try common fields for the value
                        proposed_value = (
                            top.get("name_katakana") or
                            top.get("ifsc") or
                            top.get("legal_name") or
                            top.get("name_english") or
                            ""
                        )
                        if proposed_value:
                            confidence = result.get("confidence", 0.9)
                            source = "atlas_search"
                            logger.info(f"Extracted from atlas_search: '{proposed_value}'")

                # Then check transliterate_text (AI fallback)
                if not proposed_value and "transliterate_text" in tool_result_values:
                    result = tool_result_values["transliterate_text"]
                    proposed_value = result.get("transliterated", "")
                    if proposed_value:
                        confidence = result.get("confidence", 0.9)
                        source = "transliterate_text"
                        logger.info(f"Extracted from transliterate_text: '{proposed_value}'")

                # Check vector_search
                if not proposed_value and "vector_search" in tool_result_values:
                    result = tool_result_values["vector_search"]
                    if result.get("found") and result.get("top_result"):
                        top = result["top_result"]
                        proposed_value = top.get("code") or top.get("name") or ""
                        if proposed_value:
                            confidence = result.get("confidence", 0.8)
                            source = "vector_search"
                            logger.info(f"Extracted from vector_search: '{proposed_value}'")

            if not proposed_value:
                logger.warning(f"No proposed_value found in response or tool results")

            reasoning_text = clean_markdown(
                final_message.content if final_message else "No response from agent"
            )

            # Build solution from agent's autonomous decision
            solution = {
                "field_name": field_name,
                "proposed_value": proposed_value,
                "source": source,  # Which tool the agent chose
                "reasoning": reasoning_text,
                "confidence": confidence,
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

    # Create LLM for Execution Agent (deterministic)
    llm = create_llm(temperature=settings.execution_temperature)

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
        payment_id = conversion_context.get("conversion_run_id") or conversion_context.get("conversion_id", payment_data.get("transactionRef", "unknown"))

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

            reasoning_text = clean_markdown(
                final_message.content if final_message else "No response from agent"
            )

            # Parse the agent's response to extract execution result
            result = {
                "field_name": field_name,
                "payment_id": payment_id,
                "success": False,  # Will be updated based on tool results
                "old_value": "",
                "new_value": "",
                "timestamp": "",
                "reasoning": reasoning_text
            }

            # Extract tool results to check if update succeeded
            for msg in messages:
                if hasattr(msg, 'tool_calls') and msg.tool_calls:
                    # Agent called update_payment_field
                    result["success"] = True  # Assume success if tool was called

            # Look for ToolMessage responses which contain actual tool results
            for msg in messages:
                if msg.__class__.__name__ == "ToolMessage":
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
