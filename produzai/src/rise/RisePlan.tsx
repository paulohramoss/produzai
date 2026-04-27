import { useState, useEffect } from "react";
import { C, NAV_GROUPS, type Page } from "./data";
import { Dot } from "./primitives";
import { Dashboard }    from "./pages/Dashboard";
import { Treino }       from "./pages/Treino";
import { Dieta }        from "./pages/Dieta";
import { Integracoes }  from "./pages/Integracoes";
import { Hoje }         from "./pages/Hoje";
import { Agenda }       from "./pages/Agenda";
import { Projetos }     from "./pages/Projetos";
import { Mental }       from "./pages/Mental";
import { Biblioteca }   from "./pages/Biblioteca";
import { Coach }        from "./pages/Coach";
import { StravaPage }   from "./pages/StravaPage";
import { WebDietPage }  from "./pages/WebDietPage";
import {
  bootstrapTokensFromEnv,
  exchangeCode,
  hasValidTokens,
} from "../services/strava";
import { useStravaStore } from "../store/useStravaStore";

// ProduzAI pages
// import { useAppStore } from '../store/useAppStore'
// import Chat from '../pages/Chat'
// import Habits from '../pages/Habits'
// import Finance from '../pages/Finance'
// import Calendar from '../pages/Calendar'
// import Investments from '../pages/Investments'
// import Goals from '../pages/Goals'
// import Reports from '../pages/Reports'
// import Settings from '../pages/Settings'

const RISE_IMPLEMENTED: Page[] = [
  "dashboard", "hoje", "treino", "dieta", "agenda",
  "projetos", "mental", "biblioteca",
  "integracoes", "strava", "webdiet", "coach",
];

// const PRODUZAI_MAP: Partial<Record<Page, React.ReactNode>> = {
// chat: <Chat />,
//habits: <Habits />,
//finance: <Finance />,
//calendar: <Calendar />,
//investments: <Investments />,
//goals: <Goals />,
//reports: <Reports />,
//settings: <Settings />,
// }

export function RisePlan() {
  const [connected, setConnected] = useState<string[]>(() => {
    bootstrapTokensFromEnv()
    const initial: string[] = []
    if (hasValidTokens()) initial.push("strava")
    try {
      const raw = localStorage.getItem("webdiet_data")
      if (raw && JSON.parse(raw)?.state?.data) initial.push("webdiet")
    } catch {
      // ignore
    }
    return initial
  });
  const [page, setPage] = useState<Page>("dashboard");
  const [oauthLoading, setOauthLoading] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const scope = params.get("scope");
    return !!(code && scope?.includes("activity:read_all"));
  });
  const stravaLoad = useStravaStore(s => s.load);

  useEffect(() => {
    // Handle OAuth redirect back from Strava
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const scope = params.get("scope");
    const error = params.get("error");

    if (error) {
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    if (code && scope?.includes("activity:read_all")) {
      exchangeCode(code)
        .then(() => {
          setConnected(prev => [...new Set([...prev, "strava"])]);
          window.history.replaceState({}, "", window.location.pathname);
          setOauthLoading(false);
        })
        .catch(err => {
          console.error("Strava OAuth failed:", err);
          setOauthLoading(false);
          window.history.replaceState({}, "", window.location.pathname);
        });
    }
  }, []);

  // Load real Strava data whenever Strava becomes connected
  useEffect(() => {
    if (connected.includes("strava")) {
      stravaLoad();
    }
  }, [connected, stravaLoad]);

  const navigate = (id: Page) => {
    setPage(id);
  };

  const handleConnect = (svc: string) => {
    setConnected((prev) => [...new Set([...prev, svc])]);
    navigate("dashboard");
  };

  const allNav = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter(
      (item) =>
        (item.id !== "strava" && item.id !== "webdiet") ||
        connected.includes(item.id),
    ),
  }));

  // const isProduzaiPage = PRODUZAI_PAGES.includes(page)

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: "system-ui,sans-serif",
        fontSize: 14,
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: 210,
          background: "#0A0A0A",
          borderRight: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
          padding: "20px 0",
          flexShrink: 0,
          overflowY: "auto",
        }}
      >
        <div style={{ padding: "0 18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: C.orange,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                fontWeight: 800,
                color: "#000",
              }}
            >
              ⚡
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 12 }}>The Rise Plan</div>
              <div style={{ fontSize: 10, color: C.muted }}>
                Performance Total
              </div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          {allNav.map((g, gi) => (
            <div key={gi} style={{ marginBottom: 6 }}>
              <div
                style={{
                  fontSize: 9,
                  color: C.muted,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  padding: "6px 18px 4px",
                  textTransform: "uppercase",
                }}
              >
                {g.label}
              </div>
              {g.items.map((item, i) => (
                <div
                  key={i}
                  onClick={() => navigate(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 18px",
                    cursor: "pointer",
                    background: page === item.id ? "#1A1A1A" : "transparent",
                    borderLeft:
                      page === item.id
                        ? `2px solid ${item.color || C.orange}`
                        : "2px solid transparent",
                    color: page === item.id ? C.text : C.muted,
                    transition: "all .12s",
                  }}
                >
                  <span style={{ fontSize: 15 }}>{item.icon}</span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: page === item.id ? 600 : 400,
                    }}
                  >
                    {item.label}
                  </span>
                  {item.badge && connected.includes(item.id) && (
                    <Dot color={C.green} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/* Integration counter */}
        <div
          style={{ padding: "14px 18px", borderTop: `1px solid ${C.border}` }}
        >
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
            Integrações ativas
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: connected.length > 0 ? C.green : C.muted,
            }}
          >
            {connected.length}/4
          </div>
          <div
            style={{
              marginTop: 6,
              height: 3,
              background: C.border,
              borderRadius: 4,
            }}
          >
            <div
              style={{
                width: `${(connected.length / 4) * 100}%`,
                height: 3,
                background: C.green,
                borderRadius: 4,
                transition: "width .4s",
              }}
            />
          </div>
        </div>
      </div>

      {/* OAuth loading overlay */}
      {oauthLoading && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 400, gap: 16 }}>
          <div style={{ fontSize: 48 }}>🏃</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Conectando ao Strava...</div>
          <div style={{ fontSize: 13, color: C.muted }}>Trocando tokens e sincronizando dados</div>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>
        {page === "dashboard"  && <Dashboard   connected={connected} setPage={navigate} />}
        {page === "hoje"       && <Hoje        connected={connected} setPage={navigate} />}
        {page === "treino"     && <Treino      connected={connected} setPage={navigate} />}
        {page === "dieta"      && <Dieta       connected={connected} setPage={navigate} />}
        {page === "agenda"     && <Agenda      connected={connected} setPage={navigate} />}
        {page === "projetos"   && <Projetos    connected={connected} setPage={navigate} />}
        {page === "mental"     && <Mental      connected={connected} setPage={navigate} />}
        {page === "biblioteca" && <Biblioteca  connected={connected} setPage={navigate} />}
        {page === "coach"      && <Coach       connected={connected} setPage={navigate} />}
        {page === "integracoes"&& <Integracoes connected={connected} onConnect={handleConnect} />}
        {page === "strava"     && <StravaPage  connected={connected} setPage={navigate} />}
        {page === "webdiet"    && <WebDietPage connected={connected} setPage={navigate} />}

        {!RISE_IMPLEMENTED.includes(page) && (
          <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Tela em construção</div>
            <div style={{ fontSize: 13 }}>Esta seção será implementada em breve.</div>
          </div>
        )}
      </div>
    </div>
  );
}
