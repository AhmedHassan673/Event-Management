const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let currentEvent = null;

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, { headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, ...opts });
  const body = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Request failed');
  return body;
}

async function load() {
  const list = $('#list');
  try {
    const events = await api('/events');
    if (!events.length) { list.innerHTML = '<p class="empty">No events yet. Check back soon.</p>'; return; }
    list.innerHTML = events.map((e) => {
      const left = e.capacity - e.registered;
      const when = new Date(e.starts_at).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' });
      return `<article class="card">
        <h3>${esc(e.title)}</h3>
        <p class="meta">${esc(when)} at ${esc(e.venue)}</p>
        <p>${esc(e.description)}</p>
        <span class="seats ${left <= 0 ? 'full' : ''}">${left <= 0 ? 'Event full' : left + ' seats left'}</span>
        <button class="btn" data-id="${e.id}" data-title="${esc(e.title)}" ${left <= 0 ? 'disabled' : ''}>Register</button>
      </article>`;
    }).join('');
  } catch (err) { list.innerHTML = `<p class="msg err">Could not load events: ${esc(err.message)}</p>`; }
}

$('#list').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-id]');
  if (!b) return;
  currentEvent = b.dataset.id;
  $('#regTitle').textContent = 'Register for ' + b.dataset.title;
  $('#regMsg').textContent = '';
  $('#regDialog').showModal();
});
$('#regCancel').onclick = () => $('#regDialog').close();
$('#regForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#regMsg');
  try {
    await api(`/events/${currentEvent}/register`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
    msg.className = 'msg ok'; msg.textContent = 'You are registered. See you there!';
    e.target.reset(); load();
  } catch (err) { msg.className = 'msg err'; msg.textContent = err.message; }
});

$('#adminBtn').onclick = () => $('#adminDialog').showModal();
$('#adminCancel').onclick = () => $('#adminDialog').close();
$('#adminForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  const key = d.key; delete d.key;
  d.starts_at = new Date(d.starts_at).toISOString();
  d.capacity = Number(d.capacity);
  const msg = $('#adminMsg');
  try {
    await api('/events', { method: 'POST', headers: { 'x-admin-key': key }, body: JSON.stringify(d) });
    msg.className = 'msg ok'; msg.textContent = 'Event published.';
    e.target.reset(); load();
  } catch (err) { msg.className = 'msg err'; msg.textContent = err.message; }
});

load();
