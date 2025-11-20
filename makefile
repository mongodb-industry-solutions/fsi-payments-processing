build:
	docker-compose up --build -d

start: 
	docker-compose start

stop:
	docker-compose stop

clean:
	docker-compose down --rmi all -v

install_uv:
	curl -LsSf https://astral.sh/uv/install.sh | sh

uv_init:
	cd backend && uv venv

uv_sync:
	cd backend && uv sync

uv_update:
	cd backend && uv lock --upgrade

# Development Commands (with auto-reload)
.PHONY: dev dev-backend dev-frontend dev-converter dev-agent dev-stop dev-logs dev-status

dev: dev-stop
	@echo "🚀 Starting all services with auto-reload..."
	@mkdir -p logs
	@(cd backend/payment_converter_v2 && API_PORT=8001 uv run python main.py) > logs/converter.log 2>&1 & echo $$! > logs/converter.pid
	@(cd backend/payment_agent && uv run python main.py) > logs/agent.log 2>&1 & echo $$! > logs/agent.pid
	@(cd frontend && npm run dev) > logs/frontend.log 2>&1 & echo $$! > logs/frontend.pid
	@sleep 3
	@echo "✅ All services started!"
	@echo "   📊 Frontend:        http://localhost:3000"
	@echo "   🔄 Converter API:   http://localhost:8001/docs"
	@echo "   🤖 Agent API:       http://localhost:8002/docs"
	@echo ""
	@echo "📋 Useful commands:"
	@echo "   make dev-logs      - View all logs"
	@echo "   make dev-status    - Check service status"
	@echo "   make dev-stop      - Stop all services"

dev-backend: dev-stop-backend
	@echo "🚀 Starting backend services..."
	@mkdir -p logs
	@(cd backend/payment_converter_v2 && API_PORT=8001 uv run python main.py) > logs/converter.log 2>&1 & echo $$! > logs/converter.pid
	@(cd backend/payment_agent && uv run python main.py) > logs/agent.log 2>&1 & echo $$! > logs/agent.pid
	@sleep 3
	@echo "✅ Backend services started!"
	@echo "   🔄 Converter API:   http://localhost:8001/docs"
	@echo "   🤖 Agent API:       http://localhost:8002/docs"

dev-frontend: dev-stop-frontend
	@echo "🚀 Starting frontend..."
	@mkdir -p logs
	@(cd frontend && npm run dev) > logs/frontend.log 2>&1 & echo $$! > logs/frontend.pid
	@sleep 2
	@echo "✅ Frontend started!"
	@echo "   📊 Frontend:        http://localhost:3000"

dev-converter:
	@echo "🚀 Starting converter service..."
	@mkdir -p logs
	@lsof -ti :8001 | xargs kill -9 2>/dev/null || true
	@(cd backend/payment_converter_v2 && API_PORT=8001 uv run python main.py) > logs/converter.log 2>&1 & echo $$! > logs/converter.pid
	@sleep 2
	@echo "✅ Converter service started!"
	@echo "   🔄 Converter API:   http://localhost:8001/docs"

dev-agent:
	@echo "🚀 Starting agent service..."
	@mkdir -p logs
	@lsof -ti :8002 | xargs kill -9 2>/dev/null || true
	@(cd backend/payment_agent && uv run python main.py) > logs/agent.log 2>&1 & echo $$! > logs/agent.pid
	@sleep 2
	@echo "✅ Agent service started!"
	@echo "   🤖 Agent API:       http://localhost:8002/docs"

dev-stop:
	@echo "🛑 Stopping all services..."
	@lsof -ti :8001 | xargs kill -9 2>/dev/null || true
	@lsof -ti :8002 | xargs kill -9 2>/dev/null || true
	@lsof -ti :3000 | xargs kill -9 2>/dev/null || true
	@rm -f logs/*.pid
	@echo "✅ All services stopped"

dev-stop-backend:
	@echo "🛑 Stopping backend services..."
	@lsof -ti :8001 | xargs kill -9 2>/dev/null || true
	@lsof -ti :8002 | xargs kill -9 2>/dev/null || true
	@rm -f logs/converter.pid logs/agent.pid
	@echo "✅ Backend services stopped"

dev-stop-frontend:
	@echo "🛑 Stopping frontend..."
	@lsof -ti :3000 | xargs kill -9 2>/dev/null || true
	@rm -f logs/frontend.pid
	@echo "✅ Frontend stopped"

dev-logs:
	@echo "📋 Service Logs (press Ctrl+C to exit)"
	@echo "========================================"
	@tail -f logs/*.log 2>/dev/null || echo "No logs found. Run 'make dev' first."

dev-status:
	@echo "🔍 Service Status:"
	@echo "=================="
	@if lsof -ti :3000 > /dev/null 2>&1; then echo "✅ Frontend (3000):  Running"; else echo "❌ Frontend (3000):  Stopped"; fi
	@if lsof -ti :8001 > /dev/null 2>&1; then echo "✅ Converter (8001): Running"; else echo "❌ Converter (8001): Stopped"; fi
	@if lsof -ti :8002 > /dev/null 2>&1; then echo "✅ Agent (8002):     Running"; else echo "❌ Agent (8002):     Stopped"; fi

dev-kill-all:
	@echo "💀 Killing all processes on ports 300* and 800*..."
	@for port in 3000 3001 3002 3003 3004 3005 3006 3007 3008 3009; do \
		lsof -ti :$$port | xargs kill -9 2>/dev/null || true; \
	done
	@for port in 8000 8001 8002 8003 8004 8005 8006 8007 8008 8009; do \
		lsof -ti :$$port | xargs kill -9 2>/dev/null || true; \
	done
	@rm -f logs/*.pid 2>/dev/null || true
	@echo "✅ All processes killed on ports 300* and 800*"