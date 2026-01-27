<purpose>
Authentication gate handling for execute-plan.md. Load this file dynamically when an authentication error is encountered during task execution.
</purpose>

<trigger>
Load this file when CLI/API returns authentication errors:
- "Error: Not authenticated", "Not logged in", "Unauthorized", "401", "403"
- "Authentication required", "Invalid API key", "Missing credentials"
- "Please run {tool} login" or "Set {ENV_VAR} environment variable"
</trigger>

<authentication_gates>

## Handling Authentication Errors During Execution

**When you encounter authentication errors during `type="auto"` task execution:**

This is NOT a failure. Authentication gates are expected and normal. Handle them dynamically:

**Authentication error indicators:**

- CLI returns: "Error: Not authenticated", "Not logged in", "Unauthorized", "401", "403"
- API returns: "Authentication required", "Invalid API key", "Missing credentials"
- Command fails with: "Please run {tool} login" or "Set {ENV_VAR} environment variable"

**Authentication gate protocol:**

1. **Recognize it's an auth gate** - Not a bug, just needs credentials
2. **STOP current task execution** - Don't retry repeatedly
3. **Create dynamic checkpoint:human-action** - Present it to user immediately
4. **Provide exact authentication steps** - CLI commands, where to get keys
5. **Wait for user to authenticate** - Let them complete auth flow
6. **Verify authentication works** - Test that credentials are valid
7. **Retry the original task** - Resume automation where you left off
8. **Continue normally** - Don't treat this as an error in Summary

**Example: Vercel deployment hits auth error**

```
Task 3: Deploy to Vercel
Running: vercel --yes

Error: Not authenticated. Please run 'vercel login'

[Create checkpoint dynamically]

╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Action Required                          ║
╚═══════════════════════════════════════════════════════╝

Progress: 2/8 tasks complete
Task: Authenticate Vercel CLI

Attempted: vercel --yes
Error: Not authenticated

What you need to do:
  1. Run: vercel login
  2. Complete browser authentication

I'll verify: vercel whoami returns your account

────────────────────────────────────────────────────────
→ YOUR ACTION: Type "done" when authenticated
────────────────────────────────────────────────────────

[Wait for user response]

[User types "done"]

Verifying authentication...
Running: vercel whoami
✓ Authenticated as: user@example.com

Retrying deployment...
Running: vercel --yes
✓ Deployed to: https://myapp-abc123.vercel.app

Task 3 complete. Continuing to task 4...
```

**Common services and their auth patterns:**

| Service | Auth Error Pattern | Auth Command | Verification |
|---------|-------------------|--------------|--------------|
| Vercel | "Not authenticated" | `vercel login` | `vercel whoami` |
| Netlify | "Not logged in" | `netlify login` | `netlify status` |
| AWS | "Unable to locate credentials" | `aws configure` | `aws sts get-caller-identity` |
| GCP | "Could not load the default credentials" | `gcloud auth login` | `gcloud auth list` |
| Supabase | "Not logged in" | `supabase login` | `supabase projects list` |
| Stripe | "No API key provided" | Set STRIPE_SECRET_KEY | `stripe config --list` |
| Railway | "Not authenticated" | `railway login` | `railway whoami` |
| Fly.io | "Not logged in" | `fly auth login` | `fly auth whoami` |
| Convex | "Not authenticated" | `npx convex login` | `npx convex dashboard` |
| Cloudflare | "Authentication error" | `wrangler login` | `wrangler whoami` |

**In Summary documentation:**

Document authentication gates as normal flow, not deviations:

```markdown
## Authentication Gates

During execution, I encountered authentication requirements:

1. Task 3: Vercel CLI required authentication
   - Paused for `vercel login`
   - Resumed after authentication
   - Deployed successfully

These are normal gates, not errors.
```

**Key principles:**

- Authentication gates are NOT failures or bugs
- They're expected interaction points during first-time setup
- Handle them gracefully and continue automation after unblocked
- Don't mark tasks as "failed" or "incomplete" due to auth gates
- Document them as normal flow, separate from deviations

</authentication_gates>
