"""
ConversionRouter: Intelligent routing service for payment format conversions.
Simplified implementation without caching.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

# Fix import issues - avoid circular imports
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from services.db_service import MongoDBService
# Import UniversalConverter only when needed to avoid circular imports

logger = logging.getLogger(__name__)


class ConversionRouter:
    """
    Intelligent routing service for payment format conversions.
    Finds optimal paths through available conversions using BFS.
    """

    def __init__(self, db_service: MongoDBService):
        """Initialize with database service"""
        self.db_service = db_service
        # Access MongoDB collections through db_service.db (which is the database object)
        self.graph_collection = db_service.db['conversion_graph'] if db_service.db is not None else None
        self.registry = db_service.db['conversion_registry'] if db_service.db is not None else None

    def convert(self, source_format: str, target_format: str,
                message: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Main entry point for routed conversion.

        Args:
            source_format: Source payment format (e.g., "MT103")
            target_format: Target payment format (e.g., "pacs.008")
            message: The message to convert
            options: Optional routing options (for future use)

        Returns:
            Conversion result with success status and converted message
        """
        options = options or {}
        start_time = datetime.utcnow()

        try:
            # Try to find a path (direct or multi-hop)
            path = self.find_optimal_path(source_format, target_format, options)

            if not path:
                return {
                    'success': False,
                    'error': f'No conversion path found from {source_format} to {target_format}',
                    'metadata': {
                        'source_format': source_format,
                        'target_format': target_format,
                        'conversion_id': f"{source_format}_to_{target_format}",
                        'start_time': start_time.isoformat(),
                        'end_time': datetime.utcnow().isoformat(),
                        'processing_time_seconds': (datetime.utcnow() - start_time).total_seconds(),
                        'status': 'failed',
                        'routing': {
                            'method': 'none',
                            'attempted_path': f"{source_format} → {target_format}",
                            'error': 'No path exists'
                        }
                    }
                }

            # Execute the path (single or multi-hop)
            result = self.execute_path(path, message)

            # Add routing time if not already present
            if result.get('success') and 'metadata' in result:
                if 'routing' in result['metadata']:
                    result['metadata']['routing']['routing_time_ms'] = int(
                        (datetime.utcnow() - start_time).total_seconds() * 1000
                    )

            return result

        except Exception as e:
            logger.error(f"Routing conversion failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'metadata': {
                    'source_format': source_format,
                    'target_format': target_format,
                    'conversion_id': f"{source_format}_to_{target_format}",
                    'start_time': start_time.isoformat(),
                    'end_time': datetime.utcnow().isoformat(),
                    'processing_time_seconds': (datetime.utcnow() - start_time).total_seconds(),
                    'status': 'failed',
                    'routing': {
                        'method': 'direct',
                        'attempted_path': f"{source_format} → {target_format}",
                        'error': 'No valid path found or conversion failed'
                    }
                }
            }

    def find_optimal_path(self, source: str, target: str,
                         options: Dict[str, Any] = None) -> Optional[List[Dict]]:
        """
        Find the optimal conversion path based on options.

        Args:
            source: Source format
            target: Target format
            options: Routing options (optimize_for: 'speed', 'cost', 'geography')

        Returns:
            List of conversion steps, or None if no path exists
        """
        options = options or {}

        # Try direct path first (most efficient)
        direct_path = self._find_direct_path(source, target)
        if direct_path:
            logger.info(f"Found direct path: {source} → {target}")
            return direct_path

        # Find multi-hop path using BFS
        logger.info(f"No direct path found, searching for multi-hop: {source} → {target}")
        shortest_path = self._find_shortest_path(source, target)

        if shortest_path:
            logger.info(f"Found {len(shortest_path)}-hop path: {source} → {target}")
            return shortest_path

        logger.warning(f"No path found from {source} to {target}")
        return None

    def _find_direct_path(self, source: str, target: str) -> Optional[List[Dict]]:
        """
        Check if direct conversion exists.

        Args:
            source: Source format
            target: Target format

        Returns:
            Single-step path if direct conversion exists, None otherwise
        """
        # Check conversion_graph for edge
        edge = self.graph_collection.find_one({
            'source': source,
            'target': target,
            'active': True
        })

        if edge:
            # Use metadata from graph if available
            metadata = edge.get('metadata', {})
            return [{
                'step': 1,
                'from': source,
                'to': target,
                'conversion_id': edge.get('conversion_id', f"{source}_to_{target}"),
                'estimated_ms': metadata.get('latency_ms', 200),
                'cost': metadata.get('cost', 0.01),
                'reliability': metadata.get('reliability', 0.99)
            }]

        # Fallback: Check if configuration exists in registry
        conversion_id = f"{source}_to_{target}"
        config = self.registry.find_one({'_id': conversion_id})

        if config:
            return [{
                'step': 1,
                'from': source,
                'to': target,
                'conversion_id': conversion_id,
                'estimated_ms': 200,
                'cost': 0.01,
                'reliability': 0.99
            }]

        return None

    def validate_path(self, path: List[Dict]) -> bool:
        """
        Ensure all conversions in path exist.

        Args:
            path: List of conversion steps

        Returns:
            True if all conversions in path are valid
        """
        for step in path:
            conversion_id = step.get('conversion_id')
            if not conversion_id:
                return False

            # Check if conversion exists in registry
            config = self.registry.find_one({'_id': conversion_id})
            if not config:
                logger.warning(f"Conversion {conversion_id} not found in registry")
                return False

        return True

    def execute_path(self, path: List[Dict], message: str) -> Dict[str, Any]:
        """
        Execute conversions in sequence.

        Args:
            path: List of conversion steps to execute
            message: Initial message to convert

        Returns:
            Final conversion result after all steps
        """
        if not path:
            return {
                'success': False,
                'error': 'No path provided'
            }

        # Track execution details
        start_time = datetime.utcnow()
        execution_log = []
        current_message = message
        total_cost = 0
        total_latency = 0

        # Execute each step in the path
        for i, step in enumerate(path, 1):
            step_start = datetime.utcnow()

            logger.info(f"Executing step {i}/{len(path)}: {step['from']} → {step['to']}")

            try:
                # Import here to avoid circular import
                from ..core.converter import UniversalConverter

                # Create converter for this step
                converter = UniversalConverter(
                    db_connector=self.db_service,
                    source_format=step['from'],
                    target_format=step['to']
                )

                # Execute conversion
                result = converter.convert(current_message)

                if not result.get('success'):
                    # Step failed - return error with details
                    return {
                        'success': False,
                        'error': f"Failed at step {i}: {step['from']} → {step['to']}",
                        'error_detail': result.get('error'),
                        'execution_log': execution_log,
                        'metadata': {
                            'source_format': path[0]['from'],
                            'target_format': path[-1]['to'],
                            'conversion_id': f"{path[0]['from']}_to_{path[-1]['to']}_via_routing",
                            'start_time': start_time.isoformat(),
                            'end_time': datetime.utcnow().isoformat(),
                            'processing_time_seconds': (datetime.utcnow() - start_time).total_seconds(),
                            'status': 'failed',
                            'routing': {
                                'method': 'direct' if len(path) == 1 else 'multi-hop',
                                'path': path,
                                'failed_at_step': i,
                                'hop_count': len(path)
                            }
                        }
                    }

                # Step succeeded - update for next iteration
                current_message = result['converted_message']
                step_time = (datetime.utcnow() - step_start).total_seconds() * 1000

                # Track execution details with processing stats
                # Extract stats from metadata if not at top level
                proc_stats = result.get('processing_stats') or result.get('metadata', {}).get('processing_stats', {})
                conf_scores = result.get('confidence_scores') or result.get('metadata', {}).get('confidence_scores', {})
                human_review = result.get('human_review_required') or result.get('metadata', {}).get('human_review_required', False)

                execution_log.append({
                    'step': i,
                    'from': step['from'],
                    'to': step['to'],
                    'success': True,
                    'execution_time_ms': step_time,
                    'message_size': len(current_message),
                    'processing_stats': proc_stats,
                    'confidence_scores': conf_scores,
                    'human_review_required': human_review
                })

                total_cost += step.get('cost', 0.01)
                total_latency += step_time

            except Exception as e:
                logger.error(f"Error in step {i}: {e}")
                return {
                    'success': False,
                    'error': f"Exception at step {i}: {step['from']} → {step['to']}",
                    'error_detail': str(e),
                    'execution_log': execution_log,
                    'metadata': {
                        'source_format': path[0]['from'],
                        'target_format': path[-1]['to'],
                        'conversion_id': f"{path[0]['from']}_to_{path[-1]['to']}_via_routing",
                        'start_time': start_time.isoformat(),
                        'end_time': datetime.utcnow().isoformat(),
                        'processing_time_seconds': (datetime.utcnow() - start_time).total_seconds(),
                        'status': 'failed',
                        'routing': {
                            'method': 'direct' if len(path) == 1 else 'multi-hop',
                            'path': path,
                            'failed_at_step': i,
                            'hop_count': len(path)
                        }
                    }
                }

        # All steps succeeded
        total_time = (datetime.utcnow() - start_time).total_seconds()

        # Determine routing method based on hop count
        routing_method = 'direct' if len(path) == 1 else 'multi-hop'

        # Aggregate processing stats from all steps
        aggregated_stats = {
            'rules_lane': {'count': 0, 'fields': []},
            'ai_lane': {'count': 0, 'fields': []},
            'human_lane': {'count': 0, 'fields': []}
        }
        aggregated_confidence = {}
        any_human_review = False

        for log_entry in execution_log:
            stats = log_entry.get('processing_stats', {})
            if stats:
                for lane in ['rules_lane', 'ai_lane', 'human_lane']:
                    if lane in stats:
                        if isinstance(stats[lane], dict):
                            aggregated_stats[lane]['count'] += stats[lane].get('count', 0)
                            aggregated_stats[lane]['fields'].extend(stats[lane].get('fields', []))
                        elif isinstance(stats[lane], (int, float)):
                            aggregated_stats[lane]['count'] += stats[lane]

            # Aggregate confidence scores
            for field, score in log_entry.get('confidence_scores', {}).items():
                aggregated_confidence[field] = score

            # Check if any step required human review
            if log_entry.get('human_review_required'):
                any_human_review = True

        return {
            'success': True,
            'converted_message': current_message,
            'processing_stats': aggregated_stats,
            'confidence_scores': aggregated_confidence,
            'human_review_required': any_human_review,
            'processing_time_seconds': total_time,
            'metadata': {
                'routing': {
                    'method': routing_method,
                    'path': path,
                    'hop_count': len(path),
                    'execution_log': execution_log,
                    'total_cost': total_cost,
                    'total_latency_ms': total_latency,
                    'total_time_seconds': total_time
                },
                # Add required fields for ConversionMetadata
                'source_format': path[0]['from'],
                'target_format': path[-1]['to'],
                'conversion_id': f"{path[0]['from']}_to_{path[-1]['to']}_via_routing",
                'start_time': start_time.isoformat(),
                'end_time': datetime.utcnow().isoformat(),
                'processing_time_seconds': total_time,
                'status': 'completed'
            }
        }

    def _find_shortest_path(self, source: str, target: str, max_depth: int = 5) -> Optional[List[Dict]]:
        """
        Find shortest path using BFS (Breadth-First Search).

        Args:
            source: Source format
            target: Target format
            max_depth: Maximum number of hops to search

        Returns:
            Shortest path as list of steps, or None if no path found
        """
        # Use BFS to find shortest path
        from collections import deque

        # Queue contains: (current_node, path_so_far)
        queue = deque([(source, [])])
        visited = set()

        while queue:
            current, path_so_far = queue.popleft()

            if current in visited:
                continue
            visited.add(current)

            # Check if we've exceeded max depth
            if len(path_so_far) >= max_depth:
                continue

            # Find all edges from current node
            edges = list(self.graph_collection.find({
                'source': current,
                'active': True
            }))

            for edge in edges:
                next_node = edge['target']

                # Build the step
                step_num = len(path_so_far) + 1
                step = {
                    'step': step_num,
                    'from': current,
                    'to': next_node,
                    'conversion_id': edge.get('conversion_id', f"{current}_to_{next_node}"),
                    'estimated_ms': edge.get('metadata', {}).get('latency_ms', 200),
                    'cost': edge.get('metadata', {}).get('cost', 0.01),
                    'reliability': edge.get('metadata', {}).get('reliability', 0.99)
                }

                new_path = path_so_far + [step]

                # Check if we reached the target
                if next_node == target:
                    logger.info(f"Found {len(new_path)}-hop path: {source} → {target}")
                    return new_path

                # Add to queue for further exploration
                if next_node not in visited:
                    queue.append((next_node, new_path))

        # No path found
        return None

    def _find_all_paths(self, source: str, target: str, max_depth: int = 3) -> List[List[Dict]]:
        """
        Find all possible paths between source and target.
        For testing and analysis purposes.

        Args:
            source: Source format
            target: Target format
            max_depth: Maximum path length

        Returns:
            List of all possible paths
        """
        # Simple BFS implementation for finding all paths
        all_paths = []
        queue = [[(source, [])]]  # (current_node, path_so_far)

        while queue:
            current_path = queue.pop(0)
            current_node = current_path[-1][0]

            if len(current_path) > max_depth:
                continue

            # Find all edges from current node
            edges = self.graph_collection.find({
                'source': current_node,
                'active': True
            })

            for edge in edges:
                next_node = edge['target']

                # Build the step
                step = {
                    'step': len(current_path),
                    'from': current_node,
                    'to': next_node,
                    'conversion_id': edge.get('conversion_id'),
                    'estimated_ms': edge.get('metadata', {}).get('latency_ms', 200),
                    'cost': edge.get('metadata', {}).get('cost', 0.01)
                }

                new_path = current_path + [(next_node, step)]

                if next_node == target:
                    # Found a complete path
                    path_steps = [p[1] for p in new_path[1:]]  # Skip first element (source with no step)
                    # Renumber steps
                    for i, step in enumerate(path_steps):
                        step['step'] = i + 1
                    all_paths.append(path_steps)
                else:
                    # Continue searching
                    queue.append(new_path)

        return all_paths