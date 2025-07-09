# Poker Room Settings System

## Overview

The poker room now has a comprehensive settings system that allows for configurable game parameters, including auto-rebuy behavior and showdown timing.

## Settings Configuration

### Available Settings

```javascript
{
  autoRebuy: false,              // Whether to automatically give chips to broke players
  rebuyAmount: 1000,            // Amount of chips to give on auto-rebuy
  showdownDuration: 7000,       // How long to show showdown results (ms) - minimum 5 seconds
  handEndDelay: 3000,           // Delay before starting next hand (ms)
  minChipsToPlay: 0,            // Minimum chips required to play (0 = no minimum)
  maxRebuyCount: -1,            // Max rebuys per player (-1 = unlimited)
  blindIncreaseInterval: 0      // Rounds after which blinds increase (0 = never)
}
```

### Socket Events

#### Client to Server

- `updateSettings(newSettings)` - Update room settings
- `getSettings()` - Get current room settings
- `requestRebuy()` - Manual rebuy request (when auto-rebuy is disabled)

#### Server to Client

- `settingsData` - Current room settings response
- `settingsUpdateResult` - Result of settings update attempt
- `settingsUpdated` - Broadcast when settings change
- `playerRebuy` - Notification when a player receives a rebuy
- `rebuyResult` - Result of manual rebuy request

## Auto-Rebuy System

### Automatic Rebuy (when enabled)

When `autoRebuy` is `true`:
- Players with chips <= `minChipsToPlay` automatically receive `rebuyAmount` chips
- Respects `maxRebuyCount` limit (-1 = unlimited)
- Happens automatically at the start of each hand

### Manual Rebuy (when auto-rebuy disabled)

When `autoRebuy` is `false`:
- Players must request rebuy manually using `requestRebuy()` socket event
- Still respects `maxRebuyCount` limit
- Only works when player has insufficient chips

## Showdown Timing

### Configurable Delays

- `showdownDuration`: How long to display showdown results (minimum 5000ms)
- `handEndDelay`: Delay before starting the next hand after showdown

### Timing Sequence

1. Showdown results displayed for `showdownDuration` ms
2. Hand ended event emitted
3. Wait `handEndDelay` ms
4. Next hand starts

## Validation Rules

- `showdownDuration` cannot be less than 5000ms (5 seconds)
- `handEndDelay` cannot be less than 1000ms (1 second)
- `rebuyAmount` must be positive
- Invalid setting keys are ignored with warnings

## Example Usage

### Enable Auto-Rebuy with Custom Amount

```javascript
socket.emit('updateSettings', {
  autoRebuy: true,
  rebuyAmount: 500,
  maxRebuyCount: 3
});
```

### Set Faster Game Pace

```javascript
socket.emit('updateSettings', {
  showdownDuration: 5000,    // Minimum allowed
  handEndDelay: 1500
});
```

### Manual Rebuy Request

```javascript
// When auto-rebuy is disabled
socket.emit('requestRebuy');

socket.on('rebuyResult', (result) => {
  if (result.success) {
    console.log(`Rebuy successful! New chips: ${result.newChips}`);
  } else {
    console.log(`Rebuy failed: ${result.error}`);
  }
});
```

## Migration from Old System

The old system had hardcoded auto-rebuy (always gave 1000 chips to broke players). Now:

- Auto-rebuy is **disabled by default** (`autoRebuy: false`)
- Rebuy amount is configurable (`rebuyAmount: 1000`)
- Players can request manual rebuys when needed
- Maximum rebuy count can be limited

## Frontend Integration

To integrate with the frontend:

1. Add settings UI panel for room configuration
2. Listen for `settingsUpdated` events to update UI
3. Implement rebuy request button when auto-rebuy is disabled
4. Show rebuy notifications when players receive chips

## Backward Compatibility

The legacy `rebuy` socket event still works for compatibility, but the new `requestRebuy` event is recommended for cleaner semantics.
