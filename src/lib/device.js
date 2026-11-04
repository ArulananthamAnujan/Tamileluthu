// What kind of phone/browser this is, for the install instructions.
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
export const isIOS = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
export const isAndroid = /android/i.test(ua);
// The iPhone app (ios/). Apple does not allow buying digital services inside an iPhone app
// except through Apple, so the app hides purchase buttons; families buy on the website.
export const iosApp = /ThiruthiIOS/.test(ua);
// Apps that open links inside their own browser, where "Add to Home Screen" is not available.
export const inAppBrowser = /FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|TikTok|MicroMessenger|GSA\//i.test(ua);
export const isInstalled = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true || /ThiruthiApp/.test(ua);
