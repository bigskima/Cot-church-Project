import { Linking, Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

function safeFileName(value?: string | null) {
  const normalized = String(value || 'cot-file').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ');
  return normalized || 'cot-file';
}

function webDownload(url: string, fileName: string) {
  if (typeof document === 'undefined') return Linking.openURL(url);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener noreferrer';
  anchor.target = '_blank';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return Promise.resolve();
}

export async function downloadFile(url: string, fileName?: string | null) {
  if (!url) throw new Error('This file is not available for download.');
  const normalizedName = safeFileName(fileName);
  if (Platform.OS === 'web') return webDownload(url, normalizedName);

  const destination = new File(Paths.cache, `${Date.now()}-${normalizedName}`);
  const downloaded = await File.downloadFileAsync(url, destination);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(downloaded.uri, { dialogTitle: 'Save or share file' });
    return;
  }
  await Linking.openURL(downloaded.uri);
}
