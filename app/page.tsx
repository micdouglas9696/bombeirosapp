"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigured } from "../lib/supabase";

type Role = "admin" | "firefighter" | null;
type View = "dashboard" | "reports" | "people" | "checklist";
type Status = "Conforme" | "Não conforme" | "N/A";
type Team = "Alfa" | "Bravo" | "Charlie" | "Delta";
type Priority = "Baixa" | "Média" | "Alta" | "Crítica";
type Firefighter = { id?: string; name: string; shift: "Diurno" | "Noturno"; tps_team: Team; teca_team: Team; hangar_united_team: Team; active: boolean };
type Round = { id: string; protocol: string; firefighter_name: string; shift: string; tps_team: string; teca_team: string; hangar_united_team: string; conformity: number; non_conformities: number; status: "Em análise" | "Aprovado" | "Ocorrência"; created_at: string };
type Issue = { location: string; observation: string; priority: Priority; action_taken: string; supervisor_notified: string; ss_number: string; photo: File | null };

const checklistItems = ["Saídas de emergência sem bloqueios", "Escadas de emergência livres", "Portas corta-fogo íntegras e fechando corretamente", "Extintores acessíveis e sem avarias", "Hidrantes e mangotinhos desobstruídos", "Acionadores manuais de incêndio íntegros", "Iluminação de emergência operacional", "Sinalização de emergência visível", "Corredores e acessos livres", "Ausência de materiais combustíveis acumulados", "Equipamentos elétricos sem anormalidades", "Escadas rolantes", "Elevadores", "Ausência de vazamentos de água ou outros líquidos", "Ausência de fumaça, odor de queimado ou superaquecimento", "Objetos abandonados", "DEA em condições de uso", "Comunicação via rádio operacional", "Acesso para viaturas de emergência desobstruído", "Macas de resgate"];
const samplePeople: Firefighter[] = [
  { name: "Leandro Dantas dos Santos", shift: "Diurno", tps_team: "Alfa", teca_team: "Alfa", hangar_united_team: "Alfa", active: true },
  { name: "Jorge da Silva Fernandes", shift: "Noturno", tps_team: "Bravo", teca_team: "Bravo", hangar_united_team: "Bravo", active: true }
];
const emptyIssue = (): Issue => ({ location: "", observation: "", priority: "Média", action_taken: "", supervisor_notified: "", ss_number: "", photo: null });
const dateLabel = (value: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)).replace(".", "");

function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "danger" }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

export default function Home() {
  const [role, setRole] = useState<Role>(null);
  const [view, setView] = useState<View>("dashboard");
  const [people, setPeople] = useState(samplePeople);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [answers, setAnswers] = useState<Record<number, Status>>({});
  const [issues, setIssues] = useState<Record<number, Issue>>({});
  const [operator, setOperator] = useState(samplePeople[0].name);
  const [finalMessage, setFinalMessage] = useState("");
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [showFirefighterIdentifyModal, setShowFirefighterIdentifyModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [submittedProtocol, setSubmittedProtocol] = useState<string | null>(null);

  const firefighter = people.find((person) => person.name === operator) ?? people[0];

  const fetchData = async () => {
    if (!supabase) return { people: null, rounds: null, error: null };
    const [p, r] = await Promise.all([
      supabase.from("firefighters").select("id,name,shift,tps_team,teca_team,hangar_united_team,active").order("name"),
      supabase.from("operational_rounds").select("id,protocol,firefighter_name,shift,tps_team,teca_team,hangar_united_team,conformity,non_conformities,status,created_at").order("created_at", { ascending: false }).limit(50)
    ]);
    return { people: p.data as Firefighter[] | null, rounds: r.data as Round[] | null, error: p.error ?? r.error };
  };

  const applyData = async () => {
    const result = await fetchData();
    if (result.error) {
      setMessage("Não foi possível carregar os dados. Execute a migração do Supabase.");
      return;
    }
    if (result.people) setPeople(result.people);
    if (result.rounds) setRounds(result.rounds);
  };

  useEffect(() => {
    void fetchData().then((result) => {
      if (result.error) {
        setMessage("Não foi possível carregar os dados. Execute a migração do Supabase.");
        return;
      }
      if (result.people?.length) {
        setPeople(result.people);
        setOperator(result.people[0].name);
      }
      if (result.rounds) setRounds(result.rounds);
    });
  }, []);

  const completed = Object.keys(answers).length;
  const nonConformities = Object.values(answers).filter((value) => value === "Não conforme").length;
  const conformity = useMemo(() => completed ? Math.round((Object.values(answers).filter((value) => value === "Conforme").length / completed) * 100) : 0, [answers, completed]);

  const addPerson = async (person: Firefighter) => {
    if (!supabase) {
      setPeople((current) => [...current, person]);
      return;
    }
    const { data, error } = await supabase.from("firefighters").insert(person).select("id,name,shift,tps_team,teca_team,hangar_united_team,active").single();
    if (error) throw error;
    setPeople((current) => [...current, data as Firefighter]);
  };

  const submitRound = async () => {
    const client = supabase;
    if (!client || !firefighter) {
      setMessage("Configure o Supabase e selecione um bombeiro.");
      return;
    }
    setSaving(true);
    setMessage("");
    const protocol = `RON-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { data: round, error } = await client.from("operational_rounds").insert({
      protocol,
      firefighter_id: firefighter.id ?? null,
      firefighter_name: firefighter.name,
      shift: firefighter.shift,
      tps_team: firefighter.tps_team,
      teca_team: firefighter.teca_team,
      hangar_united_team: firefighter.hangar_united_team,
      conformity,
      non_conformities: nonConformities,
      status: nonConformities ? "Ocorrência" : "Em análise",
      final_message: finalMessage || null
    }).select("id").single();

    if (error || !round) {
      setSaving(false);
      setMessage(error?.message ?? "Não foi possível registrar a ronda.");
      return;
    }

    try {
      const rows = await Promise.all(checklistItems.map(async (item, index) => {
        const issue = issues[index];
        let photo_path: string | null = null;
        if (answers[index] === "Não conforme" && issue?.photo) {
          const extension = issue.photo.name.split(".").pop() || "jpg";
          const path = `${round.id}/${index + 1}-${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await client.storage.from("round-evidence").upload(path, issue.photo, { contentType: issue.photo.type, upsert: false });
          if (uploadError) throw uploadError;
          photo_path = client.storage.from("round-evidence").getPublicUrl(path).data.publicUrl;
        }
        return {
          round_id: round.id,
          item_number: index + 1,
          item_text: item,
          status: answers[index],
          location: issue?.location || null,
          observation: issue?.observation || null,
          priority: answers[index] === "Não conforme" ? issue?.priority ?? "Média" : null,
          action_taken: issue?.action_taken || null,
          supervisor_notified: issue?.supervisor_notified || null,
          ss_number: issue?.ss_number || null,
          photo_path
        };
      }));
      const { error: answersError } = await client.from("round_answers").insert(rows);
      if (answersError) throw answersError;
      setSubmittedProtocol(protocol);
      setAnswers({});
      setIssues({});
      setFinalMessage("");
      await applyData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar o detalhamento.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRoundStatus = async (roundId: string, newStatus: "Em análise" | "Aprovado" | "Ocorrência") => {
    setRounds((prev) => prev.map((r) => (r.id === roundId ? { ...r, status: newStatus } : r)));
    if (supabase) {
      await supabase.from("operational_rounds").update({ status: newStatus }).eq("id", roundId);
    }
  };

  const totalToday = rounds.filter((round) => new Date(round.created_at).toDateString() === new Date().toDateString()).length;
  const average = rounds.length ? `${(rounds.reduce((sum, round) => sum + round.conformity, 0) / rounds.length).toFixed(1).replace(".", ",")}%` : "—";

  if (!role) {
    return (
      <>
        <LandingGate
          onSelectAdmin={() => setShowAdminAuthModal(true)}
          onSelectFirefighter={() => setShowFirefighterIdentifyModal(true)}
        />
        {showAdminAuthModal && (
          <AdminAuthModal
            onClose={() => setShowAdminAuthModal(false)}
            onSuccess={() => {
              setShowAdminAuthModal(false);
              setRole("admin");
              setView("dashboard");
            }}
          />
        )}
        {showFirefighterIdentifyModal && (
          <FirefighterIdentifyModal
            people={people}
            onClose={() => setShowFirefighterIdentifyModal(false)}
            onConfirm={(selectedName) => {
              setOperator(selectedName);
              setShowFirefighterIdentifyModal(false);
              setRole("firefighter");
              setView("checklist");
            }}
          />
        )}
      </>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/LOGO-ENSEG-branco.png" alt="ENSEG" className="sidebar-logo-img" />
        </div>
        <div className="unit-chip">
          <span className="pulse" /> SBGL · GALEÃO
        </div>

        <nav>
          {role === "admin" ? (
            <>
              <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>
                ▦ Visão geral
              </button>
              <button className={view === "reports" ? "active" : ""} onClick={() => setView("reports")}>
                ▤ Relatórios
              </button>
              <button className={view === "people" ? "active" : ""} onClick={() => setView("people")}>
                ♙ Bombeiros
              </button>
              <button className={view === "checklist" ? "active" : ""} onClick={() => setView("checklist")}>
                ✓ Nova ronda
              </button>
            </>
          ) : (
            <button className={view === "checklist" ? "active" : ""} onClick={() => setView("checklist")}>
              ✓ Nova ronda operacional
            </button>
          )}
        </nav>

        <div className="sidebar-bottom">
          <p>SESSÃO ATIVA</p>
          <strong>{role === "admin" ? "Administrador" : operator}</strong>
          <button
            className="logout"
            onClick={() => {
              setRole(null);
            }}
          >
            ← Sair / Voltar ao Início
          </button>
          <div className="sidebar-credits">
            Desenvolvido por{" "}
            <a href="https://mycom.dev.br/" target="_blank" rel="noopener noreferrer" className="mycom-link">
              Mycom
            </a>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p>Aeroporto Internacional do Galeão — SBGL</p>
            <strong>
              {view === "checklist"
                ? "Nova ronda operacional"
                : view === "people"
                ? "Cadastro de bombeiros"
                : view === "reports"
                ? "Relatórios de inspeção"
                : "Painel de controle"}
            </strong>
          </div>
          <div>
            <Tag tone={role === "admin" ? "danger" : "good"}>
              {role === "admin" ? "MODO ADMIN" : `BOMBEIRO: ${firefighter?.name.split(" ")[0].toUpperCase()}`}
            </Tag>
          </div>
        </header>

        {!supabaseConfigured && <div className="config-warning">Modo de demonstração: configure o Supabase para salvar.</div>}
        {message && <div className="config-warning error-message">{message}</div>}

        {view === "dashboard" && role === "admin" && (
          <Dashboard rounds={rounds} totalToday={totalToday} average={average} onStart={() => setView("checklist")} />
        )}
        {view === "reports" && role === "admin" && <Reports rounds={rounds} onUpdateRoundStatus={handleUpdateRoundStatus} />}
        {view === "people" && role === "admin" && <People people={people} onAdd={() => setShowPersonModal(true)} />}
        {view === "checklist" && (
          <Checklist
            people={people}
            operator={operator}
            setOperator={setOperator}
            firefighter={firefighter}
            answers={answers}
            setAnswers={setAnswers}
            issues={issues}
            setIssues={setIssues}
            finalMessage={finalMessage}
            setFinalMessage={setFinalMessage}
            completed={completed}
            conformity={conformity}
            nonConformities={nonConformities}
            saving={saving}
            submittedProtocol={submittedProtocol}
            onSubmit={submitRound}
          />
        )}
      </section>

      {showPersonModal && (
        <PersonModal
          onClose={() => setShowPersonModal(false)}
          onSave={async (person) => {
            await addPerson(person);
            setShowPersonModal(false);
          }}
        />
      )}
    </main>
  );
}

function LandingGate({ onSelectAdmin, onSelectFirefighter }: { onSelectAdmin: () => void; onSelectFirefighter: () => void }) {
  return (
    <div className="landing-gate">
      <div className="landing-container">
        <div className="landing-brand">
          <img src="/LOGO-ENSEG-branco.png" alt="ENSEG - Segurança que gera confiança" className="landing-logo-img" />
        </div>

        <div className="landing-badge">
          <span className="pulse" /> AEROPORTO INTERNACIONAL DO GALEÃO — SBGL
        </div>

        <h1 className="landing-title">Sistema de Inspeção e Controle Operacional</h1>
        <p className="landing-subtitle">
          Selecione seu perfil de acesso para prosseguir com a gestão das vistorias de emergência e combate a incêndio.
        </p>

        <div className="landing-grid">
          <div className="role-card" onClick={onSelectAdmin} role="button" tabIndex={0}>
            <span className="role-badge">Acesso Restrito</span>
            <div className="role-icon">🛡️</div>
            <h3>Administrador</h3>
            <p>Acesse a visão geral das operações, relatórios de auditoria e gerencie os cadastros da equipe de bombeiros.</p>
            <button
              type="button"
              className="role-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSelectAdmin();
              }}
            >
              <span>Entrar com senha</span>
              <span>→</span>
            </button>
          </div>

          <div className="role-card" onClick={onSelectFirefighter} role="button" tabIndex={0}>
            <span className="role-badge">Operacional</span>
            <div className="role-icon">👨‍🚒</div>
            <h3>Bombeiro Operacional</h3>
            <p>Identifique-se para iniciar o preenchimento de uma nova ronda de inspeção nos postos TPS, TECA e Hangar.</p>
            <button
              type="button"
              className="role-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSelectFirefighter();
              }}
            >
              <span>Iniciar Nova Ronda</span>
              <span>→</span>
            </button>
          </div>
        </div>

        <div className="landing-footer">
          ENSEG © {new Date().getFullYear()} — Plataforma de Gerenciamento de Brigada e Rondas Operacionais SBGL.
          <br />
          <span style={{ marginTop: "6px", display: "inline-block" }}>
            Desenvolvido por{" "}
            <a href="https://mycom.dev.br/" target="_blank" rel="noopener noreferrer" className="mycom-link">
              Mycom
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}

function AdminAuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "admin123" || password === "admin2026" || password === "admin") {
      onSuccess();
    } else {
      setError("Senha incorreta. Tente novamente (Senha de demo: admin2026).");
    }
  };

  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={handleSubmit}>
        <button type="button" className="close" onClick={onClose} style={{ color: "#fff", zIndex: 2 }}>
          ×
        </button>
        <div className="modal-header-banner">
          <img src="/LOGO-ENSEG-branco.png" alt="ENSEG" className="modal-logo-img" />
          <p className="eyebrow">AUTENTICAÇÃO RESTRITA</p>
          <h2>Acesso do Administrador</h2>
        </div>

        <label>
          SENHA DE ACESSO
          <input
            type="password"
            autoFocus
            required
            placeholder="Digite a senha do administrador..."
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
          />
        </label>
        <div className="password-hint">
          🔑 Senha de demonstração: <strong>admin2026</strong>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="outline" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="primary">
            Acessar Painel Gerencial
          </button>
        </div>
      </form>
    </div>
  );
}

function FirefighterIdentifyModal({
  people,
  onClose,
  onConfirm
}: {
  people: Firefighter[];
  onClose: () => void;
  onConfirm: (selectedName: string) => void;
}) {
  const [selectedName, setSelectedName] = useState(people[0]?.name ?? "");
  const firefighter = people.find((p) => p.name === selectedName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedName) {
      onConfirm(selectedName);
    }
  };

  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={handleSubmit}>
        <button type="button" className="close" onClick={onClose} style={{ color: "#fff", zIndex: 2 }}>
          ×
        </button>
        <div className="modal-header-banner">
          <img src="/LOGO-ENSEG-branco.png" alt="ENSEG" className="modal-logo-img" />
          <p className="eyebrow">IDENTIFICAÇÃO OPERACIONAL</p>
          <h2>Identificação do Bombeiro</h2>
        </div>

        <label>
          BOMBEIRO RESPONSÁVEL
          <select value={selectedName} onChange={(e) => setSelectedName(e.target.value)}>
            {people.map((p) => (
              <option key={p.id ?? p.name} value={p.name}>
                {p.name} ({p.shift})
              </option>
            ))}
          </select>
        </label>

        {firefighter && (
          <div className="identity" style={{ marginTop: "12px" }}>
            <label>
              TURNO
              <input readOnly value={firefighter.shift} />
            </label>
            <label>
              POSTO 1 — TPS
              <input readOnly value={firefighter.tps_team} />
            </label>
            <label>
              POSTO 2 — TECA
              <input readOnly value={firefighter.teca_team} />
            </label>
            <label>
              POSTO 3 — HANGAR
              <input readOnly value={firefighter.hangar_united_team} />
            </label>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="outline" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="primary">
            Confirmar e Iniciar Ronda
          </button>
        </div>
      </form>
    </div>
  );
}

function Dashboard({ rounds, totalToday, average, onStart }: { rounds: Round[]; totalToday: number; average: string; onStart: () => void }) {
  return (
    <div className="content">
      <section className="hero">
        <div>
          <p className="eyebrow">OPERAÇÃO EM ACOMPANHAMENTO</p>
          <h1>
            Controle da ronda.
            <br />
            <em>Decisão com evidência.</em>
          </h1>
          <p className="muted">Inspeções e ocorrências operacionais do SBGL em um só lugar.</p>
          <button className="primary" onClick={onStart}>
            + Iniciar nova ronda
          </button>
        </div>
        <div className="hero-number">
          <b>{average}</b>
          <span>
            conformidade média
            <br />
            das rondas registradas
          </span>
        </div>
      </section>
      <section className="stats">
        <Metric label="Rondas hoje" value={String(totalToday).padStart(2, "0")} detail="registradas no banco" />
        <Metric label="Conformidade geral" value={average} detail="média dos relatórios" alert />
        <Metric label="Em análise" value={String(rounds.filter((round) => round.status === "Em análise").length).padStart(2, "0")} detail="aguardando validação" />
        <Metric label="Ocorrências abertas" value={String(rounds.filter((round) => round.status === "Ocorrência").length).padStart(2, "0")} detail="com não conformidades" danger />
      </section>
      <section className="section-head">
        <div>
          <p className="eyebrow">ATIVIDADE RECENTE</p>
          <h2>Últimos relatórios enviados</h2>
        </div>
      </section>
      <div className="report-list">
        {rounds.length ? rounds.slice(0, 5).map((round) => <ReportRow key={round.id} report={round} />) : <div className="empty-line">Nenhuma ronda registrada ainda.</div>}
      </div>
    </div>
  );
}

function Metric({ label, value, detail, alert, danger }: { label: string; value: string; detail: string; alert?: boolean; danger?: boolean }) {
  return (
    <article className={`metric ${alert ? "alert" : ""} ${danger ? "danger-card" : ""}`}>
      <p>{label}</p>
      <b>{value}</b>
      <span>{detail}</span>
    </article>
  );
}

function ReportRow({ report, onClick }: { report: Round; onClick?: () => void }) {
  const tone = report.status === "Aprovado" ? "good" : report.status === "Ocorrência" ? "danger" : "warn";
  return (
    <article className="report-row" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <div className="report-icon">✓</div>
      <div className="report-main">
        <strong>{report.protocol}</strong>
        <span>
          {report.firefighter_name} · {report.shift} · TPS {report.tps_team}
        </span>
      </div>
      <span className="report-date">{dateLabel(report.created_at)}</span>
      <b className="report-score" style={{ color: report.conformity === 100 ? "var(--green)" : "var(--red)" }}>
        {report.conformity}%
      </b>
      <Tag tone={tone}>{report.status}</Tag>
      <span />
    </article>
  );
}

type RoundAnswer = {
  id?: string;
  round_id: string;
  item_number: number;
  item_text: string;
  status: Status;
  location?: string | null;
  observation?: string | null;
  priority?: Priority | null;
  action_taken?: string | null;
  supervisor_notified?: string | null;
  ss_number?: string | null;
  photo_path?: string | null;
};

function RoundDetailsModal({
  round,
  onClose,
  onUpdateStatus
}: {
  round: Round;
  onClose: () => void;
  onUpdateStatus: (roundId: string, newStatus: "Em análise" | "Aprovado" | "Ocorrência") => void;
}) {
  const [answers, setAnswers] = useState<RoundAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "issues" | "conform">("all");

  useEffect(() => {
    let isMounted = true;
    async function loadAnswers() {
      setLoading(true);
      if (supabase) {
        const { data, error } = await supabase
          .from("round_answers")
          .select("*")
          .eq("round_id", round.id)
          .order("item_number");

        if (!error && data && data.length > 0) {
          if (isMounted) {
            setAnswers(data as RoundAnswer[]);
            setLoading(false);
          }
          return;
        }
      }

      // Demo / Fallback mode: Map all 20 checklist items with simulated answers
      const demoAnswers: RoundAnswer[] = checklistItems.map((itemText, index) => {
        const itemNumber = index + 1;
        const isNonConform = round.non_conformities > 0 && index < round.non_conformities;
        const isNA = index === 11 && round.non_conformities === 0;
        const status: Status = isNonConform ? "Não conforme" : isNA ? "N/A" : "Conforme";

        return {
          round_id: round.id,
          item_number: itemNumber,
          item_text: itemText,
          status,
          location: isNonConform ? `Setor Operacional TPS ${index + 1}` : null,
          observation: isNonConform ? `Apontamento na inspeção de ${itemText.toLowerCase()}. Ponto verificado pelo bombeiro de ronda.` : null,
          priority: isNonConform ? (index % 2 === 0 ? "Alta" : "Média") : null,
          action_taken: isNonConform ? "Área isolada e comunicado imediato à brigada de plantão." : null,
          supervisor_notified: isNonConform ? "Inspetor de Segurança — 15:20h" : null,
          ss_number: isNonConform ? `SS-2026-${1080 + index}` : null,
          photo_path: null
        };
      });

      if (isMounted) {
        setAnswers(demoAnswers);
        setLoading(false);
      }
    }

    void loadAnswers();
    return () => {
      isMounted = false;
    };
  }, [round]);

  const filteredAnswers = useMemo(() => {
    if (activeTab === "issues") return answers.filter((a) => a.status === "Não conforme");
    if (activeTab === "conform") return answers.filter((a) => a.status === "Conforme");
    return answers;
  }, [answers, activeTab]);

  const totalConform = answers.filter((a) => a.status === "Conforme").length;
  const totalNonConform = answers.filter((a) => a.status === "Não conforme").length;
  const totalNA = answers.filter((a) => a.status === "N/A").length;

  return (
    <div className="modal-backdrop">
      <div className="modal modal-wide">
        <button type="button" className="close" onClick={onClose} style={{ color: "#fff", zIndex: 2 }}>
          ×
        </button>

        <div className="modal-header-banner">
          <img src="/LOGO-ENSEG-branco.png" alt="ENSEG" className="modal-logo-img" />
          <p className="eyebrow">RELATÓRIO COMPLETO DE AUDITORIA DA RONDA</p>
          <h2>{round.protocol}</h2>
        </div>

        <div style={{ padding: "0 4px" }}>
          {/* Metadata Banner */}
          <div className="identity" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "16px" }}>
            <div>
              <label>BOMBEIRO RESPONSÁVEL</label>
              <strong>{round.firefighter_name}</strong>
            </div>
            <div>
              <label>TURNO</label>
              <strong>{round.shift}</strong>
            </div>
            <div>
              <label>POSTOS DE TRABALHO</label>
              <strong style={{ fontSize: "11px" }}>
                TPS {round.tps_team} · TECA {round.teca_team} · Hangar {round.hangar_united_team}
              </strong>
            </div>
            <div>
              <label>DATA DE REGISTRO</label>
              <strong>{dateLabel(round.created_at)}</strong>
            </div>
          </div>

          {/* Quick Round Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "20px" }}>
            <div className="metric" style={{ padding: "12px", minHeight: "auto", borderTopColor: "var(--red)" }}>
              <p style={{ margin: 0, fontSize: "10px" }}>CONFORMIDADE GERAL</p>
              <b style={{ fontSize: "24px", color: round.conformity === 100 ? "var(--green)" : "var(--red)" }}>
                {round.conformity}%
              </b>
            </div>
            <div className="metric" style={{ padding: "12px", minHeight: "auto", borderTopColor: "#159365" }}>
              <p style={{ margin: 0, fontSize: "10px" }}>ITENS CONFORMES</p>
              <b style={{ fontSize: "24px", color: "var(--green)" }}>{totalConform} / 20</b>
            </div>
            <div className="metric" style={{ padding: "12px", minHeight: "auto", borderTopColor: "var(--red)" }}>
              <p style={{ margin: 0, fontSize: "10px" }}>NÃO CONFORMIDADES</p>
              <b style={{ fontSize: "24px", color: totalNonConform ? "var(--red)" : "#666" }}>{totalNonConform}</b>
            </div>
            <div className="metric" style={{ padding: "12px", minHeight: "auto", borderTopColor: "#c8a66a" }}>
              <p style={{ margin: 0, fontSize: "10px" }}>NÃO APLICÁVEL (N/A)</p>
              <b style={{ fontSize: "24px", color: "#b38228" }}>{totalNA}</b>
            </div>
          </div>

          {/* Tabs Filter for Answers */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "10px", marginBottom: "14px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className={activeTab === "all" ? "primary" : "outline"}
                style={{ padding: "6px 14px", fontSize: "11px" }}
                onClick={() => setActiveTab("all")}
              >
                Todas as 20 Respostas ({answers.length})
              </button>
              <button
                type="button"
                className={activeTab === "issues" ? "primary" : "outline"}
                style={{ padding: "6px 14px", fontSize: "11px", borderColor: totalNonConform ? "var(--red)" : "" }}
                onClick={() => setActiveTab("issues")}
              >
                Ocorrências / Divergências ({totalNonConform})
              </button>
              <button
                type="button"
                className={activeTab === "conform" ? "primary" : "outline"}
                style={{ padding: "6px 14px", fontSize: "11px" }}
                onClick={() => setActiveTab("conform")}
              >
                Itens Ok ({totalConform})
              </button>
            </div>

            <Tag tone={round.status === "Aprovado" ? "good" : round.status === "Ocorrência" ? "danger" : "warn"}>
              STATUS: {round.status.toUpperCase()}
            </Tag>
          </div>

          {/* List of 20 Checklist Item Responses */}
          {loading ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#888" }}>Carregando detalhamento das respostas...</div>
          ) : (
            <div className="answers-audit-list">
              {filteredAnswers.length ? (
                filteredAnswers.map((ans) => {
                  const isBad = ans.status === "Não conforme";
                  const isOk = ans.status === "Conforme";

                  return (
                    <div className="audit-item-row" key={ans.item_number} style={{ borderColor: isBad ? "#f5baba" : "#e7e7e2" }}>
                      <div className="audit-item-header">
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontWeight: "bold", width: "24px", color: isBad ? "var(--red)" : "#888" }}>
                            #{ans.item_number}
                          </span>
                          <strong>{ans.item_text}</strong>
                        </div>
                        <Tag tone={isOk ? "good" : isBad ? "danger" : "warn"}>{ans.status}</Tag>
                      </div>

                      {/* Detailed Issue Breakdown when "Não conforme" */}
                      {isBad && (
                        <div className="audit-issue-detail">
                          <div>
                            <strong>LOCALIZAÇÃO EXATA:</strong>
                            <p>{ans.location || "Não especificado"}</p>
                          </div>
                          <div>
                            <strong>OBSERVAÇÃO / ANOMALIA:</strong>
                            <p>{ans.observation || "Sem observações adicionais"}</p>
                          </div>
                          <div>
                            <strong>PROVIDÊNCIA ADOTADA:</strong>
                            <p>{ans.action_taken || "Aguardando equipe de manutenção"}</p>
                          </div>
                          <div>
                            <strong>SUPERVISOR NOTIFICADO / HORÁRIO:</strong>
                            <p>{ans.supervisor_notified || "N/A"}</p>
                          </div>
                          {ans.ss_number && (
                            <div>
                              <strong>SOLICITAÇÃO DE SERVIÇO (SS):</strong>
                              <p style={{ fontWeight: "bold", color: "var(--red)" }}>{ans.ss_number}</p>
                            </div>
                          )}
                          {ans.photo_path && (
                            <div>
                              <strong>REGISTRO FOTOGRÁFICO DE EVIDÊNCIA:</strong>
                              <a href={ans.photo_path} target="_blank" rel="noopener noreferrer">
                                <img src={ans.photo_path} alt="Evidência" className="audit-photo-img" />
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>Nenhum item nesta categoria.</div>
              )}
            </div>
          )}

          {/* Admin Validation Actions */}
          <div className="modal-actions" style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--line)" }}>
            <button type="button" className="outline" onClick={onClose}>
              Fechar
            </button>
            <button
              type="button"
              className="outline"
              onClick={() => {
                window.print();
              }}
            >
              🖨️ Imprimir / PDF
            </button>
            {round.status !== "Aprovado" && (
              <button
                type="button"
                className="primary"
                style={{ background: "var(--green)" }}
                onClick={() => onUpdateStatus(round.id, "Aprovado")}
              >
                ✓ Aprovar Vistoria
              </button>
            )}
            {round.status !== "Ocorrência" && round.non_conformities > 0 && (
              <button
                type="button"
                className="primary"
                style={{ background: "var(--red)" }}
                onClick={() => onUpdateStatus(round.id, "Ocorrência")}
              >
                ⚠️ Marcar como Ocorrência
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Reports({
  rounds,
  onUpdateRoundStatus
}: {
  rounds: Round[];
  onUpdateRoundStatus: (roundId: string, newStatus: "Em análise" | "Aprovado" | "Ocorrência") => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [firefighterFilter, setFirefighterFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);

  // Extract unique firefighter names for dropdown filter
  const firefighterOptions = useMemo(() => {
    const names = Array.from(new Set(rounds.map((r) => r.firefighter_name)));
    return names.sort();
  }, [rounds]);

  // Filtered rounds logic
  const filteredRounds = useMemo(() => {
    return rounds.filter((r) => {
      const matchesSearch =
        r.protocol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.firefighter_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFirefighter = firefighterFilter === "all" || r.firefighter_name === firefighterFilter;
      const matchesShift = shiftFilter === "all" || r.shift === shiftFilter;
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesSearch && matchesFirefighter && matchesShift && matchesStatus;
    });
  }, [rounds, searchTerm, firefighterFilter, shiftFilter, statusFilter]);

  // Summary Metrics for Reports
  const totalRounds = filteredRounds.length;
  const avgConformity = totalRounds
    ? Math.round(filteredRounds.reduce((acc, r) => acc + r.conformity, 0) / totalRounds)
    : 0;
  const totalOccurrences = filteredRounds.reduce((acc, r) => acc + r.non_conformities, 0);
  const totalApproved = filteredRounds.filter((r) => r.status === "Aprovado").length;

  return (
    <div className="content">
      <section className="section-head">
        <div>
          <p className="eyebrow">AUDITORIA E CONSULTA OPERACIONAL</p>
          <h2>Relatórios de Vistorias e Inspeções por Bombeiro</h2>
          <p className="muted">
            Consulte o histórico detalhado, filtre por bombeiro ou turno e clique em qualquer relatório para inspecionar as 20 respostas.
          </p>
        </div>
      </section>

      {/* Reports Dashboard Summary Cards */}
      <div className="stats" style={{ marginBottom: "24px" }}>
        <Metric label="TOTAL DE RONDAS AUDITADAS" value={totalRounds.toString()} detail="Vistorias filtradas" />
        <Metric
          label="MÉDIA DE CONFORMIDADE"
          value={`${avgConformity}%`}
          detail="Índice de segurança operacional"
          alert={avgConformity < 85}
        />
        <Metric
          label="NÃO CONFORMIDADES LEVANTADAS"
          value={totalOccurrences.toString()}
          detail="Itens irregulares nos postos"
          danger={totalOccurrences > 0}
        />
        <Metric label="RONDAS APROVADAS" value={`${totalApproved} / ${totalRounds}`} detail="Sem ressalvas graves" />
      </div>

      {/* Filters Toolbar */}
      <div className="report-filter-bar">
        <input
          type="text"
          placeholder="🔍 Buscar por Protocolo ou Nome do Bombeiro..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select value={firefighterFilter} onChange={(e) => setFirefighterFilter(e.target.value)}>
          <option value="all">Todos os Bombeiros ({firefighterOptions.length})</option>
          {firefighterOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}>
          <option value="all">Todos os Turnos</option>
          <option value="Diurno">Turno Diurno</option>
          <option value="Noturno">Turno Noturno</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Todos os Status</option>
          <option value="Aprovado">Aprovado</option>
          <option value="Em análise">Em análise</option>
          <option value="Ocorrência">Ocorrência</option>
        </select>
      </div>

      {/* Reports List Table */}
      <div className="reports-card">
        <div className="table-head" style={{ gridTemplateColumns: "minmax(200px, 1fr) 140px 110px 100px 140px" }}>
          <span>PROTOCOLO / RESPONSÁVEL</span>
          <span>DATA / HORÁRIO</span>
          <span>CONFORMIDADE</span>
          <span>STATUS</span>
          <span>AÇÃO</span>
        </div>

        {filteredRounds.length ? (
          filteredRounds.map((round) => {
            const tone = round.status === "Aprovado" ? "good" : round.status === "Ocorrência" ? "danger" : "warn";
            return (
              <div
                key={round.id}
                className="report-row"
                style={{ gridTemplateColumns: "minmax(200px, 1fr) 140px 110px 100px 140px", cursor: "pointer" }}
                onClick={() => setSelectedRound(round)}
              >
                <div className="report-main">
                  <strong>{round.protocol}</strong>
                  <span>
                    👤 <strong>{round.firefighter_name}</strong> ({round.shift}) · Posto TPS {round.tps_team}
                  </span>
                </div>
                <span className="report-date">{dateLabel(round.created_at)}</span>
                <b className="report-score" style={{ color: round.conformity === 100 ? "var(--green)" : "var(--red)" }}>
                  {round.conformity}%
                </b>
                <div>
                  <Tag tone={tone}>{round.status}</Tag>
                </div>
                <div>
                  <button
                    type="button"
                    className="primary"
                    style={{ padding: "6px 10px", fontSize: "11px" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRound(round);
                    }}
                  >
                    🔎 Ver 20 Respostas
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-line" style={{ padding: "24px", textAlign: "center" }}>
            Nenhum relatório encontrado para os filtros selecionados.
          </div>
        )}
      </div>

      {/* Round Detailed Audit Modal */}
      {selectedRound && (
        <RoundDetailsModal
          round={selectedRound}
          onClose={() => setSelectedRound(null)}
          onUpdateStatus={(roundId, newStatus) => {
            onUpdateRoundStatus(roundId, newStatus);
            setSelectedRound((curr) => (curr ? { ...curr, status: newStatus } : null));
          }}
        />
      )}
    </div>
  );
}

function People({ people, onAdd }: { people: Firefighter[]; onAdd: () => void }) {
  return (
    <div className="content">
      <section className="section-head people-head">
        <div>
          <p className="eyebrow">GESTÃO DE ACESSOS</p>
          <h2>Bombeiros e vínculos operacionais</h2>
          <p className="muted">Os vínculos preenchem automaticamente a identificação da ronda.</p>
        </div>
        <button className="primary" onClick={onAdd}>
          + Cadastrar bombeiro
        </button>
      </section>
      <div className="people-card">
        <div className="table-head people-table">
          <span>BOMBEIRO</span>
          <span>TURNO</span>
          <span>TPS</span>
          <span>TECA / HANGAR</span>
          <span>STATUS</span>
        </div>
        {people.map((person) => (
          <div className="person-row" key={person.id ?? person.name}>
            <div>
              <div className="avatar">{person.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}</div>
              <strong>{person.name}</strong>
            </div>
            <span>{person.shift}</span>
            <span>
              <Tag>{person.tps_team}</Tag>
            </span>
            <span>
              TECA {person.teca_team} · Hangar {person.hangar_united_team}
            </span>
            <span>
              <Tag tone={person.active ? "good" : "neutral"}>{person.active ? "Ativo" : "Inativo"}</Tag>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Checklist({
  people,
  operator,
  setOperator,
  firefighter,
  answers,
  setAnswers,
  issues,
  setIssues,
  finalMessage,
  setFinalMessage,
  completed,
  conformity,
  nonConformities,
  saving,
  submittedProtocol,
  onSubmit
}: {
  people: Firefighter[];
  operator: string;
  setOperator: (value: string) => void;
  firefighter?: Firefighter;
  answers: Record<number, Status>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, Status>>>;
  issues: Record<number, Issue>;
  setIssues: React.Dispatch<React.SetStateAction<Record<number, Issue>>>;
  finalMessage: string;
  setFinalMessage: (value: string) => void;
  completed: number;
  conformity: number;
  nonConformities: number;
  saving: boolean;
  submittedProtocol: string | null;
  onSubmit: () => void;
}) {
  const updateIssue = (index: number, patch: Partial<Issue>) =>
    setIssues((current) => ({
      ...current,
      [index]: { ...(current[index] ?? emptyIssue()), ...patch }
    }));

  return (
    <div className="content checklist-layout">
      <div>
        <section className="check-header">
          <div>
            <p className="eyebrow">FORMULÁRIO OFICIAL · SBGL</p>
            <h2>Inspeção operacional</h2>
            <p className="muted">Vistoria do sistema de combate a incêndio, equipamentos e abertura de SS.</p>
          </div>
          <Tag tone="warn">Em preenchimento</Tag>
        </section>
        <section className="identity">
          <label>
            NOME COMPLETO
            <select value={operator} onChange={(event) => setOperator(event.target.value)}>
              {people.map((person) => (
                <option key={person.id ?? person.name}>{person.name}</option>
              ))}
            </select>
          </label>
          <label>
            TURNO
            <input readOnly value={firefighter?.shift ?? ""} />
          </label>
          <label>
            POSTO 1 — TPS
            <input readOnly value={firefighter?.tps_team ?? ""} />
          </label>
          <label>
            POSTO 2 — TECA
            <input readOnly value={firefighter?.teca_team ?? ""} />
          </label>
          <label>
            POSTO 3 — HANGAR UNITED
            <input readOnly value={firefighter?.hangar_united_team ?? ""} />
          </label>
        </section>
        <section className="check-card">
          <div className="check-title">
            <span>ACESSO, SISTEMAS E EQUIPAMENTOS</span>
            <span>CONDIÇÃO</span>
          </div>
          {checklistItems.map((item, index) => (
            <div className="check-row" key={item}>
              <div>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <span>{item}</span>
              </div>
              <div className="choice-set">
                {(["Conforme", "Não conforme", "N/A"] as Status[]).map((status) => (
                  <button
                    type="button"
                    key={status}
                    onClick={() => setAnswers((current) => ({ ...current, [index]: status }))}
                    className={`choice ${answers[index] === status ? status.toLowerCase().replace(" ", "-") : ""}`}
                  >
                    {status === "Conforme" ? "✓" : status === "Não conforme" ? "!" : "—"}
                    <small>{status}</small>
                  </button>
                ))}
              </div>
              {answers[index] === "Não conforme" && (
                <div className="detailed-issue">
                  <strong>Detalhamento da não conformidade</strong>
                  <input
                    value={issues[index]?.location ?? ""}
                    onChange={(event) => updateIssue(index, { location: event.target.value })}
                    placeholder="Local (ex.: rampa de acesso do 2º andar)"
                  />
                  <textarea
                    value={issues[index]?.observation ?? ""}
                    onChange={(event) => updateIssue(index, { observation: event.target.value })}
                    placeholder="Descrição da não conformidade"
                  />
                  <input
                    value={issues[index]?.action_taken ?? ""}
                    onChange={(event) => updateIssue(index, { action_taken: event.target.value })}
                    placeholder="Providência adotada pelo bombeiro"
                  />
                  <input
                    value={issues[index]?.supervisor_notified ?? ""}
                    onChange={(event) => updateIssue(index, { supervisor_notified: event.target.value })}
                    placeholder="Supervisor comunicado / horário"
                  />
                  <input
                    value={issues[index]?.ss_number ?? ""}
                    onChange={(event) => updateIssue(index, { ss_number: event.target.value })}
                    placeholder="Número de SS"
                  />
                  <label className="photo-input">
                    Registro fotográfico (Timestamp)
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(event) => updateIssue(index, { photo: event.target.files?.[0] ?? null })}
                    />
                  </label>
                </div>
              )}
            </div>
          ))}
        </section>
        {nonConformities > 0 && (
          <section className="general-notes">
            <p className="eyebrow">OBSERVAÇÕES GERAIS</p>
            <label>
              Mensagem final
              <textarea
                value={finalMessage}
                onChange={(event) => setFinalMessage(event.target.value)}
                placeholder="Declaro que a ronda operacional foi realizada conforme os procedimentos estabelecidos..."
              />
            </label>
          </section>
        )}
      </div>
      <aside className="progress-panel">
        <p className="eyebrow">PROGRESSO DA RONDA</p>
        <div className="progress-circle">
          <b>
            {completed}
            <small>/ 20</small>
          </b>
          <span>itens avaliados</span>
        </div>
        <div className="progress-line">
          <i style={{ width: `${(completed / 20) * 100}%` }} />
        </div>
        <div className="summary">
          <p>
            <span>Conformidade atual</span>
            <b>{conformity}%</b>
          </p>
          <p>
            <span>Não conformidades</span>
            <b className={nonConformities ? "red" : ""}>{nonConformities}</b>
          </p>
        </div>
        <button
          className="primary full"
          disabled={completed !== 20 || saving || !firefighter}
          onClick={onSubmit}
        >
          {saving ? "Enviando…" : "Enviar ronda para validação"}
        </button>
        {completed !== 20 && <small className="hint">Complete todos os 20 itens para liberar o envio.</small>}
        {submittedProtocol && (
          <div className="success">
            ✓ Ronda enviada com sucesso.
            <br />
            <small>Protocolo {submittedProtocol} criado.</small>
          </div>
        )}
      </aside>

      {/* Floating Mobile/Tablet Progress Bar */}
      <div className="mobile-progress-bar">
        <div className="mobile-progress-info">
          <strong>
            {completed}/20 Avaliados {completed === 20 ? "✓ Prontos" : ""}
          </strong>
          <span>
            {completed === 20
              ? nonConformities > 0
                ? `${nonConformities} não conformidade(s)`
                : "100% Conforme"
              : `Faltam ${20 - completed} item(ns)`}
          </span>
        </div>
        <button
          className="primary"
          disabled={completed !== 20 || saving || !firefighter}
          onClick={onSubmit}
        >
          {saving ? "Enviando…" : "Enviar Ronda"}
        </button>
      </div>
    </div>
  );
}

function PersonModal({ onClose, onSave }: { onClose: () => void; onSave: (person: Firefighter) => Promise<void> }) {
  const [name, setName] = useState("");
  const [shift, setShift] = useState<"Diurno" | "Noturno">("Diurno");
  const [tps, setTps] = useState<Team>("Alfa");
  const [teca, setTeca] = useState<Team>("Alfa");
  const [hangar, setHangar] = useState<Team>("Alfa");
  const [error, setError] = useState("");

  const teamOptions = (value: Team, setValue: (value: Team) => void) => (
    <select value={value} onChange={(event) => setValue(event.target.value as Team)}>
      {(["Alfa", "Bravo", "Charlie", "Delta"] as Team[]).map((team) => (
        <option key={team}>{team}</option>
      ))}
    </select>
  );

  return (
    <div className="modal-backdrop">
      <form
        className="modal"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await onSave({ name: name.trim(), shift, tps_team: tps, teca_team: teca, hangar_united_team: hangar, active: true });
          } catch {
            setError("Não foi possível salvar o bombeiro.");
          }
        }}
      >
        <button type="button" className="close" onClick={onClose}>
          ×
        </button>
        <p className="eyebrow">NOVO CADASTRO</p>
        <h2>Cadastrar bombeiro</h2>
        <label>
          Nome completo
          <input autoFocus required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Turno
          <select value={shift} onChange={(event) => setShift(event.target.value as "Diurno" | "Noturno")}>
            <option>Diurno</option>
            <option>Noturno</option>
          </select>
        </label>
        <div className="form-grid">
          <label>
            Posto 1 — TPS
            {teamOptions(tps, setTps)}
          </label>
          <label>
            Posto 2 — TECA
            {teamOptions(teca, setTeca)}
          </label>
        </div>
        <label>
          Posto 3 — Hangar United
          {teamOptions(hangar, setHangar)}
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary">Salvar cadastro</button>
        </div>
      </form>
    </div>
  );
}
