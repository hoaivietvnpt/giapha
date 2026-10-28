// Dữ liệu mẫu (hư cấu) để dùng thử. Có thể xoá trong trang Quản trị.
const G = (place, map) => ({ gravePlace: place, graveMap: map });
const nghiaTrang = 'Nghĩa trang thôn Yên Lộ (dữ liệu mẫu)';

export const SAMPLE = {
  clan: {
    name: 'Họ Nguyễn',
    fullName: 'Gia phả họ Nguyễn – chi Yên Lộ',
    origin: 'Thôn Yên Lộ, xã An Lạc (dữ liệu mẫu)',
    hall: 'Nhà thờ họ Nguyễn, xóm Đình, thôn Yên Lộ',
    intro: 'Đây là dữ liệu mẫu để bạn xem thử cách gia phả hoạt động. Thủy tổ là cụ Nguyễn Văn Phúc, gốc người làng Yên Lộ. Trải qua sáu đời, con cháu nay sinh sống ở nhiều nơi nhưng hằng năm vẫn về nhà thờ họ dự giỗ tổ ngày 10 tháng Giêng âm lịch.',
    motto: 'Uống nước nhớ nguồn',
    rootId: 'p1'
  },
  persons: [
    { id: 'p1', name: 'Nguyễn Văn Phúc', otherName: 'Tên húy: Phúc Đức', gender: 'm', spouses: ['p2'], birth: '1880', alive: false, death: '1945', deathLunar: { d: 10, m: 1, y: 1945 }, ...G(nghiaTrang + ', khu mộ tổ', '21.0012,105.7568'), bio: 'Thủy tổ của chi họ. Cụ làm nghề dạy chữ Nho, có công dựng nhà thờ họ đầu tiên vào năm 1920.', occupation: 'Thầy đồ' },
    { id: 'p2', name: 'Trần Thị Lành', gender: 'f', spouses: ['p1'], birth: '1884', alive: false, death: '1950', deathLunar: { d: 22, m: 8, y: 1950 }, ...G(nghiaTrang + ', khu mộ tổ', '21.0012,105.7568'), bio: 'Cụ bà quê làng Đông, đảm đang việc nhà, nuôi dạy ba người con.' },

    { id: 'p3', name: 'Nguyễn Văn An', gender: 'm', fatherId: 'p1', motherId: 'p2', order: 1, spouses: ['p4'], birth: '1905', alive: false, death: '03/05/1972', deathLunar: { d: 21, m: 3, y: 1972 }, ...G(nghiaTrang + ', khu A, hàng 1', '21.0015,105.7571'), bio: 'Trưởng nam, giữ việc thờ cúng tổ tiên.', occupation: 'Làm ruộng', branch: 'Chi trưởng' },
    { id: 'p4', name: 'Lê Thị Hoa', gender: 'f', spouses: ['p3'], birth: '1908', alive: false, death: '1985', deathLunar: { d: 2, m: 11, y: 1985 }, ...G(nghiaTrang + ', khu A, hàng 1', '21.0015,105.7571') },
    { id: 'p5', name: 'Nguyễn Văn Bình', gender: 'm', fatherId: 'p1', motherId: 'p2', order: 2, spouses: ['p6'], birth: '1910', alive: false, death: '1980', deathLunar: { d: 15, m: 7, y: 1980 }, ...G(nghiaTrang + ', khu A, hàng 2', '21.0017,105.7573'), branch: 'Chi thứ' },
    { id: 'p6', name: 'Phạm Thị Nụ', gender: 'f', spouses: ['p5'], birth: '1914', alive: false, death: '1992', deathLunar: { d: 6, m: 4, y: 1992 }, ...G(nghiaTrang + ', khu A, hàng 2', '21.0017,105.7573') },
    { id: 'p7', name: 'Nguyễn Thị Cúc', gender: 'f', fatherId: 'p1', motherId: 'p2', order: 3, spouses: ['p8'], birth: '1913', alive: false, death: '1990', deathLunar: { d: 28, m: 12, y: 1989 }, gravePlace: 'Nghĩa trang làng Đông (dữ liệu mẫu)', bio: 'Lấy chồng họ Đỗ ở làng Đông.' },
    { id: 'p8', name: 'Đỗ Văn Tài', gender: 'm', spouses: ['p7'], birth: '1910', alive: false, death: '1975', deathLunar: { d: 9, m: 9, y: 1975 } },

    { id: 'p9', name: 'Nguyễn Văn Cường', gender: 'm', fatherId: 'p3', motherId: 'p4', order: 1, spouses: ['p10'], birth: '12/02/1930', alive: false, death: '18/10/2005', deathLunar: { d: 16, m: 9, y: 2005 }, ...G(nghiaTrang + ', khu B, hàng 3, mộ số 12', '21.0021,105.7579'), bio: 'Cựu chiến binh, từng làm trưởng thôn. Ông là người khởi xướng việc tu sửa nhà thờ họ năm 1995 và ghi chép lại gia phả bằng chữ quốc ngữ.', occupation: 'Cán bộ xã', branch: 'Chi trưởng' },
    { id: 'p10', name: 'Hoàng Thị Mai', gender: 'f', spouses: ['p9'], birth: '1934', alive: false, death: '2015', deathLunar: { d: 4, m: 2, y: 2015 }, ...G(nghiaTrang + ', khu B, hàng 3, mộ số 13', '21.0021,105.7579') },
    { id: 'p11', name: 'Nguyễn Thị Dung', gender: 'f', fatherId: 'p3', motherId: 'p4', order: 2, birth: '1935', alive: false, death: '2020', deathLunar: { d: 12, m: 6, y: 2020 }, gravePlace: 'Nghĩa trang Văn Điển (dữ liệu mẫu)' },
    { id: 'p12', name: 'Nguyễn Văn Đức', gender: 'm', fatherId: 'p5', motherId: 'p6', order: 1, spouses: ['p13'], birth: '1938', alive: false, death: '2018', deathLunar: { d: 27, m: 10, y: 2018 }, ...G(nghiaTrang + ', khu B, hàng 5', '21.0024,105.7582'), occupation: 'Giáo viên', branch: 'Chi thứ' },
    { id: 'p13', name: 'Vũ Thị Lan', gender: 'f', spouses: ['p12'], birth: '1942', alive: true, occupation: 'Giáo viên về hưu', bio: 'Bà nghỉ hưu, sống cùng con trai út.' },
    { id: 'p14', name: 'Đỗ Văn Hải', gender: 'm', fatherId: 'p8', motherId: 'p7', order: 1, birth: '1940', alive: false, death: '2010', deathLunar: { d: 1, m: 5, y: 2010 } },

    { id: 'p15', name: 'Nguyễn Văn Hùng', gender: 'm', fatherId: 'p9', motherId: 'p10', order: 1, spouses: ['p16'], birth: '05/06/1958', alive: true, occupation: 'Kỹ sư xây dựng (đã nghỉ hưu)', bio: 'Trưởng họ hiện nay, phụ trách việc tổ chức giỗ tổ hằng năm.', branch: 'Chi trưởng' },
    { id: 'p16', name: 'Bùi Thị Thu', gender: 'f', spouses: ['p15'], birth: '1962', alive: true, occupation: 'Kế toán' },
    { id: 'p17', name: 'Nguyễn Thị Hằng', gender: 'f', fatherId: 'p9', motherId: 'p10', order: 2, birth: '1961', alive: true, occupation: 'Bác sĩ' },
    { id: 'p18', name: 'Nguyễn Văn Minh', gender: 'm', fatherId: 'p12', motherId: 'p13', order: 1, spouses: ['p19'], birth: '1965', alive: true, occupation: 'Kinh doanh', branch: 'Chi thứ' },
    { id: 'p19', name: 'Đặng Thị Yến', gender: 'f', spouses: ['p18'], birth: '1968', alive: true },
    { id: 'p20', name: 'Nguyễn Văn Nam', gender: 'm', fatherId: 'p12', motherId: 'p13', order: 2, birth: '1970', alive: true, occupation: 'Lái xe', branch: 'Chi thứ' },

    { id: 'p21', name: 'Nguyễn Văn Quang', gender: 'm', fatherId: 'p15', motherId: 'p16', order: 1, spouses: ['p22'], birth: '20/11/1985', alive: true, occupation: 'Kỹ sư phần mềm', bio: 'Người số hóa gia phả lên website này.', branch: 'Chi trưởng' },
    { id: 'p22', name: 'Trịnh Thị Ngọc', gender: 'f', spouses: ['p21'], birth: '1988', alive: true, occupation: 'Giáo viên' },
    { id: 'p23', name: 'Nguyễn Thị Phương', gender: 'f', fatherId: 'p15', motherId: 'p16', order: 2, birth: '1990', alive: true, occupation: 'Dược sĩ' },
    { id: 'p24', name: 'Nguyễn Văn Sơn', gender: 'm', fatherId: 'p18', motherId: 'p19', order: 1, birth: '1992', alive: true, occupation: 'Kiến trúc sư', branch: 'Chi thứ' },

    { id: 'p25', name: 'Nguyễn Gia Bảo', gender: 'm', fatherId: 'p21', motherId: 'p22', order: 1, birth: '2015', alive: true, branch: 'Chi trưởng' },
    { id: 'p26', name: 'Nguyễn Khánh An', gender: 'f', fatherId: 'p21', motherId: 'p22', order: 2, birth: '2018', alive: true }
  ],
  news: [
    { id: 'n1', title: 'Thông báo giỗ tổ năm Bính Ngọ', pinned: true, published: true, createdAt: Date.now() - 3 * 86400000, author: 'Ban liên lạc họ',
      summary: 'Lễ giỗ tổ tổ chức ngày 10 tháng Giêng tại nhà thờ họ. Kính mời toàn thể con cháu về dự.',
      content: '<h2>Thời gian & địa điểm</h2><p><strong>8 giờ sáng ngày 10 tháng Giêng</strong> (âm lịch) tại nhà thờ họ, xóm Đình, thôn Yên Lộ.</p><h2>Chương trình</h2><ol><li>Dâng hương tưởng niệm thủy tổ</li><li>Báo cáo hoạt động của dòng họ trong năm</li><li>Trao thưởng khuyến học cho con cháu</li><li>Liên hoan thân mật</li></ol><blockquote>Uống nước nhớ nguồn – mong con cháu gần xa thu xếp về dự đông đủ.</blockquote><p>Mọi đóng góp xin liên hệ trưởng họ. <em>(Dữ liệu mẫu)</em></p>' }
  ],
  contacts: {
    p13: { phone: '0900 000 013', address: 'Thôn Yên Lộ (dữ liệu mẫu)' },
    p15: { phone: '0900 000 015', zalo: '0900000015', facebook: 'https://facebook.com/', address: 'Thôn Yên Lộ (dữ liệu mẫu)' },
    p17: { phone: '0900 000 017', email: 'hang@example.com' },
    p18: { phone: '0900 000 018', zalo: '0900000018' },
    p21: { phone: '0900 000 021', email: 'quang@example.com', facebook: 'https://facebook.com/', website: 'https://github.com/' },
    p23: { phone: '0900 000 023', facebook: 'https://facebook.com/' }
  }
};
