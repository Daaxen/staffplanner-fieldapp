import { Link } from 'react-router-dom';

const Privacy = () => (
  <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground">← Back</Link>
        <h1 className="text-2xl font-semibold mt-2">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground mt-1">Last updated: 27 July 2026</p>
      </div>

      <section className="space-y-3 text-sm leading-relaxed">
        <p>
          This Privacy Policy describes how <strong>Dynamic Places AB</strong> (org. nr.
          559431-4642), based in Stockholm, Sweden ("we", "us"), processes personal data
          in the StaffPlanner application ("the Service"). We are the data controller
          for personal data collected through the Service.
        </p>

        <h2 className="text-base font-semibold pt-2">1. Data we collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Account: name, email, password (hashed), role.</li>
          <li>Profile: phone, address, emergency contact, avatar (optional).</li>
          <li>Operational: projects, assignments, schedules, sign-offs, uploaded photos and documents.</li>
          <li>Technical: log data required to operate and secure the Service.</li>
        </ul>

        <h2 className="text-base font-semibold pt-2">2. Purposes and legal basis (GDPR Art. 6)</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Contract</strong> (Art. 6.1.b): providing accounts, scheduling, dispatch, and reporting.</li>
          <li><strong>Legitimate interest</strong> (Art. 6.1.f): operating, securing, and improving the Service.</li>
          <li><strong>Legal obligation</strong> (Art. 6.1.c): accounting and tax records where applicable.</li>
        </ul>
        <p>We do not use your data for marketing and we do not use analytics or advertising cookies.</p>

        <h2 className="text-base font-semibold pt-2">3. Cookies</h2>
        <p>
          The Service uses only strictly necessary storage (session/authentication).
          No tracking, analytics, or marketing cookies are set.
        </p>

        <h2 className="text-base font-semibold pt-2">4. Subprocessors</h2>
        <p>
          We use Lovable Cloud (backed by Supabase) for hosting, database, authentication,
          and file storage. Data is stored within the EU where offered by the provider.
        </p>

        <h2 className="text-base font-semibold pt-2">5. Retention</h2>
        <p>
          Personal data is kept for as long as your account is active and as required by
          law. You can request deletion at any time; some records may be retained where
          legally required.
        </p>

        <h2 className="text-base font-semibold pt-2">6. Your rights</h2>
        <p>
          Under GDPR you have the right to access, rectify, erase, restrict, port, and
          object to processing of your personal data. You may also lodge a complaint
          with the Swedish supervisory authority (IMY, imy.se).
        </p>

        <h2 className="text-base font-semibold pt-2">7. Contact</h2>
        <p>
          Dynamic Places AB, Stockholm, Sweden. For privacy questions, contact your
          administrator or the account owner within your organisation.
        </p>
      </section>
    </div>
  </div>
);

export default Privacy;
