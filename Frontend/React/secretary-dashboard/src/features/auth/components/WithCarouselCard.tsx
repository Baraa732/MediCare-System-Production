import { CardWithBackground, AuthCarousel, LayoutCard } from ".";
import { Outlet } from "react-router";
import { PageTransition } from "@/components/motion/PageTransition";

export default function WithCarouselCard() {
  return (
    <main className="auth-canvas relative flex min-h-screen w-full items-center justify-center overflow-hidden p-4 sm:p-6 lg:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-8 h-80 w-80 rounded-full bg-indigo-400/10 blur-3xl"
      />
      <PageTransition className="relative z-10 w-full max-w-6xl">
        <CardWithBackground className="mx-auto w-full">
          <LayoutCard>
            <div className="auth-form-shell">
              <Outlet />
            </div>
          </LayoutCard>
          <AuthCarousel />
        </CardWithBackground>
      </PageTransition>
    </main>
  );
}
