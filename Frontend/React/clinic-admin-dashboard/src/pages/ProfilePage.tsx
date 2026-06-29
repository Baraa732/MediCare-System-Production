import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/stores/authStore";
import { changePassword, getUserProfile, updateUserProfile } from "@/lib/api/users";
import { normalizeCaughtError } from "@/lib/api/errors";
import type { UserProfile } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfilePage() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userId);
  const token = useAuthStore((s) => s.accessToken)!;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    void getUserProfile(userId, token)
      .then((data) => {
        setProfile(data);
        setFirstName(data.firstName ?? "");
        setLastName(data.lastName ?? "");
        setEmail(data.email ?? "");
      })
      .catch((err) => setError(normalizeCaughtError(err, "Failed to load profile")))
      .finally(() => setLoading(false));
  }, [userId, token]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    try {
      const updated = await updateUserProfile(userId, { firstName, lastName, email: email || undefined }, token);
      setProfile(updated);
      setMessage("Profile updated.");
    } catch (err) {
      setError(normalizeCaughtError(err, "Could not update profile"));
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await changePassword(userId, { currentPassword, newPassword }, token);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password changed successfully.");
    } catch (err) {
      setError(normalizeCaughtError(err, "Could not change password"));
    }
  };

  if (loading) return <p className="text-neutral-500">Loading profile…</p>;

  return (
    <div className="space-y-6 max-w-lg">
      <Button type="button" variant="outline" onClick={() => navigate("/dashboard")} className="rounded-xl">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to dashboard
      </Button>

      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Profile settings</h1>
        <p className="text-neutral-500 mt-1">Your clinic admin account</p>
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {message && <p className="text-sm text-[#0066ff] bg-[#ecf3ff] px-4 py-2 rounded-xl">{message}</p>}

      {profile && (
        <Card className="ring-neutral-200">
          <CardHeader><CardTitle>Account info</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-neutral-500">Phone:</span> {profile.phoneNumber}</p>
            <p><span className="text-neutral-500">Role:</span> {profile.role}</p>
            <p><span className="text-neutral-500">Status:</span> {profile.status}</p>
          </CardContent>
        </Card>
      )}

      <Card className="ring-neutral-200">
        <CardHeader><CardTitle>Edit profile</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => void saveProfile(e)} className="space-y-4">
            <div className="space-y-1.5"><Label>First name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <Button type="submit" className="bg-[#0066ff] hover:bg-[#0052cc] rounded-xl">Save profile</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="ring-neutral-200">
        <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => void savePassword(e)} className="space-y-4">
            <div className="space-y-1.5"><Label>Current password</Label><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>New password</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Confirm password</Label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
            <Button type="submit" variant="outline" className="rounded-xl">Update password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
