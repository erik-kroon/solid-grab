export function UnexpectedWidget() {
  return (
    <section class="fixture-card" data-testid="unexpected-widget">
      <h2>Unexpected location</h2>
      <button class="fixture-button" data-testid="unexpected-widget-button">
        Source outside fixture directory
      </button>
    </section>
  );
}
