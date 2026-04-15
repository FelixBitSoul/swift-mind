"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, LogOutIcon, UserCircle2Icon } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function getInitials(value?: string | null) {
  if (!value) return "U";
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "U";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.toUpperCase();
}

export function UserMenu(props: {
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const displayName = props.displayName?.trim() || props.email || "Signed in";
  const initials = getInitials(props.displayName || props.email);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setIsSigningOut(false);

    if (error) {
      toast.error("Sign out failed", { description: error.message });
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open user menu"
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full border border-transparent p-0 data-popup-open:border-border data-popup-open:bg-muted"
          />
        }
      >
        <Avatar size="default">
          {props.avatarUrl ? <AvatarImage src={props.avatarUrl} alt={displayName} /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-56 min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2">
            <UserCircle2Icon className="size-4" />
            <span className="truncate">{displayName}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" className="gap-2" onClick={() => void handleSignOut()}>
            {isSigningOut ? <Loader2Icon className="size-4 animate-spin" /> : <LogOutIcon className="size-4" />}
            退出登录
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
