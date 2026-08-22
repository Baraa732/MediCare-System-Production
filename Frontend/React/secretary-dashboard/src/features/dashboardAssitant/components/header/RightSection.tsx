import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Bell,
  ChevronRight,
  LogOut,
  Settings,
  Shield,
  User,
  Phone,
  Check,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import {
  profileSchema,
  type ProfileFormValues,
} from "../../schemas/ProfileSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { useAuthStore } from "@/stores/authStore";
import { getProfile, updateProfile } from "@/lib/api/users";
import { normalizeCaughtError } from "@/lib/api/errors";
import { useLogout } from "@/hooks/useLogout";
import { ExportScheduleMenu } from "./ExportScheduleMenu";

export function RightSection() {
  const navigate = useNavigate();
  const logout = useLogout();
  const userId = useAuthStore((s) => s.userId);
  const accessToken = useAuthStore((s) => s.accessToken);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    firstName: string;
    lastName: string;
    fullName: string;
    phone: string;
  }>({
    firstName: "",
    lastName: "",
    fullName: "",
    phone: "",
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: "", phone: "" },
  });

  useEffect(() => {
    if (!accessToken || !userId) return;

    let cancelled = false;
    if (isProfileOpen) {
      setProfileLoading(true);
      setProfileError(null);
    }

    void getProfile(userId, accessToken)
      .then((data) => {
        if (cancelled) return;
        const firstName = (data.firstName ?? "").trim();
        const lastName = (data.lastName ?? "").trim();
        const fromProfileData =
          typeof data.profileData?.fullName === "string"
            ? data.profileData.fullName.trim()
            : "";
        const fullName =
          [firstName, lastName].filter(Boolean).join(" ").trim() ||
          fromProfileData;
        const nextProfile = {
          firstName,
          lastName,
          fullName,
          phone: data.phoneNumber ?? "",
        };
        setProfile(nextProfile);
        if (isProfileOpen) {
          reset({ fullName: fullName || "Secretary", phone: nextProfile.phone });
        }
      })
      .catch((err) => {
        if (!cancelled && isProfileOpen) {
          setProfileError(
            normalizeCaughtError(err, "Could not load your profile."),
          );
        }
      })
      .finally(() => {
        if (!cancelled && isProfileOpen) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, userId, isProfileOpen, reset]);

  const initials = (() => {
    const first = profile.firstName.trim();
    const last = profile.lastName.trim();
    if (first && last) {
      return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
    }
    const parts = profile.fullName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
    }
    if (parts.length === 1 && parts[0].length > 0) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return "";
  })();

  const onSaveProfile = async (data: ProfileFormValues) => {
    if (!accessToken || !userId) return;
    setProfileSaving(true);
    setProfileError(null);

    const nameParts = data.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ");

    try {
      await updateProfile(
        userId,
        {
          firstName,
          lastName,
        },
        accessToken,
      );
      setProfile({
        firstName,
        lastName,
        fullName: data.fullName.trim(),
        phone: data.phone,
      });
      setIsProfileOpen(false);
    } catch (err) {
      setProfileError(normalizeCaughtError(err, "Could not update profile."));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCancelProfile = () => {
    reset({ fullName: profile.fullName, phone: profile.phone });
    setIsProfileOpen(false);
  };

  return (
    <div className="flex items-center gap-4">
      <ExportScheduleMenu
        exportedBy={profile.fullName.trim() || "Secretary"}
      />

      <NotificationBell />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white py-1 pr-2 pl-1 shadow-sm transition-all hover:border-blue-200 hover:shadow-[0_8px_20px_-12px_rgba(0,102,255,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066ff]/35"
          >
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarFallback className="rounded-lg bg-[#0066ff] text-[11px] font-bold text-white">
                {initials || "·"}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[120px] truncate text-left text-[11px] font-bold text-neutral-800 sm:block">
              {profile.fullName.trim() || "Secretary"}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={10}
          className="w-[320px] overflow-hidden rounded-2xl border border-neutral-100 bg-white p-0 shadow-[0_18px_40px_-24px_rgba(0,102,255,0.35)]"
        >
          <div className="border-b border-neutral-100 bg-gradient-to-br from-blue-50/90 to-white px-4 py-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 rounded-xl ring-2 ring-white shadow-sm">
                <AvatarFallback className="rounded-xl bg-[#0066ff] text-sm font-bold text-white">
                  {initials || "·"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-neutral-900" dir="auto">
                  {profile.fullName.trim() || "Secretary"}
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#0066ff]">
                  <Shield className="h-3 w-3" />
                  Clinic secretary
                </p>
                {profile.phone ? (
                  <p className="mt-1 truncate text-[11px] text-neutral-500">
                    {profile.phone}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-1 p-2">
            <ProfileMenuItem
              icon={<User className="h-4 w-4 text-[#0066ff]" />}
              iconBg="bg-blue-50"
              title="Profile"
              subtitle="Name shown on the clinic schedule"
              onClick={() => setIsProfileOpen(true)}
            />
            <ProfileMenuItem
              icon={<Bell className="h-4 w-4 text-amber-600" />}
              iconBg="bg-amber-50"
              title="Notifications"
              subtitle="Inbox and push preferences"
              onClick={() => navigate("/dashboard/notifications")}
            />
            <ProfileMenuItem
              icon={<Settings className="h-4 w-4 text-neutral-600" />}
              iconBg="bg-neutral-100"
              title="Settings"
              subtitle="Account, security, and alerts"
              onClick={() => navigate("/dashboard/settings")}
            />
          </div>

          <div className="border-t border-neutral-100 p-2">
            <button
              type="button"
              onClick={() => void logout()}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-red-50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
                <LogOut className="h-4 w-4 text-red-600" />
              </span>
              <span className="flex-1">
                <span className="block text-xs font-bold text-red-600">Log out</span>
                <span className="block text-[10px] text-red-400">
                  End this secretary session
                </span>
              </span>
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <SheetContent
          side="right"
          className="w-[380px] sm:w-[420px] m-6 h-[calc(100%-48px)] rounded-2xl border border-neutral-100 bg-white p-0 shadow-2xl flex flex-col overflow-hidden"
        >
          <form
            onSubmit={handleSubmit(onSaveProfile)}
            className="flex flex-col h-full"
          >
            <SheetHeader className="px-6 py-5 border-b border-neutral-100 bg-gradient-to-br from-blue-50/80 to-white">
              <SheetTitle className="text-base font-bold text-neutral-900">
                Edit profile
              </SheetTitle>
              <p className="text-xs text-neutral-500">
                Update how your name appears on the clinic schedule.
              </p>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {profileLoading ? (
                <p className="text-xs text-neutral-500">Loading profile...</p>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wide">
                      Full Name
                    </label>
                    <div className="relative flex items-center">
                      <User className="absolute left-3 w-4 h-4 text-neutral-400" />
                      <Input
                        {...register("fullName")}
                        className={`pl-9 h-10 border-neutral-200 rounded-xl text-xs font-medium focus-visible:ring-[#0066ff] ${errors.fullName ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                        placeholder="Enter your full name"
                      />
                    </div>
                    {errors.fullName && (
                      <p className="text-[10px] font-semibold text-red-500 mt-1 pl-1">
                        {errors.fullName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wide">
                      Phone Number
                    </label>
                    <div className="relative flex items-center">
                      <Phone className="absolute left-3 w-4 h-4 text-neutral-400" />
                      <Input
                        {...register("phone")}
                        disabled
                        className="pl-9 h-10 border-neutral-200 rounded-xl text-xs font-medium bg-neutral-50"
                        placeholder="Phone number"
                      />
                    </div>
                  </div>

                  {profileError ? (
                    <p className="text-[10px] font-semibold text-red-500">
                      {profileError}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-neutral-100 bg-neutral-50/70">
              <Button
                type="button"
                onClick={handleCancelProfile}
                variant="outline"
                className="flex-1 h-10 border-neutral-200 hover:bg-neutral-50 rounded-xl text-xs font-bold text-neutral-600 gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </Button>
              <Button
                type="submit"
                disabled={profileSaving || profileLoading}
                className="btn-brand h-10 flex-1 rounded-xl border-0 text-xs font-bold shadow-sm cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{profileSaving ? "Saving..." : "Save Changes"}</span>
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ProfileMenuItem({
  icon,
  iconBg,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-blue-50/70"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-neutral-900">{title}</span>
        <span className="mt-0.5 block text-[10px] text-neutral-500">{subtitle}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
    </button>
  );
}
