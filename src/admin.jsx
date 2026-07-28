import React, { useEffect, useMemo, useState } from "react";
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
import sectionsData from "./data/admin-sections.json";
import "./admin.css";

const STORAGE_KEY = "greentech-admin-section-drafts";
const GROUP_ORDER = ["Experience", "Company", "Services", "Content"];

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

function loadSavedDrafts() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function createDrafts() {
  const savedDrafts = loadSavedDrafts();

  return Object.fromEntries(
    sectionsData.map((section) => [
      section.id,
      { ...section, ...savedDrafts[section.id] },
    ]),
  );
}

function getSectionFromUrl() {
  const requestedSection = new URLSearchParams(window.location.search).get("section");
  return sectionsData.some((section) => section.id === requestedSection)
    ? requestedSection
    : sectionsData[0].id;
}

function AppSidebar({ selectedId, onSelect }) {
  const [query, setQuery] = useState("");
  const { isMobile, setOpenMobile } = useSidebar();
  const normalizedQuery = query.trim().toLowerCase();

  const groupedSections = useMemo(() => GROUP_ORDER.map((group) => ({
    group,
    sections: sectionsData.filter((section) => (
      section.group === group
      && (!normalizedQuery
        || section.name.toLowerCase().includes(normalizedQuery)
        || section.title.toLowerCase().includes(normalizedQuery))
    )),
  })).filter(({ sections }) => sections.length > 0), [normalizedQuery]);

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
            <small>{sectionsData.length} sections indexed</small>
          </span>
        </div>
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

function SectionEditor({ section, index, dirty, onChange, onReset, onSave, saveState }) {
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
          <Button onClick={onSave} disabled={!dirty && saveState !== "saved"}>
            {saveState === "saved" ? <Check aria-hidden="true" /> : <Save aria-hidden="true" />}
            {saveState === "saved" ? "Draft saved" : "Save draft"}
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
              <Badge className="admin-source-badge" variant="secondary">Local draft</Badge>
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

          <div className="admin-form-footer">
            <Button variant="ghost" onClick={onReset} disabled={!dirty}>
              <RotateCcw aria-hidden="true" />
              Reset changes
            </Button>
            <span>{dirty ? "Unsaved local changes" : "Draft is up to date"}</span>
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

function AdminApp() {
  const [selectedId, setSelectedId] = useState(getSectionFromUrl);
  const [drafts, setDrafts] = useState(createDrafts);
  const [savedDrafts, setSavedDrafts] = useState(createDrafts);
  const [saveState, setSaveState] = useState("idle");

  useEffect(() => {
    const handlePopState = () => setSelectedId(getSectionFromUrl());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const selectSection = (sectionId) => {
    if (sectionId === selectedId) return;
    const url = new URL(window.location.href);
    url.searchParams.set("section", sectionId);
    window.history.pushState({}, "", `${url.pathname}${url.search}`);
    setSelectedId(sectionId);
    setSaveState("idle");
  };

  const selectedIndex = sectionsData.findIndex((section) => section.id === selectedId);
  const selectedSection = drafts[selectedId] ?? drafts[sectionsData[0].id];
  const savedSection = savedDrafts[selectedId] ?? savedDrafts[sectionsData[0].id];
  const dirty = JSON.stringify(selectedSection) !== JSON.stringify(savedSection);

  const updateField = (field, value) => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [selectedId]: {
        ...currentDrafts[selectedId],
        [field]: value,
      },
    }));
    setSaveState("idle");
  };

  const resetSection = () => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [selectedId]: { ...savedSection },
    }));
    setSaveState("idle");
  };

  const saveSection = () => {
    const nextSavedDrafts = {
      ...savedDrafts,
      [selectedId]: { ...selectedSection },
    };
    setSavedDrafts(nextSavedDrafts);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSavedDrafts));
    setSaveState("saved");
    window.setTimeout(() => setSaveState("idle"), 1600);
  };

  return (
    <SidebarProvider
      defaultOpen
      style={{
        "--sidebar-width": "17.5rem",
        "--sidebar-width-mobile": "19rem",
      }}
    >
      <AppSidebar selectedId={selectedId} onSelect={selectSection} />
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
              Server ready
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
          onSave={saveSection}
          saveState={saveState}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}

createRoot(document.getElementById("admin-root")).render(<AdminApp />);
