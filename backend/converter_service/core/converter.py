"""
Universal Converter - Main converter class
Loads entire configuration from MongoDB and orchestrates conversion
"""

from typing import Dict, Any, Optional
from datetime import datetime
import logging

from .parser import GenericParser
from .transformer import Transformer
from .builder import GenericBuilder
from ..services.ai_service import BedrockService


logger = logging.getLogger(__name__)


class UniversalConverter:
    """
    Universal converter that handles any format conversion
    based entirely on MongoDB configuration
    """
    
    def __init__(self, db_connector, source_format: str, target_format: str):
        """
        Initialize converter with database connection and format pair
        
        Args:
            db_connector: MongoDB connector instance
            source_format: Source format (e.g., "MT103")
            target_format: Target format (e.g., "pacs.008")
        """
        self.db = db_connector
        self.source_format = source_format
        self.target_format = target_format
        self.conversion_id = f"{source_format}_to_{target_format}"
        
        # Load entire configuration in ONE database query
        self.config = self._load_configuration()
        
        if not self.config:
            raise ValueError(f"No configuration found for {self.conversion_id}")
        
        # Initialize AI service if configured
        self.ai_service = None
        if 'ai_service' in self.config:
            ai_config = self.config['ai_service']
            if ai_config.get('provider') == 'bedrock':
                try:
                    self.ai_service = BedrockService(
                        region=ai_config.get('region', 'us-east-1')
                    )
                    logger.info("Initialized Bedrock AI service")
                except Exception as e:
                    logger.warning(f"Could not initialize AI service: {e}")
                    logger.info("Will use fallback rules-based processing")
        
        # Initialize components with configuration
        self.parser = GenericParser(self.config.get('parser', {}))
        self.transformer = Transformer(
            self.config.get('mappings', []),
            ai_service=self.ai_service,
            human_review_config=self.config.get('human_review', {})
        )
        self.builder = GenericBuilder(self.config.get('builder', {}))
        
        logger.info(f"Initialized converter for {self.conversion_id}")
    
    def _load_configuration(self) -> Optional[Dict[str, Any]]:
        """
        Load complete conversion configuration from MongoDB
        
        Returns:
            Configuration dictionary or None if not found
        """
        try:
            # Single query to get everything
            config = self.db.db['conversion_registry'].find_one({
                '_id': self.conversion_id
            })
            
            if config:
                logger.info(f"Loaded configuration for {self.conversion_id}")
                return config
            else:
                logger.warning(f"No configuration found for {self.conversion_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error loading configuration: {e}")
            return None
    
    def convert(self, raw_message: str) -> Dict[str, Any]:
        """
        Convert message from source to target format
        
        Args:
            raw_message: Raw input message in source format
            
        Returns:
            Dictionary containing:
                - success: Boolean indicating conversion success
                - converted_message: Converted message in target format
                - metadata: Conversion metadata and statistics
                - error: Error message if conversion failed
        """
        start_time = datetime.utcnow()
        metadata = {
            'source_format': self.source_format,
            'target_format': self.target_format,
            'start_time': start_time.isoformat(),
            'conversion_id': self.conversion_id
        }
        
        try:
            # Step 1: Parse the raw message
            logger.debug("Parsing message...")
            parsed_fields = self.parser.parse(raw_message)
            metadata['parsed_fields_count'] = len(parsed_fields)
            
            # Step 2: Transform fields according to mappings
            logger.debug("Transforming fields...")
            transformed_fields = self.transformer.transform(parsed_fields)
            metadata['transformed_fields_count'] = len(transformed_fields)
            
            # Get processing statistics from transformer
            processing_summary = self.transformer.get_processing_summary()
            metadata['processing_stats'] = processing_summary['processing_stats']
            metadata['human_review_required'] = processing_summary['human_review_required']
            metadata['human_review_fields'] = processing_summary['human_review_fields']
            metadata['confidence_scores'] = processing_summary['confidence_scores']
            
            # Step 3: Build the output message
            logger.debug("Building output message...")
            output_message = self.builder.build(transformed_fields)
            
            # Calculate processing time
            end_time = datetime.utcnow()
            processing_time = (end_time - start_time).total_seconds()
            
            metadata['end_time'] = end_time.isoformat()
            metadata['processing_time_seconds'] = processing_time
            metadata['status'] = 'completed'
            
            logger.info(f"Conversion completed in {processing_time:.2f} seconds")
            
            return {
                'success': True,
                'converted_message': output_message,
                'metadata': metadata,
                'parsed_fields': parsed_fields,  # For debugging
                'transformed_fields': transformed_fields  # For debugging
            }
            
        except Exception as e:
            logger.error(f"Conversion failed: {e}")
            
            end_time = datetime.utcnow()
            metadata['end_time'] = end_time.isoformat()
            metadata['processing_time_seconds'] = (end_time - start_time).total_seconds()
            metadata['status'] = 'failed'
            
            return {
                'success': False,
                'converted_message': None,
                'metadata': metadata,
                'error': str(e)
            }
    
    def get_configuration_summary(self) -> Dict[str, Any]:
        """
        Get a summary of the loaded configuration
        
        Returns:
            Summary of parser, transformer, and builder configurations
        """
        if not self.config:
            return {'error': 'No configuration loaded'}
        
        return {
            'conversion_id': self.conversion_id,
            'parser': {
                'type': self.config.get('parser', {}).get('type'),
                'fields_count': len(self.config.get('parser', {}).get('fields', {}))
            },
            'mappings_count': len(self.config.get('mappings', [])),
            'builder': {
                'type': self.config.get('builder', {}).get('type'),
                'has_template': 'template' in self.config.get('builder', {})
            }
        }
    
    def validate_configuration(self) -> Dict[str, Any]:
        """
        Validate the loaded configuration
        
        Returns:
            Validation results with any warnings or errors
        """
        results = {
            'valid': True,
            'warnings': [],
            'errors': []
        }
        
        if not self.config:
            results['valid'] = False
            results['errors'].append('No configuration loaded')
            return results
        
        # Check parser configuration
        if 'parser' not in self.config:
            results['errors'].append('Missing parser configuration')
            results['valid'] = False
        elif not self.config['parser'].get('fields'):
            results['warnings'].append('No fields defined in parser')
        
        # Check mappings
        if 'mappings' not in self.config:
            results['errors'].append('Missing mappings configuration')
            results['valid'] = False
        elif len(self.config['mappings']) == 0:
            results['warnings'].append('No mappings defined')
        
        # Check builder configuration
        if 'builder' not in self.config:
            results['errors'].append('Missing builder configuration')
            results['valid'] = False
        elif not self.config['builder'].get('template'):
            results['warnings'].append('No template defined in builder')
        
        return results