import ConductorPageClient from "./ConductorPageClient";

export const metadata = {
  title: "Conductor — Pusula",
  description: "PusulaConductor CLI-agent fleet: runners, task queue and councils, live.",
};

export default function ConductorPage() {
  return <ConductorPageClient />;
}
