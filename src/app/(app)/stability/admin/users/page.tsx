"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { KeyRound, RefreshCw, Shield, Trash2, UserCog, UserPlus, Users } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingSkeleton,
  PageHeader,
  Select,
} from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import {
  MODULE_ACCESS,
  permissionsForRole,
  type Permission,
} from "@/lib/permissions";
import { cn, friendlyError } from "@/lib/utils";
import { deleteManagedUser, listUsers, updateManagedUser } from "@/services/users";
import type { AppUser, UserRole } from "@/types";

type AdminTab = "create" | "manage" | "access";

const ROLES: UserRole[] = ["Admin", "QA Manager", "QA User"];

const TABS: { id: AdminTab; label: string; description: string; icon: typeof UserPlus }[] = [
  {
    id: "create",
    label: "Create User",
    description: "Provision a new Firebase account",
    icon: UserPlus,
  },
  {
    id: "manage",
    label: "Manage Users",
    description: "Role, status, and profile details",
    icon: Users,
  },
  {
    id: "access",
    label: "Module Access",
    description: "Grant or revoke module permissions",
    icon: KeyRound,
  },
];

function ModuleAccessPicker({
  selected,
  onChange,
  allowAdminModules = true,
}: {
  selected: Permission[];
  onChange: (next: Permission[]) => void;
  allowAdminModules?: boolean;
}) {
  const modules = MODULE_ACCESS.filter((m) => allowAdminModules || !m.adminOnly);

  function toggle(permission: Permission) {
    if (selected.includes(permission)) {
      onChange(selected.filter((p) => p !== permission));
    } else {
      onChange([...selected, permission]);
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {modules.map((mod) => {
        const checked = selected.includes(mod.permission);
        return (
          <label
            key={mod.permission}
            className={cn(
              "flex cursor-pointer gap-3 rounded-lg border p-3 transition",
              checked ? "border-teal-300 bg-teal-50/60" : "border-slate-200 bg-white hover:border-slate-300"
            )}
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              checked={checked}
              onChange={() => toggle(mod.permission)}
            />
            <span>
              <span className="block text-sm font-medium text-slate-800">{mod.label}</span>
              <span className="block text-xs text-slate-500">{mod.description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

export default function AdminUsersPage() {
  const { profile, hasPermission, createUser, refreshProfile, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<AdminTab>("create");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("QA User");
  const [createAccess, setCreateAccess] = useState<Permission[]>(permissionsForRole("QA User"));
  const [creating, setCreating] = useState(false);

  const [selectedUid, setSelectedUid] = useState("");
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("QA User");
  const [editActive, setEditActive] = useState(true);
  const [editAccess, setEditAccess] = useState<Permission[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedUser = useMemo(
    () => users.find((u) => u.uid === selectedUid) || null,
    [users, selectedUid]
  );

  const isSelf = selectedUser?.uid === profile?.uid;

  async function loadUsers() {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const rows = await listUsers();
      setUsers(rows);
      if (selectedUid && !rows.some((u) => u.uid === selectedUid)) {
        setSelectedUid("");
      }
    } catch (err) {
      const message = friendlyError(err, "Unable to load users.");
      setUsersError(message);
      toast.error(message);
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    if (authLoading || !hasPermission("users.manage")) return;
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, profile?.uid, hasPermission]);

  useEffect(() => {
    setCreateAccess(permissionsForRole(role));
  }, [role]);

  useEffect(() => {
    if (!selectedUser) {
      setEditName("");
      setEditRole("QA User");
      setEditActive(true);
      setEditAccess([]);
      return;
    }
    setEditName(selectedUser.displayName);
    setEditRole(selectedUser.role);
    setEditActive(selectedUser.active);
    setEditAccess(
      selectedUser.moduleAccess && selectedUser.moduleAccess.length > 0
        ? [...selectedUser.moduleAccess]
        : permissionsForRole(selectedUser.role)
    );
  }, [selectedUser]);

  if (authLoading) {
    return (
      <div>
        <PageHeader title="User Management" description="Admin tools for accounts and module access." />
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  if (!hasPermission("users.manage")) {
    return (
      <div>
        <PageHeader title="User Management" description="Admin tools for accounts and module access." />
        <Card className="p-6 text-sm text-slate-600">
          Only users with User Management access can manage accounts and module permissions.
        </Card>
      </div>
    );
  }

  async function onCreateUser(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await createUser({
        employeeId,
        password,
        displayName,
        role,
        moduleAccess: createAccess,
      });
      toast.success("User created successfully.");
      setDisplayName("");
      setEmployeeId("");
      setPassword("");
      setRole("QA User");
      setCreateAccess(permissionsForRole("QA User"));
      await loadUsers();
      setTab("manage");
    } catch (err) {
      toast.error(friendlyError(err, "Unable to create user."));
    } finally {
      setCreating(false);
    }
  }

  async function onSaveManage(e: FormEvent) {
    e.preventDefault();
    if (!selectedUser || !profile) return;
    if (isSelf && !editActive) {
      toast.error("You cannot deactivate your own account.");
      return;
    }
    setSaving(true);
    try {
      await updateManagedUser({
        uid: selectedUser.uid,
        displayName: editName,
        role: editRole,
        active: editActive,
        actor: profile,
      });
      toast.success("User updated.");
      await loadUsers();
      if (selectedUser.uid === profile.uid) await refreshProfile();
    } catch (err) {
      toast.error(friendlyError(err, "Unable to update user."));
    } finally {
      setSaving(false);
    }
  }

  async function onSaveAccess(e: FormEvent) {
    e.preventDefault();
    if (!selectedUser || !profile) return;
    if (isSelf && !editAccess.includes("users.manage")) {
      toast.error("You cannot remove your own User Management access.");
      return;
    }
    setSaving(true);
    try {
      await updateManagedUser({
        uid: selectedUser.uid,
        moduleAccess: editAccess,
        actor: profile,
      });
      toast.success("Module access updated.");
      await loadUsers();
      if (selectedUser.uid === profile.uid) await refreshProfile();
    } catch (err) {
      toast.error(friendlyError(err, "Unable to update module access."));
    } finally {
      setSaving(false);
    }
  }

  async function onConfirmDelete() {
    if (!selectedUser || !profile) return;
    setDeleting(true);
    try {
      await deleteManagedUser({
        uid: selectedUser.uid,
        employeeId: selectedUser.employeeId,
        displayName: selectedUser.displayName,
        role: selectedUser.role,
        actor: profile,
      });
      toast.success("User deleted.");
      setDeleteOpen(false);
      setSelectedUid("");
      await loadUsers();
    } catch (err) {
      toast.error(friendlyError(err, "Unable to delete user."));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Admin · User Management"
        description="Create users, manage accounts, and assign module access."
        actions={
          <Button variant="outline" onClick={() => void loadUsers()} disabled={loadingUsers}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition",
                active
                  ? "border-teal-300 bg-teal-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon className={cn("h-4 w-4", active ? "text-teal-700" : "text-slate-500")} />
                <span className={cn("text-sm font-semibold", active ? "text-teal-900" : "text-slate-800")}>
                  {item.label}
                </span>
              </div>
              <p className="text-xs text-slate-500">{item.description}</p>
            </button>
          );
        })}
      </div>

      {usersError ? <ErrorState message={usersError} onRetry={() => void loadUsers()} /> : null}

      {tab === "create" ? (
        <Card>
          <CardHeader
            title="Create user"
            description="Employee ID becomes the login ID. Password is set by Admin."
          />
          <form onSubmit={onCreateUser} className="space-y-5 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Full name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="off"
              />
              <Input
                label="Employee ID (Login ID)"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                autoComplete="off"
                hint="This Employee ID is used to sign in."
              />
              <Input
                label="Temporary password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                hint="Minimum 6 characters. Share securely with the user."
              />
              <Select
                label="Role"
                required
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                hint="Role sets the default module access below."
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Shield className="h-4 w-4 text-teal-700" />
                Module access
              </div>
              <ModuleAccessPicker selected={createAccess} onChange={setCreateAccess} />
            </div>

            <Button type="submit" loading={creating}>
              <UserPlus className="h-4 w-4" />
              Create user
            </Button>
          </form>
        </Card>
      ) : null}

      {tab === "manage" ? (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <Card>
            <CardHeader title="Users" description="Select a user to edit role and status." />
            <div className="overflow-x-auto p-4">
              {loadingUsers ? (
                <LoadingSkeleton rows={4} />
              ) : users.length === 0 ? (
                <EmptyState title="No users found" description="Create a user to get started." />
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-2 py-2 font-medium">Name</th>
                      <th className="px-2 py-2 font-medium">Employee ID</th>
                      <th className="px-2 py-2 font-medium">Role</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const active = u.uid === selectedUid;
                      return (
                        <tr
                          key={u.uid}
                          className={cn(
                            "cursor-pointer border-b border-slate-100 text-slate-700",
                            active ? "bg-teal-50" : "hover:bg-slate-50"
                          )}
                          onClick={() => setSelectedUid(u.uid)}
                        >
                          <td className="px-2 py-2">
                            <div className="font-medium">{u.displayName}</div>
                          </td>
                          <td className="px-2 py-2 font-mono text-xs">{u.employeeId || "—"}</td>
                          <td className="px-2 py-2">{u.role}</td>
                          <td className="px-2 py-2">{u.active ? "Active" : "Inactive"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Edit user" description="Update name, role, and active status." />
            {!selectedUser ? (
              <p className="p-4 text-sm text-slate-500">Select a user from the list.</p>
            ) : (
              <form onSubmit={onSaveManage} className="space-y-4 p-4">
                <Input
                  label="Full name"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <Select
                  label="Role"
                  required
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Status"
                  required
                  value={editActive ? "active" : "inactive"}
                  onChange={(e) => setEditActive(e.target.value === "active")}
                  disabled={isSelf}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
                <p className="text-xs text-slate-500">
                  Changing role does not automatically reset module access. Use the Module Access tab
                  to adjust permissions.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" loading={saving}>
                    <UserCog className="h-4 w-4" />
                    Save changes
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={isSelf || saving || deleting}
                    onClick={() => setDeleteOpen(true)}
                    title={isSelf ? "You cannot delete your own account" : undefined}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete user
                  </Button>
                </div>
                {isSelf ? (
                  <p className="text-xs text-amber-700">
                    You cannot deactivate or delete your own account.
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Delete removes app access. To reuse the same Employee ID later, also remove the
                    Auth user in Firebase Console.
                  </p>
                )}
              </form>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "access" ? (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <Card>
            <CardHeader title="Users" description="Select a user to assign module access." />
            <div className="space-y-2 p-4">
              {loadingUsers ? (
                <LoadingSkeleton rows={4} />
              ) : users.length === 0 ? (
                <EmptyState title="No users found" description="Create a user first." />
              ) : (
                users.map((u) => {
                  const active = u.uid === selectedUid;
                  return (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={() => setSelectedUid(u.uid)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 text-left transition",
                        active ? "border-teal-300 bg-teal-50" : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <div className="text-sm font-medium text-slate-800">{u.displayName}</div>
                      <div className="text-xs text-slate-500">
                        {u.employeeId || "—"} · {u.role}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Module access"
              description="Checked modules are available to this user in the app."
            />
            {!selectedUser ? (
              <p className="p-4 text-sm text-slate-500">Select a user from the list.</p>
            ) : (
              <form onSubmit={onSaveAccess} className="space-y-4 p-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Editing access for <span className="font-medium">{selectedUser.displayName}</span>
                </div>
                <ModuleAccessPicker selected={editAccess} onChange={setEditAccess} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditAccess(permissionsForRole(selectedUser.role))}
                  >
                    Reset to {selectedUser.role} defaults
                  </Button>
                  <Button type="submit" loading={saving}>
                    <KeyRound className="h-4 w-4" />
                    Save module access
                  </Button>
                </div>
                {isSelf ? (
                  <p className="text-xs text-amber-700">
                    Keep User Management checked so you do not lock yourself out.
                  </p>
                ) : null}
              </form>
            )}
          </Card>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this user?"
        description={
          selectedUser
            ? `Remove ${selectedUser.displayName} (${selectedUser.employeeId || "no Employee ID"}) from the app. They will not be able to sign in. To reuse the same Employee ID, also delete the Auth account in Firebase Console.`
            : "Remove this user from the app."
        }
        confirmLabel="Delete user"
        tone="danger"
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void onConfirmDelete()}
      />
    </div>
  );
}
