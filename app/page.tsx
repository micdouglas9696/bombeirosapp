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
        {view === "reports" && role === "admin" && <Reports rounds={rounds} />}
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
          <div className="role-card" onClick={onSelectAdmin}>
            <span className="role-badge">Acesso Restrito</span>
            <div className="role-icon">🛡️</div>
            <h3>Administrador</h3>
            <p>Acesse a visão geral das operações, relatórios de auditoria e gerencie os cadastros da equipe de bombeiros.</p>
            <div className="role-btn">
              <span>Entrar com senha</span>
              <span>→</span>
            </div>
          </div>

          <div className="role-card" onClick={onSelectFirefighter}>
            <span className="role-badge">Operacional</span>
            <div className="role-icon">👨‍🚒</div>
            <h3>Bombeiro Operacional</h3>
            <p>Identifique-se para iniciar o preenchimento de uma nova ronda de inspeção nos postos TPS, TECA e Hangar.</p>
            <div className="role-btn">
              <span>Iniciar Nova Ronda</span>
              <span>→</span>
            </div>
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
        <button type="button" className="close" onClick={onClose}>
          ×
        </button>
        <div style={{ textAlign: "center", marginBottom: "10px" }}>
          <img
            src="/LOGO-ENSEG-branco.png"
            alt="ENSEG"
            className="modal-logo-img"
            style={{ background: "#0e0f11", padding: "6px 14px", borderRadius: "6px", display: "inline-block" }}
          />
        </div>
        <p className="eyebrow" style={{ textAlign: "center" }}>AUTENTICAÇÃO RESTRITA</p>
        <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Acesso do Administrador</h2>
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
        <button type="button" className="close" onClick={onClose}>
          ×
        </button>
        <div style={{ textAlign: "center", marginBottom: "10px" }}>
          <img
            src="/LOGO-ENSEG-branco.png"
            alt="ENSEG"
            className="modal-logo-img"
            style={{ background: "#0e0f11", padding: "6px 14px", borderRadius: "6px", display: "inline-block" }}
          />
        </div>
        <p className="eyebrow" style={{ textAlign: "center" }}>IDENTIFICAÇÃO OPERACIONAL</p>
        <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Identificação do Bombeiro</h2>
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

function ReportRow({ report }: { report: Round }) {
  const tone = report.status === "Aprovado" ? "good" : report.status === "Ocorrência" ? "danger" : "warn";
  return (
    <article className="report-row">
      <div className="report-icon">✓</div>
      <div className="report-main">
        <strong>{report.protocol}</strong>
        <span>
          {report.firefighter_name} · {report.shift} · TPS {report.tps_team}
        </span>
      </div>
      <span className="report-date">{dateLabel(report.created_at)}</span>
      <b className="report-score">{report.conformity}%</b>
      <Tag tone={tone}>{report.status}</Tag>
      <span />
    </article>
  );
}

function Reports({ rounds }: { rounds: Round[] }) {
  return (
    <div className="content">
      <div className="reports-card">
        <div className="table-head">
          <span>PROTOCOLO / RESPONSÁVEL</span>
          <span>DATA</span>
          <span>CONFORMIDADE</span>
          <span>STATUS</span>
          <span />
        </div>
        {rounds.length ? rounds.map((round) => <ReportRow key={round.id} report={round} />) : <div className="empty-line">Nenhum relatório disponível.</div>}
      </div>
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
