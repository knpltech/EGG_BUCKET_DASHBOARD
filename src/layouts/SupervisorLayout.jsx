import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function SupervisorLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar supervisor />
      <div className="flex-1 flex flex-col">
        <Topbar supervisor />
        <main className="p-6 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
