"""Custom exceptions for payment conversion"""

from typing import Dict, Any, Optional


class CountryValidationException(Exception):
    """
    Raised when country-specific business rules are violated.

    This exception triggers the payment_agent service to automatically
    analyze and correct the violation before conversion can proceed.

    The agent receives a problem description and autonomously decides
    which tools to use to resolve it.

    Examples:
        - Japan: Names must be in katakana
        - India: IFSC codes must be valid
        - UK: Legal entity names required for compliance
    """

    def __init__(
        self,
        problem: str,
        field_name: str,
        original_value: str,
        payment_data: Dict[str, Any],
        conversion_context: Dict[str, Any]
    ):
        """
        Initialize country validation exception.

        Args:
            problem: Rich description of the problem for agent to analyze
                     (e.g., "Creditor name contains Western characters but
                     Japanese payments require katakana script")
            field_name: Field that violated the rule (e.g., "creditorName")
            original_value: Current (invalid) value
            payment_data: Full canonical JSON payment data
            conversion_context: Conversion metadata (source/target/id)
        """
        self.problem = problem
        self.field_name = field_name
        self.original_value = original_value
        self.payment_data = payment_data
        self.conversion_context = conversion_context

        super().__init__(
            f"Country validation failed for {field_name}: {problem}"
        )

    def to_agent_request(self) -> Dict[str, Any]:
        """
        Convert exception to payment_agent API request format.

        Returns:
            Dictionary matching ProcessPaymentRequest schema
        """
        return {
            "problem": self.problem,
            "field_name": self.field_name,
            "original_value": self.original_value,
            "payment_data": self.payment_data,
            "conversion_context": self.conversion_context
        }
