import { Metadata } from "next";
import { KanbanBoard } from "./_components/kanban-board";

export const metadata: Metadata = {
  title: "Pipeline",
};

export default function PipelinePage() {
  return <KanbanBoard />;
}
