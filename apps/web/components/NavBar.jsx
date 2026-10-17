"use client";

import Link from "next/link";
import Button from "./ui/Button";
import useAuth from "@/hooks/useAuth";
import { Clock, Dumbbell, LayoutDashboard, Menu, Sparkles, User, Utensils, X, LogOut } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const { user, ready, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const NAV_ITEMS = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Workout", href: "/workout", icon: Dumbbell },
    { name: "History", href: "/history", icon: Clock },
    { name: "AI Plan", href: "/ai-workout-plan", icon: Sparkles },
    { name: "Diet", href: "/diet", icon: Utensils },
    { name: "Profile", href: "/profile", icon: User },
  ]

  if (!ready) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-9 w-20 rounded-2xl bg-white/10 animate-pulse" />
        <div className="h-9 w-24 rounded-2xl bg-white/10 animate-pulse" />
      </div>
    )
  }

  if (!user) {
    return (
      <nav className="flex items-center gap-3">
        <Button as={Link} href="/register" size="md">Get Started</Button>
        <Button as={Link} href="/login" size="md" variant="secondary">Login</Button>
      </nav>
    )
  }

  return (
    <div className="relative">
      <nav className="hidden md:flex items-center gap-4">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`text-sm transition-colors ${isActive ? "text-brand-text font-medium"
              : "text-brand-muted hover:text-brand-text"
              } `}>
              {item.name}
            </Link>
          )
        })}

        <Button onClick={logout} size="md" variant="secondary">
          Logout
        </Button>
      </nav>

      <div className="md:hidden">
        <button onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-brand-text hover:bg-white/10"
          aria-label="Toggle Navigation Menu">
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden absolute right-0 top-full mt-3 w-64 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-3 shadow-2xl z-50 flex flex-col gap-1">
          <div className="px-3 py-2 border-b border-white/10 mb-1">
            <p className="text-xs text-brand-muted">Signed in as</p>
            <p className="text-sm font-semibold text-brand-text truncate">{user.name || user.email}</p>
          </div>

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all 
                  ${isActive ? "text-brand-primary font-medium border border-band-primary/30"
                    : "text-brand-muted hover:text-brand-text hover:bg-white/5"
                  }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            )
          })}

          <div className="pt-2 mt-1 border-t border-white/10">
            <button
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

    </div>
  )
}