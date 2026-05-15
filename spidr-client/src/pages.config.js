/**
 * pages.config.js - Page routing configuration
 *
 * App panels (Home, Friends, Servers, Feed, etc.) are now nested routes
 * registered directly in App.jsx under the AppShell layout.
 * Only standalone utility/dev pages are listed here.
 */
import SeedFriends from './pages/SeedFriends';

export const PAGES = {
    "SeedFriends": SeedFriends,
}

export const pagesConfig = {
    mainPage: "SeedFriends",
    Pages: PAGES,
};
