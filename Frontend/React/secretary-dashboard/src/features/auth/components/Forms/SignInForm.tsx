import * as React from "react";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { useSignIn } from "../../hooks/useSignIn";
import { cn } from "@/lib/utils";
import { Link } from "react-router";

export  function SignInForm() {
  const { form, onSubmit, isLoading, errorAPI } = useSignIn();
  const [showPassword, setShowPassword] = React.useState<boolean>(false);

  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="flex-1 flex flex-col justify-center p-7 w-full mx-auto">
      <div className="mb-8">
        <h1 className=" font-inter font-semibold text-4xl leading-[1.3] tracking-[-0.5px] text-[#1A1B1E]">
          Sign in
        </h1>
        <p className="font-normal text-[18px] mt-1.5 leading-normal tracking-[-0.5px] text-[#929296]">
          Please login to continue to the system
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-3">
          <div className="relative">
            <input
              {...register("phoneNumber")}
              type="tel"
              id="phoneNumber"
              placeholder="Enter your phone number (e.g. +963912345680)"
              disabled={isLoading}
              aria-invalid={errors.phoneNumber || errorAPI ? "true" : "false"}
              className={cn(
                "w-full px-4 py-3  font-inter font-normal text-[18px] leading-0 tracking-[1.5] text-[#1A1B1E] placeholder:text-neutral-400 bg-white border rounded-lg outline-hidden focus:ring-4 transition-all duration-200",
                errors.phoneNumber || errorAPI
                  ? "border-red-500 focus:border-red-500 focus:ring-red-100"
                  : "border-neutral-200 focus:border-[#0066ff] focus:ring-blue-100",
                isLoading ? "cursor-not-allowed" : "pointer-events-auto",
              )}
            />
          </div>
          {errors.phoneNumber && (
            <p className="font-inter font-normal text-[18px] leading-[2%] tracking-[1.5] text-[#E53935] pl-1 animate-in fade-in slide-in-from-top-1 duration-200">
              {errors.phoneNumber.message}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div className="relative">
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              id="password"
              placeholder="Enter your password"
              disabled={isLoading}
              aria-invalid={errors.password || errorAPI ? "true" : "false"}
              className={cn(
                "w-full pl-4 pr-11 py-3 font-inter font-normal text-[18px] leading-0 tracking-[1.5] placeholder:text-neutral-400 bg-white border rounded-lg outline-hidden focus:ring-4 transition-all duration-200",
                errors.password || errorAPI
                  ? "border-red-500 focus:border-red-500 focus:ring-red-100"
                  : "border-neutral-200 focus:border-[#0066ff] focus:ring-blue-100",
                isLoading ? "cursor-not-allowed" : "pointer-events-auto",
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={isLoading}
              tabIndex={0}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-neutral-200 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="font-inter font-normal text-[18px] leading-[2%] tracking-[1.5] text-[#E53935] pl-1 animate-in fade-in slide-in-from-top-1 duration-200">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-2.5 group cursor-pointer select-none">
            <input
              {...register("rememberMe")}
              type="checkbox"
              disabled={isLoading}
              className="w-4.5 h-4.5 border border-neutral-300 rounded-md checked:bg-[#0066ff] checked:border-[#0066ff] accent-[#0066ff] focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer disabled:cursor-not-allowed"
            />
            <span
              className={cn(
                "font-inter text-[18px] font-normal leading-normal tracking-[0.02em] text- group-hover:text-neutral-900 transition-colors",
                isLoading ? "cursor-not-allowed" : "pointer-events-auto",
              )}
            >
              Keep me logged in
            </span>
          </label>
        </div>

        <div className="space-y-4 pt-2">
          {errorAPI && (
            <div
              role="alert"
              className="flex items-start gap-2.5 text-[#B42318] pl-1 bg-red-50/80 p-3 rounded-xl border border-red-100 animate-in fade-in slide-in-from-top-1 duration-200"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-inter font-medium text-[15px] leading-snug text-[#B42318]">
                  {errorAPI}
                </p>
                <p className="font-inter text-[13px] leading-snug text-[#93370D]">
                  Need help? Use{" "}
                  <Link
                    to="/auth/forget_password"
                    className="text-[#0B74FA] font-medium hover:underline"
                  >
                    Forgot password
                  </Link>{" "}
                  or contact your clinic administrator.
                </p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "w-full flex items-center justify-center h-13   hover:bg-[#b3d1ff] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-[22px] leading-[1.2] tracking-[2%] rounded-xl transition-all duration-200 focus:outline-hidden focus:ring-4 focus:ring-blue-100 cursor-pointer font-inter",
              isLoading ? "bg-[#cce0ff]" : "bg-[rgba(11_116_250/1)]",
            )}
          >
            Sign in
          </button>

          <div className="text-center pt-1">
            <Link
              to="/auth/forget_password"
              className="inline-block text-[18px] font-normal text-[#0B74FA] leading-normal tracking-[2%  ] hover:underline underline-offset-4 focus:outline-hidden focus:ring-2 focus:ring-blue-200 rounded-sm px-1 py-0.5"
            >
              Forgot password?
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
