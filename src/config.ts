/**
 * App-wide switches. Change these as the business grows.
 */
export const config = {
  /**
   * Ads stay OFF until two things are true:
   *  1. The app uses no BoardGameGeek API data, or you have BGG's commercial license (ads count as commercial use).
   *  2. You have an AdMob account and have added react-native-google-mobile-ads
   *     (see README → "Turning on ads").
   */
  adsEnabled: false,

  /** Free photo scans per user per day. The server enforces the same number. */
  dailyScanLimit: 5,

  /** Shown on the sign-up screen and in Settings. Host these pages before launch. */
  termsUrl: 'https://example.com/terms',
  privacyUrl: 'https://example.com/privacy',
  supportEmail: 'support@example.com',
};
