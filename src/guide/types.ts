/**
 * Offline user-guide content model.
 * Content is static local data — no network dependency.
 */

/** Stable section ids used in routes and tests. */
export type GuideSectionId =
	| 'quick-start'
	| 'projects'
	| 'counter'
	| 'row-actions'
	| 'linked-counters'
	| 'timer'
	| 'yarn'
	| 'calculators'
	| 'documents'
	| 'diary-stats'
	| 'backup'
	| 'tips'
	| 'faq'

/** Structured content blocks rendered by the guide UI. */
export type GuideBlock =
	| { type: 'paragraph'; text: string }
	| { type: 'heading'; text: string }
	| { type: 'steps'; items: string[] }
	| { type: 'bullets'; items: string[] }
	| { type: 'example'; title?: string; body: string }
	| { type: 'callout'; tone?: 'info' | 'warning'; text: string }

export type GuideSection = {
	id: GuideSectionId
	/** Index card title */
	title: string
	/** Short subtitle on the guide home card */
	teaser: string
	/** Screen heading inside the section */
	heading: string
	blocks: GuideBlock[]
}
