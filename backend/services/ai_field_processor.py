"""
Simplified Generic AI Field Processor for Payment Format Conversion

This module provides AI-powered field processing for any payment format conversion.
It integrates with MongoDB for configuration and uses AWS Bedrock for LLM calls.
"""

import json
import re
from typing import Dict, Tuple, Any, Optional, List
from datetime import datetime, UTC, timedelta
import time
import threading
import logging

from db.mdb import MongoDBConnector
from services.simple_bedrock_service import SimpleBedrock, get_bedrock_service

# Configure logging
logger = logging.getLogger(__name__)


class AIFieldProcessor:
    """
    Simplified generic AI field processor for any format conversion.
    
    Works with existing MongoDB structure - no complex pattern detection.
    Supports any source/target format pair through configuration.
    
    Example:
        processor = AIFieldProcessor(db, "MT103", "pacs.008")
        result, confidence, metadata = processor.process_field("70", field_content)
    """
    
    def __init__(self, db_connector: MongoDBConnector, source_format: str, target_format: str):
        """
        Initialize AI processor for a specific format conversion pair.
        
        Args:
            db_connector: MongoDB connection instance
            source_format: Source format (e.g., "MT103", "ISO8583", "ACH")
            target_format: Target format (e.g., "pacs.008", "pacs.009")
        """
        self.db = db_connector
        self.source_format = source_format
        self.target_format = target_format
        
        # Load configurations from MongoDB
        self.field_routing = self._load_field_routing()
        self.prompt_templates = self._load_prompt_templates()
        
        # Track processing history for this session
        self.processing_history = []
        
        # Initialize single Bedrock service (shared, thread-safe)
        self.bedrock = get_bedrock_service()
        
        # Circuit breaker state
        self._circuit_breaker = {
            "failure_count": 0,
            "last_failure_time": None,
            "is_open": False,
            "threshold": 3,  # Open circuit after 3 consecutive failures
            "reset_timeout": 60  # Try again after 60 seconds
        }
    
    def _load_field_routing(self) -> Dict:
        """Load field-to-model routing from MongoDB for the source format."""
        routing_docs = self.db.find("field_model_routing", {
            "source_format": self.source_format
        })
        
        if routing_docs:
            return routing_docs[0]
        
        # Return empty routing if not found
        return {"source_format": self.source_format, "field_strategies": []}
    
    def _load_prompt_templates(self) -> Dict[str, Dict]:
        """Load prompt templates for this specific format pair."""
        templates = self.db.find("prompt_templates", {
            "source_format": self.source_format,
            "target_format": self.target_format
        })
        
        # Index by field for quick lookup
        template_dict = {}
        for template in templates:
            field = template.get("field")
            if field:
                template_dict[field] = template
        
        return template_dict
    
    def get_field_strategy(self, field_id: str) -> Optional[Dict]:
        """
        Get processing strategy for a specific field.
        
        Args:
            field_id: Field identifier (e.g., "70", "50K", "59")
            
        Returns:
            Strategy dictionary or None if not found
        """
        for strategy in self.field_routing.get("field_strategies", []):
            if strategy.get("field") == field_id:
                return strategy
        return None
    
    def should_use_ai(self, field_id: str) -> bool:
        """
        Check if field should be processed with AI based on model assignment.
        
        Args:
            field_id: Field identifier
            
        Returns:
            True if AI processing needed, False otherwise
        """
        strategy = self.get_field_strategy(field_id)
        
        if not strategy:
            return False
        
        model = strategy.get("model", "")
        
        # Use AI if model is specified and not REGEX_FIRST
        return model and model != "REGEX_FIRST"
    
    def pre_initialize_clients(self):
        """Pre-initialize Bedrock service (now just ensures it's ready)."""
        # The SimpleBedrock service handles its own initialization
        # This method is kept for compatibility with the orchestrator
        try:
            # Do a quick health check to ensure Bedrock is accessible
            logger.debug("   Checking Bedrock service...")
            # The bedrock service is already initialized in __init__
            # Just verify it's working
            if hasattr(self.bedrock, '_clients') and self.bedrock._clients:
                logger.debug("   ✓ Bedrock service ready")
            else:
                # Force client creation
                self.bedrock._ensure_client()
                logger.debug("   ✓ Bedrock client initialized")
        except Exception as e:
            logger.debug(f"   ⚠️ Bedrock initialization warning: {str(e)[:100]}")
    
    
    def _check_circuit_breaker(self) -> bool:
        """Check if circuit breaker is open (should block requests)."""
        cb = self._circuit_breaker
        
        if not cb["is_open"]:
            return False  # Circuit is closed, allow requests
        
        # Check if enough time has passed to try again
        if cb["last_failure_time"]:
            elapsed = (datetime.now(UTC) - cb["last_failure_time"]).total_seconds()
            if elapsed > cb["reset_timeout"]:
                # Try to reset circuit
                cb["is_open"] = False
                cb["failure_count"] = 0
                logger.debug(f"   Circuit breaker reset after {elapsed:.1f}s")
                return False
        
        return True  # Circuit is still open, block requests
    
    def _record_success(self):
        """Record successful AI call."""
        self._circuit_breaker["failure_count"] = 0
        self._circuit_breaker["is_open"] = False
    
    def _record_failure(self):
        """Record failed AI call and potentially open circuit."""
        cb = self._circuit_breaker
        cb["failure_count"] += 1
        cb["last_failure_time"] = datetime.now(UTC)
        
        if cb["failure_count"] >= cb["threshold"]:
            cb["is_open"] = True
            logger.debug(f"   ⚠️ Circuit breaker opened after {cb['failure_count']} failures")
    
    def process_field(self, field_id: str, field_content: str) -> Tuple[Any, float, Dict]:
        """
        Process a field using AI - works for any format.
        
        Args:
            field_id: Field identifier (e.g., "70", "50K")
            field_content: Raw field content to process
            
        Returns:
            Tuple of (processed_data, confidence_score, metadata)
        """
        # Get field strategy
        strategy = self.get_field_strategy(field_id)
        
        # If no AI needed, return original content
        if not strategy or not self.should_use_ai(field_id):
            return field_content, 1.0, {
                "lane": "RULES",
                "field": field_id,
                "processed": False
            }
        
        # Build prompt
        template = self.prompt_templates.get(field_id)
        if template:
            prompt = self._build_prompt(template, field_content)
        else:
            # Create default prompt if template missing
            prompt = self._build_default_prompt(field_id, field_content, strategy)
        
        # Check circuit breaker before attempting AI call
        if self._check_circuit_breaker():
            logger.debug(f"   ⚠️ Circuit breaker is open, skipping AI for field {field_id}")
            return field_content, 0.0, {
                "lane": "AI",
                "field": field_id,
                "processed": False,
                "error": "Circuit breaker open - too many AI failures",
                "success": False
            }
        
        # Get model name from strategy
        model_name = strategy.get("model", "CLAUDE_HAIKU")
        
        # Call LLM and process response
        try:
            logger.debug(f"   Calling Bedrock ({model_name}) with prompt length: {len(prompt)} chars")
            
            # Add timeout protection
            start_time = time.time()
            
            # Use the appropriate model method
            if model_name == "CLAUDE_SONNET":
                response = self.bedrock.invoke_sonnet(prompt)
            else:
                # Default to Haiku for cost optimization
                response = self.bedrock.invoke_haiku(prompt)
            
            elapsed = time.time() - start_time
            
            if elapsed > 20:  # Warn if call took too long
                logger.debug(f"   ⚠️ Slow AI response: {elapsed:.1f}s")
            else:
                logger.debug(f"   ✓ Received response from Bedrock in {elapsed:.1f}s")
            
            processed_data = self._parse_response(response, strategy)
            confidence = 0.85  # Default confidence for successful processing
            success = True
            error_msg = None
            
            # Record success for circuit breaker
            self._record_success()
            
        except Exception as e:
            # On error, fallback to original content
            processed_data = field_content
            confidence = 0.0
            success = False
            error_msg = str(e)
            
            # Record failure for circuit breaker
            self._record_failure()
            
            # Log error to MongoDB
            self._log_error(field_id, error_msg)
        
        # Track processing in MongoDB and session history
        processing_record = self._track_processing(
            field_id=field_id,
            model=model_name,
            confidence=confidence,
            success=success,
            error=error_msg,
            strategy=strategy.get("strategy", "UNKNOWN")
        )
        
        return processed_data, confidence, processing_record
    
    def _build_prompt(self, template: Dict, field_content: str) -> str:
        """Build prompt from template - works for any format."""
        prompt_structure = template.get("prompt_structure", {})
        
        parts = []
        
        # Add system message if present
        if "system" in prompt_structure:
            parts.append(prompt_structure["system"])
        
        # Add instruction
        if "instruction" in prompt_structure:
            parts.append(prompt_structure["instruction"])
        
        # Add examples if present
        if "examples" in prompt_structure:
            parts.append("Examples:")
            for example in prompt_structure["examples"]:
                parts.append(f"Input: {example.get('input', '')}")
                parts.append(f"Output: {example.get('output', '')}")
        
        # Add the actual field content
        parts.append(f"\nNow process this field content:\n{field_content}")
        
        # Add output format instruction
        if "output_format" in template:
            parts.append(f"\nReturn the result as {template['output_format']}.")
        
        return "\n\n".join(parts)
    
    def _build_default_prompt(self, field_id: str, field_content: str, strategy: Dict) -> str:
        """Build a default prompt when no template is available."""
        strategy_type = strategy.get("strategy", "EXTRACTION")
        
        if strategy_type == "ADDRESS_EXTRACTION":
            prompt = f"""Extract and structure the address information from this {self.source_format} field {field_id}.

Field content:
{field_content}

Return as JSON with the following structure:
{{
    "name": "entity name",
    "addressLines": ["line1", "line2"],
    "city": "city name",
    "country": "country name",
    "accountNumber": "account if present"
}}"""
        
        elif strategy_type == "REMITTANCE_INFO":
            prompt = f"""Extract payment details from this remittance information.

Field content:
{field_content}

Return as JSON with:
{{
    "invoiceNumber": "invoice number if present",
    "date": "date in YYYY-MM-DD format",
    "description": "payment description",
    "amount": "amount if mentioned",
    "reference": "any reference numbers"
}}"""
        
        else:
            # Generic extraction
            prompt = f"""Extract and structure the following {self.source_format} field {field_id} for use in {self.target_format} format.

Field content:
{field_content}

Return the structured data as JSON."""
        
        return prompt
    
    def _parse_response(self, response: str, strategy: Dict) -> Any:
        """Parse LLM response - try JSON first, fallback to structured text."""
        # First try to extract JSON from response
        try:
            # Look for JSON object in response
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
        except (json.JSONDecodeError, AttributeError):
            pass
        
        # If not JSON, try to structure based on strategy
        strategy_type = strategy.get("strategy", "")
        
        if strategy_type == "ADDRESS_EXTRACTION":
            # Try to parse address lines
            lines = response.strip().split('\n')
            return {
                "raw_text": response.strip(),
                "lines": [line.strip() for line in lines if line.strip()]
            }
        
        # Default: return cleaned text
        return response.strip()
    
    def _log_error(self, field_id: str, error_msg: str):
        """Log processing error to MongoDB."""
        error_record = {
            "source_format": self.source_format,
            "target_format": self.target_format,
            "field": field_id,
            "error": error_msg,
            "timestamp": datetime.now(UTC)
        }
        
        try:
            self.db.insert_one("ai_processing_errors", error_record)
        except:
            # Don't fail if logging fails
            pass
    
    def _track_processing(self, field_id: str, model: str, confidence: float, 
                         success: bool, error: Optional[str], strategy: str) -> Dict:
        """Track AI processing in MongoDB and return metadata."""
        processing_record = {
            "source_format": self.source_format,
            "target_format": self.target_format,
            "field": field_id,
            "model": model,
            "strategy": strategy,
            "confidence": confidence,
            "success": success,
            "error": error,
            "timestamp": datetime.now(UTC),
            "lane": "AI"
        }
        
        # Add to session history
        self.processing_history.append(processing_record)
        
        # Store in MongoDB
        try:
            self.db.insert_one("ai_processing_history", processing_record)
        except:
            # Don't fail if tracking fails
            pass
        
        return processing_record
    
    def get_processing_summary(self) -> Dict:
        """Get summary of all AI processing done in this session."""
        if not self.processing_history:
            return {
                "source_format": self.source_format,
                "target_format": self.target_format,
                "total_fields": 0,
                "ai_fields_processed": [],
                "success_rate": 0.0,
                "average_confidence": 0.0
            }
        
        successful = [h for h in self.processing_history if h["success"]]
        
        return {
            "source_format": self.source_format,
            "target_format": self.target_format,
            "total_fields": len(self.processing_history),
            "ai_fields_processed": [h["field"] for h in self.processing_history],
            "fields_by_model": self._group_by_model(),
            "success_rate": len(successful) / len(self.processing_history),
            "average_confidence": sum(h["confidence"] for h in successful) / len(successful) if successful else 0.0,
            "mongodb_collections_used": [
                "field_model_routing",
                "prompt_templates",
                "ai_processing_history",
                "ai_processing_errors"
            ]
        }
    
    def _group_by_model(self) -> Dict[str, List[str]]:
        """Group processed fields by model used."""
        by_model = {}
        for record in self.processing_history:
            model = record["model"]
            field = record["field"]
            if model not in by_model:
                by_model[model] = []
            by_model[model].append(field)
        return by_model