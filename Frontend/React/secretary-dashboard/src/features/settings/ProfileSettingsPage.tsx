import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { changePassword, getProfile, updateProfile } from "@/lib/api/users";
import { normalizeCaughtError } from "@/lib/api/errors";
import type { UserProfile } from "@/lib/api/types";

export function ProfileSettingsPage() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userId);
  const accessToken = useAuthStore((s) => s.accessToken);

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
        setProfileError(
          normalizeCaughtError(err, "Could not load your profile."),
        );
      })
      .finally(() => setLoadingProfile(false));
  }, [accessToken, userId]);

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
      setProfileSuccess("Profile updated successfully.");
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
      setPasswordSuccess(res.message || "Password changed successfully.");
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
    <div className="flex h-screen w-screen bg-neutral-50 overflow-hidden font-sans text-neutral-900">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-neutral-200 bg-white px-6 flex items-center gap-4 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to schedule
          </Button>
          <h1 className="text-lg font-semibold">Profile &amp; security</h1>
        </header>

        <main className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full space-y-8">
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs">
            <h2 className="text-base font-semibold mb-1">Profile</h2>
            <p className="text-sm text-neutral-500 mb-4">
              Update your name and contact email.
            </p>

            {loadingProfile ? (
              <p className="text-sm text-neutral-500">Loading profile…</p>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                {profile && (
                  <p className="text-sm text-neutral-600">
                    Phone: <span className="font-medium">{profile.phoneNumber}</span>
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-600">First name</label>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-600">Last name</label>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
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
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                {profileError && (
                  <p className="text-sm text-red-600">{profileError}</p>
                )}
                {profileSuccess && (
                  <p className="text-sm text-green-700">{profileSuccess}</p>
                )}
                <Button
                  type="submit"
                  disabled={savingProfile}
                  className="bg-[#0066ff] hover:bg-[#0052cc]"
                >
                  {savingProfile ? "Saving…" : "Save profile"}
                </Button>
              </form>
            )}
          </section>

          <section className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs">
            <h2 className="text-base font-semibold mb-1">Change password</h2>
            <p className="text-sm text-neutral-500 mb-4">
              Use a strong password with uppercase, lowercase, number, and symbol.
            </p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-600">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-600">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
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
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  required
                  minLength={8}
                />
              </div>
              {passwordError && (
                <p className="text-sm text-red-600">{passwordError}</p>
              )}
              {passwordSuccess && (
                <p className="text-sm text-green-700">{passwordSuccess}</p>
              )}
              <Button
                type="submit"
                variant="outline"
                disabled={savingPassword}
              >
                {savingPassword ? "Updating…" : "Change password"}
              </Button>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}
