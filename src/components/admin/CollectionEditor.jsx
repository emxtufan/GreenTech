import React, { useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ImageUp,
  Loader2,
  MapPin,
  Pin,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { geocodeLocation, uploadImage } from "@/lib/adminApi.js";
import { findIsoCountryByName, ISO_COUNTRIES } from "@/lib/isoCountries.js";

const newId = () =>
  (crypto.randomUUID?.() ?? `item-${Date.now()}-${Math.random().toString(16).slice(2)}`);

const numberInputValue = (event) =>
  (event.target.value === "" ? "" : Number(event.target.value));

const readableFileName = (name) => String(name || "")
  .replace(/\.[^.]+$/, "")
  .replace(/[-_]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const copyDefaultValue = (value) => {
  if (Array.isArray(value)) return value.map(copyDefaultValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, copyDefaultValue(nested)]),
    );
  }
  return value;
};

const initialFieldValue = (field) => {
  if (Object.prototype.hasOwnProperty.call(field, "defaultValue")) {
    return copyDefaultValue(field.defaultValue);
  }
  if (field.type === "nested" || field.type === "string-list") return [];
  if (field.type === "boolean") return false;
  return "";
};

function SelectField({ id, value, options = [], onChange }) {
  return (
    <select
      id={id}
      className="admin-native-select"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
    >
      {!options.some((option) => option.value === "") && value === "" && (
        <option value="" disabled>Choose an option</option>
      )}
      {options.map((option) => (
        <option value={option.value} key={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function ImageField({ value, category, onChange, onNotify }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (event) => {
    const file = event.target.files?.[0];
    // Reset immediately so re-picking the same file still fires a change event.
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    try {
      const { url } = await uploadImage(file, category);
      onChange(url);
      onNotify?.({ tone: "success", message: `Uploaded ${file.name}` });
    } catch (error) {
      onNotify?.({ tone: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-image-field">
      {value ? (
        <img className="admin-image-thumb" src={value} alt="" />
      ) : (
        <div className="admin-image-thumb admin-image-empty" aria-hidden="true">
          <ImageUp />
        </div>
      )}

      <div className="admin-image-controls">
        <Input
          value={value ?? ""}
          placeholder="/uploads/..."
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="admin-image-buttons">
          <Button type="button" variant="outline" size="sm" disabled={busy}
            onClick={() => inputRef.current?.click()}>
            <ImageUp aria-hidden="true" />
            {busy ? "Uploading…" : value ? "Replace" : "Upload"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              <X aria-hidden="true" />
              Remove
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          onChange={pick}
        />
      </div>
    </div>
  );
}

function CountryField({ id, value, item, onItemChange }) {
  const listId = `${id}-countries`;
  const selectedCountry = findIsoCountryByName(value);

  const updateCountry = (nextValue) => {
    const country = findIsoCountryByName(nextValue);

    if (!country) {
      onItemChange({
        ...item,
        name: nextValue,
        code: "",
        iso3: "",
        atlasId: "",
      });
      return;
    }

    onItemChange({
      ...item,
      name: country.name,
      code: country.alpha2,
      iso3: country.alpha3,
      atlasId: country.numeric,
    });
  };

  return (
    <div className="admin-country-field">
      <Input
        id={id}
        list={listId}
        value={value}
        placeholder="Start typing a country"
        autoComplete="off"
        onChange={(event) => updateCountry(event.target.value)}
      />
      <datalist id={listId}>
        {ISO_COUNTRIES.map((country) => (
          <option
            key={country.alpha2}
            value={country.name}
            label={`${country.alpha2} / ${country.alpha3} / ${country.numeric}`}
          />
        ))}
      </datalist>
      {selectedCountry && (
        <div className="admin-country-codes" aria-live="polite">
          <span>ISO-2 <b>{selectedCountry.alpha2}</b></span>
          <span>ISO-3 <b>{selectedCountry.alpha3}</b></span>
          <span>Numeric <b>{selectedCountry.numeric}</b></span>
        </div>
      )}
    </div>
  );
}

/**
 * A repeatable list living inside a single item — a project's technical scope
 * or its photo gallery. Same add / remove / reorder contract as the outer
 * editor, kept deliberately lighter because these lists are short.
 */
function NestedList({ field, rows, category, parentItem, onChange, onNotify }) {
  const items = Array.isArray(rows) ? rows : [];
  const itemsRef = useRef(items);
  const bulkRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [geocodingId, setGeocodingId] = useState(null);
  const [resolvedLocations, setResolvedLocations] = useState({});

  itemsRef.current = items;

  // Only lists whose rows carry an image can take a batch of files.
  const imageKey = field.fields.find((nested) => nested.type === "image")?.key;

  const uploadMany = async (event) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (files.length === 0) return;

    const added = [];
    const failed = [];

    // Sequential: keeps the progress count honest and avoids firing a dozen
    // concurrent writes at the server for what is usually a handful of photos.
    for (const [index, file] of files.entries()) {
      setProgress({ done: index, total: files.length, name: file.name });
      try {
        const { url } = await uploadImage(file, category);
        const row = { id: newId() };
        for (const nested of field.fields) row[nested.key] = initialFieldValue(nested);
        row[imageKey] = url;
        if (Object.hasOwn(row, "originalName")) row.originalName = file.name;
        if (Object.hasOwn(row, "name")) row.name = file.name;
        if (Object.hasOwn(row, "title")) row.title = readableFileName(file.name);
        if (Object.hasOwn(row, "alt")) row.alt = readableFileName(file.name);
        added.push(row);
        setProgress({ done: index + 1, total: files.length, name: file.name });
      } catch (error) {
        failed.push(`${file.name}: ${error.message}`);
      }
    }

    setProgress(null);

    // Append whatever succeeded rather than discarding the whole batch.
    if (added.length > 0) onChange([...items, ...added]);

    if (failed.length === 0) {
      onNotify?.({
        tone: "success",
        message: `Uploaded ${added.length} image${added.length === 1 ? "" : "s"}. Add alt text for each.`,
      });
    } else {
      onNotify?.({
        tone: "error",
        message: `${added.length} of ${files.length} uploaded. ${failed.length} failed.`,
        issues: failed,
      });
    }
  };

  const replace = (index, next) =>
    onChange(items.map((row, position) => (position === index ? next : row)));

  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const add = () => {
    const row = { id: newId() };
    for (const nested of field.fields) row[nested.key] = initialFieldValue(nested);
    onChange([...items, row]);
  };

  const findCoordinates = async (row, index) => {
    const config = field.geocode;
    const rowId = String(row.id ?? index);
    const query = String(row[config.queryKey] ?? "").trim();
    const countryCode = String(parentItem?.code ?? "").trim().toUpperCase();

    if (!query || !/^[A-Z]{2}$/.test(countryCode)) {
      onNotify?.({
        tone: "error",
        message: query
          ? "Choose the country before searching for coordinates."
          : "Enter a location name before searching for coordinates.",
      });
      return;
    }

    setGeocodingId(rowId);

    try {
      const { result, cached } = await geocodeLocation({ query, countryCode });
      const [longitude, latitude] = Array.isArray(result.coordinates)
        ? result.coordinates.map(Number)
        : [Number(result.longitude), Number(result.latitude)];

      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        throw new Error("The location service returned invalid coordinates.");
      }

      const latestItems = itemsRef.current;
      const rowIndex = latestItems.findIndex((item, position) =>
        String(item.id ?? position) === rowId);

      if (rowIndex !== -1) {
        onChange(latestItems.map((item, position) => (
          position === rowIndex
            ? {
                ...item,
                [config.longitudeKey]: longitude,
                [config.latitudeKey]: latitude,
              }
            : item
        )));
      }

      setResolvedLocations((current) => ({
        ...current,
        [rowId]: `${result.displayName} - Lat ${latitude}, Long ${longitude}`,
      }));
      onNotify?.({
        tone: "success",
        message: `Coordinates found for ${query}${cached ? " (cached)" : ""}.`,
      });
    } catch (error) {
      onNotify?.({ tone: "error", message: error.message });
    } finally {
      setGeocodingId(null);
    }
  };

  return (
    <div className="admin-nested">
      {imageKey && (
        <div className="admin-bulk-upload admin-bulk-upload-compact">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={Boolean(progress)}
            onClick={() => bulkRef.current?.click()}
          >
            {progress ? (
              <Loader2 className="admin-spin" aria-hidden="true" />
            ) : (
              <ImageUp aria-hidden="true" />
            )}
            {progress
              ? `Uploading ${progress.done}/${progress.total}`
              : "Upload multiple images"}
          </Button>
          {progress && <small title={progress.name}>{progress.name}</small>}
          <input
            ref={bulkRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            hidden
            onChange={uploadMany}
          />
        </div>
      )}

      {items.map((row, index) => (
        <div className="admin-nested-row" key={row.id ?? index}>
          <div className="admin-nested-head">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div className="admin-collection-actions">
              <Button type="button" variant="ghost" size="icon" aria-label="Move up"
                disabled={index === 0} onClick={() => move(index, -1)}>
                <ChevronUp aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Move down"
                disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                <ChevronDown aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Delete"
                onClick={() => onChange(items.filter((_, p) => p !== index))}>
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </div>

          {field.fields.map((nested) => (
            <div className="admin-field admin-field-wide" key={nested.key}>
              <Label htmlFor={`${row.id ?? index}-${nested.key}`}>{nested.label}</Label>

              {nested.type === "image" ? (
                <ImageField
                  value={row[nested.key] ?? ""}
                  category={category}
                  onNotify={onNotify}
                  onChange={(next) => replace(index, { ...row, [nested.key]: next })}
                />
              ) : nested.type === "number" ? (
                <Input
                  id={`${row.id ?? index}-${nested.key}`}
                  type="number"
                  min={nested.min}
                  max={nested.max}
                  step={nested.step ?? "any"}
                  value={row[nested.key] ?? ""}
                  placeholder={nested.placeholder}
                  onChange={(event) =>
                    replace(index, { ...row, [nested.key]: numberInputValue(event) })}
                />
              ) : nested.type === "textarea" ? (
                <Textarea
                  id={`${row.id ?? index}-${nested.key}`}
                  rows={nested.rows ?? 3}
                  value={row[nested.key] ?? ""}
                  onChange={(event) =>
                    replace(index, { ...row, [nested.key]: event.target.value })}
                />
              ) : nested.type === "string-list" ? (
                <Textarea
                  id={`${row.id ?? index}-${nested.key}`}
                  rows={nested.rows ?? 5}
                  value={Array.isArray(row[nested.key])
                    ? row[nested.key].join("\n\n")
                    : row[nested.key] ?? ""}
                  onChange={(event) => replace(index, {
                    ...row,
                    [nested.key]: event.target.value.split("\n\n"),
                  })}
                />
              ) : nested.type === "select" ? (
                <SelectField
                  id={`${row.id ?? index}-${nested.key}`}
                  value={row[nested.key] ?? ""}
                  options={nested.options}
                  onChange={(next) => replace(index, { ...row, [nested.key]: next })}
                />
              ) : (
                <Input
                  id={`${row.id ?? index}-${nested.key}`}
                  value={row[nested.key] ?? ""}
                  placeholder={nested.placeholder}
                  onChange={(event) =>
                    replace(index, { ...row, [nested.key]: event.target.value })}
                />
              )}
              {nested.hint && <small className="admin-field-hint">{nested.hint}</small>}
            </div>
          ))}

          {field.geocode && (
            <div className="admin-geocode-row">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={geocodingId !== null}
                onClick={() => findCoordinates(row, index)}
              >
                {geocodingId === String(row.id ?? index) ? (
                  <Loader2 className="admin-spin" aria-hidden="true" />
                ) : (
                  <MapPin aria-hidden="true" />
                )}
                {geocodingId === String(row.id ?? index) ? "Searching..." : "Find coordinates"}
              </Button>

              <div className="admin-geocode-result" aria-live="polite">
                {resolvedLocations[String(row.id ?? index)] ? (
                  <strong title={resolvedLocations[String(row.id ?? index)]}>
                    {resolvedLocations[String(row.id ?? index)]}
                  </strong>
                ) : (
                  <span>Search is restricted to {parentItem?.name || "the selected country"}.</span>
                )}
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noreferrer"
                >
                  &copy; OpenStreetMap contributors
                </a>
              </div>
            </div>
          )}
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus aria-hidden="true" />
        Add {field.singular}
      </Button>
    </div>
  );
}

function ItemFields({
  item,
  fields,
  category,
  optionSources,
  onChange,
  onItemChange,
  onNotify,
}) {
  return (
    <div className="admin-field-grid">
      {fields.map((field) => {
        const id = `${item.id}-${field.key}`;
        const value = item[field.key] ?? "";

        return (
          <div className="admin-field admin-field-wide" key={field.key}>
            <Label htmlFor={id}>{field.label}</Label>

            {field.type === "image" && (
              <ImageField
                value={value}
                category={category}
                onNotify={onNotify}
                onChange={(next) => onChange(field.key, next)}
              />
            )}

            {field.type === "nested" && (
              <NestedList
                field={field}
                rows={item[field.key]}
                category={category}
                parentItem={item}
                onNotify={onNotify}
                onChange={(next) => onChange(field.key, next)}
              />
            )}

            {field.type === "country" && (
              <CountryField
                id={id}
                value={value}
                item={item}
                onItemChange={onItemChange}
              />
            )}

            {field.type === "textarea" && (
              <Textarea
                id={id}
                rows={field.rows ?? 4}
                value={value}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            )}

            {field.type === "number" && (
              <Input
                id={id}
                type="number"
                min={field.min}
                max={field.max}
                step={field.step ?? "any"}
                value={value}
                placeholder={field.placeholder}
                onChange={(event) => onChange(field.key, numberInputValue(event))}
              />
            )}

            {field.type === "date" && (
              <Input
                id={id}
                type="date"
                value={value}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            )}

            {field.type === "select" && (
              <SelectField
                id={id}
                value={value}
                options={field.options ?? optionSources?.[field.optionsSource]}
                onChange={(next) => onChange(field.key, next)}
              />
            )}

            {field.type === "boolean" && (
              <div className="admin-boolean-control">
                <span>{value ? "Yes" : "No"}</span>
                <Switch
                  checked={Boolean(value)}
                  aria-label={field.label}
                  onCheckedChange={(next) => onChange(field.key, next)}
                />
              </div>
            )}

            {(field.type === "text" || field.type === undefined) && (
              <Input
                id={id}
                value={value}
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                onChange={(event) => onChange(
                  field.key,
                  field.uppercase ? event.target.value.toUpperCase() : event.target.value,
                )}
              />
            )}
            {field.hint && <small className="admin-field-hint">{field.hint}</small>}
          </div>
        );
      })}
    </div>
  );
}

/**
 * One implementation of add / edit / delete / reorder for every repeatable
 * collection. Each collection supplies a field list rather than its own CRUD.
 */
export default function CollectionEditor({
  collection,
  items,
  optionSources,
  onItemsChange,
  onNotify,
}) {
  const [openId, setOpenId] = useState(null);
  const bulkInputRef = useRef(null);
  const itemsRef = useRef(items);
  const [bulkProgress, setBulkProgress] = useState(null);
  const supportsPinning = collection.fields.some((field) => field.key === "pinned");

  itemsRef.current = items;

  const replace = (index, next) =>
    onItemsChange(items.map((item, position) => (position === index ? next : item)));

  const updateField = (index, key, value) =>
    replace(index, { ...items[index], [key]: value });

  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    // `order` is what the public site sorts by, so rewrite it to match.
    onItemsChange(next.map((item, position) => ({ ...item, order: position + 1 })));
  };

  const add = () => {
    const item = { id: newId(), order: items.length + 1, enabled: true };
    for (const field of collection.fields) {
      item[field.key] = initialFieldValue(field);
    }
    onItemsChange([...items, item]);
    setOpenId(item.id);
  };

  const uploadMany = async (event) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!collection.bulkUpload || files.length === 0) return;

    const added = [];
    const failed = [];

    for (const [index, file] of files.entries()) {
      setBulkProgress({ done: index, total: files.length, name: file.name });

      try {
        const { url } = await uploadImage(file, collection.uploadCategory);
        const item = {
          id: newId(),
          order: itemsRef.current.length + added.length + 1,
          enabled: true,
          uploadedAt: new Date().toISOString(),
        };

        for (const field of collection.fields) {
          item[field.key] = initialFieldValue(field);
        }

        item[collection.bulkImageKey] = url;
        item[collection.bulkNameKey] = file.name;
        item[collection.bulkTitleKey] = readableFileName(file.name);
        item[collection.bulkAltKey] = readableFileName(file.name);
        added.push(item);
        setBulkProgress({ done: index + 1, total: files.length, name: file.name });
      } catch (error) {
        failed.push(`${file.name}: ${error.message}`);
      }
    }

    setBulkProgress(null);

    if (added.length > 0) {
      onItemsChange(
        [...itemsRef.current, ...added]
          .map((item, index) => ({ ...item, order: index + 1 })),
      );
    }

    if (failed.length === 0) {
      onNotify?.({
        tone: "success",
        message: `${added.length} photograph${added.length === 1 ? "" : "s"} uploaded. Publish changes to add them to the website.`,
      });
    } else {
      onNotify?.({
        tone: "error",
        message: `${added.length} of ${files.length} photographs uploaded. ${failed.length} failed.`,
        issues: failed,
      });
    }
  };

  const remove = (index) => {
    const item = items[index];
    const label = item[collection.titleField] || "this item";
    if (!window.confirm(`Delete "${label}"? This cannot be undone once you save.`)) return;

    onItemsChange(
      items
        .filter((_, position) => position !== index)
        .map((entry, position) => ({ ...entry, order: position + 1 })),
    );
  };

  return (
    <section className="admin-form-section" aria-labelledby={`${collection.key}-title`}>
      <div className="admin-form-heading">
        <div>
          <h2 id={`${collection.key}-title`}>{collection.heading}</h2>
          <p>{collection.description}</p>
        </div>
        <div className="admin-collection-heading-actions">
          {collection.bulkUpload && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(bulkProgress)}
                onClick={() => bulkInputRef.current?.click()}
              >
                {bulkProgress ? (
                  <Loader2 className="admin-spin" aria-hidden="true" />
                ) : (
                  <ImageUp aria-hidden="true" />
                )}
                {bulkProgress
                  ? `Uploading ${bulkProgress.done}/${bulkProgress.total}`
                  : "Upload photographs"}
              </Button>
              <input
                ref={bulkInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                hidden
                onChange={uploadMany}
              />
            </>
          )}
          <Badge variant="secondary">{items.length} items</Badge>
        </div>
      </div>

      {bulkProgress && (
        <div className="admin-bulk-progress" aria-live="polite">
          <span style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }} />
          <small title={bulkProgress.name}>{bulkProgress.name}</small>
        </div>
      )}

      <ul className="admin-collection">
        {items.map((item, index) => {
          const open = openId === item.id;

          return (
            <li className="admin-collection-item" key={item.id}>
              <div className="admin-collection-row">
                <button
                  type="button"
                  className="admin-collection-summary"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : item.id)}
                >
                  <span className="admin-collection-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="admin-collection-name">
                    {item[collection.titleField] || "Untitled"}
                    {item.enabled === false && <small> · hidden</small>}
                  </span>
                  {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                </button>

                <div className="admin-collection-actions">
                  {supportsPinning && (
                    <Button
                      type="button"
                      variant={item.pinned ? "secondary" : "ghost"}
                      size="sm"
                      className={`admin-collection-pin${item.pinned ? " is-pinned" : ""}`}
                      aria-label={item.pinned
                        ? `Unpin ${item[collection.titleField] || "item"}`
                        : `Pin ${item[collection.titleField] || "item"} on homepage`}
                      aria-pressed={Boolean(item.pinned)}
                      title={item.pinned ? "Remove homepage pin" : "Pin on homepage"}
                      onClick={() => updateField(index, "pinned", !item.pinned)}
                    >
                      <Pin aria-hidden="true" />
                      <span>{item.pinned ? "Pinned" : "Pin"}</span>
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="icon"
                    aria-label={`Move ${item[collection.titleField] || "item"} up`}
                    disabled={index === 0} onClick={() => move(index, -1)}>
                    <ChevronUp aria-hidden="true" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon"
                    aria-label={`Move ${item[collection.titleField] || "item"} down`}
                    disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                    <ChevronDown aria-hidden="true" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon"
                    aria-label={`Delete ${item[collection.titleField] || "item"}`}
                    onClick={() => remove(index)}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {open && (
                <div className="admin-collection-body">
                  <div className="admin-setting-row">
                    <div>
                      <Label htmlFor={`${item.id}-enabled`}>Visible on website</Label>
                      <p>Hidden items stay saved but are not rendered.</p>
                    </div>
                    <Switch
                      id={`${item.id}-enabled`}
                      checked={item.enabled !== false}
                      onCheckedChange={(checked) => updateField(index, "enabled", checked)}
                    />
                  </div>

                  <ItemFields
                    item={item}
                    fields={collection.fields}
                    category={collection.uploadCategory}
                    optionSources={optionSources}
                    onNotify={onNotify}
                    onChange={(key, value) => updateField(index, key, value)}
                    onItemChange={(nextItem) => replace(index, nextItem)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Button type="button" variant="outline" onClick={add}>
        <Plus aria-hidden="true" />
        Add {collection.singular}
      </Button>
    </section>
  );
}
