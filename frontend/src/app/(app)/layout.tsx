import { PropsWithChildren } from "react";

import { AppSidebar } from "@/components/app/app-sidebar";
import { UserMenu } from "@/components/app/user-menu";
import { SidebarInset, SidebarProvider, SidebarRail } from "@/components/ui/sidebar";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: PropsWithChildren) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const displayName = typeof metadata.full_name === "string" ? metadata.full_name : null;
  const avatarUrl =
    typeof metadata.avatar_url === "string"
      ? metadata.avatar_url
      : typeof metadata.picture === "string"
        ? metadata.picture
        : null;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarRail />
      <SidebarInset className="min-h-0">
        <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="flex h-14 items-center justify-end px-4 sm:px-6">
            <UserMenu email={user?.email} displayName={displayName} avatarUrl={avatarUrl} />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

