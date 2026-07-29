import React, { useEffect, useMemo, useState } from "react";
import { geoCentroid, geoContains, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";
import { findIsoCountry } from "./lib/isoCountries.js";

const BASE_VISIBLE_COUNTRY_IDS = new Set([
  "008",
  "040",
  "056",
  "070",
  "100",
  "191",
  "203",
  "208",
  "250",
  "276",
  "300",
  "348",
  "372",
  "380",
  "442",
  "498",
  "499",
  "528",
  "616",
  "620",
  "642",
  "688",
  "703",
  "705",
  "724",
  "756",
  "792",
  "804",
  "807",
  "826",
]);

const countryCollection = feature(worldAtlas, worldAtlas.objects.countries);
const countryById = new Map(
  countryCollection.features.map((country) => [
    String(country.id).padStart(3, "0"),
    country,
  ]),
);
const countryByName = new Map(
  countryCollection.features.map((country) => [
    String(country.properties?.name || "").trim().toLowerCase(),
    country,
  ]),
);

const projection = geoMercator()
  .center([10, 44.5])
  .scale(1080)
  .translate([450, 255])
  .clipExtent([
    [18, 18],
    [882, 522],
  ]);
const createCountryPath = geoPath(projection);

function normalizeAtlasId(value) {
  const id = String(value ?? "").trim();
  return /^\d{1,3}$/.test(id) ? id.padStart(3, "0") : "";
}

function normalizeCityCoordinates(city, countryFeature) {
  const longitude = Number(city.longitude);
  const latitude = Number(city.latitude);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

  const coordinates = [longitude, latitude];
  const swappedCoordinates = [latitude, longitude];

  if (
    countryFeature
    && !geoContains(countryFeature, coordinates)
    && geoContains(countryFeature, swappedCoordinates)
  ) {
    return swappedCoordinates;
  }

  return coordinates;
}

function normalizeCountries(records) {
  if (!Array.isArray(records)) return [];

  return records
    .filter((country) => country?.enabled !== false)
    .map((country, countryIndex) => {
      const name = String(country.name || "").trim();
      const storedCode = String(country.code || "").trim().toUpperCase();
      const isoCountry = findIsoCountry(storedCode)
        || findIsoCountry(country.iso3)
        || findIsoCountry(name);
      const code = isoCountry?.alpha2 || storedCode;
      const requestedAtlasId = normalizeAtlasId(country.atlasId)
        || isoCountry?.numeric
        || "";
      const countryFeature = countryById.get(requestedAtlasId)
        || countryByName.get(name.toLowerCase())
        || null;
      const atlasId = countryFeature
        ? String(countryFeature.id).padStart(3, "0")
        : requestedAtlasId;
      const cities = (Array.isArray(country.cities) ? country.cities : [])
        .map((city, cityIndex) => {
          const coordinates = normalizeCityCoordinates(city, countryFeature);
          if (!coordinates) return null;

          return {
            id: String(city.id || `location-${cityIndex}`),
            name: String(city.name || "").trim(),
            coordinates,
          };
        })
        .filter(Boolean);

      return {
        id: String(country.id || `country-${countryIndex}`),
        code,
        name,
        atlasId,
        feature: countryFeature,
        cities,
      };
    })
    .filter((country) => country.code && country.name);
}

function createConnectionPath(originPoint, destinationPoint) {
  const [originX, originY] = originPoint;
  const [destinationX, destinationY] = destinationPoint;
  const distance = Math.abs(destinationX - originX);
  const controlX = (originX + destinationX) / 2;
  const controlY = Math.min(originY, destinationY) - Math.min(54, 16 + distance * 0.08);

  return `M ${originX} ${originY} Q ${controlX} ${controlY} ${destinationX} ${destinationY}`;
}

function CompanyFootprintMap({ countries = [] }) {
  const mapData = useMemo(() => {
    const networkCountries = normalizeCountries(countries);
    const networkCountryById = new Map(
      networkCountries
        .filter((country) => country.atlasId)
        .map((country) => [country.atlasId, country]),
    );
    const visibleCountryIds = new Set([
      ...BASE_VISIBLE_COUNTRY_IDS,
      ...networkCountryById.keys(),
    ]);
    const visibleCountries = countryCollection.features.filter((country) =>
      visibleCountryIds.has(String(country.id).padStart(3, "0")),
    );
    const cityPoints = networkCountries.flatMap((country) =>
      country.cities.map((city) => ({
        ...city,
        key: `${country.code}-${city.id}`,
        countryCode: country.code,
        countryName: country.name,
        point: projection(city.coordinates),
      })),
    ).filter((city) => Array.isArray(city.point));

    return {
      networkCountries,
      networkCountryById,
      visibleCountries,
      cityPoints,
      originCity: cityPoints[0] ?? null,
    };
  }, [countries]);
  const [selectedCountryCode, setSelectedCountryCode] = useState(
    mapData.networkCountries[0]?.code ?? "",
  );

  useEffect(() => {
    if (mapData.networkCountries.some(({ code }) => code === selectedCountryCode)) return;
    setSelectedCountryCode(mapData.networkCountries[0]?.code ?? "");
  }, [mapData.networkCountries, selectedCountryCode]);

  const selectedCountry = mapData.networkCountries.find(
    ({ code }) => code === selectedCountryCode,
  ) ?? mapData.networkCountries[0] ?? null;
  const countryNames = mapData.networkCountries.map(({ name }) => name).join(", ");
  const originPoint = mapData.originCity?.point ?? null;

  return (
    <div className="company-footprint-map">
      <svg
        viewBox="0 0 900 540"
        role="img"
        aria-labelledby="company-map-title company-map-description"
      >
        <title id="company-map-title">GreenTech Professionals European footprint</title>
        <desc id="company-map-description">
          {countryNames
            ? `Project locations in ${countryNames}.`
            : "European project locations map."}
        </desc>

        <g className="company-map-countries">
          {mapData.visibleCountries.map((country) => {
            const countryId = String(country.id).padStart(3, "0");
            const networkCountry = mapData.networkCountryById.get(countryId);
            const classNames = [
              "company-map-country",
              networkCountry ? "is-network" : "",
              networkCountry?.code === selectedCountryCode ? "is-selected" : "",
            ].filter(Boolean).join(" ");

            return (
              <path
                aria-label={networkCountry ? `Show ${networkCountry.name} project locations` : undefined}
                className={classNames}
                d={createCountryPath(country)}
                key={countryId}
                role={networkCountry ? "button" : undefined}
                tabIndex={networkCountry ? 0 : undefined}
                onClick={networkCountry
                  ? () => setSelectedCountryCode(networkCountry.code)
                  : undefined}
                onKeyDown={networkCountry
                  ? (event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setSelectedCountryCode(networkCountry.code);
                    }
                  : undefined}
              >
                <title>{networkCountry?.name ?? country.properties.name}</title>
              </path>
            );
          })}
        </g>

        {originPoint && (
          <g className="company-map-connections" aria-hidden="true">
            {mapData.cityPoints
              .filter(({ key }) => key !== mapData.originCity.key)
              .map((city, index) => (
                <path
                  className={city.countryCode === selectedCountryCode ? "is-selected" : ""}
                  d={createConnectionPath(originPoint, city.point)}
                  key={city.key}
                  pathLength="1"
                  style={{ "--map-line-index": index }}
                />
              ))}
          </g>
        )}

        <g className="company-map-labels" aria-hidden="true">
          {mapData.networkCountries.map((country) => {
            const labelCoordinates = country.feature
              ? geoCentroid(country.feature)
              : country.cities[0]?.coordinates;
            const labelPoint = labelCoordinates ? projection(labelCoordinates) : null;
            if (!labelPoint) return null;

            return (
              <text
                className={country.code === selectedCountryCode ? "is-selected" : ""}
                key={country.code}
                x={labelPoint[0]}
                y={labelPoint[1]}
              >
                {country.code}
              </text>
            );
          })}
        </g>

        <g className="company-map-markers">
          {mapData.cityPoints.map((city) => {
            const isOrigin = city.key === mapData.originCity?.key;
            const isSelected = city.countryCode === selectedCountryCode;

            return (
              <g
                className={[isOrigin ? "is-origin" : "", isSelected ? "is-selected" : ""]
                  .filter(Boolean)
                  .join(" ")}
                key={city.key}
                transform={`translate(${city.point[0]} ${city.point[1]})`}
              >
                {isOrigin ? <circle className="company-map-pulse" r="14" /> : null}
                <circle className="company-map-marker-ring" r={isOrigin ? 9 : 6} />
                <circle className="company-map-marker-core" r={isOrigin ? 3.6 : 2.4} />
                <title>{`${city.name}, ${city.countryName}`}</title>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="company-map-footer">
        {selectedCountry ? (
          <div className="company-map-selected" aria-live="polite">
            <span>{selectedCountry.code}</span>
            <strong>{selectedCountry.name}</strong>
            <p>{selectedCountry.cities.map(({ name }) => name).join(" / ")}</p>
          </div>
        ) : (
          <p className="company-map-empty">No project countries published.</p>
        )}

        {mapData.networkCountries.length > 0 && (
          <div className="company-map-tabs" role="group" aria-label="Project countries">
            {mapData.networkCountries.map((country) => (
              <button
                type="button"
                title={country.name}
                aria-label={`Show ${country.name}`}
                aria-pressed={country.code === selectedCountryCode}
                className={country.code === selectedCountryCode ? "is-active" : ""}
                key={country.code}
                onClick={() => setSelectedCountryCode(country.code)}
              >
                {country.code}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CompanyFootprintMap;
