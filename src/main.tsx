import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/anton/latin-400.css";
import "./style.scss";
import {
  stations,
  anchors,
  stationIndex,
  stationStarts,
  CTA,
  INTRO_END,
  ENDING_START,
} from "./journey";

gsap.registerPlugin(ScrollTrigger);

const reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");

const legacyStationIds: Record<string, string> = { bergarbeiter: "bergbaumaschine" };

function Icon({
  type = "arrow",
  ...props
}: { type?: "arrow" | "tower" | "down" } & React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      {type === "tower" ? (
        <>
          <path d="M4 22 9 3h6l5 19M7 14h10M9 3V1h6v2M8 7h8M9 19l6-9M15 19l-6-9M3 22h18" />
          <circle cx="12" cy="6" r="2.5" />
        </>
      ) : type === "down" ? (
        <path d="M12 3v17m-5-5 5 5 5-5" />
      ) : (
        <path d="M5 19 19 5M5 5h14v14" />
      )}
    </svg>
  );
}

function App() {
  const journeyRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(() => reducedMotionQuery.matches);

  useEffect(() => {
    const update = () => setReduced(reducedMotionQuery.matches);
    reducedMotionQuery.addEventListener("change", update);
    return () => reducedMotionQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const trigger = ScrollTrigger.create({
      trigger: journeyRef.current,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        setProgress(self.progress);
      },
    });
    const hash = location.hash.slice(1);
    const linkedStation = stations.findIndex(
      (station) => station.id === (legacyStationIds[hash] ?? hash),
    );
    if (linkedStation >= 0) {
      requestAnimationFrame(() => jumpToStation(linkedStation, false));
    }
    return () => trigger.kill();
  }, []);

  const activeStation = stationIndex(progress);
  const intro = progress < INTRO_END;
  const ending = progress > ENDING_START;
  const isStationVisible = (index: number) => !intro && !ending && activeStation === index;

  function jumpToStation(index: number, smooth = true) {
    const scrollable = journeyRef.current!.offsetHeight - innerHeight;
    window.scrollTo({
      top: anchors[index] * scrollable,
      behavior: smooth && !reduced ? "smooth" : "instant",
    });
    history.replaceState(null, "", `#${stations[index].id}`);
  }

  // How far the footer line under a station is filled
  function stationFill(index: number) {
    if (index < activeStation) return 1;
    if (index > activeStation) return 0;
    return Math.max(0.08, Math.min(1, (progress - stationStarts[index]) / 0.25));
  }

  function scrollToTop(event: React.MouseEvent) {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
    history.replaceState(null, "", location.pathname);
  }

  return (
    <>
      <a className="skip" href="#story">
        Zur Geschichte
      </a>
      <div className="world" aria-hidden="true" />
      <div className="shade" />
      <header>
        <a className="brand" href="#" onClick={scrollToTop} aria-label="RUHR – zurück zum Anfang">
          <Icon type="tower" />
          <span>
            RUHR<small>INDUSTRIEKULTUR</small>
          </span>
        </a>
        <div className="header-right">
          <button className="journey-link" onClick={() => jumpToStation(0)}>
            Die Reise
          </button>
          <a href={CTA.url} target="_blank" rel="noopener noreferrer">
            {CTA.label}
            <Icon />
          </a>
        </div>
      </header>
      <main
        ref={journeyRef}
        className="journey"
        id="story"
        tabIndex={-1}
        aria-label="Reise durch die Industriekultur"
      >
        <div className="sticky-copy">
          <div className={`intro copy ${intro ? "visible" : ""}`} aria-hidden={!intro}>
            <h1>
              Was bleibt,
              <br />
              bewegt.
            </h1>
            <p className="intro-description">
              Zwischen Kohle und Kultur.
              <br />
              Eine Reise durch das industrielle Gedächtnis des Ruhrgebiets.
            </p>
            <button
              tabIndex={intro ? 0 : -1}
              className="scroll-cue"
              onClick={() => jumpToStation(0)}
            >
              <span className="scroll-line">
                <Icon type="down" />
              </span>
              <span>Scrollen, um zu entdecken</span>
            </button>
          </div>
          {stations.map((station, index) => (
            <section
              id={`text-${station.id}`}
              key={station.id}
              className={`station copy ${isStationVisible(index) ? "visible" : ""}`}
              aria-hidden={!isStationVisible(index)}
            >
              <h2>{station.title}</h2>
              <p>{station.body}</p>
              <a
                className="source"
                href={station.source}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={isStationVisible(index) ? 0 : -1}
              >
                {station.detail}
                <Icon />
              </a>
            </section>
          ))}
          <section className={`ending copy ${ending ? "visible" : ""}`} aria-hidden={!ending}>
            <h2>
              Geschichte bleibt.
              <br />
              Kultur bewegt.
            </h2>
            <p>
              Der nächste Schritt führt nach draußen.
              <br />
              Entdecke das Ruhrgebiet vor Ort.
            </p>
            <a
              className="cta"
              href={CTA.url}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={ending ? 0 : -1}
            >
              {CTA.label}
              <Icon />
            </a>
            <small>Digitale Interpretation · Inspiriert von den Zechen des Reviers</small>
          </section>
        </div>
      </main>
      <aside className="edge-progress" aria-label="Reisefortschritt">
        <span style={{ transform: `scaleY(${progress})` }} />
      </aside>
      <footer>
        <a className="author" href="https://patrickbecker.work" target="_blank" rel="noopener">
          Patrick Becker
        </a>
        <nav aria-label="Stationen">
          {stations.map((station, index) => (
            <button
              key={station.id}
              onClick={() => jumpToStation(index)}
              aria-current={activeStation === index ? "step" : undefined}
            >
              <span className="nav-line">
                <i style={{ transform: `scaleX(${stationFill(index)})` }} />
              </span>
              <span className="nav-label">
                <b>{String(index + 1).padStart(2, "0")}</b>
                {station.name}
              </span>
            </button>
          ))}
        </nav>
        <span className="footer-note">
          {reduced ? "Reduzierte Bewegung" : "Eine digitale Spurensuche"}
        </span>
      </footer>
      <noscript>Für die interaktive 3D-Reise wird JavaScript benötigt.</noscript>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
