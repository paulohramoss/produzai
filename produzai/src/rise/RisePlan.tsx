import { useState, useCallback, useSyncExternalStore, lazy, Suspense } from "react";
import { LayoutDashboard, Sun, Dumbbell, Utensils, Menu, ChevronDown } from "lucide-react";
import { T, C, NAV_PRIMARY, NAV_MORE, safeInset, safePlus, type Page, type NavItem } from "./data";
// O Dashboard é a tela em que todo mundo cai depois do login: mantê-lo estático
// evita um piscar de esqueleto no caminho mais comum do app.
import { Dashboard }    from "./pages/Dashboard";
// As demais telas viajam em chunks próprios. Sem isto o primeiro carregamento
// baixava o app inteiro — Coach, Onboarding, Galeria e o recharts junto — antes
// de desenhar o primeiro pixel.
const Treino     = lazy(() => import("./pages/Treino").then(m     => ({ default: m.Treino })));
const Dieta      = lazy(() => import("./pages/Dieta").then(m      => ({ default: m.Dieta })));
const Hoje       = lazy(() => import("./pages/Hoje").then(m       => ({ default: m.Hoje })));
const Historico  = lazy(() => import("./pages/Historico").then(m  => ({ default: m.Historico })));
const Agenda     = lazy(() => import("./pages/Agenda").then(m     => ({ default: m.Agenda })));
const Projetos   = lazy(() => import("./pages/Projetos").then(m   => ({ default: m.Projetos })));
const Mental     = lazy(() => import("./pages/Mental").then(m     => ({ default: m.Mental })));
const Biblioteca = lazy(() => import("./pages/Biblioteca").then(m => ({ default: m.Biblioteca })));
const Coach      = lazy(() => import("./pages/Coach").then(m      => ({ default: m.Coach })));
const Galeria    = lazy(() => import("./pages/Galeria").then(m    => ({ default: m.Galeria })));
const Perfil     = lazy(() => import("./pages/Perfil").then(m     => ({ default: m.Perfil })));
const Insights   = lazy(() => import("./pages/Insights").then(m   => ({ default: m.Insights })));
const Onboarding = lazy(() => import("./pages/Onboarding").then(m => ({ default: m.Onboarding })));
import { Avatar }       from "./primitives";
import { PageSkeleton } from "./components/PageSkeleton";
import { ConsentModal } from "./components/ConsentModal";
import { Toaster }      from "./components/Toaster";
import { useAuthStore } from "../store/useAuthStore";
import { LayoutContext } from "./LayoutContext";

const RISE_IMPLEMENTED: Page[] = [
  "dashboard", "hoje", "historico", "treino", "dieta", "agenda",
  "projetos", "mental", "biblioteca", "coach", "galeria", "perfil", "insights",
];

// Barra inferior do celular — o laço diário, mais o "Mais".
// Espelha NAV_PRIMARY de propósito: a mesma resposta para "onde eu vou agora"
// nos dois tamanhos de tela. O Coach fica um toque adiante, no menu, porque é
// tela de dúvida pontual, não de rotina.
const BOTTOM_NAV = [
  { id: "dashboard" as Page, icon: LayoutDashboard, label: "Início" },
  { id: "hoje"      as Page, icon: Sun,             label: "Hoje"  },
  { id: "treino"    as Page, icon: Dumbbell,        label: "Treino" },
  { id: "dieta"     as Page, icon: Utensils,        label: "Dieta" },
];

const MORE_PAGES = new Set<Page>(NAV_MORE.flatMap(g => g.items.map(i => i.id)));

/** Um item da barra lateral. Mesma aparência no primário e dentro do "Mais". */
function NavButton({ item, active, isTablet, onClick }: {
  item: NavItem;
  active: boolean;
  isTablet: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={isTablet ? item.label : undefined}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: isTablet ? "center" : "flex-start",
        gap: 10,
        width: "100%",
        padding: isTablet ? "11px 0" : "9px 18px",
        cursor: "pointer",
        background: active ? "#1A1A1A" : "transparent",
        borderLeft: !isTablet && active
          ? `2px solid ${item.color || C.orange}`
          : "2px solid transparent",
        borderRight: "none",
        borderTop: "none",
        borderBottom: "none",
        color: active ? C.text : C.muted,
        transition: "all .12s",
      }}
    >
      <item.icon size={isTablet ? 18 : 15} color={active ? (item.color || C.orange) : undefined} />
      {!isTablet && (
        <span style={{ fontSize: T.text.md, fontWeight: active ? 600 : 400 }}>
          {item.label}
        </span>
      )}
    </button>
  );
}

// As faixas de tela, declaradas uma vez. Os mesmos limites de antes (768/1024).
const MOBILE_QUERY = window.matchMedia("(max-width: 767px)");
const TABLET_QUERY = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");

// Fora do componente de propósito: `useSyncExternalStore` compara as funções
// por identidade e voltaria a se inscrever a cada render se elas nascessem lá
// dentro.
const subscribeMobile = (onChange: () => void) => {
  MOBILE_QUERY.addEventListener("change", onChange);
  return () => MOBILE_QUERY.removeEventListener("change", onChange);
};
const subscribeTablet = (onChange: () => void) => {
  TABLET_QUERY.addEventListener("change", onChange);
  return () => TABLET_QUERY.removeEventListener("change", onChange);
};
const getMobile = () => MOBILE_QUERY.matches;
const getTablet = () => TABLET_QUERY.matches;

const SIDEBAR_FULL = 210;
const SIDEBAR_ICON = 62;

export function RisePlan() {
  const { user, displayName, photoURL, logout, onboardingDone, consentAccepted } = useAuthStore();
  const [page, setPage]         = useState<Page>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen]   = useState(false);
  // Dois booleanos, não a largura em pixels. Guardar `window.innerWidth` fazia
  // o app inteiro re-renderizar a CADA evento de resize — dezenas por segundo
  // ao arrastar a janela ou girar o aparelho — para responder a uma pergunta
  // que só tem três respostas. `matchMedia` avisa quando a FAIXA muda: uma vez
  // por travessia de breakpoint.
  const isMobile = useSyncExternalStore(subscribeMobile, getMobile);
  const isTablet = useSyncExternalStore(subscribeTablet, getTablet);

  // A seção fica aberta à força quando a página atual mora dentro dela: fechar
  // o grupo que contém a tela aberta esconderia o item ativo e a barra pareceria
  // não ter nada selecionado.
  const showMore = moreOpen || MORE_PAGES.has(page);

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
        <Suspense fallback={<PageSkeleton />}>
          <Onboarding />
        </Suspense>
        <Toaster />
      </>
    );
  }

  const sidebarW = isTablet ? SIDEBAR_ICON : SIDEBAR_FULL;
  const avatarInitial = (displayName || user?.displayName || user?.email || "U")[0].toUpperCase();

  return (
    <LayoutContext.Provider value={{ isMobile, isTablet, menuOpen, setMenuOpen }}>
      <div className="rise-screen" style={{
        display: "flex",
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
          paddingTop: safeInset("top", 20),
          paddingBottom: safeInset("bottom", 20),
          flexShrink: 0,
          overflowY: "auto",
          overflowX: "hidden",
          // Mobile: fixed sliding drawer; tablet/desktop: static in flow
          ...(isMobile ? {
            position: "fixed" as const,
            top: 0,
            left: 0,
            // 100dvh acompanha a barra do navegador; 100vh fica de fallback.
            height: "100vh",
            maxHeight: "100dvh",
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
                className="rise-brand"
                src="/rise-logo.png"
                alt="The Rise Plan"
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </div>
          )}
          {isTablet && (
            <div style={{ display: "flex", justifyContent: "center", paddingBottom: 16 }}>
              <img className="rise-brand rise-brand--mark" src="/rise-mark.png" alt="Rise" style={{ width: 44 }} />
            </div>
          )}

          <nav style={{ flex: 1 }}>
            {NAV_PRIMARY.map(item => (
              <NavButton
                key={item.id}
                item={item}
                active={page === item.id}
                isTablet={isTablet}
                onClick={() => navigate(item.id)}
              />
            ))}

            {/* "Mais" — a profundidade do app continua toda aqui, um toque adiante */}
            <button
              onClick={() => setMoreOpen(o => !o)}
              title={isTablet ? "Mais" : undefined}
              aria-expanded={showMore}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: isTablet ? "center" : "space-between",
                gap: 10,
                width: "100%",
                marginTop: 6,
                padding: isTablet ? "11px 0" : "9px 18px",
                cursor: "pointer",
                background: "transparent",
                border: "none",
                borderLeft: isTablet ? "none" : "2px solid transparent",
                color: C.muted,
              }}
            >
              {isTablet ? (
                <ChevronDown
                  size={18}
                  style={{ transform: showMore ? "rotate(180deg)" : "none", transition: "transform .15s" }}
                />
              ) : (
                <>
                  <span style={{ fontSize: T.text.md }}>Mais</span>
                  <ChevronDown
                    size={14}
                    style={{ transform: showMore ? "rotate(180deg)" : "none", transition: "transform .15s" }}
                  />
                </>
              )}
            </button>

            {showMore && NAV_MORE.map((g, gi) => (
              <div key={gi} style={{ marginBottom: 6 }}>
                {!isTablet && (
                  <div style={{
                    fontSize: T.text['2xs'], color: C.muted, fontWeight: T.weight.bold,
                    letterSpacing: 1.2, padding: "6px 18px 4px",
                    textTransform: "uppercase",
                  }}>
                    {g.label}
                  </div>
                )}
                {g.items.map(item => (
                  <NavButton
                    key={item.id}
                    item={item}
                    active={page === item.id}
                    isTablet={isTablet}
                    onClick={() => navigate(item.id)}
                  />
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
          paddingLeft:   safeInset("left",  isMobile ? 16 : isTablet ? 20 : 28),
          paddingRight:  safeInset("right", isMobile ? 16 : isTablet ? 20 : 28),
          // No celular o rodapé fixo (64px) mais a barra de gestos comem o fim
          // da página: sem esta folga o último card fica inalcançável.
          paddingBottom: isMobile ? safePlus("bottom", 80) : isTablet ? 24 : 28,
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
              paddingTop: safePlus("top", 12),
              paddingBottom: 14,
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
              <img className="rise-brand" src="/rise-logo.png" alt="The Rise Plan" style={{ height: 30 }} />
              <button
                onClick={() => navigate("perfil")}
                aria-label="Ir para perfil"
                style={{ marginLeft: "auto", background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" }}
              >
                <Avatar url={photoURL} initial={avatarInitial} />
              </button>
            </div>
          )}

          <Suspense fallback={<PageSkeleton />}>
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
          </Suspense>

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
