/**
 * Offline user-guide index — section cards for Вязальня help.
 */

import { Ionicons } from '@expo/vector-icons'
import { type Href, router } from 'expo-router'
import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Card } from '@/components/ui/Card'
import { Screen } from '@/components/ui/Screen'
import { GUIDE_SECTIONS } from '@/guide/sections'
import { colors, spacing, typography } from '@/theme/tokens'

const GUIDE_INTRO =
	'Вязальня помогает вести проекты, не сбиваться со счёта рядов, хранить пряжу и схемы, делать расчёты и сохранять историю работы.'

export default function GuideIndexScreen() {
	return (
		<Screen scroll banner="yarn">
			<Text style={styles.title}>Как пользоваться Вязальней</Text>
			<Text style={styles.intro}>{GUIDE_INTRO}</Text>

			<View style={styles.list}>
				{GUIDE_SECTIONS.map((section, index) => (
					<Pressable
						key={section.id}
						accessibilityRole="button"
						accessibilityLabel={section.title}
						onPress={() =>
							router.push(`/guide/${section.id}` as Href)
						}
					>
						<Card style={styles.card}>
							<View style={styles.row}>
								<Text style={styles.index}>{index + 1}</Text>
								<View style={styles.rowText}>
									<Text style={styles.cardTitle}>{section.title}</Text>
									<Text style={styles.cardHint}>{section.teaser}</Text>
								</View>
								<Ionicons
									name="chevron-forward"
									size={20}
									color={colors.textSecondary}
								/>
							</View>
						</Card>
					</Pressable>
				))}
			</View>
		</Screen>
	)
}

const styles = StyleSheet.create({
	title: {
		...typography.title,
		color: colors.text,
		marginBottom: spacing.sm,
	},
	intro: {
		...typography.body,
		color: colors.textSecondary,
		lineHeight: 26,
		marginBottom: spacing.lg,
	},
	list: {
		gap: spacing.sm,
		paddingBottom: spacing.lg,
	},
	card: {
		marginBottom: 0,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
	},
	index: {
		...typography.subtitle,
		color: colors.primary,
		minWidth: 28,
		textAlign: 'center',
	},
	rowText: {
		flex: 1,
		gap: spacing.xs,
	},
	cardTitle: {
		...typography.subtitle,
		color: colors.text,
	},
	cardHint: {
		...typography.body,
		color: colors.textSecondary,
		lineHeight: 22,
	},
})
