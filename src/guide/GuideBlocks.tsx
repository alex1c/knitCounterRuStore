/**
 * Renders offline guide content blocks with readable typography.
 */

import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Card } from '@/components/ui/Card'
import type { GuideBlock } from '@/guide/types'
import { colors, radii, spacing, typography } from '@/theme/tokens'

type GuideBlocksProps = {
	blocks: GuideBlock[]
}

/** Maps typed guide blocks to themed React Native views. */
export function GuideBlocks({ blocks }: GuideBlocksProps) {
	return (
		<View style={styles.stack}>
			{blocks.map((block, index) => (
				<GuideBlockView key={`${block.type}-${index}`} block={block} />
			))}
		</View>
	)
}

function GuideBlockView({ block }: { block: GuideBlock }) {
	switch (block.type) {
		case 'paragraph':
			return <Text style={styles.paragraph}>{block.text}</Text>
		case 'heading':
			return <Text style={styles.heading}>{block.text}</Text>
		case 'steps':
			return (
				<View style={styles.list}>
					{block.items.map((item, index) => (
						<View key={item} style={styles.listRow}>
							<Text style={styles.stepIndex}>{index + 1}.</Text>
							<Text style={styles.listText}>{item}</Text>
						</View>
					))}
				</View>
			)
		case 'bullets':
			return (
				<View style={styles.list}>
					{block.items.map((item) => (
						<View key={item} style={styles.listRow}>
							<Text style={styles.bullet}>•</Text>
							<Text style={styles.listText}>{item}</Text>
						</View>
					))}
				</View>
			)
		case 'example':
			return (
				<Card style={styles.exampleCard}>
					{block.title ? (
						<Text style={styles.exampleTitle}>{block.title}</Text>
					) : null}
					<Text style={styles.exampleBody}>{block.body}</Text>
				</Card>
			)
		case 'callout':
			return (
				<View
					style={[
						styles.callout,
						block.tone === 'warning'
							? styles.calloutWarning
							: styles.calloutInfo,
					]}
				>
					<Text style={styles.calloutText}>{block.text}</Text>
				</View>
			)
		default:
			return null
	}
}

const styles = StyleSheet.create({
	stack: {
		gap: spacing.md,
	},
	paragraph: {
		...typography.body,
		color: colors.text,
		lineHeight: 26,
	},
	heading: {
		...typography.subtitle,
		color: colors.text,
		marginTop: spacing.sm,
	},
	list: {
		gap: spacing.sm,
	},
	listRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: spacing.sm,
	},
	stepIndex: {
		...typography.body,
		color: colors.primary,
		fontWeight: '700',
		minWidth: 22,
	},
	bullet: {
		...typography.body,
		color: colors.primary,
		minWidth: 14,
	},
	listText: {
		...typography.body,
		color: colors.text,
		flex: 1,
		lineHeight: 26,
	},
	exampleCard: {
		backgroundColor: colors.primarySoft,
		borderColor: colors.border,
		gap: spacing.xs,
	},
	exampleTitle: {
		...typography.subtitle,
		fontSize: 16,
		color: colors.text,
	},
	exampleBody: {
		...typography.body,
		color: colors.text,
		lineHeight: 26,
	},
	callout: {
		borderRadius: radii.md,
		borderWidth: 1,
		padding: spacing.md,
	},
	calloutInfo: {
		backgroundColor: colors.surfaceMuted,
		borderColor: colors.border,
	},
	calloutWarning: {
		backgroundColor: '#FEF2F2',
		borderColor: '#FECACA',
	},
	calloutText: {
		...typography.body,
		color: colors.text,
		lineHeight: 26,
	},
})
