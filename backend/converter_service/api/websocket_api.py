"""
WebSocket API for real-time configuration updates
Simple implementation for demo purposes
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import List, Dict, Any
import logging
import json
from datetime import datetime

from ..services.change_stream_service import get_change_stream_service
from ..services.db_service import get_mongodb_service as get_db_service
from ..config.settings import get_settings

router = APIRouter()
logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Simple WebSocket connection manager
    Handles broadcasting configuration updates to connected clients
    """

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Accept and track new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """Remove disconnected WebSocket"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send message to specific connection"""
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"Error sending message to WebSocket: {e}")

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast message to all connected clients"""
        message_json = json.dumps(message)
        disconnected = []

        for connection in self.active_connections:
            try:
                await connection.send_text(message_json)
            except Exception as e:
                logger.error(f"Error broadcasting to WebSocket: {e}")
                disconnected.append(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn)


# Singleton connection manager
manager = ConnectionManager()


# Callback for change stream events
def handle_config_change(event: Dict[str, Any]):
    """
    Handle configuration change events from MongoDB change stream
    This is called by the change stream service when configs change
    """
    import asyncio

    # Add WebSocket-specific fields
    event['source'] = 'mongodb_change_stream'
    event['broadcast_time'] = datetime.utcnow().isoformat()

    # Get or create event loop for async broadcast
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    # Schedule broadcast
    asyncio.create_task(manager.broadcast(event))
    logger.info(f"Broadcasting config change to {len(manager.active_connections)} clients")


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Main WebSocket endpoint for real-time configuration updates

    Clients connect here to receive notifications when configurations change
    """
    await manager.connect(websocket)

    # Send welcome message
    await websocket.send_text(json.dumps({
        'type': 'connection',
        'status': 'connected',
        'message': 'Connected to configuration update stream',
        'timestamp': datetime.utcnow().isoformat()
    }))

    try:
        # Keep connection alive and handle incoming messages
        while True:
            # Wait for any message from client (ping/pong or commands)
            data = await websocket.receive_text()

            # Handle ping
            if data == "ping":
                await websocket.send_text(json.dumps({
                    'type': 'pong',
                    'timestamp': datetime.utcnow().isoformat()
                }))
            # Handle subscription requests (future enhancement)
            elif data.startswith("subscribe:"):
                config_id = data.split(":")[1]
                await websocket.send_text(json.dumps({
                    'type': 'subscription',
                    'config_id': config_id,
                    'status': 'subscribed',
                    'timestamp': datetime.utcnow().isoformat()
                }))

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("Client disconnected normally")
    except Exception as e:
        manager.disconnect(websocket)
        logger.error(f"WebSocket error: {e}")


@router.websocket("/ws/demo")
async def demo_websocket_endpoint(websocket: WebSocket):
    """
    Demo-specific WebSocket endpoint with enhanced features
    Shows confidence changes and field mapping updates in real-time
    """
    await manager.connect(websocket)

    # Send enhanced welcome message for demo
    await websocket.send_text(json.dumps({
        'type': 'demo_connection',
        'status': 'connected',
        'features': [
            'real-time config updates',
            'confidence tracking',
            'field mapping changes',
            'human review notifications'
        ],
        'timestamp': datetime.utcnow().isoformat()
    }))

    try:
        while True:
            data = await websocket.receive_text()

            # Demo-specific commands
            if data == "status":
                settings = get_settings()
                db_service = get_db_service(settings.mongodb_uri, settings.database_name)

                # Get count of auto-generated configs
                auto_gen_count = db_service.db['conversion_registry'].count_documents(
                    {'metadata.auto_generated': True}
                )

                await websocket.send_text(json.dumps({
                    'type': 'status',
                    'auto_generated_configs': auto_gen_count,
                    'active_connections': len(manager.active_connections),
                    'timestamp': datetime.utcnow().isoformat()
                }))

            elif data.startswith("get_config:"):
                config_id = data.split(":")[1]
                settings = get_settings()
                db_service = get_db_service(settings.mongodb_uri, settings.database_name)

                config = db_service.db['conversion_registry'].find_one({'_id': config_id})
                if config:
                    # Send current config state
                    await websocket.send_text(json.dumps({
                        'type': 'config_state',
                        'config_id': config_id,
                        'confidence': config.get('metadata', {}).get('generation_confidence', 0),
                        'fields_mapped': len(config.get('mappings', [])),
                        'timestamp': datetime.utcnow().isoformat()
                    }))

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        manager.disconnect(websocket)
        logger.error(f"Demo WebSocket error: {e}")


def register_change_stream_listener():
    """
    Register the WebSocket broadcast handler with change stream service
    This should be called during application startup
    """
    settings = get_settings()
    change_stream = get_change_stream_service(settings.mongodb_uri, settings.database_name)
    change_stream.add_listener(handle_config_change)
    logger.info("WebSocket handler registered with change stream service")