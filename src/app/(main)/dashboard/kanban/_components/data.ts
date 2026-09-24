import type { BoardState, Column, TaskOwnerProfile, TaskTeam } from "./types";

export const columns = [
  { id: "new", title: "New" },
  { id: "opportunity", title: "Opportunity" },
  { id: "in-progress", title: "In Progress" },
  { id: "submitted", title: "Submitted" },
  { id: "won", title: "Won" },
  { id: "contract-signing", title: "Contract Signing" },
  { id: "in-delivery", title: "In Delivery" },
  { id: "delivered", title: "Delivered" },
  { id: "lost", title: "Lost" },
  { id: "cancelled", title: "Cancelled" },
] as const satisfies readonly Column[];

export const columnIds = columns.map((column) => column.id);

export const tagTones: Record<TaskTeam, string> = {
  "Electrical Grid": "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "Civil & Roads": "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "ICT & Telecoms": "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  "Solar & Energy": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "Water & Sanitation": "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  Healthcare: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  "Compliance & Legal": "bg-purple-500/10 text-purple-700 dark:text-purple-300",
};

export const taskOwners = {
  farai: {
    name: "Farai Mataranyika",
    tone: "[&_[data-slot=avatar-fallback]]:bg-zinc-100 [&_[data-slot=avatar-fallback]]:text-zinc-700 after:border-zinc-200 dark:[&_[data-slot=avatar-fallback]]:bg-zinc-500/15 dark:[&_[data-slot=avatar-fallback]]:text-zinc-300 dark:after:border-zinc-500/20",
  },
  mulenga: {
    name: "Mulenga Chibwe",
    tone: "[&_[data-slot=avatar-fallback]]:bg-lime-100 [&_[data-slot=avatar-fallback]]:text-lime-700 after:border-lime-200 dark:[&_[data-slot=avatar-fallback]]:bg-lime-500/15 dark:[&_[data-slot=avatar-fallback]]:text-lime-300 dark:after:border-lime-500/20",
  },
  tendai: {
    name: "Tendai Moyo",
    tone: "[&_[data-slot=avatar-fallback]]:bg-indigo-100 [&_[data-slot=avatar-fallback]]:text-indigo-700 after:border-indigo-200 dark:[&_[data-slot=avatar-fallback]]:bg-indigo-500/15 dark:[&_[data-slot=avatar-fallback]]:text-indigo-300 dark:after:border-indigo-500/20",
  },
  tariro: {
    name: "Tariro Ncube",
    tone: "[&_[data-slot=avatar-fallback]]:bg-violet-100 [&_[data-slot=avatar-fallback]]:text-violet-700 after:border-violet-200 dark:[&_[data-slot=avatar-fallback]]:bg-violet-500/15 dark:[&_[data-slot=avatar-fallback]]:text-violet-300 dark:after:border-violet-500/20",
  },
  chileshe: {
    name: "Chileshe Mwamba",
    tone: "[&_[data-slot=avatar-fallback]]:bg-fuchsia-100 [&_[data-slot=avatar-fallback]]:text-fuchsia-700 after:border-fuchsia-200 dark:[&_[data-slot=avatar-fallback]]:bg-fuchsia-500/15 dark:[&_[data-slot=avatar-fallback]]:text-fuchsia-300 dark:after:border-fuchsia-500/20",
  },
} satisfies Record<string, TaskOwnerProfile>;

export const initialBoard: BoardState = {
  new: [],
  opportunity: [],
  "in-progress": [],
  submitted: [],
  won: [],
  "contract-signing": [],
  "in-delivery": [],
  delivered: [],
  lost: [],
  cancelled: [],
};
