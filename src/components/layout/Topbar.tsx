import { lazy, memo, Suspense } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, RefreshCw, UserCircle } from "lucide-react";
const GlobalSearch = lazy(() =>
  import("@/components/GlobalSearch").then((m) => ({ default: m.GlobalSearch })),
);
const NotificationsBell = lazy(() =>
  import("@/components/NotificationsBell").then((m) => ({ default: m.NotificationsBell })),
);

import { useAuth } from "@/hooks/use-auth";
import { useAvatarUrl } from "@/hooks/use-avatar-url";
import { supabase } from "@/integrations/supabase/client";
import { signOutAndRedirect } from "@/lib/auth/logout";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ExerciceSelector } from "./ExerciceSelector";
import { TopbarBreadcrumb } from "./TopbarBreadcrumb";

function initials(value: string) {
  return value
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

function TopbarImpl() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const label = user?.user_metadata?.nom_complet || user?.email || "Utilisateur";

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, nom_complet")
        .eq("id", user!.id)
        .maybeSingle();
      return data as { avatar_url: string | null; nom_complet: string | null } | null;
    },
  });
  const { data: avatarUrl } = useAvatarUrl(profile?.avatar_url);

  function handleSignOut() {
    signOutAndRedirect();
  }

  async function handleRefreshPermissions() {
    await queryClient.invalidateQueries({ queryKey: ["rbac", "permissions", user?.id ?? null] });
    toast.success("Permissions rechargées");
  }

  return (
    <div className="flex flex-1 items-center gap-2 sm:gap-3">
      <TopbarBreadcrumb />
      <div className="flex-1 max-w-xl transition-[max-width] duration-200 focus-within:max-w-2xl">
        <Suspense fallback={<div className="h-10 w-full animate-pulse rounded-full bg-muted" />}>
          <GlobalSearch />
        </Suspense>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
        <div className="hidden md:block">
          <ExerciceSelector />
        </div>
        <ThemeToggle />
        <Suspense fallback={<div className="h-9 w-9" />}>
          <NotificationsBell />
        </Suspense>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex h-10 items-center gap-2 px-1 rounded-full sm:rounded-md sm:px-2">
              <Avatar className="h-8 w-8">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={label} /> : null}
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {initials(label)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden lg:block text-left leading-tight">
                <p className="max-w-[120px] truncate text-sm font-semibold">{label}</p>
                <p className="max-w-[120px] truncate text-xs text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="px-2 py-1.5 lg:hidden">
              <p className="text-sm font-semibold truncate">{label}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <div className="md:hidden">
              <DropdownMenuSeparator />
              <div className="px-1 py-1.5">
                <ExerciceSelector />
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profil">
                <UserCircle className="mr-2 h-4 w-4" />
                Mon profil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleRefreshPermissions}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Recharger mes permissions
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export const Topbar = memo(TopbarImpl);
