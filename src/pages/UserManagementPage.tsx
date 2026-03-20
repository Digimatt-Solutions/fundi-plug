import { Users, Search, MoreVertical, Shield, Wrench, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const users = [
  { id: 1, name: "Sarah Mitchell", email: "sarah@example.com", role: "customer", status: "Active", joined: "Jan 15, 2026" },
  { id: 2, name: "James Henderson", email: "james@example.com", role: "worker", status: "Active", joined: "Feb 3, 2026" },
  { id: 3, name: "Maria Lopez", email: "maria@example.com", role: "worker", status: "Active", joined: "Feb 10, 2026" },
  { id: 4, name: "Carlos Rivera", email: "carlos@example.com", role: "worker", status: "Pending", joined: "Mar 18, 2026" },
  { id: 5, name: "Emily Kim", email: "emily@example.com", role: "customer", status: "Active", joined: "Mar 5, 2026" },
  { id: 6, name: "Admin User", email: "admin@example.com", role: "admin", status: "Active", joined: "Jan 1, 2026" },
];

const roleIcon = (role: string) => {
  if (role === "admin") return <Shield className="w-3.5 h-3.5" />;
  if (role === "worker") return <Wrench className="w-3.5 h-3.5" />;
  return <User className="w-3.5 h-3.5" />;
};

export default function UserManagementPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground text-sm">Manage platform users and roles</p>
        </div>
        <Button size="sm">Add User</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search users..." className="pl-10 bg-card" />
      </div>

      <div className="stat-card overflow-hidden p-0 animate-fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-4 text-muted-foreground font-medium">User</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Role</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Joined</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                        {u.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted capitalize">
                      {roleIcon(u.role)} {u.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      u.status === "Active" ? "bg-green-500/10 text-green-500" : "bg-chart-4/10 text-chart-4"
                    }`}>{u.status}</span>
                  </td>
                  <td className="p-4 text-muted-foreground">{u.joined}</td>
                  <td className="p-4">
                    <Button variant="ghost" size="icon" className="w-8 h-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
