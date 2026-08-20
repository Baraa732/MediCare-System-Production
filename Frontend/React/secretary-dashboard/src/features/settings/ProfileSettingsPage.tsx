import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Bell, Lock, Shield, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffShell } from "@/components/StaffShell";
import { EnablePushBanner } from "@/features/notifications/EnablePushBanner";
import { useAuthStore } from "@/stores/authStore";
import { changePassword, getProfile, updateProfile } from "@/lib/api/users";
import { normalizeCaughtError } from "@/lib/api/errors";
import type { UserProfile } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type Tab = "profile" | "security" | "notifications";

export function ProfileSettingsPage() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userId);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [tab, setTab] = useState<Tab>("profile");

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!accessToken || !userId) return;

    void getProfile(userId, accessToken)
      .then((data) => {
        setProfile(data);
        setFirstName(data.firstName ?? "");
        setLastName(data.lastName ?? "");
        setEmail(data.email ?? "");
      })
      .catch((err) => {
        setProfileError(normalizeCaughtError(err, "Could not load your profile."));
      })
      .finally(() => setLoadingProfile(false));
  }, [accessToken, userId]);

  const tabs = useMemo(
    () => [
      { id: "profile" as const, label: "Profile", icon: UserRound },
      { id: "security" as const, label: "Security", icon: Lock },
      { id: "notifications" as const, label: "Notifications", icon: Bell },
    ],
    [],
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !userId) return;
    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      const updated = await updateProfile(
        userId,
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || undefined,
        },
        accessToken,
      );
      setProfile(updated);
      setProfileSuccess("Profile updated.");
    } catch (err) {
      setProfileError(normalizeCaughtError(err, "Could not update profile."));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !userId) return;
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    setSavingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);
    try {
      const res = await changePassword(
        userId,
        { currentPassword, newPassword },
        accessToken,
      );
      setPasswordSuccess(res.message || "Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(normalizeCaughtError(err, "Could not change password."));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <StaffShell title="Settings" subtitle="Profile, security, and browser alerts">
      <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
        <div className="fade-up mb-5 flex flex-wrap gap-2">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all duration-200",
                  tab === item.id
                    ? "border-blue-200 bg-blue-50 text-[#0066ff] shadow-sm"
                    : "border-neutral-200 bg-white text-neutral-600 hover:-translate-y-px hover:bg-neutral-50",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === "profile" ? (
          <section className="surface-card fade-up-delay-1 p-6">
            <h2 className="text-base font-bold">Your profile</h2>
            <p className="mb-5 mt-1 text-sm text-neutral-500">
              This name is used on the schedule and exported reports.
            </p>
            {loadingProfile ? (
              <p className="text-sm text-neutral-500">Loading profile…</p>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                {profile && (
                  <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                    Phone <span className="font-semibold text-neutral-900">{profile.phoneNumber}</span>
                    <span className="mx-2 text-neutral-300">·</span>
                    Role <span className="font-semibold capitalize">{profile.role.toLowerCase()}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-600">First name</label>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="input-modern text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-600">Last name</label>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="input-modern text-sm"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-600">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-modern text-sm"
                  />
                </div>
                {profileError && <p className="text-sm text-red-600">{profileError}</p>}
                {profileSuccess && <p className="text-sm text-green-700">{profileSuccess}</p>}
                <Button type="submit" disabled={savingProfile} className="btn-brand rounded-xl border-0">
                  {savingProfile ? "Saving…" : "Save profile"}
                </Button>
              </form>
            )}
          </section>
        ) : null}

        {tab === "security" ? (
          <section className="surface-card fade-up-delay-1 p-6">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-50 text-neutral-700">
                <Shield className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-bold">Change password</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Use at least 8 characters with mixed case, a number, and a symbol.
                </p>
              </div>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-600">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input-modern text-sm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-600">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-modern text-sm"
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-600">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-modern text-sm"
                  required
                  minLength={8}
                />
              </div>
              {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
              {passwordSuccess && <p className="text-sm text-green-700">{passwordSuccess}</p>}
              <Button type="submit" variant="outline" disabled={savingPassword} className="rounded-xl">
                {savingPassword ? "Updating…" : "Change password"}
              </Button>
            </form>
          </section>
        ) : null}

        {tab === "notifications" ? (
          <section className="space-y-4 rounded-2xl border border-neutral-100 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold">Alert settings</h2>
            <p className="text-sm text-neutral-500">
              Secretaries should receive a browser alert for new patient requests,
              bookings, reschedules, and cancellations — including when this tab is
              in the background.
            </p>
            <EnablePushBanner />
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => navigate("/dashboard/notifications")}
            >
              Open notification inbox
            </Button>
          </section>
        ) : null}
      </div>
    </StaffShell>
  );
}
