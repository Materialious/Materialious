import { page } from "$app/stores";
import { get } from "svelte/store";
import {
  darkMode,
  deArrowEnabled,
  deArrowInstance,
  deArrowThumbnailInstance,
  interfaceSearchSuggestions,
  playerAlwaysLoop,
  playerAutoPlay,
  playerAutoplayNextByDefault,
  playerDash,
  playerListenByDefault,
  playerProxyVideos,
  playerSavePlaybackPosition,
  playerTheatreModeByDefault,
  returnYTDislikesInstance,
  sponsorBlock,
  sponsorBlockCategories,
  sponsorBlockUrl,
  themeColor
} from "../store";

const persistedStores = [
  {
    name: 'returnYTDislikesInstance',
    store: returnYTDislikesInstance,
    type: 'string'
  },
  {
    name: 'darkMode',
    store: darkMode,
    type: 'boolean'
  },
  {
    name: 'themeColor',
    store: themeColor,
    type: 'string'
  },
  {
    name: 'autoPlay',
    store: playerAutoPlay,
    type: 'boolean'
  },
  {
    name: 'alwaysLoop',
    store: playerAlwaysLoop,
    type: 'boolean'
  },
  {
    name: 'proxyVideos',
    store: playerProxyVideos,
    type: 'boolean'
  },
  {
    name: 'listenByDefault',
    store: playerListenByDefault,
    type: 'boolean'
  },
  {
    name: 'savePlaybackPosition',
    store: playerSavePlaybackPosition,
    type: 'boolean'
  },
  {
    name: 'dashEnabled',
    store: playerDash,
    type: 'boolean'
  },
  {
    name: 'theatreModeByDefault',
    store: playerTheatreModeByDefault,
    type: 'boolean'
  },
  {
    name: 'autoplayNextByDefault',
    store: playerAutoplayNextByDefault,
    type: 'boolean'
  },
  {
    name: 'returnYtDislikes',
    store: returnYTDislikesInstance,
    type: 'boolean'
  },
  {
    name: 'searchSuggestions',
    store: interfaceSearchSuggestions,
    type: 'boolean'
  },
  {
    name: 'sponsorBlock',
    store: sponsorBlock,
    type: 'boolean'
  },
  {
    name: 'sponsorBlockUrl',
    store: sponsorBlockUrl,
    type: 'string'
  },
  {
    name: 'sponsorBlockCategories',
    store: sponsorBlockCategories,
    type: 'array'
  },
  {
    name: 'deArrowInstance',
    store: deArrowInstance,
    type: 'string'
  },
  {
    name: 'deArrowEnabled',
    store: deArrowEnabled,
    type: 'boolean'
  },
  {
    name: 'deArrowThumbnailInstance',
    store: deArrowThumbnailInstance,
    type: 'string'
  }
];

export function bookmarkletSaveToUrl(): string {
  const url = new URL(import.meta.env.VITE_DEFAULT_FRONTEND_URL);

  persistedStores.forEach(store => {
    let value = get(store.store);
    if (value !== null) {
      url.searchParams.set(store.name, value.toString());
    }
  });

  return url.toString();
}

export function bookmarkletLoadFromUrl() {
  const currentPage = get(page);

  persistedStores.forEach(store => {
    let paramValue = currentPage.url.searchParams.get(store.name);
    if (paramValue) {
      let value: any;

      if (store.type === 'array') {
        value = paramValue.split(',');
      } else if (store.type === 'boolean') {
        value = paramValue === 'true';
      } else {
        value = paramValue;
      }

      store.store.set(value);
    }
  });
}