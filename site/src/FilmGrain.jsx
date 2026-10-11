import './film.css';

/**
 * Analog film / retro tape overlay.
 * 5 fixed, pointer-events-none layers composited over the page:
 * grain → vignette → flicker → dust/scratches → light leaks.
 * Pure CSS animations (no JS loop, no dependencies); layers use
 * transform/opacity only so the compositor never touches layout.
 */
export default function FilmGrain() {
  return (
    <>
      <div className="film-grain" aria-hidden="true" />
      <div className="film-vignette" aria-hidden="true" />
      <div className="film-flicker" aria-hidden="true" />
      <div className="film-dust" aria-hidden="true" />
      <div className="film-leak" aria-hidden="true" />
      <div className="film-track" aria-hidden="true" />
      <div className="film-fringe" aria-hidden="true" />
      <div className="film-grade" aria-hidden="true" />
      <div className="film-shake" aria-hidden="true" />
    </>
  );
}
