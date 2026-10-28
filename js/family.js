// Các hàm xử lý quan hệ gia đình, đời, ngày tháng
import { nextGio, canChiYear } from './lunar.js';

/** "1950" | "03/1950" | "12/03/1950" | "1950-03-12" -> {d, m, y} */
export function parseDate(s) {
  if (!s) return null;
  s = String(s).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return { d: +m[3], m: +m[2], y: +m[1] };
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{3,4})$/))) return { d: +m[1], m: +m[2], y: +m[3] };
  if ((m = s.match(/^(\d{1,2})[/.-](\d{3,4})$/))) return { d: 0, m: +m[1], y: +m[2] };
  if ((m = s.match(/(\d{3,4})/))) return { d: 0, m: 0, y: +m[1] };
  return null;
}
export const yearOf = (s) => parseDate(s)?.y || null;

export function fmtDate(s) {
  const p = parseDate(s); if (!p) return s || '';
  if (p.d && p.m) return `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.y}`;
  if (p.m) return `${String(p.m).padStart(2, '0')}/${p.y}`;
  return String(p.y);
}

export function lifespan(p) {
  const b = yearOf(p.birth), d = yearOf(p.death);
  if (p.alive === false) return `${b || '?'} – ${d || '?'}`;
  return b ? `s. ${b}` : '';
}

export function ageText(p) {
  const b = yearOf(p.birth);
  if (p.alive === false) {
    const d = yearOf(p.death);
    return b && d ? `Hưởng thọ ${d - b + 1} tuổi` : '';
  }
  return b ? `${new Date().getFullYear() - b} tuổi` : '';
}

export const lunarText = (l) => {
  if (!l || !l.d || !l.m) return '';
  const mName = l.m === 1 ? 'Giêng' : l.m === 12 ? 'Chạp' : l.m;
  return `Ngày ${l.d} tháng ${mName}${l.leap ? ' (nhuận)' : ''}${l.y ? ` năm ${canChiYear(l.y)}` : ''}`;
};

const byOrder = (P) => (a, b) => {
  const pa = P.get(a), pb = P.get(b);
  return (pa.order || 99) - (pb.order || 99) || (yearOf(pa.birth) || 9999) - (yearOf(pb.birth) || 9999) || pa.name.localeCompare(pb.name, 'vi');
};

/** Xây chỉ mục: con cái, đời, gốc cây, người thuộc huyết thống / dâu rể */
export function buildIndex(persons, clan = {}) {
  const P = persons;
  const kids = new Map();
  for (const p of P.values()) {
    for (const par of [p.fatherId, p.motherId]) {
      if (par && P.has(par)) { if (!kids.has(par)) kids.set(par, []); kids.get(par).push(p.id); }
    }
  }
  const sorter = byOrder(P);
  for (const list of kids.values()) list.sort(sorter);

  const hasParents = (p) => (p.fatherId && P.has(p.fatherId)) || (p.motherId && P.has(p.motherId));
  const spousesOf = (id) => (P.get(id)?.spouses || []).filter(s => P.has(s));
  const descCount = (id, seen = new Set()) => {
    if (seen.has(id)) return 0; seen.add(id);
    let n = 0; for (const k of kids.get(id) || []) n += 1 + descCount(k, seen); return n;
  };

  const candidates = [...P.values()].filter(p => !hasParents(p)).map(p => ({
    p,
    pri: p.id === clan.rootId ? 0 : spousesOf(p.id).some(s => hasParents(P.get(s))) ? 2 : 1,
    dc: descCount(p.id)
  }));
  candidates.sort((a, b) => a.pri - b.pri || (a.p.gender === 'm' ? 0 : 1) - (b.p.gender === 'm' ? 0 : 1) || b.dc - a.dc);

  const gen = new Map(), blood = new Set(), spouseOfNode = new Map(), roots = [], treeKids = new Map();
  for (const { p } of candidates) {
    if (gen.has(p.id)) continue;
    roots.push(p.id);
    const queue = [[p.id, 1]];
    gen.set(p.id, 1);
    while (queue.length) {
      const [id, g] = queue.shift();
      blood.add(id);
      const sp = [];
      for (const s of spousesOf(id)) {
        if (!gen.has(s)) { gen.set(s, g); spouseOfNode.set(s, id); sp.push(s); }
        else if (spouseOfNode.get(s) === id) sp.push(s);
      }
      const children = [];
      for (const k of [...(kids.get(id) || []), ...sp.flatMap(s => kids.get(s) || [])]) {
        if (gen.has(k)) continue;
        gen.set(k, g + 1); children.push(k); queue.push([k, g + 1]);
      }
      children.sort(sorter);
      treeKids.set(id, children);
    }
  }

  return {
    P, gen, roots, blood,
    childrenOf: (id) => kids.get(id) || [],
    treeChildren: (id) => treeKids.get(id) || [],
    unitSpouses: (id) => spousesOf(id).filter(s => spouseOfNode.get(s) === id),
    spousesOf,
    isInLaw: (id) => !blood.has(id),
    maxGen: Math.max(0, ...gen.values()),
    siblingsOf(id) {
      const p = P.get(id); if (!p) return [];
      const set = new Set();
      for (const par of [p.fatherId, p.motherId]) for (const k of kids.get(par) || []) if (k !== id) set.add(k);
      return [...set].sort(sorter);
    },
    descendants(id) {
      const out = new Set(); const st = [id];
      while (st.length) { const x = st.pop(); for (const k of treeKids.get(x) || []) if (!out.has(k)) { out.add(k); st.push(k); } }
      return out;
    }
  };
}

/** Danh sách ngày giỗ sắp tới, sắp xếp theo ngày */
export function upcomingGio(persons, from = new Date()) {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const out = [];
  for (const p of persons.values()) {
    if (p.alive !== false || !p.deathLunar?.d || !p.deathLunar?.m) continue;
    const n = nextGio(p.deathLunar.d, p.deathLunar.m, today);
    if (!n) continue;
    const days = Math.round((n.date - today) / 86400000);
    const dy = p.deathLunar.y || yearOf(p.death);
    out.push({ person: p, date: n.date, days, lunarYear: n.lunarYear, nth: dy ? n.lunarYear - dy : null });
  }
  return out.sort((a, b) => a.days - b.days);
}

export const WEEKDAY = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
export const fmtSolar = (d) => `${WEEKDAY[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

/** Chuẩn hoá tiếng Việt để tìm kiếm không dấu */
export const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
