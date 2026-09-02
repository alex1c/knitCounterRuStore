/**
 * Hook to load yarn inventory with search and sort.
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import type { Yarn } from '@/domain/types';
import type { YarnSortMode } from '@/repositories/YarnRepository';
import { useDatabase } from '@/providers/DatabaseProvider';

export function useYarnInventory() {
  const { yarnRepository } = useDatabase();
  const [items, setItems] = useState<Yarn[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<YarnSortMode>('name');

  const reload = useCallback(() => {
    if (!yarnRepository) {
      setItems([]);
      setLoading(false);
      return;
    }
    const list = yarnRepository.searchYarns(query, sort);
    setItems(list);
    setLoading(false);
  }, [yarnRepository, query, sort]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      reload();
    }, [reload])
  );

  return { items, loading, query, setQuery, sort, setSort, reload };
}
