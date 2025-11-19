# AI Trading Bot Platform - Design Guidelines

## Design Approach
**System-Based Design**: Material Design with financial dashboard customization
**References**: TradingView, Coinbase Pro, Robinhood - prioritizing data density, clarity, and professional financial aesthetics

## Core Design Principles
1. **Information Density Over Whitespace**: Trading dashboards require maximum data visibility
2. **Real-time Visual Feedback**: Immediate visual response to market changes
3. **Trust Through Professionalism**: Clean, precise layouts that inspire confidence
4. **Dark Theme Foundation**: Reduce eye strain for extended monitoring sessions

## Typography System
**Primary Font**: Inter (Google Fonts) - excellent readability for numbers and data
**Font Hierarchy**:
- Dashboard metrics: text-3xl to text-5xl font-bold (large, impactful numbers)
- Section headers: text-xl font-semibold
- Data labels: text-sm font-medium text-gray-400
- Body text: text-base font-normal
- Fine print/timestamps: text-xs text-gray-500

**Number Formatting**: Tabular numbers (font-variant-numeric: tabular-nums) for aligned financial data

## Layout System
**Spacing Scale**: Tailwind units of 2, 4, 6, 8, 12, 16 (tight spacing for data density)
**Grid Structure**: 12-column grid with 24-column option for complex dashboards
**Container Strategy**:
- Full-width dashboard: px-6 py-4
- Card components: p-4 to p-6
- Stat cards: p-4 with tight internal spacing

**Responsive Breakpoints**:
- Mobile (default): Single column, collapsible sections
- Tablet (md:): 2-column layout for metrics
- Desktop (lg:, xl:): Multi-column dashboard with side panels

## Component Library

### Navigation
**Top Bar**: Fixed header with h-16, containing logo, balance display, bot status indicator, user menu
**Layout**: Flex justify-between with critical info always visible

### Dashboard Cards
**Stat Cards** (4 primary metrics):
- Grid layout: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4
- Card style: Rounded corners (rounded-lg), subtle border or elevated shadow
- Content: Large number (text-3xl), label above, percentage change with color indicator below
- Height: Auto-fit content with py-6

**Chart Cards**:
- Primary chart area: 2/3 width on desktop, full-width mobile
- Height: min-h-[400px] for proper data visualization
- Padding: p-6 for breathing room around complex visuals

**Trade History Panel**:
- Right sidebar or bottom section: 1/3 width on desktop
- Scrollable list: max-h-[600px] overflow-y-auto
- Row height: py-3 with alternating subtle background

### Trading Controls
**Strategy Selection**: Button group or segmented control with 3 options (Safe/Balanced/Aggressive)
**Start/Stop Controls**: Prominent toggle switch or dual-button with clear active state
**Mode Switcher**: Toggle between Sandbox/Real with warning badge for Real mode
**Layout**: Sticky control panel at top or side, always accessible

### Data Visualization
**Charts**: Use Recharts with dark theme configuration
- Line charts for price movement
- Area charts for portfolio value over time
- Bar charts for trade volume
- Candlestick patterns for detailed price action

**Color Coding**:
- Positive values/profits: text-green-400 or bg-green-500/10
- Negative values/losses: text-red-400 or bg-red-500/10
- Neutral/pending: text-amber-400 or bg-amber-500/10
- Active positions: text-blue-400

### Alerts & Notifications
**Toast Notifications**: Top-right position, slide-in animation
**Trade Alerts**: Inline within trade history with timestamp
**Bot Status**: Visual indicator (pulsing dot) in header - green (active), red (stopped), amber (paused)

### Forms & Inputs
**Strategy Parameters**:
- Range sliders for risk percentage (1-5%)
- Number inputs with increment/decrement buttons
- Real-time preview of settings before applying

**Input Style**: Dark background with light border, focus state with accent color ring

## Real-Time Features
**Price Updates**: Smooth number transitions (not jarring jumps)
**New Trades**: Brief highlight animation (flash green/red then fade)
**Balance Changes**: Animated counter incrementing/decrementing
**WebSocket Status**: Small indicator showing connection state

## Visual Hierarchy
1. **Critical Data First**: Balance, P/L, and bot status most prominent
2. **Actionable Controls Second**: Start/Stop, strategy selection easily accessible
3. **Historical Data Third**: Charts and trade history for analysis
4. **Settings Last**: Less frequently accessed, can be in dropdown/modal

## Tables & Lists
**Trade History Table**:
- Columns: Time, Symbol, Type (Buy/Sell), Price, Quantity, P/L, Strategy
- Row styling: Hover state, zebra striping (subtle), clickable for details
- Compact: text-sm with py-2 row height
- Icons: Small indicators (8px-12px) for buy/sell arrows

## Animations
**Minimal & Purposeful**:
- Loading states: Subtle skeleton screens or spinner
- Data updates: 200ms fade transitions
- Modals/overlays: Slide-in from right or fade in
- **Avoid**: Distracting animations that interfere with data monitoring

## Images
**No Hero Images**: This is a functional dashboard, not a marketing site
**Icon Usage**: Heroicons (via CDN) for UI elements - trading icons, status indicators, navigation
**Logo**: Small brand mark in top-left (h-8 to h-10)
**Coin Icons**: Optional small cryptocurrency logos next to symbols (16px)

## Accessibility
- High contrast ratios on dark background (WCAG AA minimum)
- Keyboard navigation for all trading controls
- Screen reader labels for all data points
- Focus indicators clearly visible
- Color not sole indicator of profit/loss (include +/- symbols)