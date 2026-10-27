import { View } from 'react-native';
import { config } from '@/config';

/**
 * A reserved spot for a banner ad.
 *
 * Today it renders nothing, so the app is ad-free. When you're ready for ad revenue:
 *  1. Make sure no catalog data comes from BoardGameGeek's API (Wikidata is fine), or get BGG's commercial license.
 *  2. Create an AdMob account and app IDs for iOS and Android.
 *  3. `npx expo install react-native-google-mobile-ads`, add its plugin to app.json with your app IDs.
 *  4. Replace the return below with <BannerAd unitId={...} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />.
 *  5. Set config.adsEnabled = true. For web/desktop, use Google AdSense instead.
 *
 * Placements already in the app: under Tonight's results, in the Discover list, and in forum threads.
 * Never place ads on the sign-up, profile setup or scan confirmation screens.
 */
export function AdSlot({ placement }: { placement: 'tonight' | 'discover' | 'forum' }) {
  if (!config.adsEnabled) return null;
  return <View accessibilityLabel={`Advertisement (${placement})`} style={{ minHeight: 60 }} />;
}
