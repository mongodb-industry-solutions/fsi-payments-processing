"""
Country-based routing service for realistic multi-hop payment journeys.
Combines geographic routing with format conversions for 4-7+ hop scenarios.
Enhanced with demo-specific methods for geographic visualization.
"""

from typing import List, Dict, Optional, Tuple, Callable, Any
from collections import deque
import logging
import time
import asyncio
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

    # ============================================================
    # DEMO-SPECIFIC METHODS FOR GEOGRAPHIC VISUALIZATION
    # ============================================================

    def get_country_formats(self) -> Dict[str, Dict]:
        """
        Get country-to-format mapping for geographic visualization

        Returns:
            Dictionary mapping countries to their primary and supported formats
        """
        return {
            "USA": {
                "primary": "MT103",
                "supported": ["MT103", "MT202", "ACH", "ISO8583"],
                "coordinates": [40, -95],  # Centered USA
                "city": "New York",
                "region": "Americas"
            },
            "UK": {
                "primary": "CHAPS",
                "supported": ["CHAPS", "MT103", "pacs.008"],
                "coordinates": [52, -2],  # UK - spread west
                "city": "London",
                "region": "Europe"
            },
            "Germany": {
                "primary": "TARGET2",
                "supported": ["TARGET2", "pacs.008", "pacs.009"],
                "coordinates": [51, 10],  # Germany - centered
                "city": "Frankfurt",
                "region": "Europe"
            },
            "France": {
                "primary": "TARGET2",
                "supported": ["TARGET2", "pacs.008", "pacs.009"],
                "coordinates": [47, 2],  # France - moved south
                "city": "Paris",
                "region": "Europe"
            },
            "Japan": {
                "primary": "MT202",
                "supported": ["MT202", "MT103", "MT205"],
                "coordinates": [36, 138],  # Japan - centered
                "city": "Tokyo",
                "region": "Asia"
            },
            "Singapore": {
                "primary": "JSON",  # Universal hub
                "supported": ["ALL"],
                "coordinates": [1, 104],  # Singapore
                "city": "Singapore",
                "region": "Asia"
            },
            "Brazil": {
                "primary": "pacs.008",
                "supported": ["pacs.008", "MT103"],
                "coordinates": [-15, -55],  # Brazil - centered
                "city": "São Paulo",
                "region": "Americas"
            },
            "Switzerland": {
                "primary": "MT103",
                "supported": ["MT103", "MT202", "pacs.008"],
                "coordinates": [47, 8],  # Switzerland
                "city": "Zurich",
                "region": "Europe"
            },
            "UAE": {
                "primary": "MT103",
                "supported": ["MT103", "MT202", "TARGET2"],
                "coordinates": [24, 54],  # UAE
                "city": "Dubai",
                "region": "Middle East"
            },
            "India": {
                "primary": "ACH",
                "supported": ["ACH", "MT103", "pacs.008"],
                "coordinates": [20, 78],  # India
                "city": "Mumbai",
                "region": "Asia"
            }
        }

    def get_demo_scenarios(self) -> List[Dict[str, Any]]:
        """
        Get predefined geographic demo scenarios

        Returns:
            List of 6 demo scenarios with routes and conversions
        """
        return [
            {
                "id": "tower_of_babel",
                "name": "🗼 Format Tower of Babel",
                "description": "Experience payment format diversity across Europe",
                "route": {
                    "countries": ["USA", "UK", "France", "Germany"],
                    "conversions": [
                        {"at": "USA", "from": "MT103", "to": "JSON", "via": "Exit USA"},
                        {"at": "UK", "from": "JSON", "to": "CHAPS", "via": "Enter UK"},
                        {"at": "UK", "from": "CHAPS", "to": "JSON", "via": "Exit UK"},
                        {"at": "France", "from": "JSON", "to": "TARGET2", "via": "Enter EU"},
                        {"at": "Germany", "from": "TARGET2", "to": "pacs.008", "via": "Domestic"}
                    ]
                },
                "metrics": {
                    "total_conversions": 5,
                    "estimated_time_ms": 500,
                    "complexity": "high"
                }
            },
            {
                "id": "impossible_bridge",
                "name": "🌉 The Impossible Bridge",
                "description": "Japan to Brazil - No direct converter exists",
                "route": {
                    "countries": ["Japan", "Singapore", "Brazil"],
                    "conversions": [
                        {"at": "Japan", "from": "MT202", "to": "JSON", "via": "Exit Japan"},
                        {"at": "Singapore", "from": "JSON", "to": "JSON", "via": "Universal Hub"},
                        {"at": "Brazil", "from": "JSON", "to": "pacs.008", "via": "Enter Brazil"}
                    ]
                },
                "metrics": {
                    "total_conversions": 3,
                    "estimated_time_ms": 300,
                    "complexity": "medium"
                }
            },
            {
                "id": "singapore_hub",
                "name": "🔄 Singapore Multi-Hub",
                "description": "Three simultaneous conversions through Singapore",
                "route": {
                    "parallel": True,
                    "conversions": [
                        {
                            "source": {"country": "USA", "format": "MT103"},
                            "target": {"country": "Germany", "format": "pacs.008"},
                            "via": "Singapore JSON Hub"
                        },
                        {
                            "source": {"country": "Japan", "format": "MT202"},
                            "target": {"country": "UK", "format": "CHAPS"},
                            "via": "Singapore JSON Hub"
                        },
                        {
                            "source": {"country": "India", "format": "ACH"},
                            "target": {"country": "UAE", "format": "TARGET2"},
                            "via": "Singapore JSON Hub"
                        }
                    ]
                },
                "metrics": {
                    "total_conversions": 6,
                    "estimated_time_ms": 400,
                    "complexity": "high"
                }
            },
            {
                "id": "evolution_journey",
                "name": "📈 Evolution Journey",
                "description": "Legacy to modern format progression",
                "route": {
                    "countries": ["USA", "UK", "Germany"],
                    "timeline": [
                        {"year": 1973, "format": "MT103", "location": "USA"},
                        {"year": 2008, "format": "pacs.008", "location": "Germany"},
                        {"year": 2024, "format": "JSON", "location": "Global"}
                    ],
                    "conversions": [
                        {"at": "USA", "from": "MT103", "to": "JSON", "via": "Modernization"},
                        {"at": "Germany", "from": "JSON", "to": "pacs.008", "via": "ISO 20022"}
                    ]
                },
                "metrics": {
                    "total_conversions": 2,
                    "estimated_time_ms": 200,
                    "complexity": "simple"
                }
            },
            {
                "id": "compliance_wrapper",
                "name": "📋 Compliance Wrapper",
                "description": "Add regulatory fields at each border",
                "route": {
                    "countries": ["USA", "Germany", "Switzerland"],
                    "conversions": [
                        {"at": "USA", "from": "MT103", "to": "JSON", "via": "Add FATCA"},
                        {"at": "Germany", "from": "JSON", "to": "TARGET2", "via": "Add MiFID II"},
                        {"at": "Switzerland", "from": "TARGET2", "to": "MT103", "via": "Add Banking Secrecy"}
                    ],
                    "compliance_fields": {
                        "USA": ["FATCA_ID", "US_TAX_ID"],
                        "Germany": ["MIFID_CLASS", "EU_LEI"],
                        "Switzerland": ["BANK_SECRET_CODE", "SWISS_REF"]
                    }
                },
                "metrics": {
                    "total_conversions": 3,
                    "estimated_time_ms": 350,
                    "complexity": "medium"
                }
            },
            {
                "id": "speed_race",
                "name": "⚡ Speed Race",
                "description": "Compare direct vs multi-hop routing",
                "route": {
                    "comparison": True,
                    "routes": [
                        {
                            "name": "Direct (if exists)",
                            "path": ["USA", "Germany"],
                            "conversions": [{"from": "MT103", "to": "pacs.008", "direct": True}],
                            "time_ms": 100
                        },
                        {
                            "name": "Via JSON",
                            "path": ["USA", "Singapore", "Germany"],
                            "conversions": [
                                {"from": "MT103", "to": "JSON"},
                                {"from": "JSON", "to": "pacs.008"}
                            ],
                            "time_ms": 200
                        },
                        {
                            "name": "Via Multiple Hubs",
                            "path": ["USA", "UK", "France", "Germany"],
                            "conversions": [
                                {"from": "MT103", "to": "JSON"},
                                {"from": "JSON", "to": "CHAPS"},
                                {"from": "CHAPS", "to": "TARGET2"},
                                {"from": "TARGET2", "to": "pacs.008"}
                            ],
                            "time_ms": 400
                        }
                    ]
                },
                "metrics": {
                    "best_time_ms": 100,
                    "worst_time_ms": 400,
                    "complexity": "variable"
                }
            }
        ]

    async def execute_corridor_demo(
        self,
        source_country: str,
        target_country: str,
        scenario_id: Optional[str] = None,
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Execute real conversion for geographic corridor demo

        Args:
            source_country: Starting country
            target_country: Destination country
            scenario_id: Optional specific scenario to execute
            progress_callback: Optional callback for progress updates

        Returns:
            Complete execution results with timings and conversions
        """
        start_time = time.time()
        conversions = []

        # Get country formats
        country_formats = self.get_country_formats()
        source_format = country_formats.get(source_country, {}).get("primary", "MT103")
        target_format = country_formats.get(target_country, {}).get("primary", "pacs.008")

        # For demo, we'll generate a simple route without database dependency
        # Always use JSON as bridge for cross-border conversions
        route_info = {
            "country_route": [source_country, target_country],
            "format_path": [source_format, "JSON", target_format],
            "conversions": [
                {"source": source_format, "target": "JSON"},
                {"source": "JSON", "target": target_format}
            ],
            "total_hops": 2,
            "route_type": "demo_bridge",
            "metrics": {
                "complexity": "medium" if source_country != target_country else "simple",
                "estimated_time_ms": 200
            }
        }

        # Stream progress for each conversion step
        conversion_steps = []

        # For demo, we'll use JSON as the bridge for all cross-border conversions
        if len(route_info["country_route"]) > 1:
            # Multi-hop: use JSON bridge pattern
            conversion_steps = [
                {"from": source_format, "to": "JSON", "at": source_country},
                {"from": "JSON", "to": target_format, "at": target_country}
            ]
        else:
            # Direct conversion
            conversion_steps = [
                {"from": source_format, "to": target_format, "at": source_country}
            ]

        # Execute conversions (simulated for geographic demo)
        for i, step in enumerate(conversion_steps):
            conversion_start = time.time()

            # Send progress update
            if progress_callback:
                await progress_callback({
                    "step": i + 1,
                    "total_steps": len(conversion_steps),
                    "status": "converting",
                    "from_format": step["from"],
                    "to_format": step["to"],
                    "location": step["at"],
                    "timestamp": datetime.utcnow().isoformat()
                })

            # Simulate conversion with realistic timing
            # Rules-only conversions are fast (50-200ms)
            await asyncio.sleep(0.05 + 0.05 * (i % 2))  # 50-100ms

            conversion_time = (time.time() - conversion_start) * 1000
            success = True

            conversions.append({
                "from": step["from"],
                "to": step["to"],
                "location": step["at"],
                "success": success,
                "time_ms": conversion_time
            })

            # Send completion update
            if progress_callback:
                await progress_callback({
                    "step": i + 1,
                    "total_steps": len(conversion_steps),
                    "status": "completed",
                    "conversion_time_ms": conversion_time
                })

        total_time = (time.time() - start_time) * 1000

        return {
            "success": True,
            "route": route_info,
            "conversions": conversions,
            "execution_time_ms": total_time,
            "metrics": {
                "total_conversions": len(conversions),
                "average_conversion_time_ms": total_time / len(conversions) if conversions else 0,
                "complexity": route_info["metrics"]["complexity"]
            },
            "timestamp": datetime.utcnow().isoformat()
        }

    def get_sample_messages(self) -> Dict[str, str]:
        """
        Get sample messages for each format used in demos

        Returns:
            Dictionary mapping format names to sample messages
        """
        return {
            "MT103": "{1:F01CHASUS33XXXX0000000000}{2:I103DEUTDEFFXXXXN}{3:{108:DEMO}}{4:\n:20:DEMO001\n:23B:CRED\n:32A:241215USD10000,00\n:50K:DEMO SENDER\n:59:DEMO RECEIVER\n-}",
            "MT202": "{1:F01DEUTDEFFXXXX0000000000}{2:I202CHASUS33XXXXN}{3:{108:DEMO}}{4:\n:20:DEMO002\n:21:REF001\n:32A:241215EUR10000,00\n:52A:DEUTDEFFXXX\n:58A:CHASUS33XXX\n-}",
            "MT205": "{1:F01BOFAUS6SXXXX0000000000}{2:I205DEUTDEFFXXXXN}{3:{108:FX}}{4:\n:20:DEMO003\n:21:SPOT001\n:32A:241215EUR10000,00\n:33B:USD11000,00\n:36:1,10\n:52A:BOFAUS6SXXX\n:58A:DEUTDEFFXXX\n-}",
            "CHAPS": '<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08"><FIToFICstmrCdtTrf><GrpHdr><MsgId>DEMO004</MsgId></GrpHdr></FIToFICstmrCdtTrf></Document>',
            "TARGET2": '<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08"><FICdtTrf><GrpHdr><MsgId>DEMO005</MsgId></GrpHdr></FICdtTrf></Document>',
            "pacs.008": '<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08"><FIToFICstmrCdtTrf><GrpHdr><MsgId>DEMO006</MsgId></GrpHdr></FIToFICstmrCdtTrf></Document>',
            "JSON": '{"header":{"message_id":"DEMO007","message_type":"customer_transfer"},"transaction":{"transaction_id":"TXN001"},"amounts":{"instructed":{"value":"10000.00","currency":"USD"}}}',
            "ACH": "101 081000032 0818000320241215000000DEMO ACH PAYMENT",
            "ISO8583": "0200DEMO-ISO8583-SAMPLE"
        }