"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Turnstile } from '@marsidev/react-turnstile';
import { Chrome, Github, Loader2 } from 'lucide-react';

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const router = useRouter();
  const supabase = createClient();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const captchaEnabled = !!turnstileSiteKey;

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profile && !profile.onboarding_completed) {
          router.replace("/onboarding");
        } else {
          router.replace("/dashboard");
        }
      } else {
        setCheckingSession(false);
      }
    };
    checkUser();
  }, [router, supabase]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (captchaEnabled && !captchaToken) {
      setError("Verify you're not a clanker first.");
      setLoading(false);
      return;
    }

    const { data: { user }, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      ...(captchaEnabled && captchaToken ? { options: { captchaToken } } : {}),
    });

    if (error) {
      setError(error.message);
    } else if (user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
      } else if (profile && !profile.onboarding_completed) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (captchaEnabled && !captchaToken) {
      setError("Verify you're not a clanker first.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      ...(captchaEnabled && captchaToken ? { options: { captchaToken } } : {}),
    });

    if (error) {
      setError(error.message);
    } else {
      toast.success("Check your email for the confirmation link!");

    }
    setLoading(false);
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError("Please enter your email address to reset your password.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (error) {
      setError(error.message);
      toast.error(error.message);
    } else {
      toast("Check your email for the password reset link!");
    }
    setLoading(false);
  };

  const signInWithOAuth = async (provider: 'google' | 'github') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_FRONTEND_URL}/api/auth/callback`,
      },
    });
    if (error) {
      setError("Something went wrong.. Try again.");
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 titled-cards">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Login or Sign Up</CardTitle>
          <CardDescription>
            Enter your email and password to access your quests.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            {captchaEnabled && (
              <div className="flex justify-center">
                <Turnstile
                  siteKey={turnstileSiteKey!}
                  onSuccess={(token) => setCaptchaToken(token)}
                />
              </div>
            )}
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={loading || (captchaEnabled && !captchaToken)}>
              {loading ? "Logging In..." : "Login"}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={handleSignUp} disabled={loading || (captchaEnabled && !captchaToken)}>
              {loading ? "Signing Up..." : "Sign Up"}
            </Button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-transparent px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => signInWithOAuth('google')}
              disabled={loading}
            >
              {loading ? "Redirecting..." : <>
                <Chrome className="mr-2 h-4 w-4" />
                Login with Google
              </>
              }
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => signInWithOAuth('github')}
              disabled={loading}
            >
              {loading ? "Redirecting..." : <>
                <Github className="mr-2 h-4 w-4" />
                Login with Github
              </>
              }
            </Button>
            <Button type="button" variant="link" className="w-full" onClick={handlePasswordReset} disabled={loading}>
              Forgot Password?
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
