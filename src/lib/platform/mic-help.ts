// Detects the user's OS + browser and returns platform-tailored microphone
// permission instructions. Pure client code.

export type Platform =
  | "ios-safari"
  | "ios-chrome"
  | "ios-other"
  | "android-chrome"
  | "android-firefox"
  | "android-other"
  | "macos-safari"
  | "macos-chrome"
  | "macos-edge"
  | "macos-firefox"
  | "windows-chrome"
  | "windows-edge"
  | "windows-firefox"
  | "linux-chrome"
  | "linux-firefox"
  | "unknown";

export type MicHelp = {
  title: string;
  intro?: string;
  steps: string[];
  deepLink?: { href: string; label: string; copy?: boolean };
  note?: string;
};

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  const isAndroid = /Android/i.test(ua);
  const isMac = !isIOS && /Macintosh|Mac OS X/i.test(ua);
  const isWin = /Windows/i.test(ua);
  const isLinux = !isAndroid && /Linux/i.test(ua);

  const isEdge = /Edg\//.test(ua);
  const isChrome = /Chrome\//.test(ua) && !isEdge && !/CriOS/.test(ua);
  const isCriOS = /CriOS/.test(ua); // Chrome on iOS
  const isFxiOS = /FxiOS/.test(ua);
  const isFirefox = /Firefox\//.test(ua);
  const isSafari = /Safari\//.test(ua) && !isChrome && !isEdge && !isCriOS && !isFxiOS && !isFirefox;

  if (isIOS) {
    if (isSafari) return "ios-safari";
    if (isCriOS) return "ios-chrome";
    return "ios-other";
  }
  if (isAndroid) {
    if (isChrome) return "android-chrome";
    if (isFirefox) return "android-firefox";
    return "android-other";
  }
  if (isMac) {
    if (isSafari) return "macos-safari";
    if (isEdge) return "macos-edge";
    if (isFirefox) return "macos-firefox";
    if (isChrome) return "macos-chrome";
  }
  if (isWin) {
    if (isEdge) return "windows-edge";
    if (isFirefox) return "windows-firefox";
    if (isChrome) return "windows-chrome";
  }
  if (isLinux) {
    if (isFirefox) return "linux-firefox";
    if (isChrome) return "linux-chrome";
  }
  return "unknown";
}

const GENERIC_STEPS = [
  "Tap or click the lock (or camera) icon in the address bar.",
  "Open Site settings and set Microphone to Allow.",
  "Reload the page and try again.",
];

export function micHelpFor(p: Platform): MicHelp {
  switch (p) {
    case "ios-safari":
      return {
        title: "Enable mic on iPhone / iPad Safari",
        steps: [
          "Open the iOS Settings app.",
          "Scroll down and tap Safari.",
          "Tap Microphone, then set this site to Allow.",
          "Return here and press the mic again.",
        ],
        note: "iOS doesn't let websites open Settings directly — you have to do it once.",
      };
    case "ios-chrome":
      return {
        title: "Enable mic on iPhone Chrome",
        steps: [
          "Open the iOS Settings app.",
          "Scroll down and tap Chrome.",
          "Turn on Microphone.",
          "Come back and press the mic again.",
        ],
      };
    case "ios-other":
      return {
        title: "Enable mic on iPhone / iPad",
        steps: [
          "Open the iOS Settings app.",
          "Find your browser in the list and tap it.",
          "Turn on Microphone, then reload this page.",
        ],
      };
    case "android-chrome":
      return {
        title: "Enable mic on Android Chrome",
        steps: [
          "Tap the lock icon left of the address bar.",
          "Tap Permissions → Microphone.",
          "Choose Allow, then reload this page.",
        ],
        deepLink: {
          href:
            "intent://settings/site_settings/microphone#Intent;scheme=chrome;package=com.android.chrome;end",
          label: "Open Chrome mic settings",
        },
      };
    case "android-firefox":
      return {
        title: "Enable mic on Android Firefox",
        steps: [
          "Tap the shield icon left of the address bar.",
          "Open Site permissions → Microphone.",
          "Choose Allow, then reload the page.",
        ],
      };
    case "android-other":
      return {
        title: "Enable mic on Android",
        steps: [
          "Tap the lock / info icon in the address bar.",
          "Open Site settings → Microphone and choose Allow.",
          "Reload the page.",
        ],
      };
    case "macos-safari":
      return {
        title: "Enable mic on Mac Safari",
        steps: [
          "In the menu bar, click Safari → Settings.",
          "Open Websites → Microphone.",
          "Set this site to Allow, then reload.",
        ],
      };
    case "macos-chrome":
    case "windows-chrome":
    case "linux-chrome":
      return {
        title: "Enable mic in Chrome",
        steps: [
          "Paste the address below into a new tab.",
          "Find this site in the list and set Microphone to Allow.",
          "Return here and reload.",
        ],
        deepLink: {
          href: "chrome://settings/content/microphone",
          label: "Copy chrome://settings/content/microphone",
          copy: true,
        },
        note: "Browsers block links to chrome:// URLs, so it has to be pasted manually.",
      };
    case "macos-edge":
    case "windows-edge":
      return {
        title: "Enable mic in Microsoft Edge",
        steps: [
          "Paste the address below into a new tab.",
          "Find this site and set Microphone to Allow.",
          "Return here and reload.",
        ],
        deepLink: {
          href: "edge://settings/content/microphone",
          label: "Copy edge://settings/content/microphone",
          copy: true,
        },
      };
    case "macos-firefox":
    case "windows-firefox":
    case "linux-firefox":
      return {
        title: "Enable mic in Firefox",
        steps: [
          "Click the padlock left of the address bar.",
          "Under Permissions, remove the Microphone block.",
          "Reload the page and allow when prompted.",
        ],
        deepLink: {
          href: "about:preferences#privacy",
          label: "Copy about:preferences#privacy",
          copy: true,
        },
      };
    default:
      return { title: "Enable microphone access", steps: GENERIC_STEPS };
  }
}

export const PLATFORM_LABELS: Array<{ value: Platform; label: string }> = [
  { value: "ios-safari", label: "iPhone / iPad — Safari" },
  { value: "ios-chrome", label: "iPhone / iPad — Chrome" },
  { value: "android-chrome", label: "Android — Chrome" },
  { value: "android-firefox", label: "Android — Firefox" },
  { value: "macos-safari", label: "Mac — Safari" },
  { value: "macos-chrome", label: "Mac — Chrome" },
  { value: "macos-edge", label: "Mac — Edge" },
  { value: "macos-firefox", label: "Mac — Firefox" },
  { value: "windows-chrome", label: "Windows — Chrome" },
  { value: "windows-edge", label: "Windows — Edge" },
  { value: "windows-firefox", label: "Windows — Firefox" },
  { value: "linux-chrome", label: "Linux — Chrome" },
  { value: "linux-firefox", label: "Linux — Firefox" },
  { value: "unknown", label: "Other browser" },
];
