// ==== Kodcu — AI Kodlama Ajanı ====
// Basit, bağımlılıksız (framework'süz) istemci. Tüm anahtarlar sadece
// bu cihazda (localStorage) tutulur; hiçbir istek Anthropic/Claude
// sunucularına gitmez — doğrudan Ollama Cloud / GitHub / Vercel API'lerine gider.

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._h);
  toast._h = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------- Görünüm (tab) yönetimi ----------
const titles = { chat: 'Sohbet', files: 'Dosyalar', github: 'GitHub', vercel: 'Vercel', settings: 'Ayarlar' };
$$('.rail-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.rail-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    $$('.view').forEach(v => v.classList.remove('active'));
    $('#view-' + view).classList.add('active');
    $('#header-title').textContent = titles[view];
  });
});

// ---------- Ollama Cloud ayarları ----------
function loadOllamaSettings() {
  $('#ol-key').value = store.get('ol_key', '');
  $('#ol-host').value = store.get('ol_host', 'https://ollama.com');
  $('#ol-model').value = store.get('ol_model', 'gpt-oss:120b-cloud');
  $('#ol-system').value = store.get('ol_system', $('#ol-system').value);
  updateConnStatus();
}
function updateConnStatus() {
  const key = store.get('ol_key', '');
  $('#conn-dot').classList.toggle('on', !!key);
  $('#conn-text').textContent = key ? 'Ollama Cloud bağlı' : 'Ollama Cloud bağlı değil';
  $('#model-hint').textContent = store.get('ol_model', '—');
}
$('#ol-save').addEventListener('click', async () => {
  store.set('ol_key', $('#ol-key').value.trim());
  store.set('ol_host', ($('#ol-host').value.trim() || 'https://ollama.com').replace(/\/+$/, ''));
  store.set('ol_model', $('#ol-model').value.trim());
  store.set('ol_system', $('#ol-system').value);
  updateConnStatus();
  const log = $('#ol-log'); log.style.display = 'block'; log.textContent = 'Bağlantı test ediliyor…';
  try {
    const r = await callOllama([{ role: 'user', content: 'ping — tek kelimeyle "pong" yanıtla.' }]);
    log.textContent = 'Bağlantı başarılı ✓\nModel yanıtı: ' + r;
    toast('Ayarlar kaydedildi');
  } catch (e) {
    log.textContent = 'Bağlantı hatası:\n' + e.message +
      '\n\nİpucu: Ollama Cloud CORS engelliyorsa, bu isteği kendi basit bir proxy sunucun (ör. Vercel/Cloudflare Worker) üzerinden yönlendirmen gerekebilir.';
  }
});

async function callOllama(messages) {
  const key = store.get('ol_key', '');
  const host = store.get('ol_host', 'https://ollama.com');
  const model = store.get('ol_model', 'gpt-oss:120b-cloud');
  const system = store.get('ol_system', '');
  if (!key) throw new Error('Önce Ayarlar sekmesinden bir Ollama Cloud API anahtarı gir.');

  const body = {
    model,
    messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
    stream: false,
  };

  const res = await fetch(host + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.message?.content ?? JSON.stringify(data).slice(0, 400);
}

// ---------- Sohbet ----------
let history = store.get('chat_history', []);

function renderMarkdownLite(text) {
  // Basit ve güvenli: sadece kod bloklarını ve satır içi kodu biçimlendirir.
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let out = '';
  const parts = text.split(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g);
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) {
      out += esc(parts[i]).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
    } else if (i % 3 === 2) {
      const lang = parts[i - 1] || '';
      out += `<pre data-lang="${esc(lang)}">${esc(parts[i])}</pre>`;
    }
  }
  return out;
}

function addMessage(role, content, { save = true } = {}) {
  const log = $('#chatlog');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  const who = role === 'user' ? 'SEN' : 'AJAN';
  div.innerHTML = `<div class="bubble"><div class="who">${who}</div><div class="body">${renderMarkdownLite(content)}</div></div>`;
  if (role === 'assistant') {
    const codeBlocks = div.querySelectorAll('pre');
    if (codeBlocks.length) {
      const actions = document.createElement('div');
      actions.className = 'actions';
      const btn = document.createElement('button');
      btn.className = 'chip-btn';
      btn.textContent = 'Kod bloklarını dosya olarak kaydet';
      btn.onclick = () => {
        codeBlocks.forEach((pre, idx) => {
          const name = prompt('Dosya adı:', `dosya-${Date.now()}-${idx}.txt`);
          if (name) saveFile(name, pre.textContent);
        });
        toast('Dosyalar kaydedildi — Dosyalar sekmesine bak');
      };
      actions.appendChild(btn);
      div.querySelector('.bubble').appendChild(actions);
    }
  }
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  if (save) { history.push({ role, content }); store.set('chat_history', history.slice(-40)); }
}

function renderHistory() {
  $('#chatlog').innerHTML = '';
  if (!history.length) {
    addMessage('assistant',
      'Merhaba! Ben senin kodlama ajanınım. Ollama Cloud üzerinden çalışırım.\n\n' +
      '1. **Ayarlar**\'dan API anahtarını gir.\n' +
      '2. Bana ne yazmamı istediğini söyle — kod üretirim, dosya olarak kaydedebilirsin.\n' +
      '3. **GitHub** sekmesinden bir depoya commit\'leyebilir, **Vercel** sekmesinden dağıtabilirsin.',
      { save: false });
    return;
  }
  history.forEach(m => addMessage(m.role, m.content, { save: false }));
}

async function sendPrompt() {
  const ta = $('#prompt');
  const text = ta.value.trim();
  if (!text) return;
  ta.value = ''; autoGrow(ta);
  addMessage('user', text);
  $('#send').disabled = true;
  const thinkingId = 'thinking-' + Date.now();
  const log = $('#chatlog');
  const think = document.createElement('div');
  think.className = 'msg assistant'; think.id = thinkingId;
  think.innerHTML = `<div class="bubble"><div class="who">AJAN</div><div class="body">…</div></div>`;
  log.appendChild(think); log.scrollTop = log.scrollHeight;
  try {
    const msgs = history.slice(-16).map(m => ({ role: m.role, content: m.content }));
    const reply = await callOllama(msgs);
    think.remove();
    addMessage('assistant', reply);
  } catch (e) {
    think.remove();
    addMessage('assistant', '⚠️ Hata: ' + e.message, { save: false });
  } finally {
    $('#send').disabled = false;
  }
}
$('#send').addEventListener('click', sendPrompt);
function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; }
$('#prompt').addEventListener('input', (e) => autoGrow(e.target));
$('#prompt').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPrompt(); }
});

// ---------- Dosyalar ----------
let files = store.get('files', {}); // { name: content }

function renderFileList() {
  const wrap = $('#file-list');
  const names = Object.keys(files);
  if (!names.length) { wrap.innerHTML = '<div class="empty">Henüz dosya yok.</div>'; return; }
  wrap.innerHTML = names.map(n => `
    <div class="file-row">
      <span class="name">${n}</span>
      <span>
        <button class="chip-btn open-file" data-name="${n}">Aç</button>
        <button class="chip-btn del-file" data-name="${n}">Sil</button>
      </span>
    </div>`).join('');
  wrap.querySelectorAll('.open-file').forEach(b => b.onclick = () => openFile(b.dataset.name));
  wrap.querySelectorAll('.del-file').forEach(b => b.onclick = () => { delete files[b.dataset.name]; store.set('files', files); renderFileList(); });
}
let currentFile = null;
function openFile(name) {
  currentFile = name;
  $('#editor-label').textContent = 'Editör — ' + name;
  $('#editor').value = files[name] || '';
}
function saveFile(name, content) {
  files[name] = content;
  store.set('files', files);
  renderFileList();
  openFile(name);
}
$('#new-file-btn').addEventListener('click', () => {
  const name = prompt('Yeni dosya adı:', 'app.js');
  if (name) saveFile(name, '');
});
$('#save-file-btn').addEventListener('click', () => {
  if (!currentFile) { toast('Önce bir dosya seç veya oluştur'); return; }
  saveFile(currentFile, $('#editor').value);
  toast('Kaydedildi');
});
$('#ask-ai-about-file-btn').addEventListener('click', () => {
  if (!currentFile) { toast('Önce bir dosya seç'); return; }
  $$('.rail-btn').forEach(b => b.classList.toggle('active', b.dataset.view === 'chat'));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-chat'));
  $('#header-title').textContent = 'Sohbet';
  $('#prompt').value = `Şu dosyayı incele ve iyileştir (\`${currentFile}\`):\n\n\`\`\`\n${$('#editor').value}\n\`\`\`\n\n`;
  autoGrow($('#prompt'));
  $('#prompt').focus();
});
$('#upload-input').addEventListener('change', (e) => {
  Array.from(e.target.files).forEach(f => {
    const reader = new FileReader();
    reader.onload = () => saveFile(f.name, reader.result);
    reader.readAsText(f);
  });
});

// ---------- GitHub ----------
function loadGithubSettings() {
  $('#gh-token').value = store.get('gh_token', '');
  $('#gh-owner').value = store.get('gh_owner', '');
  $('#gh-repo').value = store.get('gh_repo', '');
  $('#gh-branch').value = store.get('gh_branch', 'main');
}
function saveGithubSettings() {
  store.set('gh_token', $('#gh-token').value.trim());
  store.set('gh_owner', $('#gh-owner').value.trim());
  store.set('gh_repo', $('#gh-repo').value.trim());
  store.set('gh_branch', $('#gh-branch').value.trim() || 'main');
}
function ghLog(msg) { const l = $('#gh-log'); l.style.display = 'block'; l.textContent = msg; }
async function ghApi(path, opts = {}) {
  const token = store.get('gh_token', '');
  if (!token) throw new Error('Önce bir GitHub token gir.');
  const res = await fetch('https://api.github.com' + path, {
    ...opts,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}
$('#gh-connect').addEventListener('click', async () => {
  saveGithubSettings();
  try {
    const user = await ghApi('/user');
    ghLog(`Bağlandı ✓ — ${user.login} olarak giriş yapıldı.`);
    toast('GitHub doğrulandı');
  } catch (e) { ghLog('Hata: ' + e.message); }
});
$('#gh-list').addEventListener('click', async () => {
  saveGithubSettings();
  const owner = store.get('gh_owner'), repo = store.get('gh_repo'), branch = store.get('gh_branch');
  if (!owner || !repo) { toast('Repo sahibi ve adı gerekli'); return; }
  try {
    const tree = await ghApi(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
    const wrap = $('#gh-repolist'); wrap.style.display = 'block';
    const items = (tree.tree || []).filter(t => t.type === 'blob').slice(0, 200);
    wrap.innerHTML = items.map(t => `<div class="file-row"><span class="name">${t.path}</span><span class="tag">${(t.size/1024).toFixed(1)} KB</span></div>`).join('') || '<div class="empty">Depo boş görünüyor.</div>';
    ghLog(`${items.length} dosya listelendi.`);
  } catch (e) { ghLog('Hata: ' + e.message); }
});
$('#gh-push').addEventListener('click', async () => {
  saveGithubSettings();
  const owner = store.get('gh_owner'), repo = store.get('gh_repo'), branch = store.get('gh_branch');
  if (!owner || !repo) { toast('Repo sahibi ve adı gerekli'); return; }
  if (!currentFile) { toast('Önce Dosyalar sekmesinden bir dosya aç'); return; }
  const content = $('#editor').value;
  try {
    let sha;
    try {
      const existing = await ghApi(`/repos/${owner}/${repo}/contents/${encodeURIComponent(currentFile)}?ref=${branch}`);
      sha = existing.sha;
    } catch { /* dosya yoksa yeni oluşturulacak */ }
    const body = {
      message: `Kodcu: ${currentFile} güncellendi`,
      content: btoa(unescape(encodeURIComponent(content))),
      branch,
      ...(sha ? { sha } : {}),
    };
    const res = await ghApi(`/repos/${owner}/${repo}/contents/${encodeURIComponent(currentFile)}`, {
      method: 'PUT', body: JSON.stringify(body),
    });
    ghLog(`Commit edildi ✓ — ${res.commit?.sha?.slice(0,7) || ''}`);
    toast('GitHub\'a işlendi');
  } catch (e) { ghLog('Hata: ' + e.message); }
});

// ---------- Vercel ----------
function loadVercelSettings() {
  $('#vc-token').value = store.get('vc_token', '');
  $('#vc-project').value = store.get('vc_project', '');
  $('#vc-team').value = store.get('vc_team', '');
}
function saveVercelSettings() {
  store.set('vc_token', $('#vc-token').value.trim());
  store.set('vc_project', $('#vc-project').value.trim());
  store.set('vc_team', $('#vc-team').value.trim());
}
function vcLog(msg) { const l = $('#vc-log'); l.style.display = 'block'; l.textContent = msg; }
async function vcApi(path) {
  const token = store.get('vc_token', '');
  const team = store.get('vc_team', '');
  if (!token) throw new Error('Önce bir Vercel token gir.');
  const url = 'https://api.vercel.com' + path + (team ? (path.includes('?') ? '&' : '?') + 'teamId=' + team : '');
  const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status}`);
  return json;
}
$('#vc-connect').addEventListener('click', async () => {
  saveVercelSettings();
  const project = store.get('vc_project');
  try {
    const data = await vcApi(`/v6/deployments?projectId=${encodeURIComponent(project)}&limit=5`);
    const wrap = $('#vc-list'); wrap.style.display = 'block';
    const deps = data.deployments || [];
    wrap.innerHTML = deps.map(d => `<div class="file-row"><span class="name">${d.name} — ${d.url}</span><span class="tag">${d.readyState || d.state}</span></div>`).join('') || '<div class="empty">Dağıtım bulunamadı.</div>';
    vcLog(`${deps.length} dağıtım bulundu.`);
  } catch (e) { vcLog('Hata: ' + e.message); }
});
$('#vc-deploy').addEventListener('click', async () => {
  saveVercelSettings();
  const project = store.get('vc_project');
  try {
    const data = await vcApi(`/v6/deployments?projectId=${encodeURIComponent(project)}&limit=1`);
    const last = (data.deployments || [])[0];
    if (!last) throw new Error('Yeniden dağıtılacak önceki bir dağıtım bulunamadı.');
    const token = store.get('vc_token'), team = store.get('vc_team');
    const url = 'https://api.vercel.com/v13/deployments' + (team ? '?teamId=' + team : '');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: last.name, deploymentId: last.uid, target: last.target || 'production' }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status}`);
    vcLog(`Yeni dağıtım tetiklendi ✓ — ${json.url || json.id}`);
    toast('Vercel dağıtımı başlatıldı');
  } catch (e) { vcLog('Hata: ' + e.message); }
});

// ---------- Temizle ----------
$('#clear-all').addEventListener('click', () => {
  if (!confirm('Tüm yerel veriler (anahtarlar, dosyalar, sohbet geçmişi) silinsin mi?')) return;
  localStorage.clear();
  location.reload();
});

// ---------- Başlangıç ----------
loadOllamaSettings();
loadGithubSettings();
loadVercelSettings();
renderFileList();
renderHistory();
