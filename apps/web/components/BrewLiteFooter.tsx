import React from "react";
import Link from "next/link";
import BrewLiteMark from "./BrewLiteMark";
import { CoffeeIcon, ClockIcon, SparklesIcon } from "./Icons";

export default function BrewLiteFooter() {
  return (
    <footer className="bl-footer" role="contentinfo">
      <div className="bl-footer-inner">
        <div className="bl-footer-brand-section">
          <Link className="bl-brand bl-footer-brand" href="/" aria-label="BrewLite — Trang chủ">
            <BrewLiteMark />
            <div className="bl-brand-text">
              <span className="bl-brand-name">BrewLite</span>
              <span className="bl-brand-tagline">Chắt lọc từng giọt đậm đà</span>
            </div>
          </Link>
          <p className="bl-footer-desc">
            Không gian cà phê thủ công đương đại. Rang mộc nguyên bản, pha chế tỉ mỉ từng mẻ và sẵn sàng nhận tại quầy sau 5 phút.
          </p>
        </div>

        <div className="bl-footer-grid">
          <div className="bl-footer-col">
            <h3 className="bl-footer-col-title">
              <ClockIcon size={16} /> Giờ phục vụ
            </h3>
            <p>Thứ 2 – Chủ Nhật: 07:00 – 22:00</p>
            <p>Nhận đơn đặt trước tại quầy xuyên suốt ngày</p>
          </div>
          <div className="bl-footer-col">
            <h3 className="bl-footer-col-title">
              <CoffeeIcon size={16} /> Cửa hàng
            </h3>
            <p>Trạm cà phê BrewLite Center</p>
            <p>Thanh toán tiện lợi qua ví ZaloPay</p>
          </div>
          <div className="bl-footer-col">
            <h3 className="bl-footer-col-title">
              <SparklesIcon size={16} /> Cam kết chất lượng
            </h3>
            <p>100% hạt cà phê Robusta & Arabica tuyển chọn</p>
            <p>Sữa tươi tiệt trùng & nguyên liệu chuẩn vị tự nhiên</p>
          </div>
        </div>
      </div>

      <div className="bl-footer-bottom">
        <p>© 2026 BrewLite Coffee & Tea. Phát triển vì trải nghiệm thưởng thức tinh tế.</p>
      </div>
    </footer>
  );
}
