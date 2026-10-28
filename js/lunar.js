// Âm lịch Việt Nam (thuật toán Hồ Ngọc Đức), múi giờ +7
const PI = Math.PI;
const TZ = 7;

function INT(d) { return Math.floor(d); }

export function jdFromDate(dd, mm, yy) {
  const a = INT((14 - mm) / 12), y = yy + 4800 - a, m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return jd;
}

export function jdToDate(jd) {
  let a, b, c;
  if (jd > 2299160) { a = jd + 32044; b = INT((4 * a + 3) / 146097); c = a - INT((b * 146097) / 4); }
  else { b = 0; c = jd + 32082; }
  const d = INT((4 * c + 3) / 1461), e = c - INT((1461 * d) / 4), m = INT((5 * e + 2) / 153);
  return [e - INT((153 * m + 2) / 5) + 1, m + 3 - 12 * INT(m / 10), b * 100 + d - 4800 + INT(m / 10)];
}

function newMoon(k) {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat = T < -11
    ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Jd1 + C1 - deltat;
}

function sunLongitude(jdn) {
  const T = (jdn - 2451545.0) / 36525, T2 = T * T, dr = PI / 180;
  const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  return L - PI * 2 * INT(L / (PI * 2));
}

const getSunLongitude = (dn, tz) => INT(sunLongitude(dn - 0.5 - tz / 24) / PI * 6);
const getNewMoonDay = (k, tz) => INT(newMoon(k) + 0.5 + tz / 24);

function getLunarMonth11(yy, tz) {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k, tz);
  if (getSunLongitude(nm, tz) >= 9) nm = getNewMoonDay(k - 1, tz);
  return nm;
}

function getLeapMonthOffset(a11, tz) {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last, i = 1, arc = getSunLongitude(getNewMoonDay(k + i, tz), tz);
  do { last = arc; i++; arc = getSunLongitude(getNewMoonDay(k + i, tz), tz); } while (arc !== last && i < 14);
  return i - 1;
}

/** Dương -> Âm: trả về {d, m, y, leap} */
export function solarToLunar(dd, mm, yy, tz = TZ) {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, tz);
  if (monthStart > dayNumber) monthStart = getNewMoonDay(k, tz);
  let a11 = getLunarMonth11(yy, tz), b11 = a11, lunarYear;
  if (a11 >= monthStart) { lunarYear = yy; a11 = getLunarMonth11(yy - 1, tz); }
  else { lunarYear = yy + 1; b11 = getLunarMonth11(yy + 1, tz); }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let leap = 0, lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapDiff = getLeapMonthOffset(a11, tz);
    if (diff >= leapDiff) { lunarMonth = diff + 10; if (diff === leapDiff) leap = 1; }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return { d: lunarDay, m: lunarMonth, y: lunarYear, leap };
}

/** Âm -> Dương: trả về {d, m, y} hoặc null */
export function lunarToSolar(ld, lm, ly, leap = 0, tz = TZ) {
  let a11, b11;
  if (lm < 11) { a11 = getLunarMonth11(ly - 1, tz); b11 = getLunarMonth11(ly, tz); }
  else { a11 = getLunarMonth11(ly, tz); b11 = getLunarMonth11(ly + 1, tz); }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lm - 11; if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, tz);
    let leapMonth = leapOff - 2; if (leapMonth < 0) leapMonth += 12;
    if (leap && lm !== leapMonth) return null;
    if (leap || off >= leapOff) off += 1;
  } else if (leap) return null;
  const [d, m, y] = jdToDate(getNewMoonDay(k + off, tz) + ld - 1);
  return { d, m, y };
}

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
export const canChiYear = (y) => `${CAN[(y + 6) % 10]} ${CHI[(y + 8) % 12]}`;

/** Ngày dương lịch của ngày giỗ (theo ngày/tháng âm, không tính tháng nhuận) trong năm âm ly */
export function gioInLunarYear(ld, lm, ly) {
  let s = lunarToSolar(ld, lm, ly, 0);
  // Tháng thiếu (29 ngày) mà giỗ ngày 30 -> lấy ngày 29
  if (s && ld === 30) {
    const back = solarToLunar(s.d, s.m, s.y);
    if (back.m !== lm) s = lunarToSolar(29, lm, ly, 0);
  }
  return s ? new Date(s.y, s.m - 1, s.d) : null;
}

/** Ngày giỗ sắp tới (Date) tính từ hôm nay */
export function nextGio(ld, lm, from = new Date()) {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const lt = solarToLunar(today.getDate(), today.getMonth() + 1, today.getFullYear());
  for (let ly = lt.y; ly <= lt.y + 1; ly++) {
    const d = gioInLunarYear(ld, lm, ly);
    if (d && d >= today) return { date: d, lunarYear: ly };
  }
  return null;
}

export function todayLunar() {
  const t = new Date();
  return solarToLunar(t.getDate(), t.getMonth() + 1, t.getFullYear());
}
