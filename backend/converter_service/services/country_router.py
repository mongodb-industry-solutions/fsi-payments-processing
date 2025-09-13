"""
Country-based routing service for realistic multi-hop payment journeys.
Combines geographic routing with format conversions for 4-7+ hop scenarios.
"""

from typing import List, Dict, Optional, Tuple
from collections import deque
import logging
from datetime import datetime
from services.db_service import MongoDBService

logger = logging.getLogger(__name__)

class CountryRouter:
    """Routes payments through countries and correspondent banks"""
    
    def __init__(self, db_service: MongoDBService):
        self.db = db_service
        self.payment_networks = db_service.db.payment_networks
        self.payment_corridors = db_service.db.payment_corridors
        self.conversion_graph = db_service.db.conversion_graph
        
    def find_country_route(
        self,
        source_country: str,
        target_country: str,
        max_hops: int = 10
    ) -> Optional[List[str]]:
        """
        Find optimal country route using BFS on payment corridors
        
        Args:
            source_country: Starting country
            target_country: Destination country
            max_hops: Maximum number of country hops allowed
            
        Returns:
            List of countries in the route, or None if no route found
        """
        if source_country == target_country:
            return [source_country]
        
        # BFS to find shortest country path
        queue = deque([(source_country, [source_country])])
        visited = {source_country}
        
        while queue:
            current_country, path = queue.popleft()
            
            if len(path) > max_hops:
                continue
            
            # Find all corridors from current country
            corridors = self.payment_corridors.find({"source_country": current_country})
            
            for corridor in corridors:
                next_country = corridor["target_country"]
                
                if next_country == target_country:
                    return path + [next_country]
                
                if next_country not in visited:
                    visited.add(next_country)
                    queue.append((next_country, path + [next_country]))
        
        return None
    
    def get_format_sequence(
        self,
        country_route: List[str],
        initial_format: str,
        final_format: str
    ) -> List[Tuple[str, str, str]]:
        """
        Determine format conversions needed along country route
        
        Args:
            country_route: List of countries in the route
            initial_format: Starting payment format
            final_format: Target payment format
            
        Returns:
            List of (country, format, description) tuples
        """
        format_sequence = []
        current_format = initial_format
        
        for i, country in enumerate(country_route):
            # Get country's payment network info
            network = self.payment_networks.find_one({"_id": country})
            if not network:
                logger.warning(f"No network info for country: {country}")
                continue
            
            # First country - domestic processing
            if i == 0:
                format_sequence.append((
                    country,
                    current_format,
                    "Domestic initiation"
                ))
                
                # Convert to international format if not last country
                if i < len(country_route) - 1:
                    intl_format = network["typical_formats"].get("swift", "MT103")
                    if current_format != intl_format:
                        format_sequence.append((
                            country,
                            intl_format,
                            "Convert to international"
                        ))
                        current_format = intl_format
            
            # Intermediate countries - corridor processing
            elif i < len(country_route) - 1:
                # Check corridor requirements
                corridor = self.payment_corridors.find_one({
                    "source_country": country_route[i-1],
                    "target_country": country
                })
                
                if corridor and corridor.get("requires_conversion"):
                    # Need format conversion at this border
                    new_format = corridor.get("primary_format", current_format)
                    if new_format != current_format:
                        format_sequence.append((
                            country,
                            new_format,
                            f"Border conversion ({corridor['corridor_name']})"
                        ))
                        current_format = new_format
                else:
                    format_sequence.append((
                        country,
                        current_format,
                        f"Transit through {country}"
                    ))
                
                # Check if country is a gateway/hub
                if country in network.get("gateway_to", []):
                    # May need regional format
                    regional_format = network["typical_formats"].get("regional")
                    if regional_format and regional_format != current_format:
                        format_sequence.append((
                            country,
                            regional_format,
                            f"Gateway to {network['gateway_to'][0]}"
                        ))
                        current_format = regional_format
            
            # Last country - convert to final format
            else:
                if current_format != final_format:
                    # Convert to domestic format
                    domestic_format = network["typical_formats"].get("domestic", final_format)
                    if domestic_format != current_format:
                        format_sequence.append((
                            country,
                            domestic_format,
                            "Convert to domestic"
                        ))
                        current_format = domestic_format
                
                # Final settlement
                format_sequence.append((
                    country,
                    final_format,
                    "Local settlement"
                ))
        
        return format_sequence
    
    def calculate_route_metrics(
        self,
        country_route: List[str]
    ) -> Dict[str, any]:
        """
        Calculate total time, cost, and risk for a country route
        
        Args:
            country_route: List of countries in the route
            
        Returns:
            Dictionary with route metrics
        """
        total_time_hours = 0
        total_cost_usd = 0
        total_conversions = 0
        risk_score = 0
        
        for i in range(len(country_route) - 1):
            corridor = self.payment_corridors.find_one({
                "source_country": country_route[i],
                "target_country": country_route[i + 1]
            })
            
            if corridor:
                total_time_hours += corridor.get("typical_time_hours", 4)
                total_cost_usd += corridor.get("cost_usd", 30)
                if corridor.get("requires_conversion"):
                    total_conversions += 1
                
                # Risk factors
                if "ALTERNATIVE" in corridor.get("corridor_type", ""):
                    risk_score += 2  # Alternative routes have higher risk
                if corridor.get("typical_time_hours", 0) > 12:
                    risk_score += 1  # Long corridors have higher risk
        
        return {
            "total_countries": len(country_route),
            "total_time_hours": total_time_hours,
            "total_cost_usd": total_cost_usd,
            "total_conversions": total_conversions,
            "risk_score": risk_score,
            "complexity": self._calculate_complexity(len(country_route), total_conversions)
        }
    
    def _calculate_complexity(self, num_countries: int, num_conversions: int) -> str:
        """Calculate route complexity based on countries and conversions"""
        total_hops = num_countries + num_conversions
        
        if total_hops <= 3:
            return "simple"
        elif total_hops <= 5:
            return "medium"
        else:
            return "complex"
    
    def find_multi_hop_route(
        self,
        source_country: str,
        source_format: str,
        target_country: str,
        target_format: str,
        optimize_for: str = "speed"  # speed, cost, or reliability
    ) -> Optional[Dict[str, any]]:
        """
        Find complete multi-hop route with countries and format conversions
        
        Args:
            source_country: Starting country
            source_format: Starting payment format
            target_country: Destination country
            target_format: Target payment format
            optimize_for: Optimization criteria
            
        Returns:
            Complete route information or None if no route found
        """
        # Find country route
        country_route = self.find_country_route(source_country, target_country)
        if not country_route:
            logger.warning(f"No country route found: {source_country} → {target_country}")
            return None
        
        # Determine format conversions
        format_sequence = self.get_format_sequence(
            country_route,
            source_format,
            target_format
        )
        
        # Calculate metrics
        metrics = self.calculate_route_metrics(country_route)
        
        # Build complete route
        route_info = {
            "source": {
                "country": source_country,
                "format": source_format
            },
            "destination": {
                "country": target_country,
                "format": target_format
            },
            "country_route": country_route,
            "format_sequence": format_sequence,
            "metrics": metrics,
            "total_hops": len(format_sequence),
            "route_type": "multi_hop" if len(format_sequence) > 3 else "direct",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return route_info
    
    def get_alternative_routes(
        self,
        source_country: str,
        target_country: str,
        max_routes: int = 3
    ) -> List[List[str]]:
        """
        Find alternative country routes for resilience
        
        Args:
            source_country: Starting country
            target_country: Destination country
            max_routes: Maximum number of alternative routes
            
        Returns:
            List of alternative country routes
        """
        routes = []
        visited_paths = set()
        
        # Modified BFS to find multiple paths
        queue = deque([(source_country, [source_country], set([source_country]))])
        
        while queue and len(routes) < max_routes:
            current_country, path, visited = queue.popleft()
            
            if len(path) > 10:  # Max depth
                continue
            
            corridors = self.payment_corridors.find({"source_country": current_country})
            
            for corridor in corridors:
                next_country = corridor["target_country"]
                
                if next_country == target_country:
                    route = path + [next_country]
                    route_key = "->".join(route)
                    if route_key not in visited_paths:
                        routes.append(route)
                        visited_paths.add(route_key)
                
                elif next_country not in visited:
                    new_visited = visited.copy()
                    new_visited.add(next_country)
                    queue.append((next_country, path + [next_country], new_visited))
        
        return routes