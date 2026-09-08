/**
 * Single offline guide section screen.
 */

import { Stack, useLocalSearchParams } from 'expo-router'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Screen } from '@/components/ui/Screen'
import { GuideBlocks } from '@/guide/GuideBlocks'
import { getGuideSection } from '@/guide/sections'
import { colors, spacing, typography } from '@/theme/tokens'

export default function GuideSectionScreen() {
	const params = useLocalSearchParams<{ sectionId?: string | string[] }>()
	const rawId = Array.isArray(params.sectionId)
		? params.sectionId[0]
		: params.sectionId
	const section = rawId ? getGuideSection(rawId) : undefined

	if (!section) {
		return (
			<Screen scroll banner="yarn">
				<Stack.Screen options={{ title: 'Раздел' }} />
				<Text style={styles.title}>Раздел не найден</Text>
				<Text style={styles.body}>
					Вернитесь к списку «Как пользоваться Вязальней» и выберите раздел
					снова.
				</Text>
			</Screen>
		)
	}

	return (
		<Screen scroll banner="yarn">
			<Stack.Screen options={{ title: section.title }} />
			<View style={styles.content}>
				<Text style={styles.title}>{section.heading}</Text>
				<GuideBlocks blocks={section.blocks} />
			</View>
		</Screen>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: spacing.xl,
		gap: spacing.md,
	},
	title: {
		...typography.title,
		color: colors.text,
	},
	body: {
		...typography.body,
		color: colors.textSecondary,
		lineHeight: 26,
	},
})
