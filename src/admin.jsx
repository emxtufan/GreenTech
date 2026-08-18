import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  BadgeCheck,
  Briefcase,
  Building2,
  Check,
  CircleDot,
  ClipboardCheck,
  Database,
  Film,
  GalleryHorizontalEnd,
  Globe2,
  HardHat,
  Image,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  MapPinned,
  MessageSquareQuote,
  Newspaper,
  PanelTop,
  Play,
  RotateCcw,
  Save,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Upload,
  UsersRound,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import CollectionEditor from "@/components/admin/CollectionEditor.jsx";
import ApplicationInbox from "@/components/admin/ApplicationInbox.jsx";
import InquiryInbox from "@/components/admin/InquiryInbox.jsx";
import ReviewModeration from "@/components/admin/ReviewModeration.jsx";
import {
  getSession,
  login as requestLogin,
  logout as requestLogout,
  getContent,
  saveContent,
  uploadAsset,
} from "@/lib/adminApi.js";
import "./admin.css";

const GROUP_ORDER = ["Experience", "Company", "Services", "Content"];

const GROUP_ALIASES = {
  experience: "Experience",
  experienta: "Experience",
  company: "Company",
  companie: "Company",
  services: "Services",
  servicii: "Services",
  content: "Content",
  continut: "Content",
};

const normalizeGroupName = (value) => {
  const original = String(value ?? "").trim();
  const key = original
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return GROUP_ALIASES[key] || original || "Content";
};

// Sidebar sections that also own a repeatable collection in the content file.
const COLLECTIONS = {
  faqs: {
    key: "faqs",
    path: ["faqs", "items"],
    uploadCategory: "sections",
    heading: "Questions",
    description: "Accordion above the contact form. Separate answer paragraphs with a blank line.",
    singular: "question",
    titleField: "question",
    fields: [
      { key: "question", label: "Question" },
      { key: "answer", label: "Answer", type: "textarea", rows: 7 },
    ],
  },
  footer: {
    key: "footer",
    path: ["footer", "links"],
    uploadCategory: "sections",
    heading: "Footer links",
    description:
      'Grouped by the "Group" field — links sharing a group become one column. '
      + 'Use "Social" for the bottom bar, #anchor for on-page sections, '
      + 'and modal:privacy or modal:terms to open the legal dialogs.',
    singular: "link",
    titleField: "label",
    metaHeading: "Footer information",
    metaDescription: "Brand line, contact details and legal text in the footer.",
    metaFields: [
      { key: "tagline", label: "Tagline", type: "textarea", rows: 3 },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone", placeholder: "Leave empty to hide" },
      { key: "address", label: "Address" },
      { key: "mapUrl", label: "Map URL" },
      { key: "copyright", label: "Copyright holder", placeholder: "Greentech Professionals SRL" },
      { key: "privacyTitle", label: "Privacy modal title" },
      { key: "privacyBody", label: "Privacy modal text", type: "textarea", rows: 9 },
      { key: "termsTitle", label: "Terms modal title" },
      { key: "termsBody", label: "Terms modal text", type: "textarea", rows: 9 },
    ],
    fields: [
      { key: "label", label: "Label" },
      { key: "href", label: "URL", placeholder: "#contact or https://…" },
      { key: "group", label: "Group", placeholder: "Explore | Services | Company | Legal | Social" },
    ],
  },
  projects: {
    key: "projects",
    path: ["horizontalGallery", "items"],
    uploadCategory: "gallery",
    heading: "Project items",
    description: "Cards shown in the horizontal projects gallery.",
    singular: "project",
    titleField: "title",
    fields: [
      // Card in the gallery strip
      { key: "title", label: "Title" },
      { key: "category", label: "Card category" },
      { key: "image", label: "Card image", type: "image" },
      { key: "alt", label: "Card image alt text" },
      // Detail page the card links through to
      { key: "projectDate", label: "Project date" },
      { key: "projectCategory", label: "Project category" },
      { key: "location", label: "Location" },
      { key: "capacity", label: "Capacity", placeholder: "300 MW" },
      { key: "capacityKw", label: "Capacity in kW", placeholder: "300,000 kW" },
      { key: "capacityNote", label: "Capacity note" },
      { key: "about", label: "About", type: "textarea", rows: 5 },
      { key: "description", label: "Description", type: "textarea", rows: 7 },
      { key: "sourceUrl", label: "Source URL" },
      {
        key: "scope",
        label: "Technical scope",
        type: "nested",
        singular: "scope item",
        fields: [
          { key: "title", label: "Title" },
          { key: "description", label: "Description", type: "textarea", rows: 3 },
        ],
      },
      {
        key: "gallery",
        label: "Project gallery",
        type: "nested",
        singular: "image",
        fields: [
          { key: "originalName", label: "Original file name" },
          { key: "src", label: "Image", type: "image" },
          { key: "alt", label: "Alt text" },
        ],
      },
    ],
  },
  "photo-gallery": {
    key: "photoGallery",
    path: ["photoGallery", "items"],
    uploadCategory: "gallery",
    bulkUpload: true,
    bulkImageKey: "src",
    bulkNameKey: "originalName",
    bulkTitleKey: "title",
    bulkAltKey: "alt",
    heading: "Photo gallery",
    description: "Independent photographs displayed in the homepage corridor and the complete photo archive.",
    singular: "photograph",
    titleField: "title",
    fields: [
      {
        key: "originalName",
        label: "Original file name",
        hint: "Saved in site content together with the generated public URL.",
      },
      { key: "title", label: "Display title" },
      { key: "src", label: "Image", type: "image" },
      { key: "alt", label: "Alternative text" },
      { key: "caption", label: "Caption", type: "textarea", rows: 3 },
      {
        key: "projectId",
        label: "Related project",
        type: "select",
        optionsSource: "projects",
      },
    ],
  },
  blog: {
    key: "blog",
    path: ["blog", "posts"],
    uploadCategory: "blog",
    heading: "Blog posts",
    description: "Articles listed on the homepage and their detail pages.",
    singular: "post",
    titleField: "title",
    fields: [
      { key: "title", label: "Title" },
      { key: "slug", label: "Slug", placeholder: "url-friendly-identifier" },
      {
        key: "status",
        label: "Publication status",
        type: "select",
        defaultValue: "published",
        options: [
          { value: "published", label: "Published" },
          { value: "draft", label: "Draft" },
        ],
      },
      {
        key: "pinned",
        label: "Pin on homepage",
        type: "boolean",
        defaultValue: false,
        hint: "Pinned announcements stay above articles sorted by publication date.",
      },
      {
        key: "pinLabel",
        label: "Pinned announcement label",
        placeholder: "We're hiring",
        hint: "Displayed as a badge only while this article is pinned.",
      },
      { key: "category", label: "Category" },
      {
        key: "date",
        label: "Publication date",
        type: "date",
        hint: "After pinned announcements, newest publication dates appear first.",
      },
      { key: "dateLabel", label: "Date label" },
      { key: "readTime", label: "Read time" },
      { key: "image", label: "Cover image", type: "image" },
      { key: "alt", label: "Cover alt text" },
      { key: "excerpt", label: "Excerpt", type: "textarea" },
      { key: "intro", label: "Intro", type: "textarea", rows: 6 },
      {
        key: "sections",
        label: "Article chapters",
        type: "nested",
        singular: "chapter",
        fields: [
          { key: "title", label: "Chapter title" },
          {
            key: "paragraphs",
            label: "Paragraphs",
            type: "string-list",
            rows: 7,
            hint: "Separate paragraphs with one blank line.",
          },
        ],
      },
      {
        key: "highlights",
        label: "Article highlights",
        type: "nested",
        singular: "highlight",
        fields: [
          { key: "value", label: "Value", placeholder: "300 MW" },
          { key: "label", label: "Label", placeholder: "Installed capacity" },
        ],
      },
      {
        key: "relatedProjectId",
        label: "Related project",
        type: "select",
        optionsSource: "projects",
        hint: "The article automatically receives a button that opens this project.",
      },
      { key: "sourceUrl", label: "Source URL" },
    ],
  },
  "intro-hero": {
    key: "intro-hero",
    path: ["heroCards", "items"],
    uploadCategory: "sections",
    heading: "Hero cards",
    description: "Copy shown beside each 3D scene. Separate paragraphs with a blank line.",
    singular: "card",
    titleField: "title",
    fields: [
      { key: "title", label: "Title" },
      { key: "body", label: "Body", type: "textarea", rows: 8 },
      { key: "footnote", label: "Footnote" },
    ],
  },
  "company-overview": {
    key: "company-overview",
    path: ["impactStats", "items"],
    uploadCategory: "sections",
    heading: "Impact statistics",
    description: "Figures shown in the company overview. Icon accepts Zap, SolarPanel, BadgeCheck or BadgeDollarSign.",
    singular: "statistic",
    titleField: "label",
    fields: [
      { key: "value", label: "Value" },
      { key: "label", label: "Label" },
      { key: "icon", label: "Icon", placeholder: "Zap | SolarPanel | BadgeCheck | BadgeDollarSign" },
    ],
  },
  clients: {
    key: "clients",
    path: ["clientLogos", "items"],
    uploadCategory: "sections",
    heading: "Client logos",
    description: "Logos shown in the scrolling client strip.",
    singular: "client",
    titleField: "title",
    fields: [
      { key: "title", label: "Name" },
      { key: "image", label: "Logo", type: "image" },
      { key: "alt", label: "Alt text" },
      { key: "href", label: "Website URL" },
    ],
  },
  credentials: {
    key: "credentials",
    path: ["credentials", "items"],
    uploadCategory: "sections",
    heading: "Credentials",
    description: "Trust badges. Icon accepts Award, ShieldCheck, Users or Globe2.",
    singular: "credential",
    titleField: "label",
    fields: [
      { key: "value", label: "Value" },
      { key: "label", label: "Label" },
      { key: "detail", label: "Detail", type: "textarea", rows: 3 },
      { key: "icon", label: "Icon", placeholder: "Award | ShieldCheck | Users | Globe2" },
    ],
  },
  "footprint-map": {
    key: "footprint-map",
    path: ["footprintCountries", "items"],
    uploadCategory: "sections",
    heading: "Countries and project locations",
    description: "Countries generate the map buttons and highlighted shapes. The first location in the first country is the connection origin.",
    singular: "country",
    titleField: "name",
    fields: [
      {
        key: "name",
        label: "Country name",
        type: "country",
        hint: "Choose a suggestion to fill all ISO codes automatically.",
      },
      {
        key: "code",
        label: "ISO alpha-2",
        placeholder: "RO",
        maxLength: 2,
        uppercase: true,
        hint: "Two-letter ISO code shown on the map button.",
      },
      {
        key: "iso3",
        label: "ISO alpha-3",
        placeholder: "ROU",
        maxLength: 3,
        uppercase: true,
        hint: "Three-letter ISO code.",
      },
      {
        key: "atlasId",
        label: "ISO numeric / map ID",
        placeholder: "642",
        hint: "Numeric ISO code used to match the country shape on the map.",
      },
      {
        key: "cities",
        label: "Project locations",
        type: "nested",
        singular: "location",
        geocode: {
          queryKey: "name",
          longitudeKey: "longitude",
          latitudeKey: "latitude",
        },
        fields: [
          {
            key: "name",
            label: "Location name",
            placeholder: "Butimanu",
            hint: "City, village or full project address.",
          },
          {
            key: "longitude",
            label: "Longitude",
            type: "number",
            min: -180,
            max: 180,
            step: "any",
            placeholder: "25.897",
          },
          {
            key: "latitude",
            label: "Latitude",
            type: "number",
            min: -90,
            max: 90,
            step: "any",
            placeholder: "44.683",
          },
        ],
      },
    ],
  },
  quality: {
    key: "quality",
    path: ["qualityPoints", "items"],
    uploadCategory: "sections",
    heading: "Quality points",
    description: "Bullet list in the safety and quality block.",
    singular: "point",
    titleField: "text",
    fields: [{ key: "text", label: "Text" }],
  },
  reviews: {
    key: "reviews",
    path: ["testimonials", "items"],
    uploadCategory: "sections",
    heading: "Official source testimonials",
    description: "Source-backed testimonials maintained by the company. Browser reviews are moderated separately above.",
    singular: "testimonial",
    titleField: "author",
    fields: [
      { key: "author", label: "Author" },
      { key: "role", label: "Role" },
      { key: "quote", label: "Quote", type: "textarea", rows: 5 },
      { key: "image", label: "Image", type: "image" },
      { key: "imagePosition", label: "Image position", placeholder: "50% 50%" },
      { key: "source", label: "Source URL" },
    ],
  },
  "work-process": {
    key: "work-process",
    path: ["processCards", "items"],
    uploadCategory: "sections",
    heading: "Process cards",
    description: "Steps shown in the work process stack.",
    singular: "card",
    titleField: "title",
    fields: [
      { key: "number", label: "Number" },
      { key: "title", label: "Title" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "theme", label: "Theme", placeholder: "design | build | care" },
    ],
  },
};

const readPath = (content, path) => path.reduce((value, key) => value?.[key], content) ?? [];

const writePath = (content, path, value) => {
  const [head, ...rest] = path;
  return {
    ...content,
    [head]: rest.length === 0 ? value : writePath(content[head] ?? {}, rest, value),
  };
};

const sectionIcons = {
  "intro-hero": Sparkles,
  "company-overview": Building2,
  "company-video": Film,
  clients: UsersRound,
  "work-process": Workflow,
  projects: GalleryHorizontalEnd,
  credentials: BadgeCheck,
  "footprint-map": MapPinned,
  quality: ShieldCheck,
  reviews: MessageSquareQuote,
  "photovoltaic-service": Zap,
  "electrical-service": ClipboardCheck,
  "construction-service": HardHat,
  "data-center-service": ServerCog,
  faqs: MessageSquareQuote,
  careers: Briefcase,
  blog: Newspaper,
  contact: Mail,
  footer: PanelTop,
  "photo-gallery": Image,
};

function getSectionFromUrl(sections) {
  const requestedSection = new URLSearchParams(window.location.search).get("section");
  return sections.some((section) => section.id === requestedSection)
    ? requestedSection
    : sections[0]?.id ?? null;
}

function AppSidebar({ sections, selectedId, onSelect, onLogout }) {
  const [query, setQuery] = useState("");
  const { isMobile, setOpenMobile } = useSidebar();
  const normalizedQuery = query.trim().toLowerCase();

  const groupedSections = useMemo(() => {
    const groupNames = [...GROUP_ORDER];

    sections.forEach((section) => {
      const group = normalizeGroupName(section.group);
      if (!groupNames.includes(group)) groupNames.push(group);
    });

    return groupNames.map((group) => ({
      group,
      sections: sections.filter((section) => {
        if (normalizeGroupName(section.group) !== group) return false;
        if (!normalizedQuery) return true;

        const searchableText = `${section.name ?? ""} ${section.title ?? ""}`.toLowerCase();
        return searchableText.includes(normalizedQuery);
      }),
    })).filter((entry) => entry.sections.length > 0);
  }, [normalizedQuery, sections]);

  const selectSection = (sectionId) => {
    onSelect(sectionId);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className="admin-sidebar">
      <SidebarHeader className="admin-sidebar-header">
        <a className="admin-sidebar-brand" href="/" aria-label="Greentech Professionals home">
          <img src="/original/logo-alb.png.webp" alt="Greentech Professionals" />
          <span>Admin</span>
        </a>
        <div className="admin-sidebar-search">
          <Search aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sections"
            aria-label="Search website sections"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groupedSections.map(({ group, sections }) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sections.map((section) => {
                  const Icon = sectionIcons[section.id] ?? LayoutDashboard;

                  return (
                    <SidebarMenuItem key={section.id}>
                      <SidebarMenuButton
                        type="button"
                        isActive={selectedId === section.id}
                        tooltip={section.name}
                        onClick={() => selectSection(section.id)}
                      >
                        <Icon aria-hidden="true" />
                        <span>{section.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="admin-sidebar-footer">
        <Button variant="ghost" size="sm" onClick={onLogout}>
          <LogOut aria-hidden="true" />
          Sign out
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function SectionPreview({ section }) {
  const Icon = sectionIcons[section.id] ?? Image;

  return (
    <div className="admin-preview-frame">
      <div className="admin-preview-toolbar" aria-hidden="true">
        <span />
        <span />
        <span />
        <small>greentechpro.ro</small>
      </div>
      <div className={`admin-preview-scene admin-preview-${section.group.toLowerCase()}`}>
        <div className="admin-preview-copy">
          <span>{section.eyebrow}</span>
          <h2>{section.title}</h2>
          <p>{section.description}</p>
          {section.action && <strong>{section.action} <ArrowUpRight aria-hidden="true" /></strong>}
        </div>
        <Icon className="admin-preview-icon" aria-hidden="true" />
      </div>
    </div>
  );
}

function CompanyVideoEditor({ value, onChange, onNotify }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const videoUrl = value || "/video.mp4";

  const pickVideo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    try {
      const { url } = await uploadAsset(file, "video");
      onChange(url);
      onNotify({
        tone: "success",
        message: `${file.name} uploaded. Publish changes to make the new video live.`,
      });
    } catch (error) {
      onNotify({ tone: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-form-section" aria-labelledby="company-video-file-title">
      <div className="admin-form-heading">
        <div>
          <h2 id="company-video-file-title">Company video file</h2>
          <p>Upload the public video file and store only its URL in the content JSON.</p>
        </div>
        <Badge variant="secondary">MP4 / WebM</Badge>
      </div>

      <div className="admin-video-field" aria-busy={busy}>
        <div className="admin-video-preview">
          <video key={videoUrl} src={videoUrl} controls muted playsInline preload="metadata" />
        </div>

        <div className="admin-video-controls">
          <div className="admin-field">
            <Label htmlFor="company-video-url">Public video URL</Label>
            <Input
              id="company-video-url"
              value={value ?? ""}
              placeholder="/uploads/video/company-film.mp4"
              onChange={(event) => onChange(event.target.value)}
            />
            <small>Only this URL is saved in data/site-content.json. Maximum file size: 128 MB.</small>
          </div>

          <div className="admin-video-buttons">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? <Loader2 className="admin-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
              {busy ? "Uploading..." : value ? "Replace video" : "Upload video"}
            </Button>
            {videoUrl !== "/video.mp4" && (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => onChange("/video.mp4")}>
                <RotateCcw aria-hidden="true" />
                Use original video
              </Button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,.mp4,.webm"
            hidden
            onChange={pickVideo}
          />
        </div>
      </div>
    </section>
  );
}

function SectionEditor({
  section, index, dirty, onChange, onReset, onSave, saveState, children,
}) {
  const saving = saveState === "saving";
  const actionMode = ["builtin", "link", "modal"].includes(section.actionMode)
    ? section.actionMode
    : "builtin";
  const actionModal = section.actionModal && typeof section.actionModal === "object"
    ? section.actionModal
    : {};
  const modalField = (key, fallback = "") =>
    (typeof actionModal[key] === "string" ? actionModal[key] : fallback);
  const updateModalField = (key, value) =>
    onChange("actionModal", { ...actionModal, [key]: value });

  return (
    <div className="admin-editor" key={section.id}>
      <header className="admin-editor-heading">
        <div>
          <p className="admin-breadcrumb">Homepage <span>/</span> {section.group}</p>
          <div className="admin-title-line">
            <h1>{section.name}</h1>
            <Badge variant="outline">{String(index + 1).padStart(2, "0")}</Badge>
          </div>
          <p>Manage the content and visibility of this website section.</p>
        </div>
        <div className="admin-heading-actions">
          <Button variant="outline" asChild>
            <a href="/" target="_blank" rel="noreferrer">
              <Play aria-hidden="true" />
              Preview website
            </a>
          </Button>
          <Button onClick={onSave} disabled={saving || (!dirty && saveState !== "saved")}>
            {saving && <Loader2 className="admin-spin" aria-hidden="true" />}
            {!saving && saveState === "saved" && <Check aria-hidden="true" />}
            {!saving && saveState !== "saved" && <Save aria-hidden="true" />}
            {saving ? "Publishing…" : saveState === "saved" ? "Published" : "Publish changes"}
          </Button>
        </div>
      </header>

      <div className="admin-editor-grid">
        <div className="admin-editor-main">
          <section className="admin-form-section" aria-labelledby="content-fields-title">
            <div className="admin-form-heading">
              <div>
                <h2 id="content-fields-title">Section content</h2>
                <p>Primary text currently displayed on the homepage.</p>
              </div>
              <Badge className="admin-source-badge" variant="secondary">
                data/site-content.json
              </Badge>
            </div>

            <div className="admin-field-grid">
              <div className="admin-field admin-field-wide">
                <Label htmlFor={`${section.id}-eyebrow`}>Eyebrow</Label>
                <Input
                  id={`${section.id}-eyebrow`}
                  value={section.eyebrow}
                  onChange={(event) => onChange("eyebrow", event.target.value)}
                />
              </div>
              <div className="admin-field admin-field-wide">
                <Label htmlFor={`${section.id}-title`}>Heading</Label>
                <Input
                  id={`${section.id}-title`}
                  value={section.title}
                  onChange={(event) => onChange("title", event.target.value)}
                />
              </div>
              <div className="admin-field admin-field-wide">
                <Label htmlFor={`${section.id}-description`}>Description</Label>
                <Textarea
                  id={`${section.id}-description`}
                  value={section.description}
                  rows={5}
                  onChange={(event) => onChange("description", event.target.value)}
                />
                <small>{section.description.length} characters</small>
              </div>
              <div className="admin-field">
                <Label htmlFor={`${section.id}-action`}>Action label</Label>
                <Input
                  id={`${section.id}-action`}
                  value={section.action ?? ""}
                  placeholder="No action in this section"
                  onChange={(event) => onChange("action", event.target.value)}
                />
              </div>
              <div className="admin-field">
                <Label>Action behavior</Label>
                <div className="admin-action-modes" role="radiogroup" aria-label="Action behavior">
                  {[
                    ["builtin", "Built-in"],
                    ["link", "URL"],
                    ["modal", "Modal"],
                  ].map(([value, label]) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={actionMode === value}
                      className={actionMode === value ? "is-active" : ""}
                      key={value}
                      onClick={() => onChange("actionMode", value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {actionMode === "link" && (
                <div className="admin-field admin-field-wide">
                  <Label htmlFor={`${section.id}-action-url`}>Action link</Label>
                  <Input
                    id={`${section.id}-action-url`}
                    value={section.actionUrl ?? ""}
                    placeholder="/services or https://example.com"
                    inputMode="url"
                    autoComplete="url"
                    spellCheck={false}
                    onChange={(event) => onChange("actionUrl", event.target.value)}
                  />
                </div>
              )}

              {actionMode === "builtin" && (
                <p className="admin-action-note admin-field-wide">
                  Uses this section's existing interaction, such as opening a project, review form or email request.
                </p>
              )}

              {actionMode === "modal" && (
                <div className="admin-action-modal-fields admin-field-wide">
                  <div className="admin-field">
                    <Label htmlFor={`${section.id}-modal-eyebrow`}>Modal eyebrow</Label>
                    <Input
                      id={`${section.id}-modal-eyebrow`}
                      value={modalField("eyebrow", section.eyebrow ?? "")}
                      onChange={(event) => updateModalField("eyebrow", event.target.value)}
                    />
                  </div>
                  <div className="admin-field">
                    <Label htmlFor={`${section.id}-modal-title`}>Modal heading</Label>
                    <Input
                      id={`${section.id}-modal-title`}
                      value={modalField("title", section.title ?? "")}
                      onChange={(event) => updateModalField("title", event.target.value)}
                    />
                  </div>
                  <div className="admin-field admin-field-wide">
                    <Label htmlFor={`${section.id}-modal-description`}>Modal description</Label>
                    <Textarea
                      id={`${section.id}-modal-description`}
                      rows={6}
                      value={modalField("description", section.description ?? "")}
                      onChange={(event) => updateModalField("description", event.target.value)}
                    />
                  </div>
                  <div className="admin-field">
                    <Label htmlFor={`${section.id}-modal-cta-label`}>Modal CTA label</Label>
                    <Input
                      id={`${section.id}-modal-cta-label`}
                      value={modalField("ctaLabel")}
                      placeholder="Optional button"
                      onChange={(event) => updateModalField("ctaLabel", event.target.value)}
                    />
                  </div>
                  <div className="admin-field">
                    <Label htmlFor={`${section.id}-modal-cta-url`}>Modal CTA link</Label>
                    <Input
                      id={`${section.id}-modal-cta-url`}
                      value={modalField("ctaUrl")}
                      placeholder="/contact or https://example.com"
                      inputMode="url"
                      autoComplete="url"
                      spellCheck={false}
                      onChange={(event) => updateModalField("ctaUrl", event.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          <Separator />

          <section className="admin-form-section" aria-labelledby="section-settings-title">
            <div className="admin-form-heading">
              <div>
                <h2 id="section-settings-title">Section settings</h2>
                <p>Display state and implementation information.</p>
              </div>
            </div>

            <div className="admin-setting-row">
              <div>
                <Label htmlFor={`${section.id}-visible`}>Visible on homepage</Label>
                <p>Turn this section on or off after database publishing is connected.</p>
              </div>
              <Switch
                id={`${section.id}-visible`}
                checked={section.visible}
                onCheckedChange={(checked) => onChange("visible", checked)}
              />
            </div>

            <div className="admin-spec-list">
              <div>
                <span><CircleDot aria-hidden="true" /> Format</span>
                <strong>{section.format}</strong>
              </div>
              <div>
                <span><Image aria-hidden="true" /> Content</span>
                <strong>{section.summary}</strong>
              </div>
              <div>
                <span><Database aria-hidden="true" /> Current source</span>
                <strong>{section.source}</strong>
              </div>
            </div>
          </section>

          {children}

          <div className="admin-form-footer">
            <Button variant="ghost" onClick={onReset} disabled={!dirty || saving}>
              <RotateCcw aria-hidden="true" />
              Reset changes
            </Button>
            <span>{dirty ? "Unpublished changes" : "Published and live"}</span>
          </div>
        </div>

        <aside className="admin-editor-aside" aria-label="Section preview">
          <div className="admin-aside-heading">
            <div>
              <h2>Live draft</h2>
              <p>Responsive content preview</p>
            </div>
            <Badge variant={section.visible ? "default" : "secondary"}>
              {section.visible ? "Visible" : "Hidden"}
            </Badge>
          </div>
          <SectionPreview section={section} />
          <div className="admin-preview-note">
            <Globe2 aria-hidden="true" />
            <p>
              <strong>Database ready</strong>
              <span>The editor state is structured for the API connection we add next.</span>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function LoginScreen({ onAuthenticated }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      await requestLogin(password);
      onAuthenticated();
    } catch (loginError) {
      setError(loginError.message);
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={submit}>
        <img src="/original/logo-alb.png.webp" alt="Greentech Professionals" />
        <div className="admin-field">
          <Label htmlFor="admin-password">Password</Label>
          <Input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            autoFocus
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error && <p className="admin-login-error" role="alert">{error}</p>}

        <Button type="submit" disabled={busy || password.length === 0}>
          {busy && <Loader2 className="admin-spin" aria-hidden="true" />}
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}

function Toast({ notice, onDismiss }) {
  useEffect(() => {
    if (!notice || notice.tone === "error") return undefined;
    const timer = window.setTimeout(onDismiss, 3200);
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss]);

  if (!notice) return null;

  return (
    <div className={`admin-toast admin-toast-${notice.tone}`} role="status" aria-live="polite">
      <span>{notice.message}</span>
      {notice.issues?.length > 0 && (
        <ul>{notice.issues.slice(0, 4).map((issue) => <li key={issue}>{issue}</li>)}</ul>
      )}
      <button type="button" onClick={onDismiss} aria-label="Dismiss message">
        <X aria-hidden="true" />
      </button>
    </div>
  );
}

function AdminApp() {
  const [authenticated, setAuthenticated] = useState(null);
  const [content, setContent] = useState(null);
  const [published, setPublished] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    getSession()
      .then((session) => setAuthenticated(session.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  const loadContent = useCallback(() => {
    getContent()
      .then((loaded) => {
        setContent(loaded);
        setPublished(loaded);
        setSelectedId((current) => current ?? getSectionFromUrl(loaded.sections ?? []));
      })
      .catch((error) => setNotice({ tone: "error", message: error.message }));
  }, []);

  useEffect(() => {
    if (authenticated) loadContent();
  }, [authenticated, loadContent]);

  useEffect(() => {
    if (!content) return undefined;
    const handlePopState = () => setSelectedId(getSectionFromUrl(content.sections ?? []));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [content]);

  // Guard against losing edits to a stray tab close or refresh.
  const dirty = content !== null && JSON.stringify(content) !== JSON.stringify(published);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (authenticated === null) {
    return (
      <div className="admin-booting">
        <Loader2 className="admin-spin" aria-hidden="true" />
        <span>Loading admin…</span>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginScreen onAuthenticated={() => setAuthenticated(true)} />;
  }

  if (!content) {
    return (
      <div className="admin-booting">
        <Loader2 className="admin-spin" aria-hidden="true" />
        <span>Loading content…</span>
      </div>
    );
  }

  const sections = content.sections ?? [];

  const selectSection = (sectionId) => {
    if (sectionId === selectedId) return;
    const url = new URL(window.location.href);
    url.searchParams.set("section", sectionId);
    window.history.pushState({}, "", `${url.pathname}${url.search}`);
    setSelectedId(sectionId);
    setSaveState("idle");
  };

  const selectedIndex = sections.findIndex((section) => section.id === selectedId);
  const selectedSection = sections[selectedIndex] ?? sections[0];
  const collection = COLLECTIONS[selectedSection?.id];
  const projectOptions = [
    { value: "", label: "No related project" },
    ...[...(content.horizontalGallery?.items ?? [])]
      .filter((project) => typeof project?.id === "string" && project.id.trim())
      .sort((first, second) => (first.order ?? 0) - (second.order ?? 0))
      .map((project) => ({
        value: project.id,
        label: [
          project.title || "Untitled project",
          project.location,
          project.enabled === false ? "hidden" : "",
        ].filter(Boolean).join(" - "),
      })),
  ];

  const updateField = (field, value) => {
    setContent((currentContent) => ({
      ...currentContent,
      sections: currentContent.sections.map((section) =>
        (section.id === selectedSection.id ? { ...section, [field]: value } : section)),
    }));
    setSaveState("idle");
  };

  const updateMeta = (key, value) => {
    setContent((currentContent) => ({
      ...currentContent,
      footer: { ...(currentContent.footer ?? {}), [key]: value },
    }));
    setSaveState("idle");
  };

  const updateCollection = (items) => {
    setContent((currentContent) => writePath(currentContent, collection.path, items));
    setSaveState("idle");
  };

  const resetSection = () => {
    setContent(published);
    setSaveState("idle");
  };

  const publish = async () => {
    if (saveState === "saving") return;

    setSaveState("saving");
    try {
      const { content: saved } = await saveContent(content);
      setContent(saved);
      setPublished(saved);
      setSaveState("saved");
      setNotice({ tone: "success", message: "Changes published to the website." });
      window.setTimeout(() => setSaveState("idle"), 1800);
    } catch (error) {
      setSaveState("idle");
      // The form keeps its edits so nothing is lost on a rejected save.
      setNotice({ tone: "error", message: error.message, issues: error.issues });
    }
  };

  const signOut = async () => {
    if (dirty && !window.confirm("You have unpublished changes. Sign out anyway?")) return;
    await requestLogout().catch(() => {});
    setAuthenticated(false);
    setContent(null);
    setPublished(null);
  };

  return (
    <SidebarProvider
      defaultOpen
      style={{
        "--sidebar-width": "17.5rem",
        "--sidebar-width-mobile": "19rem",
      }}
    >
      <AppSidebar
        sections={sections}
        selectedId={selectedSection?.id}
        onSelect={selectSection}
        onLogout={signOut}
      />
      <SidebarInset className="admin-shell">
        <header className="admin-topbar">
          <div className="admin-topbar-start">
            <SidebarTrigger aria-label="Toggle section navigation" />
            <Separator orientation="vertical" />
            <span>Website sections</span>
          </div>
          <div className="admin-topbar-end">
            <span className="admin-server-status">
              <i aria-hidden="true" />
              {dirty ? "Unpublished changes" : "All changes published"}
            </span>
            <Button variant="ghost" size="sm" asChild>
              <a href="/" target="_blank" rel="noreferrer">
                View website
                <ArrowUpRight aria-hidden="true" />
              </a>
            </Button>
          </div>
        </header>

        <SectionEditor
          section={selectedSection}
          index={selectedIndex}
          dirty={dirty}
          onChange={updateField}
          onReset={resetSection}
          onSave={publish}
          saveState={saveState}
        >
          {selectedSection?.id === "company-video" && (
            <>
              <Separator />
              <CompanyVideoEditor
                value={selectedSection.videoUrl ?? ""}
                onChange={(value) => updateField("videoUrl", value)}
                onNotify={setNotice}
              />
            </>
          )}
          {selectedSection?.id === "reviews" && (
            <>
              <Separator />
              <ReviewModeration onNotify={setNotice} />
            </>
          )}
          {selectedSection?.id === "contact" && (
            <>
              <Separator />
              <InquiryInbox onNotify={setNotice} />
            </>
          )}
          {selectedSection?.id === "careers" && (
            <>
              <Separator />
              <ApplicationInbox onNotify={setNotice} />
            </>
          )}
          {collection?.metaFields && (
            <>
              <Separator />
              <section className="admin-form-section" aria-labelledby="footer-meta-title">
                <div className="admin-form-heading">
                  <div>
                    <h2 id="footer-meta-title">{collection.metaHeading}</h2>
                    <p>{collection.metaDescription}</p>
                  </div>
                </div>

                <div className="admin-field-grid">
                  {collection.metaFields.map((field) => (
                    <div className="admin-field admin-field-wide" key={field.key}>
                      <Label htmlFor={`footer-${field.key}`}>{field.label}</Label>
                      {field.type === "textarea" ? (
                        <Textarea
                          id={`footer-${field.key}`}
                          rows={field.rows ?? 3}
                          value={content.footer?.[field.key] ?? ""}
                          onChange={(event) => updateMeta(field.key, event.target.value)}
                        />
                      ) : (
                        <Input
                          id={`footer-${field.key}`}
                          value={content.footer?.[field.key] ?? ""}
                          placeholder={field.placeholder}
                          onChange={(event) => updateMeta(field.key, event.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {collection && (
            <>
              <Separator />
              <CollectionEditor
                collection={collection}
                items={readPath(content, collection.path)}
                optionSources={{ projects: projectOptions }}
                onItemsChange={updateCollection}
                onNotify={setNotice}
              />
            </>
          )}
        </SectionEditor>

        <Toast notice={notice} onDismiss={() => setNotice(null)} />
      </SidebarInset>
    </SidebarProvider>
  );
}

createRoot(document.getElementById("admin-root")).render(<AdminApp />);
