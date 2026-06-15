import { useState, useEffect, useCallback } from "react";
import { C, NAV_GROUPS, type Page } from "./data";
import { Dashboard }    from "./pages/Dashboard";
import { Treino }       from "./pages/Treino";
import { Dieta }        from "./pages/Dieta";
import { Hoje }         from "./pages/Hoje";
import { Agenda }       from "./pages/Agenda";
import { Projetos }     from "./pages/Projetos";
import { Mental }       from "./pages/Mental";
import { Biblioteca }   from "./pages/Biblioteca";
import { Coach }        from "./pages/Coach";
import { Galeria }      from "./pages/Galeria";
import { Perfil }       from "./pages/Perfil";
import { Insights }     from "./pages/Insights";
import { Onboarding }   from "./pages/Onboarding";
import { Toaster }      from "./components/Toaster";
import { useAuthStore } from "../store/useAuthStore";
import { LayoutContext } from "./LayoutContext";

const RISE_IMPLEMENTED: Page[] = [
  "dashboard", "hoje", "treino", "dieta", "agenda",
  "projetos", "mental", "biblioteca", "coach", "galeria", "perfil", "insights",
];

const SIDEBAR_W = 210;

export function RisePlan() {
  const { user, displayName, photoURL, logout, onboardingDone } = useAuthStore();
  const [page, setPage]       = useState<Page>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [windowW, setWindowW] = useState(window.innerWidth);

  useEffect(() => {
    const handler = () => setWindowW(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const isMobile = windowW < 768;

  const navigate = useCallback((id: Page) => {
    setPage(id);
    if (isMobile) setMenuOpen(false);
  }, [isMobile]);

  if (!onboardingDone) {
    return (
      <>
        <Onboarding />
        <Toaster />
      </>
    );
  }

  return (
    <LayoutContext.Provider value={{ isMobile, menuOpen, setMenuOpen }}>
      <div style={{
        display: "flex",
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: "system-ui,sans-serif",
        fontSize: 14,
        position: "relative",
      }}>

        {/* Overlay mobile */}
        {isMobile && menuOpen && (
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", zIndex: 40 }}
          />
        )}

        {/* Sidebar */}
        <div style={{
          width: SIDEBAR_W,
          background: "#0A0A0A",
          borderRight: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
          padding: "20px 0",
          flexShrink: 0,
          overflowY: "auto",
          ...(isMobile ? {
            position: "fixed" as const,
            top: 0,
            left: 0,
            height: "100vh",
            zIndex: 50,
            transform: menuOpen ? "translateX(0)" : `translateX(-${SIDEBAR_W}px)`,
            transition: "transform 0.25s ease",
          } : {}),
        }}>
          <div style={{ padding: "0 10px 20px" }}>
            <img
              src="/rise-plan-logo.svg"
              alt="The Rise Plan"
              style={{ width: "100%", height: "auto", display: "block", borderRadius: 10 }}
            />
          </div>

          <nav style={{ flex: 1 }}>
            {NAV_GROUPS.map((g, gi) => (
              <div key={gi} style={{ marginBottom: 6 }}>
                <div style={{
                  fontSize: 9, color: C.muted, fontWeight: 700,
                  letterSpacing: 1.2, padding: "6px 18px 4px",
                  textTransform: "uppercase",
                }}>
                  {g.label}
                </div>
                {g.items.map((item, i) => (
                  <div
                    key={i}
                    onClick={() => navigate(item.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 18px", cursor: "pointer",
                      background: page === item.id ? "#1A1A1A" : "transparent",
                      borderLeft: page === item.id
                        ? `2px solid ${item.color || C.orange}`
                        : "2px solid transparent",
                      color: page === item.id ? C.text : C.muted,
                      transition: "all .12s",
                    }}
                  >
                    <span style={{ fontSize: 15 }}>{item.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: page === item.id ? 600 : 400 }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </nav>

          {/* User + logout */}
          <div style={{ padding: "12px 18px", borderTop: `1px solid ${C.border}` }}>
            <div
              onClick={() => navigate("perfil")}
              style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer", borderRadius: 8, padding: "4px 0" }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: C.orange, overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 800, color: "#000", flexShrink: 0,
              }}>
                {photoURL
                  ? <img src={photoURL} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : (displayName || user?.displayName || user?.email || "U")[0].toUpperCase()
                }
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {displayName || user?.displayName || "Usuário"}
                </div>
                <div style={{ fontSize: 10, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user?.email}
                </div>
              </div>
              <span style={{ fontSize: 10, color: C.muted }}>⚙</span>
            </div>
            <button
              onClick={logout}
              style={{
                width: "100%", padding: "7px 10px", borderRadius: 8,
                background: "transparent", border: `1px solid ${C.border2}`,
                color: C.muted, fontSize: 11, cursor: "pointer", fontWeight: 600,
                transition: "color 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = C.red)}
              onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
            >
              Sair da conta
            </button>
          </div>
        </div>

        {/* Main content */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: isMobile ? "16px" : 28,
        }}>
          {/* Top bar mobile */}
          {isMobile && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              marginBottom: 16, paddingBottom: 14,
              borderBottom: `1px solid ${C.border}`,
            }}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                style={{
                  background: C.card2, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: "7px 11px",
                  color: C.text, cursor: "pointer",
                  fontSize: 18, lineHeight: 1, flexShrink: 0,
                }}
              >
                ☰
              </button>
              <img src="/rise-plan-logo.svg" alt="The Rise Plan" style={{ height: 28, borderRadius: 6 }} />
              <div style={{ marginLeft: "auto" }} onClick={() => navigate("perfil")}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: C.orange, overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 800, color: "#000", cursor: "pointer",
                }}>
                  {photoURL
                    ? <img src={photoURL} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : (displayName || user?.displayName || user?.email || "U")[0].toUpperCase()
                  }
                </div>
              </div>
            </div>
          )}

          {page === "dashboard"  && <Dashboard   setPage={navigate} />}
          {page === "hoje"       && <Hoje        setPage={navigate} />}
          {page === "treino"     && <Treino      setPage={navigate} />}
          {page === "dieta"      && <Dieta       setPage={navigate} />}
          {page === "agenda"     && <Agenda      setPage={navigate} />}
          {page === "projetos"   && <Projetos    setPage={navigate} />}
          {page === "mental"     && <Mental      setPage={navigate} />}
          {page === "biblioteca" && <Biblioteca  setPage={navigate} />}
          {page === "coach"      && <Coach       setPage={navigate} />}
          {page === "galeria"    && <Galeria     setPage={navigate} />}
          {page === "perfil"    && <Perfil      setPage={navigate} />}
          {page === "insights"  && <Insights    setPage={navigate} />}

          {!RISE_IMPLEMENTED.includes(page) && (
            <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Tela em construção</div>
              <div style={{ fontSize: 13 }}>Esta seção será implementada em breve.</div>
            </div>
          )}
        </div>

        <Toaster />
      </div>
    </LayoutContext.Provider>
  );
}
