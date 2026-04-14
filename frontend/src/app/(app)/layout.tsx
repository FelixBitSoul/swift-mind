import { PropsWithChildren } from "react";

import { AppSidebar } from "@/components/app/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarRail } from "@/components/ui/sidebar";

export default function AppLayout({ children }: PropsWithChildren) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarRail />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}

