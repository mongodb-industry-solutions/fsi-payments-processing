"""
MongoDB caching layer for frequently accessed collections.

This is Step 3.2 of the MongoDB Optimization Plan.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta, UTC
import logging
from functools import lru_cache
import hashlib
import json

logger = logging.getLogger(__name__)


class MongoDBCache:
    """In-memory cache for MongoDB collections to reduce database calls"""
    
    def __init__(self, ttl_seconds: int = 300):  # 5 minute TTL by default
        self.ttl = timedelta(seconds=ttl_seconds)
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._formats_cache: Optional[List[Dict]] = None
        self._formats_cache_time: Optional[datetime] = None
        self._conversion_configs_cache: Dict[str, Any] = {}
        self._conversion_configs_cache_time: Dict[str, datetime] = {}
        
    def _is_expired(self, cache_time: Optional[datetime]) -> bool:
        """Check if cache entry has expired"""
        if cache_time is None:
            return True
        return datetime.now(UTC) - cache_time > self.ttl
    
    def _make_key(self, collection: str, query: Dict) -> str:
        """Create a cache key from collection and query"""
        query_str = json.dumps(query, sort_keys=True)
        return f"{collection}:{hashlib.md5(query_str.encode()).hexdigest()}"
    
    def get_formats(self, db_connector) -> List[Dict]:
        """Get all formats with caching"""
        if self._formats_cache is not None and not self._is_expired(self._formats_cache_time):
            logger.debug("Cache hit: formats collection")
            return self._formats_cache
        
        logger.debug("Cache miss: formats collection - loading from MongoDB")
        formats = db_connector.find("formats", {"is_active": True})
        self._formats_cache = formats
        self._formats_cache_time = datetime.now(UTC)
        return formats
    
    def get_format(self, db_connector, format_code: str, format_type: str) -> Optional[Dict]:
        """Get a specific format with caching"""
        cache_key = f"format:{format_code}:{format_type}"
        
        if cache_key in self._cache:
            entry = self._cache[cache_key]
            if not self._is_expired(entry["time"]):
                logger.debug(f"Cache hit: format {format_code} ({format_type})")
                return entry["data"]
        
        logger.debug(f"Cache miss: format {format_code} ({format_type}) - loading from MongoDB")
        formats = db_connector.find("formats", {
            "format_code": format_code,
            "type": format_type,
            "is_active": True
        })
        
        result = formats[0] if formats else None
        self._cache[cache_key] = {
            "data": result,
            "time": datetime.now(UTC)
        }
        return result
    
    def get_conversion_config(self, db_connector, source_format: str, target_format: str) -> Optional[Dict]:
        """Get conversion config with caching"""
        cache_key = f"{source_format}->{target_format}"
        
        if cache_key in self._conversion_configs_cache:
            if not self._is_expired(self._conversion_configs_cache_time.get(cache_key)):
                logger.debug(f"Cache hit: conversion config {cache_key}")
                return self._conversion_configs_cache[cache_key]
        
        logger.debug(f"Cache miss: conversion config {cache_key} - loading from MongoDB")
        configs = db_connector.find("conversion_configs", {
            "source_format": source_format,
            "target_format": target_format,
            "is_active": True
        })
        
        result = configs[0] if configs else None
        self._conversion_configs_cache[cache_key] = result
        self._conversion_configs_cache_time[cache_key] = datetime.now(UTC)
        return result
    
    def get_format_processor(self, db_connector, format_code: str, processor_type: str) -> Optional[Dict]:
        """Get format processor config with caching"""
        cache_key = f"processor:{format_code}:{processor_type}"
        
        if cache_key in self._cache:
            entry = self._cache[cache_key]
            if not self._is_expired(entry["time"]):
                logger.debug(f"Cache hit: processor {format_code} ({processor_type})")
                return entry["data"]
        
        logger.debug(f"Cache miss: processor {format_code} ({processor_type}) - loading from MongoDB")
        processors = db_connector.find("format_processors", {
            "format": format_code,
            "type": processor_type
        })
        
        result = processors[0] if processors else None
        self._cache[cache_key] = {
            "data": result,
            "time": datetime.now(UTC)
        }
        return result
    
    def invalidate(self, pattern: Optional[str] = None):
        """Invalidate cache entries matching pattern or all entries"""
        if pattern is None:
            # Clear all caches
            self._cache.clear()
            self._formats_cache = None
            self._formats_cache_time = None
            self._conversion_configs_cache.clear()
            self._conversion_configs_cache_time.clear()
            logger.info("Cache fully invalidated")
        else:
            # Clear specific patterns
            if pattern == "formats":
                self._formats_cache = None
                self._formats_cache_time = None
                # Also clear individual format entries
                keys_to_remove = [k for k in self._cache.keys() if k.startswith("format:")]
                for key in keys_to_remove:
                    del self._cache[key]
                logger.info("Formats cache invalidated")
            elif pattern == "conversion_configs":
                self._conversion_configs_cache.clear()
                self._conversion_configs_cache_time.clear()
                logger.info("Conversion configs cache invalidated")
            elif pattern == "processors":
                keys_to_remove = [k for k in self._cache.keys() if k.startswith("processor:")]
                for key in keys_to_remove:
                    del self._cache[key]
                logger.info("Processors cache invalidated")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        return {
            "total_entries": len(self._cache) + len(self._conversion_configs_cache) + (1 if self._formats_cache else 0),
            "formats_cached": self._formats_cache is not None,
            "conversion_configs_cached": len(self._conversion_configs_cache),
            "other_cached": len(self._cache),
            "ttl_seconds": self.ttl.total_seconds()
        }


# Global cache instance
_cache_instance: Optional[MongoDBCache] = None


def get_cache() -> MongoDBCache:
    """Get or create the global cache instance"""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = MongoDBCache()
    return _cache_instance


def invalidate_cache(pattern: Optional[str] = None):
    """Invalidate the global cache"""
    cache = get_cache()
    cache.invalidate(pattern)