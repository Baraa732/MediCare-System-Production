import { useHandleSelection } from "../../../hooks";
import {
  BackgroundGridLine,
  DoctorsColumnLayout,
  RedTimeLine,
  TimeColumn,
  TopStickyHeader,
} from "..";
import { useScheduleDnd } from "../../../context/ScheduleDndContext";

export function DNDGrid() {
  const { doctors, overSlotInfo } = useScheduleDnd();

  const handleSelectionCommit = useHandleSelection(
    (state) => state.handleSelectionCommit,
  );

  return (
    <div className="relative flex-1 overflow-x-auto whitespace-nowrap scrollbar-thin antialiased">
      <div className="flex w-full min-w-max flex-col">
        <TopStickyHeader doctors={doctors} />
        <div className="relative flex" onMouseUp={handleSelectionCommit}>
          <TimeColumn />
          <div className="relative flex flex-1 divide-x divide-neutral-200 bg-white">
            <BackgroundGridLine />
            <RedTimeLine />
            <DoctorsColumnLayout doctors={doctors} overSlotInfo={overSlotInfo} />
          </div>
        </div>
      </div>
    </div>
  );
}
