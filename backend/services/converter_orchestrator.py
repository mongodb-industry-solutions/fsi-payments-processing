"""
Simplified Converter Orchestrator for Payment Format Conversion

This module orchestrates the complete conversion process using:
- Parser: Extract fields from source format
- Rules Engine: Apply direct mapping rules
- AI Processor: Handle complex/unstructured fields
- Builder: Construct target format message

Designed for MongoDB technical demo showcasing innovative approaches.
"""

from typing import Dict, Any, Tuple, Optional, List
from datetime import datetime, UTC
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import logging

from db.mdb import MongoDBConnector
from core.rules_engine import RulesEngine
from services.ai_field_processor import AIFieldProcessor
from utils.parsers.base_parser import BaseParser
from utils.builders.base_builder import BaseBuilder

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class ConverterOrchestrator:
    """
    Orchestrates the complete payment conversion pipeline.
    
    Integrates parser, rules engine, AI processor, and builder into
    a cohesive 3-lane processing system (Rules → AI → Human).
    
    Example:
        orchestrator = ConverterOrchestrator(db, "MT103", "pacs.008")
        result = orchestrator.convert(raw_mt103_message)
    """
    
    def __init__(self, db_connector: MongoDBConnector, source_format: str, target_format: str):
        """
        Initialize orchestrator for a specific format conversion.
        
        Args:
            db_connector: MongoDB connection instance
            source_format: Source format code (e.g., "MT103")
            target_format: Target format code (e.g., "pacs.008")
        """
        self.db = db_connector
        self.source_format = source_format
        self.target_format = target_format
        
        # Initialize components
        self.rules_engine = RulesEngine(db_connector, source_format, target_format)
        self.ai_processor = AIFieldProcessor(db_connector, source_format, target_format)
        
        # Track conversion statistics
        self.conversion_id = None
        self.processing_stats = {
            "rules_lane": {"count": 0, "fields": []},
            "ai_lane": {"count": 0, "fields": []},
            "human_lane": {"count": 0, "fields": []},
            "total_fields": 0,
            "start_time": None,
            "end_time": None
        }
    
    def set_parser(self, parser: BaseParser):
        """Set the parser for source format."""
        self.parser = parser
    
    def set_builder(self, builder: BaseBuilder):
        """Set the builder for target format."""
        self.builder = builder
    
    def convert(self, raw_message: str, trace_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Convert a payment message from source to target format.
        
        This is the main entry point that orchestrates the entire conversion:
        1. Parse source message into fields
        2. Apply rules-based mappings
        3. Process complex fields with AI
        4. Build target format message
        5. Track everything in MongoDB
        
        Args:
            raw_message: Raw source format message
            trace_id: Optional trace ID for tracking
            
        Returns:
            Dictionary containing:
            - converted_message: Target format message
            - processing_metadata: Details about conversion
            - conversion_id: MongoDB document ID
            - statistics: Processing statistics
        """
        
        # Start tracking
        self.processing_stats["start_time"] = datetime.now(UTC)
        self.conversion_id = self._create_conversion_record(raw_message, trace_id)
        
        try:
            # Step 1: Parse source message
            logger.info(f"🚀 Starting conversion: {self.source_format} → {self.target_format}")
            logger.info(f"📋 Conversion ID: {self.conversion_id}")
            
            parsed_data = self.parser.parse_with_metadata(raw_message)
            parsed_fields = parsed_data.get("parsed_fields", {})
            self.processing_stats["total_fields"] = len(parsed_fields)
            
            logger.info(f"📝 Parsed {len(parsed_fields)} fields from {self.source_format}")
            
            # Step 2: Apply rules-based conversion
            logger.info("⚙️ Applying Rules Engine...")
            rules_output = self.rules_engine.apply_rules(parsed_fields)
            converted_fields = rules_output.get("mapped_fields", {})
            rules_applied = rules_output.get("processing_details", [])
            
            # Track rules lane fields
            for rule in rules_applied:
                self.processing_stats["rules_lane"]["count"] += 1
                self.processing_stats["rules_lane"]["fields"].append(rule.get("target_field"))
            
            logger.info(f"✅ Rules engine processed {self.processing_stats['rules_lane']['count']} fields")
            
            # Step 3: Process remaining fields with AI
            logger.info("🤖 Processing AI fields...")
            ai_enhanced_fields = self._process_with_ai(parsed_fields, converted_fields)
            
            # Merge AI results with rules results
            for field_id, field_data in ai_enhanced_fields.items():
                if field_id not in converted_fields:
                    converted_fields[field_id] = field_data
            
            logger.info(f"✅ AI processor handled {self.processing_stats['ai_lane']['count']} fields")
            
            # Step 4: Identify fields needing human review
            human_review_fields = self._identify_human_review(converted_fields, parsed_fields)
            self.processing_stats["human_lane"]["count"] = len(human_review_fields)
            self.processing_stats["human_lane"]["fields"] = human_review_fields
            
            if human_review_fields:
                logger.warning(f"⚠️ {len(human_review_fields)} fields flagged for human review: {', '.join(human_review_fields)}")
            
            # Step 5: Build target format message
            logger.info(f"🏗️ Building {self.target_format} message...")
            build_metadata = {
                "conversion_id": str(self.conversion_id),
                "source_format": self.source_format,
                "rules_applied": len(rules_applied),
                "ai_fields": self.processing_stats["ai_lane"]["count"],
                "human_review": self.processing_stats["human_lane"]["count"]
            }
            
            output_data = self.builder.build_with_metadata(converted_fields, build_metadata)
            target_message = output_data.get("message", "")
            
            logger.info(f"✅ Successfully built {self.target_format} message")
            
            # Step 6: Update conversion record with results
            self.processing_stats["end_time"] = datetime.now(UTC)
            processing_time = (self.processing_stats["end_time"] - self.processing_stats["start_time"]).total_seconds()
            
            self._update_conversion_record(
                converted_fields=converted_fields,
                target_message=target_message,
                processing_stats=self.processing_stats,
                success=True
            )
            
            logger.info(f"✅ Conversion complete! Time: {processing_time:.2f}s")
            logger.info(f"📊 Processing Distribution:")
            logger.info(f"  • Rules Lane: {self.processing_stats['rules_lane']['count']} fields")
            logger.info(f"  • AI Lane: {self.processing_stats['ai_lane']['count']} fields")
            logger.info(f"  • Human Lane: {self.processing_stats['human_lane']['count']} fields")
            
            return {
                "success": True,
                "conversion_id": str(self.conversion_id),
                "converted_message": target_message,
                "processing_metadata": {
                    "source_format": self.source_format,
                    "target_format": self.target_format,
                    "processing_time": processing_time,
                    "lanes_used": self._get_lanes_summary()
                },
                "statistics": self.processing_stats,
                "human_review_required": len(human_review_fields) > 0,
                "human_review_fields": human_review_fields
            }
            
        except Exception as e:
            # Log error and update record
            self.processing_stats["end_time"] = datetime.now(UTC)
            self._update_conversion_record(
                error=str(e),
                success=False
            )
            
            logger.error(f"❌ Conversion failed: {str(e)}")
            
            return {
                "success": False,
                "conversion_id": str(self.conversion_id),
                "error": str(e),
                "processing_metadata": {
                    "source_format": self.source_format,
                    "target_format": self.target_format
                },
                "statistics": self.processing_stats
            }
    
    def _process_with_ai(self, parsed_fields: Dict, converted_fields: Dict) -> Dict[str, Any]:
        """
        Process fields that need AI enhancement using parallel processing.
        Falls back to sequential processing if parallel fails.
        
        Args:
            parsed_fields: Original parsed fields
            converted_fields: Fields already converted by rules
            
        Returns:
            Dictionary of AI-processed fields
        """
        ai_fields = {}
        fields_to_process = []
        
        # Identify fields that need AI processing
        for field_id, field_content in parsed_fields.items():
            # Skip if already handled by rules
            if field_id in converted_fields:
                continue
            
            # Check if field should use AI
            if self.ai_processor.should_use_ai(field_id):
                fields_to_process.append((field_id, field_content))
        
        if not fields_to_process:
            return ai_fields
        
        # Try parallel processing first
        try:
            logger.debug(f"  Processing {len(fields_to_process)} fields with AI in parallel...")
            
            # Pre-initialize Bedrock clients to avoid race conditions
            self.ai_processor.pre_initialize_clients()
            
            # Process AI fields in parallel with timeout
            with ThreadPoolExecutor(max_workers=3) as executor:
                # Submit all AI processing tasks
                future_to_field = {}
                for field_id, field_content in fields_to_process:
                    future = executor.submit(
                        self._process_single_ai_field,
                        field_id,
                        field_content
                    )
                    future_to_field[future] = field_id
                
                # Collect results with timeout
                for future in as_completed(future_to_field, timeout=45):
                    field_id = future_to_field[future]
                    try:
                        result = future.result(timeout=10)
                        if result:
                            ai_fields[field_id] = result
                            self.processing_stats["ai_lane"]["count"] += 1
                            self.processing_stats["ai_lane"]["fields"].append(field_id)
                            logger.debug(f"    ✓ Field {field_id} processed (confidence: {result['confidence']:.2f})")
                    except Exception as e:
                        logger.debug(f"    ✗ Field {field_id} failed: {str(e)[:50]}")
                        # Continue processing other fields even if one fails
            
        except Exception as parallel_error:
            # Parallel processing failed - fallback to sequential
            logger.debug(f"  ⚠️ Parallel processing failed: {str(parallel_error)[:100]}")
            logger.debug(f"  Falling back to sequential processing...")
            
            # Reset stats since we're retrying
            ai_fields = {}
            
            # Process fields sequentially
            for field_id, field_content in fields_to_process:
                logger.debug(f"  Processing field {field_id} with AI (sequential)...")
                try:
                    result = self._process_single_ai_field(field_id, field_content)
                    if result:
                        ai_fields[field_id] = result
                        self.processing_stats["ai_lane"]["count"] += 1
                        self.processing_stats["ai_lane"]["fields"].append(field_id)
                        logger.debug(f"    ✓ Field {field_id} processed (confidence: {result['confidence']:.2f})")
                except Exception as e:
                    logger.debug(f"    ✗ Field {field_id} failed: {str(e)[:50]}")
                    # Continue with next field
        
        return ai_fields
    
    def _process_single_ai_field(self, field_id: str, field_content: str) -> Optional[Dict]:
        """
        Process a single field with AI (used for parallel processing).
        
        Args:
            field_id: Field identifier
            field_content: Field content to process
            
        Returns:
            Processed field data or None if failed
        """
        try:
            start_time = time.time()
            result, confidence, metadata = self.ai_processor.process_field(field_id, field_content)
            elapsed = time.time() - start_time
            
            if metadata.get("success"):
                return {
                    "value": result,
                    "confidence": confidence,
                    "processing_lane": "AI",
                    "model_used": metadata.get("model"),
                    "processing_time": elapsed
                }
        except Exception as e:
            logger.debug(f"      Error processing field {field_id}: {str(e)[:100]}")
        
        return None
    
    def _identify_human_review(self, converted_fields: Dict, original_fields: Dict) -> List[str]:
        """
        Identify fields that need human review.
        
        Criteria:
        - AI confidence below threshold (0.7)
        - Missing required fields
        - Fields that failed both rules and AI
        
        Args:
            converted_fields: All converted fields
            original_fields: Original parsed fields
            
        Returns:
            List of field IDs needing review
        """
        review_fields = []
        
        # Check for low confidence AI fields
        for field_id, field_data in converted_fields.items():
            if isinstance(field_data, dict):
                confidence = field_data.get("confidence", 1.0)
                if confidence < 0.7:
                    review_fields.append(field_id)
        
        # Check for unconverted fields
        for field_id in original_fields:
            if field_id not in converted_fields:
                # Field wasn't processed by rules or AI
                review_fields.append(field_id)
        
        return review_fields
    
    def _create_conversion_record(self, raw_message: str, trace_id: Optional[str]) -> Any:
        """Create initial conversion record in MongoDB."""
        record = {
            "source_format": self.source_format,
            "target_format": self.target_format,
            "trace_id": trace_id,
            "raw_message": raw_message[:1000],  # Store first 1000 chars
            "status": "in_progress",
            "created_at": datetime.now(UTC),
            "processing_stats": {}
        }
        
        return self.db.insert_one("conversions", record)
    
    def _update_conversion_record(self, **kwargs):
        """Update conversion record with results."""
        update_data = {
            "status": "completed" if kwargs.get("success") else "failed",
            "updated_at": datetime.now(UTC)
        }
        
        # Add all provided fields
        for key, value in kwargs.items():
            if key != "success":
                update_data[key] = value
        
        self.db.update_one(
            "conversions",
            {"_id": self.conversion_id},
            {"$set": update_data}
        )
    
    def _get_lanes_summary(self) -> Dict[str, int]:
        """Get summary of processing lanes used."""
        return {
            "rules": self.processing_stats["rules_lane"]["count"],
            "ai": self.processing_stats["ai_lane"]["count"],
            "human": self.processing_stats["human_lane"]["count"]
        }
    
    def get_conversion_history(self, limit: int = 10) -> List[Dict]:
        """
        Get recent conversion history from MongoDB.
        
        Args:
            limit: Number of records to retrieve
            
        Returns:
            List of conversion records
        """
        return self.db.find(
            "conversions",
            {
                "source_format": self.source_format,
                "target_format": self.target_format
            },
            limit=limit,
            sort=[("created_at", -1)]
        )
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """
        Get performance metrics for this conversion type.
        
        Returns:
            Dictionary with metrics like success rate, avg time, lane distribution
        """
        # Aggregate metrics from MongoDB
        conversions = self.db.find(
            "conversions",
            {
                "source_format": self.source_format,
                "target_format": self.target_format,
                "status": {"$in": ["completed", "failed"]}
            }
        )
        
        if not conversions:
            return {
                "total_conversions": 0,
                "success_rate": 0.0,
                "average_time": 0.0,
                "lane_distribution": {}
            }
        
        # Calculate metrics
        total = len(conversions)
        successful = len([c for c in conversions if c["status"] == "completed"])
        
        # Calculate average processing time
        times = []
        lane_totals = {"rules": 0, "ai": 0, "human": 0}
        
        for conv in conversions:
            stats = conv.get("processing_stats", {})
            if stats.get("start_time") and stats.get("end_time"):
                duration = (stats["end_time"] - stats["start_time"]).total_seconds()
                times.append(duration)
            
            # Aggregate lane usage
            for lane in ["rules_lane", "ai_lane", "human_lane"]:
                if lane in stats:
                    lane_key = lane.replace("_lane", "")
                    lane_totals[lane_key] += stats[lane].get("count", 0)
        
        avg_time = sum(times) / len(times) if times else 0.0
        
        return {
            "total_conversions": total,
            "success_rate": (successful / total) * 100 if total > 0 else 0.0,
            "average_time": avg_time,
            "lane_distribution": lane_totals,
            "mongodb_collections": [
                "conversions",
                "conversion_rules", 
                "field_model_routing",
                "prompt_templates",
                "ai_processing_history"
            ]
        }