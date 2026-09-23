# Changelog

All notable changes follow Semantic Versioning.

## [Unreleased]

### Added

- Multi-window reading schedules allowing multiple named slots (e.g., Morning Commute, Lunch Break, Evening Wind-Down) with configurable start/end times, day-of-week filters (all days, weekdays, weekends, custom), and active toggles.
- Block duration preset chips (`10m`, `15m`, `20m`, `30m`, `45m`, `60m`) with custom minute entry across Settings and Planner proposal cards.
- Cross-surface setup quick links (`[ ⚙️ Reading windows ]`) in Planner header and empty state, Queue header, and Popup footer.
- Contextual window attribution in scheduler proposal explanations (e.g., `Fits your "Morning Commute" reading window (30 min)`).
- ADR 0006 capturing the design decisions for multi-window reading schedules and duration blocks.

### Changed

- Queue page tab navigation now operates with zero flicker (0ms latency) using synchronous in-memory filtering over cached items.
- Aligned "Search queue" search box and "Sort" filter into a unified horizontal bar on the Queue page.

### Fixed

- Card height normalization in CSS grid layouts (`.grid > .panel`), fixing discrepancies between summary cards.

## [0.9.0] - 2026-07-13

### Added

- Initial store-ready ReadSlot beta implementation.

### Changed

- Adopted the canonical ReadSlot identity and “Schedule what you save” tagline before OAuth configuration and publication.
- Moved the complete blueprint and project knowledge reference into `docs/`.

### Fixed

- Replaced incomplete multi-character HTML-title sanitization with a stable single-pass plain-text scanner.
