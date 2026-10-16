import { accountTodo } from "@/lib/supabase";
import { AccountNudge } from "./password";

/** Server side: shows the first-sign-in pop-up only when the account still needs a password or an email. */
export async function AccountPrompt() {
  const todo = await accountTodo();
  return todo ? <AccountNudge {...todo} /> : null;
}
