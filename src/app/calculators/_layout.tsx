/**
 * Stack layout for knitting calculator screens.
 */

import { Stack } from 'expo-router';

export default function CalculatorsLayout() {
  return (
    <Stack>
      <Stack.Screen name="stitches-width" options={{ title: 'Петли по ширине' }} />
      <Stack.Screen name="rows-height" options={{ title: 'Ряды по высоте' }} />
      <Stack.Screen name="finished-size" options={{ title: 'Размер по петлям' }} />
      <Stack.Screen name="gauge" options={{ title: 'Плотность вязания' }} />
      <Stack.Screen name="yarn-required" options={{ title: 'Сколько нужно пряжи' }} />
      <Stack.Screen name="yarn-substitution" options={{ title: 'Замена пряжи' }} />
      <Stack.Screen name="increases-decreases" options={{ title: 'Прибавки и убавки' }} />
      <Stack.Screen name="yarn-enough" options={{ title: 'Хватит ли пряжи?' }} />
    </Stack>
  );
}
