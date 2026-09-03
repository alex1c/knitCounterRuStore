/**
 * Create / edit yarn form.
 */

import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Screen } from '@/components/ui/Screen';
import { parseSkeinQuantityInput } from '@/domain/yarnValidation';
import { useDatabase } from '@/providers/DatabaseProvider';
import { Analytics } from '@/services/AnalyticsService';
import { colors, spacing, typography } from '@/theme/tokens';
import { finalizeNumber } from '@/utils/numeric';
import {
  milliskeinsToSkeins,
  parsePriceToMinor,
} from '@/utils/yarnQuantity';

export default function YarnFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { yarnRepository } = useDatabase();

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [colorName, setColorName] = useState('');
  const [colorCode, setColorCode] = useState('');
  const [dyeLot, setDyeLot] = useState('');
  const [composition, setComposition] = useState('');
  const [weightG, setWeightG] = useState('');
  const [lengthM, setLengthM] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit || !id || !yarnRepository) return;
    const yarn = yarnRepository.getYarnById(id);
    if (!yarn) return;

    queueMicrotask(() => {
      setName(yarn.name);
      setBrand(yarn.brand ?? '');
      setColorName(yarn.colorName ?? '');
      setColorCode(yarn.colorCode ?? '');
      setDyeLot(yarn.dyeLot ?? '');
      setComposition(yarn.composition ?? '');
      setWeightG(yarn.weightPerSkeinG?.toString() ?? '');
      setLengthM(yarn.lengthPerSkeinM?.toString() ?? '');
      setQuantity(String(milliskeinsToSkeins(yarn.quantityMilliskeins)));
      setPrice(
        yarn.purchasePriceMinor != null
          ? String(yarn.purchasePriceMinor / 100).replace('.', ',')
          : ''
      );
      setNotes(yarn.notes ?? '');
    });
  }, [isEdit, id, yarnRepository]);

  const handleSave = () => {
    if (!yarnRepository) return;

    try {
      const quantityMilliskeins = parseSkeinQuantityInput(quantity);
      const weightParsed =
        weightG.trim() === '' ? null : finalizeNumber(weightG);
      const lengthParsed =
        lengthM.trim() === '' ? null : finalizeNumber(lengthM);
      const priceMinor =
        price.trim() === '' ? null : parsePriceToMinor(price);

      if (weightParsed != null && (!Number.isInteger(weightParsed) || weightParsed <= 0)) {
        throw new Error('Вес мотка должен быть положительным целым числом');
      }
      if (lengthParsed != null && (!Number.isInteger(lengthParsed) || lengthParsed <= 0)) {
        throw new Error('Метраж мотка должен быть положительным целым числом');
      }

      setSaving(true);
      const payload = {
        name,
        brand: brand.trim() || null,
        colorName: colorName.trim() || null,
        colorCode: colorCode.trim() || null,
        dyeLot: dyeLot.trim() || null,
        composition: composition.trim() || null,
        weightPerSkeinG:
          weightParsed != null ? Math.round(weightParsed) : null,
        lengthPerSkeinM:
          lengthParsed != null ? Math.round(lengthParsed) : null,
        quantityMilliskeins,
        purchasePriceMinor: priceMinor,
        notes: notes.trim() || null,
      };

      if (isEdit && id) {
        yarnRepository.updateYarn(id, payload);
      } else {
        yarnRepository.createYarn(payload);
        Analytics.yarnCreated();
      }
      router.back();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Не удалось сохранить';
      Alert.alert('Ошибка', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen banner="yarn">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>
            {isEdit ? 'Редактировать пряжу' : 'Новая пряжа'}
          </Text>

          <FormField
            label="Название"
            required
            value={name}
            onChangeText={setName}
            placeholder="Lanagold, Jeans…"
          />
          <FormField
            label="Бренд"
            value={brand}
            onChangeText={setBrand}
            placeholder="Alize, YarnArt…"
          />
          <FormField
            label="Цвет"
            value={colorName}
            onChangeText={setColorName}
            placeholder="Название цвета"
          />
          <FormField
            label="Номер цвета"
            value={colorCode}
            onChangeText={setColorCode}
            placeholder="62"
            keyboardType="numeric"
          />
          <FormField
            label="Партия / dye lot"
            value={dyeLot}
            onChangeText={setDyeLot}
            placeholder="1814"
          />
          <FormField
            label="Состав"
            value={composition}
            onChangeText={setComposition}
            placeholder="49% шерсть, 51% акрил"
          />
          <FormField
            label="Вес мотка, г"
            value={weightG}
            onChangeText={setWeightG}
            keyboardType="numeric"
          />
          <FormField
            label="Метраж мотка, м"
            value={lengthM}
            onChangeText={setLengthM}
            keyboardType="numeric"
          />
          <FormField
            label="Количество, мотков"
            required
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            placeholder="1,5"
          />
          <FormField
            label="Цена за моток, ₽"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholder="350"
          />
          <FormField
            label="Заметка"
            value={notes}
            onChangeText={setNotes}
            multiline
            style={styles.notes}
          />

          <View style={styles.actions}>
            <Button title="Сохранить" onPress={handleSave} disabled={saving} />
            <Button title="Отмена" variant="ghost" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { gap: spacing.md, paddingBottom: spacing.xl },
  title: { ...typography.title, color: colors.text },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
