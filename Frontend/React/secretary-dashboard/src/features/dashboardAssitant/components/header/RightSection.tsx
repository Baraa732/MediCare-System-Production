import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Download,
  FileText,
  LogOut,
  Settings,
  Table,
  User,
  Phone,
  Check,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { useScheduleContext } from "../../context/ScheduleContext";

export function RightSection() {
  const navigate = useNavigate();
  const logout = useLogout();
  const userId = useAuthStore((s) => s.userId);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { appointments } = useScheduleContext();

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

  const handleExport = (type: "pdf" | "excel") => {
    const rows = appointments.map((apt) => [
      apt.id,
      apt.doctorId,
      apt.patientId,
      apt.scheduledAt,
      apt.durationMinutes,
      apt.status,
      apt.reason ?? "",
    ]);
    const header = [
      "Appointment ID",
      "Doctor ID",
      "Patient ID",
      "Scheduled At",
      "Duration",
      "Status",
      "Reason",
    ];
    const csv = [header, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], {
      type: type === "excel" ? "text/csv;charset=utf-8;" : "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      type === "excel" ? "clinic-schedule.csv" : "clinic-schedule-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCancelProfile = () => {
    reset({ fullName: profile.fullName, phone: profile.phone });
    setIsProfileOpen(false);
  };

  return (
    <div className="flex items-center gap-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="btn-brand h-9.5 rounded-xl px-4 text-xs font-bold shadow-sm cursor-pointer">
            <Download className="w-3.5 h-3.5" />
            <span>Download schedule</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-40 rounded-xl p-1 bg-white border border-neutral-200 shadow-lg"
        >
          <DropdownMenuItem
            onClick={() => handleExport("pdf")}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-neutral-700 rounded-lg hover:bg-neutral-50 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-red-500" />
            <span>Export as CSV</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleExport("excel")}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-neutral-700 rounded-lg hover:bg-neutral-50 cursor-pointer"
          >
            <Table className="w-3.5 h-3.5 text-green-600" />
            <span>Export spreadsheet</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NotificationBell />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Avatar className="w-9.5 h-9.5 rounded-xl border border-neutral-200 cursor-pointer hover:opacity-90 transition-opacity">
            <AvatarFallback className="rounded-xl font-bold bg-[#0066ff] text-white text-xs">
              {initials || "·"}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-xl p-1">
          <DropdownMenuItem
            onClick={() => setIsProfileOpen(true)}
            className="text-xs font-semibold cursor-pointer"
          >
            <User className="w-3.5 h-3.5 mr-2" />
            Edit profile
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => navigate("/dashboard/notifications")}
            className="text-xs font-semibold cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5 mr-2" />
            Notifications
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => navigate("/dashboard/settings")}
            className="text-xs font-semibold cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 mr-2" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => void logout()}
            className="text-xs font-semibold text-red-600 cursor-pointer focus:text-red-600"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            Log out
          </DropdownMenuItem>
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
