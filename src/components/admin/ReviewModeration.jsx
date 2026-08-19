import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock3,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  deleteCustomerReview,
  getCustomerReviews,
  updateCustomerReviewStatus,
} from "@/lib/adminApi.js";

const FILTERS = [
  ["pending", "Pending"],
  ["demo", "Demo"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["all", "All"],
];

const STATUS_LABELS = {
  pending: "Awaiting review",
  approved: "Published",
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

const initials = (name) => name
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part.charAt(0))
  .join("")
  .toUpperCase();

export default function ReviewModeration({ onNotify }) {
  const [reviews, setReviews] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [loadError, setLoadError] = useState("");

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const payload = await getCustomerReviews();
      setReviews(Array.isArray(payload.reviews) ? payload.reviews : []);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const counts = useMemo(() => ({
    pending: reviews.filter((review) => review.status === "pending").length,
    demo: reviews.filter((review) => review.demo === true).length,
    approved: reviews.filter((review) => review.status === "approved").length,
    rejected: reviews.filter((review) => review.status === "rejected").length,
    all: reviews.length,
  }), [reviews]);

  const visibleReviews = useMemo(() => (
    filter === "all"
      ? reviews
      : filter === "demo"
        ? reviews.filter((review) => review.demo === true)
        : reviews.filter((review) => review.status === filter)
  ), [filter, reviews]);

  const changeStatus = async (review, status) => {
    setBusyId(review.id);
    try {
      const payload = await updateCustomerReviewStatus(review.id, status);
      setReviews((current) => current.map((item) => (
        item.id === review.id ? payload.review : item
      )));
      onNotify?.({
        tone: "success",
        message: status === "approved"
          ? `Review from ${review.author} is now published.`
          : status === "rejected"
            ? `Review from ${review.author} was rejected.`
            : `Review from ${review.author} returned to the pending queue.`,
      });
    } catch (error) {
      onNotify?.({ tone: "error", message: error.message });
    } finally {
      setBusyId(null);
    }
  };

  const removeReview = async (review) => {
    if (!window.confirm(`Delete the review from ${review.author}? This cannot be undone.`)) {
      return;
    }

    setBusyId(review.id);
    try {
      await deleteCustomerReview(review.id);
      setReviews((current) => current.filter((item) => item.id !== review.id));
      onNotify?.({ tone: "success", message: "Review permanently deleted." });
    } catch (error) {
      onNotify?.({ tone: "error", message: error.message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="admin-form-section admin-review-moderation" aria-labelledby="review-moderation-title">
      <div className="admin-form-heading">
        <div>
          <h2 id="review-moderation-title">Customer review moderation</h2>
          <p>Browser submissions stay private until you approve them.</p>
        </div>
        <Badge className={counts.pending ? "admin-review-pending-badge" : ""} variant="secondary">
          {counts.pending} pending
        </Badge>
      </div>

      <div className="admin-review-overview" aria-label="Review status summary">
        <div>
          <Clock3 aria-hidden="true" />
          <span>Pending</span>
          <strong>{counts.pending}</strong>
        </div>
        <div>
          <ShieldCheck aria-hidden="true" />
          <span>Published</span>
          <strong>{counts.approved}</strong>
        </div>
        <div>
          <X aria-hidden="true" />
          <span>Rejected</span>
          <strong>{counts.rejected}</strong>
        </div>
      </div>

      <div className="admin-review-toolbar">
        <div className="admin-review-filters" role="tablist" aria-label="Filter customer reviews">
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

        <Button type="button" variant="outline" size="sm" onClick={loadReviews} disabled={loading}>
          {loading ? <Loader2 className="admin-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
          Refresh
        </Button>
      </div>

      {loadError && (
        <div className="admin-review-load-error" role="alert">
          <p>{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={loadReviews}>Try again</Button>
        </div>
      )}

      {!loadError && loading && reviews.length === 0 && (
        <div className="admin-review-empty" role="status">
          <Loader2 className="admin-spin" aria-hidden="true" />
          <span>Loading customer reviews</span>
        </div>
      )}

      {!loadError && !loading && visibleReviews.length === 0 && (
        <div className="admin-review-empty">
          <MessageForEmptyFilter filter={filter} />
        </div>
      )}

      {visibleReviews.length > 0 && (
        <ul className="admin-review-list">
          {visibleReviews.map((review) => {
            const busy = busyId === review.id;

            return (
              <li className="admin-review-item" key={review.id}>
                <article>
                  <header className="admin-review-item-header">
                    <span className="admin-review-avatar" aria-hidden="true">
                      {initials(review.author)}
                    </span>
                    <div>
                      <strong>
                        <span>{review.author}</span>
                        {review.demo === true && (
                          <Badge className="admin-review-demo-badge" variant="secondary">
                            Demo template
                          </Badge>
                        )}
                      </strong>
                      <a href={`mailto:${review.email}`}>
                        <Mail aria-hidden="true" />
                        {review.email}
                      </a>
                    </div>
                    <span className={`admin-review-status is-${review.status}`}>
                      {STATUS_LABELS[review.status] || review.status}
                    </span>
                  </header>

                  <div className="admin-review-item-meta">
                    <span className="admin-review-stars" aria-label={`${review.rating} out of 5 stars`}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          className={star <= review.rating ? "is-filled" : ""}
                          size={15}
                          strokeWidth={1.7}
                          key={star}
                          aria-hidden="true"
                        />
                      ))}
                    </span>
                    <time dateTime={review.submittedAt}>{formatDate(review.submittedAt)}</time>
                  </div>

                  <blockquote>{review.quote}</blockquote>

                  <footer className="admin-review-item-actions">
                    {review.status !== "approved" && review.demo !== true && (
                      <Button type="button" size="sm" disabled={busy} onClick={() => changeStatus(review, "approved")}>
                        {busy ? <Loader2 className="admin-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                        Approve &amp; publish
                      </Button>
                    )}
                    {review.status === "approved" && (
                      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => changeStatus(review, "pending")}>
                        <RotateCcw aria-hidden="true" />
                        Unpublish
                      </Button>
                    )}
                    {review.status !== "rejected" && (
                      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => changeStatus(review, "rejected")}>
                        <X aria-hidden="true" />
                        Reject
                      </Button>
                    )}
                    <Button
                      className="admin-review-delete"
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      aria-label={`Delete review from ${review.author}`}
                      title="Delete review"
                      onClick={() => removeReview(review)}
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

function MessageForEmptyFilter({ filter }) {
  if (filter === "pending") return <span>No reviews are waiting for approval.</span>;
  if (filter === "demo") return <span>No demo review templates.</span>;
  if (filter === "approved") return <span>No browser reviews have been published yet.</span>;
  if (filter === "rejected") return <span>No rejected reviews.</span>;
  return <span>No customer reviews have been submitted yet.</span>;
}
