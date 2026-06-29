import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, EffectFade } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/effect-fade";
import { SLIDE_ASSETS } from "../data/Slides";
import "./../styles/styleCarousel.css"; 

export default function AuthCarousel() {
  return (
    <div className="absolute top-0 right-0 hidden lg:block w-[55%] h-full bg-neutral-900 overflow-hidden ">
      <Swiper
        modules={[Autoplay, Pagination, EffectFade]}
        effect="fade"
        speed={800}
        autoplay={{ delay: 5000, disableOnInteraction: false }}
        pagination={{
          clickable: true,
          el: ".custom-swiper-pagination",
          bulletClass: "custom-bullet",
          bulletActiveClass: "custom-bullet-active",
          dynamicBullets: true,
          dynamicMainBullets: 1,
        }}
        className="relative w-full h-full"
      >
        {SLIDE_ASSETS.map((slide) => (
          <SwiperSlide key={slide.id} className="relative w-full h-full">
            <div className="absolute inset-0 w-full h-full bg-blue-950/20 mix-blend-multiply z-10" />
            <img
              src={slide.image}
              alt="Contextual background illustration"
              className="w-full h-full object-cover select-none"
              loading="eager"
            />

            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-[60%] xl:w-[65%] z-20">
              <div className="p-6 pb-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] text-center">
                <p className="text-sm font-medium text-white tracking-wide leading-relaxed drop-shadow-xs">
                  {slide.message}
                </p>
              </div>
            </div>
          </SwiperSlide>
        ))}

        <div className="absolute bottom-17 left-1/2 -translate-x-1/2 z-30 w-full max-w-50 flex items-center justify-center h-6 pointer-events-auto select-none">
          <div className="custom-swiper-pagination static! transform-none! overflow-visible! flex items-center justify-center" />
        </div>
      </Swiper>
    </div>
  );
}
