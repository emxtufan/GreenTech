import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Briefcase,
  Check,
  Clock3,
  Download,
  Inbox,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  deleteCareerApplication,
  getCareerApplications,
  updateCareerApplicationStatus,
} from "@/lib/adminApi.js";

const FILTERS = [
  ["new", "New"],
  ["reviewing", "Reviewing"],
  ["shortlisted", "Shortlisted"],
  ["rejected", "Rejected"],
  ["all", "All"],
];

const STATUS_LABELS = {
  new: "New application",
  reviewing: "Reviewing",
  shortlisted: "Shortlisted",
  rejected: "Rejected",
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

const initials = (name) => (
  String(name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || "?"
);

const fileSize = (bytes) => (
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil((bytes || 0) / 1024)} KB`
);

export default function ApplicationInbox({ onNotify }) {
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState("new");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [loadError, setLoadError] = useState("");

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const payload = await getCareerApplications();
      setApplications(Array.isArray(payload.applications) ? payload.applications : []);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const counts = useMemo(() => ({
    new: applications.filter((item) => item.status === "new").length,
    reviewing: applications.filter((item) => item.status === "reviewing").length,
    shortlisted: applications.filter((item) => item.status === "shortlisted").length,
    rejected: applications.filter((item) => item.status === "rejected").length,
    all: applications.length,
  }), [applications]);

  const visible = useMemo(() => (
    filter === "all" ? applications : applications.filter((item) => item.status === filter)
  ), [filter, applications]);

  const changeStatus = async (application, status) => {
    setBusyId(application.id);
    try {
      const payload = await updateCareerApplicationStatus(application.id, status);
      setApplications((current) => current.map((item) => (
        item.id === application.id ? payload.application : item
      )));
      onNotify?.({
        tone: "success",
        message: `${application.name} moved to ${STATUS_LABELS[status] || status}.`,
      });
    } catch (error) {
      onNotify?.({ tone: "error", message: error.message });
    } finally {
      setBusyId(null);
    }
  };

  const removeApplication = async (application) => {
    if (!window.confirm(
      `Delete the application from ${application.name}? The CV file is deleted too. This cannot be undone.`,
    )) {
      return;
    }

    setBusyId(application.id);
    try {
      await deleteCareerApplication(application.id);
      setApplications((current) => current.filter((item) => item.id !== application.id));
      onNotify?.({ tone: "success", message: "Application and CV permanently deleted." });
    } catch (error) {
      onNotify?.({ tone: "error", message: error.message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      className="admin-form-section admin-review-moderation admin-inquiry-inbox"
      aria-labelledby="application-inbox-title"
    >
      <div className="admin-form-heading">
        <div>
          <h2 id="application-inbox-title">Career applications</h2>
          <p>
            Applications sent from the website. CVs are stored privately and can only
            be downloaded from here.
          </p>
        </div>
        <Badge className={counts.new ? "admin-review-pending-badge" : ""} variant="secondary">
          {counts.new} new
        </Badge>
      </div>

      <div className="admin-review-overview" aria-label="Application status summary">
        <div>
          <Inbox aria-hidden="true" />
          <span>New</span>
          <strong>{counts.new}</strong>
        </div>
        <div>
          <Briefcase aria-hidden="true" />
          <span>Reviewing</span>
          <strong>{counts.reviewing}</strong>
        </div>
        <div>
          <Star aria-hidden="true" />
          <span>Shortlisted</span>
          <strong>{counts.shortlisted}</strong>
        </div>
        <div>
          <Archive aria-hidden="true" />
          <span>Rejected</span>
          <strong>{counts.rejected}</strong>
        </div>
      </div>

      <div className="admin-review-toolbar">
        <div className="admin-review-filters" role="tablist" aria-label="Filter applications">
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

        <Button type="button" variant="outline" size="sm" onClick={loadApplications} disabled={loading}>
          {loading ? <Loader2 className="admin-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
          Refresh
        </Button>
      </div>

      {loadError && (
        <div className="admin-review-load-error" role="alert">
          <p>{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={loadApplications}>
            Try again
          </Button>
        </div>
      )}

      {!loadError && loading && applications.length === 0 && (
        <div className="admin-review-empty" role="status">
          <Loader2 className="admin-spin" aria-hidden="true" />
          <span>Loading applications</span>
        </div>
      )}

      {!loadError && !loading && visible.length === 0 && (
        <div className="admin-review-empty">
          <span>
            {filter === "all"
              ? "No applications have been submitted yet."
              : `No ${filter} applications.`}
          </span>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="admin-review-list admin-inquiry-list">
          {visible.map((application) => {
            const busy = busyId === application.id;

            return (
              <li className="admin-review-item admin-inquiry-item" key={application.id}>
                <article>
                  <header className="admin-review-item-header">
                    <span className="admin-review-avatar" aria-hidden="true">
                      {initials(application.name)}
                    </span>
                    <div>
                      <strong>{application.name}</strong>
                      <span className="admin-application-position">
                        {application.position}
                      </span>
                    </div>
                    <span className={`admin-review-status is-${application.status}`}>
                      {STATUS_LABELS[application.status] || application.status}
                    </span>
                  </header>

                  <div className="admin-review-item-meta admin-inquiry-meta">
                    <span>
                      <Clock3 aria-hidden="true" />
                      <time dateTime={application.submittedAt}>
                        {formatDate(application.submittedAt)}
                      </time>
                    </span>
                    <a href={`mailto:${application.email}`}>
                      <Mail aria-hidden="true" />
                      {application.email}
                    </a>
                    <a href={`tel:${application.phone}`}>
                      <Phone aria-hidden="true" />
                      {application.phone}
                    </a>
                    <span className="admin-inquiry-consent" title={formatDate(application.consentAt)}>
                      <ShieldCheck aria-hidden="true" />
                      GDPR accepted
                    </span>
                  </div>

                  <p className="admin-inquiry-message">{application.experience}</p>

                  <footer className="admin-review-item-actions">
                    <Button type="button" variant="outline" size="sm" asChild>
                      {/* Downloads through the authenticated route, not a public path. */}
                      <a href={`/api/admin/applications/${encodeURIComponent(application.id)}/cv`}>
                        <Download aria-hidden="true" />
                        CV ({fileSize(application.cvBytes)})
                      </a>
                    </Button>

                    {application.status === "new" && (
                      <Button type="button" size="sm" disabled={busy}
                        onClick={() => changeStatus(application, "reviewing")}>
                        {busy ? <Loader2 className="admin-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                        Start review
                      </Button>
                    )}

                    {application.status !== "shortlisted" && (
                      <Button type="button" variant="outline" size="sm" disabled={busy}
                        onClick={() => changeStatus(application, "shortlisted")}>
                        <Star aria-hidden="true" />
                        Shortlist
                      </Button>
                    )}

                    {application.status !== "rejected" && (
                      <Button type="button" variant="outline" size="sm" disabled={busy}
                        onClick={() => changeStatus(application, "rejected")}>
                        <Archive aria-hidden="true" />
                        Reject
                      </Button>
                    )}

                    {application.status !== "new" && (
                      <Button type="button" variant="outline" size="sm" disabled={busy}
                        onClick={() => changeStatus(application, "new")}>
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
                      aria-label={`Delete application from ${application.name}`}
                      title="Delete application and CV"
                      onClick={() => removeApplication(application)}
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
