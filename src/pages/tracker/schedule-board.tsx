// pages/tracker/schedule-board.tsx
import dynamic from 'next/dynamic';
const ScheduleBoard = dynamic(() => import('../../tracker/schedule-board/ScheduleBoard'), { ssr: false });
export default function Page() { return <ScheduleBoard />; }
