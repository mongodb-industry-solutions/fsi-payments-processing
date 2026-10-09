# Agentic Payments Platform - Test Definitions

## Info
| Field | Value |
|-------|-------|
| **App** | `agentic-payments` |
| **Industry** | fsi |
| **Source repo** | `fsi-payments-processing` (Agentic Payments Platform) |
| **Local URL** | http://localhost:3000 |
| **Staging Frontend** | agentic-payments-frontend-web-app (verify Kanopy service name) |
| **TC ID prefix** | `FS-AP` |

## Stack Notes

Next.js 15 App Router frontend + FastAPI converter/agent sidecars (LangGraph,
AWS Bedrock, Voyage AI). Full simulation requires a live MongoDB Atlas cluster
with Search + Vector Search, Bedrock access, and a Voyage AI key — so the
Simulate flow is exercised only up to the point that proves the streaming
pipeline is alive, never for exact AI output (non-deterministic by rule 4).

Routes under test:
- `/` — landing
- `/agentic-ai` — scenario runner (the demo "wow" moment)
- `/config-builder` — Config Studio
- `/documentation` — architecture docs

## Test Cases

### FS-AP-01: Landing Page Renders and Get Started Navigates to Smart Processor

**Pre-conditions**: Navigate to `http://localhost:3000`

**Steps**:

1. Open the application and check the initial page layout.
2. Confirm the hero heading, subtitle, and feature cards are visible.
3. Click the "Get Started" button.

**Expected Results**:

1. The "Agentic Payments Platform" heading and "Document-driven. Intelligent learning. Universal compatibility." subtitle are visible.
2. Three feature cards (Configuration-as-Data, Agentic Error Resolution, Universal Compatibility) are visible.
3. The browser navigates to `/agentic-ai` and the "Payment Scenarios" heading is visible.

**Status**: Pending - Awaiting implementation

---

### FS-AP-02: Navigation Bar Routes to Each Section

**Pre-conditions**: Navigate to `http://localhost:3000`

**Steps**:

1. Click the "Config Studio" navigation link.
2. Return home and click the "Documentation" navigation link.
3. Return home and click the "Smart Processor" navigation link.

**Expected Results**:

1. The browser navigates to `/config-builder` and the "Config Studio tabs" tablist is visible.
2. The browser navigates to `/documentation` and the "The Problem" heading is visible.
3. The browser navigates to `/agentic-ai` and the "Payment Scenarios" heading is visible.

**Status**: Pending - Awaiting implementation

---

### FS-AP-03: Agentic AI Page Loads Scenario Panel and Action Buttons

**Pre-conditions**: Navigate to `http://localhost:3000/agentic-ai`

**Steps**:

1. Open the Smart Processor page and check the scenario panel.
2. Confirm at least one scenario card is visible (e.g. "Germany → Japan Automotive Supply").
3. Confirm the Simulate and Reset action buttons are present.

**Expected Results**:

1. The "Payment Scenarios" heading is visible.
2. A scenario card containing "Germany → Japan Automotive Supply" is visible.
3. "Simulate" and "Reset" buttons are both visible.

**Status**: Pending - Awaiting implementation

---

### FS-AP-04: Selecting a Scenario and Simulating Starts the Streaming Pipeline

**Pre-conditions**: Navigate to `http://localhost:3000/agentic-ai` with the full stack running (Atlas + Bedrock + Voyage AI).

**Steps**:

1. Click the "Germany → Japan Automotive Supply" scenario card.
2. Click the "Simulate" button.
3. Wait and observe the Transaction Logs panel.

**Expected Results**:

1. The scenario card becomes selected (highlighted).
2. The Simulate button switches to "Processing...".
3. The "Transaction Logs" panel is visible and at least one log event appears within 60 seconds.

**Status**: Pending - Awaiting implementation

> AI output is non-deterministic — assert only that streaming started and events
> arrived, never exact event text or final canonical JSON content.

---

### FS-AP-05: Config Studio Page Loads Tabs and Generate Control

**Pre-conditions**: Navigate to `http://localhost:3000/config-builder`

**Steps**:

1. Open the Config Studio page and check the tablist.
2. Switch to the "Build Config" tab.
3. Confirm the source/target format selects and Generate Config button are present.

**Expected Results**:

1. The "Config Studio tabs" tablist is visible with "Schema Reference" and "Build Config" tabs.
2. The "Build Config" tab panel becomes active.
3. The "Generate Config" button and the "Select source format" / "Select target format" controls are visible.

**Status**: Pending - Awaiting implementation

---

### FS-AP-06: Documentation Page Renders Architecture Content

**Pre-conditions**: Navigate to `http://localhost:3000/documentation`

**Steps**:

1. Open the Documentation page and check the intro section.
2. Scroll to the architecture section.

**Expected Results**:

1. The "The Problem" heading is visible.
2. The "Architecture Diagram" heading is visible.

**Status**: Pending - Awaiting implementation
