import isoCodes from "i18n-iso-countries/codes.json";
import englishLocale from "i18n-iso-countries/langs/en.json";

const normalizeLookup = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const ISO_COUNTRIES = isoCodes
  .map(([alpha2, alpha3, numeric]) => {
    const localizedNames = englishLocale.countries[alpha2];
    const aliases = Array.isArray(localizedNames) ? localizedNames : [localizedNames];

    return {
      name: aliases[0] || alpha2,
      aliases: aliases.filter(Boolean),
      alpha2,
      alpha3,
      numeric,
    };
  })
  .sort((left, right) => left.name.localeCompare(right.name, "en"));

const countryByLookup = new Map();
const countryByName = new Map();

for (const country of ISO_COUNTRIES) {
  for (const value of country.aliases) {
    const key = normalizeLookup(value);
    if (key && !countryByName.has(key)) countryByName.set(key, country);
  }

  const values = [country.alpha2, country.alpha3, country.numeric, String(Number(country.numeric))];

  for (const value of values) {
    const key = normalizeLookup(value);
    if (key && !countryByLookup.has(key)) countryByLookup.set(key, country);
  }
}

export function findIsoCountry(value) {
  const key = normalizeLookup(value);
  return countryByLookup.get(key) || countryByName.get(key) || null;
}

export function findIsoCountryByName(value) {
  return countryByName.get(normalizeLookup(value)) || null;
}
