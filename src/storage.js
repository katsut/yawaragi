// content-script world stub. shares globalThis.Yawaragi with popover/content.
globalThis.Yawaragi = globalThis.Yawaragi || {};

globalThis.Yawaragi.storage = {
  async getCapacity() {
    const stored = await chrome.storage.local.get("capacity");
    return stored.capacity ?? "普通";
  },
};
