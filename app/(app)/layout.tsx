import { requireUser } from "@/lib/supabase/server";
import { Nav } from "./Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  return (
    <div className="md:flex">
      <aside className="border-b border-border bg-surface md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 py-4 md:block">
          <span className="text-lg font-semibold">💰 Finanças</span>
          <form action="/auth/signout" method="post" className="md:hidden">
            <button className="text-sm text-muted hover:text-text">Sair</button>
          </form>
        </div>
        <Nav />
        <div className="hidden px-4 py-4 md:absolute md:bottom-0 md:block md:w-56">
          <p className="truncate text-xs text-muted" title={user.email}>{user.email}</p>
          <form action="/auth/signout" method="post">
            <button className="mt-1 text-sm text-muted hover:text-text">Sair</button>
          </form>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
