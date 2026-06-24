import { defineManifest } from '@crxjs/vite-plugin';

const COPY_AI_ID_STABLE_MANIFEST_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA22ev8MmCwlWx564ISSie+6UkJ6YYtbrfn1pz+jPbJzrgU4y6XXrDsAMBH0cNWr952M6NMBy8CKCj328XKIOf/OIxAiQ5KHvf216mbJ+iy7MQAcdzBZgnxtzOSuTvYdj4y9HjRUTjYdYGnZAUWs3MkuaghyLho58iAktMZdcX8DZMQiivmekFXoZtn6RywAh+oqRbsqGr3o1HQZNjORggMbvSJCobNFvjJSQ8x2RG45cwcpfGaOUaXrmZJzU4drbKSdyV/zBS+ZncZB7h410SgdYInq0w8pmGb5xZEYzBUViNzZx3BmlOQoo619ehMeWWJ5aVWG3aFy//9faW+OClnwIDAQAB';

// Public RSA SPKI key used only to keep the unpacked development extension ID stable.
// Expected local extension ID: fjakahhodjlfgoijjkpedmbbelcgfkik.
// This is not a signing secret; do not commit the private key.
// Chrome Web Store uploads must omit this field unless it exactly matches the
// store item's signing key. Enable it only for local builds that need the
// stable unpacked extension ID.

declare const process: {
  env?: Record<string, string | undefined>;
} | undefined;

const INCLUDE_STABLE_MANIFEST_KEY = process?.env?.COPY_AI_ID_INCLUDE_MANIFEST_KEY === '1';

export default defineManifest({
  manifest_version: 3,
  ...(INCLUDE_STABLE_MANIFEST_KEY ? { key: COPY_AI_ID_STABLE_MANIFEST_KEY } : {}),
  default_locale: 'en',
  name: '__MSG_extensionName__',
  description: '__MSG_extensionDescription__',
  version: '0.1.10',
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  permissions: ['storage'],
  host_permissions: ['<all_urls>', 'http://127.0.0.1/*', 'http://localhost/*'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  action: {
    default_title: '__MSG_extensionName__',
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/bootstrap/index.ts'],
      run_at: 'document_idle',
      all_frames: true,
      match_about_blank: true,
    },
  ],
});
