import { useRedLine } from "../../hooks";

export function RedTimeBox(): React.ReactNode {
  const timeLineTop = useRedLine((state) => state.timeLineTop);
  const currentTimeText = useRedLine((state) => state.currentTimeText);

  return (
    timeLineTop > 0 && (
      <div
        className="absolute right-0 z-50 pointer-events-none flex items-center"
        style={{ top: timeLineTop }}
      >
        {/* <div className="bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm ml-1 shadow-sm leading-none -translate-y-[40%]"> */}
        <div className="bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm ml-1 shadow-sm leading-none translate-y-[-40%]">
          {currentTimeText}
        </div>
      </div>
    )
  );
}