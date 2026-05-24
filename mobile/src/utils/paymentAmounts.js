export const PAYMENT_BILL_TYPE_ORDER = [
  "rent",
  "electricity",
  "internet",
  "water",
  "custom_charges",
];

const BILL_TYPE_ALIASES = {
  rent: "rent",
  electricity: "electricity",
  electric: "electricity",
  water: "water",
  internet: "internet",
  custom_charges: "custom_charges",
  customcharges: "custom_charges",
  customCharges: "custom_charges",
  total: "total",
};

const AMOUNT_KEYS = {
  rent: ["rent", "rentShare", "rent_share"],
  electricity: ["electricity", "electricityShare", "electricity_share"],
  internet: ["internet", "internetShare", "internet_share"],
  water: ["water", "waterBillShare", "water_bill_share", "waterOwn", "water_own"],
  custom_charges: [
    "custom_charges",
    "customCharges",
    "customChargesShare",
    "custom_charges_share",
  ],
  total: ["total", "totalDue", "total_due"],
};

export const normalizePaymentBillType = (type) => {
  if (typeof type !== "string") return null;
  const trimmed = type.trim();
  return BILL_TYPE_ALIASES[trimmed] || BILL_TYPE_ALIASES[trimmed.toLowerCase()] || null;
};

export const buildBillSharesFromCharge = (charge) => {
  if (!charge) return null;

  return {
    rent: Number(charge.rentShare ?? charge.rent_share ?? 0),
    electricity: Number(charge.electricityShare ?? charge.electricity_share ?? 0),
    internet: Number(charge.internetShare ?? charge.internet_share ?? 0),
    water: Number(
      charge.isPayer !== false && charge.is_payer !== false
        ? charge.waterBillShare ?? charge.water_bill_share ?? 0
        : charge.waterOwn ?? charge.water_own ?? 0,
    ),
    customCharges: Number(
      charge.customChargesShare ?? charge.custom_charges_share ?? 0,
    ),
    total: Number(charge.totalDue ?? charge.total_due ?? 0),
  };
};

export const findUserCharge = (memberCharges, userId) => {
  if (!Array.isArray(memberCharges) || !userId) return null;

  return (
    memberCharges.find(
      (charge) =>
        String(charge.userId ?? charge.user_id) === String(userId),
    ) || null
  );
};

export const getExactBillAmount = (type, sources = {}) => {
  const normalizedType = normalizePaymentBillType(type);
  if (!normalizedType) return null;

  const keys = AMOUNT_KEYS[normalizedType] || [normalizedType];
  const sourceList = [sources.billAmounts, sources.billShares].filter(Boolean);

  for (const source of sourceList) {
    for (const key of keys) {
      const value = Number(source?.[key]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }

  if (normalizedType === "total") {
    const totalAmount = Number(sources.totalAmount);
    return Number.isFinite(totalAmount) && totalAmount > 0 ? totalAmount : null;
  }

  return null;
};

const uniqueInPaymentOrder = (types) => {
  const set = new Set(types.filter(Boolean));
  const ordered = PAYMENT_BILL_TYPE_ORDER.filter((type) => set.has(type));

  if (set.has("total") && ordered.length === 0) {
    ordered.push("total");
  }

  return ordered;
};

export const getSelectedPaymentBillTypes = ({
  breakdown,
  billTypes,
  billType,
  billAmounts,
  billShares,
  totalAmount,
} = {}) => {
  const selected = [];

  if (breakdown) {
    Object.entries(breakdown).forEach(([key, isSelected]) => {
      const normalized = normalizePaymentBillType(key);
      if (isSelected && normalized) selected.push(normalized);
    });
  }

  if (Array.isArray(billTypes)) {
    billTypes.forEach((type) => {
      const normalized = normalizePaymentBillType(type);
      if (normalized) selected.push(normalized);
    });
  }

  const normalizedBillType = normalizePaymentBillType(billType);
  if (normalizedBillType) selected.push(normalizedBillType);

  let ordered = uniqueInPaymentOrder(selected);

  if (ordered.length === 1 && ordered[0] === "total") {
    const exactTypes = PAYMENT_BILL_TYPE_ORDER.filter(
      (type) =>
        getExactBillAmount(type, { billAmounts, billShares, totalAmount }) !==
        null,
    );

    if (exactTypes.length > 0) ordered = exactTypes;
  }

  return ordered;
};
