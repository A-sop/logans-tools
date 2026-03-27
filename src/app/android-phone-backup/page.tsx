import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Android Phone Backup to Local PC | Logans.Tools',
  description:
    'Set up Android backups over USB and local network to a Windows staging folder that your external HDD backup already copies.',
};

const STANDARD_FOLDERS = [
  'DCIM',
  'Pictures',
  'Movies',
  'Music',
  'Documents',
  'Download',
  'Recordings',
];

const STAGING_LAYOUT = [
  'Android-Phone/',
  '  incoming/                # Syncthing receives here',
  '  usb-snapshots/',
  '    YYYY-MM-DD/            # Manual USB snapshots by date',
  '  adb-snapshots/',
  '    YYYY-MM-DD/            # Optional power-user ADB pulls',
  '  logs/                    # Optional copy logs',
];

export default function AndroidPhoneBackupPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-12 px-4 py-12 sm:py-20">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Android phone backup → local PC → external HDD
        </h1>
        <p className="text-sm text-muted-foreground">
          Build a reliable local backup flow on Windows 11. Phone files land in
          one staging folder on this PC, then your scheduled HDD backup job
          copies that folder to external storage.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">How this system works</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Pick one staging root on this PC (example: `D:\Backups\`).</li>
          <li>
            Save phone data into `Android-Phone\` via USB and/or local network.
          </li>
          <li>
            Keep your existing scheduled external-HDD backup pointed at the
            parent folder.
          </li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recommended staging layout</h2>
        <p className="text-sm text-muted-foreground">
          Keep all phone backup data under one predictable tree. This makes
          scheduled copy jobs simpler and less error-prone.
        </p>
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-xs text-foreground">
          <code>{STAGING_LAYOUT.join('\n')}</code>
        </pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          LAN backup (default): Syncthing
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Install Syncthing on Windows and Android, then allow Windows
            firewall access on private networks.
          </li>
          <li>
            On PC, create/select receive folder:
            `...\Android-Phone\incoming\`.
          </li>
          <li>
            On phone, share source folders (start with high-value folders, then
            expand).
          </li>
          <li>
            Disable battery optimization for Syncthing on Android to improve
            sync reliability.
          </li>
          <li>
            First sync can take time; verify file counts before deleting
            anything from phone.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">USB backup: MTP snapshots</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Connect phone via USB and choose file transfer mode (MTP).</li>
          <li>
            Copy visible phone storage folders into a dated snapshot folder:
            `...\Android-Phone\usb-snapshots\YYYY-MM-DD\`.
          </li>
          <li>
            Use this path for occasional full grabs or when Wi-Fi sync is slow.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Optional power-user path: ADB pulls
        </h2>
        <p className="text-sm text-muted-foreground">
          If you use Android developer tools, you can pull known directories.
          This is optional and not required for the default setup.
        </p>
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-xs text-foreground">
          <code>{`# Example commands (after installing platform-tools):
adb devices
adb pull /sdcard/DCIM      "D:\\Backups\\Android-Phone\\adb-snapshots\\YYYY-MM-DD\\DCIM"
adb pull /sdcard/Documents "D:\\Backups\\Android-Phone\\adb-snapshots\\YYYY-MM-DD\\Documents"`}</code>
        </pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">What “everything” means here</h2>
        <p className="text-sm text-muted-foreground">
          This guide targets broad user-accessible storage coverage, not every
          app&apos;s private internal data.
        </p>
        <div className="flex flex-wrap gap-2">
          {STANDARD_FOLDERS.map((folder) => (
            <span
              key={folder}
              className="rounded-md border border-border bg-muted px-2 py-1 text-xs tabular-nums"
            >
              {folder}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-6">
        <h2 className="text-base font-semibold">Security and privacy notes</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Do not publish screenshots showing personal local paths.</li>
          <li>Keep backups on trusted local devices only.</li>
          <li>
            Verify the external HDD job includes your full `Android-Phone\`
            tree.
          </li>
        </ul>
      </section>

      <section className="space-y-2 text-sm text-muted-foreground">
        <p>Want copy-and-paste command templates? See `scripts/README-android-backup.md` in this repo.</p>
        <p>
          Back to the{' '}
          <Link href="/" className="text-primary hover:underline">
            home page
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
