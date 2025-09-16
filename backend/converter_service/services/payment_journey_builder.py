"""
Payment Journey Builder Service
Simple service that selects appropriate journey visualization from demo scenarios
"""

import json
import os
from typing import Dict, Any, Optional, List
from datetime import datetime
import random
import logging

logger = logging.getLogger(__name__)


class PaymentJourneyBuilder:
    """
    Simple journey selector for payment conversions.
    Selects predefined journey scenarios based on form data complexity.
    """

    def __init__(self):
        """Initialize by loading demo scenarios"""
        try:
            # Load scenarios from JSON file
            current_dir = os.path.dirname(os.path.abspath(__file__))
            scenarios_path = os.path.join(current_dir, '..', 'data', 'demo_scenarios.json')

            with open(scenarios_path, 'r') as f:
                self.data = json.load(f)

            self.payment_types = {pt['id']: pt for pt in self.data.get('payment_types', [])}
            logger.info(f"Loaded {len(self.payment_types)} payment types with journey scenarios")

        except FileNotFoundError:
            logger.error(f"Demo scenarios file not found at {scenarios_path}")
            self.data = {"payment_types": []}
            self.payment_types = {}
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing demo scenarios JSON: {e}")
            self.data = {"payment_types": []}
            self.payment_types = {}

    def get_journey(
        self,
        payment_type_id: str,
        form_data: Optional[Dict[str, Any]] = None,
        force_journey_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get journey visualization for a payment conversion.

        Args:
            payment_type_id: ID of the payment type (e.g., 'cross_border')
            form_data: Form data submitted by user (used to determine complexity)
            force_journey_id: Optional - force selection of specific journey

        Returns:
            Journey visualization data with route, timing, and metadata
        """

        # Default to empty form data if not provided
        form_data = form_data or {}

        # Find the payment type
        payment_type = self.payment_types.get(payment_type_id)

        if not payment_type:
            logger.warning(f"Payment type '{payment_type_id}' not found")
            return {
                "error": f"Payment type '{payment_type_id}' not found",
                "available_types": list(self.payment_types.keys())
            }

        # Get possible journeys
        journeys = payment_type.get('possible_journeys', [])

        if not journeys:
            logger.warning(f"No journeys defined for payment type '{payment_type_id}'")
            return {
                "error": f"No journeys defined for payment type '{payment_type_id}'",
                "payment_type": payment_type_id
            }

        # Select journey
        if force_journey_id:
            # Force specific journey (useful for demos)
            selected_journey = next(
                (j for j in journeys if j.get('id') == force_journey_id),
                journeys[0]
            )
        else:
            # Auto-select based on form complexity
            selected_journey = self._select_journey_by_complexity(journeys, form_data)

        # Create a copy to avoid modifying original
        journey_data = json.loads(json.dumps(selected_journey))

        # Add metadata
        journey_data['metadata'] = {
            'payment_type_id': payment_type_id,
            'payment_type_name': payment_type.get('display_name'),
            'source_format': payment_type.get('source_format'),
            'target_format': payment_type.get('target_format'),
            'timestamp': datetime.now().isoformat(),
            'form_complexity': self._assess_complexity(form_data),
            'selection_reason': self._get_selection_reason(selected_journey, form_data)
        }

        # Add processing summary
        journey_data['summary'] = self._generate_summary(journey_data)

        return journey_data

    def _select_journey_by_complexity(
        self,
        journeys: List[Dict[str, Any]],
        form_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Select journey based on form data complexity.

        Rules:
        1. Complex unstructured text → AI journey
        2. Random 20% chance → Multi-hop journey (for demo variety)
        3. Default → Simple direct journey
        """

        # Identify journey types
        ai_journey = None
        multihop_journey = None
        direct_journey = None

        for journey in journeys:
            journey_id = journey.get('id', '').lower()
            journey_name = journey.get('name', '').lower()

            if 'ai' in journey_id or 'complex' in journey_name or 'extraction' in journey_name:
                ai_journey = journey
            elif 'multihop' in journey_id or 'json' in journey_name or 'bridge' in journey_name:
                multihop_journey = journey
            elif 'direct' in journey_id or 'simple' in journey_name:
                direct_journey = journey

        # Check for complex fields that would trigger AI processing
        complex_fields_to_check = [
            'remittance_info',
            'sender_to_receiver_info',
            'merchant_name',
            'payment_purpose'
        ]

        has_complex_data = False
        for field_name in complex_fields_to_check:
            if field_name in form_data:
                value = str(form_data[field_name])
                # Complex = long text, multiple lines, or specific patterns
                if value and any([
                    len(value) > 100,
                    '\n' in value,
                    'invoice' in value.lower(),
                    'order' in value.lower(),
                    '/' in value  # SWIFT field markers like /ACC/ or /INS/
                ]):
                    has_complex_data = True
                    break

        # Decision logic
        if has_complex_data and ai_journey:
            logger.info(f"Selected AI journey due to complex field data")
            return ai_journey
        elif random.random() < 0.2 and multihop_journey:  # 20% chance for variety
            logger.info(f"Selected multi-hop journey for demo variety")
            return multihop_journey
        else:
            logger.info(f"Selected direct journey (default)")
            return direct_journey or journeys[0]  # Fallback to first journey

    def _assess_complexity(self, form_data: Dict[str, Any]) -> str:
        """
        Assess overall form complexity.

        Returns:
            'simple', 'moderate', or 'complex'
        """
        if not form_data:
            return "simple"

        # Count filled fields
        filled_fields = sum(1 for v in form_data.values() if v)

        # Check for complex content
        total_text_length = sum(
            len(str(v)) for v in form_data.values()
            if v and isinstance(v, (str, int, float))
        )

        if filled_fields < 5 or total_text_length < 200:
            return "simple"
        elif filled_fields < 10 or total_text_length < 500:
            return "moderate"
        else:
            return "complex"

    def _get_selection_reason(
        self,
        journey: Dict[str, Any],
        form_data: Dict[str, Any]
    ) -> str:
        """
        Generate human-readable reason for journey selection.
        """
        journey_name = journey.get('name', 'Unknown')
        condition = journey.get('condition', '')

        if 'ai' in journey.get('id', '').lower():
            return f"Selected '{journey_name}' due to complex unstructured data requiring AI processing"
        elif 'multihop' in journey.get('id', '').lower():
            return f"Selected '{journey_name}' to demonstrate multi-hop routing capabilities"
        else:
            return f"Selected '{journey_name}' for optimal direct processing"

    def _generate_summary(self, journey_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate summary statistics for the journey.
        """
        hops = journey_data.get('hops', [])

        # Calculate totals
        total_rules_fields = 0
        total_ai_fields = 0
        total_human_fields = 0

        for hop in hops:
            lane_dist = hop.get('lane_distribution', {})
            fields = hop.get('fields_processed', 0)

            total_rules_fields += int(fields * lane_dist.get('rules', 0) / 100)
            total_ai_fields += int(fields * lane_dist.get('ai', 0) / 100)
            total_human_fields += int(fields * lane_dist.get('human', 0) / 100)

        # Get MongoDB operations
        mongodb_ops = []
        for hop in hops:
            mongodb_ops.extend(hop.get('mongodb_operations', []))

        return {
            'hop_count': len(hops),
            'total_time_ms': journey_data.get('total_time_ms', 0),
            'total_fields': journey_data.get('total_fields', 0),
            'success_rate': journey_data.get('success_rate', 99.5),
            'lane_summary': {
                'rules_fields': total_rules_fields,
                'ai_fields': total_ai_fields,
                'human_fields': total_human_fields
            },
            'mongodb_operation_count': len(mongodb_ops),
            'showcased_features': journey_data.get('showcase_features', [])
        }

    def get_available_payment_types(self) -> List[Dict[str, str]]:
        """
        Get list of available payment types with their journey counts.
        """
        result = []
        for pt_id, pt_data in self.payment_types.items():
            result.append({
                'id': pt_id,
                'display_name': pt_data.get('display_name'),
                'source_format': pt_data.get('source_format'),
                'target_format': pt_data.get('target_format'),
                'journey_count': len(pt_data.get('possible_journeys', []))
            })
        return result

    def get_journey_by_id(self, payment_type_id: str, journey_id: str) -> Optional[Dict[str, Any]]:
        """
        Get specific journey by payment type and journey ID.
        """
        payment_type = self.payment_types.get(payment_type_id)
        if not payment_type:
            return None

        for journey in payment_type.get('possible_journeys', []):
            if journey.get('id') == journey_id:
                return journey

        return None