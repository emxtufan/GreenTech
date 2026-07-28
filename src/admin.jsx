import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  BadgeCheck,
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
import {
  getSession,
  login as requestLogin,
  logout as requestLogout,
  getContent,
  saveContent,
} from "@/lib/adminApi.js";
import "./admin.css";

const GROUP_ORDER = ["Experience", "Company", "Services", "Content"];

// Sidebar sections that also own a repeatable collection in the content file.
const COLLECTIONS = {
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
          { key: "src", label: "Image", type: "image" },
          { key: "alt", label: "Alt text" },
        ],
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
      { key: "category", label: "Category" },
      { key: "dateLabel", label: "Date label" },
      { key: "readTime", label: "Read time" },
      { key: "image", label: "Cover image", type: "image" },
      { key: "alt", label: "Cover alt text" },
      { key: "excerpt", label: "Excerpt", type: "textarea" },
      { key: "intro", label: "Intro", type: "textarea", rows: 6 },
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
    heading: "Testimonials",
    description: "Customer reviews shown in the carousel.",
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
  blog: Newspaper,
  contact: Mail,
  footer: PanelTop,
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

  const groupedSections = useMemo(() => GROUP_ORDER.map((group) => ({
    group,
    sections: sections.filter((section) => (
      section.group === group
      && (!normalizedQuery
        || section.name.toLowerCase().includes(normalizedQuery)
        || section.title.toLowerCase().includes(normalizedQuery))
    )),
  })).filter((entry) => entry.sections.length > 0), [normalizedQuery, sections]);

  const selectSection = (sectionId) => {
    onSelect(sectionId);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className="admin-sidebar">
      <SidebarHeader className="admin-sidebar-header">
        <a className="admin-sidebar-brand" href="/" aria-label="GreenTech Professionals home">
          <img src="/original/logo-alb.png.webp" alt="GreenTech Professionals" />
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
        <div className="admin-sidebar-system">
          <span className="admin-system-dot" aria-hidden="true" />
          <span>
            <strong>Website online</strong>
            <small>{sections.length} sections indexed</small>
          </span>
        </div>
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

function SectionEditor({
  section, index, dirty, onChange, onReset, onSave, saveState, children,
}) {
  const saving = saveState === "saving";
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
              <div className="admin-field admin-field-wide">
                <Label htmlFor={`${section.id}-action`}>Action label</Label>
                <Input
                  id={`${section.id}-action`}
                  value={section.action}
                  placeholder="No action in this section"
                  onChange={(event) => onChange("action", event.target.value)}
                />
              </div>
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
        <img src="/original/logo-alb.png.webp" alt="GreenTech Professionals" />
        <h1>Content admin</h1>
        <p>Sign in to edit the website content.</p>

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

  const updateField = (field, value) => {
    setContent((currentContent) => ({
      ...currentContent,
      sections: currentContent.sections.map((section) =>
        (section.id === selectedSection.id ? { ...section, [field]: value } : section)),
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
          {collection && (
            <>
              <Separator />
              <CollectionEditor
                collection={collection}
                items={readPath(content, collection.path)}
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
