# ZYNC ERP — Design System

Canonical CSS variables and utility classes for the ZYNC ERP frontend.

## Quick Start

```jsx
// main.jsx — token import MUST come before index.css
import './tokens.css'
import './index.css'
```

## Design Tokens (`tokens.css`)

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#0f1a24` | Page background |
| `--color-panel` | `#15202a` | Card/sidebar backgrounds |
| `--color-panel-2` | `#16232b` | Input backgrounds, secondary panels |
| `--color-text` | `#E6EEF6` | Primary text |
| `--color-muted` | `#97A1AD` | Secondary/hint text |
| `--color-accent` | `#2F8FFF` | CTAs, links, active states |
| `--color-accent-hover` | `#1a7ae6` | Button hover |
| `--color-success` | `#29B070` | Positive values, paid badges |
| `--color-warning` | `#f59e0b` | Warnings, pending badges |
| `--color-danger` | `#FF5C6C` | Errors, destructive actions |
| `--color-info` | `#06b6d4` | Informational badges |
| `--border-surface` | `rgba(255,255,255,0.04)` | Subtle borders |
| `--radius-sm` | `6px` | Inputs, small elements |
| `--radius-md` | `12px` | Cards, modals |
| `--space-1..5` | `4/8/16/24/32px` | Spacing scale |
| `--elevation-1` | `0 6px 18px rgba(2,8,15,0.45)` | Card shadows |

## CSS Classes Reference

### Buttons
| Class | Description |
|---|---|
| `.btn` | Base button (44px min-height, token-based) |
| `.btn-primary` | Accent-colored primary action |
| `.btn-secondary` | Ghost button with subtle border |
| `.btn-ghost` | No background, text-only |
| `.btn-success` | Green background for positive actions |
| `.btn-sm` | Compact button variant |

### Layout
| Class | Description |
|---|---|
| `.page-container` | Standard page wrapper with padding |
| `.page-header` | Flex row for title + actions |
| `.page-title` | Page heading |
| `.card` | Card container with panel bg, border, elevation |
| `.card-title` | Card section heading |
| `.form-grid` | 2-column grid for form fields |
| `.modal-overlay` | Full-screen backdrop |
| `.modal` | Centered modal dialog |
| `.modal-actions` | Right-aligned button row |

### Tables
| Class | Description |
|---|---|
| `.table` | Styled table with sticky headers |
| `.table-container` | Overflow wrapper for responsive tables |
| `.text-right` | Right-align column |
| `.text-center` | Center-align column |
| `.font-mono` | Monospace font (codes, numbers) |

### Badges
| Class | Description |
|---|---|
| `.badge` | Base badge |
| `.badge-success` | Green badge |
| `.badge-warning` | Yellow badge |
| `.badge-danger` | Red badge |
| `.badge-secondary` | Muted badge |
| `.badge-accent` | Accent-colored badge |

### Utility Classes
| Class | Description |
|---|---|
| `.text-success` | Green text |
| `.text-danger` | Red text |
| `.text-warning` | Yellow text |
| `.text-muted` | Muted text |
| `.text-sm` | Small font size |
| `.text-xs` | Extra-small font size |
| `.empty-state` | Centered empty-state message |
| `.flex`, `.gap-2`, `.gap-4` | Flex layout utilities |

### Component-Specific Classes
| Class | Description |
|---|---|
| `.settings-tab` / `.settings-tab--active` | Settings page tab buttons |
| `.report-tab` / `.report-tab--active` | Reports page tab buttons |
| `.balance-row` / `.balance-name` / `.balance-value` | Opening balance rows |
| `.backup-item` | Settings backup items |
| `.summary-stat` / `.summary-stat-label` / `.summary-stat-value` | Stock adjustment summary |
| `.adj-badge.add` / `.adj-badge.remove` | Adjustment type badges |

## Accessibility

- **Focus**: `*:focus-visible` applies a 2px accent outline with 2px offset globally
- **Buttons**: All interactive buttons have `aria-label` attributes
- **Contrast**: Body text (#E6EEF6 on #0f1a24) exceeds WCAG AA 4.5:1 ratio
- **Min tap targets**: Buttons have 44px minimum height

## POS Components

The POS module uses its own `--pos-*` token namespace in `pos.css` for specialized product card states (selected, in-cart, low-stock, out-of-stock). These are scoped to the POS component and do not conflict with the global design system.
