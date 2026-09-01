# Domain Model

## Entities

### app_settings

Key-value persistent settings.

| Column | Type | Notes |
|--------|------|-------|
| key | TEXT PK | Setting identifier |
| value | TEXT | Serialized value |
| updated_at | TEXT | ISO timestamp |

### knitting_projects

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| name | TEXT | Required |
| project_type | TEXT | Nullable (sweater, socks, …) |
| craft_type | TEXT | `knitting` \| `crochet` |
| status | TEXT | `planned` \| `active` \| `paused` \| `completed` \| `archived` |
| started_at | TEXT | Nullable ISO |
| completed_at | TEXT | Nullable ISO |
| notes | TEXT | Nullable |
| photo_uri | TEXT | Nullable |
| created_at | TEXT | ISO |
| updated_at | TEXT | ISO |

### project_parts

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| project_id | TEXT FK | → knitting_projects, CASCADE |
| name | TEXT | e.g. Перед, Спинка |
| position | INTEGER | Display order |
| created_at | TEXT | ISO |
| updated_at | TEXT | ISO |

### counters

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| project_id | TEXT FK | → knitting_projects, CASCADE |
| project_part_id | TEXT FK | → project_parts, CASCADE, nullable |
| name | TEXT | e.g. Основной ряд |
| current_value | INTEGER | ≥ 0 |
| start_value | INTEGER | ≥ 0 |
| target_value | INTEGER | Nullable, ≥ 0 |
| repeat_length | INTEGER | Nullable, > 0 (pattern repeat) |
| is_primary | INTEGER | 0/1 |
| position | INTEGER | Display order |
| created_at | TEXT | ISO |
| updated_at | TEXT | ISO |

### counter_events

Foundation for undo/history.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| counter_id | TEXT FK | → counters, CASCADE |
| previous_value | INTEGER | ≥ 0 |
| new_value | INTEGER | ≥ 0 |
| event_type | TEXT | `increment` \| `decrement` \| `set` \| `reset` |
| created_at | TEXT | ISO |

## Integrity

- Foreign keys enabled per connection
- `ON DELETE CASCADE` for owned children
- CHECK constraints on enums, non-negative values, repeat_length > 0
- Repository-level validation before writes

## Future Extensions (Not Phase 1)

Yarn inventory, row rules, attachments, timer sessions, backup/restore tables.
