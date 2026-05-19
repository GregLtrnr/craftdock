"use client";

import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-3xl font-bold">Settings</h1>
      <Card className="mt-6 max-w-lg">
        <h2 className="font-medium">Account</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Email</dt>
            <dd>{user?.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Role</dt>
            <dd>{user?.role}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
