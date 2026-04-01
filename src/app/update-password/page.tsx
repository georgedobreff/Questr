"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {

        setIsSessionActive(true);
      } else {

        setIsSessionActive(false);
      }
    };

    checkSession();
  }, [supabase]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!password) {
      setError("Password cannot be empty.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      toast.error(error.message);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
          await supabase.from('notifications').insert({
              user_id: user.id,
              title: 'Password Updated!',
              message: 'Your password has been updated successfully.',
              type: 'success'
          });
      }
      setMessage("Your password has been updated successfully.");
      router.push("/login");
    }
    setLoading(false);
  };

  if (!isSessionActive) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4 hover-card-glow">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle>Invalid or Expired Link</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>This password reset link is invalid or has expired. Please request a new one.</p>
                </CardContent>
                <CardFooter>
                    <Button className="w-full" onClick={() => router.push('/login')}>
                        Back to Login
                    </Button>
                </CardFooter>
            </Card>
        </div>
      )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 hover-card-glow">
      <form onSubmit={handlePasswordUpdate} className="w-full max-w-md">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Create a New Password</CardTitle>
            <CardDescription>
              Enter and confirm your new password below.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            {message && <p className="text-green-500 text-sm text-center">{message}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
