// Tiện ích giao diện dùng chung
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const ctx = { idx: null };

let toastTimer;
export function toast(msg, ms = 3200) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

export function openModal(html, onMount) {
  const m = $('#modal');
  $('#modalBody').innerHTML = html;
  if (!m.open) m.showModal();
  m.onclick = (e) => { if (e.target === m) closeModal(); };
  $$('[data-close]', m).forEach(b => b.onclick = () => closeModal());
  onMount?.(m);
}
export function closeModal() { const m = $('#modal'); if (m.open) m.close(); }

export function confirmBox(msg, okText = 'Đồng ý', danger = false) {
  return new Promise(res => {
    openModal(`<div class="modal-card small"><p class="confirm-msg">${msg}</p>
      <div class="actions"><button class="btn ghost" data-close>Huỷ</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" id="okBtn">${esc(okText)}</button></div></div>`, m => {
      $('#okBtn', m).onclick = () => { closeModal(); res(true); };
      m.addEventListener('close', () => res(false), { once: true });
    });
  });
}

export function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const initial = (name) => { const w = (name || '?').trim().split(/\s+/); return (w[w.length - 1][0] || '?').toUpperCase(); };
export function avatar(p, size = 40) {
  const cls = `avatar ${p?.gender === 'f' ? 'f' : 'm'}${p?.alive === false ? ' dead' : ''}`;
  if (p?.photo) return `<img class="${cls}" src="${esc(p.photo)}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px">`;
  return `<span class="${cls}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px">${esc(initial(p?.name))}</span>`;
}

/** Thu nhỏ & cắt vuông ảnh -> dataURL JPEG */
export function resizeImage(file, size = 320) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const c = document.createElement('canvas'); c.width = c.height = size;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

export const icon = {
  phone: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  tree: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  incense: '<svg viewBox="0 0 24 24"><path d="M9 21h6M12 21v-9M8 12h8M9 12V8M15 12V8M12 12V5"/><path d="M12 3c.8.8.8 1.6 0 2M9 6c.6.6.6 1.2 0 1.6M15 6c.6.6.6 1.2 0 1.6"/></svg>',
  share: '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/></svg>'
};
