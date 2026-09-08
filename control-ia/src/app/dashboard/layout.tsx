import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import { WorkspaceProvider } from "@/lib/workspace-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <div className="flex min-h-screen bg-brand-100/60">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-6">{children}</main>
          <MobileNav />
        </div>
      </div>
    </WorkspaceProvider>
  );
}
