export const PHILIPPINE_ID_TYPES = [
  {
    value: "philsys",
    label: "PhilSys ID / ePhilID",
    placeholder: "1234-5678-9012-3456",
    hint: "Use the 16-digit PhilSys Card Number, not the confidential PSN.",
  },
  {
    value: "passport",
    label: "Philippine Passport",
    placeholder: "P1234567A",
    hint: "Current passports commonly use one letter, seven digits, then one letter.",
  },
  {
    value: "driver_license",
    label: "LTO Driver's License",
    placeholder: "N01-23-456789",
    hint: "Use the license number printed on the card.",
  },
  {
    value: "umid_sss",
    label: "UMID / SSS ID",
    placeholder: "1234-1234567-1",
    hint: "CRN format is accepted. SSS 10-digit format is also accepted.",
  },
  {
    value: "tin",
    label: "BIR TIN ID",
    placeholder: "123-456-789-000",
    hint: "Use the 12-digit TIN including branch code.",
  },
  {
    value: "philhealth",
    label: "PhilHealth ID",
    placeholder: "12-123456789-1",
    hint: "Use the 12-digit PhilHealth Identification Number.",
  },
  {
    value: "prc",
    label: "PRC License ID",
    placeholder: "1234567",
    hint: "Use the registration or license number on the PRC card.",
  },
  {
    value: "postal",
    label: "Postal ID",
    placeholder: "PRN1234567",
    hint: "Use the Postal Reference Number printed on the card.",
  },
  {
    value: "voter",
    label: "Voter's ID",
    placeholder: "1234-5678-A",
    hint: "Use the voter ID number as printed on the card.",
  },
];

export const getIdTypeMeta = (value) =>
  PHILIPPINE_ID_TYPES.find((type) => type.value === value) ||
  PHILIPPINE_ID_TYPES[0];

const compact = (value = "") => String(value).trim().toUpperCase();
const digitsOnly = (value = "") => compact(value).replace(/\D/g, "");
const alnumDash = (value = "") => compact(value).replace(/\s/g, "");

export const normalizePhilippineIdNumber = (idType, idNumber) => {
  const raw = compact(idNumber);
  switch (idType) {
    case "philsys":
    case "tin":
    case "philhealth":
      return digitsOnly(raw);
    case "driver_license":
    case "umid_sss":
      return raw.replace(/[^A-Z0-9]/g, "");
    case "passport":
      return raw.replace(/[^A-Z0-9]/g, "");
    default:
      return alnumDash(raw);
  }
};

export const validatePhilippineIdNumber = (idType, idNumber) => {
  const normalized = normalizePhilippineIdNumber(idType, idNumber);

  switch (idType) {
    case "philsys":
      return /^\d{16}$/.test(normalized);
    case "passport":
      return /^[A-Z]\d{7}[A-Z]$/.test(normalized) ||
        /^[A-Z]{2}\d{7}$/.test(normalized);
    case "driver_license":
      return /^[A-Z]\d{10}$/.test(normalized);
    case "umid_sss":
      return /^\d{12}$/.test(normalized) || /^\d{10}$/.test(normalized);
    case "tin":
      return /^\d{12}$/.test(normalized);
    case "philhealth":
      return /^\d{12}$/.test(normalized);
    case "prc":
      return /^\d{6,8}$/.test(normalized);
    case "postal":
      return /^[A-Z0-9-]{6,20}$/.test(normalized);
    case "voter":
      return /^[A-Z0-9-]{8,24}$/.test(normalized);
    default:
      return false;
  }
};
