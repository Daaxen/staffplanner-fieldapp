## Connect your custom domain

You can point a domain you already own at this app. No code changes needed — it's all done in Project Settings.

### Steps

1. **Publish the app first** (required before a custom domain can be attached).
   - Click **Publish** (top right). This creates your `*.lovable.app` URL.

2. **Open domain settings**
   - **Project Settings → Project → Domains** (or in the Publish dialog → *Add custom domain*).

3. **Choose one of two paths**

   **A. Buy a domain through Lovable** (simplest — DNS is auto-configured)
   - Click **Buy new domain**, search, purchase. It's connected automatically.

   **B. Connect a domain you own at another registrar**
   - Click **Connect Domain**, enter `yourdomain.com`.
   - Add the DNS records Lovable shows you at your registrar:
     - **A record** — Name `@`, Value `185.158.133.1`
     - **A record** — Name `www`, Value `185.158.133.1`
     - **TXT record** — Name `_lovable`, Value `lovable_verify=...` (shown in the UI)
   - Add both `yourdomain.com` and `www.yourdomain.com` as separate entries, then pick one as **Primary** (the other redirects to it).
   - If you use Cloudflare or a similar proxy, expand **Advanced** and tick *"Domain uses Cloudflare or a similar proxy"* — this switches to CNAME-based verification.

4. **Wait for propagation & SSL**
   - DNS can take up to 72h (usually minutes). SSL is provisioned automatically once verified.
   - Status will move: *Verifying → Setting up → Active*.

### About the build error

The stderr trace you pasted is the same transient "stale missing file" error we've seen before — Vite tried to read a file that was mid-write. No code fix is needed for the domain question. If you'd like, I can re-run the build to confirm it's green before you publish.

### What I need from you

- Confirm you want to **connect an existing domain** (path B) or **buy one through Lovable** (path A).
- If path B: share the domain name so I can walk you through the exact records after you kick off the connect flow.

Nothing to implement in code — this is all configuration in the Lovable UI.