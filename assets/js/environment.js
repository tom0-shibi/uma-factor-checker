// Only a loopback HTTP server enables development features. All other hosts
// (including GitHub Pages) default to pro; URL parameters cannot override this.
const IS_DEV = ["http:", "https:"].includes(globalThis.location?.protocol)
  && ["localhost", "127.0.0.1", "[::1]"].includes(globalThis.location?.hostname);
const APP_ENV = IS_DEV ? "dev" : "pro";

export { APP_ENV, IS_DEV };
