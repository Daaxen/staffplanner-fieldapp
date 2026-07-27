import { Link } from 'react-router-dom';

const Terms = () => (
  <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground">← Back</Link>
        <h1 className="text-2xl font-semibold mt-2">Terms of Service</h1>
        <p className="text-xs text-muted-foreground mt-1">Last updated: 27 July 2026</p>
      </div>

      <section className="space-y-3 text-sm leading-relaxed">
        <p>
          These Terms govern your use of the StaffPlanner application ("the Service")
          provided by <strong>Dynamic Places AB</strong> (org. nr. 559431-4642),
          Stockholm, Sweden.
        </p>

        <h2 className="text-base font-semibold pt-2">1. Accounts</h2>
        <p>
          Access is invitation-based. You are responsible for keeping your credentials
          secure and for activity performed under your account.
        </p>

        <h2 className="text-base font-semibold pt-2">2. Acceptable use</h2>
        <p>
          You agree not to misuse the Service, attempt to gain unauthorized access,
          or upload unlawful content. Administrators may suspend accounts that
          violate these Terms.
        </p>

        <h2 className="text-base font-semibold pt-2">3. Data</h2>
        <p>
          Data you enter belongs to your organisation. Personal data is processed
          according to our <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>

        <h2 className="text-base font-semibold pt-2">4. Availability</h2>
        <p>
          The Service is provided "as is" without warranties of uninterrupted
          availability. We aim to maintain reliable operation but do not guarantee
          it will be error-free.
        </p>

        <h2 className="text-base font-semibold pt-2">5. Liability</h2>
        <p>
          To the extent permitted by Swedish law, our liability for any claim is
          limited to fees paid for the Service in the 12 months preceding the claim.
        </p>

        <h2 className="text-base font-semibold pt-2">6. Governing law</h2>
        <p>
          These Terms are governed by Swedish law. Disputes shall be resolved by
          Swedish courts, with Stockholm District Court as the court of first instance.
        </p>

        <h2 className="text-base font-semibold pt-2">7. Contact</h2>
        <p>Dynamic Places AB, Stockholm, Sweden.</p>
      </section>
    </div>
  </div>
);

export default Terms;
