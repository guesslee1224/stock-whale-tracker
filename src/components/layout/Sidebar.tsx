"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ActivityIcon,
  BookmarkIcon,
  SettingsIcon,
  LogOutIcon,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/feed", label: "Activity Feed", icon: ActivityIcon },
  { href: "/watchlist", label: "Watchlist", icon: BookmarkIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden md:flex flex-col w-56 border-r border-border bg-sidebar h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center text-base shrink-0"
            style={{
              background: "rgba(0, 232, 122, 0.12)",
              boxShadow: "0 0 12px rgba(0, 232, 122, 0.15)",
            }}
          >
            🐋
          </div>
          <div>
            <div
              className="font-heading font-bold text-xs tracking-[0.18em] uppercase text-foreground"
            >
              Whale Tracker
            </div>
            <div className="text-[10px] text-muted-foreground tracking-widest uppercase mt-0.5">
              Market Intel
            </div>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              style={
                active
                  ? {
                      background: "rgba(0, 232, 122, 0.08)",
                      boxShadow: "inset 2px 0 0 #00E87A",
                    }
                  : undefined
              }
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-primary" : ""
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Status indicator */}
      <div className="px-5 py-3 border-t border-border">
        <div className="flex items-center gap-2 mb-3">
          <span
            className="w-1.5 h-1.5 rounded-full bg-bull"
            style={{ boxShadow: "0 0 6px #00E87A" }}
          />
          <span className="text-[10px] text-muted-foreground tracking-wider uppercase">
            Live
          </span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors duration-150"
        >
          <LogOutIcon className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
