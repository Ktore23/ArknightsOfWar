class Character {
  constructor(name, image, hp, def, res, spd, spdatk, atk, dp, cd, skill1, skill2, skill3, talent, trait) {
    this.name = name;
    this.image = image;
    this.hp = hp; // Máu
    this.def = def; // Kháng vật lý
    this.res = res; // Kháng phép
    this.spd = spd; // Tốc chạy
    this.spdatk = spdatk; // Tốc đánh
    this.atk = atk; // Tấn công
    this.dp = dp; // Deployment Points
    this.cd = cd; // Thêm thuộc tính cooldown (mili-giây)
    this.skill1 = skill1; // Kỹ năng 1
    this.skill2 = skill2; // Kỹ năng 2
    this.skill3 = skill3; // Kỹ năng 3
    this.talent = talent; // Thiên phú
    this.trait = trait; // Đặc tính
  }

  // Phương thức để lấy thông tin định dạng
  getFormattedStats() {
    return `
      HP: ${this.hp}<br>
      Kháng vật lý: ${this.def}<br>
      Kháng phép: ${this.res}<br>
      Tốc chạy: ${this.spd}<br>
      Tốc đánh: ${this.spdatk}<br>
      Tấn công: ${this.atk}<br>
      DP: ${this.dp}<br>
      CD: ${this.cd}s
    `;
  }
}

// Danh sách nhân vật mẫu
export const characterData = [
  new Character(
    "Surtr",
    "./assets/avatars/operators/Surtr/SurtrSummer/surtr_summer.png",
    // 2916, // HP
    1000000, // HP
    414, // DEF
    15, // RES
    70, // SPD
    1.5, // SPDATK
    // 672, // ATK
    1000000, // ATK
    // 12, // DP
    50, // DP
    // 8, // Cooldown
    60, // Cooldown
    // "Kỹ năng 1: <em>Hỏa Cầu</em> - Gây <span style='color: red;'>200 sát thương</span> diện rộng.",
    // "Kỹ năng 2: <em>Bùng Nổ</em> - Tăng <span style='color: orange;'>20% sát thương</span> trong <u>8 giây</u>.",
    // "Kỹ năng 3: <em>Siêu Hỏa</em> - Gây <span style='color: crimson;'>500 sát thương</span> đơn mục tiêu.",
    // "Thiên phú: <em>Cuồng Nộ</em> - Tăng <span style='color: red;'>10% tấn công</span> khi HP dưới 50%.",
    // "Đặc tính: <em>Sát Thủ</em> - Gây thêm <u>15% sát thương</u> vào kẻ địch dưới 30% HP."
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu."
  ),
  new Character(
    "Shu",
    "./assets/avatars/operators/Shu/ShuNian/shu_nian.png",
    3213, // HP
    602, // DEF
    10, // RES
    60, // SPD
    1.2, // SPDATK
    479, // ATK
    10, // DP
    7, // Cooldown
    // "Kỹ năng 1: <em>Lá Chắn</em> - Giảm <span style='color: blue;'>50% sát thương</span> nhận vào trong <u>10 giây</u>.",
    // "Kỹ năng 2: <em>Hồi Phục</em> - Hồi <span style='color: green;'>300 HP</span> cho bản thân.",
    // "Kỹ năng 3: <em>Phòng Thủ</em> - Tăng <span style='color: blue;'>30% kháng vật lý</span> cho đồng đội.",
    // "Thiên phú: <em>Bền Bỉ</em> - Hồi <span style='color: green;'>5% HP</span> mỗi 10 giây.",
    // "Đặc tính: <em>Hộ Vệ</em> - Giảm <u>10% sát thương</u> cho đồng đội gần kề."
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu."
  ),
  new Character(
    "Frost Nova",
    "./assets/avatars/enemies/FrostNova/FrostNova2/frostnova2.png",
    30000, // HP
    380, // DEF
    50, // RES
    90, // SPD
    1.8, // SPDATK
    440, // ATK
    10, // DP
    7, // Cooldown
    // "Kỹ năng 1: <em>Tàng Hình</em> - <span style='color: purple;'>Ẩn thân</span> trong <u>8 giây</u>.",
    // "Kỹ năng 2: <em>Tốc Biến</em> - Tăng <span style='color: yellow;'>50% tốc chạy</span> trong <u>5 giây</u>.",
    // "Kỹ năng 3: <em>Đâm Lén</em> - Gây <span style='color: purple;'>300 sát thương</span> từ phía sau.",
    // "Thiên phú: <em>Nhanh Nhẹn</em> - Tăng <span style='color: yellow;'>15% tốc đánh</span> khi không bị tấn công.",
    // "Đặc tính: <em>Thích Khách</em> - Tăng <u>20% sát thương chí mạng</u>."
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu."
  ),
  new Character(
    "Ch'en",
    "./assets/avatars/operators/Chen/ChenNian/chen_nian.png",
    2880, // HP
    352, // DEF
    0, // RES
    65, // SPD
    1.4, // SPDATK
    610, // ATK
    15, // DP
    10, // Cooldown
    // "Kỹ năng 1: <em>Sấm Sét</em> - Gây <span style='color: yellow;'>250 sát thương</span> đơn mục tiêu.",
    // "Kỹ năng 2: <em>Điện Từ</em> - Làm chậm <span style='color: blue;'>30% tốc chạy</span> của kẻ địch trong <u>6 giây</u>.",
    // "Kỹ năng 3: <em>Cơn Bão</em> - Gây <span style='color: yellow;'>150 sát thương</span> diện rộng liên tục.",
    // "Thiên phú: <em>Năng Lượng</em> - Hồi <span style='color: blue;'>10% mana</span> mỗi 5 giây.",
    // "Đặc tính: <em>Pháp Sư</em> - Tăng <u>15% sát thương phép</u>."
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu."
  ),
  new Character(
    "Exusiai",
    "./assets/avatars/operators/Exusiai/ExusiaiSale/char_103_angel_sale8.png",
    1673, // HP
    161, // DEF
    0, // RES
    75, // SPD
    1.6, // SPDATK
    540, // ATK
    12, // DP
    8, // Cooldown
    // "Kỹ năng 1: <em>Cơn Thịnh Nộ</em> - Tăng <span style='color: orange;'>30% sát thương</span> trong <u>12 giây</u>.",
    // "Kỹ năng 2: <em>Chí Mạng</em> - Gây <span style='color: red;'>400 sát thương</span> với <u>50% tỉ lệ chí mạng</u>.",
    // "Kỹ năng 3: <em>Hủy Diệt</em> - Gây <span style='color: red;'>600 sát thương</span> đơn mục tiêu.",
    // "Thiên phú: <em>Cuồng Loạn</em> - Tăng <span style='color: red;'>20% tốc đánh</span> khi HP dưới 30%.",
    // "Đặc tính: <em>Chiến Binh</em> - Tăng <u>10% sát thương</u> khi tấn công liên tục."
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu."
  ),
  new Character(
    "Kroos",
    "./assets/avatars/operators/Kroos/KroosWitch/kroos_witch.png",
    1060, // HP
    126, // DEF
    0, // RES
    55, // SPD
    1.0, // SPDATK
    375, // ATK
    5, // DP
    5, // Cooldown
    "Kỹ năng 1: Sau mỗi 3 đòn đánh gây <span style='color: red;'>X2 sát thương</span> lên kẻ địch.",
    // "Kỹ năng 2: <em>Ánh Sáng</em> - Tăng <span style='color: yellow;'>20% kháng phép</span> cho đồng đội trong <u>10 giây</u>.",
    // "Kỹ năng 3: <em>Phục Hồi</em> - Hồi <span style='color: green;'>200 HP</span> cho cả đội trong <u>5 giây</u>.",
    // "Thiên phú: <em>Bảo Hộ</em> - Giảm <span style='color: blue;'>10% sát thương</span> nhận vào cho đồng đội gần kề.",
    // "Đặc tính: <em>Hỗ Trợ</em> - Tăng <u>15% hiệu quả hồi máu</u>."
    "Không có dữ liệu.",
    "Không có dữ liệu.",
    "Chưa có dữ liệu.",
    "Chưa có dữ liệu."
  ),
];

// Chuyển thành object để tương thích với main.js
export const characterDataObj = characterData.reduce((obj, char) => {
  obj[char.name] = {
    image: char.image,
    hp: char.hp,
    def: char.def,
    res: char.res,
    spd: char.spd,
    spdatk: char.spdatk,
    atk: char.atk,
    dp: char.dp,
    cd: char.cd,
    skill1: char.skill1,
    skill2: char.skill2,
    skill3: char.skill3,
    talent: char.talent,
    trait: char.trait,
  };
  return obj;
}, {});