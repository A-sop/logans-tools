import type { Locale } from '@/lib/i18n';

export type SearchDocument = {
  id: string;
  locale: Locale;
  href: string;
  title: string;
  description: string;
  keywords: string[];
};

export const SEARCH_INDEX: SearchDocument[] = [
  {
    id: 'home-en',
    locale: 'en',
    href: '/',
    title: 'Home',
    description: 'Overview of tools, concierge concept, and workflow notes.',
    keywords: ['home', 'tools', 'concierge', 'workflow'],
  },
  {
    id: 'android-backup-en',
    locale: 'en',
    href: '/android-phone-backup',
    title: 'Android phone backup',
    description: 'Guide for Android backup over USB and LAN to a local folder.',
    keywords: ['android', 'backup', 'usb', 'lan', 'guide'],
  },
  {
    id: 'dev-test-en',
    locale: 'en',
    href: '/dev-test',
    title: 'Dev test page',
    description: 'Design system and integration checks for development.',
    keywords: ['dev', 'test', 'components', 'integration'],
  },
  {
    id: 'home-de',
    locale: 'de',
    href: '/',
    title: 'Startseite',
    description: 'Ueberblick ueber Tools, Concierge-Idee und Workflow-Notizen.',
    keywords: ['startseite', 'tools', 'concierge', 'workflow'],
  },
  {
    id: 'android-backup-de',
    locale: 'de',
    href: '/android-phone-backup',
    title: 'Android-Backup',
    description: 'Anleitung fuer Android-Backup per USB und LAN in einen lokalen Ordner.',
    keywords: ['android', 'backup', 'usb', 'lan', 'anleitung'],
  },
  {
    id: 'dev-test-de',
    locale: 'de',
    href: '/dev-test',
    title: 'Dev-Testseite',
    description: 'Designsystem- und Integrationschecks fuer die Entwicklung.',
    keywords: ['dev', 'test', 'designsystem', 'integration'],
  },
];

