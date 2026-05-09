import { createFileRoute } from "@tanstack/solid-router";

import { SolidGrabFixtures } from "@/fixtures/solid-grab-fixtures";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  return <SolidGrabFixtures />;
}
