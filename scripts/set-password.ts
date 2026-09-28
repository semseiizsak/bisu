/**
 * Sets (or creates) the single user's login password via the service role.
 * For a single-user app there is no "forgot password" email flow; this is
 * the reset button.
 *
 *   npx tsx scripts/set-password.ts <new-password> [email]
 *
 * Email defaults to ALLOWED_EMAIL from .env.local. Requires
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import { supabaseAdmin } from "./lib/supabase-admin";

async function main() {
  const [password, emailArg] = process.argv.slice(2);
  const email = (emailArg ?? process.env.ALLOWED_EMAIL ?? "").trim().toLowerCase();
  if (!password || !email) {
    console.error("Usage: npx tsx scripts/set-password.ts <new-password> [email]   (email defaults to ALLOWED_EMAIL)");
    process.exit(1);
  }

  const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const existing = list.users.find((u) => u.email?.toLowerCase() === email);

  if (existing) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, { password });
    if (error) throw error;
    console.log(`Password updated for ${email}.`);
  } else {
    const { error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    console.log(`User ${email} created with the given password.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
