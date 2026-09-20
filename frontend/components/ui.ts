// One place for the look of the interface, so every screen uses the same card, the same three
// button styles and the same focus ring. Import these instead of writing class lists by hand.

/** The same visible focus ring on everything that can be reached by keyboard. */
export const focusRing = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** The one card: white, thin line, same corner and same padding on every screen. */
export const card = 'rounded-lg border border-line bg-white p-6';

/** A card that is being pointed at, for example a draft that has just been made. */
export const cardHighlighted = 'rounded-lg border-2 border-accent bg-white p-6';

// Every button is the same height: same border width, same padding, same text size.
const button = `inline-flex items-center justify-center rounded-lg border-2 px-6 py-3 text-lg font-semibold ${focusRing} disabled:opacity-50`;

/** The one main action of a screen or a card. */
export const btnPrimary = `${button} border-accent bg-accent text-white hover:border-accent-dark hover:bg-accent-dark`;

/** Everything else that is safe: cancel, go back, ask Scout to look again. */
export const btnQuiet = `${button} border-line bg-white text-ink hover:bg-track`;

/** Actions that throw work away, for example clearing the demo. */
export const btnDanger = `${button} border-danger bg-white text-danger hover:bg-note`;

// The same three styles again, one size down, for the small controls inside a row of a card.
const buttonSmall = `inline-flex items-center justify-center rounded-lg border-2 px-4 py-2 text-lg font-medium ${focusRing} disabled:opacity-50`;

/** The small main action inside a row. */
export const btnPrimarySmall = `${buttonSmall} border-accent bg-accent text-white hover:border-accent-dark hover:bg-accent-dark`;

/** The small safe action inside a row, for example correcting a number up or down. */
export const btnQuietSmall = `${buttonSmall} border-line bg-white text-ink hover:bg-track`;

/** A small action that reads as a link, for short second choices inside a card. */
export const btnLink = `rounded text-base font-medium text-accent underline hover:text-accent-dark ${focusRing}`;

/** A row of buttons: same gap everywhere, and they line up by their tops when the row wraps. */
export const buttonRow = 'flex flex-wrap items-center gap-4';

/** What Scout is doing right now, in plain words. */
export const waiting = 'text-lg font-medium text-accent';

/** A note that needs attention but is not an error, for example a day that does not add up. */
export const warning = 'text-lg text-warn';

/** An error panel. Every one of these carries a Try again button. */
export const errorPanel = 'flex flex-wrap items-center gap-4 rounded-lg bg-note px-6 py-4 text-lg';
