export const APPETITE_LEVELS = {
  light: { label: "Light", adultSlices: 2, childSlices: 1 },
  normal: { label: "Normal", adultSlices: 3, childSlices: 2 },
  hearty: { label: "Hearty", adultSlices: 4, childSlices: 2 },
};

export const CHAIN_PRESETS = {
  dominos: {
    label: "Domino's",
    sizes: {
      small:  { diameter: '10"', slices: 6 },
      medium: { diameter: '12"', slices: 8 },
      large:  { diameter: '14"', slices: 8 },
      xlarge: { diameter: '16"', slices: 12 },
    },
  },
  pizzahut: {
    label: "Pizza Hut",
    sizes: {
      small:  { diameter: '8"', slices: 8 },
      medium: { diameter: '12"', slices: 8 },
      large:  { diameter: '14"', slices: 8 },
      xlarge: { diameter: '16"', slices: 6 },
    },
  },
  papajohns: {
    label: "Papa John's",
    sizes: {
      small:  { diameter: '10"', slices: 6 },
      medium: { diameter: '12"', slices: 8 },
      large:  { diameter: '14"', slices: 8 },
      xlarge: { diameter: '16"', slices: 10 },
    },
  },
  littlecaesars: {
    label: "Little Caesars",
    sizes: {
      small:  { diameter: '8"', slices: 6 },
      medium: { diameter: '12"', slices: 8 },
      large:  { diameter: '14"', slices: 8 },
      xlarge: { diameter: '16"', slices: 10 },
    },
  },
  marcos: {
    label: "Marco's Pizza",
    sizes: {
      small:  { diameter: '10"', slices: 6 },
      medium: { diameter: '12"', slices: 8 },
      large:  { diameter: '14"', slices: 8 },
      xlarge: { diameter: '16"', slices: 12 },
    },
  },
  papamurphys: {
    label: "Papa Murphy's",
    sizes: {
      small:  { diameter: '10"', slices: 8 },
      medium: { diameter: '12"', slices: 8 },
      large:  { diameter: '14"', slices: 8 },
      xlarge: { diameter: '16"', slices: 12 },
    },
  },
  hungryhowies: {
    label: "Hungry Howie's",
    sizes: {
      small:  { diameter: '10"', slices: 6 },
      medium: { diameter: '12"', slices: 8 },
      large:  { diameter: '14"', slices: 8 },
      xlarge: { diameter: '16"', slices: 8 },
    },
  },
  roundtable: {
    label: "Round Table Pizza",
    sizes: {
      small:  { diameter: '9.5"', slices: 6 },
      medium: { diameter: '12"', slices: 8 },
      large:  { diameter: '14"', slices: 12 },
      xlarge: { diameter: '16"', slices: 16 },
    },
  },
  jets: {
    label: "Jet's Pizza",
    sizes: {
      small:  { diameter: '10"', slices: 6 },
      medium: { diameter: '12"', slices: 8 },
      large:  { diameter: '14"', slices: 10 },
      xlarge: { diameter: '16"', slices: 12 },
    },
  },
  caseys: {
    label: "Casey's",
    sizes: {
      small:  { diameter: '10"', slices: 4 },
      medium: { diameter: '12"', slices: 6 },
      large:  { diameter: '14"', slices: 8 },
      xlarge: { diameter: '16"', slices: 10 },
    },
  },
  custom: {
    label: "Custom",
    sizes: {
      small:  { diameter: '8-10"', slices: 6 },
      medium: { diameter: '12"', slices: 8 },
      large:  { diameter: '14"', slices: 8 },
      xlarge: { diameter: '16-18"', slices: 12 },
    },
  },
};

export const SIZE_KEYS = ["small", "medium", "large", "xlarge"];
export const SIZE_LABELS = { small: "Small", medium: "Medium", large: "Large", xlarge: "Extra-Large" };

export function calculatePizza({ adults, children, appetite, slicesPerPizza, servingOtherFood }) {
  const parsedAdults = Math.max(0, Math.floor(Number(adults) || 0));
  const parsedChildren = Math.max(0, Math.floor(Number(children) || 0));

  if (parsedAdults === 0 && parsedChildren === 0) {
    return { ok: false, error: "Add at least one guest." };
  }

  const parsedSlicesPerPizza = Math.max(1, Math.floor(Number(slicesPerPizza) || 0));
  if (!parsedSlicesPerPizza) {
    return { ok: false, error: "Enter slices per pizza." };
  }

  const appetiteInfo = APPETITE_LEVELS[appetite];
  if (!appetiteInfo) {
    return { ok: false, error: "Please choose a valid appetite level." };
  }

  let totalSlicesNeeded =
    parsedAdults * appetiteInfo.adultSlices +
    parsedChildren * appetiteInfo.childSlices;

  if (servingOtherFood) {
    totalSlicesNeeded = Math.ceil(totalSlicesNeeded * 0.75);
  }

  const pizzasNeeded = Math.max(1, Math.ceil(totalSlicesNeeded / parsedSlicesPerPizza));
  const totalSlicesOrdered = pizzasNeeded * parsedSlicesPerPizza;
  const leftoverSlices = totalSlicesOrdered - totalSlicesNeeded;

  return {
    ok: true,
    pizzasNeeded,
    totalSlicesNeeded,
    slicesPerPizza: parsedSlicesPerPizza,
    leftoverSlices,
    totalSlicesOrdered,
    adults: parsedAdults,
    children: parsedChildren,
    appetiteLabel: appetiteInfo.label,
    adultSlices: appetiteInfo.adultSlices,
    childSlices: appetiteInfo.childSlices,
    servingOtherFood,
  };
}
