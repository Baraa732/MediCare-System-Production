import { ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {LayoutCard} from "../";
import { Key } from "@/assets/icons";


interface NoClinicAccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onContactSupport?: () => void;
}

export function NoClinicAccessDialog({
  isOpen,
  onClose,
  onContactSupport,
}: NoClinicAccessDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        return !open && onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-[33.125%] scale-[0.8] p-0  bg-white rounded-[2.5rem] border-none shadow-2xl overflow-hidden gap-0 outline-none"
       >
        <LayoutCard>
          {/* Central Graphic Presentation Context */}
          <DialogHeader className="flex flex-col items-center text-center mt-21.25">
            <DialogTitle className="flex items-center justify-center w-20 h-20 rounded-full  text-red-500 mb-9">
              {/* Custom structural key list icon geometry mimicry */}
              <div className="relative">
                <Key className="w-22.5 h-22.5 stroke-2" />
              </div>
            </DialogTitle>

            {/* Typography Layout Descriptions */}
            <h2 className="font-inter text-[32px] font-semibold leading-[1.3] tracking-[-0.5px] text-[#1A1B1E]">
              No Clinic Access
            </h2>
            <DialogDescription className="font-inter text-[18px] font-normal leading-[1.6] tracking-normal text-center text-[#929296]">
              It seems like your account is not linked to any clinic, please
              contact an administrator to gain access
            </DialogDescription>
          </DialogHeader>

          {/* Action Triggers Stack */}
          <div className=" mt-34.25   w-full">
            <Button
              type="button"
              onClick={onClose}
              className="w-full h-11.5 bg-[#0066ff] hover:bg-[#0052cc] text-white font-inter text-[18px] font-semibold leading-[1.2] tracking-[0.02em] rounded-xl transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2 mb-6"
            >
              <ArrowLeft className="w-4 h-4 stroke-3 " />
              Back to Login
            </Button>

            {/* Bottom Footnote Context Action Link */}
            <div className=" pt-4 border-t border-[#DBDBDC] text-start">
              <p className="font-inter text-sm font-normal leading-normal tracking-[0.02em]">
                If you believe this is an error, please reach out to our
                technical support by{" "}
                <button
                  type="button"
                  onClick={onContactSupport}
                  className="text-[#0B74FA] underline underline-offset-2 cursor-pointer inline-block bg-transparent p-0 border-none outline-none"
                >
                  contacting with us
                </button>
              </p>
            </div>
          </div>
        </LayoutCard>
      </DialogContent>
    </Dialog>
  );
}
