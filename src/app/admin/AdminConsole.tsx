'use client';
import { useCallback, useEffect, useState } from 'react';

type Tab = 'pages' | 'themes' | 'plugins' | 'connection';
type WPPage = {
  id: number; slug: string; status: string; modified: string; link?: string;
  title: { raw?: string; rendered?: string }; content: { raw?: string; rendered?: string };
};
type Theme = { stylesheet: string; name: string; version: string; active: boolean };
type Plugin = { file: string; name: string; version: string; active: boolean };
type Status = {
  site: string; wordpress: string; origin: string; environment: string; canManageStaging: boolean;
  adminUrl: string; canEditPages: boolean; canInstallThemes: boolean; canInstallPlugins: boolean;
};
type Editor = { id: number; title: string; content: string; status: string };
const emptyEditor: Editor = { id: 0, title: '', content: '', status: 'draft' };

async function api<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    credentials: 'same-origin', cache: 'no-store',
  });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || 'WordPress request failed');
  return payload;
}

export default function AdminConsole({ ready, signedIn, accountName }: {
  ready: boolean; signedIn: boolean; accountName: string;
}) {
  const [tab, setTab] = useState<Tab>('pages');
  const [username, setUsername] = useState('');
  const [applicationPassword, setApplicationPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [pages, setPages] = useState<WPPage[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);

  const reload = useCallback(async () => {
    setLoading(true); setError('');
    const [s, p, t, g] = await Promise.allSettled([
      api<Status>('/api/admin/cms?resource=status'),
      api<WPPage[]>('/api/admin/cms?resource=pages'),
      api<Theme[]>('/api/admin/cms?resource=themes'),
      api<Plugin[]>('/api/admin/cms?resource=plugins'),
    ]);
    if (s.status === 'fulfilled') setStatus(s.value);
    if (p.status === 'fulfilled') setPages(p.value);
    if (t.status === 'fulfilled') setThemes(t.value);
    if (g.status === 'fulfilled') setPlugins(g.value);
    const failure = [s, p, t, g].find((item) => item.status === 'rejected');
    if (failure?.status === 'rejected') setError(failure.reason instanceof Error ? failure.reason.message : 'CMS connection failed');
    setLoading(false);
  }, []);
  useEffect(() => { if (signedIn) void reload(); }, [signedIn, reload]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api('/api/admin/session', { username, applicationPassword });
      setApplicationPassword('');
      window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Login failed'); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true);
    try { await api('/api/admin/session', { action: 'logout' }); window.location.reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not sign out'); setBusy(false); }
  }
  async function savePage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editor) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/api/admin/cms', { action: 'save-page', ...editor });
      setNotice('Page saved to WordPress. Frontend cache updating requires the configured bridge.');
      setEditor(null); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setBusy(false); }
  }
  async function changeTheme(theme: Theme) {
    if (!window.confirm('Activate ' + theme.name + ' on WordPress STAGING? This will not restyle the Next.js site.')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/api/admin/cms', { action: 'activate-theme', stylesheet: theme.stylesheet });
      setNotice('Staging theme activated. Preview and test on the WordPress server.'); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Activation failed'); }
    finally { setBusy(false); }
  }
  async function togglePlugin(plugin: Plugin) {
    if (!window.confirm((plugin.active ? 'Deactivate ' : 'Activate ') + plugin.name + ' on WordPress STAGING?')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/api/admin/cms', { action: 'toggle-plugin', plugin: plugin.file, active: !plugin.active });
      setNotice('Staging plugin state updated.'); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Activation failed'); }
    finally { setBusy(false); }
  }

  const admin = status?.adminUrl || '';
  const nativeLink = (path: string) => admin ? admin.replace(/\/$/, '/') + path : '';
  return <div className="wpcontrol">
    <div className="wpcontrol-header">
      <div><span className="wpcontrol-eyebrow">PINCODE IT / WORDPRESS CONTROL</span>
        <h1>Content &amp; site management<span className="wpcontrol-dot">.</span></h1>
        <p>Secure Next.js control panel for a real, separately hosted WordPress CMS.</p></div>
      {signedIn && <div className="wpcontrol-account"><span>Signed in as <strong>{accountName}</strong></span>
        <button type="button" className="wpc-btn wpc-outline" onClick={logout} disabled={busy}>Sign out</button></div>}
    </div>

    {!ready ? <div className="wpc-panel wpc-setup">
      <span className="wpc-state">Setup required</span><h2>Connect a real WordPress server</h2>
      <p>There is no WordPress installation or working administrator account inside this Next.js deployment. No default login credentials exist.</p>
      <p>Install WordPress on an HTTPS PHP/MySQL host, install the companion must-use plugins, then set WORDPRESS_CMS_URL and ADMIN_SESSION_SECRET in Vercel.</p>
      <a className="wpc-btn" href="https://github.com/omarreact/pincode-headless-wordpress/blob/main/docs/ADMIN_AND_WORDPRESS_SETUP.md" target="_blank" rel="noreferrer">Setup instructions ↗</a>
    </div> : !signedIn ? <div className="wpc-login-wrap"><form className="wpc-panel wpc-login" onSubmit={login}>
      <span className="wpc-state">Administrator access</span><h2>Sign in to WordPress</h2>
      <p>Use your WordPress administrator username and a WordPress Application Password (not your normal account password).</p>
      <label htmlFor="wpc-user">Username</label>
      <input id="wpc-user" autoComplete="username" required maxLength={120} value={username} onChange={(e) => setUsername(e.target.value)} />
      <label htmlFor="wpc-app-pass">Application Password</label>
      <input id="wpc-app-pass" type="password" autoComplete="off" required value={applicationPassword} onChange={(e) => setApplicationPassword(e.target.value)} />
      {error && <p className="wpc-error" role="alert">{error}</p>}
      <button type="submit" className="wpc-btn" disabled={busy}>{busy ? 'Verifying…' : 'Sign in securely →'}</button>
      <small>Sessions use encrypted HttpOnly cookies and expire after four hours.</small>
    </form></div> : <>
      <nav className="wpc-tabs" aria-label="Admin sections">
        {(['pages', 'themes', 'plugins', 'connection'] as Tab[]).map((name) =>
          <button key={name} type="button" className={tab === name ? 'selected' : ''}
            onClick={() => { setTab(name); setNotice(''); setError(''); setEditor(null); }}>{name === 'connection' ? 'CMS status' : name === 'pages' ? 'Pages' : name === 'themes' ? 'Themes' : 'Plugins'}</button>)}
        <button className="wpc-refresh" type="button" onClick={() => void reload()} disabled={loading || busy}>↻ Refresh</button>
      </nav>
      {error && <div className="wpc-error" role="alert">{error}</div>}
      {notice && <div className="wpc-notice" role="status">{notice}</div>}
      {loading && <p className="wpc-loading" role="status">Loading WordPress data…</p>}

      {tab === 'pages' && <div className="wpc-panel">
        <div className="wpc-section-head"><div><span className="wpcontrol-eyebrow">EDITORIAL</span><h2>{editor ? 'Page editor' : 'WordPress pages'}</h2></div>
          <div className="wpc-actions">{admin && <a className="wpc-btn wpc-outline" href={nativeLink('edit.php?post_type=page')} target="_blank" rel="noreferrer">Gutenberg ↗</a>}
            {!editor && <button type="button" className="wpc-btn" onClick={() => setEditor(emptyEditor)}>+ New page</button>}</div></div>
        {editor ? <form className="wpc-editor" onSubmit={savePage}>
          <label>Page title<input required maxLength={250} value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} /></label>
          <label>Status<select value={editor.status} onChange={(e) => setEditor({ ...editor, status: e.target.value })}>
            <option value="draft">Draft</option><option value="publish">Published</option><option value="pending">Pending</option><option value="private">Private</option></select></label>
          <label>HTML / Gutenberg block source<textarea rows={14} value={editor.content} onChange={(e) => setEditor({ ...editor, content: e.target.value })} /></label>
          <p className="wpc-hint">The native WordPress Gutenberg editor is recommended for full visual editing. This editor saves HTML/block markup.</p>
          <div className="wpc-actions"><button type="button" className="wpc-btn wpc-outline" onClick={() => setEditor(null)}>Cancel</button>
            <button type="submit" className="wpc-btn" disabled={busy}>{busy ? 'Saving…' : 'Save to WordPress'}</button></div>
        </form> : <div className="wpc-list">
          {!pages.length && <p className="wpc-hint">No pages returned. Check WordPress permissions or create the first page.</p>}
          {pages.map((page) => <div className="wpc-list-item" key={page.id}>
            <div><strong>{page.title?.raw || page.title?.rendered || '(Untitled)'}</strong><p>/{page.slug} · {page.status} · {page.modified?.slice(0, 10)}</p></div>
            <div className="wpc-actions"><button type="button" className="wpc-btn wpc-outline" onClick={() => setEditor({
              id: page.id, title: page.title?.raw || page.title?.rendered || '', content: page.content?.raw || '', status: page.status,
            })}>Edit</button>{admin && <a className="wpc-btn wpc-outline" href={nativeLink('post.php?post=' + page.id + '&action=edit')} target="_blank" rel="noreferrer">Blocks ↗</a>}</div>
          </div>)}</div>}
      </div>}

      {tab === 'themes' && <div className="wpc-panel">
        <div className="wpc-section-head"><div><span className="wpcontrol-eyebrow">PHP THEMES</span><h2>Installed themes</h2></div>
          {admin && <a className="wpc-btn" href={nativeLink('theme-install.php?upload')} target="_blank" rel="noreferrer">Upload theme ZIP ↗</a>}</div>
        <p className="wpc-hint">WordPress themes execute on the CMS server, not in Next.js. ZIP installation and visual previews open in real WordPress admin. Remote activation is intentionally staging-only.</p>
        <div className="wpc-list">{themes.map((theme) => <div className="wpc-list-item" key={theme.stylesheet}>
          <div><strong>{theme.name}</strong>{theme.active && <span className="wpc-active">Active</span>}<p>{theme.stylesheet} · v{theme.version}</p></div>
          <button type="button" className="wpc-btn wpc-outline" disabled={busy || theme.active || !status?.canManageStaging} onClick={() => void changeTheme(theme)}>{theme.active ? 'Selected' : 'Activate on staging'}</button>
        </div>)}</div>
      </div>}

      {tab === 'plugins' && <div className="wpc-panel">
        <div className="wpc-section-head"><div><span className="wpcontrol-eyebrow">PHP EXTENSIONS</span><h2>Installed plugins</h2></div>
          {admin && <a className="wpc-btn" href={nativeLink('plugin-install.php?tab=upload')} target="_blank" rel="noreferrer">Upload plugin ZIP ↗</a>}</div>
        <p className="wpc-hint">Install real plugin ZIP packages in WordPress admin. Use a separate staging host to evaluate extension compatibility and PHP errors.</p>
        <div className="wpc-list">{plugins.map((plugin) => <div className="wpc-list-item" key={plugin.file}>
          <div><strong>{plugin.name}</strong>{plugin.active && <span className="wpc-active">Active</span>}<p>{plugin.file} · v{plugin.version}</p></div>
          <button type="button" className="wpc-btn wpc-outline" disabled={busy || !status?.canManageStaging} onClick={() => void togglePlugin(plugin)}>{plugin.active ? 'Deactivate on staging' : 'Activate on staging'}</button>
        </div>)}</div>
      </div>}

      {tab === 'connection' && <div className="wpc-panel">
        <div className="wpc-section-head"><div><span className="wpcontrol-eyebrow">INFRASTRUCTURE</span><h2>WordPress connection</h2></div>
          {admin && <a className="wpc-btn" href={admin} target="_blank" rel="noreferrer">Open WordPress Admin ↗</a>}</div>
        {status ? <dl className="wpc-status"><dt>Site</dt><dd>{status.site}</dd><dt>WordPress version</dt><dd>{status.wordpress}</dd>
          <dt>Origin</dt><dd>{status.origin}</dd><dt>Environment</dt><dd>{status.environment}</dd>
          <dt>Remote staging management</dt><dd>{status.canManageStaging ? 'Enabled' : 'Disabled (safe default)'}</dd></dl> :
          <p className="wpc-hint">The companion API did not respond. Install pincode-control-api.php into the WordPress must-use plugins directory.</p>}
      </div>}
    </>}
  </div>;
}
