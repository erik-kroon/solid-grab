import { render } from "solid-js/web";

import { SolidGrabFixtures } from "./fixtures/solid-grab-fixtures";

import "./styles.css";

if (import.meta.env.DEV) {
  void import("solid-grab");
}

function App() {
  return <SolidGrabFixtures />;
}

const rootElement = document.getElementById("app");
if (rootElement) {
  render(() => <App />, rootElement);
}
