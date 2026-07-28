import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Download,
  FileText,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

// بيانات وهمية للاختبار (Mock Data) لشاشتي الإشعارات والبروفايل
const INITIAL_NOTIFICATIONS = [
  { id: 1, text: "New appointment scheduled with Dr. Albert", unread: true },
  { id: 2, text: "Patient John Doe canceled his 2:00 PM slot", unread: true },
  { id: 3, text: "Daily schedule update available", unread: false },
];

export function RightSection() {
  // 1. حالات التحميل والإشعارات
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const hasUnread = notifications.some((n) => n.unread);

  // 2. حالات ملف المستخدم (User Profile Drawer)
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState({
    fullName: "Motaz Abo Assi",
    phone: "0930000000",
  });

  // 2️⃣ إعداد React Hook Form مع Zod Resolver
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: profile,
  });

  // معالجة فتح الإشعارات وقراءتها
  const handleOpenNotifications = (open: boolean) => {
    if (open) {
      // تحويل جميع الإشعارات إلى "مقروءة" عند الفتح
      setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    }
  };

  const onSaveProfile = (data: ProfileFormValues) => {
    setProfile(data);
    setIsProfileOpen(false);
    console.log("Profile updated via API:", data);
  };

  // معالجة تحميل الملفات
  const handleExport = (type: "pdf" | "excel") => {
    console.log(`Triggering download for: ${type.toUpperCase()}`);
    // هنا يتم ربط الـ API الحقيقي الخاص بك للتحميل
  };

  // التحقق من صحة رقم الهاتف وحفظ البيانات


  const handleCancelProfile = () => {
    reset(profile); // يعيد الحقول إلى قيم الـ profile الحالية المستقرة
    setIsProfileOpen(false);
  };

  return (
    <div className="flex items-center gap-4">
      {/* 🚀 1. زر التحميل مع القائمة المنسدلة */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="h-9.5 bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs font-bold rounded-xl px-4 flex items-center gap-1.5 shadow-xs cursor-pointer">
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
            <span>Export as PDF</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleExport("excel")}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-neutral-700 rounded-lg hover:bg-neutral-50 cursor-pointer"
          >
            <Table className="w-3.5 h-3.5 text-green-600" />
            <span>Export as Excel</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 🚀 2. أيقونة الإشعارات مع الـ Popover والـ Red Badge */}
      <Popover onOpenChange={handleOpenNotifications}>
        <PopoverTrigger asChild>
          <button className="w-9.5 h-9.5 rounded-xl border border-neutral-200 flex items-center justify-center relative hover:bg-neutral-50 text-neutral-600 transition-colors cursor-pointer focus:outline-none">
            <Bell className="w-4 h-4" />
            {hasUnread && (
              <span title="exist notifications not read" className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-80 rounded-2xl p-4 bg-white border border-neutral-100 shadow-xl z-50"
        >
          <div className="pb-2 mb-2 border-b border-neutral-100 flex justify-between items-center">
            <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wide">
              Notifications
            </h4>
            <span className="text-[10px] font-bold bg-blue-50 text-[#0066ff] px-2 py-0.5 rounded-full">
              Live Updates
            </span>
          </div>
          <div className="space-y-1 max-h-60 overflow-y-auto scrollbar-none">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="p-2.5 rounded-xl text-[11px] font-medium text-neutral-600 hover:bg-neutral-50 transition-colors flex items-start gap-2"
              >
                <span
                  className={`w-1.5 h-1.5 mt-1.5 rounded-full shrink-0 ${n.unread ? "bg-[#0066ff]" : "bg-neutral-200"}`}
                />
                <p className="leading-relaxed">{n.text}</p>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* 🚀 3. الصورة الشخصية مع فتح الـ Side Drawer */}
      <Avatar
        onClick={() => setIsProfileOpen(true)}
        className="w-9.5 h-9.5 rounded-xl border border-neutral-200 cursor-pointer hover:opacity-90 transition-opacity"
      >
        <AvatarImage src="https://github.com/shadcn.png" />
        <AvatarFallback className="rounded-xl font-bold bg-[#0066ff] text-white text-xs">
          SC
        </AvatarFallback>
      </Avatar>

      {/* مكون الـ Drawer الجانبي لتعديل الملف الشخصي */}
      <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        {/* استبدل محتوى الـ SheetContent بالهيكل التالي */}
        <SheetContent
          side="right"
          style={{ height: "95%" }}
          className="w-[360px] sm:w-[400px] m-[24px] rounded-2xl bg-white p-6 shadow-2xl border-l border-neutral-100 flex flex-col justify-between"
        >
          {/* 3️⃣ تغليف الحقول داخل Form للتحكم بالـ Submit */}
          <form
            onSubmit={handleSubmit(onSaveProfile)}
            className="flex flex-col h-full justify-between w-full"
          >
            <div>
              <SheetHeader className="pb-4 mb-6 border-b border-neutral-100">
                <SheetTitle className="text-sm font-bold text-neutral-800 uppercase tracking-wide">
                  Edit User Profile
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-5">
                {/* حقل الاسم بالكامل */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wide">
                    Full Name
                  </label>
                  <div className="relative flex items-center">
                    <User className="absolute left-3 w-4 h-4 text-neutral-400" />
                    <Input
                      {...register("fullName")} // ربط الحقل بـ React Hook Form
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

                {/* حقل رقم الهاتف */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wide">
                    Phone Number
                  </label>
                  <div className="relative flex items-center">
                    <Phone className="absolute left-3 w-4 h-4 text-neutral-400" />
                    <Input
                      {...register("phone")} // ربط الحقل بـ React Hook Form
                      className={`pl-9 h-10 border-neutral-200 rounded-xl text-xs font-medium focus-visible:ring-[#0066ff] ${errors.phone ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                      placeholder="Enter your phone number"
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-[10px] font-semibold text-red-500 mt-1 pl-1">
                      {errors.phone.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* أزرار الحفظ والإلغاء في أسفل الـ Form */}
            <div className="flex items-center gap-3 pt-4 border-t border-neutral-100 mt-auto">
              <Button
                type="button" // تغيير النوع إلى button لمنع عمل submit تلقائي عند الإلغاء
                onClick={handleCancelProfile}
                variant="outline"
                className="flex-1 h-10 border-neutral-200 hover:bg-neutral-50 rounded-xl text-xs font-bold text-neutral-600 gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </Button>
              <Button
                type="submit" // هذا الزر سيقوم بتشغيل handleSubmit التابع لـ Zod تلقائياً
                className="flex-1 h-10 bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs font-bold rounded-xl gap-1 shadow-sm cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
