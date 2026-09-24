import { initialBoard } from "../kanban/_components/data";
import { Kanban } from "../kanban/_components/kanban";

export const metadata = {
  title: "Tender Pipeline | Tender Intelligence Portal",
  description: "Manage tender lifecycles, opportunity tracking, and stage transitions across PRAZ, ZPPA, and global tenders.",
};

export default function TenderPipelinePage() {
  return (
    <div data-content-padding="false">
      <Kanban initialBoard={initialBoard} />
    </div>
  );
}
