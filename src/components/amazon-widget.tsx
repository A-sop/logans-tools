'use client';

import Script from 'next/script';

/** Amazon.de Associates widget. Import and use where needed (e.g. Book Club page). */
const AMAZON_WIDGET_URL =
  'https://ws-eu.amazon-adsystem.com/widgets/q?ServiceVersion=20070822&MarketPlace=DE&ID=V20070822%2FDE%2F130984-21%2F8005%2F20143404-616b-4f2c-adc6-0b284c8a588d';
const AMAZON_NOSCRIPT_URL = `${AMAZON_WIDGET_URL}&Operation=NoScript`;

export function AmazonWidget() {
  return (
    <div className="amazon-widget-container">
      <Script id="amazon-widget" strategy="lazyOnload" src={AMAZON_WIDGET_URL} />
      <noscript>
        <a
          rel="nofollow"
          href={AMAZON_NOSCRIPT_URL}
          className="text-sm text-muted-foreground hover:underline"
        >
          Amazon.de Widgets
        </a>
      </noscript>
    </div>
  );
}
