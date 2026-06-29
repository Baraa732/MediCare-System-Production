import { ArrowLeft, MailIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Person } from "@/assets/icons";
import { LayoutCard } from "../";

interface AccountDeactivatedDialogProps {
  isOpen: boolean;
  onClose: () => void;
  adminEmailAddress?: string;
  onContactSupport?: () => void;
}

export function AccountDeactivatedDialog({
  isOpen,
  onClose,
  adminEmailAddress = "Admin@clinic.com",
  onContactSupport,
}: AccountDeactivatedDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        /* Configured to preserve layout sizing consistency across your portal system windows */
        className=" scale-[0.7] md:max-w-[50%] lg:max-w-[40%] p-0  bg-white rounded-[2.5rem] border-none shadow-2xl overflow-hidden gap-0 outline-none"
      >
        <LayoutCard>
          <div className="p-7">
            {/* Central Attention Banner Presentation Layer */}
            <DialogHeader className="flex flex-col items-center text-center my-10">
              {/* Warning Icon Container Element */}
              <DialogTitle className="flex items-center justify-center w-20 h-20 rounded-full bg-amber-50 text-amber-500 mb-6 select-none">
                <Person className="w-28 h-28 stroke-2" />
              </DialogTitle>

              {/* Main Context Typography Descriptions */}
              <h2 className="font-inter text-[32px] font-semibold leading-[1.3] tracking-[-0.5px] text-[#1A1B1E] mb-3">
                Account Deactivated
              </h2>
              <DialogDescription className="font-inter text-lg font-normal leading-[1.6] tracking-normal text-center text-[#929296]">
                Your account has been deactivated, please contact your clinic
                administrator to reactivate your account
              </DialogDescription>
            </DialogHeader>

            {/* Informational Action Blocks Stack */}
            <div className="mt-6 w-full space-y-6">
              {/* Admin Contact Destination Mail Block */}
              <div className="w-full p-4 bg-[#f4f8ff] border border-blue-100 rounded-xl flex items-center  gap-6.25 text-left">
                <div className="flex h-full items-center justify-center w-9 rounded-lg text-[#0066ff]  ">
                  <MailIcon className="" />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="font-inter text-lg font-normal leading-[1.6] tracking-normal text-[#1A1B1E]">
                    Contact your clinic administrator at:
                  </p>
                  <a
                    href={`mailto:${adminEmailAddress}`}
                    className="font-inter text-lg font-normal leading-[1.6] tracking-normal underline underline-offset-0 decoration-0 text-[#0B74FA] break-all"
                  >
                    {adminEmailAddress}
                  </a>
                </div>
              </div>

              {/* Primary View Dismissal Control */}
              <Button
                type="button"
                onClick={onClose}
                className="w-full h-12 bg-[#0066ff] hover:bg-[#0052cc] text-white font-bold text-sm rounded-xl transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4 " />
                Back to Login
              </Button>

              {/* Secondary Ticketing Footnote Action Link */}
              <div className="pt-4 border-t border-neutral-100 text-start">
                <p className="font-inter text-sm font-normal leading-normal tracking-[0.02em] text-[#929296]">
                  If you believe this is an error, please reach out to out
                  technical support by{" "}
                  <button
                    type="button"
                    onClick={onContactSupport}
                    className="font-inter text-sm font-normal leading-normal tracking-[0.02em] underline underline-offset-2 decoration-0 text-[#0B74FA] cursor-pointer inline-block bg-transparent p-0 border-none outline-none"
                  >
                    contacting with us
                  </button>
                </p>
              </div>
            </div>
          </div>
        </LayoutCard>
      </DialogContent>
    </Dialog>
  );
}
