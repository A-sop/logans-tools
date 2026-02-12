import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Legal',
  description:
    'Impressum, Datenschutz, and legal information for Logan Williams.',
};

export default function LegalPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Legal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Impressum, Datenschutz, and disclaimers
        </p>
      </div>

      <nav className="flex flex-wrap gap-4 text-sm">
        <a href="#impressum" className="text-primary hover:underline">
          Imprint / Impressum
        </a>
        <a href="#schlichtung" className="text-primary hover:underline">
          Arbitration / Schlichtung
        </a>
        <a href="#haftung" className="text-primary hover:underline">
          Disclaimer / Haftung
        </a>
        <a href="#datenschutz" className="text-primary hover:underline">
          Privacy / Datenschutz
        </a>
        <a href="#copyright" className="text-primary hover:underline">
          Copyright / Urheberrecht
        </a>
      </nav>

      <Card id="impressum">
        <CardHeader>
          <CardTitle className="text-lg">Imprint / Impressum</CardTitle>
          <CardDescription>§5 TMG Information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <section>
            <h3 className="font-medium text-foreground mb-1">Logan D. Williams</h3>
            <p className="text-muted-foreground">
              Zülpicher Wall 16
              <br />
              50674 Köln
              <br />
              Telefon: +49 157 92373917
              <br />
              E-Mail: inbox@loganwilliams.com
            </p>
            <p className="mt-2 text-muted-foreground">
              Vertreten durch: Logan D. Williams
              <br />
              USt.-ID.: DE338400422
            </p>
          </section>
          <section>
            <p className="text-muted-foreground">
              Im Versicherungsbereich als gebundener Vermittler gemäß § 34d Abs.
              7 GewO auf Provisionsbasis ausschließlich vermittelnd und beratend
              tätig für die Generali Deutschland Lebensversicherung, Generali
              Deutschland Versicherung, Generali Deutschland Krankenversicherung,
              Generali Pensionskasse, ADVOCARD Rechtsschutzversicherung.
              Darüber hinaus können in Einzelfällen geldwerte Vorteile in Form
              von Sachleistungen anfallen (z.B. Schulungen sowie Einladungen für
              die Teilnahme an kulturellen und gesellschaftlichen
              Veranstaltungen, Informationsmaterial, Aufmerksamkeiten).
            </p>
          </section>
          <section>
            <p className="text-muted-foreground">
              Der Nutzung von im Rahmen der Impressumspflicht veröffentlichten
              Kontaktdaten durch Dritte zur Übersendung von nicht ausdrücklich
              angeforderter Werbung und Informationsmaterialien wird hiermit
              ausdrücklich widersprochen. Die Betreiber der Seiten behalten sich
              ausdrücklich rechtliche Schritte im Falle der unverlangten
              Zusendung von Werbeinformationen, etwa durch Spam-Mails, vor.
            </p>
          </section>
        </CardContent>
      </Card>

      <Card id="schlichtung">
        <CardHeader>
          <CardTitle className="text-lg">
            Arbitration and Registration / Schlichtungs- und Registerstellen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Schlichtungsstellen: Verein Versicherungsombudsmann e.V., Postfach
            080632, 10006 Berlin. Ombudsmann Private Kranken- und
            Pflegeversicherung, Postfach 060222, 10052 Berlin —
            www.versicherungsombudsmann.de, www.pkv-ombudsmann.de
          </p>
          <p>
            Erlaubnis- und Aufsichtsbehörde gemäß § 34c GewO: Stadt Köln,
            Willy-Brandt-Platz 3, 50679 Köln
          </p>
          <p>
            Gemeinsame Registerstelle für § 34d GewO: Deutscher Industrie- und
            Handelskammertag (DIHK) e.V., Breite Straße 29, 10178 Berlin,
            www.vermittlerregister.info. Registernummer nach § 34d GewO:
            D-QEUR-ITNAF-11
          </p>
        </CardContent>
      </Card>

      <Card id="haftung">
        <CardHeader>
          <CardTitle className="text-lg">
            Disclaimer / Haftungshinweis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Die Vermögensberater nehmen keine Kundengelder entgegen. Zahlungen
            erfolgen direkt von den Kunden an die jeweiligen Produktpartner.
          </p>
          <p>
            Haftungshinweis: Trotz sorgfältiger inhaltlicher Kontrolle übernehmen
            wir keine Haftung für die Inhalte externer Links. Für den Inhalt der
            verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.
          </p>
        </CardContent>
      </Card>

      <Card id="datenschutz">
        <CardHeader>
          <CardTitle className="text-lg">
            Privacy Policy (GDPR) / Datenschutz (DSGVO)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm text-muted-foreground">
          <p>
            Thank you for visiting loganwilliams.com. We are committed to
            protecting your personal information and your right to privacy. If
            you have any questions, please contact{' '}
            <a
              href="mailto:inbox@loganwilliams.com"
              className="text-primary hover:underline"
            >
              inbox@loganwilliams.com
            </a>
            .
          </p>
          <section>
            <h4 className="font-medium text-foreground mb-2">
              What information do we collect? / Welche Informationen sammeln wir?
            </h4>
            <p>
              We collect personal information that you voluntarily provide when
              contacting us or using our services (e.g. name, email, phone). We
              also automatically collect certain technical information when you
              visit our sites (IP address, browser type, device information) for
              security and analytics purposes.
            </p>
          </section>
          <section>
            <h4 className="font-medium text-foreground mb-2">
              How we use your information
            </h4>
            <p>
              We use your information to respond to inquiries, provide services,
              improve our website, and comply with legal obligations. We do not
              sell your personal information.
            </p>
          </section>
          <section>
            <h4 className="font-medium text-foreground mb-2">
              Cookies and similar technologies
            </h4>
            <p>
              We use cookies and similar technologies (e.g. Google Tag Manager)
              for analytics and site functionality. You can control cookies
              through your browser settings.
            </p>
          </section>
          <section>
            <h4 className="font-medium text-foreground mb-2">Your rights</h4>
            <p>
              Under GDPR you have the right to access, rectify, erase, restrict
              processing, and data portability. You may also object or withdraw
              consent. Contact us to exercise these rights.
            </p>
          </section>
        </CardContent>
      </Card>

      <Card id="copyright">
        <CardHeader>
          <CardTitle className="text-lg">
            Copyright / Urheberrecht
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf
            diesen Seiten unterliegen dem deutschen Urheberrecht. Die
            Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
            Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der
            schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
            Downloads und Kopien dieser Seite sind nur für den privaten, nicht
            kommerziellen Gebrauch gestattet. Soweit die Inhalte auf dieser
            Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte
            Dritter beachtet. Sollten Sie trotzdem auf eine
            Urheberrechtsverletzung aufmerksam werden, bitten wir um einen
            entsprechenden Hinweis.
          </p>
        </CardContent>
      </Card>

      <div className="pt-4 text-center text-sm text-muted-foreground">
        <Link href="/" className="text-primary hover:underline">
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
