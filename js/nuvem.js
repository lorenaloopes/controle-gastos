/* Sincronização com Firebase (login Google + Firestore).
   Documento: usuarios/{uid}/dados/estado  →  { estado: "<json>", atualizado: timestamp } */
const cfg = window.FIREBASE_CONFIG;
const App = window.App;
const V = '10.12.2';
const DONO = 'controleGastos.v1.dono'; // uid da conta dona da cópia local

const btn = document.getElementById('loginBtn');
const status = document.getElementById('syncStatus');
const googleBtn = document.getElementById('googleBtn');
const erroBox = document.getElementById('loginErro');
const setStatus = (txt, cls = '') => { status.textContent = txt; status.className = 'sync ' + cls; status.hidden = !txt; };
// 'pending' = carregando, 'out' = tela de login, 'in' = app liberado
const setAuth = (estado) => { document.body.dataset.auth = estado; };
const mostrarErro = (msg) => { erroBox.textContent = msg; erroBox.hidden = !msg; };

const MENSAGENS = {
  'auth/unauthorized-domain': 'Este endereço não está autorizado no Firebase (Authentication → Domínios autorizados).',
  'auth/popup-blocked': 'O navegador bloqueou a janela de login. Permita pop-ups para este site e tente de novo.',
  'auth/network-request-failed': 'Sem conexão com a internet. Verifique e tente de novo.',
  'auth/operation-not-allowed': 'O login com Google não está ativado no Firebase.',
};

if (!cfg) {
  btn.hidden = true;
  setStatus('');
} else {
  iniciar().catch((e) => {
    console.error(e);
    setAuth('out');
    googleBtn.disabled = true;
    mostrarErro('Não foi possível conectar ao serviço de login. Verifique a internet e recarregue a página.');
  });
}

async function iniciar() {
  const [{ initializeApp }, auth, fs] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  const app = initializeApp(cfg);
  const a = auth.getAuth(app);
  const db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() });

  let ref = null, ultimoEnviado = null, pararEscuta = null, timer = null;

  async function entrar() {
    mostrarErro('');
    googleBtn.disabled = true;
    try { await auth.signInWithPopup(a, new auth.GoogleAuthProvider()); }
    catch (e) {
      if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e.code)) mostrarErro(MENSAGENS[e.code] || 'Não foi possível entrar: ' + e.message);
    } finally { googleBtn.disabled = false; }
  }
  googleBtn.onclick = entrar;

  // Ao sair: apaga a cópia local E o cache do Firestore deste navegador
  async function sairEApagar() {
    try { await auth.signOut(a); } catch {}
    App.limpar();
    try { localStorage.removeItem(DONO); } catch {}
    try { await fs.terminate(db); await fs.clearIndexedDbPersistence(db); } catch (e) { console.warn(e); }
    location.reload();
  }

  btn.hidden = false;
  btn.onclick = async () => {
    if (a.currentUser) {
      if (confirm(`Sair da conta ${a.currentUser.email}?\nOs dados continuam salvos na nuvem e serão apagados deste navegador.`)) await sairEApagar();
    } else entrar();
  };

  // chamado pelo app a cada alteração
  App.aoSalvar = (state) => {
    if (!ref) return;
    clearTimeout(timer);
    setStatus('salvando…', 'pend');
    timer = setTimeout(() => enviar(state), 800);
  };

  async function enviar(state) {
    const json = JSON.stringify(state);
    if (json === ultimoEnviado) { setStatus('☁ salvo', 'ok'); return; }
    ultimoEnviado = json;
    try {
      await fs.setDoc(ref, { estado: json, atualizado: fs.serverTimestamp() });
      setStatus(navigator.onLine ? '☁ salvo' : '☁ offline — envia ao reconectar', navigator.onLine ? 'ok' : 'pend');
    } catch (e) {
      console.error(e); ultimoEnviado = null;
      setStatus('⚠ não salvou na nuvem', 'err');
    }
  }

  auth.onAuthStateChanged(a, async (user) => {
    pararEscuta?.(); pararEscuta = null; ref = null; ultimoEnviado = null;
    if (!user) {
      App.limpar(); // sem conta, nada de dados na tela nem no navegador
      btn.textContent = 'Entrar com Google';
      btn.title = 'Sincronizar seus dados entre aparelhos';
      setStatus('', '');
      setAuth('out');
      return;
    }
    setAuth('pending');
    btn.textContent = (user.displayName || user.email).split(' ')[0];
    btn.title = `${user.email} — clique para sair`;
    setStatus('carregando…', 'pend');
    ref = fs.doc(db, 'usuarios', user.uid, 'dados', 'estado');
    try { await carregarDados(user); }
    catch (e) { console.error(e); setStatus('⚠ erro ao carregar da nuvem', 'err'); }
    finally { setAuth('in'); }
  });

  // SEGURANÇA: a cópia local do navegador só vale para a conta dona dela.
  // Nunca enviamos para a nuvem dados locais de outra pessoa (ou de ninguém).
  async function carregarDados(user) {
    let dono = null;
    try { dono = localStorage.getItem(DONO); } catch {}
    if (dono !== user.uid) App.limpar(); // dados locais de outra conta ou sem dono: descarta, não envia

    const snap = await fs.getDoc(ref);
    if (snap.exists()) {
      const remoto = snap.data().estado;
      App.setState(JSON.parse(remoto));
      const atual = JSON.stringify(App.getState());
      if (atual !== remoto) await enviar(App.getState()); // grava a atualização automática na nuvem
      ultimoEnviado = ultimoEnviado || remoto;
    }
    try { localStorage.setItem(DONO, user.uid); } catch {}
    setStatus('☁ salvo', 'ok');

    // atualiza em tempo real quando outro aparelho salvar
    pararEscuta = fs.onSnapshot(ref, (s) => {
      if (!s.exists() || s.metadata.hasPendingWrites) return;
      const json = s.data().estado;
      if (json && json !== JSON.stringify(App.getState())) {
        ultimoEnviado = json;
        App.setState(JSON.parse(json));
        App.toast('Atualizado de outro aparelho');
      }
    });
  }
}
