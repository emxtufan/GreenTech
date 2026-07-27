import React, { useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";

const networkCountries = [
  {
    id: "642",
    code: "RO",
    name: "Romania",
    labelPoint: [24.9, 46.05],
    cities: [
      { name: "Butimanu", coordinates: [25.897, 44.683] },
      { name: "Giurgiu", coordinates: [25.9699, 43.9037] },
      { name: "Craiova", coordinates: [23.7949, 44.3302] },
    ],
  },
  {
    id: "380",
    code: "IT",
    name: "Italy",
    labelPoint: [12.45, 42.95],
    cities: [
      { name: "Piombino", coordinates: [10.5259, 42.9256] },
      { name: "Bologna", coordinates: [11.3426, 44.4949] },
      { name: "Cagliari", coordinates: [9.1217, 39.2238] },
    ],
  },
  {
    id: "724",
    code: "ES",
    name: "Spain",
    labelPoint: [-3.55, 40.25],
    cities: [
      { name: "Palencia", coordinates: [-4.5288, 42.0096] },
      { name: "Guillena", coordinates: [-6.056, 37.542] },
      { name: "Sevilla", coordinates: [-5.9845, 37.3891] },
    ],
  },
];

const visibleCountryIds = new Set([
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

const networkCountryIds = new Set(networkCountries.map(({ id }) => id));
const countryCollection = feature(worldAtlas, worldAtlas.objects.countries);
const visibleCountries = countryCollection.features.filter((country) =>
  visibleCountryIds.has(String(country.id).padStart(3, "0")),
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
const originCity = networkCountries[0].cities[0];
const originPoint = projection(originCity.coordinates);

const cityPoints = networkCountries.flatMap((country) =>
  country.cities.map((city) => ({
    ...city,
    countryCode: country.code,
    countryName: country.name,
    point: projection(city.coordinates),
  })),
);

function createConnectionPath(destinationPoint) {
  const [originX, originY] = originPoint;
  const [destinationX, destinationY] = destinationPoint;
  const distance = Math.abs(destinationX - originX);
  const controlX = (originX + destinationX) / 2;
  const controlY = Math.min(originY, destinationY) - Math.min(54, 16 + distance * 0.08);

  return `M ${originX} ${originY} Q ${controlX} ${controlY} ${destinationX} ${destinationY}`;
}

function CompanyFootprintMap() {
  const [selectedCountryCode, setSelectedCountryCode] = useState("RO");
  const selectedCountry =
    networkCountries.find(({ code }) => code === selectedCountryCode) ??
    networkCountries[0];

  return (
    <div className="company-footprint-map">
      <svg
        viewBox="0 0 900 540"
        role="img"
        aria-labelledby="company-map-title company-map-description"
      >
        <title id="company-map-title">GreenTech Professionals European footprint</title>
        <desc id="company-map-description">
          Project locations in Romania, Italy and Spain connected from Butimanu,
          Romania.
        </desc>

        <g className="company-map-countries">
          {visibleCountries.map((country) => {
            const countryId = String(country.id).padStart(3, "0");
            const networkCountry = networkCountries.find(({ id }) => id === countryId);
            const classNames = [
              "company-map-country",
              networkCountryIds.has(countryId) ? "is-network" : "",
              networkCountry?.code === selectedCountryCode ? "is-selected" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <path
                aria-label={networkCountry ? `Show ${networkCountry.name} project locations` : undefined}
                className={classNames}
                d={createCountryPath(country)}
                key={countryId}
                role={networkCountry ? "button" : undefined}
                tabIndex={networkCountry ? 0 : undefined}
                onClick={
                  networkCountry
                    ? () => setSelectedCountryCode(networkCountry.code)
                    : undefined
                }
                onKeyDown={
                  networkCountry
                    ? (event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        setSelectedCountryCode(networkCountry.code);
                      }
                    : undefined
                }
              >
                <title>{networkCountry?.name ?? country.properties.name}</title>
              </path>
            );
          })}
        </g>

        <g className="company-map-connections" aria-hidden="true">
          {cityPoints
            .filter(({ name, countryCode }) => name !== originCity.name || countryCode !== "RO")
            .map((city, index) => (
              <path
                className={city.countryCode === selectedCountryCode ? "is-selected" : ""}
                d={createConnectionPath(city.point)}
                key={`${city.countryCode}-${city.name}`}
                pathLength="1"
                style={{ "--map-line-index": index }}
              />
            ))}
        </g>

        <g className="company-map-labels" aria-hidden="true">
          {networkCountries.map((country) => {
            const labelPoint = projection(country.labelPoint);
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
          {cityPoints.map((city) => {
            const isOrigin = city.name === originCity.name && city.countryCode === "RO";
            const isSelected = city.countryCode === selectedCountryCode;

            return (
              <g
                className={`${isOrigin ? "is-origin" : ""} ${isSelected ? "is-selected" : ""}`}
                key={`${city.countryCode}-${city.name}`}
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
        <div className="company-map-selected" aria-live="polite">
          <span>{selectedCountry.code}</span>
          <strong>{selectedCountry.name}</strong>
          <p>{selectedCountry.cities.map(({ name }) => name).join(" / ")}</p>
        </div>

        <div className="company-map-tabs" role="group" aria-label="Project countries">
          {networkCountries.map((country) => (
            <button
              type="button"
              aria-pressed={country.code === selectedCountryCode}
              className={country.code === selectedCountryCode ? "is-active" : ""}
              key={country.code}
              onClick={() => setSelectedCountryCode(country.code)}
            >
              {country.code}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CompanyFootprintMap;
