import { useRedLine } from "../../hooks";

export function RedTimeLine(): React.ReactNode {
  const timeLineTop = useRedLine((state) => state.timeLineTop);

  return (
    timeLineTop > 0 && (
      <div
        className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
        style={{ top: timeLineTop }}
      >
        <div className="flex-1 h-0.5 bg-red-500 shadow-xs" />
      </div>
    )
  );
}