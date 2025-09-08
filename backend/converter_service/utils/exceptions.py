"""
Custom exceptions for converter service
"""


class ConverterException(Exception):
    """Base exception for converter service"""
    pass


class ConfigurationError(ConverterException):
    """Raised when configuration is missing or invalid"""
    pass


class ParsingError(ConverterException):
    """Raised when message parsing fails"""
    pass


class TransformationError(ConverterException):
    """Raised when field transformation fails"""
    pass


class BuilderError(ConverterException):
    """Raised when output building fails"""
    pass


class DatabaseError(ConverterException):
    """Raised when database operation fails"""
    pass


class AIServiceError(ConverterException):
    """Raised when AI service fails"""
    pass


class ValidationError(ConverterException):
    """Raised when validation fails"""
    def __init__(self, message: str, field: str = None):
        self.field = field
        super().__init__(message)