# Моя вязалка — Product Scope (v1)

**Phase:** 0 — Product / Domain Foundation  
**App name:** Моя вязалка  
**Package:** `com.calculatorplatform.knitcounter`

## Product Goal

Offline-first knitting assistant for Russian-speaking users. The app must help while the person is actually knitting and must never get in the way.

## v1 Main Tabs

| Tab | Purpose |
|-----|---------|
| **Сегодня** | Quick access to active knitting projects |
| **Проекты** | Project list and project workspace |
| **Пряжа** | Yarn inventory |
| **Расчёты** | Knitting calculators |
| **Ещё** | Settings, backup, app information |

Phase 1 implements only the navigation shell with intentional placeholder screens.

## Future Project Structure

A knitting project can eventually contain:

- Basic project data (name, craft type, status)
- Project photo
- Yarn references
- Sections/parts (Перед, Спинка, Рукава, Воротник, …)
- Multiple counters per project or part
- Row rules and reminders
- Notes
- Attached PDFs/images
- Timer sessions
- History

## Counter Examples

- Основной ряд
- Узор
- Убавки
- Рукав

## Ads (Future — Not Phase 1)

- Maximum one banner on normal navigation screens
- NO banner in active knitting/counting mode
- NO interstitial during row counting
- Interstitial only at natural transitions with cooldown

## Out of Scope for Phase 1

Yarn UI, calculators, PDF reader, image attachments, row rules, timer, backup/restore, analytics, ads, cloud sync, authentication.

## Target Audience

Users 35–65+. Large touch targets, high contrast, simple Russian wording, minimal actions per screen.
