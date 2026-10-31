"use client";

import { useState } from "react";
import {
  MoreHorizontal,
  Pencil,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-provider";
import { useDeleteUser, useUsers } from "@/lib/api/hooks";
import { ApiError } from "@/lib/api/error";
import type { User } from "@/types/api";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { DataTable, type DataColumn } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserDialog } from "@/features/users/user-dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, getInitials } from "@/lib/format";

export default function UsersPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const usersQuery = useUsers();
  const deleteUser = useDeleteUser();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const users = usersQuery.data ?? [];

  const query = search.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    const matchesQuery =
      !query ||
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query);
    const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
    const matchesStatus =
      statusFilter === "ALL" || user.status === statusFilter;

    return matchesQuery && matchesRole && matchesStatus;
  });

  async function handleDelete() {
    if (!deletingUser) {
      return;
    }

    try {
      await deleteUser.mutateAsync(deletingUser.id);
      toast.success("User removed.");
      setDeletingUser(null);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "The user could not be removed.",
      );
    }
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Users" description="Manage workspace access." />
        <EmptyState
          icon={ShieldAlert}
          title="Admin access required"
          description="Only workspace administrators can view and manage users."
        />
      </div>
    );
  }

  const columns: DataColumn<User>[] = [
    {
      id: "user",
      header: "User",
      cell: (user) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {user.name}
              {user.id === currentUser?.id ? (
                <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                  (you)
                </span>
              ) : null}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      cell: (user) => <StatusBadge status={user.role} />,
    },
    {
      id: "status",
      header: "Status",
      cell: (user) => <StatusBadge status={user.status} />,
    },
    {
      id: "joined",
      header: "Added",
      cell: (user) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(user.createdAt)}
        </span>
      ),
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
    },
    {
      id: "actions",
      header: "",
      headerClassName: "w-12",
      className: "w-12",
      cell: (user) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${user.name}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={() => {
                setEditingUser(user);
                setDialogOpen(true);
              }}
            >
              <Pencil />
              Edit user
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={user.id === currentUser?.id}
              onClick={() => setDeletingUser(user)}
            >
              <Trash2 />
              Remove user
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage workspace members, roles, and account status."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditingUser(null);
              setDialogOpen(true);
            }}
          >
            <UserPlus />
            Add user
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name or email…"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All roles</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="STAFF">Internal staff</SelectItem>
              <SelectItem value="CUSTOMER">Customer</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INVITED">Invited</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <span className="pl-1 text-xs text-muted-foreground">
            {filteredUsers.length} of {users.length}
          </span>
        </div>
      </div>

      {usersQuery.isError ? (
        <ErrorState
          title="Users could not be loaded"
          onRetry={() => void usersQuery.refetch()}
        />
      ) : (
        <DataTable
          data={filteredUsers}
          columns={columns}
          getRowKey={(user) => user.id}
          loading={usersQuery.isLoading}
          emptyState={
            <EmptyState
              icon={Users}
              title={users.length === 0 ? "No users yet" : "No matching users"}
              description={
                users.length === 0
                  ? "Add your first teammate to start collaborating."
                  : "Try adjusting your search or filters."
              }
              action={
                users.length === 0 ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingUser(null);
                      setDialogOpen(true);
                    }}
                  >
                    <UserPlus />
                    Add user
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setRoleFilter("ALL");
                      setStatusFilter("ALL");
                    }}
                  >
                    Clear filters
                  </Button>
                )
              }
            />
          }
        />
      )}

      {dialogOpen ? (
        <UserDialog
          key={editingUser?.id ?? "new"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          user={editingUser}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deletingUser)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingUser(null);
          }
        }}
        title="Remove this user?"
        description={
          deletingUser
            ? `${deletingUser.name} will lose access to the workspace. This action cannot be undone.`
            : ""
        }
        confirmLabel="Remove user"
        onConfirm={() => void handleDelete()}
        pending={deleteUser.isPending}
      />
    </div>
  );
}
