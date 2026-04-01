"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubscriptionManager } from "@/app/services/subscription-manager";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useGoPro } from "@/hooks/use-go-pro";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/navigation/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { User, Gift, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import CharacterSelectorDialog from "@/components/character/character-selector-dialog";

interface ProfileData {
  full_name: string | null;
  has_had_trial: boolean;
  date_of_birth: string | null;
  gender: string | null;
}

interface SubscriptionData {
  status: string;
  renews_at: string | null;
  stripe_current_period_end: string | null;
}

function SettingsContent() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [genderCustom, setGenderCustom] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const [subscriptionStatus, setSubscriptionStatus] = useState("free");
  const [hasHadTrial, setHasHadTrial] = useState(false);

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [showReferralCode, setShowReferralCode] = useState(false);
  const [referredCount, setReferredCount] = useState(0);
  const [rewardedCount, setRewardedCount] = useState(0);

  const [isCharacterSelectorOpen, setIsCharacterSelectorOpen] = useState(false);

  const { handleGoPro } = useGoPro();
  const searchParams = useSearchParams();
  const router = useRouter();
  const upgradeTriggered = useRef(false);

  useEffect(() => {
    if (searchParams.get("trigger_upgrade") === "true" && !upgradeTriggered.current) {
      upgradeTriggered.current = true;
      router.replace("/settings");
      handleGoPro();
    }
  }, [searchParams, router, handleGoPro]);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [profileRes, subRes, statsRes] = await Promise.all([
          supabase.from("profiles").select("full_name, has_had_trial, date_of_birth, gender, referral_code").eq("id", user.id).single(),
          supabase.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle(),
          supabase.rpc('get_referral_stats')
        ]);

        const profile = profileRes.data as ProfileData & { referral_code: string | null } | null;
        const sub = subRes.data as { status: string } | null;

        const stats = (statsRes.data && statsRes.data[0])
          ? statsRes.data[0]
          : { referred_count: 0, rewarded_count: 0 };

        if (profile) {
          setFullName(profile.full_name || "");
          setDateOfBirth(profile.date_of_birth || "");
          setReferralCode(profile.referral_code);

          const dbGender = profile.gender || "";
          const standardGenders = ["Male", "Female", "Non-binary", ""];
          if (standardGenders.includes(dbGender)) {
            setGender(dbGender);
            setGenderCustom("");
          } else {
            setGender("Other");
            setGenderCustom(dbGender);
          }

          setHasHadTrial(profile.has_had_trial);
        }

        if (sub) {
          setSubscriptionStatus(sub.status);
        }

        setReferredCount(Number(stats.referred_count));
        setRewardedCount(Number(stats.rewarded_count));
      }
      setLoading(false);
    };

    fetchProfile();
  }, [supabase]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to update your profile.");
      setLoading(false);
      return;
    }

    const finalGender = gender === "Other" ? genderCustom : gender;

    const { error } = await supabase.functions.invoke("update-user-profile", {
      body: {
        fullName,
        dateOfBirth: dateOfBirth === "" ? null : dateOfBirth,
        gender: finalGender === "" ? null : finalGender
      },
    });

    if (error) {
      const isTech = error.message.includes("Functions") || error.message.includes("Edge Function") || error.message.includes("fetch");
      toast.error(isTech ? "Something went wrong. Try again." : error.message);
    } else {
      toast.success("Profile updated successfully!");
    }
    setLoading(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm === "DELETE") {
      setLoading(true);
      const { error } = await supabase.functions.invoke("delete-user-account", {
        method: "POST",
      });

      if (error) {
        toast.error("Something went wrong. Try again.");
        setLoading(false);
      } else {
        toast.success("Account deleted successfully.");
        await supabase.auth.signOut();
        window.location.href = "/";
      }
    } else {
      toast.error("Please type DELETE to confirm.");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="h-full overflow-y-auto pt-20 lg:pt-8 landscape:pt-8 pb-24 lg:pb-8">
      <div className="container mx-auto p-4 max-w-2xl space-y-8">
        {/* Profile Card */}
        <Card className="titled-cards">
          <CardHeader className="text-center flex flex-col items-center">
            <CardTitle className="flex items-center gap-2 justify-center">
              <User className="h-5 w-5" />
              Profile Settings
            </CardTitle>
            <CardDescription>
              Update your personal information.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdateProfile}>
            <CardContent className="space-y-4 pb-10 flex flex-col items-center">
              <div className="space-y-2 w-full max-w-sm text-center">
                <Label htmlFor="fullName" className="block text-center">Your Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="text-center bg-background"
                />
              </div>
              <div className="space-y-2 w-full max-w-sm text-center">
                <Label htmlFor="dateOfBirth" className="block text-center">Date of Birth</Label>
                <div className="flex justify-center">
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="text-center block [&::-webkit-date-and-time-value]:text-center appearance-none bg-background"
                  />
                </div>
              </div>
              <div className="space-y-2 w-full max-w-sm text-center">
                <Label htmlFor="gender" className="block text-center">Gender</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-center">
                      {gender || "Select Gender"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-[200px]" align="center">
                    <DropdownMenuItem onClick={() => { setGender("Male"); setGenderCustom(""); }}>Male</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setGender("Female"); setGenderCustom(""); }}>Female</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setGender("Non-binary"); setGenderCustom(""); }}>Non-binary</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setGender("Other")}>Other</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {gender === "Other" && (
                  <Input
                    id="genderCustom"
                    type="text"
                    value={genderCustom}
                    onChange={(e) => setGenderCustom(e.target.value)}
                    placeholder="..."
                    className="mt-2 text-center bg-background"
                  />
                )}
              </div>

              <div className="my-6 border-b border-white/10 w-full max-w-sm" />

              <div className="space-y-2 w-full max-w-sm text-center">
                <Label className="block text-center">Character Appearance</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsCharacterSelectorOpen(true)}
                >
                  Change Character Model
                </Button>
              </div>

            </CardContent>
            <CardFooter className="border-t pt-6 flex justify-center">
              <Button type="submit" disabled={loading} variant="outline" className="w-full max-w-sm">
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <CharacterSelectorDialog
          isOpen={isCharacterSelectorOpen}
          onOpenChange={setIsCharacterSelectorOpen}
          onSuccess={() => router.refresh()}
        />

        {/* Referrals Card */}
        <Card className="titled-cards">
          <CardHeader className="text-center flex flex-col items-center">
            <CardTitle className="flex items-center gap-2 justify-center">
              <Gift className="h-5 w-5 text-[#4F6B43]" />
              Referrals
            </CardTitle>
            <CardDescription>
              Get <strong className="font-bold text-[#4F6B43]">1 Month Free</strong>, <strong className="font-bold text-[#4F6B43]">5 Dungeon Keys</strong> and <strong className="font-bold text-[#4F6B43]">5 Plan Credits</strong>.<sup>1</sup>
              <br />Referees will also receive <strong className="font-bold text-[#4F6B43]">1 Month Free</strong>.<sup>2</sup>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-lg bg-muted/50 border flex flex-col items-center">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Your Code</p>
                <div className="relative w-full flex justify-center">
                  <p className={cn("text-xl font-mono font-bold text-primary tracking-wide select-all transition-all duration-300", !showReferralCode && "blur-md opacity-20 select-none")}>
                    {referralCode || "..."}
                  </p>
                  {!showReferralCode && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs font-bold shadow-sm hover:scale-105 transition-transform"
                        onClick={() => setShowReferralCode(true)}
                      >
                        View Code
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border flex flex-col items-center">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Referred</p>
                <p className="text-2xl font-bold">{referredCount}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border flex flex-col items-center">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Rewarded</p>
                <p className="text-2xl font-bold text-[#4F6B43]">{rewardedCount}</p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-center">
              Awarded when the referee subscribes<sup>1,2</sup>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Card */}
        <SubscriptionManager
          status={subscriptionStatus}
          hasHadTrial={hasHadTrial}
        />

        {/* Danger Zone Card */}
        <Card className="border-destructive/50 titled-cards">
          <CardHeader className="text-center flex flex-col items-center">
            <CardTitle className="flex items-center gap-2 text-destructive justify-center">
              <ShieldAlert className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Once you delete your account, there is no going back. All progress will be lost.<br />
              Please make sure to cancel your subscription first!
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full max-w-sm">Delete Account</Button>
              </DialogTrigger>
              <DialogContent className="dialog-card-glass text-center flex flex-col items-center">
                <DialogHeader className="w-full">
                  <DialogTitle className="text-center">Are you absolutely sure?</DialogTitle>
                  <DialogDescription className="text-center">
                    This action cannot be undone. This will permanently delete your account
                    and remove your data from our servers. To confirm, please type <strong>DELETE</strong> below.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 w-full max-w-sm">
                  <Input
                    id="deleteConfirm"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    className="text-center"
                  />
                </div>
                <DialogFooter className="w-full flex justify-center">
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirm !== "DELETE"}
                    className="w-full sm:w-auto"
                  >
                    I understand, delete my account
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading Settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
