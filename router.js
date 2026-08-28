// Minimal hash router: no build step, no dependencies, works fine offline
// since it never touches the network.

const listeners = [];

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/classes";
  const [path, query] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  const params = new URLSearchParams(query || "");
  return { path: "/" + parts.join("/"), parts, params };
}

export function onRouteChange(fn) {
  listeners.push(fn);
}

function emit() {
  const route = parseHash();
  listeners.forEach((fn) => fn(route));
}

window.addEventListener("hashchange", emit);

export function navigate(path) {
  if (location.hash.replace(/^#/, "") === path) {
    emit(); // re-render even if navigating to the same path
  } else {
    location.hash = path;
  }
}

export function startRouter() {
  emit();
}

export function currentRoute() {
  return parseHash();
}
