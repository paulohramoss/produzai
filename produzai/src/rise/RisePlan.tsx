import { useState, useEffect, useCallback } from "react";
import { LayoutDashboard, Sun, Dumbbell, Brain, Bot, Menu } from "lucide-react";
import { T, C, NAV_GROUPS, type Page } from "./data";
import { Dashboard }    from "./pages/Dashboard";
import { Treino }       from "./pages/Treino";
import { Dieta }        from "./pages/Dieta";
import { Hoje }         from "./pages/Hoje";
import { Historico }    from "./pages/Historico";
import { Agenda }       from "./pages/Agenda";
import { Projetos }     from "./pages/Projetos";
import { Mental }       from "./pages/Mental";
import { Biblioteca }   from "./pages/Biblioteca";
import { Coach }        from "./pages/Coach";
import { Galeria }      from "./pages/Galeria";
import { Perfil }       from "./pages/Perfil";
import { Insights }     from "./pages/Insights";
import { Onboarding }   from "./pages/Onboarding";
import { Avatar }       from "./primitives";
import { ConsentModal } from "./components/ConsentModal";
import { Toaster }      from "./components/Toaster";
import { useAuthStore } from "../store/useAuthStore";
import { LayoutContext } from "./LayoutContext";
import { toast } from "../lib/toast";

const STRAVA_REDIRECT_MESSAGES: Record<string, { type: "success" | "error" | "info"; text: string }> = {
  connected:     { type: "success", text: "🏃 Strava conectado com sucesso!" },
  denied:        { type: "info",    text: "Conexão com o Strava cancelada" },
  missing_scope: { type: "error",   text: "Autorize o acesso às atividades para conectar o Strava" },
  invalid_state: { type: "error",   text: "Sessão do Strava expirou, tente novamente" },
  error:         { type: "error",   text: "Erro ao conectar com o Strava" },
};

const RISE_IMPLEMENTED: Page[] = [
  "dashboard", "hoje", "historico", "treino", "dieta", "agenda",
  "projetos", "mental", "biblioteca", "coach", "galeria", "perfil", "insights",
];

// Bottom navigation for mobile — 4 key pages + hamburger
const BOTTOM_NAV = [
  { id: "dashboard" as Page, icon: LayoutDashboard, label: "Início" },
  { id: "hoje"      as Page, icon: Sun,             label: "Hoje"  },
  { id: "treino"   as Page, icon: Dumbbell,         label: "Treino" },
  { id: "mental"   as Page, icon: Brain,            label: "Mental" },
  { id: "coach"    as Page, icon: Bot,              label: "Coach"  },
];

const SIDEBAR_FULL = 210;
const SIDEBAR_ICON = 62;

export function RisePlan() {
  const { user, displayName, photoURL, logout, onboardingDone, consentAccepted } = useAuthStore();
  const [page, setPage]         = useState<Page>(() => (
    new URLSearchParams(window.location.search).get("strava") ? "perfil" : "dashboard"
  ));
  const [menuOpen, setMenuOpen] = useState(false);
  const [windowW, setWindowW]   = useState(window.innerWidth);

  useEffect(() => {
    const handler = () => setWindowW(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("strava");
    if (!status) return;
    const msg = STRAVA_REDIRECT_MESSAGES[status];
    if (msg) toast[msg.type](msg.text);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const isMobile = windowW < 768;
  const isTablet = windowW >= 768 && windowW < 1024;

  const navigate = useCallback((id: Page) => {
    setPage(id);
    if (isMobile) setMenuOpen(false);
  }, [isMobile]);

  if (!consentAccepted) {
    return (
      <>
        <ConsentModal />
        <Toaster />
      </>
    );
  }

  if (!onboardingDone) {
    return (
      <>
        <Onboarding />
        <Toaster />
      </>
    );
  }

  const sidebarW = isTablet ? SIDEBAR_ICON : SIDEBAR_FULL;
  const avatarInitial = (displayName || user?.displayName || user?.email || "U")[0].toUpperCase();

  return (
    <LayoutContext.Provider value={{ isMobile, isTablet, menuOpen, setMenuOpen }}>
      <div style={{
        display: "flex",
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: "system-ui,sans-serif",
        fontSize: T.text.lg,
        position: "relative",
      }}>

        {/* Overlay — closes sidebar on mobile */}
        {isMobile && menuOpen && (
          <div
            role="button"
            aria-label="Fechar menu"
            tabIndex={0}
            onClick={() => setMenuOpen(false)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setMenuOpen(false) }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", zIndex: 40 }}
          />
        )}

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <aside style={{
          width: sidebarW,
          background: "#0A0A0A",
          borderRight: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
          padding: "20px 0",
          flexShrink: 0,
          overflowY: "auto",
          overflowX: "hidden",
          // Mobile: fixed sliding drawer; tablet/desktop: static in flow
          ...(isMobile ? {
            position: "fixed" as const,
            top: 0,
            left: 0,
            height: "100vh",
            width: SIDEBAR_FULL,
            zIndex: 50,
            transform: menuOpen ? "translateX(0)" : `translateX(-${SIDEBAR_FULL}px)`,
            transition: "transform 0.25s ease",
          } : {}),
        }}>
          {/* Logo — hide on tablet (too narrow) */}
          {!isTablet && (
            <div style={{ padding: "0 10px 20px" }}>
              <img
                src="/rise-plan-logo.svg"
                alt="The Rise Plan"
                style={{ width: "100%", height: "auto", display: "block", borderRadius: T.radius.md }}
              />
            </div>
          )}
          {isTablet && (
            <div style={{ display: "flex", justifyContent: "center", paddingBottom: 16 }}>
              <img src="/rise-plan-logo.svg" alt="Rise" style={{ width: 36, height: 36, borderRadius: T.radius.sm, objectFit: "cover" }} />
            </div>
          )}

          <nav style={{ flex: 1 }}>
            {NAV_GROUPS.map((g, gi) => (
              <div key={gi} style={{ marginBottom: 6 }}>
                {/* Group label — only on full sidebar */}
                {!isTablet && (
                  <div style={{
                    fontSize: T.text['2xs'], color: C.muted, fontWeight: T.weight.bold,
                    letterSpacing: 1.2, padding: "6px 18px 4px",
                    textTransform: "uppercase",
                  }}>
                    {g.label}
                  </div>
                )}
                {g.items.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(item.id)}
                    title={isTablet ? item.label : undefined}
                    aria-label={item.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: isTablet ? "center" : "flex-start",
                      gap: 10,
                      width: "100%",
                      padding: isTablet ? "11px 0" : "9px 18px",
                      cursor: "pointer",
                      background: page === item.id ? "#1A1A1A" : "transparent",
                      borderLeft: !isTablet && page === item.id
                        ? `2px solid ${item.color || C.orange}`
                        : "2px solid transparent",
                      borderRight: "none",
                      borderTop: "none",
                      borderBottom: "none",
                      color: page === item.id ? C.text : C.muted,
                      transition: "all .12s",
                    }}
                  >
                    <item.icon size={isTablet ? 18 : 15} color={page === item.id ? (item.color || C.orange) : undefined} />
                    {!isTablet && (
                      <span style={{ fontSize: T.text.md, fontWeight: page === item.id ? 600 : 400 }}>
                        {item.label}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* User + logout */}
          <div style={{ padding: isTablet ? "12px 0" : "12px 18px", borderTop: `1px solid ${C.border}` }}>
            {isTablet ? (
              /* Icon-only: just the avatar */
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => navigate("perfil")}
                  aria-label="Ir para perfil"
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                >
                  <Avatar url={photoURL} initial={avatarInitial} />
                </button>
                <button
                  onClick={logout}
                  title="Sair"
                  style={{
                    background: "transparent", border: `1px solid ${C.border2}`,
                    borderRadius: T.radius.sm, padding: "6px", color: C.muted,
                    fontSize: T.text.lg, cursor: "pointer", lineHeight: 1,
                  }}
                >
                  ⏏
                </button>
              </div>
            ) : (
              /* Full sidebar: name + email + logout */
              <>
                <button
                  onClick={() => navigate("perfil")}
                  aria-label="Ir para perfil"
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    marginBottom: 10, cursor: "pointer",
                    background: "none", border: "none", padding: "4px 0",
                    borderRadius: T.radius.sm, width: "100%", textAlign: "left",
                  }}
                >
                  <Avatar url={photoURL} initial={avatarInitial} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: T.text.base, fontWeight: T.weight.bold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {displayName || user?.displayName || "Usuário"}
                    </div>
                    <div style={{ fontSize: T.text.xs, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user?.email}
                    </div>
                  </div>
                  <span style={{ fontSize: T.text.xs, color: C.muted }}>⚙</span>
                </button>
                <button
                  onClick={logout}
                  style={{
                    width: "100%", padding: "7px 10px", borderRadius: T.radius.sm,
                    background: "transparent", border: `1px solid ${C.border2}`,
                    color: C.muted, fontSize: T.text.sm, cursor: "pointer", fontWeight: T.weight.semibold,
                    transition: "color 0.12s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.red)}
                  onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                >
                  Sair da conta
                </button>
              </>
            )}
          </div>
        </aside>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <main style={{
          flex: 1,
          overflowY: "auto",
          minWidth: 0,
          paddingTop:    isMobile ? 0   : isTablet ? 24 : 28,
          paddingLeft:   isMobile ? 16  : isTablet ? 20 : 28,
          paddingRight:  isMobile ? 16  : isTablet ? 20 : 28,
          paddingBottom: isMobile ? 80  : isTablet ? 24 : 28,
        }}>
          {/* Top bar — mobile only */}
          {isMobile && (
            <div style={{
              position: "sticky",
              top: 0,
              zIndex: 30,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 0 14px",
              marginBottom: 8,
              background: C.bg,
              borderBottom: `1px solid ${C.border}`,
            }}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Abrir menu"
                style={{
                  background: C.card2, border: `1px solid ${C.border}`,
                  borderRadius: T.radius.sm, padding: "7px 11px",
                  color: C.text, cursor: "pointer",
                  fontSize: T.text['3xl'], lineHeight: 1, flexShrink: 0,
                }}
              >
                ☰
              </button>
              <img src="/rise-plan-logo.svg" alt="The Rise Plan" style={{ height: 28, borderRadius: T.radius.xs }} />
              <button
                onClick={() => navigate("perfil")}
                aria-label="Ir para perfil"
                style={{ marginLeft: "auto", background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" }}
              >
                <Avatar url={photoURL} initial={avatarInitial} />
              </button>
            </div>
          )}

          {page === "dashboard"  && <Dashboard   setPage={navigate} />}
          {page === "hoje"       && <Hoje        setPage={navigate} />}
          {page === "historico"  && <Historico   setPage={navigate} />}
          {page === "treino"     && <Treino      setPage={navigate} />}
          {page === "dieta"      && <Dieta       setPage={navigate} />}
          {page === "agenda"     && <Agenda      setPage={navigate} />}
          {page === "projetos"   && <Projetos    setPage={navigate} />}
          {page === "mental"     && <Mental      setPage={navigate} />}
          {page === "biblioteca" && <Biblioteca  setPage={navigate} />}
          {page === "coach"      && <Coach       setPage={navigate} />}
          {page === "galeria"    && <Galeria     setPage={navigate} />}
          {page === "perfil"     && <Perfil      setPage={navigate} />}
          {page === "insights"   && <Insights    setPage={navigate} />}

          {!RISE_IMPLEMENTED.includes(page) && (
            <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
              <div style={{ fontWeight: T.weight.semibold, fontSize: T.text['2xl'], marginBottom: 8 }}>Tela em construção</div>
              <div style={{ fontSize: T.text.md }}>Esta seção será implementada em breve.</div>
            </div>
          )}
        </main>

        {/* ── Bottom navigation (mobile only) ───────────────────────────── */}
        {isMobile && (
          <nav
            aria-label="Navegação principal"
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              height: 64,
              background: "#0A0A0A",
              borderTop: `1px solid ${C.border}`,
              display: "flex",
              alignItems: "stretch",
              zIndex: 35,
              // iOS safe area
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            {BOTTOM_NAV.map(({ id, icon: Icon, label }) => {
              const active = page === id
              return (
                <button
                  key={id}
                  onClick={() => navigate(id)}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: active ? C.orange : C.muted,
                    transition: "color .12s",
                    padding: "8px 0",
                  }}
                >
                  <Icon size={20} />
                  <span style={{ fontSize: T.text['2xs'], fontWeight: active ? 700 : 500, letterSpacing: 0.3 }}>
                    {label}
                  </span>
                </button>
              )
            })}
            {/* "Mais" button — opens sidebar drawer */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Mais páginas"
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: menuOpen ? C.orange : C.muted,
                transition: "color .12s",
                padding: "8px 0",
              }}
            >
              <Menu size={20} />
              <span style={{ fontSize: T.text['2xs'], fontWeight: T.weight.medium, letterSpacing: 0.3 }}>Mais</span>
            </button>
          </nav>
        )}

        <Toaster />
      </div>
    </LayoutContext.Provider>
  );
}
