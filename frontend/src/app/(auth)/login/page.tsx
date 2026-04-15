import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ redirectTo?: string }>;

export default async function LoginPage(props: { searchParams: SearchParams }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/");

  const { redirectTo } = await props.searchParams;
  const next = redirectTo ?? "/";

  async function signIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
    redirect(next);
  }

  async function signInWithGithub() {
    "use server";
    const supabase = await createSupabaseServerClient();
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "http";
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const origin = `${proto}://${host}`;
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo },
    });

    if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
    if (!data.url) redirect(`/login?error=${encodeURIComponent("Missing OAuth redirect URL")}`);
    redirect(data.url);
  }

  return (
    <div className="min-h-svh flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Sign in to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signIn} className="space-y-3">
            <Input name="email" type="email" placeholder="Email" required />
            <Input name="password" type="password" placeholder="Password" required />
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <div className="text-xs text-muted-foreground">OR</div>
            <div className="h-px flex-1 bg-border" />
          </div>
          <form action={signInWithGithub}>
            <Button type="submit" variant="outline" className="w-full">
              Continue with GitHub
            </Button>
          </form>
          <div className="mt-4 text-sm text-muted-foreground">
            No account? <Link className="underline" href="/register">Create one</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

