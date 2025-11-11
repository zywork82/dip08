// utils/sharedCache.js
import localforage from "localforage";
export const TMP_FLOW_KEY = "activeFlow";

export async function saveActiveFlow(flow) {
  await localforage.setItem(TMP_FLOW_KEY, flow);
}

export async function loadActiveFlow() {
  return (await localforage.getItem(TMP_FLOW_KEY)) || null;
}
