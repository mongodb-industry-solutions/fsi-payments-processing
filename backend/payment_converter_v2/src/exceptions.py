"""Custom exceptions for payment conversion"""

from typing import Dict, Any, Optional


class CountryValidationException(Exception):
    """
    Raised when country-specific business rules are violated.

    This exception triggers the payment_agent service to automatically
    correct the violation before conversion can proceed.

    Examples:
        - Japan: Names must be in katakana
        - India: IFSC codes must be valid
        - Switzerland: IBANs must follow QR-IBAN format
    """

    def __init__(
        self,
        task_type: str,
        field_name: str,
        original_value: str,
        reason: str,
        payment_data: Dict[str, Any],
        conversion_context: Dict[str, Any]
    ):
        """
        Initialize country validation exception.

        Args:
            task_type: Type of correction needed (e.g., "japan_transliteration")
            field_name: Field that violated the rule (e.g., "creditor_name")
            original_value: Current (invalid) value
            reason: Human-readable explanation of the violation
            payment_data: Full canonical JSON payment data
            conversion_context: Conversion metadata (source/target/id)
        """
        self.task_type = task_type
        self.field_name = field_name
        self.original_value = original_value
        self.reason = reason
        self.payment_data = payment_data
        self.conversion_context = conversion_context

        super().__init__(
            f"Country validation failed for {field_name}: {reason} "
            f"(task_type={task_type})"
        )

    def to_agent_request(self) -> Dict[str, Any]:
        """
        Convert exception to payment_agent API request format.

        Returns:
            Dictionary matching ProcessPaymentRequest schema
        """
        return {
            "task_type": self.task_type,
            "field_name": self.field_name,
            "original_value": self.original_value,
            "payment_data": self.payment_data,
            "conversion_context": self.conversion_context
        }
