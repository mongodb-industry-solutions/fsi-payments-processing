"""
Payment Builder Service
Handles payment message construction from templates and user input
"""

import json
import os
import random
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class PaymentBuilder:
    """
    Service for building payment messages from templates and user input.
    Manages payment scenarios and generates messages for conversion.
    """

    def __init__(self):
        """Initialize payment builder with scenarios from JSON file"""
        self.scenarios = self._load_scenarios()
        logger.info(f"Loaded {len(self.scenarios.get('payment_types', []))} payment types")

    def _load_scenarios(self) -> Dict[str, Any]:
        """Load payment scenarios from JSON file"""
        try:
            # Get the path to the data file
            current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            scenarios_path = os.path.join(current_dir, 'data', 'demo_scenarios.json')

            with open(scenarios_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.error(f"Demo scenarios file not found at {scenarios_path}")
            return {"payment_types": []}
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing demo scenarios JSON: {e}")
            return {"payment_types": []}

    def get_payment_types(self) -> List[Dict[str, str]]:
        """
        Get list of available payment types for user selection

        Returns:
            List of payment type summaries with id, name, description, icon
        """
        return [
            {
                "id": pt["id"],
                "name": pt["display_name"],
                "description": pt["description"],
                "icon": pt["icon"]
            }
            for pt in self.scenarios.get("payment_types", [])
        ]

    def get_payment_scenario(self, payment_type_id: str) -> Optional[Dict[str, Any]]:
        """
        Get full scenario details for a specific payment type

        Args:
            payment_type_id: ID of the payment type (e.g., "cross_border")

        Returns:
            Full scenario configuration or None if not found
        """
        for scenario in self.scenarios.get("payment_types", []):
            if scenario["id"] == payment_type_id:
                return scenario
        return None

    def get_form_schema(self, payment_type_id: str, include_demo_values: bool = False) -> Optional[Dict[str, Any]]:
        """
        Get form schema for a specific payment type

        Args:
            payment_type_id: ID of the payment type
            include_demo_values: Whether to include pre-filled demo values

        Returns:
            Form schema with optional demo values
        """
        scenario = self.get_payment_scenario(payment_type_id)
        if not scenario:
            return None

        result = {
            "payment_type": payment_type_id,
            "display_name": scenario["display_name"],
            "form_schema": scenario["form_schema"]
        }

        if include_demo_values:
            # Get random demo values
            demo_values = self.get_demo_values(payment_type_id)
            if demo_values:
                result["demo_values"] = demo_values["values"]
                result["demo_context"] = {
                    "scenario": demo_values["scenario_name"],
                    "story": f"Demo {scenario['display_name']} transaction",
                    "note": "All fields are editable - modify as needed"
                }

        return result

    def build_payment_message(self, payment_type_id: str, form_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build payment message from template and user input

        Args:
            payment_type_id: ID of the payment type
            form_data: User-provided form data

        Returns:
            Dictionary with built message and metadata
        """
        scenario = self.get_payment_scenario(payment_type_id)
        if not scenario:
            raise ValueError(f"Unknown payment type: {payment_type_id}")

        # Get template
        template = scenario["message_template"]

        # Add any missing default values
        merged_data = self._merge_with_defaults(form_data, scenario)

        # Add generated values
        merged_data = self._add_generated_values(merged_data, payment_type_id)

        # Perform template substitution
        message = self._substitute_placeholders(template, merged_data)

        return {
            "success": True,
            "payment_type": payment_type_id,
            "source_format": scenario["source_format"],
            "target_format": scenario["target_format"],
            "message": message,
            "metadata": {
                "fields_used": len(merged_data),
                "template_length": len(template),
                "message_length": len(message),
                "timestamp": datetime.utcnow().isoformat()
            }
        }

    def _merge_with_defaults(self, form_data: Dict[str, Any], scenario: Dict[str, Any]) -> Dict[str, Any]:
        """
        Merge user form data with any default values from scenario

        Args:
            form_data: User-provided data
            scenario: Payment scenario configuration

        Returns:
            Merged data dictionary
        """
        # Start with form data
        merged = form_data.copy()

        # Handle both old format (demo_values) and new format (demo_values_sets)
        if "demo_values_sets" in scenario and scenario["demo_values_sets"]:
            # Pick a random demo value set
            demo_set = random.choice(scenario["demo_values_sets"])
            demo_values = demo_set.get("values", {})
        else:
            # Fallback to old format
            demo_values = scenario.get("demo_values", {})

        # Add any demo values that are missing
        for key, value in demo_values.items():
            if key not in merged or merged[key] == "":
                merged[key] = value

        return merged

    def _add_generated_values(self, data: Dict[str, Any], payment_type_id: str) -> Dict[str, Any]:
        """
        Add any generated values like timestamps, references, etc.

        Args:
            data: Current form data
            payment_type_id: Type of payment

        Returns:
            Data with generated values added
        """
        # Add value date if not present (format: YYMMDD)
        if "value_date" not in data:
            data["value_date"] = datetime.now().strftime("%y%m%d")

        # Add creation datetime for XML messages
        if "creation_datetime" not in data:
            data["creation_datetime"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")

        # Add message ID if not present
        if "message_id" not in data:
            data["message_id"] = f"{payment_type_id.upper()}{datetime.now().strftime('%Y%m%d%H%M%S')}"

        # Add end-to-end ID if not present
        if "end_to_end_id" not in data:
            data["end_to_end_id"] = f"E2E-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

        # Add STAN for card transactions
        if payment_type_id == "card_payment" and "stan" not in data:
            data["stan"] = datetime.now().strftime("%H%M%S")

        # Add REF for card transactions (retrieval reference number)
        if payment_type_id == "card_payment" and "ref" not in data:
            # Generate a 12-digit retrieval reference number
            data["ref"] = f"{datetime.now().strftime('%y%m%d')}{str(random.randint(100000, 999999))}"

        # Add datetime for card transactions
        if payment_type_id == "card_payment" and "datetime" not in data:
            data["datetime"] = datetime.now().strftime("%m%d%H%M%S")

        # Add default payment_memo for payroll if not present
        if payment_type_id == "payroll" and "payment_memo" not in data:
            data["payment_memo"] = f"Monthly payroll for {datetime.now().strftime('%B %Y')} including regular wages and benefits"

        return data

    def _substitute_placeholders(self, template: str, data: Dict[str, Any]) -> str:
        """
        Replace ${placeholder} with actual values from data

        Args:
            template: Message template with placeholders
            data: Dictionary of values to substitute

        Returns:
            Message with placeholders replaced
        """
        message = template

        # Replace each placeholder
        for key, value in data.items():
            placeholder = f"${{{key}}}"
            # Convert value to string and handle None
            str_value = str(value) if value is not None else ""
            message = message.replace(placeholder, str_value)

        # Warn about any remaining placeholders
        import re
        remaining = re.findall(r'\$\{([^}]+)\}', message)
        if remaining:
            logger.warning(f"Unfilled placeholders in message: {remaining}")

        return message

    def validate_form_data(self, payment_type_id: str, form_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate form data against schema requirements

        Args:
            payment_type_id: ID of the payment type
            form_data: User-provided form data

        Returns:
            Validation result with any errors
        """
        scenario = self.get_payment_scenario(payment_type_id)
        if not scenario:
            return {
                "valid": False,
                "errors": [f"Unknown payment type: {payment_type_id}"]
            }

        errors = []
        warnings = []

        # Check required fields
        form_schema = scenario.get("form_schema", {})
        for section in form_schema.get("sections", []):
            for field in section.get("fields", []):
                field_id = field["id"]
                is_required = field.get("required", False)

                if is_required and (field_id not in form_data or form_data[field_id] == ""):
                    errors.append(f"Required field missing: {field['label']} ({field_id})")

                # Validate patterns if specified
                if field_id in form_data and "pattern" in field:
                    import re
                    pattern = field["pattern"]
                    value = str(form_data[field_id])
                    if not re.match(pattern, value):
                        errors.append(f"Invalid format for {field['label']}: {value}")

                # Validate numeric ranges
                if field_id in form_data and field.get("type") == "number":
                    try:
                        value = float(form_data[field_id])
                        if "min" in field and value < field["min"]:
                            errors.append(f"{field['label']} must be at least {field['min']}")
                        if "max" in field and value > field["max"]:
                            errors.append(f"{field['label']} must not exceed {field['max']}")
                    except (ValueError, TypeError):
                        errors.append(f"{field['label']} must be a number")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }

    def get_demo_values(self, payment_type_id: str, scenario_index: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """
        Get demo values for a specific payment type
        Randomly selects from available demo value sets

        Args:
            payment_type_id: ID of the payment type
            scenario_index: Optional specific scenario index (for testing)

        Returns:
            Demo values dictionary with scenario info or None if not found
        """
        scenario = self.get_payment_scenario(payment_type_id)
        if not scenario:
            return None

        # Handle new format with multiple demo value sets
        if "demo_values_sets" in scenario and scenario["demo_values_sets"]:
            demo_sets = scenario["demo_values_sets"]

            # Select specific index or random
            if scenario_index is not None and 0 <= scenario_index < len(demo_sets):
                selected_set = demo_sets[scenario_index]
            else:
                selected_set = random.choice(demo_sets)

            return {
                "scenario_name": selected_set.get("scenario_name", "Demo Transaction"),
                "values": selected_set.get("values", {})
            }

        # Fallback to old format for backward compatibility
        elif "demo_values" in scenario:
            return {
                "scenario_name": "Demo Transaction",
                "values": scenario["demo_values"]
            }

        return None