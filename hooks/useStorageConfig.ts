import { createSignal , } from "solid-js";
import { browser } from "wxt/browser";

import { createStore } from "solid-js/store";
import { BiliVideoConfig } from "@/types/types";


const INITIAL_CONFIG: BiliVideoConfig = {
    opRanges: [],
    frameConfig: { h: 0, m: 0, s: 0 },
    jumpConfig: { h: 0, m: 0, s: 0 },
    mode: "manual" as const,
    isAutoHandle: true,
    isPageReady: false,
};

export const STORAGE_KEYS = Object.keys(
    INITIAL_CONFIG,
) as (keyof BiliVideoConfig)[];

export const useStorageConfig = () => {

    const [config, setConfig] = createStore<BiliVideoConfig>(INITIAL_CONFIG);

     const initFromStorage = async () => {
         const res = await browser.storage.local.get(STORAGE_KEYS);
         setConfig(res); // 直接合并
     };

      const updateConfig = async (data: Partial<BiliVideoConfig>) => {
          setConfig(data);
          await browser.storage.local.set(data);
      };

     return {
         config,
         setConfig,
         initFromStorage,
         updateConfig,
     };
};
