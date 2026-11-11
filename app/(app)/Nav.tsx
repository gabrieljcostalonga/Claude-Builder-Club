"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ArrowLeftRight, Landmark, LayoutDashboard, Tags, Target } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transacoes", label: "Transações", icon: ArrowLeftRight },
  { href: "/categorias", label: "Categorias", icon: Tags },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/contas", label: "Contas", icon: Landmark },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={clsx(
            "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm",
            pathname.startsWith(href) ? "bg-primary/10 font-medium text-primary" : "text-muted hover:bg-bg hover:text-text",
          )}
        >
          <Icon size={16} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
