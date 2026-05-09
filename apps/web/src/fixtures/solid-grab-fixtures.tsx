import { Dynamic, Portal } from "solid-js/web";
import { For, Index, Match, Show, Suspense, Switch, createSignal, lazy } from "solid-js";

const LazyPanel = lazy(async () => ({
  default: () => (
    <article class="fixture-card" data-testid="lazy-panel">
      <h3>Lazy shipment panel</h3>
      <p>Loaded through Solid lazy.</p>
    </article>
  ),
}));

function NestedSourceCard() {
  return (
    <section class="fixture-card" data-testid="nested-card">
      <h2>Nested account card</h2>
      <button class="fixture-button" data-testid="nested-card-button">
        <span data-testid="nested-card-child">Copy nested child source</span>
      </button>
    </section>
  );
}

function ListFixture() {
  const items = ["North", "Central", "South"];
  const numbers = [11, 22, 33];

  return (
    <section class="fixture-card" data-testid="list-fixture">
      <h2>List coverage</h2>
      <div class="fixture-grid">
        <For each={items}>
          {(item) => (
            <button class="fixture-button" data-testid={`for-item-${item.toLowerCase()}`}>
              For region {item}
            </button>
          )}
        </For>
        <Index each={numbers}>
          {(number, index) => (
            <span class="fixture-pill" data-testid={`index-item-${index}`}>
              Index value {number()}
            </span>
          )}
        </Index>
      </div>
    </section>
  );
}

function ConditionalFixture() {
  const [mode] = createSignal<"show" | "switch">("switch");

  return (
    <section class="fixture-card" data-testid="conditional-fixture">
      <Show when={mode() === "show"} fallback={<p data-testid="show-fallback">Show fallback</p>}>
        <p data-testid="show-branch">Show branch</p>
      </Show>
      <Switch>
        <Match when={mode() === "switch"}>
          <button class="fixture-button" data-testid="switch-branch">
            Switch branch
          </button>
        </Match>
      </Switch>
    </section>
  );
}

function DynamicFixture() {
  const tag = "aside";

  return (
    <Dynamic component={tag} class="fixture-card" data-testid="dynamic-fixture">
      <h2>Dynamic fixture</h2>
      <p data-testid="dynamic-child">Dynamic child node</p>
    </Dynamic>
  );
}

function PortalFixture() {
  return (
    <Portal>
      <div class="fixture-card portal-fixture" data-testid="portal-fixture">
        Portal metadata target
      </div>
    </Portal>
  );
}

function PlainDomFallback() {
  return (
    <section class="fixture-card" data-testid="plain-dom-wrapper">
      <div id="plain-dom-fallback">Plain DOM fallback target</div>
    </section>
  );
}

export function SolidGrabFixtures() {
  return (
    <>
      <main class="fixture-shell">
        <div>
          <p class="fixture-eyebrow">Solid Grab fixture</p>
          <h1>Solid DOM to source metadata</h1>
        </div>
        <NestedSourceCard />
        <ListFixture />
        <ConditionalFixture />
        <DynamicFixture />
        <Suspense fallback={<p data-testid="lazy-fallback">Loading lazy fixture</p>}>
          <LazyPanel />
        </Suspense>
        <PlainDomFallback />
      </main>
      <PortalFixture />
    </>
  );
}
