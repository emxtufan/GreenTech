import React, { useRef, useState } from "react";
import { ChevronDown, ChevronUp, ImageUp, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { uploadImage } from "@/lib/adminApi.js";

const newId = () =>
  (crypto.randomUUID?.() ?? `item-${Date.now()}-${Math.random().toString(16).slice(2)}`);

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

/**
 * A repeatable list living inside a single item — a project's technical scope
 * or its photo gallery. Same add / remove / reorder contract as the outer
 * editor, kept deliberately lighter because these lists are short.
 */
function NestedList({ field, rows, category, onChange, onNotify }) {
  const items = Array.isArray(rows) ? rows : [];
  const bulkRef = useRef(null);
  const [progress, setProgress] = useState(null);

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
      setProgress({ done: index, total: files.length });
      try {
        const { url } = await uploadImage(file, category);
        added.push({ id: newId(), [imageKey]: url });
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
    for (const nested of field.fields) row[nested.key] = "";
    onChange([...items, row]);
  };

  return (
    <div className="admin-nested">
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
              ) : nested.type === "textarea" ? (
                <Textarea
                  id={`${row.id ?? index}-${nested.key}`}
                  rows={nested.rows ?? 3}
                  value={row[nested.key] ?? ""}
                  onChange={(event) =>
                    replace(index, { ...row, [nested.key]: event.target.value })}
                />
              ) : (
                <Input
                  id={`${row.id ?? index}-${nested.key}`}
                  value={row[nested.key] ?? ""}
                  onChange={(event) =>
                    replace(index, { ...row, [nested.key]: event.target.value })}
                />
              )}
            </div>
          ))}
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus aria-hidden="true" />
        Add {field.singular}
      </Button>
    </div>
  );
}

function ItemFields({ item, fields, category, onChange, onNotify }) {
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
                onNotify={onNotify}
                onChange={(next) => onChange(field.key, next)}
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

            {(field.type === "text" || field.type === undefined) && (
              <Input
                id={id}
                value={value}
                placeholder={field.placeholder}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            )}
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
export default function CollectionEditor({ collection, items, onItemsChange, onNotify }) {
  const [openId, setOpenId] = useState(null);

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
      item[field.key] = field.type === "nested" ? [] : "";
    }
    onItemsChange([...items, item]);
    setOpenId(item.id);
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
        <Badge variant="secondary">{items.length} items</Badge>
      </div>

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
                    onNotify={onNotify}
                    onChange={(key, value) => updateField(index, key, value)}
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
