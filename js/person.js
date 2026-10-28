// Bảng chi tiết thành viên + biểu mẫu thêm/sửa
import { store, uid } from './store.js';
import { $, $$, esc, ctx, toast, openModal, closeModal, confirmBox, avatar, resizeImage, icon } from './ui.js';
import { lifespan, ageText, fmtDate, lunarText, parseDate, yearOf, fmtSolar } from './family.js';
import { nextGio, solarToLunar } from './lunar.js';

// ---------- Điều hướng ----------
export function personLink(id) {
  const [page] = (location.hash.slice(1) || '/').split('?');
  return `#${page}?p=${encodeURIComponent(id)}`;
}
export function openPerson(id) { location.hash = personLink(id); }
export function closePerson() {
  const [page] = (location.hash.slice(1) || '/').split('?');
  history.replaceState(null, '', '#' + page);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

const chip = (id) => {
  const p = store.persons.get(id); if (!p) return '';
  return `<a class="chip" href="${personLink(id)}">${avatar(p, 26)}<span><b>${esc(p.name)}</b><small>${esc(lifespan(p))}</small></span></a>`;
};
const row = (label, val) => val ? `<div class="kv"><span>${label}</span><span>${val}</span></div>` : '';
const COORD = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

function mapBlock(p) {
  const m = (p.graveMap || '').match(COORD);
  if (m) {
    const q = `${m[1]},${m[2]}`;
    return `<iframe class="map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${q}&z=17&output=embed"></iframe>
      <a class="btn small" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${q}">${icon.map} Chỉ đường đến mộ</a>`;
  }
  if (/^https?:\/\//.test(p.graveMap || '')) return `<a class="btn small" target="_blank" rel="noopener" href="${esc(p.graveMap)}">${icon.map} Mở bản đồ</a>`;
  if (p.gravePlace) return `<a class="btn small" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.gravePlace)}">${icon.map} Tìm trên bản đồ</a>`;
  return '';
}

function contactBlock(id) {
  if (!store.canSeeContacts) {
    return `<p class="muted note">${store.mode === 'firebase' && !store.user
      ? 'Đăng nhập để xem số điện thoại, mạng xã hội (chỉ dành cho thành viên dòng họ).'
      : 'Thông tin liên hệ chỉ hiển thị với thành viên đã được quản trị cấp quyền.'}</p>`;
  }
  const c = store.contacts.get(id) || {};
  const items = [];
  if (c.phone) items.push(`<a class="contact" href="tel:${esc(c.phone.replace(/\s/g, ''))}">${icon.phone}<span><small>Điện thoại</small>${esc(c.phone)}</span></a>`);
  if (c.zalo) items.push(`<a class="contact" target="_blank" rel="noopener" href="https://zalo.me/${esc(c.zalo.replace(/\D/g, ''))}"><b class="zl">Z</b><span><small>Zalo</small>${esc(c.zalo)}</span></a>`);
  if (c.facebook) items.push(`<a class="contact" target="_blank" rel="noopener" href="${esc(c.facebook)}"><b class="fb">f</b><span><small>Facebook</small>${esc(c.facebook.replace(/^https?:\/\/(www\.)?/, ''))}</span></a>`);
  if (c.email) items.push(`<a class="contact" href="mailto:${esc(c.email)}">${icon.mail}<span><small>Email</small>${esc(c.email)}</span></a>`);
  if (c.website) items.push(`<a class="contact" target="_blank" rel="noopener" href="${esc(c.website)}">${icon.link}<span><small>Trang khác</small>${esc(c.website.replace(/^https?:\/\/(www\.)?/, ''))}</span></a>`);
  if (c.address) items.push(`<div class="contact">${icon.home}<span><small>Địa chỉ</small>${esc(c.address)}</span></div>`);
  return items.length ? `<div class="contacts">${items.join('')}</div>` : '<p class="muted note">Chưa có thông tin liên hệ.</p>';
}

export function renderPersonDetail(id) {
  const p = store.persons.get(id);
  const body = $('#drawerBody');
  if (!p) { body.innerHTML = `<div class="pd-empty"><button class="icon-btn close" data-x>${icon.close}</button><p>Không tìm thấy người này.</p></div>`; bindClose(); return; }
  const idx = ctx.idx;
  const dead = p.alive === false;
  const gen = idx.gen.get(id);
  const inlaw = idx.isInLaw(id);
  const father = store.persons.get(p.fatherId), mother = store.persons.get(p.motherId);
  const spouses = idx.spousesOf(id), kids = idx.childrenOf(id), sibs = idx.siblingsOf(id);
  const spouseLabel = p.gender === 'f' ? 'Chồng' : 'Vợ';

  let gio = '';
  if (dead && p.deathLunar?.d && p.deathLunar?.m) {
    const n = nextGio(p.deathLunar.d, p.deathLunar.m);
    if (n) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const days = Math.round((n.date - today) / 86400000);
      const dy = p.deathLunar.y || yearOf(p.death);
      gio = `<div class="gio-box">
        <div class="gio-ic">${icon.incense}</div>
        <div><small>Ngày giỗ (âm lịch)</small><b>${esc(lunarText({ d: p.deathLunar.d, m: p.deathLunar.m }))}</b>
        <div class="muted">Giỗ ${dy ? `lần thứ ${n.lunarYear - dy} ` : ''}vào ${fmtSolar(n.date)} – ${days === 0 ? '<b class="hot">hôm nay</b>' : `còn ${days} ngày`}</div></div></div>`;
    }
  }

  body.innerHTML = `
  <div class="pd-head ${p.gender === 'f' ? 'f' : 'm'}">
    <button class="icon-btn close" data-x aria-label="Đóng">${icon.close}</button>
    ${avatar(p, 88)}
    <h2>${esc(p.name)}</h2>
    ${p.otherName ? `<div class="muted">${esc(p.otherName)}</div>` : ''}
    <div class="badges">
      <span class="badge ${dead ? 'dead' : 'alive'}">${dead ? 'Đã mất' : 'Còn sống'}</span>
      ${gen ? `<span class="badge">Đời thứ ${gen}</span>` : ''}
      ${inlaw && spouses.length ? `<span class="badge soft">${p.gender === 'f' ? 'Con dâu' : 'Con rể'}</span>` : ''}
      ${p.branch ? `<span class="badge soft">${esc(p.branch)}</span>` : ''}
    </div>
    <div class="pd-years">${esc(lifespan(p))}${ageText(p) ? ` · ${esc(ageText(p))}` : ''}</div>
  </div>
  <div class="pd-actions">
    <a class="btn small" href="#/tree?p=${encodeURIComponent(id)}" data-focus>${icon.tree} Xem trên cây</a>
    <button class="btn small" data-share>${icon.share} Chia sẻ</button>
    ${store.canEdit ? `<button class="btn small primary" data-edit>${icon.edit} Sửa</button>` : ''}
  </div>
  <div class="pd-body">
    <section><h3>Thông tin</h3>
      ${row('Ngày sinh', esc(fmtDate(p.birth)))}
      ${row('Nơi sinh', esc(p.birthPlace))}
      ${row('Nghề nghiệp', esc(p.occupation))}
      ${row('Con thứ', p.order ? esc(p.order) : '')}
      ${dead ? row('Ngày mất', esc(fmtDate(p.death))) : ''}
      ${!p.birth && !p.birthPlace && !p.occupation && !(dead && p.death) ? '<p class="muted note">Chưa có thông tin.</p>' : ''}
    </section>
    ${dead ? `
      ${gio ? `<section><h3>Ngày giỗ</h3>${gio}</section>` : ''}
      <section><h3>Phần mộ</h3>
        ${p.gravePlace ? `<p class="grave">${icon.map}<span>${esc(p.gravePlace)}</span></p>` : '<p class="muted note">Chưa có thông tin phần mộ.</p>'}
        ${mapBlock(p)}
      </section>` : `
      <section><h3>Liên hệ</h3>${contactBlock(id)}</section>`}
    ${p.bio ? `<section><h3>Tiểu sử</h3><div class="bio">${esc(p.bio).split(/\n+/).map(s => `<p>${s}</p>`).join('')}</div></section>` : ''}
    <section><h3>Gia đình</h3>
      ${father || mother ? `<div class="rel"><span>Cha mẹ</span><div>${chip(p.fatherId)}${chip(p.motherId)}</div></div>` : ''}
      ${spouses.length ? `<div class="rel"><span>${spouseLabel}</span><div>${spouses.map(chip).join('')}</div></div>` : ''}
      ${sibs.length ? `<div class="rel"><span>Anh chị em</span><div>${sibs.map(chip).join('')}</div></div>` : ''}
      ${kids.length ? `<div class="rel"><span>Con (${kids.length})</span><div>${kids.map(chip).join('')}</div></div>` : ''}
      ${!father && !mother && !spouses.length && !kids.length ? '<p class="muted note">Chưa có quan hệ nào.</p>' : ''}
    </section>
    ${store.canEdit ? `<section class="tools"><h3>Cập nhật gia phả</h3>
      <div class="tool-grid">
        <button class="btn small" data-add="child">${icon.plus} Thêm con</button>
        <button class="btn small" data-add="spouse">${icon.plus} Thêm ${spouseLabel.toLowerCase()}</button>
        ${!father ? `<button class="btn small" data-add="father">${icon.plus} Thêm cha</button>` : ''}
        ${!mother ? `<button class="btn small" data-add="mother">${icon.plus} Thêm mẹ</button>` : ''}
        <button class="btn small danger-ghost" data-del>${icon.trash} Xoá</button>
      </div></section>` : ''}
    ${p.updatedAt ? `<p class="muted tiny">Cập nhật ${new Date(p.updatedAt).toLocaleString('vi-VN')}${p.updatedBy ? ` bởi ${esc(p.updatedBy)}` : ''}</p>` : ''}
  </div>`;

  bindClose();
  $('[data-share]', body).onclick = async () => {
    const url = location.href.split('#')[0] + '#/tree?p=' + encodeURIComponent(id);
    try {
      if (navigator.share) await navigator.share({ title: p.name, url });
      else { await navigator.clipboard.writeText(url); toast('Đã sao chép liên kết'); }
    } catch { /* người dùng huỷ */ }
  };
  $('[data-edit]', body)?.addEventListener('click', () => openPersonForm(id));
  $$('[data-add]', body).forEach(b => b.onclick = () => addRelative(id, b.dataset.add));
  $('[data-del]', body)?.addEventListener('click', async () => {
    const n = kids.length;
    if (await confirmBox(`Xoá <b>${esc(p.name)}</b> khỏi gia phả?${n ? `<br><small>${n} người con sẽ không còn liên kết với người này.</small>` : ''}`, 'Xoá', true)) {
      await store.deletePerson(id); closePerson(); toast('Đã xoá');
    }
  });
}

function bindClose() { $$('[data-x]', $('#drawerBody')).forEach(b => b.onclick = closePerson); }

function addRelative(id, kind) {
  const p = store.persons.get(id);
  const sp = ctx.idx.spousesOf(id);
  if (kind === 'child') {
    const preset = p.gender === 'f' ? { motherId: id, fatherId: sp[0] || '' } : { fatherId: id, motherId: sp[0] || '' };
    preset.order = ctx.idx.childrenOf(id).length + 1;
    preset.branch = p.branch || '';
    openPersonForm(null, preset, 'Thêm con của ' + p.name);
  } else if (kind === 'spouse') {
    openPersonForm(null, { spouses: [id], gender: p.gender === 'f' ? 'm' : 'f' }, `Thêm ${p.gender === 'f' ? 'chồng' : 'vợ'} của ${p.name}`);
  } else {
    const isF = kind === 'father';
    const other = isF ? p.motherId : p.fatherId;
    openPersonForm(null, { gender: isF ? 'm' : 'f', spouses: other ? [other] : [], alive: false },
      `Thêm ${isF ? 'cha' : 'mẹ'} của ${p.name}`, { childId: id, as: isF ? 'fatherId' : 'motherId' });
  }
}

// ---------- Biểu mẫu ----------
function personOptions(selected, filter, exclude) {
  const idx = ctx.idx;
  const list = [...store.persons.values()].filter(p => p.id !== exclude && (!filter || filter(p)))
    .sort((a, b) => (idx.gen.get(a.id) || 99) - (idx.gen.get(b.id) || 99) || a.name.localeCompare(b.name, 'vi'));
  return `<option value="">— Không chọn —</option>` + list.map(p =>
    `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)}${idx.gen.get(p.id) ? ` · Đời ${idx.gen.get(p.id)}` : ''}${yearOf(p.birth) ? ` · ${yearOf(p.birth)}` : ''}</option>`).join('');
}

export function openPersonForm(id, preset = {}, title, link) {
  const old = id ? store.persons.get(id) : null;
  const p = { gender: 'm', alive: true, spouses: [], ...(old || {}), ...preset };
  const c = (id && store.contacts.get(id)) || {};
  const dl = p.deathLunar || {};
  let photo = p.photo || '';
  let spouses = [...(p.spouses || [])];
  const showContacts = store.canSeeContacts;

  openModal(`
  <form class="modal-card wide" id="pf" autocomplete="off">
    <header><h2>${esc(title || (old ? 'Sửa thông tin' : 'Thêm thành viên'))}</h2><button type="button" class="icon-btn" data-close>${icon.close}</button></header>
    <div class="form-body">
      <fieldset><legend>Cơ bản</legend>
        <div class="photo-pick">
          <div id="phPrev">${avatar({ ...p, photo }, 76)}</div>
          <div><label class="btn small">Chọn ảnh<input type="file" accept="image/*" id="phFile" hidden></label>
          <button type="button" class="btn small ghost" id="phDel">Bỏ ảnh</button><p class="muted tiny">Ảnh được thu nhỏ tự động.</p></div>
        </div>
        <div class="grid2">
          <label class="span2">Họ và tên *<input name="name" required value="${esc(p.name)}" placeholder="VD: Nguyễn Văn An"></label>
          <label class="span2">Tên khác (tên húy, tên tự, tên thường gọi)<input name="otherName" value="${esc(p.otherName)}"></label>
          <div class="field"><span>Giới tính</span><div class="seg">
            <label><input type="radio" name="gender" value="m" ${p.gender !== 'f' ? 'checked' : ''}> Nam</label>
            <label><input type="radio" name="gender" value="f" ${p.gender === 'f' ? 'checked' : ''}> Nữ</label></div></div>
          <label>Con thứ<input name="order" type="number" min="1" value="${esc(p.order || '')}"></label>
          <label class="span2">Chi / nhánh<input name="branch" value="${esc(p.branch)}" placeholder="VD: Chi trưởng" list="branches"></label>
        </div>
        <datalist id="branches">${[...new Set([...store.persons.values()].map(x => x.branch).filter(Boolean))].map(b => `<option value="${esc(b)}">`).join('')}</datalist>
      </fieldset>

      <fieldset><legend>Quan hệ</legend>
        <div class="grid2">
          <label>Cha<select name="fatherId">${personOptions(p.fatherId, x => x.gender !== 'f', id)}</select></label>
          <label>Mẹ<select name="motherId">${personOptions(p.motherId, x => x.gender === 'f', id)}</select></label>
          <div class="span2 field"><span>Vợ / Chồng</span><div id="spChips" class="sp-chips"></div>
            <select id="spAdd">${personOptions('', null, id).replace('— Không chọn —', '+ Liên kết với người có sẵn…')}</select></div>
        </div>
      </fieldset>

      <fieldset><legend>Sinh</legend>
        <div class="grid2">
          <label>Ngày sinh<input name="birth" value="${esc(p.birth)}" placeholder="dd/mm/yyyy hoặc năm"></label>
          <label>Nơi sinh / quê quán<input name="birthPlace" value="${esc(p.birthPlace)}"></label>
          <label class="span2">Nghề nghiệp / chức vụ<input name="occupation" value="${esc(p.occupation)}"></label>
        </div>
      </fieldset>

      <fieldset><legend>Tình trạng</legend>
        <div class="seg big">
          <label><input type="radio" name="alive" value="1" ${p.alive !== false ? 'checked' : ''}> Còn sống</label>
          <label><input type="radio" name="alive" value="0" ${p.alive === false ? 'checked' : ''}> Đã mất</label>
        </div>
        <div data-show="alive">
          ${showContacts ? `<p class="muted tiny">Thông tin liên hệ chỉ hiển thị cho thành viên đã đăng nhập và được cấp quyền.</p>
          <div class="grid2">
            <label>Số điện thoại<input name="c_phone" type="tel" value="${esc(c.phone)}"></label>
            <label>Zalo (số)<input name="c_zalo" value="${esc(c.zalo)}"></label>
            <label>Facebook (link)<input name="c_facebook" type="url" value="${esc(c.facebook)}" placeholder="https://facebook.com/..."></label>
            <label>Email<input name="c_email" type="email" value="${esc(c.email)}"></label>
            <label>Trang mạng khác<input name="c_website" type="url" value="${esc(c.website)}" placeholder="TikTok, YouTube, website…"></label>
            <label>Địa chỉ hiện tại<input name="c_address" value="${esc(c.address)}"></label>
          </div>` : ''}
        </div>
        <div data-show="dead">
          <div class="grid2">
            <label class="span2">Ngày mất (dương lịch)<input name="death" value="${esc(p.death)}" placeholder="dd/mm/yyyy hoặc năm"></label>
          </div>
          <div class="field"><span>Ngày giỗ – âm lịch <small class="muted">(tự tính khi nhập đủ ngày mất dương lịch)</small></span>
            <div class="lunar-in">
              <label>Ngày<input name="ld" type="number" min="1" max="30" value="${esc(dl.d || '')}"></label>
              <label>Tháng<input name="lm" type="number" min="1" max="12" value="${esc(dl.m || '')}"></label>
              <label>Năm ÂL<input name="ly" type="number" value="${esc(dl.y || '')}"></label>
              <label class="chk"><input type="checkbox" name="lleap" ${dl.leap ? 'checked' : ''}> Nhuận</label>
            </div></div>
          <div class="grid2">
            <label class="span2">Nơi an táng (phần mộ)<input name="gravePlace" value="${esc(p.gravePlace)}" placeholder="VD: Nghĩa trang thôn…, khu A, hàng 3"></label>
            <label class="span2">Vị trí trên bản đồ <small class="muted">(toạ độ "vĩ độ, kinh độ" hoặc link Google Maps)</small>
              <div class="inline"><input name="graveMap" value="${esc(p.graveMap)}" placeholder="21.0285, 105.8542"><button type="button" class="btn small" id="geoBtn">${icon.map} Vị trí hiện tại</button></div></label>
          </div>
        </div>
      </fieldset>

      <fieldset><legend>Tiểu sử</legend>
        <textarea name="bio" rows="5" placeholder="Cuộc đời, công trạng, kỷ niệm…">${esc(p.bio)}</textarea>
      </fieldset>
    </div>
    <footer><button type="button" class="btn ghost" data-close>Huỷ</button><button class="btn primary" type="submit">Lưu</button></footer>
  </form>`, (m) => {
    const f = $('#pf', m);
    const syncAlive = () => {
      const alive = f.alive.value === '1';
      $('[data-show="alive"]', f).hidden = !alive;
      $('[data-show="dead"]', f).hidden = alive;
    };
    $$('input[name="alive"]', f).forEach(r => r.onchange = syncAlive); syncAlive();

    const drawSp = () => {
      $('#spChips', f).innerHTML = spouses.map(s => {
        const sp = store.persons.get(s); if (!sp) return '';
        return `<span class="tag">${esc(sp.name)}<button type="button" data-rm="${s}" aria-label="Bỏ">×</button></span>`;
      }).join('') || '<span class="muted tiny">Chưa có</span>';
      $$('[data-rm]', f).forEach(b => b.onclick = () => { spouses = spouses.filter(x => x !== b.dataset.rm); drawSp(); });
    };
    drawSp();
    $('#spAdd', f).onchange = (e) => { const v = e.target.value; if (v && !spouses.includes(v)) spouses.push(v); e.target.value = ''; drawSp(); };

    $('#phFile', f).onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try { photo = await resizeImage(file); $('#phPrev', f).innerHTML = avatar({ ...p, photo }, 76); }
      catch { toast('Không đọc được ảnh'); }
    };
    $('#phDel', f).onclick = () => { photo = ''; $('#phPrev', f).innerHTML = avatar({ ...p, photo: '' }, 76); };

    f.death.addEventListener('change', () => {
      const d = parseDate(f.death.value);
      if (d?.d && d?.m) {
        const l = solarToLunar(d.d, d.m, d.y);
        f.ld.value = l.d; f.lm.value = l.m; f.ly.value = l.y; f.lleap.checked = !!l.leap;
        toast(`Âm lịch: ${lunarText(l)}`);
      } else if (d?.y && !f.ly.value) f.ly.value = d.y;
    });
    $('#geoBtn', f).onclick = () => {
      if (!navigator.geolocation) return toast('Thiết bị không hỗ trợ định vị');
      toast('Đang lấy vị trí…');
      navigator.geolocation.getCurrentPosition(
        pos => { f.graveMap.value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`; toast('Đã lấy vị trí hiện tại'); },
        () => toast('Không lấy được vị trí (hãy cho phép truy cập vị trí)'), { enableHighAccuracy: true, timeout: 15000 });
    };

    f.onsubmit = async (e) => {
      e.preventDefault();
      const v = (n) => (f[n]?.value || '').trim();
      const alive = v('alive') === '1';
      const data = {
        id: id || uid(),
        name: v('name'), otherName: v('otherName'), gender: v('gender') || 'm',
        order: v('order') ? +v('order') : null, branch: v('branch'),
        fatherId: v('fatherId'), motherId: v('motherId'), spouses,
        birth: v('birth'), birthPlace: v('birthPlace'), occupation: v('occupation'),
        alive, bio: v('bio'), photo
      };
      if (!alive) {
        data.death = v('death');
        data.deathLunar = v('ld') && v('lm') ? { d: +v('ld'), m: +v('lm'), y: v('ly') ? +v('ly') : null, leap: f.lleap.checked ? 1 : 0 } : null;
        data.gravePlace = v('gravePlace'); data.graveMap = v('graveMap');
      } else {
        data.death = ''; data.deathLunar = null; data.gravePlace = ''; data.graveMap = '';
      }
      if (data.fatherId === data.id || data.motherId === data.id) return toast('Không thể chọn chính mình làm cha/mẹ');
      let contact;
      if (showContacts) {
        contact = alive ? { phone: v('c_phone'), zalo: v('c_zalo'), facebook: v('c_facebook'), email: v('c_email'), website: v('c_website'), address: v('c_address') } : null;
      }
      const btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'Đang lưu…';
      try {
        const newId = await store.savePerson(data, contact);
        if (link) {
          const child = store.persons.get(link.childId);
          await store.savePerson({ ...child, [link.as]: newId });
        }
        closeModal(); toast('Đã lưu');
        if (!id) setTimeout(() => (location.hash = personLink(newId)), 50);
        else window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch { btn.disabled = false; btn.textContent = 'Lưu'; }
    };
  });
}
