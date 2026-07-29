import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Check,
  Clock3,
  Inbox,
  Loader2,
  Phone,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  deleteProjectInquiry,
  getProjectInquiries,
  updateProjectInquiryStatus,
} from "@/lib/adminApi.js";

const FILTERS = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["closed", "Closed"],
  ["all", "All"],
];

const STATUS_LABELS = {
  new: "New inquiry",
  contacted: "Contacted",
  closed: "Closed",
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const initials = (firstName, lastName) => (
  `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?"
);

export default function InquiryInbox({ onNotify }) {
  const [inquiries, setInquiries] = useState([]);
  const [filter, setFilter] = useState("new");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [loadError, setLoadError] = useState("");

  const loadInquiries = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const payload = await getProjectInquiries();
      setInquiries(Array.isArray(payload.inquiries) ? payload.inquiries : []);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInquiries();
  }, [loadInquiries]);

  const counts = useMemo(() => ({
    new: inquiries.filter((inquiry) => inquiry.status === "new").length,
    contacted: inquiries.filter((inquiry) => inquiry.status === "contacted").length,
    closed: inquiries.filter((inquiry) => inquiry.status === "closed").length,
    all: inquiries.length,
  }), [inquiries]);

  const visibleInquiries = useMemo(() => (
    filter === "all"
      ? inquiries
      : inquiries.filter((inquiry) => inquiry.status === filter)
  ), [filter, inquiries]);

  const changeStatus = async (inquiry, status) => {
    setBusyId(inquiry.id);
    try {
      const payload = await updateProjectInquiryStatus(inquiry.id, status);
      setInquiries((current) => current.map((item) => (
        item.id === inquiry.id ? payload.inquiry : item
      )));
      onNotify?.({
        tone: "success",
        message: status === "contacted"
          ? `Inquiry from ${inquiry.firstName} ${inquiry.lastName} marked as contacted.`
          : status === "closed"
            ? "Project inquiry closed."
            : "Project inquiry returned to the new queue.",
      });
    } catch (error) {
      onNotify?.({ tone: "error", message: error.message });
    } finally {
      setBusyId(null);
    }
  };

  const removeInquiry = async (inquiry) => {
    const name = `${inquiry.firstName} ${inquiry.lastName}`.trim();
    if (!window.confirm(`Delete the project inquiry from ${name}? This cannot be undone.`)) {
      return;
    }

    setBusyId(inquiry.id);
    try {
      await deleteProjectInquiry(inquiry.id);
      setInquiries((current) => current.filter((item) => item.id !== inquiry.id));
      onNotify?.({ tone: "success", message: "Project inquiry permanently deleted." });
    } catch (error) {
      onNotify?.({ tone: "error", message: error.message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="admin-form-section admin-review-moderation admin-inquiry-inbox" aria-labelledby="inquiry-inbox-title">
      <div className="admin-form-heading">
        <div>
          <h2 id="inquiry-inbox-title">Project inquiry inbox</h2>
          <p>Requests sent from the website form appear here immediately.</p>
        </div>
        <Badge className={counts.new ? "admin-review-pending-badge" : ""} variant="secondary">
          {counts.new} new
        </Badge>
      </div>

      <div className="admin-review-overview" aria-label="Project inquiry status summary">
        <div>
          <Inbox aria-hidden="true" />
          <span>New</span>
          <strong>{counts.new}</strong>
        </div>
        <div>
          <Phone aria-hidden="true" />
          <span>Contacted</span>
          <strong>{counts.contacted}</strong>
        </div>
        <div>
          <Archive aria-hidden="true" />
          <span>Closed</span>
          <strong>{counts.closed}</strong>
        </div>
      </div>

      <div className="admin-review-toolbar">
        <div className="admin-review-filters" role="tablist" aria-label="Filter project inquiries">
          {FILTERS.map(([value, label]) => (
            <button
              className={filter === value ? "is-active" : ""}
              type="button"
              role="tab"
              aria-selected={filter === value}
              key={value}
              onClick={() => setFilter(value)}
            >
              <span>{label}</span>
              <b>{counts[value]}</b>
            </button>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={loadInquiries} disabled={loading}>
          {loading ? <Loader2 className="admin-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
          Refresh
        </Button>
      </div>

      {loadError && (
        <div className="admin-review-load-error" role="alert">
          <p>{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={loadInquiries}>Try again</Button>
        </div>
      )}

      {!loadError && loading && inquiries.length === 0 && (
        <div className="admin-review-empty" role="status">
          <Loader2 className="admin-spin" aria-hidden="true" />
          <span>Loading project inquiries</span>
        </div>
      )}

      {!loadError && !loading && visibleInquiries.length === 0 && (
        <div className="admin-review-empty">
          <EmptyMessage filter={filter} />
        </div>
      )}

      {visibleInquiries.length > 0 && (
        <ul className="admin-review-list admin-inquiry-list">
          {visibleInquiries.map((inquiry) => {
            const busy = busyId === inquiry.id;
            const name = `${inquiry.firstName} ${inquiry.lastName}`.trim();

            return (
              <li className="admin-review-item admin-inquiry-item" key={inquiry.id}>
                <article>
                  <header className="admin-review-item-header">
                    <span className="admin-review-avatar" aria-hidden="true">
                      {initials(inquiry.firstName, inquiry.lastName)}
                    </span>
                    <div>
                      <strong>{name}</strong>
                      <a href={`tel:${inquiry.phone}`}>
                        <Phone aria-hidden="true" />
                        {inquiry.phone}
                      </a>
                    </div>
                    <span className={`admin-review-status is-${inquiry.status}`}>
                      {STATUS_LABELS[inquiry.status] || inquiry.status}
                    </span>
                  </header>

                  <div className="admin-review-item-meta admin-inquiry-meta">
                    <span>
                      <Clock3 aria-hidden="true" />
                      <time dateTime={inquiry.submittedAt}>{formatDate(inquiry.submittedAt)}</time>
                    </span>
                    <span className="admin-inquiry-consent" title={formatDate(inquiry.consentAt)}>
                      <ShieldCheck aria-hidden="true" />
                      GDPR accepted
                    </span>
                  </div>

                  <p className="admin-inquiry-message">{inquiry.message}</p>

                  <footer className="admin-review-item-actions">
                    {inquiry.status === "new" && (
                      <Button type="button" size="sm" disabled={busy} onClick={() => changeStatus(inquiry, "contacted")}>
                        {busy ? <Loader2 className="admin-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                        Mark contacted
                      </Button>
                    )}
                    {inquiry.status !== "closed" && (
                      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => changeStatus(inquiry, "closed")}>
                        <Archive aria-hidden="true" />
                        Close
                      </Button>
                    )}
                    {inquiry.status === "closed" && (
                      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => changeStatus(inquiry, "new")}>
                        <RotateCcw aria-hidden="true" />
                        Reopen
                      </Button>
                    )}
                    <Button
                      className="admin-review-delete"
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      aria-label={`Delete inquiry from ${name}`}
                      title="Delete inquiry"
                      onClick={() => removeInquiry(inquiry)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </footer>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function EmptyMessage({ filter }) {
  if (filter === "new") return <span>No new project inquiries.</span>;
  if (filter === "contacted") return <span>No contacted inquiries.</span>;
  if (filter === "closed") return <span>No closed inquiries.</span>;
  return <span>No project inquiries have been submitted yet.</span>;
}
