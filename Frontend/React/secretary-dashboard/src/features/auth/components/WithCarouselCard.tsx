import { CardWithBackground, AuthCarousel, LayoutCard } from ".";
import { Outlet } from "react-router";

export default function WithCarouselCard() {
  return (
    <main className=" w-full h-screen bg-[#ecf3ff] flex items-center justify-center  antialiased selection:bg-blue-100 selection:text-[rgb(11_116_250/0.1)] p-0 m-0">
      <CardWithBackground className="scale-[0.75] ">
        <LayoutCard>
          <Outlet />
        </LayoutCard>
        <AuthCarousel />
      </CardWithBackground>
    </main>
  );
}
