const API_BASE = '';
const APP_NAME = 'Project Harmony';

let state = {
  token: localStorage.getItem('token') || '',
  user: null,
  couples: [],
  activeCoupleId: null,
  activeCouple: null,
  members: [],
  messages: [],
  language: 'en',
  aiConsent: { both_consented: false, my_consent: false, partner_consents: {} },
  ws: null,
  wsConnected: false,
};

const LABELS = {
  en: {
    appName: 'Project Harmony',
    signIn: 'Sign in',
    signUp: 'Create account',
    email: 'Email',
    password: 'Password',
    name: 'Full name',
    country: 'Country',
    language: 'Language',
    login: 'Log in',
    register: 'Register',
    haveAccount: 'Already have an account?',
    noAccount: "Don't have an account?",
    couples: 'Your Relationships',
    createCouple: 'Create Relationship',
    partnerEmail: "Partner's email",
    noCouples: "You haven't created a relationship yet.",
    createFirst: 'Create your first relationship to start messaging your partner.',
    messages: 'Messages',
    aiCoach: 'AI Coach',
    aiMediate: 'AI Mediation',
    aiInsight: 'Relationship Insight',
    goals: 'Goals & Commitments',
    createGoal: 'Add Goal',
    goalTitle: 'Goal title',
    goalDesc: 'Description',
    targetDate: 'Target date',
    commitments: 'Commitments',
    addCommitment: 'Add Commitment',
    commitmentTitle: 'Commitment title',
    owner: 'Owner',
    dueDate: 'Due date',
    sendMessage: 'Send a message...',
    typing: 'typing...',
    healthScore: 'Relationship Health',
    connect: 'Connecting...',
    connected: 'Connected',
    disconnected: 'Disconnected',
    logout: 'Log out',
    back: 'Back',
    profile: 'Profile',
    settings: 'Settings',
    welcome: 'Welcome',
    error: 'Error',
    success: 'Success',
    saving: 'Saving...',
    saved: 'Saved!',
    fillAll: 'Please fill in all fields.',
    invalidEmail: 'Please enter a valid email.',
    minPassword: 'Password must be at least 8 characters.',
    aiConsentTitle: 'AI Participation',
    aiConsentDesc: 'AI can analyze conversations when both partners consent',
    aiConsentEnabled: 'AI participation enabled',
    aiConsentDisabled: 'AI participation disabled',
    aiAnalysis: 'AI Analysis',
    aiPattern: 'Communication Patterns',
    aiMisunderstanding: 'Potential Misunderstandings',
    aiReplySuggestion: 'Suggested Replies',
    aiConversationSummary: 'Conversation Summary',
    mediaUpload: 'Upload Media',
    editMessage: 'Edit',
    deleteMessage: 'Delete',
    replyTo: 'Reply',
    readBy: 'Read by',
    reactions: 'Reactions',
    addReaction: 'Add reaction',
  },
  hi: {
    appName: 'प्रोजेक्ट हार्मनी',
    signIn: 'साइन इन करें',
    signUp: 'खाता बनाएं',
    email: 'ईमेल',
    password: 'पासवर्ड',
    name: 'पूरा नाम',
    country: 'देश',
    language: 'भाषा',
    login: 'लॉग इन करें',
    register: 'पंजीकरण करें',
    haveAccount: 'पहले से खाता है?',
    noAccount: 'खाता नहीं है?',
    couples: 'आपके रिश्ते',
    createCouple: 'रिश्ता बनाएं',
    partnerEmail: 'साथी का ईमेल',
    noCouples: 'आपने अभी तक कोई रिश्ता नहीं बनाया है।',
    createFirst: 'अपने साथी को संदेश भेजना शुरू करने के लिए अपना पहला रिश्ता बनाएं।',
    messages: 'संदेश',
    aiCoach: 'AI कोच',
    aiMediate: 'AI मध्यस्थता',
    aiInsight: 'रिश्ता अंतर्दृष्टि',
    goals: 'लक्ष्य और प्रतिबद्धताएं',
    createGoal: 'लक्ष्य जोड़ें',
    goalTitle: 'लक्ष्य शीर्षक',
    goalDesc: 'विवरण',
    targetDate: 'लक्ष्य तिथि',
    commitments: 'प्रतिबद्धताएं',
    addCommitment: 'प्रतिबद्धता जोड़ें',
    commitmentTitle: 'प्रतिबद्धता शीर्षक',
    owner: 'मालिक',
    dueDate: 'नियत तिथि',
    sendMessage: 'एक संदेश भेजें...',
    typing: 'लिख रहा है...',
    healthScore: 'रिश्ते का स्वास्थ्य',
    connect: 'जुड़ रहा है...',
    connected: 'जुड़ा हुआ',
    disconnected: 'डिस्कनेक्ट हुआ',
    logout: 'लॉग आउट करें',
    back: 'वापस',
    profile: 'प्रोफ़ाइल',
    settings: 'सेटिंग्ज़',
    welcome: 'स्वागत है',
    error: 'त्रुटि',
    success: 'सफलता',
    saving: 'सहेज रहा है...',
    saved: 'सहेजा गया!',
    fillAll: 'कृपया सभी क्षेत्र भरें।',
    invalidEmail: 'कृपया एक वैध ईमेल दर्ज करें।',
    minPassword: 'पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।',
  },
  es: {
    appName: 'Proyecto Armonía',
    signIn: 'Iniciar sesión',
    signUp: 'Crear cuenta',
    email: 'Correo electrónico',
    password: 'Contraseña',
    name: 'Nombre completo',
    country: 'País',
    language: 'Idioma',
    login: 'Iniciar sesión',
    register: 'Registrarse',
    haveAccount: '¿Ya tienes una cuenta?',
    noAccount: '¿No tienes una cuenta?',
    couples: 'Tus relaciones',
    createCouple: 'Crear relación',
    partnerEmail: 'Correo de tu pareja',
    noCouples: 'Aún no has creado ninguna relación.',
    createFirst: 'Crea tu primera relación para empezar a escribirle a tu pareja.',
    messages: 'Mensajes',
    aiCoach: 'Entrenador IA',
    aiMediate: 'Mediación IA',
    aiInsight: 'Perspectiva de relación',
    goals: 'Metas y compromisos',
    createGoal: 'Agregar meta',
    goalTitle: 'Título de la meta',
    goalDesc: 'Descripción',
    targetDate: 'Fecha objetivo',
    commitments: 'Compromisos',
    addCommitment: 'Agregar compromiso',
    commitmentTitle: 'Título del compromiso',
    owner: 'Responsable',
    dueDate: 'Fecha límite',
    sendMessage: 'Escribe un mensaje...',
    typing: 'escribiendo...',
    healthScore: 'Salud de la relación',
    connect: 'Conectando...',
    connected: 'Conectado',
    disconnected: 'Desconectado',
    logout: 'Cerrar sesión',
    back: 'Atrás',
    profile: 'Perfil',
    settings: 'Configuración',
    welcome: 'Bienvenido',
    error: 'Error',
    success: 'Éxito',
    saving: 'Guardando...',
    saved: '¡Guardado!',
    fillAll: 'Por favor complete todos los campos.',
    invalidEmail: 'Ingrese un correo electrónico válido.',
    minPassword: 'La contraseña debe tener al menos 8 caracteres.',
  },
  fr: {
    appName: 'Projet Harmonie',
    signIn: 'Se connecter',
    signUp: 'Créer un compte',
    email: 'E-mail',
    password: 'Mot de passe',
    name: 'Nom complet',
    country: 'Pays',
    language: 'Langue',
    login: 'Se connecter',
    register: "S'inscrire",
    haveAccount: 'Vous avez déjà un compte ?',
    noAccount: "Vous n'avez pas de compte ?",
    couples: 'Vos relations',
    createCouple: 'Créer une relation',
    partnerEmail: "E-mail de votre partenaire",
    noCouples: 'Vous n\'avez pas encore créé de relation.',
    createFirst: 'Créez votre première relation pour commencer à échanger avec votre partenaire.',
    messages: 'Messages',
    aiCoach: 'Coach IA',
    aiMediate: 'Médiation IA',
    aiInsight: 'Insight relationnel',
    goals: 'Objectifs et engagements',
    createGoal: 'Ajouter un objectif',
    goalTitle: 'Titre de l\'objectif',
    goalDesc: 'Description',
    targetDate: 'Date cible',
    commitments: 'Engagements',
    addCommitment: 'Ajouter un engagement',
    commitmentTitle: 'Titre de l\'engagement',
    owner: 'Responsable',
    dueDate: 'Date d\'échéance',
    sendMessage: 'Écrire un message...',
    typing: 'écrit...',
    healthScore: 'Santé de la relation',
    connect: 'Connexion...',
    connected: 'Connecté',
    disconnected: 'Déconnecté',
    logout: 'Se déconnecter',
    back: 'Retour',
    profile: 'Profil',
    settings: 'Paramètres',
    welcome: 'Bienvenue',
    error: 'Erreur',
    success: 'Succès',
    saving: 'Enregistrement...',
    saved: 'Enregistré !',
    fillAll: 'Veuillez remplir tous les champs.',
    invalidEmail: 'Veuillez entrer un e-mail valide.',
    minPassword: 'Le mot de passe doit contenir au moins 8 caractères.',
  },
  de: {
    appName: 'Projekt Harmonie',
    signIn: 'Anmelden',
    signUp: 'Konto erstellen',
    email: 'E-Mail',
    password: 'Passwort',
    name: 'Vollständiger Name',
    country: 'Land',
    language: 'Sprache',
    login: 'Anmelden',
    register: 'Registrieren',
    haveAccount: 'Sie haben bereits ein Konto?',
    noAccount: 'Sie haben noch kein Konto?',
    couples: 'Ihre Beziehungen',
    createCouple: 'Beziehung erstellen',
    partnerEmail: 'E-Mail Ihres Partners',
    noCouples: 'Sie haben noch keine Beziehung erstellt.',
    createFirst: 'Erstellen Sie Ihre erste Beziehung, um mit Ihrem Partner zu schreiben.',
    messages: 'Nachrichten',
    aiCoach: 'KI-Coach',
    aiMediate: 'KI-Vermittlung',
    aiInsight: 'Beziehungs-Einblick',
    goals: 'Ziele und Verpflichtungen',
    createGoal: 'Ziel hinzufügen',
    goalTitle: 'Zielbezeichnung',
    goalDesc: 'Beschreibung',
    targetDate: 'Zieldatum',
    commitments: 'Verpflichtungen',
    addCommitment: 'Verpflichtung hinzufügen',
    commitmentTitle: 'Titel der Verpflichtung',
    owner: 'Verantwortlich',
    dueDate: 'Fälligkeitsdatum',
    sendMessage: 'Nachricht schreiben...',
    typing: 'schreibt...',
    healthScore: 'Beziehungsgesundheit',
    connect: 'Verbinden...',
    connected: 'Verbunden',
    disconnected: 'Getrennt',
    logout: 'Abmelden',
    back: 'Zurück',
    profile: 'Profil',
    settings: 'Einstellungen',
    welcome: 'Willkommen',
    error: 'Fehler',
    success: 'Erfolg',
    saving: 'Wird gespeichert...',
    saved: 'Gespeichert!',
    fillAll: 'Bitte füllen Sie alle Felder aus.',
    invalidEmail: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    minPassword: 'Das Passwort muss mindestens 8 Zeichen lang sein.',
  },
  pt: {
    appName: 'Projeto Harmonia',
    signIn: 'Entrar',
    signUp: 'Criar conta',
    email: 'E-mail',
    password: 'Senha',
    name: 'Nome completo',
    country: 'País',
    language: 'Idioma',
    login: 'Entrar',
    register: 'Registrar-se',
    haveAccount: 'Já tem uma conta?',
    noAccount: 'Não tem uma conta?',
    couples: 'Seus relacionamentos',
    createCouple: 'Criar relacionamento',
    partnerEmail: 'E-mail do seu parceiro',
    noCouples: 'Você ainda não criou nenhum relacionamento.',
    createFirst: 'Crie seu primeiro relacionamento para começar a conversar com seu parceiro.',
    messages: 'Mensagens',
    aiCoach: 'Treinador IA',
    aiMediate: 'Mediação IA',
    aiInsight: 'Insight de relacionamento',
    goals: 'Metas e compromissos',
    createGoal: 'Adicionar meta',
    goalTitle: 'Título da meta',
    goalDesc: 'Descrição',
    targetDate: 'Data alvo',
    commitments: 'Compromissos',
    addCommitment: 'Adicionar compromisso',
    commitmentTitle: 'Título do compromisso',
    owner: 'Responsável',
    dueDate: 'Data de vencimento',
    sendMessage: 'Escreva uma mensagem...',
    typing: 'digitando...',
    healthScore: 'Saúde do relacionamento',
    connect: 'Conectando...',
    connected: 'Conectado',
    disconnected: 'Desconectado',
    logout: 'Sair',
    back: 'Voltar',
    profile: 'Perfil',
    settings: 'Configurações',
    welcome: 'Bem-vindo',
    error: 'Erro',
    success: 'Sucesso',
    saving: 'Salvando...',
    saved: 'Salvo!',
    fillAll: 'Por favor, preencha todos os campos.',
    invalidEmail: 'Insira um e-mail válido.',
    minPassword: 'A senha deve ter pelo menos 8 caracteres.',
  },
  hinglish: {
    appName: 'Project Harmony',
    signIn: 'Sign in karo',
    signUp: 'Account banayein',
    email: 'Email',
    password: 'Password',
    name: 'Poora naam',
    country: 'Desh',
    language: 'Bhasha',
    login: 'Login karo',
    register: 'Register karo',
    haveAccount: 'Pehle se account hai?',
    noAccount: 'Account nahi hai?',
    couples: 'Aapke rishtay',
    createCouple: 'Rishtay banayein',
    partnerEmail: 'Partner ka email',
    noCouples: 'Abhi tak koi rishtay nahi banaya hai.',
    createFirst: 'Apne partner ko message karna shuru karne ke liye pehla rishtay banayein.',
    messages: 'Messages',
    aiCoach: 'AI Coach',
    aiMediate: 'AI Mediation',
    aiInsight: 'Rishtay Insight',
    goals: 'Goals aur Commitments',
    createGoal: 'Goal add karein',
    goalTitle: 'Goal ka title',
    goalDesc: 'Description',
    targetDate: 'Target date',
    commitments: 'Commitments',
    addCommitment: 'Commitment add karein',
    commitmentTitle: 'Commitment ka title',
    owner: 'Owner',
    dueDate: 'Due date',
    sendMessage: 'Message likhein...',
    typing: 'Type kar raha hai...',
    healthScore: 'Rishtay ka health',
    connect: 'Connect ho raha hai...',
    connected: 'Connect hai',
    disconnected: 'Disconnect ho gaya',
    logout: 'Logout karein',
    back: 'Wapas',
    profile: 'Profile',
    settings: 'Settings',
    welcome: 'Welcome',
    error: 'Error',
    success: 'Success',
    saving: 'Save ho raha hai...',
    saved: 'Save ho gaya!',
    fillAll: 'Kripya saare field bharein.',
    invalidEmail: 'Kripya ek valid email dalein.',
    minPassword: 'Password kam se kam 8 characters ka ho.',
  },
};

function t(key) {
  return LABELS[state.language]?.[key] || LABELS.en[key] || key;
}

function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show';
  setTimeout(() => el.classList.remove('show'), 3000);
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  const res = await fetch(API_BASE + path, { ...opts, headers });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    const err = new Error(data.detail || data.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// --- Auth ---
function showAuth() {
  const app = document.getElementById('app');
  const isLogin = !window._authMode || window._authMode === 'login';
  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <div class="brand"><div class="brand-dot"></div><span>${t('appName')}</span></div>
          <h1>${isLogin ? t('signIn') : t('signUp')}</h1>
          <p>${isLogin ? 'Welcome back' : 'Join Project Harmony'}</p>
        </div>
        <form id="authForm">
          <div class="form-group">
            <label>${t('email')}</label>
            <input type="email" id="regEmail" required placeholder="you@example.com">
          </div>
          <div class="form-group">
            <label>${t('password')}</label>
            <input type="password" id="regPassword" required placeholder="••••••••">
          </div>
          ${!isLogin ? `
          <div class="form-group">
            <label>${t('name')}</label>
            <input type="text" id="regName" required placeholder="John Doe">
          </div>
          <div class="form-group">
            <label>${t('country')}</label>
            <select id="regCountry">
              <option value="US">United States</option>
              <option value="IN">India</option>
              <option value="GB">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
            </select>
          </div>
          <div class="form-group">
            <label>${t('language')}</label>
            <select id="regLang">
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="pt">Português</option>
              <option value="hinglish">Hinglish</option>
            </select>
          </div>
          ` : ''}
          <button type="submit" class="btn btn-primary btn-full" id="authBtn">${isLogin ? t('login') : t('register')}</button>
        </form>
        <div class="form-footer">
          ${isLogin ? t('noAccount') + ' ' : t('haveAccount') + ' '}
          <button type="button" id="toggleAuthBtn" class="btn btn-link" style="padding:0; background:none; color:var(--primary); font-weight:600;">
            ${isLogin ? t('register') : t('login')}
          </button>
        </div>
      </div>
    </div>
  `;

  // Wire up event listeners programmatically (more reliable than inline HTML handlers)
  const form = document.getElementById('authForm');
  if (form) {
    form.onsubmit = (e) => handleAuth(e);
  }
  const toggleBtn = document.getElementById('toggleAuthBtn');
  if (toggleBtn) {
    toggleBtn.onclick = () => toggleAuth();
  }
}

window.toggleAuth = () => { window._authMode = window._authMode === 'login' ? 'register' : 'login'; showAuth(); };

async function handleAuth(e) {
  e.preventDefault();
  const btn = document.getElementById('authBtn');
  btn.disabled = true; btn.textContent = t('saving');
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const isLogin = window._authMode === 'login';
  try {
    if (isLogin) {
      const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setAuth(data.token, data.user);
    } else {
      const name = document.getElementById('regName').value;
      const country = document.getElementById('regCountry').value;
      const language = document.getElementById('regLang').value;
      const data = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name, country, language }) });
      setAuth(data.token, data.user);
      state.language = language;
    }
    showApp();
  } catch (err) {
    toast(err.message || t('error'), 'error');
    btn.disabled = false; btn.textContent = isLogin ? t('login') : t('register');
  }
}

window.handleAuth = handleAuth;

function setAuth(token, user) {
  state.token = token;
  state.user = user;
  state.language = user.language || 'en';
  localStorage.setItem('token', token);
}

// --- App ---
function showApp() {
  document.getElementById('app').innerHTML = shellHtml();
  renderSidebar();
  renderContent();
  initWS();
}

function shellHtml() {
  const isMobile = window.innerWidth < 768;
  return `
    ${isMobile ? `<header class="mobile-header">
      <button onclick="toggleSidebar()" class="btn" style="padding:6px;">☰</button>
      <div class="mobile-title">${state.activeCouple?.name || t('appName')}</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <select id="langSelect" class="lang-select" onchange="changeLanguage(this.value)"></select>
        <button onclick="logout()" class="btn btn-sm btn-outline">${t('logout')}</button>
      </div>
    </header>` : `<header class="header">
      <div class="brand"><div class="brand-dot"></div><span>${t('appName')}</span></div>
      <div class="header-actions">
        <select id="langSelect" class="lang-select" onchange="changeLanguage(this.value)"></select>
        <button onclick="logout()" class="btn btn-sm btn-outline">${t('logout')}</button>
      </div>
    </header>`}
    <div class="main-shell">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="brand" style="font-size:1rem;"><div class="brand-dot"></div><span>${t('appName')}</span></div>
        </div>
        <nav class="sidebar-nav" id="sidebarNav"></nav>
        <div style="padding:16px; border-top:1px solid var(--border);">
          <button onclick="logout()" class="btn btn-outline btn-full" style="color:var(--error); border-color:var(--error);">${t('logout')}</button>
        </div>
      </aside>
      <div class="content" id="content"></div>
    </div>
    <div class="toast" id="toast"></div>
    <div id="sidebarOverlay" onclick="closeSidebar()" style="position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:90;display:none;"></div>
  `;
  renderLangSelect();
}

function renderLangSelect() {
  const sel = document.getElementById('langSelect');
  if (!sel) return;
  const langs = { en:'English', hi:'हिन्दी', es:'Español', fr:'Français', de:'Deutsch', pt:'Português', hinglish:'Hinglish' };
  sel.innerHTML = Object.entries(langs).map(([k,v]) => `<option value="${k}" ${k===state.language?'selected':''}>${v}</option>`).join('');
}

function changeLanguage(lang) {
  state.language = lang;
  if (state.user) {
    api('/api/auth/me').then(() => {}); // no-op, just to keep session
  }
  renderSidebar();
  renderContent();
}

function toggleSidebar() {
  const s = document.getElementById('sidebar'); const o = document.getElementById('sidebarOverlay');
  if (s.style.display === 'none') { s.style.display = 'flex'; o.style.display = 'block'; }
  else { s.style.display = 'none'; o.style.display = 'none'; }
}
function closeSidebar() { document.getElementById('sidebar').style.display = 'none'; document.getElementById('sidebarOverlay').style.display = 'none'; }

async function logout() {
  localStorage.removeItem('token');
  if (state.ws) { state.ws.close(); state.ws = null; }
  state = { token:'', user:null, couples:[], activeCoupleId:null, activeCouple:null, members:[], messages:[], language:state.language, ws:null, wsConnected:false };
  localStorage.removeItem('token');
  showAuth();
}

function renderSidebar() {
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;
  const active = state.activeCoupleId;
  nav.innerHTML = `
    <button class="nav-item ${active===null?'active':''}" onclick="showDashboard()">
      <span>🏠</span> ${t('couples')}
    </button>
    ${state.couples.map(c => `
      <button class="nav-item ${active===c.id?'active':''}" onclick="openCouple('${c.id}')">
        <span>💑</span> ${escapeHtml(c.name || 'Relationship')}
      </button>
    `).join('')}
    <button class="nav-item" onclick="showCreateCouple()" style="margin-top:12px; border:1px dashed var(--border); color:var(--primary);">
      <span>➕</span> ${t('createCouple')}
    </button>
  `;
}

function renderContent() {
  const content = document.getElementById('content');
  if (!content) return;
  if (!state.activeCoupleId) {
    content.innerHTML = state.couples.length
      ? `<div class="card"><div class="card-header"><span class="card-title">${t('couples')}</span></div><div class="empty-state"><div class="empty-icon">💑</div><p>${t('noCouples')}</p><button class="btn btn-primary mt-8" onclick="showCreateCouple()">${t('createFirst')}</button></div></div>`
      : `<div class="card"><div class="card-header"><span class="card-title">${t('appName')}</span></div><div class="empty-state"><div class="empty-icon">👋</div><p>${t('welcome')}, ${escapeHtml(state.user?.name || '')}!</p><p class="mt-8">${t('createFirst')}</p><button class="btn btn-primary btn-full mt-8" onclick="showCreateCouple()">${t('createCouple')}</button></div></div>`;
    return;
  }
  renderCoupleView();
}

async function showDashboard() {
  state.activeCoupleId = null;
  state.activeCouple = null;
  if (state.ws) { state.ws.close(); state.ws = null; state.wsConnected = false; }
  try { state.couples = (await api('/api/couples')).couples; } catch { toast('Failed to load couples','error'); }
  renderSidebar(); renderContent();
}

async function showCreateCouple() {
  const content = document.getElementById('content');
  const name = prompt(t('goalTitle').replace('title','name')) || '';
  if (!name) return;
  const partnerEmail = prompt(t('partnerEmail')) || '';
  try {
    const data = await api('/api/couples', { method:'POST', body: JSON.stringify({ name, partner_email: partnerEmail || undefined }) });
    state.couples = (await api('/api/couples')).couples;
    state.activeCoupleId = data.couple.id;
    renderSidebar(); renderContent();
    openCouple(data.couple.id);
  } catch (err) { toast(err.message || t('error'),'error'); }
}

async function openCouple(coupleId) {
  state.activeCoupleId = coupleId;
  try {
    const detail = await api(`/api/couples/${coupleId}`);
    state.activeCouple = detail.couple;
    state.members = detail.members || [];
  } catch (err) { toast(err.message || t('error'),'error'); return; }
  await loadMessages(coupleId);
  await loadGoals(coupleId);
  await fetchAiConsent(coupleId);
  renderSidebar();
  renderCoupleView();
  initWS();
}

async function fetchAiConsent(cid) {
  try {
    const data = await api(`/api/ai/consent/${cid}`);
    state.aiConsent = data;
  } catch (err) { /* consent endpoint may not exist yet */ }
}

async function toggleAiConsent() {
  if (!state.activeCoupleId) return;
  const newConsent = !state.aiConsent.my_consent;
  try {
    const data = await api('/api/ai/consent', {
      method: 'POST',
      body: JSON.stringify({ couple_id: state.activeCoupleId, consented: newConsent })
    });
    state.aiConsent = data;
    renderMessageList();
    if (!data.both_consented) {
      toast(t('aiConsentDisabled') || 'AI participation disabled for you');
    } else {
      toast(t('aiConsentEnabled') || 'AI participation enabled');
    }
  } catch (err) { toast(err.message || t('error'),'error'); }
}

async function loadMessages(cid) {
  try {
    const data = await api(`/api/messages/${cid}?limit=100`);
    state.messages = data.messages || [];
  } catch (err) { toast('Failed to load messages','error'); }
  renderMessageList();
}

function renderMessageList() {
  const content = document.getElementById('content');
  if (!content) return;
  const c = state.activeCouple;
  const me = state.user?.id;
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;gap:16px;">
      <div class="messages-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <button onclick="showDashboard()" class="btn btn-sm" style="color:var(--text-muted);">← ${t('back')}</button>
          <div>
            <div style="font-weight:600;">${escapeHtml(c?.name || 'Relationship')}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">${(state.members||[]).length} partner${state.members.length!==1?'s':''} • <span id="wsStatus">${state.wsConnected ? t('connected') : t('connecting')}</span></div>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <div class="ai-participation ${state.aiConsent.both_consented ? 'enabled' : 'disabled'}" onclick="toggleAiConsent()">
            <div class="ai-toggle ${state.aiConsent.both_consented ? 'enabled' : ''}"></div>
            <span>${t('aiConsentTitle')}</span>
          </div>
          <button onclick="showAI('coach')" class="ai-btn ai-coach">💬 ${t('aiCoach')}</button>
          <button onclick="showAI('mediate')" class="ai-btn ai-mediate" ${!state.aiConsent.both_consented ? 'disabled' : ''}>🤝 ${t('aiMediate')}</button>
          <button onclick="showAI('insight')" class="ai-btn ai-insight" ${!state.aiConsent.both_consented ? 'disabled' : ''}>🔍 ${t('aiInsight')}</button>
          <button onclick="showAIAnalysis('pattern')" class="ai-btn ai-pattern" ${!state.aiConsent.both_consented ? 'disabled' : ''}>📊 ${t('aiPattern')}</button>
        </div>
      </div>
      <div class="messages-container">
        <div class="messages-list" id="messagesList">
          ${state.messages.map(m => {
            const isMe = m.sender_id === me;
            const isDeleted = m.deleted_at;
            const reactions = m.reactions || {};
            const reactionHtml = Object.entries(reactions).map(([emoji, users]) => `
              <button class="reaction-btn ${users.some(u=>u.user_id===me)?'active':''}" onclick="toggleReaction('${m.id}','${escapeHtml(emoji)}')">${emoji} ${users.length}</button>
            `).join('');
            const mediaHtml = m.media_type ? `<div class="media-msg"><${m.media_type === 'image' ? 'img' : m.media_type === 'video' ? 'video' : 'div'} src="${escapeHtml(m.media_url||'')}" ${m.media_type === 'video' ? 'controls' : ''} style="${m.media_type !== 'image' && m.media_type !== 'video' ? 'background:#e2e8f0;padding:8px;border-radius:4px;color:var(--text-muted)' : ''}">${m.media_type !== 'image' && m.media_type !== 'video' ? '📎 ' + escapeHtml(m.media_type) : ''}</${m.media_type === 'image' ? 'img' : m.media_type === 'video' ? 'video' : 'div'}></div>` : '';
            return `
            <div class="message ${isMe ? 'me' : 'them'}${isDeleted ? ' text-muted' : ''}" id="msg-${m.id}">
              <div class="message-header-row">
                <span class="message-sender">${escapeHtml(m.sender_name || 'You')}</span>
                ${isMe ? `<span style="font-size:0.65rem;">${m.read_at ? '✓✓' : '✓'}</span>` : ''}
              </div>
              ${isDeleted ? '<div class="message-content">This message was deleted</div>' : mediaHtml}
              <div class="message-content">${escapeHtml(m.content || '')}</div>
              ${m.reply_to ? `<div style="font-size:0.75rem;color:var(--text-muted);border-left:2px solid var(--border);padding-left:6px;margin-bottom:4px;">↩ Reply</div>` : ''}
              <div class="message-meta">${formatTime(m.created_at)}${m.edited_at ? ' • edited' : ''}</div>
              <div class="reaction-row">${reactionHtml}</div>
              ${isMe ? `<div style="margin-top:6px;display:flex;gap:4px;"><button onclick="editMessage('${m.id}')" class="btn btn-sm btn-outline" style="font-size:0.75rem;">${t('editMessage')}</button><button onclick="deleteMessage('${m.id}')" class="btn btn-sm btn-outline" style="font-size:0.75rem;color:var(--error);">${t('deleteMessage')}</button></div>` : ''}
            </div>
          `}).join('')}
          <div id="typingIndicator" class="typing-indicator hidden"></div>
        </div>
        <div class="message-input-area">
          <input type="file" id="mediaFile" accept="image/*,video/*,audio/*" style="display:none" />
          <label onclick="document.getElementById('mediaFile').click()" class="btn btn-sm btn-outline" title="${t('mediaUpload')}">📎</label>
          <input type="text" id="msgInput" placeholder="${t('sendMessage')}" />
          <button onclick="sendMessage()" class="btn btn-primary">${t('sendMessage').slice(0,1).toUpperCase()}</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('msgInput')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
  document.getElementById('msgInput')?.addEventListener('input', () => { broadcastTyping(); });
  document.getElementById('mediaFile')?.addEventListener('change', (e) => {
    if (e.target.files.length > 0) uploadAndSendMedia(e.target.files[0]);
  });
  scrollMessages();
  renderLangSelect();
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
}

async function sendMessage() {
  const input = document.getElementById('msgInput');
  const content = input.value.trim();
  if (!content || !state.activeCoupleId) return;
  input.value = '';
  try {
    await api('/api/messages', { method:'POST', body: JSON.stringify({ couple_id: state.activeCoupleId, content, type:'text' }) });
    // optimistic update handled by WS broadcast; reload to be safe
    await loadMessages(state.activeCoupleId);
  } catch (err) { toast(err.message || t('error'),'error'); }
}

function initWS() {
  if (!state.activeCoupleId || !state.token) return;
  if (state.ws) { state.ws.close(); }
  const wsUrl = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/ws?token=' + encodeURIComponent(state.token);
  state.ws = new WebSocket(wsUrl);
  state.ws.onopen = () => { state.wsConnected = true; const el = document.getElementById('wsStatus'); if (el) el.textContent = t('connected'); state.ws.send(JSON.stringify({ type:'join', couple_id: state.activeCoupleId })); };
  state.ws.onclose = () => { state.wsConnected = false; const el2 = document.getElementById('wsStatus'); if (el2) el2.textContent = t('disconnected'); setTimeout(initWS, 3000); };
  state.ws.onerror = () => { state.wsConnected = false; };
  state.ws.onmessage = (ev) => {
    try { const data = JSON.parse(ev.data); handleWS(data); } catch {}
  };
}

function handleWS(data) {
  if (data.type === 'message' && data.couple_id === state.activeCoupleId) {
    state.messages.push(data.message);
    renderMessageList();
    scrollMessages();
    toast('New message', 'info');
  } else if (data.type === 'typing' && data.couple_id === state.activeCoupleId) {
    const ti = document.getElementById('typingIndicator');
    if (ti) { ti.textContent = (data.user_name || 'Someone') + ' ' + t('typing'); ti.classList.remove('hidden'); setTimeout(()=>ti.classList.add('hidden'), 2000); }
  }
}

function broadcastTyping() {
  if (!state.ws || state.ws.readyState !== 1) return;
  state.ws.send(JSON.stringify({ type:'typing', couple_id: state.activeCoupleId, user_name: state.user?.name }));
}

async function toggleReaction(messageId, emoji) {
  try {
    await api(`/api/messages/${messageId}/reaction`, { method:'POST', body: JSON.stringify({ emoji }) });
    await loadMessages(state.activeCoupleId);
  } catch (err) { toast(err.message || t('error'),'error'); }
}

async function editMessage(messageId) {
  const newContent = prompt('Enter edited message:');
  if (!newContent) return;
  try {
    await api(`/api/messages/${messageId}`, { method:'PATCH', body: JSON.stringify({ content: newContent }) });
    await loadMessages(state.activeCoupleId);
  } catch (err) { toast(err.message || t('error'),'error'); }
}

async function deleteMessage(messageId) {
  if (!confirm('Delete this message?')) return;
  try {
    await api(`/api/messages/${messageId}`, { method:'DELETE' });
    await loadMessages(state.activeCoupleId);
  } catch (err) { toast(err.message || t('error'),'error'); }
}

async function uploadAndSendMedia(file) {
  if (!state.activeCoupleId) return;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('couple_id', state.activeCoupleId);
  formData.append('media_type', file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'voice');
  try {
    const uploadResult = await fetch(`${API_BASE}/api/messages/upload`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + state.token },
      body: formData,
    });
    const data = await uploadResult.json();
    if (!data.ok) throw new Error(data.error || 'Upload failed');
    await api('/api/messages', { method:'POST', body: JSON.stringify({
      couple_id: state.activeCoupleId,
      content: '',
      type: 'media',
      media_type: data.media_type,
      media_url: data.url,
      media_metadata: data.media_metadata,
    }) });
    await loadMessages(state.activeCoupleId);
  } catch (err) { toast(err.message || t('error'),'error'); }
}

async function showAIAnalysis(analysisType) {
  const titles = { pattern: t('aiPattern'), misunderstanding: t('aiMisunderstanding'), reply_suggestion: t('aiReplySuggestion'), summary: t('aiConversationSummary') };
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class=\"card\">
      <div class=\"card-header\">
        <button onclick=\"openCouple('${state.activeCoupleId}')\" class=\"btn btn-sm\" style=\"color:var(--text-muted);\">← ${t('back')}</button>
        <span class=\"card-title\">${titles[analysisType]}</span>
      </div>
      <div id=\"aiOutput\" class=\"ai-output\">${t('connecting')}...</div>
      <button class=\"btn btn-primary btn-full mb-8\" onclick=\"runAIAnalysis('${analysisType}')\">Generate Analysis</button>
      <button onclick=\"openCouple('${state.activeCoupleId}')\" class=\"btn btn-outline btn-full\">${t('back')}</button>
    </div>
  `;
  renderLangSelect();
}

async function runAIAnalysis(analysisType) {
  const out = document.getElementById('aiOutput');
  out.textContent = t('saving');
  try {
    const conversation = state.messages.map(m => `${m.sender_name || 'You'}: ${m.content}`).join('\n');
    const result = await api('/api/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({ couple_id: state.activeCoupleId, conversation, analysis_type: analysisType })
    });
    out.textContent = result.reply;
    out.style.fontStyle = 'normal';
    out.style.color = 'var(--text)';
    out.style.background = '#fff';
    toast(t('success'),'success');
  } catch (err) { out.textContent = err.message || t('error'); out.style.color = 'var(--error)'; }
}

// --- AI ---
async function showAI(mode) {
  const content = document.getElementById('content');
  const titles = { coach: t('aiCoach'), mediate: t('aiMediate'), insight: t('aiInsight') };
  content.innerHTML = `
    <div class="card">
      <div class="card-header">
        <button onclick="openCouple('${state.activeCoupleId}')" class="btn btn-sm" style="color:var(--text-muted);">← ${t('back')}</button>
        <span class="card-title">${titles[mode]}</span>
      </div>
      <div id="aiOutput" style="min-height:200px; padding:16px; background:#f8fafc; border:1px solid var(--border); border-radius:var(--radius); margin-bottom:16px; color:var(--text-muted); font-style:italic;">${t('connecting')}...</div>
      <div id="aiForm"></div>
    </div>
  `;
  renderLangSelect();

  if (mode === 'coach') {
    document.getElementById('aiForm').innerHTML = `
      <div class="form-group"><label>Message to coach</label><textarea id="coachMsg" rows="3" placeholder="Paste a message you want to rephrase..."></textarea></div>
      <button class="btn btn-primary btn-full" onclick="runAI('coach')">Get Coaching</button>
    `;
  } else if (mode === 'mediate') {
    document.getElementById('aiForm').innerHTML = `
      <div class="form-group"><label>Conversation to mediate</label><textarea id="medConv" rows="4" placeholder="Paste the disagreement conversation..."></textarea></div>
      <button class="btn btn-primary btn-full" onclick="runAI('mediate')">Get Mediation</button>
    `;
  } else {
    document.getElementById('aiForm').innerHTML = `
      <button class="btn btn-primary btn-full" onclick="runAI('insight')">Generate Relationship Insight</button>
    `;
  }
}

async function runAI(mode) {
  const out = document.getElementById('aiOutput');
  out.textContent = t('saving');
  try {
    let result;
    if (mode === 'coach') {
      const msg = document.getElementById('coachMsg').value;
      result = await api('/api/ai/coach', { method:'POST', body: JSON.stringify({ couple_id: state.activeCoupleId, message: msg }) });
    } else if (mode === 'mediate') {
      const conv = document.getElementById('medConv').value;
      result = await api('/api/ai/mediate', { method:'POST', body: JSON.stringify({ couple_id: state.activeCoupleId, conversation: conv }) });
    } else {
      result = await api('/api/ai/insight', { method:'POST', body: JSON.stringify({ couple_id: state.activeCoupleId }) });
    }
    out.textContent = result.reply;
    out.style.fontStyle = 'normal';
    out.style.color = 'var(--text)';
    out.style.background = '#fff';
    toast(t('success'),'success');
  } catch (err) { out.textContent = err.message || t('error'); out.style.color = 'var(--error)'; }
}

// --- Goals ---
async function loadGoals(cid) {
  try {
    const data = await api(`/api/goals/${cid}`);
    state.goals = data.goals || [];
    const comm = await api(`/api/goals/commitments/${cid}`);
    state.commitments = comm.commitments || [];
  } catch (err) { toast('Failed to load goals','error'); }
}

function renderCoupleView() {
  const content = document.getElementById('content');
  if (!content || !state.activeCoupleId) return;
  const c = state.activeCouple;
  const me = state.user?.id;
  const score = Math.floor(50 + (state.messages?.length || 0) * 2 + (state.goals?.length || 0) * 5);
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;align-items:center;justify-content:between;gap:10px;">
        <button onclick="showDashboard()" class="btn btn-sm" style="color:var(--text-muted);">← ${t('back')}</button>
        <h1 style="font-size:1.25rem;font-weight:700;">${escapeHtml(c?.name || 'Relationship')}</h1>
      </div>
      <div class="health-score">
        <div class="score-circle">
          <div class="score-text">${Math.min(100, score)}</div>
          <div class="score-label">${t('healthScore')}</div>
        </div>
        <div style="flex:1;">
          <div style="font-weight:600;">${(state.members||[]).length} partners</div>
          <div class="text-muted">${(state.members||[]).map(m=>m.name).join(', ')}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="card">
          <div class="card-header"><span class="card-title">${t('messages')}</span></div>
          <div style="display:flex;gap:8px;">
            <button onclick="renderMessageList()" class="btn btn-primary btn-full">Open Chat</button>
            <button onclick="showAI('insight')" class="btn btn-outline btn-full">${t('aiInsight')}</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">${t('goals')}</span></div>
          <div style="display:flex;gap:8px;">
            <button onclick="showGoals()" class="btn btn-primary btn-full">View Goals</button>
            <button onclick="showAI('coach')" class="btn btn-outline btn-full">${t('aiCoach')}</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Activity</span></div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${state.messages?.slice(-3).map(m => `<div style="padding:8px;border-bottom:1px solid var(--border);font-size:0.9rem;"><strong>${escapeHtml(m.sender_name||'You')}</strong>: ${escapeHtml(m.content)}</div>`).join('') || '<div class="text-muted">No activity yet.</div>'}
        </div>
      </div>
    </div>
  `;
  renderLangSelect();
}

async function showGoals() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
        <button onclick="openCouple('${state.activeCoupleId}')" class="btn btn-sm" style="color:var(--text-muted);">← ${t('back')}</button>
        <span class="card-title">${t('goals')}</span>
      </div>
      <div class="form-group mb-8">
        <input type="text" id="newGoalTitle" placeholder="${t('goalTitle')}" />
      </div>
      <div class="form-group mb-8">
        <textarea id="newGoalDesc" rows="2" placeholder="${t('goalDesc')}"></textarea>
      </div>
      <div class="form-group mb-8">
        <input type="date" id="newGoalDate" />
      </div>
      <button class="btn btn-primary btn-full mb-16" onclick="createGoal()">${t('createGoal')}</button>
      <div class="section-title mb-8">${t('commitments')}</div>
      <button class="btn btn-outline btn-full mb-8" onclick="showAddCommitment()">${t('addCommitment')}</button>
      <div id="goalsList" class="goals-list"></div>
      <div id="commitmentsList"></div>
    </div>
  `;
  renderGoalsList(); renderCommitmentsList(); renderLangSelect();
}

async function createGoal() {
  const title = document.getElementById('newGoalTitle').value.trim();
  const desc = document.getElementById('newGoalDesc').value.trim();
  const date = document.getElementById('newGoalDate').value;
  if (!title) { toast(t('fillAll')); return; }
  try {
    await api('/api/goals', { method:'POST', body: JSON.stringify({ couple_id: state.activeCoupleId, title, description: desc, target_date: date }) });
    toast(t('saved'),'success');
    await loadGoals(state.activeCoupleId);
    renderGoalsList();
  } catch (err) { toast(err.message||t('error'),'error'); }
}

async function renderGoalsList() {
  const el = document.getElementById('goalsList');
  if (!el) return;
  el.innerHTML = (state.goals||[]).map(g => `
    <div class="goal-item">
      <div class="goal-title">${escapeHtml(g.title)}</div>
      <div class="goal-meta">${escapeHtml(g.description||'')} ${g.target_date ? '• ' + g.target_date : ''}</div>
      <div style="margin-top:6px;"><button onclick="toggleGoal('${g.id}','${g.status}')" class="btn btn-sm btn-outline">${g.status === 'completed' ? 'Reopen' : 'Mark Complete'}</button></div>
    </div>
  `).join('') || '<div class="empty-state" style="padding:16px;"><div class="text-muted">No goals yet.</div></div>';
}

async function toggleGoal(id, status) {
  await api(`/api/goals/${id}`, { method:'PATCH', body: JSON.stringify({ status: status === 'completed' ? 'active' : 'completed' }) });
  await loadGoals(state.activeCoupleId);
  renderGoalsList();
}

async function showAddCommitment() {
  const ownerOptions = (state.members||[]).map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  document.getElementById('commitmentsList').innerHTML = `
    <div class="card mt-8">
      <div class="form-group mb-8"><input type="text" id="newCommTitle" placeholder="${t('commitmentTitle')}" /></div>
      <div class="form-group mb-8"><select id="newCommOwner">${ownerOptions}</select></div>
      <div class="form-group mb-8"><input type="date" id="newCommDate" /></div>
      <button class="btn btn-primary btn-full" onclick="createCommitment()">${t('addCommitment')}</button>
      <button onclick="showGoals()" class="btn btn-outline btn-full mt-8">Cancel</button>
    </div>
  `;
}

async function createCommitment() {
  const title = document.getElementById('newCommTitle').value.trim();
  const owner = document.getElementById('newCommOwner').value;
  const date = document.getElementById('newCommDate').value;
  if (!title) { toast(t('fillAll')); return; }
  try {
    await api('/api/goals/commitments', { method:'POST', body: JSON.stringify({ couple_id: state.activeCoupleId, title, owner_id: owner, due_date: date }) });
    toast(t('saved'),'success');
    await loadGoals(state.activeCoupleId);
    showGoals();
  } catch (err) { toast(err.message||t('error'),'error'); }
}

async function renderCommitmentsList() {
  const el = document.getElementById('commitmentsList');
  if (!el) return;
  el.innerHTML = (state.commitments||[]).map(c => `
    <div class="commitment-item">
      <input type="checkbox" ${c.status === 'completed' ? 'checked' : ''} onchange="toggleCommitment('${c.id}','${c.status}')" />
      <div style="flex:1;">
        <div class="goal-title">${escapeHtml(c.title)} ${c.status === 'completed' ? '✓' : ''}</div>
        <div class="goal-meta">${escapeHtml((state.members||[]).find(m=>m.id===c.owner_id)?.name || '')} • ${c.due_date || 'No due date'}</div>
      </div>
    </div>
  `).join('') || '<div class="empty-state" style="padding:16px;"><div class="text-muted">No commitments yet.</div></div>';
}

async function toggleCommitment(id, status) {
  await api(`/api/goals/commitments/${id}`, { method:'PATCH', body: JSON.stringify({ status: status === 'completed' ? 'active' : 'completed' }) });
  await loadGoals(state.activeCoupleId);
  renderCommitmentsList();
}

function scrollMessages() {
  const el = document.getElementById('messagesList');
  if (el) el.scrollTop = el.scrollHeight;
}

// --- Init ---
if (state.token) {
  api('/api/auth/me').then(d => { state.user = d.user; state.language = d.user.language || 'en'; showApp(); }).catch(() => showAuth());
} else {
  showAuth();
}

// Global error handler to surface any JS errors as toasts
window.onerror = (msg, url, line) => {
  console.error('JS Error:', msg, url, line);
  const t = (k) => { const L = LABELS[state.language] || LABELS.en; return L[k] || k; };
  const el = document.getElementById('toast');
  if (el) { el.textContent = 'JS Error: ' + msg; el.className = 'toast show'; setTimeout(() => el.classList.remove('show'), 5000); }
  return true;
};
