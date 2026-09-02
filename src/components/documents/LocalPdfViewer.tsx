/**
 * Offline native PDF viewer for managed local files.
 *
 * Uses react-native-pdf with a direct file:// URI.
 * No CDN, no base64, no network — PDF bytes stay on disk until opened here.
 */

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Pdf from 'react-native-pdf';

import { colors } from '@/theme/tokens';

type Props = {
  fileUri: string;
  onLoadError: () => void;
};

export function LocalPdfViewer({ fileUri, onLoadError }: Props) {
  const [loading, setLoading] = useState(true);

  const handleLoadComplete = useCallback(() => {
    setLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setLoading(false);
    onLoadError();
  }, [onLoadError]);

  return (
    <View style={styles.container}>
      <Pdf
        source={{ uri: fileUri, cache: true }}
        style={styles.pdf}
        onLoadComplete={handleLoadComplete}
        onError={handleError}
        trustAllCerts={false}
        enablePaging={false}
        horizontal={false}
        spacing={8}
        fitPolicy={0}
        minScale={1}
        maxScale={4}
      />
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  pdf: { flex: 1, backgroundColor: colors.surface },
  loadingWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
});
