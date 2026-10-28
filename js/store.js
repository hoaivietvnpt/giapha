// Lớp dữ liệu: Firebase (Firestore + Google Auth) hoặc chế độ dùng thử (localStorage)
import { firebaseConfig } from './firebase-config.js';
import { SAMPLE } from './sample-data.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const LS_KEY = 'giapha-demo-v1';

export const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || k === 'id') continue;
    out[k] = v;
  }
  return out;
}

class Store {
  constructor() {
    this.mode = firebaseConfig.apiKey ? 'firebase' : 'demo';
    this.persons = new Map();
    this.contacts = new Map();
    this.news = new Map();
    this.notices = [];
    this.clan = {};
    this.access = { owners: [], editors: [], members: [] };
    this.user = null;
    this.role = 'guest';
    this.ready = false;
    this._listeners = new Set();
    this._unsubContacts = null;
  }

  on(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  emit(what) { for (const fn of this._listeners) fn(what); }

  get canEdit() { return this.role === 'editor' || this.role === 'owner'; }
  get canSeeContacts() { return this.canEdit || this.role === 'member'; }
  get isOwner() { return this.role === 'owner'; }

  async init() {
    if (this.mode === 'demo') return this._initDemo();
    return this._initFirebase();
  }

  // ---------------- DEMO ----------------
  _initDemo() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { /* bỏ qua */ }
    if (!data) data = structuredClone(SAMPLE);
    this._loadAll(data);
    this.user = { email: 'demo@local', name: 'Người dùng thử' };
    this.role = 'owner';
    this.ready = true;
    this.emit('all');
  }
  _saveDemo() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(this.exportAll())); } catch { /* bộ nhớ đầy hoặc bị chặn */ }
  }
  _loadAll(data) {
    this.persons = new Map((data.persons || []).map(p => [p.id, p]));
    this.contacts = new Map(Object.entries(data.contacts || {}));
    this.clan = data.clan || this.clan || {};
    if (data.news) this.news = new Map(data.news.map(n => [n.id, n]));
  }

  // ---------------- FIREBASE ----------------
  async _initFirebase() {
    const [{ initializeApp }, auth, fs] = await Promise.all([
      import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')
    ]);
    this.fb = { auth, fs };
    const app = initializeApp(firebaseConfig);
    this.app = app;
    this.auth = auth.getAuth(app);
    this.db = fs.getFirestore(app);

    let gotPersons = false, gotClan = false;
    const maybeReady = () => { if (gotPersons && gotClan && !this.ready) { this.ready = true; this.emit('all'); } };

    fs.onSnapshot(fs.collection(this.db, 'persons'), snap => {
      this.persons = new Map(snap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
      gotPersons = true; maybeReady(); if (this.ready) this.emit('persons');
    }, err => this._err(err));
    fs.onSnapshot(fs.collection(this.db, 'news'), snap => {
      this.news = new Map(snap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
      if (this.ready) this.emit('news');
    }, err => console.warn('news', err));
    fs.onSnapshot(fs.query(fs.collection(this.db, 'notices'), fs.orderBy('createdAt', 'desc'), fs.limit(10)), snap => {
      this.notices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (this.ready) this.emit('notices');
    }, err => console.warn('notices', err));
    fs.onSnapshot(fs.doc(this.db, 'meta', 'clan'), snap => {
      this.clan = snap.exists() ? snap.data() : {};
      gotClan = true; maybeReady(); if (this.ready) this.emit('clan');
    }, err => { gotClan = true; maybeReady(); this._err(err); });

    auth.onAuthStateChanged(this.auth, async u => {
      this.user = u ? { email: u.email, name: u.displayName, photo: u.photoURL } : null;
      await this._loadRole();
      this.emit('auth');
    });
  }

  async _loadRole() {
    const { fs } = this.fb;
    if (this._unsubContacts) { this._unsubContacts(); this._unsubContacts = null; }
    this.contacts = new Map();
    if (!this.user) { this.role = 'guest'; return; }
    const ref = fs.doc(this.db, 'meta', 'access');
    try {
      let snap = await fs.getDoc(ref);
      if (!snap.exists()) {
        // Người đầu tiên đăng nhập trở thành quản trị viên
        const init = { owners: [this.user.email.toLowerCase()], editors: [], members: [] };
        await fs.setDoc(ref, init);
        snap = await fs.getDoc(ref);
        this.toast?.('Bạn là người đầu tiên đăng nhập nên đã trở thành Quản trị viên.');
      }
      this.access = { owners: [], editors: [], members: [], ...snap.data() };
    } catch (e) { this._err(e); }
    const em = (this.user.email || '').toLowerCase();
    const has = (list) => (list || []).map(s => s.toLowerCase()).includes(em);
    this.role = has(this.access.owners) ? 'owner' : has(this.access.editors) ? 'editor'
      : has(this.access.members) ? 'member' : 'viewer';
    if (this.canSeeContacts) {
      this._unsubContacts = fs.onSnapshot(fs.collection(this.db, 'contacts'), snap => {
        this.contacts = new Map(snap.docs.map(d => [d.id, d.data()]));
        this.emit('contacts');
      }, err => this._err(err));
    }
  }

  _err(e) {
    console.error(e);
    this.toast?.('Lỗi: ' + (e.code === 'permission-denied' ? 'không có quyền thực hiện' : e.message));
  }

  async signIn() {
    if (this.mode === 'demo') return;
    const { auth } = this.fb;
    try { await auth.signInWithPopup(this.auth, new auth.GoogleAuthProvider()); }
    catch (e) { if (e.code !== 'auth/popup-closed-by-user') this._err(e); }
  }
  async signOut() { if (this.mode === 'firebase') await this.fb.auth.signOut(this.auth); }

  // ---------------- GHI DỮ LIỆU ----------------
  /** Ghi nhiều người cùng lúc: [{id, data(partial)}], contacts: {id: data|null} */
  async _write(personUpdates, contactUpdates = {}, deletes = []) {
    const stamp = { updatedAt: Date.now(), updatedBy: this.user?.email || '' };
    if (this.mode === 'demo') {
      for (const { id, data } of personUpdates) {
        this.persons.set(id, { ...(this.persons.get(id) || {}), ...data, ...stamp, id });
      }
      for (const [id, c] of Object.entries(contactUpdates)) c ? this.contacts.set(id, c) : this.contacts.delete(id);
      for (const id of deletes) { this.persons.delete(id); this.contacts.delete(id); }
      this._saveDemo();
      this.emit('persons');
      return;
    }
    const { fs } = this.fb;
    const batch = fs.writeBatch(this.db);
    for (const { id, data } of personUpdates) {
      batch.set(fs.doc(this.db, 'persons', id), clean({ ...data, ...stamp }), { merge: true });
    }
    for (const [id, c] of Object.entries(contactUpdates)) {
      const ref = fs.doc(this.db, 'contacts', id);
      c ? batch.set(ref, clean(c)) : batch.delete(ref);
    }
    for (const id of deletes) { batch.delete(fs.doc(this.db, 'persons', id)); batch.delete(fs.doc(this.db, 'contacts', id)); }
    try { await batch.commit(); } catch (e) { this._err(e); throw e; }
  }

  /** Lưu một người, tự đồng bộ quan hệ vợ/chồng hai chiều */
  async savePerson(person, contact) {
    const id = person.id || uid();
    const old = this.persons.get(id);
    const newSp = [...new Set(person.spouses || [])].filter(s => s !== id);
    const oldSp = old?.spouses || [];
    const updates = [{ id, data: { ...person, spouses: newSp } }];
    for (const s of newSp) {
      const sp = this.persons.get(s); if (!sp) continue;
      if (!(sp.spouses || []).includes(id)) updates.push({ id: s, data: { spouses: [...(sp.spouses || []), id] } });
    }
    for (const s of oldSp) {
      if (newSp.includes(s)) continue;
      const sp = this.persons.get(s); if (!sp) continue;
      updates.push({ id: s, data: { spouses: (sp.spouses || []).filter(x => x !== id) } });
    }
    const contactUpd = contact !== undefined ? { [id]: contact && Object.values(contact).some(v => v) ? contact : null } : {};
    await this._write(updates, contactUpd);
    if (contact?.email) this.autoMember([contact.email]);
    return id;
  }

  async deletePerson(id) {
    const updates = [];
    for (const p of this.persons.values()) {
      if (p.id === id) continue;
      const data = {};
      if (p.fatherId === id) data.fatherId = '';
      if (p.motherId === id) data.motherId = '';
      if ((p.spouses || []).includes(id)) data.spouses = p.spouses.filter(s => s !== id);
      if (Object.keys(data).length) updates.push({ id: p.id, data });
    }
    await this._write(updates, {}, [id]);
  }

  /** Email có trong thông tin liên hệ được tự thêm vào nhóm Thành viên (xem được liên hệ) */
  async autoMember(emails) {
    if (this.mode !== 'firebase' || !this.canEdit) return 0;
    const a = this.access || {};
    const known = new Set([...(a.owners || []), ...(a.editors || []), ...(a.members || [])].map(e => e.toLowerCase()));
    const add = [...new Set((emails || []).map(e => (e || '').trim().toLowerCase())
      .filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !known.has(e)))];
    if (!add.length) return 0;
    const members = [...(a.members || []), ...add];
    const { fs } = this.fb;
    try {
      await fs.updateDoc(fs.doc(this.db, 'meta', 'access'), { members });
      this.access = { ...a, members };
      this.toast?.(`Đã thêm ${add.length} email vào nhóm Thành viên`);
    } catch (e) { console.warn('autoMember', e); }
    return add.length;
  }

  async saveClan(data) {
    this.clan = { ...this.clan, ...data };
    if (this.mode === 'demo') { this._saveDemo(); this.emit('clan'); return; }
    const { fs } = this.fb;
    try { await fs.setDoc(fs.doc(this.db, 'meta', 'clan'), clean(this.clan)); } catch (e) { this._err(e); throw e; }
  }

  async saveAccess(data) {
    if (this.mode === 'demo') { this.access = data; return; }
    const { fs } = this.fb;
    try { await fs.setDoc(fs.doc(this.db, 'meta', 'access'), data); this.access = data; }
    catch (e) { this._err(e); throw e; }
  }

  exportAll() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      clan: this.clan,
      persons: [...this.persons.values()],
      contacts: Object.fromEntries(this.contacts),
      news: [...this.news.values()]
    };
  }

  /** Nhập dữ liệu từ file JSON (ghi đè các người cùng id) */
  async importAll(data, { replace = false } = {}) {
    if (this.mode === 'demo') {
      if (replace) { this._loadAll(data); }
      else {
        for (const p of data.persons || []) this.persons.set(p.id, p);
        for (const [k, v] of Object.entries(data.contacts || {})) this.contacts.set(k, v);
        if (data.clan) this.clan = { ...this.clan, ...data.clan };
      }
      this._saveDemo(); this.emit('all'); return;
    }
    const { fs } = this.fb;
    const ops = [];
    if (replace) for (const id of this.persons.keys()) if (!(data.persons || []).some(p => p.id === id)) ops.push(['del', id]);
    for (const p of data.persons || []) ops.push(['p', p]);
    for (const [k, v] of Object.entries(data.contacts || {})) ops.push(['c', k, v]);
    // Firestore giới hạn 500 thao tác / batch
    for (let i = 0; i < ops.length; i += 400) {
      const batch = fs.writeBatch(this.db);
      for (const op of ops.slice(i, i + 400)) {
        if (op[0] === 'del') { batch.delete(fs.doc(this.db, 'persons', op[1])); batch.delete(fs.doc(this.db, 'contacts', op[1])); }
        else if (op[0] === 'p') batch.set(fs.doc(this.db, 'persons', op[1].id), clean(op[1]));
        else batch.set(fs.doc(this.db, 'contacts', op[1]), clean(op[2]));
      }
      await batch.commit();
    }
    if (data.clan) await this.saveClan(data.clan);
    await this.autoMember(Object.values(data.contacts || {}).map(c => c.email));
  }

  // ---------------- TIN TỨC ----------------
  async saveNews(item) {
    const id = item.id || uid().replace(/^p/, 'n');
    const old = this.news.get(id);
    const data = {
      ...item, id,
      createdAt: old?.createdAt || item.createdAt || Date.now(), updatedAt: Date.now(),
      author: old?.author || this.user?.name || this.user?.email || '', authorEmail: old?.authorEmail || this.user?.email || ''
    };
    if (JSON.stringify(data).length > 950000) throw new Error('Bài viết quá lớn (ảnh nhiều/quá to). Hãy bớt ảnh trong bài.');
    if (this.mode === 'demo') { this.news.set(id, data); this._saveDemo(); this.emit('news'); return id; }
    const { fs } = this.fb;
    try { await fs.setDoc(fs.doc(this.db, 'news', id), clean(data)); } catch (e) { this._err(e); throw e; }
    return id;
  }
  async deleteNews(id) {
    if (this.mode === 'demo') { this.news.delete(id); this._saveDemo(); this.emit('news'); return; }
    const { fs } = this.fb;
    try { await fs.deleteDoc(fs.doc(this.db, 'news', id)); } catch (e) { this._err(e); throw e; }
  }

  // ---------------- THÔNG BÁO (PUSH) ----------------
  /** Quản trị gửi thông báo: lưu vào hàng đợi, GitHub Action sẽ đẩy đến các máy đã bật thông báo */
  async sendNotice({ title, body, hash }) {
    const n = { title, body, hash: hash || '#/', createdAt: Date.now(), sent: false, by: this.user?.email || '' };
    if (this.mode === 'demo') {
      this.notices = [{ id: uid(), ...n, sent: true, sentCount: 0, demo: true }, ...this.notices].slice(0, 10);
      this.emit('notices'); return;
    }
    const { fs } = this.fb;
    try { await fs.addDoc(fs.collection(this.db, 'notices'), n); } catch (e) { this._err(e); throw e; }
  }
  async savePushToken(token, prefs) {
    if (this.mode !== 'firebase' || !token) return;
    const { fs } = this.fb;
    const ua = navigator.userAgent;
    const platform = /iphone|ipad|ipod/i.test(ua) ? 'ios' : /android/i.test(ua) ? 'android' : 'desktop';
    try {
      await fs.setDoc(fs.doc(this.db, 'pushTokens', token), clean({ token, platform, prefs, updatedAt: Date.now(), email: this.user?.email || '' }));
    } catch (e) { console.warn('pushToken', e); }
  }

  resetDemo() {
    try { localStorage.removeItem(LS_KEY); } catch { /* bỏ qua */ }
    this._loadAll(structuredClone(SAMPLE));
    this.emit('all');
  }
}

export const store = new Store();
