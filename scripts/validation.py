"""
Data validation utilities for Der Town.

This module provides validation functions for data before database operations,
ensuring data integrity and consistency across the application.
"""

import re
import uuid
from datetime import date, time, datetime
from typing import Optional, List, Dict, Any, Union
from urllib.parse import urlparse
import phonenumbers
from pydantic import ValidationError

from models import (
    Event, EventStaged, Location, Organization, Tag, Announcement, SourceSite,
    EventStatus, AnnouncementStatus, ImportFrequency
)


class ValidationError(Exception):
    """Custom validation error with detailed message."""
    pass


class DataValidator:
    """Data validation utilities for Der Town entities."""
    
    @staticmethod
    def validate_uuid(uuid_string: str) -> bool:
        """Validate if a string is a valid UUID."""
        try:
            uuid.UUID(uuid_string)
            return True
        except (ValueError, TypeError):
            return False
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email format."""
        if not email:
            return True  # Email is optional
        
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))
    
    @staticmethod
    def validate_phone(phone: str) -> bool:
        """Validate phone number format."""
        if not phone:
            return True  # Phone is optional
        
        try:
            # Try to parse with phonenumbers library
            parsed = phonenumbers.parse(phone, "US")
            return phonenumbers.is_valid_number(parsed)
        except:
            # Fallback to simple regex validation
            pattern = r'^[\+]?[1-9][\d]{0,15}$'
            cleaned = re.sub(r'[\s\-\(\)]', '', phone)
            return bool(re.match(pattern, cleaned))
    
    @staticmethod
    def validate_url(url: str) -> bool:
        """Validate URL format."""
        if not url:
            return True  # URL is optional
        
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except:
            return False
    
    @staticmethod
    def validate_coordinates(latitude: float, longitude: float) -> bool:
        """Validate geographic coordinates."""
        return -90 <= latitude <= 90 and -180 <= longitude <= 180
    
    @staticmethod
    def validate_date_range(start_date: date, end_date: Optional[date] = None) -> bool:
        """Validate date range (end_date must be after or equal to start_date)."""
        if end_date and end_date < start_date:
            return False
        return True
    
    @staticmethod
    def validate_time_range(start_time: time, end_time: time, same_date: bool = True) -> bool:
        """Validate time range."""
        if same_date and end_time <= start_time:
            return False
        return True
    
    @staticmethod
    def validate_string_length(value: str, min_length: int = 1, max_length: int = 255) -> bool:
        """Validate string length."""
        if not value:
            return min_length == 0
        return min_length <= len(value) <= max_length
    
    @staticmethod
    def sanitize_string(value: str) -> str:
        """Sanitize string input."""
        if not value:
            return ""
        # Remove control characters except newlines and tabs
        sanitized = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', value)
        # Normalize whitespace
        sanitized = re.sub(r'\s+', ' ', sanitized).strip()
        return sanitized
    
    @staticmethod
    def validate_event_data(data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate event data and return sanitized version."""
        errors = []
        sanitized = {}
        
        # Required fields
        if not data.get('title'):
            errors.append("Title is required")
        else:
            title = DataValidator.sanitize_string(data['title'])
            if not DataValidator.validate_string_length(title, 1, 255):
                errors.append("Title must be between 1 and 255 characters")
            else:
                sanitized['title'] = title
        
        if not data.get('start_date'):
            errors.append("Start date is required")
        else:
            try:
                start_date = date.fromisoformat(data['start_date']) if isinstance(data['start_date'], str) else data['start_date']
                sanitized['start_date'] = start_date
            except (ValueError, TypeError):
                errors.append("Invalid start date format")
        
        # Optional fields
        if data.get('end_date'):
            try:
                end_date = date.fromisoformat(data['end_date']) if isinstance(data['end_date'], str) else data['end_date']
                if not DataValidator.validate_date_range(sanitized.get('start_date'), end_date):
                    errors.append("End date must be after or equal to start date")
                else:
                    sanitized['end_date'] = end_date
            except (ValueError, TypeError):
                errors.append("Invalid end date format")
        
        if data.get('start_time'):
            try:
                start_time = time.fromisoformat(data['start_time']) if isinstance(data['start_time'], str) else data['start_time']
                sanitized['start_time'] = start_time
            except (ValueError, TypeError):
                errors.append("Invalid start time format")
        
        if data.get('end_time'):
            try:
                end_time = time.fromisoformat(data['end_time']) if isinstance(data['end_time'], str) else data['end_time']
                # Check if we have both times and same date
                if sanitized.get('start_time') and sanitized.get('start_date') == sanitized.get('end_date'):
                    if not DataValidator.validate_time_range(sanitized['start_time'], end_time, True):
                        errors.append("End time must be after start time when on the same date")
                sanitized['end_time'] = end_time
            except (ValueError, TypeError):
                errors.append("Invalid end time format")
        
        # Email validation
        if data.get('email'):
            email = data['email'].strip()
            if not DataValidator.validate_email(email):
                errors.append("Invalid email format")
            else:
                sanitized['email'] = email
        
        # URL validation
        if data.get('website'):
            website = data['website'].strip()
            if not DataValidator.validate_url(website):
                errors.append("Invalid website URL")
            else:
                sanitized['website'] = website
        
        if data.get('registration_link'):
            reg_link = data['registration_link'].strip()
            if not DataValidator.validate_url(reg_link):
                errors.append("Invalid registration link URL")
            else:
                sanitized['registration_link'] = reg_link
        
        # Description
        if data.get('description'):
            description = DataValidator.sanitize_string(data['description'])
            sanitized['description'] = description
        
        # Cost
        if data.get('cost'):
            cost = DataValidator.sanitize_string(data['cost'])
            if not DataValidator.validate_string_length(cost, 0, 100):
                errors.append("Cost must be 100 characters or less")
            else:
                sanitized['cost'] = cost
        
        # Boolean fields
        sanitized['featured'] = bool(data.get('featured', False))
        sanitized['registration'] = bool(data.get('registration', False))
        sanitized['exclude_from_calendar'] = bool(data.get('exclude_from_calendar', False))
        
        # UUID fields
        for field in ['location_id', 'organization_id', 'primary_tag_id', 'secondary_tag_id', 'parent_event_id']:
            if data.get(field):
                if not DataValidator.validate_uuid(data[field]):
                    errors.append(f"Invalid {field} format")
                else:
                    sanitized[field] = data[field]
        
        if errors:
            raise ValidationError(f"Validation errors: {'; '.join(errors)}")
        
        return sanitized
    
    @staticmethod
    def validate_location_data(data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate location data and return sanitized version."""
        errors = []
        sanitized = {}
        
        # Required fields
        if not data.get('name'):
            errors.append("Location name is required")
        else:
            name = DataValidator.sanitize_string(data['name'])
            if not DataValidator.validate_string_length(name, 1, 255):
                errors.append("Location name must be between 1 and 255 characters")
            else:
                sanitized['name'] = name
        
        # Optional fields
        if data.get('address'):
            address = DataValidator.sanitize_string(data['address'])
            if not DataValidator.validate_string_length(address, 0, 500):
                errors.append("Address must be 500 characters or less")
            else:
                sanitized['address'] = address
        
        if data.get('website'):
            website = data['website'].strip()
            if not DataValidator.validate_url(website):
                errors.append("Invalid website URL")
            else:
                sanitized['website'] = website
        
        if data.get('phone'):
            phone = data['phone'].strip()
            if not DataValidator.validate_phone(phone):
                errors.append("Invalid phone number format")
            else:
                sanitized['phone'] = phone
        
        # Coordinates
        if data.get('latitude') is not None and data.get('longitude') is not None:
            try:
                lat = float(data['latitude'])
                lng = float(data['longitude'])
                if not DataValidator.validate_coordinates(lat, lng):
                    errors.append("Invalid coordinates")
                else:
                    sanitized['latitude'] = lat
                    sanitized['longitude'] = lng
            except (ValueError, TypeError):
                errors.append("Invalid coordinate format")
        
        # UUID fields
        if data.get('parent_location_id'):
            if not DataValidator.validate_uuid(data['parent_location_id']):
                errors.append("Invalid parent location ID format")
            else:
                sanitized['parent_location_id'] = data['parent_location_id']
        
        if errors:
            raise ValidationError(f"Validation errors: {'; '.join(errors)}")
        
        return sanitized
    
    @staticmethod
    def validate_organization_data(data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate organization data and return sanitized version."""
        errors = []
        sanitized = {}
        
        # Required fields
        if not data.get('name'):
            errors.append("Organization name is required")
        else:
            name = DataValidator.sanitize_string(data['name'])
            if not DataValidator.validate_string_length(name, 1, 255):
                errors.append("Organization name must be between 1 and 255 characters")
            else:
                sanitized['name'] = name
        
        # Optional fields
        if data.get('description'):
            description = DataValidator.sanitize_string(data['description'])
            if not DataValidator.validate_string_length(description, 0, 1000):
                errors.append("Description must be 1000 characters or less")
            else:
                sanitized['description'] = description
        
        if data.get('website'):
            website = data['website'].strip()
            if not DataValidator.validate_url(website):
                errors.append("Invalid website URL")
            else:
                sanitized['website'] = website
        
        if data.get('phone'):
            phone = data['phone'].strip()
            if not DataValidator.validate_phone(phone):
                errors.append("Invalid phone number format")
            else:
                sanitized['phone'] = phone
        
        if data.get('email'):
            email = data['email'].strip()
            if not DataValidator.validate_email(email):
                errors.append("Invalid email format")
            else:
                sanitized['email'] = email
        
        # UUID fields
        for field in ['location_id', 'parent_organization_id']:
            if data.get(field):
                if not DataValidator.validate_uuid(data[field]):
                    errors.append(f"Invalid {field} format")
                else:
                    sanitized[field] = data[field]
        
        if errors:
            raise ValidationError(f"Validation errors: {'; '.join(errors)}")
        
        return sanitized


class ModelValidator:
    """Pydantic model validation utilities."""
    
    @staticmethod
    def validate_event_model(data: Dict[str, Any]) -> Event:
        """Validate and create Event model."""
        try:
            return Event(**data)
        except ValidationError as e:
            raise ValidationError(f"Event validation failed: {e}")
    
    @staticmethod
    def validate_event_staged_model(data: Dict[str, Any]) -> EventStaged:
        """Validate and create EventStaged model."""
        try:
            return EventStaged(**data)
        except ValidationError as e:
            raise ValidationError(f"EventStaged validation failed: {e}")
    
    @staticmethod
    def validate_location_model(data: Dict[str, Any]) -> Location:
        """Validate and create Location model."""
        try:
            return Location(**data)
        except ValidationError as e:
            raise ValidationError(f"Location validation failed: {e}")
    
    @staticmethod
    def validate_organization_model(data: Dict[str, Any]) -> Organization:
        """Validate and create Organization model."""
        try:
            return Organization(**data)
        except ValidationError as e:
            raise ValidationError(f"Organization validation failed: {e}")
    
    @staticmethod
    def validate_tag_model(data: Dict[str, Any]) -> Tag:
        """Validate and create Tag model."""
        try:
            return Tag(**data)
        except ValidationError as e:
            raise ValidationError(f"Tag validation failed: {e}")
    
    @staticmethod
    def validate_announcement_model(data: Dict[str, Any]) -> Announcement:
        """Validate and create Announcement model."""
        try:
            return Announcement(**data)
        except ValidationError as e:
            raise ValidationError(f"Announcement validation failed: {e}")


# Convenience functions
def validate_event_submission(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate event submission data."""
    return DataValidator.validate_event_data(data)


def validate_location_submission(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate location submission data."""
    return DataValidator.validate_location_data(data)


def validate_organization_submission(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate organization submission data."""
    return DataValidator.validate_organization_data(data)


def sanitize_input(data: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize all string inputs in a data dictionary."""
    sanitized = {}
    for key, value in data.items():
        if isinstance(value, str):
            sanitized[key] = DataValidator.sanitize_string(value)
        else:
            sanitized[key] = value
    return sanitized 