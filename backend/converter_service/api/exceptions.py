"""
Common exception handlers and error responses
Provides consistent error handling across all API endpoints
"""

from fastapi import HTTPException
from typing import Optional, Any


def demo_mode_required() -> HTTPException:
    """
    Standard exception for endpoints that require demo mode

    Usage:
        if not feature_flags.is_demo_mode():
            raise demo_mode_required()
    """
    return HTTPException(
        status_code=403,
        detail="Demo mode is not enabled. Set ENABLE_DEMO_MODE=true to access this endpoint."
    )


def config_not_found(config_id: str) -> HTTPException:
    """
    Standard exception for missing configuration

    Args:
        config_id: The configuration ID that was not found

    Usage:
        config = db.conversion_registry.find_one({"_id": config_id})
        if not config:
            raise config_not_found(config_id)
    """
    return HTTPException(
        status_code=404,
        detail=f"Configuration '{config_id}' not found"
    )


def conversion_not_found(conversion_id: str) -> HTTPException:
    """
    Standard exception for missing conversion result

    Args:
        conversion_id: The conversion ID that was not found
    """
    return HTTPException(
        status_code=404,
        detail=f"Conversion '{conversion_id}' not found or has expired"
    )


def invalid_request(detail: str) -> HTTPException:
    """
    Standard exception for invalid request parameters

    Args:
        detail: Specific error message

    Usage:
        if not request.config_id:
            raise invalid_request("config_id is required")
    """
    return HTTPException(
        status_code=400,
        detail=detail
    )


def invalid_format(source_format: str, target_format: str) -> HTTPException:
    """
    Standard exception for unsupported format conversion

    Args:
        source_format: Source format requested
        target_format: Target format requested
    """
    return HTTPException(
        status_code=400,
        detail=f"Conversion from '{source_format}' to '{target_format}' is not configured"
    )


def feature_not_enabled(feature_name: str) -> HTTPException:
    """
    Standard exception for disabled features

    Args:
        feature_name: Name of the feature that is not enabled
    """
    return HTTPException(
        status_code=403,
        detail=f"Feature '{feature_name}' is not enabled in current configuration"
    )


def processing_error(error_message: str, status_code: int = 500) -> HTTPException:
    """
    Standard exception for processing errors

    Args:
        error_message: Error details
        status_code: HTTP status code (default 500)
    """
    return HTTPException(
        status_code=status_code,
        detail=f"Processing error: {error_message}"
    )


def database_error(operation: str, error: Optional[Exception] = None) -> HTTPException:
    """
    Standard exception for database operations

    Args:
        operation: The operation that failed
        error: Optional underlying exception
    """
    detail = f"Database operation failed: {operation}"
    if error:
        detail += f" - {str(error)}"

    return HTTPException(
        status_code=500,
        detail=detail
    )


def validation_error(field: str, issue: str) -> HTTPException:
    """
    Standard exception for validation errors

    Args:
        field: Field that failed validation
        issue: Description of the validation issue
    """
    return HTTPException(
        status_code=422,
        detail=f"Validation error in field '{field}': {issue}"
    )


def rate_limit_exceeded(limit: int, window: str = "minute") -> HTTPException:
    """
    Standard exception for rate limiting

    Args:
        limit: The rate limit that was exceeded
        window: Time window for the limit
    """
    return HTTPException(
        status_code=429,
        detail=f"Rate limit exceeded: {limit} requests per {window}"
    )


def unauthorized(reason: str = "Authentication required") -> HTTPException:
    """
    Standard exception for unauthorized access

    Args:
        reason: Specific reason for unauthorized access
    """
    return HTTPException(
        status_code=401,
        detail=reason
    )


def insufficient_permissions(resource: str, action: str) -> HTTPException:
    """
    Standard exception for insufficient permissions

    Args:
        resource: Resource being accessed
        action: Action being attempted
    """
    return HTTPException(
        status_code=403,
        detail=f"Insufficient permissions to {action} {resource}"
    )


class ConversionError(Exception):
    """Base exception for conversion-related errors"""
    pass


class ConfigurationError(Exception):
    """Exception for configuration-related errors"""
    pass


class AIProcessingError(Exception):
    """Exception for AI processing errors"""
    pass


# Helper function to convert exceptions to HTTP responses
def handle_exception(e: Exception) -> HTTPException:
    """
    Convert various exception types to appropriate HTTP responses

    Args:
        e: The exception to handle

    Returns:
        HTTPException with appropriate status code and message
    """
    if isinstance(e, HTTPException):
        return e
    elif isinstance(e, ConversionError):
        return processing_error(str(e))
    elif isinstance(e, ConfigurationError):
        return invalid_request(str(e))
    elif isinstance(e, AIProcessingError):
        return processing_error(f"AI processing failed: {str(e)}")
    elif isinstance(e, ValueError):
        return validation_error("input", str(e))
    elif isinstance(e, KeyError):
        return invalid_request(f"Missing required field: {str(e)}")
    else:
        # Generic error
        return processing_error(f"Unexpected error: {str(e)}")