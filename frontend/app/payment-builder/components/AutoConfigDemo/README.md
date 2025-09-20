# AutoConfigDemo Component

## Overview
The AutoConfigDemo component provides an interface for automatically configuring new payment formats using AI-powered semantic learning. It can operate in two modes: standalone (modal-like) or embedded (integrated into the payment builder workflow).

## Key Features
- **Embedded Mode**: Seamlessly integrates into the payment builder main content area
- **3-Stage Flow**: Simplified configuration process (Setup → Generating → Review)
- **Demo Scenarios**: Pre-configured scenarios for MT192, MT205, and MT202COV
- **Custom Configuration**: Support for user-defined formats

## Component Props

```typescript
interface AutoConfigDemoProps {
  scenario?: ScenarioType;        // Pre-selected scenario
  onComplete: (config) => void;   // Callback when configuration completes
  onCancel: () => void;           // Callback when user cancels
  isCustom?: boolean;             // Whether using custom format (default: false)
  embedded?: boolean;             // Enable embedded mode (default: false)
}
```

## Embedded Mode

The `embedded` prop is critical for UX consistency. When `embedded={true}`:

### Visual Changes
- Container uses `embeddedContainer` class instead of `container`
- No modal overlay or backdrop
- Header has white background instead of green
- No close button (X) in header
- Fills available space in parent container

### CSS Classes
```css
/* Standard mode */
.container {
  background: var(--white);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  max-width: 1200px;
  margin: 0 auto;
}

/* Embedded mode */
.embeddedContainer {
  background: var(--white);
  border-radius: 8px;
  border: 1px solid var(--gray-light2);
  height: 100%;
  display: flex;
  flex-direction: column;
}
```

## Usage

### Embedded Mode (Recommended)
Used when integrating with payment builder workflow:

```javascript
// In page.js
{selectedPaymentType?.isAutoConfig ? (
  <AutoConfigDemo
    embedded={true}
    scenario={autoConfigScenario}
    onComplete={handleAutoConfigComplete}
    onCancel={() => setSelectedPaymentType(null)}
    isCustom={false}
  />
) : (
  <BuilderCanvas ... />
)}
```

### Standalone Mode
Can be used as a modal overlay (original design, not currently used):

```javascript
{showAutoConfig && (
  <AutoConfigDemo
    embedded={false}
    scenario={scenario}
    onComplete={handleComplete}
    onCancel={() => setShowAutoConfig(false)}
  />
)}
```

## Stage Components

### 1. ScenarioSelectionStage
- Displays available demo scenarios
- Allows selection of custom configuration
- Only shown when no scenario is pre-selected

### 2. SetupStage
- Shows format details (source → target)
- Displays sample message
- Allows editing of sample message
- For custom configs: input fields for format names

### 3. GeneratingStage
- Animated progress indicator
- Shows elapsed time
- Displays processing steps
- Visual feedback during auto-configuration

### 4. ReviewStage
- Displays generated configuration
- Shows confidence scores
- Lists mapped fields
- Highlights uncertain fields
- Approve/reject buttons

## Service Integration

The component integrates with `paymentBuilderService` for backend operations:

```javascript
// Trigger auto-configuration
const result = await paymentBuilderService.triggerAutoConfig(
  sourceFormat,
  targetFormat,
  sampleMessage,
  similarTo
);

// Validate configuration
await paymentBuilderService.validateAutoConfig(
  configurationId,
  corrections,
  approved
);
```

## State Management

Internal state tracks:
- Current stage ('selection' | 'setup' | 'generating' | 'review' | 'complete')
- Selected scenario
- Sample message
- Configuration result
- Error states
- Processing time

## Error Handling

Errors are displayed inline with:
```javascript
{error && (
  <div className={styles.errorMessage}>
    <span className={styles.errorIcon}>⚠️</span>
    {error}
  </div>
)}
```

## Design Consistency

The component strictly adheres to the payment builder design system:
- Uses only existing CSS variables
- Matches hover/active states from other components
- No gradient backgrounds
- Green color scheme (var(--green-dark1))
- Standard spacing variables (var(--spacing-3), etc.)

## Future Enhancements

Planned additions that will integrate with current structure:
- WebSocket for real-time updates
- Confidence visualization components
- MongoDB operation tracking
- Pattern matching animations
- Field-by-field review interface

## File Structure

```
AutoConfigDemo/
├── AutoConfigDemo.js              # Main component
├── AutoConfigDemo.module.css      # Styles
├── README.md                      # This file
└── stages/
    ├── ScenarioSelectionStage.js
    ├── SetupStage.js
    ├── GeneratingStage.js
    └── ReviewStage.js
```

## Key Decisions

1. **Embedded Over Modal**: Provides consistent UX with payment type selection
2. **3 Stages vs 5 Steps**: Simplified flow is more intuitive
3. **Conditional Styling**: Single component adapts to context
4. **Service Integration**: Reuses existing patterns for API calls