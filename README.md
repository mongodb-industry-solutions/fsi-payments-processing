# FSI Payments Processing Demo

A comprehensive **Generic Payment Format Converter Service** that demonstrates MongoDB's power in financial services through AI-powered payment format conversion with **100% genericity** - new formats require NO code changes, only MongoDB configuration.

## Where MongoDB Shines?

This demo showcases MongoDB's key strengths in financial services:

- **Document-Based Configuration Storage**: All conversion rules, field mappings, and format configurations stored as flexible MongoDB documents instead of hardcoded logic
- **Flexible Schema Design**: Handles any payment format (MT103, ISO 20022, ISO 8583, crypto) through MongoDB's adaptive document structure
- **Semantic Learning Storage**: AI-learned patterns and field mappings automatically stored and retrieved for continuous improvement
- **Real-Time Processing Insights**: Live conversion statistics, processing metrics, and lane distribution analytics
- **Auto-Configuration Capabilities**: New payment formats can be dynamically configured and stored without code deployment
- **Human Review Workflow**: Low-confidence conversions queued in MongoDB for human review and feedback loops

## High Level Architecture

**3-Lane Processing System:**
- **Rules Lane** (80-85% of fields): Fast deterministic mappings stored in MongoDB - 50-200ms processing
- **AI Lane** (10-15% of fields): AWS Bedrock-powered extraction for complex fields - 1-3s processing
- **Human Lane** (<5% of fields): Low-confidence outputs queued for human review and learning

[Architecture diagram available in [Google Slides](https://docs.google.com/presentation/d/1vo8Y8mBrocJtzvZc_tkVHZTsVW_jGueyUl-BExmVUtI/edit#slide=id.g30c066974c7_0_3536)]

## Tech Stack

**Backend:**
- [FastAPI](https://fastapi.tiangolo.com/) (Python 3.13) for high-performance REST API
- [MongoDB](https://www.mongodb.com/atlas/database) with pymongo driver for flexible data storage
- [AWS Bedrock](https://aws.amazon.com/bedrock/) (Anthropic Claude) for AI-powered field extraction
- [uv](https://docs.astral.sh/uv/) for fast Python dependency management
- Uvicorn ASGI server for production deployment

**Frontend:**
- [Next.js 15](https://nextjs.org/docs/app) with App Router for modern React framework
- [LeafyGreen UI](https://github.com/mongodb/leafygreen-ui) (MongoDB's design system) for consistent styling
- React 19 with modern hooks and concurrent features
- [CSS Modules](https://github.com/css-modules/css-modules) for component-scoped styling

**Infrastructure:**
- Docker & Docker Compose for containerized deployment
- WebSocket support for real-time conversion updates
- Feature flags for demo mode and experimental capabilities

## Prerequisites

Before you begin, ensure you have met the following requirements:

- **Python 3.13** (but less than 3.14) for the backend service
- **Node.js 22** or higher for the frontend application
- **uv** package manager (install via [uv's official documentation](https://docs.astral.sh/uv/getting-started/installation/))
- **MongoDB** instance (local or MongoDB Atlas) for data storage
- **AWS Account** with Bedrock access for AI processing (optional for basic functionality)
- **Docker & Docker Compose** (optional, for containerized deployment)

## Run it Locally

### Backend Setup

1. **Environment Configuration**: Create a `.env` file in the `/backend/converter_service` directory:

   ```bash
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017
   DATABASE_NAME=payment_converter

   # AWS Bedrock Configuration (optional for basic functionality)
   AWS_REGION=us-east-1
   BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0

   # Feature Flags (optional)
   ENABLE_DEMO_MODE=true
   ENABLE_AI_PROCESSING=true
   ENABLE_WEBSOCKET=false
   ```

2. **Install Dependencies**: From the root project directory, run:

   ```bash
   # Initialize uv virtual environment
   make uv_init

   # Install all dependencies
   make uv_sync
   ```

3. **Verify Installation**: Check that the `.venv` folder has been created in `/backend` directory.

### Running Backend Locally

1. **Navigate to the converter service directory**:

   ```bash
   cd backend/converter_service
   ```

2. **Start the FastAPI development server**:

   ```bash
   # Default port 8001 (recommended)
   uv run uvicorn main:app --host 0.0.0.0 --port 8001 --reload

   # Alternative port if 8001 is in use
   uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

3. **Access the API**:
   - **API Server**: http://localhost:8001
   - **Interactive API Docs**: http://localhost:8001/docs
   - **ReDoc Documentation**: http://localhost:8001/redoc

### Frontend Setup

1. **Environment Configuration**: Create a `.env.local` file in the `/frontend` directory:

   ```bash
   # Backend API Configuration
   BACKEND_API_URL=http://localhost:8001
   NEXT_PUBLIC_API_URL=http://localhost:8001
   ```

2. **Navigate to the frontend directory**:

   ```bash
   cd frontend
   ```

3. **Install dependencies**:

   ```bash
   npm install
   ```

4. **Start the development server**:

   ```bash
   npm run dev
   ```

5. **Access the application**:
   - **Frontend Application**: <http://localhost:3000>
   - **Converter Interface**: <http://localhost:3000/converter>
   - **API Documentation**: <http://localhost:3000/api-docs>

## Run with Docker

**Prerequisites**: Ensure Docker and Docker Compose are installed and running.

1. **Build and start all services** (run from root directory):

   ```bash
   make build
   ```

   This will start:
   - **Backend Service**: <http://localhost:8000> (converter API)
   - **Frontend Application**: <http://localhost:3000> (web interface)

2. **Stop services**:

   ```bash
   make stop
   ```

3. **Clean up containers and images**:

   ```bash
   make clean
   ```

## Demo Features

When `ENABLE_DEMO_MODE=true` is set in your environment, additional visualization features are available:

- **Real-time Processing Visualization**: Watch fields move through Rules → AI → Human lanes
- **AI Reasoning Display**: See detailed AI decision-making process for field extractions
- **Confidence Breakdown**: View confidence scores and calculation details for each field
- **Lane Distribution Analytics**: Visualize processing distribution across the 3-lane system
- **WebSocket Updates**: Real-time conversion progress updates (when `ENABLE_WEBSOCKET=true`)
- **Learning Dashboard**: View semantic patterns learned by the AI system

## Common Issues & Troubleshooting

### Backend Issues

- **MongoDB Connection Error**: Ensure MongoDB is running and `MONGODB_URI` in `.env` is correct
- **AWS Bedrock Access Denied**: Verify AWS credentials and Bedrock model access permissions
- **Port 8001 Already in Use**: Either stop conflicting services or use `--port 8000` flag
- **Missing Environment File**: Create `.env` file in `/backend/converter_service/` with required variables
- **uv Command Not Found**: Install uv package manager following [official documentation](https://docs.astral.sh/uv/getting-started/installation/)

### Frontend Issues

- **Backend API Connection Failed**: Verify backend is running on port 8001 and `BACKEND_API_URL` in `.env.local` is correct
- **LeafyGreen UI Components Not Loading**: Run `npm install` to ensure all dependencies are installed
- **Build Errors**: Check Node.js version (requires 22+) and clear `node_modules` if needed

### Docker Issues

- **Container Build Failures**: Ensure Docker has sufficient memory allocated (4GB+ recommended)
- **AWS Credentials in Container**: Verify AWS credentials are properly mounted in `docker-compose.yml`
- **Port Conflicts**: Check if ports 3000 or 8000 are already in use by other services

### Demo Mode Issues

- **Demo Features Not Visible**: Set `ENABLE_DEMO_MODE=true` in backend `.env` file
- **WebSocket Connection Failed**: Ensure `ENABLE_WEBSOCKET=true` and no firewall blocking connections
- **AI Processing Disabled**: Verify AWS Bedrock credentials and set `ENABLE_AI_PROCESSING=true`
