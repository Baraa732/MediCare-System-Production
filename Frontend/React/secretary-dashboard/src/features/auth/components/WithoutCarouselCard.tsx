import { LayoutCard } from ".";
import { Outlet } from "react-router";
import { CardWithoutBackground } from "./CardWithoutBackground";
import { PageTransition } from "@/components/motion/PageTransition";

export default function WithoutCarouselCard() {
  return (
    <main className="auth-canvas relative flex min-h-screen w-full items-center justify-center overflow-hidden p-4 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgb(0_102_255/0.08),transparent_55%)]"
      />
      <PageTransition className="relative z-10 w-full max-w-lg">
        <CardWithoutBackground className="mx-auto w-full">
          <LayoutCard>
            <div className="auth-form-shell">
              <Outlet />
            </div>
          </LayoutCard>
        </CardWithoutBackground>
      </PageTransition>
    </main>
  );
}
