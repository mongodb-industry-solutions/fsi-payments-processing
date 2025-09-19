"""
Auto Config Builder Service
Handles auto-configuration demo scenarios with editable forms
Following the same pattern as PaymentBuilder for consistency
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class AutoConfigBuilder:
    """
    Manages auto-configuration demo scenarios with editable sample messages.
    Provides form schemas, demo values, and sample message generation.
    """

    def __init__(self):
        """Initialize with auto-config scenarios data."""
        self.scenarios_data = self._load_scenarios()
        self.scenarios_by_id = {
            scenario['id']: scenario
            for scenario in self.scenarios_data.get('auto_config_scenarios', [])
        }
        logger.info(f"Loaded {len(self.scenarios_by_id)} auto-config scenarios")

    def _load_scenarios(self) -> Dict[str, Any]:
        """Load auto-config scenarios from JSON file."""
        try:
            scenarios_file = Path(__file__).parent.parent / 'data' / 'auto_config_scenarios.json'
            with open(scenarios_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading auto-config scenarios: {e}")
            return {'auto_config_scenarios': [], 'demo_presets': []}

    def get_scenarios_list(self) -> List[Dict[str, Any]]:
        """
        Get list of available auto-config scenarios.

        Returns:
            List of scenario summaries for UI display
        """
        return [
            {
                'id': scenario['id'],
                'name': scenario['display_name'],
                'description': scenario['description'],
                'icon': scenario['icon'],
                'source_format': scenario['source_format'],
                'target_format': scenario['target_format'],
                'confidence_expected': scenario['confidence_expected']
            }
            for scenario in self.scenarios_data.get('auto_config_scenarios', [])
        ]

    def get_demo_presets(self) -> List[Dict[str, Any]]:
        """
        Get quick demo presets for easy selection.

        Returns:
            List of preset configurations
        """
        return self.scenarios_data.get('demo_presets', [])

    def get_scenario(self, scenario_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific auto-config scenario by ID.

        Args:
            scenario_id: Scenario identifier

        Returns:
            Complete scenario data or None if not found
        """
        return self.scenarios_by_id.get(scenario_id)

    def get_form_schema(
        self,
        scenario_id: str,
        include_demo_values: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        Get form schema for a specific auto-config scenario.

        Args:
            scenario_id: Scenario identifier
            include_demo_values: Whether to include pre-filled values

        Returns:
            Form schema with field definitions
        """
        scenario = self.scenarios_by_id.get(scenario_id)
        if not scenario:
            return None

        # Clone the form schema
        form_schema = json.loads(json.dumps(scenario['form_schema']))

        # Remove values if not requested
        if not include_demo_values:
            for section in form_schema.get('sections', []):
                for field in section.get('fields', []):
                    field.pop('value', None)

        return {
            'scenario_id': scenario_id,
            'display_name': scenario['display_name'],
            'source_format': scenario['source_format'],
            'target_format': scenario['target_format'],
            'form_schema': form_schema,
            'editable': True,
            'sample_message_available': True
        }

    def get_sample_message(
        self,
        scenario_id: str,
        form_data: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get sample message for auto-configuration.

        Args:
            scenario_id: Scenario identifier
            form_data: Optional form data to customize the message

        Returns:
            Sample message and metadata
        """
        scenario = self.scenarios_by_id.get(scenario_id)
        if not scenario:
            return None

        # Use provided sample message or generate from form data
        if form_data:
            sample_message = self._generate_message_from_form(scenario, form_data)
        else:
            sample_message = scenario['sample_message']

        return {
            'scenario_id': scenario_id,
            'source_format': scenario['source_format'],
            'target_format': scenario['target_format'],
            'sample_message': sample_message,
            'similar_to': scenario['similar_to'],
            'confidence_expected': scenario['confidence_expected'],
            'editable': True,
            'metadata': {
                'message_length': len(sample_message),
                'generated_at': datetime.utcnow().isoformat(),
                'expected_fields_detected': scenario.get('expected_fields_detected', 0),
                'expected_fields_mapped': scenario.get('expected_fields_mapped', 0)
            }
        }

    def _generate_message_from_form(
        self,
        scenario: Dict[str, Any],
        form_data: Dict[str, Any]
    ) -> str:
        """
        Generate a sample message from form data.

        Args:
            scenario: Scenario configuration
            form_data: User-provided form values

        Returns:
            Generated message string
        """
        # Get base message
        base_message = scenario['sample_message']

        # For MT formats, replace field values
        if scenario['source_format'].startswith('MT'):
            message = base_message

            # MT192 specific replacements
            if scenario['source_format'] == 'MT192':
                if 'reference' in form_data:
                    message = message.replace('REF192TEST001', form_data['reference'])
                if 'related_reference' in form_data:
                    message = message.replace('RELATEDREF001', form_data['related_reference'])
                if 'cancellation_text' in form_data:
                    # Replace the text in field 79
                    import re
                    pattern = r':79:.*?(?=\n-|\Z)'
                    replacement = f":79:{form_data['cancellation_text']}"
                    message = re.sub(pattern, replacement, message, flags=re.DOTALL)

            # MT205 specific replacements
            elif scenario['source_format'] == 'MT205':
                if 'reference' in form_data:
                    message = message.replace('MT205TEST001', form_data['reference'])
                if 'related_reference' in form_data:
                    message = message.replace('COVREF2024001', form_data['related_reference'])
                if 'amount' in form_data and 'currency' in form_data:
                    amount_str = f"{form_data['amount']:.2f}".replace('.', ',')
                    message = message.replace('EUR500000,00', f"{form_data['currency']}{amount_str}")
                if 'ordering_customer_name' in form_data:
                    message = message.replace('ACME CORPORATION', form_data['ordering_customer_name'])
                if 'beneficiary_name' in form_data:
                    message = message.replace('GLOBAL IMPORTS GMBH', form_data['beneficiary_name'])

            # MT202COV specific replacements
            elif scenario['source_format'] == 'MT202COV':
                if 'reference' in form_data:
                    message = message.replace('MT202COVTEST', form_data['reference'])
                if 'related_reference' in form_data:
                    message = message.replace('COVER2024001', form_data['related_reference'])
                if 'amount' in form_data and 'currency' in form_data:
                    amount_str = f"{form_data['amount']:.2f}".replace('.', ',')
                    message = message.replace('USD1000000,00', f"{form_data['currency']}{amount_str}")

            # MT940 specific replacements
            elif scenario['source_format'] == 'MT940':
                if 'statement_reference' in form_data:
                    message = message.replace('STMT20241215', form_data['statement_reference'])
                if 'account_number' in form_data:
                    message = message.replace('US64209876543210987654', form_data['account_number'])

            return message

        # For ISO8583, customize the binary message
        elif scenario['source_format'].startswith('ISO8583'):
            # This is simplified - real ISO8583 would need proper field encoding
            message = scenario['sample_message']
            if 'card_number' in form_data:
                # Replace card number (simplified)
                message = message.replace('4034442222222222', form_data['card_number'][:16].ljust(16, '0'))
            return message

        # Default: return base message
        return base_message

    def validate_form_data(
        self,
        scenario_id: str,
        form_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validate form data against scenario schema.

        Args:
            scenario_id: Scenario identifier
            form_data: User-provided form values

        Returns:
            Validation result with errors if any
        """
        scenario = self.scenarios_by_id.get(scenario_id)
        if not scenario:
            return {
                'valid': False,
                'errors': [{'field': 'scenario_id', 'message': 'Invalid scenario ID'}]
            }

        errors = []

        # Validate required fields
        for section in scenario['form_schema'].get('sections', []):
            for field in section.get('fields', []):
                field_id = field['id']
                is_required = field.get('required', False)

                if is_required and field_id not in form_data:
                    errors.append({
                        'field': field_id,
                        'message': f"{field['label']} is required"
                    })

                # Type validation
                if field_id in form_data:
                    value = form_data[field_id]
                    field_type = field.get('type', 'text')

                    if field_type == 'number' and not isinstance(value, (int, float)):
                        try:
                            float(value)
                        except (ValueError, TypeError):
                            errors.append({
                                'field': field_id,
                                'message': f"{field['label']} must be a number"
                            })

                    elif field_type == 'select' and value not in field.get('options', []):
                        errors.append({
                            'field': field_id,
                            'message': f"Invalid option for {field['label']}"
                        })

        return {
            'valid': len(errors) == 0,
            'errors': errors
        }

    def get_configuration_metadata(self, scenario_id: str) -> Dict[str, Any]:
        """
        Get metadata about expected auto-configuration results.

        Args:
            scenario_id: Scenario identifier

        Returns:
            Configuration expectations and statistics
        """
        scenario = self.scenarios_by_id.get(scenario_id)
        if not scenario:
            return {}

        return {
            'scenario_id': scenario_id,
            'source_format': scenario['source_format'],
            'target_format': scenario['target_format'],
            'similar_to': scenario['similar_to'],
            'expected_confidence': scenario['confidence_expected'],
            'expected_fields_detected': scenario.get('expected_fields_detected', 0),
            'expected_fields_mapped': scenario.get('expected_fields_mapped', 0),
            'showcase_features': scenario.get('showcase_features', []),
            'statistics': self.scenarios_data.get('configuration_statistics', {})
        }

    def get_demo_statistics(self) -> Dict[str, Any]:
        """
        Get overall auto-configuration statistics for demo dashboard.

        Returns:
            Statistics and metrics
        """
        stats = self.scenarios_data.get('configuration_statistics', {})
        stats['total_scenarios'] = len(self.scenarios_by_id)
        stats['demo_presets'] = len(self.scenarios_data.get('demo_presets', []))
        stats['formats_supported'] = list(set(
            s['source_format'] for s in self.scenarios_by_id.values()
        ))

        return stats

    def get_demo_corrections(self, scenario_id: str) -> Optional[Dict[str, Any]]:
        """
        Get predefined demo corrections for human review simulation.

        These corrections simulate what a human reviewer would correct,
        making the demo predictable and impressive.

        Args:
            scenario_id: Scenario identifier

        Returns:
            Demo corrections including field corrections and improved confidence
        """
        # Define scenario-specific corrections
        demo_corrections = {
            "mt192_to_pacs008": {
                "field_corrections": [
                    {
                        "field": "79",
                        "semantic_concept": "remittance_info",
                        "correct": True,  # Marking as correct after review
                        "confidence_boost": 0.15  # Boost confidence by 15%
                    },
                    {
                        "field": "20",
                        "semantic_concept": "transaction_reference",
                        "correct": True,
                        "confidence_boost": 0.10
                    }
                ],
                "improved_confidence": 0.92,  # Calculated: 0.77 base + 0.15 human review boost
                "review_notes": "Validated remittance field mapping and transaction reference"
            },
            "mt205_to_pacs009": {
                "field_corrections": [
                    {
                        "field": "72",
                        "semantic_concept": "bank_to_bank_info",
                        "correct": True,
                        "confidence_boost": 0.12
                    },
                    {
                        "field": "50K",
                        "semantic_concept": "ordering_customer",
                        "correct": True,
                        "new_mapping": {
                            "targets": ["InitgPty.Nm", "InitgPty.PstlAdr.AdrLine"],
                            "confidence": 0.90
                        }
                    }
                ],
                "improved_confidence": 0.94,  # 0.88 base + human review
                "review_notes": "Confirmed COV payment structure and party mappings"
            },
            "mt202cov_to_pacs009": {
                "field_corrections": [
                    {
                        "field": "70",
                        "semantic_concept": "remittance_info",
                        "correct": True,
                        "confidence_boost": 0.08
                    }
                ],
                "improved_confidence": 0.98,  # 0.90 base + human review
                "review_notes": "Validated all COV-specific fields"
            },
            "mt940_to_camt053": {
                "field_corrections": [
                    {
                        "field": "61",
                        "semantic_concept": "transaction_entries",
                        "correct": False,  # Needs correction
                        "new_mapping": {
                            "targets": ["Ntry.BookgDt", "Ntry.ValDt", "Ntry.Amt"],
                            "transform": "split_transaction_entry",
                            "confidence": 0.85
                        }
                    }
                ],
                "improved_confidence": 0.85,  # 0.75 base + corrections
                "review_notes": "Corrected transaction entry parsing"
            },
            "iso8583_to_json": {
                "field_corrections": [],
                "improved_confidence": 0.90,  # 0.82 base + validation
                "review_notes": "Validated binary field extraction"
            }
        }

        corrections = demo_corrections.get(scenario_id)
        if not corrections:
            # Generate default corrections for unknown scenarios
            scenario = self.scenarios_by_id.get(scenario_id)
            if scenario:
                base_confidence = scenario.get('confidence_expected', 0.80)
                return {
                    "field_corrections": [],
                    "improved_confidence": min(0.95, base_confidence + 0.10),  # Add 10% boost, max 95%
                    "review_notes": "General validation completed"
                }

        return corrections