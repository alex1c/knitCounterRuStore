/**
 * Stack navigation for the offline user guide.
 */

import { Stack } from 'expo-router'

export default function GuideLayout() {
	return (
		<Stack>
			<Stack.Screen
				name="index"
				options={{ title: 'Как пользоваться Вязальней' }}
			/>
			<Stack.Screen
				name="[sectionId]"
				options={{ title: 'Раздел' }}
			/>
		</Stack>
	)
}
