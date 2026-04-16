import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function RegisterPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/");

  async function signUp(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) redirect(`/register?error=${encodeURIComponent(error.message)}`);
    redirect("/");
  }

  return (
    <AuthShell subtitle="Create your account">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Sign up to start using the app.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signUp} className="space-y-3">
            <Input name="email" type="email" placeholder="Email" required />
            <Input name="password" type="password" placeholder="Password" required />
            <Button type="submit" className="w-full">
              Sign up
            </Button>
          </form>
          <div className="mt-4 text-sm text-muted-foreground">
            Already have an account? <Link className="underline" href="/login">Sign in</Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

