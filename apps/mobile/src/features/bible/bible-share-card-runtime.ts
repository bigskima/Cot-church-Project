import { Image, Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import { bibleVerseCardDataUri, bibleVerseCardPngDataUri } from './bible-share-card';

type ShareCardInput = {
  reference: string;
  text: string;
  version?: string;
};

type NativeRenderer = (svgDataUri: string) => Promise<string>;

let nativeLogoDataUri: string | null | undefined;

function dataUriBytes(uri: string) {
  const match = uri.match(/^data:([^;,]+);base64,(.+)$/s);
  if (!match) throw new Error('The generated Scripture card is not a valid PNG.');
  const binary = globalThis.atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function nativeCotLogoDataUri() {
  if (nativeLogoDataUri !== undefined) return nativeLogoDataUri;
  try {
    const asset = Asset.fromModule(require('../../../assets/cot-family-logo.png'));
    await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;
    if (!uri) throw new Error('COT logo asset is unavailable.');
    const file = new File(uri);
    nativeLogoDataUri = 'data:image/png;base64,' + await file.base64();
  } catch {
    nativeLogoDataUri = null;
  }
  return nativeLogoDataUri;
}

async function persistNativePng(dataUri: string, reference: string) {
  const safeReference = reference.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'scripture';
  const file = new File(Paths.cache, `cot-${safeReference}-${Date.now()}.png`);
  file.write(dataUriBytes(dataUri));
  return file.uri;
}

export async function buildBibleShareCardPng(input: ShareCardInput, nativeRenderer?: NativeRenderer) {
  if (Platform.OS === 'web') {
    const logoUrl = Image.resolveAssetSource(require('../../../assets/cot-family-logo.png')).uri;
    const result = await bibleVerseCardPngDataUri({ ...input, logoUrl });
    if (!result.startsWith('data:image/png')) throw new Error('The Scripture card could not be converted to PNG.');
    return result;
  }

  if (!nativeRenderer) throw new Error('The Scripture card renderer is not ready.');
  const logoUrl = await nativeCotLogoDataUri();
  const svg = bibleVerseCardDataUri({ ...input, logoUrl });
  const pngDataUri = await nativeRenderer(svg);
  if (!pngDataUri.startsWith('data:image/png')) throw new Error('The Scripture card could not be converted to PNG.');
  return persistNativePng(pngDataUri, input.reference);
}
