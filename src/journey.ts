export const CTA = {
  label: "Orte entdecken",
  url: "https://www.zollverein.de/besuch-planen/was-ist-zollverein/",
};
export const stations = [
  {
    id: "zechenanlage",
    name: "Zechenanlage",
    title: "Das Herz aus Backstein.",
    body: "Hier wurde Kohle nicht nur gefördert, sondern sortiert und aufbereitet. In der Kohlenwäsche trennten Wasser und Setzmaschinen das schwarze Gold vom Gestein.",
    detail: "Zollverein · Essen",
    source:
      "https://www.zollverein.de/erleben/faszination-unesco-welterbe-zollverein/stachelhaus-kohlenwaesche/",
  },
  {
    id: "foerderturm",
    name: "Förderturm",
    title: "Hoch hinaus. Tief hinab.",
    body: "Über die Seilscheiben liefen die Förderseile zwischen Maschine und Schacht. Der Doppelbock machte diese Verbindung zwischen der Welt über und unter Tage sichtbar.",
    detail: "Fördertechnik · Das Gerüst über dem Schacht",
    source: "https://www.zollverein.de/ueber-zollverein/geschichte/",
  },
  {
    id: "lore",
    name: "Lore",
    title: "Schwere Wege.",
    body: "Grubenwagen brachten Kohle und Gestein auf schmalen Gleisen zum Schacht. Jeder Wagen erzählt von Enge, Staub und der gemeinsamen Arbeit unter Tage.",
    detail: "Transport · Auf schmaler Spur",
    source: "https://www.bergbaumuseum.de/",
  },
  {
    id: "bergbaumaschine",
    name: "Bergbaumaschine",
    title: "Kraft, die bleibt.",
    body: "Mit einer meißelbestückten Schneidwalze lösten solche Maschinen das Material aus dem Gestein. Heute erinnern die stillen Stahlkörper an die Arbeit unter Tage – und an den Wandel von Kohle zu Kultur.",
    detail: "Gewinnungstechnik · Schneiden und Laden",
    source: "https://www.bergbaumuseum.de/",
  },
];

// Scroll progress: 0 = top, 1 = bottom of the journey

export const INTRO_END = 0.035;
export const ENDING_START = 0.965;

// Where each station's text takes over from the previous one
export const stationStarts = [0, 0.23, 0.51, 0.8];

// Targets for the station buttons
export const anchors = [0.075, 0.35, 0.64, 0.89];

// The camera rests at each stop, then eases to the next one
const cameraStops = [0, 0.28, 0.57, 0.86, 1];
const DWELL = 0.32; // share of each segment the camera holds still

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function journeyTime(progress: number) {
  const p = clamp01(progress);
  const segments = cameraStops.length - 1;
  for (let i = 0; i < segments; i++) {
    const start = cameraStops[i];
    const end = cameraStops[i + 1];
    if (p <= end) {
      const t = clamp01(((p - start) / (end - start) - DWELL) / (1 - DWELL));
      const eased = t * t * (3 - 2 * t);
      return (i + eased) / segments;
    }
  }
  return 1;
}

export function stationIndex(progress: number) {
  let index = 0;
  while (index < stationStarts.length - 1 && progress >= stationStarts[index + 1]) {
    index++;
  }
  return index;
}
