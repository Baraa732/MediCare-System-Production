import { useEffect, useRef, useState } from "react";
import {
  Building2,
  Camera,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  Shield,
  User,
  X,
} from "lucide-react";
import { useNavigate } from "react-router";
import { AuthAvatar } from "@/components/AuthAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logout as logoutApi } from "@/lib/api/auth";
import { normalizeCaughtError } from "@/lib/api/errors";
import {
  changePassword,
  clearAvatarCacheForUser,
  getUserProfile,
  updateUserProfile,
  uploadUserAvatar,
} from "@/lib/api/users";
import type { UserProfile } from "@/lib/api/types";
import { useAuthStore } from "@/stores/authStore";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import { useProfileDrawerStore } from "@/stores/profileDrawerStore";
import { cn } from "@/lib/utils";

function displayName(profile: UserProfile | null, role: string | null) {
  if (profile?.firstName || profile?.lastName) {
    return `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim();
  }
  return role === "CLINIC_ADMIN" ? "Clinic Admin" : "Account";
}

function initials(profile: UserProfile | null, role: string | null) {
  const name = displayName(profile, role);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return role === "CLINIC_ADMIN" ? "CA" : "U";
}

export function ProfileDrawer() {
  const navigate = useNavigate();
  const isOpen = useProfileDrawerStore((s) => s.isOpen);
  const activeTab = useProfileDrawerStore((s) => s.activeTab);
  const close = useProfileDrawerStore((s) => s.close);
  const setTab = useProfileDrawerStore((s) => s.setTab);

  const userId = useAuthStore((s) => s.userId);
  const token = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const logout = useAuthStore((s) => s.logout);
  const { clinic } = useClinicAdmin();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !userId || !token) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setMessage(null);

    void getUserProfile(userId, token)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setFirstName(data.firstName ?? "");
        setLastName(data.lastName ?? "");
        setEmail(data.email ?? "");
      })
      .catch((err) => {
        if (!cancelled) setError(normalizeCaughtError(err, "Failed to load profile"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, userId, token]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !token) return;
    setSavingProfile(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateUserProfile(
        userId,
        { firstName, lastName, email: email || undefined },
        token,
      );
      setProfile(updated);
      setMessage("Profile updated.");
    } catch (err) {
      setError(normalizeCaughtError(err, "Could not update profile"));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !token) return;
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSavingPassword(true);
    setError(null);
    setMessage(null);
    try {
      await changePassword(userId, { currentPassword, newPassword }, token);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password changed successfully.");
    } catch (err) {
      setError(normalizeCaughtError(err, "Could not change password"));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    if (accessToken && refreshToken) {
      void logoutApi(refreshToken, accessToken).catch(() => undefined);
    }
    close();
    logout();
    navigate("/auth/login", { replace: true });
  };

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId || !token) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be 2 MB or smaller.");
      return;
    }

    setUploadingAvatar(true);
    setError(null);
    setMessage(null);
    try {
      clearAvatarCacheForUser(userId);
      const updated = await uploadUserAvatar(userId, file, token);
      setProfile(updated);
      setAvatarVersion((v) => v + 1);
      setMessage("Profile photo updated.");
    } catch (err) {
      setError(normalizeCaughtError(err, "Could not upload photo"));
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-[#1a1b1e]/40 backdrop-blur-[2px] profile-drawer-backdrop"
        aria-label="Close profile panel"
        onClick={close}
      />

      <aside
        className="relative h-full w-full max-w-[420px] bg-white border-l border-[#e1dfdd] shadow-2xl flex flex-col profile-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Profile settings"
      >
        <div className="shrink-0 bg-[#0066ff] px-5 pt-5 pb-6 text-white relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
          <div className="absolute right-10 bottom-0 w-16 h-16 rounded-full bg-white/5" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <AuthAvatar
                  userId={userId ?? undefined}
                  avatarUrl={
                    profile?.avatarUrl
                      ? `${profile.avatarUrl}${profile.avatarUrl.includes("?") ? "&" : "?"}v=${avatarVersion}`
                      : `v-${avatarVersion}`
                  }
                  fallback={initials(profile, role)}
                  className="w-14 h-14 border-2 border-white/30"
                  fallbackClassName="text-sm"
                />
                <button
                  type="button"
                  onClick={handleAvatarPick}
                  disabled={uploadingAvatar || loading}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white text-[#0066ff] flex items-center justify-center shadow-md hover:bg-[#ecf3ff] transition-colors disabled:opacity-60"
                  title="Change photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => void handleAvatarChange(e)}
                />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-base truncate">
                  {loading ? "Loading…" : displayName(profile, role)}
                </p>
                <p className="text-xs text-white/80 truncate">{profile?.phoneNumber ?? "—"}</p>
                <span className="inline-flex mt-1.5 items-center gap-1 rounded-sm bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  <Shield className="w-3 h-3" />
                  {profile?.role ?? role ?? "Admin"}
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={close}
              className="h-8 w-8 rounded-sm text-white hover:bg-white/15 shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {clinic?.name && (
            <p className="relative mt-4 flex items-center gap-1.5 text-xs text-white/85">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{clinic.name}</span>
            </p>
          )}
        </div>

        <div className="shrink-0 flex border-b border-[#edebe9] px-4 pt-3 gap-1">
          {(
            [
              { id: "profile" as const, label: "Profile", icon: User },
              { id: "security" as const, label: "Security", icon: KeyRound },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-sm border-b-2 -mb-px transition-colors",
                activeTab === id
                  ? "border-[#0066ff] text-[#0066ff] bg-[#ecf3ff]/50"
                  : "border-transparent text-[#929296] hover:text-[#1a1b1e]",
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-sm px-3 py-2">
              {error}
            </p>
          )}
          {message && (
            <p className="text-sm text-[#0066ff] bg-[#ecf3ff] border border-[#c7dcff] rounded-sm px-3 py-2">
              {message}
            </p>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="pbi-spinner" />
              <p className="text-sm text-[#929296]">Loading account…</p>
            </div>
          ) : activeTab === "profile" ? (
            <>
              <div className="flex items-center justify-between rounded-sm border border-[#edebe9] bg-[#faf9f8] px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-[#1a1b1e]">Profile photo</p>
                  <p className="text-[11px] text-[#929296]">JPEG, PNG or WebP · max 2 MB</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAvatarPick}
                  disabled={uploadingAvatar}
                  className="rounded-sm h-8 text-xs"
                >
                  {uploadingAvatar ? "Uploading…" : "Change"}
                </Button>
              </div>

              {profile && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-sm border border-[#edebe9] bg-[#faf9f8] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#929296] flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Phone
                    </p>
                    <p className="text-sm font-medium mt-1 truncate">{profile.phoneNumber}</p>
                  </div>
                  <div className="rounded-sm border border-[#edebe9] bg-[#faf9f8] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#929296]">Status</p>
                    <p className="text-sm font-medium mt-1">{profile.status}</p>
                  </div>
                </div>
              )}

              <form onSubmit={(e) => void saveProfile(e)} className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#929296]">
                  Edit details
                </p>
                <div className="space-y-1.5">
                  <Label>First name</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Last name</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-[#929296]" /> Email
                  </Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <Button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full bg-[#0066ff] hover:bg-[#0052cc] rounded-sm h-9 text-xs font-semibold"
                >
                  {savingProfile ? "Saving…" : "Save profile"}
                </Button>
              </form>
            </>
          ) : (
            <form onSubmit={(e) => void savePassword(e)} className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#929296]">
                Change password
              </p>
              <div className="space-y-1.5">
                <Label>Current password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label>New password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button
                type="submit"
                disabled={savingPassword}
                variant="outline"
                className="w-full rounded-sm h-9 text-xs font-semibold"
              >
                {savingPassword ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
        </div>

        <div className="shrink-0 border-t border-[#edebe9] p-4 flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={close}
            className="flex-1 rounded-sm h-9 text-xs"
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={handleLogout}
            className="flex-1 rounded-sm h-9 text-xs bg-[#1a1b1e] hover:bg-black text-white"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Logout
          </Button>
        </div>
      </aside>
    </div>
  );
}
