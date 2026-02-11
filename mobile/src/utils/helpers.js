export const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString();
};

export const formatCurrency = (amount) => {
  const num = Number(amount || 0);
  return (
    "\u20B1" +
    num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
};

/** Short format: ₱1.2M / ₱12k / ₱123 (no decimals for large values) */
export const formatCurrencyShort = (amount) => {
  const num = Number(amount || 0);
  if (num >= 1000000) return `\u20B1${(num / 1000000).toFixed(1)}M`;
  if (num >= 10000) return `\u20B1${(num / 1000).toFixed(0)}k`;
  return (
    "\u20B1" +
    num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
};

/** Round a number to 2 decimal places (for bill share calculations) */
export const roundTo2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export const calculateDays = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
};

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
