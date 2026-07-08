// content-script world stub. real UI lands in S4.
globalThis.Yawaragi = globalThis.Yawaragi || {};

globalThis.Yawaragi.popover = {
  open(anchor) {
    console.warn("popover: S4で実装");
  },
  render(data) {
    console.log("render", data);
  },
  renderError(error) {
    console.log("error", error);
  },
  close() {},
};
