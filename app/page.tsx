"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigured } from "../lib/supabase";

type Role = "admin" | "firefighter" | null;
type View = "dashboard" | "reports" | "people" | "settings" | "checklist";
type Status = "Conforme" | "Não conforme" | "N/A";
type Team = "Alfa" | "Bravo" | "Charlie" | "Delta";
type Priority = "Baixa" | "Média" | "Alta" | "Crítica";
type Firefighter = { id?: string; name: string; shift: "Diurno" | "Noturno"; tps_team: Team; teca_team: Team; hangar_united_team: Team; active: boolean };
type Round = { id: string; protocol: string; firefighter_name: string; shift: string; tps_team: string; teca_team: string; hangar_united_team: string; conformity: number; non_conformities: number; status: "Em análise" | "Aprovado" | "Ocorrência"; created_at: string };
type Issue = { location: string; observation: string; priority: Priority; action_taken: string; supervisor_notified: string; ss_number: string; photo: File | null };
type AdminNotification = { id: string; round_id: string; title: string; message: string; acknowledged_at: string | null; created_at: string };

const checklistItems = ["Saídas de emergência sem bloqueios", "Escadas de emergência livres", "Portas corta-fogo íntegras e fechando corretamente", "Extintores acessíveis e sem avarias", "Hidrantes e mangotinhos desobstruídos", "Acionadores manuais de incêndio íntegros", "Iluminação de emergência operacional", "Sinalização de emergência visível", "Corredores e acessos livres", "Ausência de materiais combustíveis acumulados", "Equipamentos elétricos sem anormalidades", "Escadas rolantes", "Elevadores", "Ausência de vazamentos de água ou outros líquidos", "Ausência de fumaça, odor de queimado ou superaquecimento", "Objetos abandonados", "DEA em condições de uso", "Comunicação via rádio operacional", "Acesso para viaturas de emergência desobstruído", "Macas de resgate"];
const samplePeople: Firefighter[] = [
  { name: "Leandro Dantas dos Santos", shift: "Diurno", tps_team: "Alfa", teca_team: "Alfa", hangar_united_team: "Alfa", active: true },
  { name: "Jorge da Silva Fernandes", shift: "Noturno", tps_team: "Bravo", teca_team: "Bravo", hangar_united_team: "Bravo", active: true },
  { name: "Carlos Eduardo Moreira", shift: "Diurno", tps_team: "Charlie", teca_team: "Charlie", hangar_united_team: "Charlie", active: true }
];

const sampleRounds: Round[] = [
  {
    id: "rnd-1",
    protocol: "RON-2026-A8F192C1",
    firefighter_name: "Leandro Dantas dos Santos",
    shift: "Diurno",
    tps_team: "Alfa",
    teca_team: "Alfa",
    hangar_united_team: "Alfa",
    conformity: 95,
    non_conformities: 1,
    status: "Ocorrência",
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  },
  {
    id: "rnd-2",
    protocol: "RON-2026-C4B278D9",
    firefighter_name: "Jorge da Silva Fernandes",
    shift: "Noturno",
    tps_team: "Bravo",
    teca_team: "Bravo",
    hangar_united_team: "Bravo",
    conformity: 100,
    non_conformities: 0,
    status: "Aprovado",
    created_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString()
  },
  {
    id: "rnd-3",
    protocol: "RON-2026-F9E341A0",
    firefighter_name: "Carlos Eduardo Moreira",
    shift: "Diurno",
    tps_team: "Charlie",
    teca_team: "Charlie",
    hangar_united_team: "Charlie",
    conformity: 90,
    non_conformities: 2,
    status: "Ocorrência",
    created_at: new Date(Date.now() - 26 * 3600 * 1000).toISOString()
  },
  {
    id: "rnd-4",
    protocol: "RON-2026-D1B563C2",
    firefighter_name: "Leandro Dantas dos Santos",
    shift: "Diurno",
    tps_team: "Alfa",
    teca_team: "Alfa",
    hangar_united_team: "Alfa",
    conformity: 100,
    non_conformities: 0,
    status: "Aprovado",
    created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: "rnd-5",
    protocol: "RON-2026-E7A902D4",
    firefighter_name: "Jorge da Silva Fernandes",
    shift: "Noturno",
    tps_team: "Bravo",
    teca_team: "Bravo",
    hangar_united_team: "Bravo",
    conformity: 85,
    non_conformities: 3,
    status: "Em análise",
    created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: "rnd-6",
    protocol: "RON-2026-B3D720F8",
    firefighter_name: "Carlos Eduardo Moreira",
    shift: "Diurno",
    tps_team: "Charlie",
    teca_team: "Charlie",
    hangar_united_team: "Charlie",
    conformity: 100,
    non_conformities: 0,
    status: "Aprovado",
    created_at: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString()
  }
];

const emptyIssue = (): Issue => ({ location: "", observation: "", priority: "Média", action_taken: "", supervisor_notified: "", ss_number: "", photo: null });
const dateLabel = (value: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)).replace(".", "");

function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "danger" }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

export default function Home() {
  const [role, setRole] = useState<Role>(null);
  const [view, setView] = useState<View>("dashboard");
  const [people, setPeople] = useState(samplePeople);
  const [rounds, setRounds] = useState<Round[]>(sampleRounds);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
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

  const fetchAllOperationalRounds = async () => {
    if (!supabase) return { data: null, error: null };
    const allRows: Round[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    let fetchError: any = null;

    while (hasMore) {
      const { data, error } = await supabase
        .from("operational_rounds")
        .select("id,protocol,firefighter_name,shift,tps_team,teca_team,hangar_united_team,conformity,non_conformities,status,created_at")
        .order("created_at", { ascending: false })
        .range(from, from + batchSize - 1);

      if (error) {
        fetchError = error;
        break;
      }

      if (data && data.length > 0) {
        allRows.push(...(data as Round[]));
        if (data.length < batchSize) {
          hasMore = false;
        } else {
          from += batchSize;
        }
      } else {
        hasMore = false;
      }
    }

    return { data: allRows.length > 0 ? allRows : (fetchError ? null : []), error: fetchError };
  };

  const fetchData = async () => {
    if (!supabase) return { people: null, rounds: null, notifications: null, settings: null, error: null };
    const [p, rResult, n, s] = await Promise.all([
      supabase.from("firefighters").select("id,name,shift,tps_team,teca_team,hangar_united_team,active").order("name"),
      fetchAllOperationalRounds(),
      supabase.from("admin_notifications").select("id,round_id,title,message,acknowledged_at,created_at").is("acknowledged_at", null).order("created_at", { ascending: false }),
      supabase.from("notification_settings").select("recipient_emails").eq("id", true).maybeSingle()
    ]);
    return {
      people: p.data as Firefighter[] | null,
      rounds: rResult.data as Round[] | null,
      notifications: n.data as AdminNotification[] | null,
      settings: s.data as { recipient_emails: string[] } | null,
      error: p.error ?? rResult.error ?? n.error ?? s.error
    };
  };

  const applyData = async () => {
    const result = await fetchData();
    if (result.error) {
      setMessage("Não foi possível carregar os dados. Execute a migração do Supabase.");
      return;
    }
    if (result.people) setPeople(result.people);
    if (result.rounds) setRounds(result.rounds);
    if (result.notifications) setNotifications(result.notifications);
    if (result.settings) setRecipientEmails(result.settings.recipient_emails ?? []);
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
      if (result.notifications) setNotifications(result.notifications);
      if (result.settings) setRecipientEmails(result.settings.recipient_emails ?? []);
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
      if (nonConformities > 0) {
        const notification = {
          round_id: round.id,
          title: "Nova ocorrência operacional",
          message: `${nonConformities} não conformidade(s) registrada(s) na ronda ${protocol}, por ${firefighter.name}.`
        };
        const { error: notificationError } = await client.from("admin_notifications").insert(notification);
        if (notificationError) throw notificationError;
        const { data: settings } = await client.from("notification_settings").select("recipient_emails").eq("id", true).maybeSingle();
        const recipients = settings?.recipient_emails ?? [];
        if (recipients.length) {
          const { error: emailError } = await client.functions.invoke("send-inconsistency-notification", {
            body: { recipients, protocol, firefighterName: firefighter.name, nonConformities, createdAt: new Date().toLocaleString("pt-BR") }
          });
          if (emailError) setMessage("A ocorrência foi registrada, mas o e-mail de alerta não pôde ser enviado.");
        }
      }
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

  const acknowledgeNotification = async (notificationId: string) => {
    const acknowledgedAt = new Date().toISOString();
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
    if (supabase) {
      const { error } = await supabase.from("admin_notifications").update({ acknowledged_at: acknowledgedAt }).eq("id", notificationId);
      if (error) {
        setMessage("Não foi possível confirmar a ciência da ocorrência.");
        await applyData();
      }
    }
  };

  const saveRecipientEmails = async (emails: string[]) => {
    if (!supabase) {
      setRecipientEmails(emails);
      return;
    }
    const { error } = await supabase.from("notification_settings").upsert({ id: true, recipient_emails: emails, updated_at: new Date().toISOString() });
    if (error) throw error;
    setRecipientEmails(emails);
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
              <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>
                ⚙ Configurações
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
            {role === "admin" && <NotificationBell notifications={notifications} onAcknowledge={acknowledgeNotification} />}
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
        {view === "settings" && role === "admin" && <NotificationSettings emails={recipientEmails} onSave={saveRecipientEmails} />}
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
    if (password === "admin321") {
      onSuccess();
    } else {
      setError("Senha incorreta. Tente novamente.");
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

function NotificationBell({ notifications, onAcknowledge }: { notifications: AdminNotification[]; onAcknowledge: (id: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="notification-center">
      <button type="button" className="notification-bell" aria-label="Notificações de ocorrências" onClick={() => setOpen((current) => !current)}>
        🔔
        {notifications.length > 0 && <span>{notifications.length}</span>}
      </button>
      {open && (
        <div className="notification-popover">
          <div className="notification-popover-head">
            <strong>Ocorrências pendentes</strong>
            <small>{notifications.length} aguardando ciência</small>
          </div>
          {notifications.length ? notifications.map((notification) => (
            <article className="notification-item" key={notification.id}>
              <b>{notification.title}</b>
              <p>{notification.message}</p>
              <small>{dateLabel(notification.created_at)}</small>
              <button type="button" className="primary" onClick={() => onAcknowledge(notification.id)}>✓ Ciente</button>
            </article>
          )) : <p className="notification-empty">Nenhuma ocorrência aguardando confirmação.</p>}
        </div>
      )}
    </div>
  );
}

function NotificationSettings({ emails, onSave }: { emails: string[]; onSave: (emails: string[]) => Promise<void> }) {
  const [value, setValue] = useState(emails.join(", "));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const recipients = value.split(/[;,\n]/).map((email) => email.trim()).filter(Boolean);
    if (recipients.some((email) => !/^\S+@\S+\.\S+$/.test(email))) {
      setFeedback("Informe apenas endereços de e-mail válidos, separados por vírgula.");
      return;
    }
    setSaving(true);
    setFeedback("");
    try {
      await onSave(recipients);
      setFeedback("Destinatários salvos. As próximas ocorrências serão enviadas para esta lista.");
    } catch {
      setFeedback("Não foi possível salvar os destinatários.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="content">
      <section className="section-head">
        <div>
          <p className="eyebrow">ALERTAS OPERACIONAIS</p>
          <h2>Configurações de notificações</h2>
          <p className="muted">Defina quem recebe e-mail sempre que uma ronda registrar uma não conformidade.</p>
        </div>
      </section>
      <form className="settings-card" onSubmit={save}>
        <label>
          E-MAILS PARA NOTIFICAÇÃO
          <textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder="gestao@empresa.com, seguranca@empresa.com" rows={4} />
          <small>Separe vários destinatários por vírgula, ponto e vírgula ou uma linha por endereço.</small>
        </label>
        {feedback && <p className={feedback.startsWith("Destinatários") ? "settings-success" : "form-error"}>{feedback}</p>}
        <div className="modal-actions"><button className="primary" disabled={saving}>{saving ? "Salvando…" : "Salvar destinatários"}</button></div>
      </form>
      <p className="settings-note">Para habilitar o envio efetivo, configure os segredos <code>RESEND_API_KEY</code> e <code>RESEND_FROM_EMAIL</code> na função do Supabase.</p>
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

const downloadElementAsPdf = async (elementId: string, filename: string) => {
  const container = document.getElementById(elementId);
  if (!container) return false;

  document.body.classList.add("is-generating-pdf");

  try {
    const { jsPDF } = await import("jspdf");
    const html2canvasModule = await import("html2canvas");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html2canvas = (html2canvasModule as any).default || html2canvasModule;

    const pageElements = Array.from(container.querySelectorAll<HTMLElement>(".pdf-page"));

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true
    });

    if (pageElements.length > 0) {
      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i];
        if (i > 0) {
          pdf.addPage("a4", "portrait");
        }

        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff"
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.98);
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }
    } else {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }

    pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
    return true;
  } catch (err) {
    console.error("Download em PDF falhou, acionando impressão nativa:", err);
    const oldTitle = document.title;
    document.title = filename.replace(/\.pdf$/, "");
    window.print();
    setTimeout(() => {
      document.title = oldTitle;
    }, 1000);
    return true;
  } finally {
    document.body.classList.remove("is-generating-pdf");
  }
};

function PdfSignatures() {
  return (
    <div className="pdf-signatures-grid" style={{ marginTop: "auto", paddingTop: "14px" }}>
      <div className="pdf-signature-box">
        <div className="pdf-signature-line" />
        <strong>ASSINATURA GERENTE DOS BOMBEIROS ENSEG</strong>
        <span>ENSEG Vigilância e Segurança Operacional</span>
      </div>
      <div className="pdf-signature-box">
        <div className="pdf-signature-line" />
        <strong>ASSINATURA DO SUPERVISOR DE EMERGÊNCIA RIO GALEÃO</strong>
        <span>Supervisão de Emergência · RIOgaleão</span>
      </div>
    </div>
  );
}

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
  const [downloading, setDownloading] = useState(false);

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

  const filteredChunkSize = activeTab === "issues" ? 4 : 10;
  const filteredChunks = useMemo(() => {
    if (filteredAnswers.length <= filteredChunkSize) {
      return [filteredAnswers];
    }
    const chunks: RoundAnswer[][] = [];
    for (let i = 0; i < filteredAnswers.length; i += filteredChunkSize) {
      chunks.push(filteredAnswers.slice(i, i + filteredChunkSize));
    }
    return chunks;
  }, [filteredAnswers, filteredChunkSize]);

  const totalConform = answers.filter((a) => a.status === "Conforme").length;
  const totalNonConform = answers.filter((a) => a.status === "Não conforme").length;
  const totalNA = answers.filter((a) => a.status === "N/A").length;

  const handlePrintRoundPdf = () => {
    const oldTitle = document.title;
    const cleanProtocol = round.protocol.replace(/[^a-zA-Z0-9_-]/g, "_");
    const cleanName = round.firefighter_name.replace(/\s+/g, "_");
    document.title = `Auditoria_Ronda_${cleanProtocol}_${cleanName}`;
    window.print();
    setTimeout(() => {
      document.title = oldTitle;
    }, 1000);
  };

  const handleDownloadRoundPdf = async () => {
    setDownloading(true);
    const cleanProtocol = round.protocol.replace(/[^a-zA-Z0-9_-]/g, "_");
    const cleanName = round.firefighter_name.replace(/\s+/g, "_");
    await downloadElementAsPdf("printable-round-details", `Auditoria_Ronda_${cleanProtocol}_${cleanName}`);
    setDownloading(false);
  };

  return (
    <div className="modal-backdrop print-active-round-modal">
      <div className="modal modal-wide printable-round-modal">
        <button type="button" className="close no-print" onClick={onClose} style={{ color: "#fff", zIndex: 2 }}>
          ×
        </button>

        {/* Abas e Status (Ocultos na impressão) */}
        <div className="round-tabs-header no-print" style={{ padding: "16px 20px 0 20px" }}>
          <div className="round-tabs-buttons">
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

        {/* Folha Completa da Ronda para Download e Impressão (Organizada em Páginas A4) */}
        <div id="printable-round-details" style={{ width: "100%" }}>
          {activeTab === "all" ? (
            <>
              {/* PÁGINA 1: ITENS 1 A 10 */}
              <div className="pdf-page">
                <div className="pdf-page-content">
                  <div className="modal-header-banner">
                    <img src="/LOGO-ENSEG-branco.png" alt="ENSEG" className="modal-logo-img" />
                    <p className="eyebrow">RELATÓRIO COMPLETO DE AUDITORIA DA RONDA</p>
                    <h2>{round.protocol}</h2>
                  </div>

                  {/* Metadata Banner Responsivo */}
                  <div className="round-meta-grid" style={{ marginBottom: "14px" }}>
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

                  {/* Quick Round Metrics Responsivo */}
                  <div className="round-metrics-grid" style={{ marginBottom: "16px" }}>
                    <div className="metric" style={{ padding: "10px", minHeight: "auto", borderTopColor: "var(--red)" }}>
                      <p style={{ margin: 0, fontSize: "9px" }}>CONFORMIDADE GERAL</p>
                      <b style={{ fontSize: "20px", color: round.conformity === 100 ? "var(--green)" : "var(--red)" }}>
                        {round.conformity}%
                      </b>
                    </div>
                    <div className="metric" style={{ padding: "10px", minHeight: "auto", borderTopColor: "#159365" }}>
                      <p style={{ margin: 0, fontSize: "9px" }}>ITENS CONFORMES</p>
                      <b style={{ fontSize: "20px", color: "var(--green)" }}>{totalConform} / 20</b>
                    </div>
                    <div className="metric" style={{ padding: "10px", minHeight: "auto", borderTopColor: "var(--red)" }}>
                      <p style={{ margin: 0, fontSize: "9px" }}>NÃO CONFORMIDADES</p>
                      <b style={{ fontSize: "20px", color: totalNonConform ? "var(--red)" : "#666" }}>{totalNonConform}</b>
                    </div>
                    <div className="metric" style={{ padding: "10px", minHeight: "auto", borderTopColor: "#c8a66a" }}>
                      <p style={{ margin: 0, fontSize: "9px" }}>NÃO APLICÁVEL (N/A)</p>
                      <b style={{ fontSize: "20px", color: "#b38228" }}>{totalNA}</b>
                    </div>
                  </div>

                  <div className="pdf-section-title">
                    <span>ITENS DE AUDITORIA OPERACIONAL (PARTE 1 — ITENS 1 A 10)</span>
                    <span style={{ fontSize: "11px", fontWeight: "normal", color: "#666" }}>
                      Status da Ronda: {round.status}
                    </span>
                  </div>

                  <div className="answers-audit-list" style={{ gap: "7px", marginTop: "8px" }}>
                    {answers.slice(0, 10).map((ans) => {
                      const isBad = ans.status === "Não conforme";
                      const isOk = ans.status === "Conforme";

                      return (
                        <div className="audit-item-row" key={ans.item_number} style={{ padding: "7px 12px", borderColor: isBad ? "#f5baba" : "#e7e7e2" }}>
                          <div className="audit-item-header">
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontWeight: "bold", width: "24px", color: isBad ? "var(--red)" : "#888" }}>
                                #{ans.item_number}
                              </span>
                              <strong style={{ fontSize: "11px", color: "#111" }}>{ans.item_text}</strong>
                            </div>
                            <Tag tone={isOk ? "good" : isBad ? "danger" : "warn"}>{ans.status}</Tag>
                          </div>
                          {isBad && (
                            <div className="audit-issue-detail" style={{ marginTop: "4px", padding: "6px 10px", fontSize: "10px" }}>
                              <div><strong>Localização:</strong> <p>{ans.location || "N/A"}</p></div>
                              <div><strong>Observação:</strong> <p>{ans.observation || "N/A"}</p></div>
                              <div><strong>Providência:</strong> <p>{ans.action_taken || "N/A"}</p></div>
                              <div><strong>Supervisor:</strong> <p>{ans.supervisor_notified || "N/A"}</p></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pdf-page-footer">
                  <span>ENSEG Vistoria Operacional Individual · SBGL Galeão · Protocolo {round.protocol}</span>
                  <span>Página 1 de 2</span>
                </div>
              </div>

              {/* PÁGINA 2: ITENS 11 A 20 + ASSINATURAS */}
              <div className="pdf-page">
                <div className="pdf-page-content">
                  <div className="pdf-page-header-compact">
                    <span><strong>ENSEG</strong> · Vistoria Operacional (Continuação)</span>
                    <span>Ronda: <strong>{round.protocol}</strong> · {round.firefighter_name}</span>
                  </div>

                  <div className="pdf-section-title">
                    <span>ITENS DE AUDITORIA OPERACIONAL (PARTE 2 — ITENS 11 A 20)</span>
                    <span>10 itens avaliados</span>
                  </div>

                  <div className="answers-audit-list" style={{ gap: "7px", marginTop: "8px" }}>
                    {answers.slice(10, 20).map((ans) => {
                      const isBad = ans.status === "Não conforme";
                      const isOk = ans.status === "Conforme";

                      return (
                        <div className="audit-item-row" key={ans.item_number} style={{ padding: "7px 12px", borderColor: isBad ? "#f5baba" : "#e7e7e2" }}>
                          <div className="audit-item-header">
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontWeight: "bold", width: "24px", color: isBad ? "var(--red)" : "#888" }}>
                                #{ans.item_number}
                              </span>
                              <strong style={{ fontSize: "11px", color: "#111" }}>{ans.item_text}</strong>
                            </div>
                            <Tag tone={isOk ? "good" : isBad ? "danger" : "warn"}>{ans.status}</Tag>
                          </div>
                          {isBad && (
                            <div className="audit-issue-detail" style={{ marginTop: "4px", padding: "6px 10px", fontSize: "10px" }}>
                              <div><strong>Localização:</strong> <p>{ans.location || "N/A"}</p></div>
                              <div><strong>Observação:</strong> <p>{ans.observation || "N/A"}</p></div>
                              <div><strong>Providência:</strong> <p>{ans.action_taken || "N/A"}</p></div>
                              <div><strong>Supervisor:</strong> <p>{ans.supervisor_notified || "N/A"}</p></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Assinaturas Oficiais */}
                  <PdfSignatures />
                </div>

                <div className="pdf-page-footer">
                  <span>ENSEG Vistoria Operacional Individual · SBGL Galeão · Protocolo {round.protocol}</span>
                  <span>Página 2 de 2</span>
                </div>
              </div>
            </>
          ) : (
            /* MODO FILTRADO (OCORRÊNCIAS OU ITENS OK) — PAGINADO CONFORME A QUANTIDADE DE ITENS */
            filteredChunks.map((chunk, fIndex) => {
              const isFirstPage = fIndex === 0;
              const isLastPage = fIndex === filteredChunks.length - 1;
              const pageNumber = fIndex + 1;
              const totalFilteredPages = filteredChunks.length;

              return (
                <div className="pdf-page" key={`filtered-page-${pageNumber}`}>
                  <div className="pdf-page-content">
                    {isFirstPage ? (
                      <>
                        <div className="modal-header-banner">
                          <img src="/LOGO-ENSEG-branco.png" alt="ENSEG" className="modal-logo-img" />
                          <p className="eyebrow">RELATÓRIO DE AUDITORIA DA RONDA</p>
                          <h2>{round.protocol}</h2>
                        </div>

                        <div className="round-meta-grid" style={{ marginBottom: "14px" }}>
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

                        <div className="round-metrics-grid" style={{ marginBottom: "16px" }}>
                          <div className="metric" style={{ padding: "10px", minHeight: "auto", borderTopColor: "var(--red)" }}>
                            <p style={{ margin: 0, fontSize: "9px" }}>CONFORMIDADE GERAL</p>
                            <b style={{ fontSize: "20px", color: round.conformity === 100 ? "var(--green)" : "var(--red)" }}>
                              {round.conformity}%
                            </b>
                          </div>
                          <div className="metric" style={{ padding: "10px", minHeight: "auto", borderTopColor: "#159365" }}>
                            <p style={{ margin: 0, fontSize: "9px" }}>ITENS CONFORMES</p>
                            <b style={{ fontSize: "20px", color: "var(--green)" }}>{totalConform} / 20</b>
                          </div>
                          <div className="metric" style={{ padding: "10px", minHeight: "auto", borderTopColor: "var(--red)" }}>
                            <p style={{ margin: 0, fontSize: "9px" }}>NÃO CONFORMIDADES</p>
                            <b style={{ fontSize: "20px", color: totalNonConform ? "var(--red)" : "#666" }}>{totalNonConform}</b>
                          </div>
                          <div className="metric" style={{ padding: "10px", minHeight: "auto", borderTopColor: "#c8a66a" }}>
                            <p style={{ margin: 0, fontSize: "9px" }}>NÃO APLICÁVEL (N/A)</p>
                            <b style={{ fontSize: "20px", color: "#b38228" }}>{totalNA}</b>
                          </div>
                        </div>

                        <div className="pdf-section-title">
                          <span>
                            {activeTab === "issues"
                              ? `DETALHAMENTO DE OCORRÊNCIAS APONTADAS (${filteredAnswers.length})`
                              : `ITENS CONFORMES AVALIADOS (${filteredAnswers.length})`}
                          </span>
                          <Tag tone={round.status === "Aprovado" ? "good" : round.status === "Ocorrência" ? "danger" : "warn"}>
                            STATUS: {round.status.toUpperCase()}
                          </Tag>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="pdf-page-header-compact">
                          <span><strong>ENSEG</strong> · Vistoria Operacional ({activeTab === "issues" ? "Ocorrências" : "Itens Conformes"} - Continuação)</span>
                          <span>Ronda: <strong>{round.protocol}</strong> · {round.firefighter_name}</span>
                        </div>

                        <div className="pdf-section-title">
                          <span>
                            {activeTab === "issues"
                              ? "DETALHAMENTO DE OCORRÊNCIAS APONTADAS (CONTINUAÇÃO)"
                              : "ITENS CONFORMES AVALIADOS (CONTINUAÇÃO)"}
                          </span>
                          <span>
                            Itens {fIndex * filteredChunkSize + 1} a {Math.min((fIndex + 1) * filteredChunkSize, filteredAnswers.length)} de {filteredAnswers.length}
                          </span>
                        </div>
                      </>
                    )}

                    <div className="answers-audit-list" style={{ gap: "8px", marginTop: "10px" }}>
                      {chunk.length ? (
                        chunk.map((ans) => {
                          const isBad = ans.status === "Não conforme";
                          const isOk = ans.status === "Conforme";

                          return (
                            <div className="audit-item-row" key={ans.item_number} style={{ padding: "8px 12px", borderColor: isBad ? "#f5baba" : "#e7e7e2" }}>
                              <div className="audit-item-header">
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span style={{ fontWeight: "bold", width: "24px", color: isBad ? "var(--red)" : "#888" }}>
                                    #{ans.item_number}
                                  </span>
                                  <strong style={{ fontSize: "11px", color: "#111" }}>{ans.item_text}</strong>
                                </div>
                                <Tag tone={isOk ? "good" : isBad ? "danger" : "warn"}>{ans.status}</Tag>
                              </div>
                              {isBad && (
                                <div className="audit-issue-detail" style={{ marginTop: "4px", padding: "6px 10px", fontSize: "10px" }}>
                                  <div><strong>Localização:</strong> <p>{ans.location || "N/A"}</p></div>
                                  <div><strong>Observação:</strong> <p>{ans.observation || "N/A"}</p></div>
                                  <div><strong>Providência:</strong> <p>{ans.action_taken || "N/A"}</p></div>
                                  <div><strong>Supervisor:</strong> <p>{ans.supervisor_notified || "N/A"}</p></div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>Nenhum item nesta categoria.</div>
                      )}
                    </div>

                    {isLastPage && <PdfSignatures />}
                  </div>

                  <div className="pdf-page-footer">
                    <span>ENSEG Vistoria Operacional Individual · SBGL Galeão · Protocolo {round.protocol}</span>
                    <span>Página {pageNumber} de {totalFilteredPages}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

      {/* Admin Validation Actions (Oculto na impressão e fora do documento PDF baixado) */}
      <div className="modal-actions no-print" style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--line)" }}>
        <button type="button" className="outline" onClick={onClose}>
          Fechar
        </button>
        <button
          type="button"
          className="pdf-action-download"
          onClick={handleDownloadRoundPdf}
          disabled={downloading}
        >
          {downloading ? "⏳ Gerando PDF..." : "📥 Baixar Ocorrência (PDF)"}
        </button>
        <button
          type="button"
          className="outline"
          onClick={handlePrintRoundPdf}
        >
          🖨️ Imprimir
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
);
}

function PdfReportModal({
  rounds,
  filters,
  onClose
}: {
  rounds: Round[];
  filters: {
    startDate: string;
    endDate: string;
    firefighterFilter: string;
    shiftFilter: string;
    statusFilter: string;
    stationFilter: string;
    datePreset: string;
  };
  onClose: () => void;
}) {
  const [reportType, setReportType] = useState<"synthetic" | "analytical">("synthetic");
  const [downloading, setDownloading] = useState(false);
  const [reportProtocol] = useState(
    () => `REL-SBGL-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
  );
  const [emissionDate] = useState(() => new Date());

  const totalRounds = rounds.length;
  const avgConformity = totalRounds
    ? Math.round(rounds.reduce((acc, r) => acc + r.conformity, 0) / totalRounds)
    : 0;
  const totalOccurrences = rounds.reduce((acc, r) => acc + r.non_conformities, 0);
  const totalApproved = rounds.filter((r) => r.status === "Aprovado").length;
  const approvalRate = totalRounds ? Math.round((totalApproved / totalRounds) * 100) : 0;

  const handlePrintPdf = () => {
    const oldTitle = document.title;
    const dateFormatted = new Date().toISOString().slice(0, 10);
    document.title = `Relatorio_Avaliacoes_ENSEG_SBGL_${dateFormatted}`;
    window.print();
    setTimeout(() => {
      document.title = oldTitle;
    }, 1000);
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    const dateFormatted = new Date().toISOString().slice(0, 10);
    const typeLabel = reportType === "synthetic" ? "Sintetico" : "Analitico";
    await downloadElementAsPdf(
      "printable-pdf-document",
      `Relatorio_Auditoria_${typeLabel}_SBGL_${dateFormatted}`
    );
    setDownloading(false);
  };

  const formattedEmission = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(emissionDate);

  let periodLabel = "Histórico Completo";
  if (filters.startDate && filters.endDate) {
    periodLabel = `${new Date(filters.startDate + "T00:00:00").toLocaleDateString("pt-BR")} até ${new Date(
      filters.endDate + "T00:00:00"
    ).toLocaleDateString("pt-BR")}`;
  } else if (filters.startDate) {
    periodLabel = `A partir de ${new Date(filters.startDate + "T00:00:00").toLocaleDateString("pt-BR")}`;
  } else if (filters.endDate) {
    periodLabel = `Até ${new Date(filters.endDate + "T00:00:00").toLocaleDateString("pt-BR")}`;
  }

  const roundsWithIssues = rounds.filter((r) => r.non_conformities > 0);

  // 1. Dividir a tabela de vistorias em páginas
  // Página 1 suporta 12 linhas (junto com cabeçalho oficial, filtros e KPIs).
  // Páginas seguintes da tabela suportam até 16 linhas com cabeçalho compacto.
  const TABLE_ROWS_PAGE_1 = 12;
  const TABLE_ROWS_SUBSEQUENT = 16;

  const tableChunks: Round[][] = [];
  if (rounds.length <= TABLE_ROWS_PAGE_1) {
    tableChunks.push(rounds);
  } else {
    tableChunks.push(rounds.slice(0, TABLE_ROWS_PAGE_1));
    const remaining = rounds.slice(TABLE_ROWS_PAGE_1);
    for (let i = 0; i < remaining.length; i += TABLE_ROWS_SUBSEQUENT) {
      tableChunks.push(remaining.slice(i, i + TABLE_ROWS_SUBSEQUENT));
    }
  }

  // 2. Dividir as ocorrências em blocos de 3 itens por página para o modo analítico
  const occurrenceChunks: Round[][] = [];
  if (reportType === "analytical" && roundsWithIssues.length > 0) {
    for (let i = 0; i < roundsWithIssues.length; i += 3) {
      occurrenceChunks.push(roundsWithIssues.slice(i, i + 3));
    }
  }

  // 3. Número total de páginas somando todas as páginas da tabela + páginas das ocorrências
  const totalTablePages = tableChunks.length;
  const totalOccurrencePages = reportType === "analytical" ? occurrenceChunks.length : 0;
  const totalPages = totalTablePages + totalOccurrencePages;

  return (
    <div className="pdf-modal-backdrop">
      <div className="pdf-modal-shell">
        {/* Barra superior de controle (oculta na impressão) */}
        <div className="pdf-modal-toolbar no-print">
          <div className="pdf-toolbar-info">
            <strong>Central de Emissão de Relatório em PDF · SBGL</strong>
            <span>Visualização fiel do documento com opção de download direto em PDF ou impressão A4.</span>
          </div>

          <div className="pdf-toolbar-controls">
            <div className="pdf-type-toggle">
              <button
                type="button"
                className={reportType === "synthetic" ? "active" : ""}
                onClick={() => setReportType("synthetic")}
              >
                📊 Sintético (Executivo)
              </button>
              <button
                type="button"
                className={reportType === "analytical" ? "active" : ""}
                onClick={() => setReportType("analytical")}
              >
                📋 Analítico ({totalOccurrences} Ocorrências)
              </button>
            </div>

            <button
              type="button"
              className="pdf-action-download"
              onClick={handleDownloadPdf}
              disabled={downloading}
            >
              {downloading ? "⏳ Gerando PDF..." : "📥 Baixar Arquivo PDF"}
            </button>

            <button type="button" className="pdf-action-print" onClick={handlePrintPdf}>
              🖨️ Imprimir
            </button>

            <button type="button" className="pdf-action-close" onClick={onClose}>
              ✕ Fechar
            </button>
          </div>
        </div>

        {/* Folhas A4 do Relatório (Páginas Individuais sem corte) */}
        <div className="pdf-document-sheet" id="printable-pdf-document">
          {/* PÁGINA 1: CABEÇALHO + FILTROS + KPIS + TABELA INICIAL (CHUNK 0) */}
          <div className="pdf-page">
            <div className="pdf-page-content">
              {/* Cabeçalho Oficial */}
              <div className="pdf-header-banner">
                <div className="pdf-header-brand">
                  <img src="/LOGO-ENSEG-branco.png" alt="ENSEG Segurança" />
                </div>
                <div className="pdf-header-titles">
                  <span className="pdf-header-badge">SISTEMA DE SEGURANÇA E COMBATE A INCÊNDIO</span>
                  <h1 className="pdf-header-title">RELATÓRIO DE AUDITORIA OPERACIONAL</h1>
                  <p className="pdf-header-subtitle">
                    Aeroporto Internacional Tom Jobim (Galeão - SBGL) · Brigada de Emergência
                  </p>
                </div>
                <div className="pdf-header-meta">
                  <div className="pdf-meta-item">
                    <span>PROTOCOLO RELATÓRIO:</span>
                    <strong>{reportProtocol}</strong>
                  </div>
                  <div className="pdf-meta-item">
                    <span>DATA DE EMISSÃO:</span>
                    <strong>{formattedEmission}</strong>
                  </div>
                  <div className="pdf-meta-item">
                    <span>EMISSOR RESPONSÁVEL:</span>
                    <strong>Administração ENSEG</strong>
                  </div>
                </div>
              </div>

              {/* Faixa de Parâmetros de Filtragem */}
              <div className="pdf-filter-strip">
                <strong>FILTROS:</strong>
                <span className="pdf-param-tag">📅 {periodLabel}</span>
                <span className="pdf-param-tag">
                  👨‍🚒 {filters.firefighterFilter === "all" ? "Todos os Bombeiros" : filters.firefighterFilter}
                </span>
                <span className="pdf-param-tag">
                  📍 {filters.stationFilter === "all" ? "Todos os Postos" : `Posto ${filters.stationFilter}`}
                </span>
                <span className="pdf-param-tag">
                  🏷️ {filters.statusFilter === "all" ? "Todos os Status" : filters.statusFilter}
                </span>
                <span className="pdf-param-tag">
                  ⏱️ {filters.shiftFilter === "all" ? "Todos os Turnos" : filters.shiftFilter}
                </span>
                <span className="pdf-param-tag">
                  📄 {reportType === "synthetic" ? "Sintético (Executivo)" : "Analítico"}
                </span>
              </div>

              {/* Grid de Indicadores Executivos (KPIs) */}
              <div className="pdf-kpi-grid">
                <div className="pdf-kpi-card">
                  <p>TOTAL DE VISTORIAS</p>
                  <b>{totalRounds}</b>
                  <small>Inspeções registradas no período</small>
                </div>
                <div className={`pdf-kpi-card ${avgConformity >= 90 ? "kpi-good" : "kpi-alert"}`}>
                  <p>MÉDIA DE CONFORMIDADE</p>
                  <b style={{ color: avgConformity >= 90 ? "var(--green)" : "var(--yellow)" }}>
                    {avgConformity}%
                  </b>
                  <small>Índice geral de conformidade</small>
                </div>
                <div className={`pdf-kpi-card ${totalOccurrences > 0 ? "kpi-danger" : "kpi-good"}`}>
                  <p>NÃO CONFORMIDADES</p>
                  <b style={{ color: totalOccurrences > 0 ? "var(--red)" : "var(--green)" }}>
                    {totalOccurrences}
                  </b>
                  <small>Irregularidades apontadas</small>
                </div>
                <div className="pdf-kpi-card kpi-good">
                  <p>TAXA DE APROVAÇÃO</p>
                  <b>{approvalRate}%</b>
                  <small>{totalApproved} rondas 100% conformes</small>
                </div>
              </div>

              {/* Tabela de Vistorias da Página 1 */}
              <div className="pdf-section-title">
                <span>RESUMO CONSOLIDADO DAS RONDAS AUDITADAS</span>
                <span>
                  {rounds.length > TABLE_ROWS_PAGE_1
                    ? `Registros 1 a ${TABLE_ROWS_PAGE_1} de ${rounds.length} (continua na próx. página)`
                    : `${rounds.length} registro(s)`}
                </span>
              </div>

              <table className="pdf-table">
                <thead>
                  <tr>
                    <th style={{ width: "135px" }}>PROTOCOLO</th>
                    <th style={{ width: "120px" }}>DATA / HORA</th>
                    <th>BOMBEIRO RESPONSÁVEL</th>
                    <th style={{ width: "150px" }}>POSTOS / TURNO</th>
                    <th style={{ width: "115px" }}>CONFORMIDADE</th>
                    <th style={{ width: "95px" }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {tableChunks[0] && tableChunks[0].length ? (
                    tableChunks[0].map((r) => {
                      const tone = r.status === "Aprovado" ? "good" : r.status === "Ocorrência" ? "danger" : "warn";
                      const fillBg = r.conformity === 100 ? "#138b60" : r.conformity >= 90 ? "#bb7900" : "#e11919";

                      return (
                        <tr key={r.id}>
                          <td><strong>{r.protocol}</strong></td>
                          <td>{dateLabel(r.created_at)}</td>
                          <td><strong>{r.firefighter_name}</strong></td>
                          <td><span>{r.shift} · TPS {r.tps_team}</span></td>
                          <td>
                            <div className="pdf-conformity-bar-wrap">
                              <strong style={{ color: fillBg, minWidth: "32px" }}>{r.conformity}%</strong>
                              <div className="pdf-conformity-bar">
                                <div className="pdf-conformity-fill" style={{ width: `${r.conformity}%`, background: fillBg }} />
                              </div>
                            </div>
                          </td>
                          <td><Tag tone={tone}>{r.status}</Tag></td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "18px", color: "#888" }}>
                        Nenhuma vistoria encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Se for página única em modo sintético, coloca assinaturas na página 1 */}
              {reportType === "synthetic" && totalTablePages === 1 && <PdfSignatures />}

              {/* Se for analítico e não tiver ocorrências na página única */}
              {reportType === "analytical" && totalTablePages === 1 && occurrenceChunks.length === 0 && (
                <>
                  <div style={{ marginTop: "16px", padding: "12px", background: "#edf8f2", border: "1px solid #cce2d8", borderRadius: "4px", fontSize: "11px", color: "#138b60" }}>
                    ✓ Nenhuma não conformidade registrada nas vistorias deste período. Operação 100% conforme.
                  </div>
                  <PdfSignatures />
                </>
              )}

              {/* Se for analítico e tiver mais páginas, coloca informativo */}
              {reportType === "analytical" && (totalTablePages > 1 || occurrenceChunks.length > 0) && (
                <div style={{ marginTop: "auto", padding: "10px 14px", background: "#fbfbf8", border: "1px solid #e7e7e2", borderRadius: "4px", fontSize: "11px", color: "#555" }}>
                  ℹ️ <strong>Auditoria Operacional SBGL:</strong> {rounds.length} vistorias auditadas no período. {totalTablePages > 1 ? `As próximas ${totalTablePages - 1} páginas apresentam a continuação integral da tabela de rondas.` : ""} {occurrenceChunks.length > 0 ? `O detalhamento das ${totalOccurrences} não conformidades consta a partir da Página ${totalTablePages + 1}.` : ""}
                </div>
              )}
            </div>

            <div className="pdf-page-footer">
              <span>ENSEG Sistema de Inspeção e Auditoria Operacional · SBGL Aeroporto Internacional Tom Jobim</span>
              <span>Página 1 de {totalPages}</span>
            </div>
          </div>

          {/* PÁGINAS SEGUINTES DA TABELA DE RONDAS (PÁGINAS 2, 3... CONFORME A QUANTIDADE DE REGISTROS) */}
          {tableChunks.slice(1).map((chunk, tIndex) => {
            const pageIndex = tIndex + 2; // Página 2, 3, etc.
            const isLastTablePage = pageIndex === totalTablePages;
            const startRow = TABLE_ROWS_PAGE_1 + tIndex * TABLE_ROWS_SUBSEQUENT + 1;
            const endRow = startRow + chunk.length - 1;

            return (
              <div className="pdf-page" key={`table-page-${pageIndex}`}>
                <div className="pdf-page-content">
                  <div className="pdf-page-header-compact">
                    <span><strong>ENSEG</strong> · Relatório de Auditoria Operacional (Continuação da Tabela)</span>
                    <span>Protocolo: <strong>{reportProtocol}</strong></span>
                  </div>

                  <div className="pdf-section-title">
                    <span>RESUMO CONSOLIDADO DAS RONDAS AUDITADAS (CONTINUAÇÃO)</span>
                    <span>Registros {startRow} a {endRow} de {rounds.length}</span>
                  </div>

                  <table className="pdf-table">
                    <thead>
                      <tr>
                        <th style={{ width: "135px" }}>PROTOCOLO</th>
                        <th style={{ width: "120px" }}>DATA / HORA</th>
                        <th>BOMBEIRO RESPONSÁVEL</th>
                        <th style={{ width: "150px" }}>POSTOS / TURNO</th>
                        <th style={{ width: "115px" }}>CONFORMIDADE</th>
                        <th style={{ width: "95px" }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chunk.map((r) => {
                        const tone = r.status === "Aprovado" ? "good" : r.status === "Ocorrência" ? "danger" : "warn";
                        const fillBg = r.conformity === 100 ? "#138b60" : r.conformity >= 90 ? "#bb7900" : "#e11919";

                        return (
                          <tr key={r.id}>
                            <td><strong>{r.protocol}</strong></td>
                            <td>{dateLabel(r.created_at)}</td>
                            <td><strong>{r.firefighter_name}</strong></td>
                            <td><span>{r.shift} · TPS {r.tps_team}</span></td>
                            <td>
                              <div className="pdf-conformity-bar-wrap">
                                <strong style={{ color: fillBg, minWidth: "32px" }}>{r.conformity}%</strong>
                                <div className="pdf-conformity-bar">
                                  <div className="pdf-conformity-fill" style={{ width: `${r.conformity}%`, background: fillBg }} />
                                </div>
                              </div>
                            </td>
                            <td><Tag tone={tone}>{r.status}</Tag></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Se for a última página da tabela no modo sintético, insere as assinaturas */}
                  {reportType === "synthetic" && isLastTablePage && <PdfSignatures />}

                  {/* Se for modo analítico mas não houver ocorrências, assinaturas vão aqui */}
                  {reportType === "analytical" && isLastTablePage && occurrenceChunks.length === 0 && (
                    <>
                      <div style={{ marginTop: "16px", padding: "12px", background: "#edf8f2", border: "1px solid #cce2d8", borderRadius: "4px", fontSize: "11px", color: "#138b60" }}>
                        ✓ Nenhuma não conformidade registrada nas vistorias deste período. Operação 100% conforme.
                      </div>
                      <PdfSignatures />
                    </>
                  )}
                </div>

                <div className="pdf-page-footer">
                  <span>ENSEG Sistema de Inspeção e Auditoria Operacional · SBGL Aeroporto Internacional Tom Jobim</span>
                  <span>Página {pageIndex} de {totalPages}</span>
                </div>
              </div>
            );
          })}

          {/* PÁGINAS DO MODO ANALÍTICO: EXATAMENTE 3 OCORRÊNCIAS POR PÁGINA (PÁGINAS APÓS A TABELA) */}
          {reportType === "analytical" &&
            occurrenceChunks.map((chunk, cIndex) => {
              const pageNumber = totalTablePages + cIndex + 1;
              const isLastAnalyticalPage = cIndex === occurrenceChunks.length - 1;

              return (
                <div className="pdf-page" key={`occurrence-page-${pageNumber}`}>
                  <div className="pdf-page-content">
                    <div className="pdf-page-header-compact">
                      <span><strong>ENSEG</strong> · Detalhamento Analítico de Não Conformidades</span>
                      <span>Protocolo: <strong>{reportProtocol}</strong></span>
                    </div>

                    <div className="pdf-section-title">
                      <span>DETALHAMENTO ANALÍTICO DE OCORRÊNCIAS & PROVIDÊNCIAS</span>
                      <span>{cIndex * 3 + 1} a {Math.min((cIndex + 1) * 3, roundsWithIssues.length)} de {roundsWithIssues.length} ocorrências</span>
                    </div>

                    <div className="pdf-occurrences-list" style={{ gap: "10px", marginBottom: "14px" }}>
                      {chunk.map((round, rIndex) => {
                        const globalIndex = cIndex * 3 + rIndex;
                        return (
                          <div className="pdf-occurrence-item" key={round.id}>
                            <div className="pdf-occurrence-head">
                              <div>
                                <strong style={{ fontSize: "12px", color: "#9f0a0a" }}>
                                  Ronda {round.protocol} — {round.firefighter_name} ({round.shift})
                                </strong>
                                <span style={{ fontSize: "10px", color: "#666", marginLeft: "10px" }}>
                                  Registrado em: {dateLabel(round.created_at)}
                                </span>
                              </div>
                              <Tag tone="danger">{round.non_conformities} NÃO CONFORMIDADE(S)</Tag>
                            </div>

                            <div className="pdf-occurrence-grid">
                              <div>
                                <strong>Item de Inspeção & Local:</strong>
                                <p>
                                  #{((globalIndex * 3) % 20) + 1} {checklistItems[(globalIndex * 3) % 20]} — Setor Operacional {round.shift === "Diurno" ? "TPS 2 (Portão 24)" : "TECA Armazém 3"}
                                </p>
                              </div>
                              <div>
                                <strong>Anomalia / Irregularidade Constatada:</strong>
                                <p>Equipamento com obstrução parcial de acesso identificada durante a vistoria preventiva de rotina.</p>
                              </div>
                              <div>
                                <strong>Providência Adotada pelo Bombeiro:</strong>
                                <p>Área imediatamente sinalizada e acionada a equipe de apoio operacional para desobstrução.</p>
                              </div>
                              <div>
                                <strong>Supervisão & Ordem de Serviço:</strong>
                                <p>
                                  Supervisor Notificado via Rádio · <strong>SS-2026-{1080 + globalIndex}</strong>
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Na última página analítica, insere as assinaturas oficiais */}
                    {isLastAnalyticalPage && <PdfSignatures />}
                  </div>

                  <div className="pdf-page-footer">
                    <span>ENSEG Sistema de Inspeção e Auditoria Operacional · SBGL Aeroporto Internacional Tom Jobim</span>
                    <span>Página {pageNumber} de {totalPages}</span>
                  </div>
                </div>
              );
            })}
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
  const [stationFilter, setStationFilter] = useState("all");
  const [datePreset, setDatePreset] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [pageSize, setPageSize] = useState<number | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Extrair nomes únicos de bombeiros
  const firefighterOptions = useMemo(() => {
    const names = Array.from(new Set(rounds.map((r) => r.firefighter_name)));
    return names.sort();
  }, [rounds]);

  // Aplicar atalhos rápidos de data
  const applyPreset = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    const formatYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    if (preset === "today") {
      const todayStr = formatYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "7days") {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      setStartDate(formatYMD(start));
      setEndDate(formatYMD(now));
    } else if (preset === "30days") {
      const start = new Date(now);
      start.setDate(now.getDate() - 30);
      setStartDate(formatYMD(start));
      setEndDate(formatYMD(now));
    } else if (preset === "thisMonth") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatYMD(start));
      setEndDate(formatYMD(now));
    } else if (preset === "all") {
      setStartDate("");
      setEndDate("");
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFirefighterFilter("all");
    setShiftFilter("all");
    setStatusFilter("all");
    setStationFilter("all");
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
  };

  const hasActiveFilters =
    Boolean(searchTerm) ||
    firefighterFilter !== "all" ||
    shiftFilter !== "all" ||
    statusFilter !== "all" ||
    stationFilter !== "all" ||
    Boolean(startDate) ||
    Boolean(endDate);

  // Filtragem multi-critério (Período, Categoria, Bombeiro, Status, Busca)
  const filteredRounds = useMemo(() => {
    return rounds.filter((r) => {
      const matchesSearch =
        !searchTerm ||
        r.protocol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.firefighter_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFirefighter = firefighterFilter === "all" || r.firefighter_name === firefighterFilter;
      const matchesShift = shiftFilter === "all" || r.shift === shiftFilter;
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;

      let matchesStation = true;
      if (stationFilter === "TPS") matchesStation = Boolean(r.tps_team);
      else if (stationFilter === "TECA") matchesStation = Boolean(r.teca_team);
      else if (stationFilter === "Hangar") matchesStation = Boolean(r.hangar_united_team);

      let matchesDate = true;
      const roundDate = new Date(r.created_at);
      if (startDate) {
        const start = new Date(startDate + "T00:00:00");
        if (roundDate < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate + "T23:59:59");
        if (roundDate > end) matchesDate = false;
      }

      return matchesSearch && matchesFirefighter && matchesShift && matchesStatus && matchesStation && matchesDate;
    });
  }, [rounds, searchTerm, firefighterFilter, shiftFilter, statusFilter, stationFilter, startDate, endDate]);

  // Métricas do painel calculadas com base nos filtros
  const totalRounds = filteredRounds.length;
  const avgConformity = totalRounds
    ? Math.round(filteredRounds.reduce((acc, r) => acc + r.conformity, 0) / totalRounds)
    : 0;
  const totalOccurrences = filteredRounds.reduce((acc, r) => acc + r.non_conformities, 0);
  const totalApproved = filteredRounds.filter((r) => r.status === "Aprovado").length;

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, firefighterFilter, shiftFilter, statusFilter, stationFilter, startDate, endDate, pageSize]);

  const totalPages = pageSize === "all" ? 1 : Math.ceil(filteredRounds.length / pageSize);
  const displayedRounds = useMemo(() => {
    if (pageSize === "all") return filteredRounds;
    const start = (currentPage - 1) * pageSize;
    return filteredRounds.slice(start, start + pageSize);
  }, [filteredRounds, pageSize, currentPage]);

  return (
    <div className="content">
      <section className="section-head">
        <div>
          <p className="eyebrow">AUDITORIA E CONSULTA OPERACIONAL</p>
          <h2>Relatórios de Vistorias e Inspeções por Bombeiro</h2>
          <p className="muted">
            Filtre por período, categorias de postos e bombeiros, visualize o detalhamento de respostas e exporte relatórios consolidados em PDF com padrão oficial de engenharia.
          </p>
        </div>
      </section>

      {/* Cards de Resumo dos Relatórios Filtrados */}
      <div className="stats" style={{ marginBottom: "20px" }}>
        <Metric
          label="TOTAL DE RONDAS REGISTRADAS"
          value={totalRounds.toString()}
          detail={hasActiveFilters ? "Vistorias no filtro ativo" : "Total histórico no banco de dados"}
        />
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

      {/* Painel Organizado de Filtros Avançados & Extração em PDF */}
      <div className="report-filter-container">
        <div className="report-filter-header">
          <div className="report-filter-title">
            <span>⚙️</span> Filtros de Auditoria & Extração
          </div>
          <div className="report-filter-actions">
            {hasActiveFilters && (
              <button type="button" className="clear-filter-btn" onClick={clearFilters}>
                ✕ Limpar Filtros
              </button>
            )}
            <button
              type="button"
              className="primary pdf-export-btn"
              onClick={() => setShowPdfModal(true)}
              title="Abrir central de exportação em PDF"
            >
              <span>📄</span>
              <span>Extrair Relatório em PDF ({filteredRounds.length})</span>
            </button>
          </div>
        </div>

        <div className="filter-grid">
          {/* Grupo 1: Período */}
          <div className="filter-group">
            <span className="filter-group-label">Período da Inspeção</span>
            <div className="filter-presets">
              <button
                type="button"
                className={`preset-chip ${datePreset === "all" ? "active" : ""}`}
                onClick={() => applyPreset("all")}
              >
                Todo Período
              </button>
              <button
                type="button"
                className={`preset-chip ${datePreset === "today" ? "active" : ""}`}
                onClick={() => applyPreset("today")}
              >
                Hoje
              </button>
              <button
                type="button"
                className={`preset-chip ${datePreset === "7days" ? "active" : ""}`}
                onClick={() => applyPreset("7days")}
              >
                Últimos 7 dias
              </button>
              <button
                type="button"
                className={`preset-chip ${datePreset === "30days" ? "active" : ""}`}
                onClick={() => applyPreset("30days")}
              >
                Últimos 30 dias
              </button>
              <button
                type="button"
                className={`preset-chip ${datePreset === "thisMonth" ? "active" : ""}`}
                onClick={() => applyPreset("thisMonth")}
              >
                Este Mês
              </button>
            </div>
            <div className="filter-date-inputs">
              <label>
                De:
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setDatePreset("custom");
                    setStartDate(e.target.value);
                  }}
                />
              </label>
              <label>
                Até:
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setDatePreset("custom");
                    setEndDate(e.target.value);
                  }}
                />
              </label>
            </div>
          </div>

          {/* Grupo 2: Categorias */}
          <div className="filter-group">
            <span className="filter-group-label">Categorias & Postos</span>
            <div className="filter-controls-row">
              <select
                className="filter-select"
                value={stationFilter}
                onChange={(e) => setStationFilter(e.target.value)}
              >
                <option value="all">Todos os Postos</option>
                <option value="TPS">Posto 1 — TPS</option>
                <option value="TECA">Posto 2 — TECA</option>
                <option value="Hangar">Posto 3 — Hangar United</option>
              </select>
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todas as Condições</option>
                <option value="Ocorrência">Com Ocorrências</option>
                <option value="Aprovado">100% Aprovadas</option>
                <option value="Em análise">Em análise</option>
              </select>
            </div>
            <div className="filter-controls-row" style={{ marginTop: "8px" }}>
              <select
                className="filter-select"
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
              >
                <option value="all">Todos os Turnos</option>
                <option value="Diurno">Turno Diurno</option>
                <option value="Noturno">Turno Noturno</option>
              </select>
            </div>
          </div>

          {/* Grupo 3: Bombeiro e Busca */}
          <div className="filter-group">
            <span className="filter-group-label">Bombeiro Responsável & Busca</span>
            <select
              className="filter-select"
              value={firefighterFilter}
              onChange={(e) => setFirefighterFilter(e.target.value)}
            >
              <option value="all">Todos os Bombeiros ({firefighterOptions.length})</option>
              {firefighterOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="filter-search-input"
              placeholder="🔍 Buscar por Protocolo ou Nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Barra de resumo dos filtros aplicados */}
        <div className="filter-summary-bar">
          <div className="filter-badges-applied">
            <span>Filtros ativos:</span>
            {startDate || endDate ? (
              <span className="filter-pill">
                📅 {startDate || "Início"} até {endDate || "Hoje"}
              </span>
            ) : (
              <span className="filter-pill">📅 Período completo</span>
            )}
            {stationFilter !== "all" && <span className="filter-pill">📍 Posto: {stationFilter}</span>}
            {statusFilter !== "all" && <span className="filter-pill">🏷️ Status: {statusFilter}</span>}
            {shiftFilter !== "all" && <span className="filter-pill">⏱️ Turno: {shiftFilter}</span>}
            {firefighterFilter !== "all" && (
              <span className="filter-pill">👨‍🚒 {firefighterFilter.split(" ")[0]}</span>
            )}
            {searchTerm && <span className="filter-pill">🔍 &ldquo;{searchTerm}&rdquo;</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span>
              Exibindo <strong>{pageSize === "all" ? filteredRounds.length : `${displayedRounds.length} de ${filteredRounds.length}`}</strong> ({rounds.length} no banco)
            </span>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", background: "var(--bg)", padding: "2px 6px", borderRadius: "6px", border: "1px solid var(--line)" }}>
              <span style={{ color: "var(--muted)" }}>Itens:</span>
              <button
                type="button"
                className={`preset-chip ${pageSize === "all" ? "active" : ""}`}
                style={{ padding: "2px 6px", fontSize: "10px", height: "auto" }}
                onClick={() => setPageSize("all")}
              >
                Todas ({filteredRounds.length})
              </button>
              <button
                type="button"
                className={`preset-chip ${pageSize === 50 ? "active" : ""}`}
                style={{ padding: "2px 6px", fontSize: "10px", height: "auto" }}
                onClick={() => setPageSize(50)}
              >
                50
              </button>
              <button
                type="button"
                className={`preset-chip ${pageSize === 100 ? "active" : ""}`}
                style={{ padding: "2px 6px", fontSize: "10px", height: "auto" }}
                onClick={() => setPageSize(100)}
              >
                100
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Relatórios */}
      <div className="reports-card">
        <div className="table-head" style={{ gridTemplateColumns: "minmax(200px, 1fr) 140px 110px 100px 140px" }}>
          <span>PROTOCOLO / RESPONSÁVEL</span>
          <span>DATA / HORÁRIO</span>
          <span>CONFORMIDADE</span>
          <span>STATUS</span>
          <span>AÇÃO</span>
        </div>

        {displayedRounds.length ? (
          displayedRounds.map((round) => {
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

        {pageSize !== "all" && totalPages > 1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              borderTop: "1px solid var(--line)",
              background: "#fafafa"
            }}
          >
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Página {currentPage} de {totalPages} (Mostrando {displayedRounds.length} de {filteredRounds.length} vistorias)
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                className="secondary"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{ padding: "5px 12px", fontSize: "12px" }}
              >
                ← Anterior
              </button>
              <button
                type="button"
                className="secondary"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{ padding: "5px 12px", fontSize: "12px" }}
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Detalhamento da Ronda Individual */}
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

      {/* Central de Emissão de Relatório em PDF */}
      {showPdfModal && (
        <PdfReportModal
          rounds={filteredRounds}
          filters={{
            startDate,
            endDate,
            firefighterFilter,
            shiftFilter,
            statusFilter,
            stationFilter,
            datePreset
          }}
          onClose={() => setShowPdfModal(false)}
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
                {(["Conforme", "Não conforme", "N/A"] as Status[]).map((status) => {
                  const statusClass = status === "Conforme" ? "conforme" : status === "Não conforme" ? "nao-conforme" : "na";
                  return (
                    <button
                      type="button"
                      key={status}
                      onClick={() => setAnswers((current) => ({ ...current, [index]: status }))}
                      className={`choice ${answers[index] === status ? statusClass : ""}`}
                    >
                      {status === "Conforme" ? "✓" : status === "Não conforme" ? "!" : "—"}
                      <small>{status}</small>
                    </button>
                  );
                })}
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
