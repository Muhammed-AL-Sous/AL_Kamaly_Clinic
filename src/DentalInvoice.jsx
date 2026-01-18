// React Hooks
import { useState, useRef, useMemo } from "react";
import { useReactToPrint } from "react-to-print";

// Print & PDF
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

// Logo
import alkamalyLogo from "../public/images/AL-Kamaly_Logo_Header.png";

// Toast Notification
import { ToastContainer } from "react-toastify";
import notify from "./ToastifyNotification";

// Translater
import { useTranslation } from "react-i18next";

export default function DentalInvoice() {
  // Translation
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (e) => {
    const selectedLanguage = e.target.value;
    i18n.changeLanguage(selectedLanguage);

    document.documentElement.dir = selectedLanguage === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = selectedLanguage;
  };

  // React States
  const [patientName, setPatientName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [note, setNote] = useState("");
  const [displayedNote, setDisplayedNote] = useState("");

  // Discount & Received Money Dinar
  const [discountIQD, setDiscountIQD] = useState("");
  const [percentDiscountIQD, setpercentDiscountIQD] = useState("");
  const [receivedIQD, setReceivedIQD] = useState("");

  // Discount & Received Money Dollar
  const [discountUSD, setDiscountUSD] = useState("");
  const [percentDiscountUSD, setpercentDiscountUSD] = useState("");
  const [receivedUSD, setReceivedUSD] = useState("");

  //   Add Currency To New Modal
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceCurrency, setNewServiceCurrency] = useState("");

  // Dental Services

  const [services, setServices] = useState([
    {
      id: 1,
      name: "RCT 'Root Canal treatment'",
      price: 230000,
      currency: "IQD",
    },
    { id: 2, name: "Posterior tooth filling", price: 90000, currency: "IQD" },
    {
      id: 3,
      name: "Anterior esthetic filling",
      price: 150000,
      currency: "IQD",
    },
    { id: 4, name: "Zirconium crown", price: 230000, currency: "IQD" },
    {
      id: 5,
      name: "Teeth cleaning and polishing",
      price: 75000,
      currency: "IQD",
    },
    { id: 6, name: "Post and core", price: 125000, currency: "IQD" },
    { id: 7, name: "Simple tooth extraction", price: 40000, currency: "IQD" },
    { id: 8, name: "E-MAX crown_veneer", price: 240, currency: "USD" },
    { id: 9, name: "Orthodontics", price: 800, currency: "USD" },
    { id: 10, name: "Teeth cultivation", price: 440, currency: "USD" },
    { id: 11, name: "Teeth whitening 'German'", price: 220, currency: "USD" },
    { id: 12, name: "Teeth whitening 'USA'", price: 175, currency: "USD" },
    { id: 13, name: "Surgical tooth extraction", price: 150, currency: "USD" },
  ]);

  // هذا الكود سيقوم بترجمة الأسماء فوراً عند تغيير اللغة دون المساس بالبيانات الأصلية
  const translatedServices = useMemo(() => {
    return services.map((service) => ({
      ...service,
      // نقوم بالترجمة هنا، وإذا كانت الخدمة مضافة يدوياً وليست في ملف الترجمة ستظهر كما هي
      displayName: t(service.name),
    }));
  }, [services, t, i18n.language]);

  // الآن نستخدم المصفوفة المترجمة للترتيب والعرض
  const sortedServices = [...translatedServices].sort((a, b) => {
    if (a.currency === b.currency) {
      return a.displayName.localeCompare(b.displayName);
    }
    return a.currency === "IQD" ? -1 : 1;
  });

  const contentRef = useRef(null);

  // Reference Number
  const [invoiceRef] = useState(() =>
    Math.random().toString(36).substr(2, 9).toUpperCase(),
  );

  // Date String
  const date = new Date();
  const dateStr = `${date.getDate()}/${
    date.getMonth() + 1
  }/${date.getFullYear()}`;

  // --- Accounts Logic ---
  // Processing Totals
  const iqdServices = selectedServices.filter((s) => s.currency === "IQD");
  const usdServices = selectedServices.filter((s) => s.currency === "USD");

  const subtotalIQD = iqdServices.reduce((acc, curr) => acc + curr.price, 0);
  const subtotalUSD = usdServices.reduce((acc, curr) => acc + curr.price, 0);

  const discountTotalIQD =
    subtotalIQD * (Number(percentDiscountIQD) / 100) + Number(discountIQD);
  const discountTotalUSD =
    subtotalUSD * (Number(percentDiscountUSD) / 100) + Number(discountUSD);

  const finalIQD = subtotalIQD - (showDiscount ? Number(discountTotalIQD) : 0);
  const finalUSD = subtotalUSD - (showDiscount ? Number(discountTotalUSD) : 0);

  const remainingIQD = finalIQD - Number(receivedIQD);
  const remainingUSD = finalUSD - Number(receivedUSD);

  // --- Functions ---

  // Print Functionality
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `${t("invoice")}-${patientName}`,
  });

  // Download PDF Functionality
  const handleDownloadPDF = async () => {
    if (!contentRef.current) return;

    try {
      const dataUrl = await toPng(contentRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF("p", "mm", "a4");

      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      // نسبة الزيادة المسموحة للـ scale (10%)
      const SCALE_THRESHOLD = 1.1;

      // 👉 الحالة 1: تقريباً صفحة وحدة
      if (imgHeight <= pdfHeight * SCALE_THRESHOLD) {
        const scale = pdfHeight / imgHeight;
        const finalHeight = imgHeight * scale;
        const finalWidth = imgWidth * scale;

        const x = (pdfWidth - finalWidth) / 2;
        const y = (pdfHeight - finalHeight) / 2;

        pdf.addImage(dataUrl, "PNG", x, y, finalWidth, finalHeight);
      }
      // 👉 الحالة 2: محتوى طويل → صفحات متعددة
      else {
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(dataUrl, "PNG", 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
          position -= pdfHeight;
          pdf.addPage();
          pdf.addImage(dataUrl, "PNG", 0, position, pdfWidth, imgHeight);
          heightLeft -= pdfHeight;
        }
      }

      pdf.save(`${t("invoice")}-${patientName || `${t("Patient")}`}.pdf`);
    } catch (err) {
      console.error("PDF Error:", err);
      notify(`${t("There was a problem loading the PDF")}`, "error");
    }
  };

  // Add/Remove Service
  const toggleService = (service) => {
    setSelectedServices((prev) =>
      prev.find((s) => s.id === service.id)
        ? prev.filter((s) => s.id !== service.id)
        : [...prev, service],
    );
  };

  // Add New Service Modal Handlers
  const handleAddService = () => {
    setShowModal(true);
  };

  // Close Modal
  const handleCloseService = () => {
    setShowModal(false);
    setNewServiceName("");
    setNewServicePrice("");
  };

  // Get Next ID
  const getNextId = () => {
    return services.length ? Math.max(...services.map((s) => s.id)) + 1 : 1;
  };

  // Submit New Service
  const handleSubmitNewService = () => {
    // تنظيف المسافات
    const name = newServiceName.trim();
    const price = Number(newServicePrice);
    const currency = newServiceCurrency;

    // validation
    if (!name) {
      notify(`${t("Service name is required")}`, "warn");
      return;
    }

    if (!newServicePrice) {
      notify(`${t("Service price is required")}`, "warn");
      return;
    }

    if (price <= 0) {
      notify(`${t("The service price must be greater than zero")}`, "warn");
      return;
    }

    const isDuplicate = services.some((s) => s.name.trim() === name);

    if (isDuplicate) {
      notify(`${t("This service already exists")}`, "warn");
      return;
    }

    if (!currency) {
      notify(`${t("Please select the service currency")}`, "warn");
      return;
    }

    const newService = {
      id: getNextId(),
      name: newServiceName,
      price: Number(newServicePrice),
      currency: newServiceCurrency,
    };

    setServices([...services, newService]);
    setSelectedServices([...selectedServices, newService]);
    notify(`${t("Service successfully added")}`, "success");

    // reset
    setNewServiceName("");
    setNewServicePrice("");
    setNewServiceCurrency("");
    setShowModal(false);
  };

  // دالة لمنع تغيير الرقم عند استخدام بكرة الماوس
  const handleWheel = (e) => {
    // إزالة التركيز عن الحقل عند محاولة التمرير فوقه
    e.target.blur();
  };

  // دالة لتحويل الرقم إلى نص منسق بنقاط: 50000 -> 50.000
  const formatNumber = (val) => {
    if (!val) return "";
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Add Note Modal Handlers
  const handleAddNote = () => {
    setShowNoteModal(true);
  };

  // Close Modal
  const handleCloseNote = () => {
    setShowNoteModal(false);
    setNote("");
  };

  const handleSubmitNote = () => {
    // validation
    if (!note) {
      notify(`${t("Please fill in the comment field first")}`, "warn");
      return;
    }

    if (note.trim() !== "") {
      notify(`${t("Note successfully added")}`, "success");
      setDisplayedNote(note); // نضع النص الجديد في الحالة المخصصة للعرض
      setShowNoteModal(false); // نغلق المودال
    }
  };

  return (
    <div className="relative p-4 md:p-10 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Dashboard */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-md border border-slate-400 print:hidden h-fit">
          <h2 className="text-xl font-bold mb-2 text-blue-900 border-b pb-2">
            {t("DashBoard")}
          </h2>
          <div className="mb-2">
            <label className="text-gray-700 font-bold">
              {t("Select language")} :{" "}
            </label>

            <select
              className="p-1 cursor-pointer focus:outline-gray-400 border border-gray-700 rounded"
              onChange={handleLanguageChange}
              value={i18n.language} // لجعل القيمة المختارة مطابقة للغة الحالية
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="space-y-4">
            <input
              className="w-full p-2 border rounded focus:outline-slate-400"
              placeholder={t("Patient's name")}
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
            />
            <select
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="w-full p-2 border rounded bg-white focus:outline-slate-400"
            >
              <option value="" disabled>
                {t("Select a Doctor")}
              </option>

              <option value="Dr.Ayman AL-Kamaly">
                {t("Dr.Ayman AL-Kamaly")}
              </option>

              <option value="Dr.Omar AL-Kamaly">
                {t("Dr.Omar AL-Kamaly")}
              </option>

              <option value="Dr.Riyadh AL-Kamaly">
                {t("Dr.Riyadh AL-Kamaly")}
              </option>
            </select>

            <span className="mb-2 block font-bold text-lg text-blue-900">
              {t("Services")} :
            </span>
            <div className="max-h-48 overflow-y-auto border rounded p-2 bg-slate-50">
              {sortedServices.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    checked={selectedServices.some((i) => i.id === s.id)}
                    onChange={() => toggleService(s)}
                  />
                  <span className="flex-1 text-sm">{s.displayName}</span>
                  <span
                    className={`text-xs font-bold ${
                      s.currency === "USD"
                        ? "text-blue-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {s.price.toLocaleString()}{" "}
                    {s.currency === "USD" ? "$" : `${t("IQD")}`}
                  </span>
                </label>
              ))}
            </div>

            <div className="add-service">
              <button
                onClick={handleAddService}
                className="w-full bg-gray-600 text-white py-2 rounded-lg font-bold hover:bg-gray-700 transition cursor-pointer"
              >
                {t("Add a service")}
              </button>
            </div>
            <button
              onClick={handleAddNote}
              className="w-full bg-amber-600 text-white py-2 rounded-lg font-bold hover:bg-amber-700 transition cursor-pointer"
            >
              {t("Add a Note")}
            </button>

            {/* مدخلات الخصم والملغ المقبوض بالدينار*/}
            <div className="p-3 bg-lime-200 rounded-lg space-y-3 ">
              <p className="font-semibold text-lg text-blue-900">
                {t("Discount and amount received (IQD dinar)")}:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  onWheel={handleWheel} // استدعاء الدالة عند التمرير
                  placeholder={t("Discount in dinars")}
                  className="p-2 border-red-400 rounded text-sm
                 focus:outline-red-400 border-2 font-bold"
                  style={{
                    cursor: showDiscount ? "text" : "not-allowed",
                    backgroundColor: showDiscount ? "white" : "#d5d5d5",
                    color: showDiscount ? "red" : "gray",
                    borderColor: showDiscount ? "#ff6467" : "transparent",
                  }}
                  disabled={!showDiscount}
                  value={formatNumber(discountIQD)}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    // 1. التحقق أولاً إذا كانت الفاتورة صفر
                    if (subtotalIQD === 0 && value > 0) {
                      notify(
                        `${t("Please add services to the bill first before attempting to make a deduction")}`,
                        "warn",
                      );
                      setDiscountIQD(0);
                      return;
                    }
                    const maxAllowedDiscount = subtotalIQD * 0.2; // حساب حد الـ 20%
                    if (value > maxAllowedDiscount) {
                      // إذا تجاوز القيمة المسموحة، نضع الحد الأقصى
                      setDiscountIQD(maxAllowedDiscount);
                      notify(
                        `${t("Sorry, the maximum discount is 20%")} => ${maxAllowedDiscount}`,
                        "warn",
                      );
                    } else {
                      setDiscountIQD(value);
                    }
                  }}
                />

                <input
                  type="number"
                  min={0}
                  max={20}
                  step={1}
                  onWheel={handleWheel} // استدعاء الدالة عند التمرير
                  className="p-2 border-red-400 rounded text-sm
                 focus:outline-red-400 border-2 font-bold"
                  disabled={!showDiscount}
                  style={{
                    cursor: showDiscount ? "text" : "not-allowed",
                    backgroundColor: showDiscount ? "white" : "#d5d5d5",
                    color: showDiscount ? "red" : "gray",
                    borderColor: showDiscount ? "#ff6467" : "transparent",
                  }}
                  placeholder={t("discount %")}
                  value={percentDiscountIQD}
                  onChange={(e) => {
                    let value = Number(e.target.value);
                    // 1. التحقق أولاً إذا كانت الفاتورة صفر
                    if (subtotalIQD === 0 && value > 0) {
                      notify(
                        `${t("Please add services to the bill first before attempting to make a deduction")}`,
                        "warn",
                      );
                      setpercentDiscountIQD(0);
                      return;
                    }

                    if (value < 0) value = 0;

                    if (value > 20) {
                      notify(
                        `${t("Sorry, the maximum discount is 20%")}`,
                        "warn",
                      );
                      value = 20;
                    }

                    setpercentDiscountIQD(value);
                  }}
                />
              </div>
              <div className="grid grid-cols-1 gap-2">
                <input
                  type="text" // غيرناه إلى text ليقبل النقاط
                  onWheel={handleWheel} // استدعاء الدالة عند التمرير
                  placeholder={t("Amount received IQD")}
                  className="p-2 w-full border rounded text-sm border-green-800 focus:outline-green-800 text-green-800 font-bold bg-emerald-50"
                  value={formatNumber(receivedIQD)}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/\D/g, "");
                    setReceivedIQD(Number(rawValue));
                  }}
                />
              </div>
            </div>

            <hr className="border-b border-blue-900" />

            <div className="p-3 bg-slate-200 rounded-lg space-y-3 ">
              <p className="font-semibold text-lg text-blue-900">
                {t("Discount and amount received (USD Dollar)")}:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  onWheel={handleWheel} // استدعاء الدالة عند التمرير
                  placeholder={t("Discount In Dollars")}
                  className="p-2 border-red-400 rounded text-sm
                 focus:outline-red-400 border-2 font-bold"
                  style={{
                    cursor: showDiscount ? "text" : "not-allowed",
                    backgroundColor: showDiscount ? "white" : "#d5d5d5",
                    color: showDiscount ? "red" : "gray",
                    borderColor: showDiscount ? "#ff6467" : "transparent",
                  }}
                  disabled={!showDiscount}
                  value={formatNumber(discountUSD)}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    // 1. التحقق أولاً إذا كانت الفاتورة صفر
                    if (subtotalUSD === 0 && value > 0) {
                      notify(
                        `${t("Please add services to the bill first before attempting to make a deduction")}`,
                        "warn",
                      );
                      setDiscountUSD(0);
                      return;
                    }

                    const maxAllowedDiscount = subtotalUSD * 0.2; // حساب حد الـ 20%
                    if (value > maxAllowedDiscount) {
                      // إذا تجاوز القيمة المسموحة، نضع الحد الأقصى
                      setDiscountUSD(maxAllowedDiscount);
                      notify(
                        `${t("Sorry, the maximum discount is 20%")} => ${maxAllowedDiscount}`,
                        "warn",
                      );
                    } else {
                      setDiscountUSD(value);
                    }
                  }}
                />

                <input
                  type="number"
                  min={0}
                  max={20}
                  step={1}
                  onWheel={handleWheel} // استدعاء الدالة عند التمرير
                  className="p-2 border-red-400 rounded text-sm
                 focus:outline-red-400 border-2 font-bold"
                  disabled={!showDiscount}
                  style={{
                    cursor: showDiscount ? "text" : "not-allowed",
                    backgroundColor: showDiscount ? "white" : "#d5d5d5",
                    color: showDiscount ? "red" : "gray",
                    borderColor: showDiscount ? "#ff6467" : "transparent",
                  }}
                  placeholder={t("discount %")}
                  value={percentDiscountUSD}
                  onChange={(e) => {
                    let value = Number(e.target.value);

                    // 1. التحقق أولاً إذا كانت الفاتورة صفر
                    if (subtotalUSD === 0 && value > 0) {
                      notify(
                        `${t("Please add services to the bill first before attempting to make a deduction")}`,
                        "warn",
                      );
                      setpercentDiscountUSD(0);
                      return;
                    }
                    if (value < 0) value = 0;
                    if (value > 20) {
                      notify(
                        `${t("Sorry, the maximum discount is 20%")}`,
                        "warn",
                      );
                      value = 20;
                    }

                    setpercentDiscountUSD(value);
                  }}
                />
              </div>
              <div className="grid grid-cols-1 gap-2">
                <input
                  type="text"
                  onWheel={handleWheel} // استدعاء الدالة عند التمرير
                  placeholder={t("Amount received $")}
                  className="p-2 w-full border rounded text-sm border-green-800 focus:outline-green-800 text-green-800 font-bold bg-emerald-50"
                  value={formatNumber(receivedUSD)}
                  onChange={(e) => {
                    // 1. تنظيف القيمة المدخلة من أي نقاط أو حروف (إبقاء الأرقام فقط)
                    const rawValue = e.target.value.replace(/\D/g, "");

                    // 2. تحويلها لرقم وتخزينها في الـ State
                    // هكذا تظل دوال (subtotal, remaining) تعمل بشكل سليم لأنها تتعامل مع رقم صافي
                    setReceivedUSD(Number(rawValue));
                  }}
                />
              </div>
            </div>

            <button
              onClick={() => handlePrint()}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition cursor-pointer"
            >
              {t("print")}
            </button>
            <button
              onClick={handleDownloadPDF}
              className="w-full bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-700 transition cursor-pointer"
            >
              {t("Download PDF")}
            </button>
            <button
              onClick={() => setShowDiscount(!showDiscount)}
              className="w-full text-[15px] cursor-pointer text-slate-400 underline"
            >
              {showDiscount ? `${t("Hide Discount")}` : `${t("Show Discount")}`}
            </button>
          </div>
        </div>
        {/* ==== Dashboard ==== */}

        {/* Invoice Container */}
        <div className="lg:col-span-2 flex justify-center ">
          <div
            className="invoice-container relative shadow-2xl bg-white"
            ref={contentRef}
          >
            <div className="invoice-box p-[8mm] flex flex-col justify-between h-full min-h-[297mm] ">
              {/* الجزء العلوي */}

              <div>
                <header className="relative pb-3 mb-3 border-b-4 border-blue-900">
                  <div className="flex justify-between items-center">
                    <div className=" font-mono text-sm text-slate-400">
                      <p className="font-bold">
                        {t("date")} : {dateStr}
                      </p>
                      <p className="font-bold">
                        {t("Reference Number")}: {invoiceRef}
                      </p>
                    </div>
                    <div>
                      <img
                        src={alkamalyLogo}
                        alt="AL-Kamaly Logo"
                        className="w-64"
                      />
                    </div>
                  </div>

                  <div className="w-full">
                    <h1 className="text-2xl font-black m-0 text-center text-slate-400">
                      {t("Clinic invoice")}
                    </h1>
                  </div>
                </header>

                <div className="space-y-3 text-start mt-6 flex justify-between">
                  <div className="text-lg">
                    {t("Mr/Ms")} :{" "}
                    <span className="font-bold border-b border-dotted border-slate-400 pb-1">
                      {patientName || "................................"}
                    </span>
                  </div>
                  <div className="text-lg">
                    {t("Under the supervision of")} :{" "}
                    <span className="font-bold border-b border-dotted border-slate-400 pb-1">
                      {doctorName
                        ? t(doctorName)
                        : "................................"}
                    </span>
                  </div>
                </div>

                {displayedNote && (
                  <div className="mb-3 mt-2 p-3 bg-red-50 border-s-4 border-red-900 rounded">
                    <p className="text-red-900 font-bold text-lg">
                      <span className="underline ms-2">{t("note")} :</span>
                      <span className="ms-1">{displayedNote}</span>
                    </p>
                  </div>
                )}

                <table className="w-full text-start border-collapse border border-gray-400">
                  <thead>
                    <tr className="bg-blue-900 text-white">
                      <th className="p-4 border border-gray-300 ">
                        {t("Service-Treatment")}
                      </th>
                      <th className="p-4 border border-gray-300 text-center w-40">
                        {t("amount iqd")}
                      </th>
                      <th className="p-4 border border-gray-300 text-center w-40">
                        {t("amount $")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedServices.map((s, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="p-4 text-lg border font-bold border-gray-300">
                          {t(s.name)}
                        </td>
                        <td className="p-4 text-lg border font-bold text-center border-gray-300">
                          {s.currency === "IQD"
                            ? `${s.price.toLocaleString()} ${t("IQD")}`
                            : "-"}
                        </td>
                        <td className="p-4 text-lg border font-bold text-center border-gray-300">
                          {s.currency === "USD" ? ` ${s.price} $` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <div className="grid grid-cols-2 gap-4 mt-6 border-t pt-4">
                  {/* قسم الدينار */}
                  <div className="bg-blue-50 p-3 rounded shadow-sm">
                    <h3 className="font-bold border-b mb-2 text-blue-800">
                      {t("Account in dinars (IQD)")}
                    </h3>
                    <p className="flex justify-between">
                      <span>{t("subtotal")} :</span>{" "}
                      <span>{subtotalIQD.toLocaleString()}</span>
                    </p>
                    {showDiscount && (
                      <div className="flex justify-between text-red-500">
                        <span> {t("Discounts")} :</span>{" "}
                        <span>{Number(discountTotalIQD).toLocaleString()}</span>
                      </div>
                    )}
                    <p className="flex justify-between">
                      <span>{t("total")} :</span>{" "}
                      <span>{finalIQD.toLocaleString()}</span>
                    </p>
                    <p className="flex justify-between text-emerald-600">
                      <span>{t("received")} :</span>{" "}
                      <span>{Number(receivedIQD).toLocaleString()}</span>
                    </p>
                    <hr className="border-b my-2 border-blue-900" />
                    <p
                      className={`flex justify-between font-bold ${
                        remainingIQD > 0 ? "text-red-600" : "text-blue-700"
                      }`}
                    >
                      <span>{t("remaining")} :</span>{" "}
                      <span>{remainingIQD.toLocaleString()} د.ع</span>
                    </p>
                  </div>

                  {/* قسم الدولار */}
                  <div className="bg-blue-50 p-3 rounded shadow-sm">
                    <h3 className="font-bold border-b mb-2 text-blue-800">
                      {t("Account in dollars (USD)")}
                    </h3>
                    <p className="flex justify-between">
                      <span>{t("subtotal")} :</span>{" "}
                      <span>{subtotalUSD.toLocaleString()}</span>
                    </p>
                    {showDiscount && (
                      <div className="flex justify-between text-red-500">
                        <span> {t("Discounts")} :</span>{" "}
                        <span>{Number(discountTotalUSD).toLocaleString()}</span>
                      </div>
                    )}
                    <p className="flex justify-between">
                      <span>{t("total")} :</span> <span>{finalUSD}</span>
                    </p>
                    <p className="flex justify-between text-emerald-600">
                      <span>{t("received")} :</span>{" "}
                      <span>{Number(receivedUSD).toLocaleString()}</span>
                    </p>
                    <hr className="border-b my-2 border-blue-900" />
                    <p
                      className={`flex justify-between font-bold ${
                        remainingUSD > 0 ? "text-red-600" : "text-blue-700"
                      }`}
                    >
                      <span>{t("remaining")} :</span>{" "}
                      <span>${remainingUSD}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-10">
                  <footer className="text-center">
                    <div className=" pb-0 mb-0 w-full">
                      <p className="text-slate-400 text-sm mb-2">
                        {t(
                          "This document is officially approved by the clinic",
                        )}
                      </p>
                      <div className=" flex justify-center items-center bg-slate-100 p-1 gap-10 text-[10px] text-slate-300 border-t ">
                        <span className="text-amber-950 font-semibold">
                          {t("Address: Erbil - Golan 40 meters")}
                        </span>
                        <span className="text-amber-950 font-semibold">
                          📲 {t("phone")}: 07512030400{" "}
                        </span>
                        <span className="text-amber-950 font-semibold">
                          🦷
                          {t(
                            "Al-Kamaly Clinic for Maxillofacial, Oral Surgery, Dental Implants, and Cosmetic Dentistry",
                          )}
                        </span>
                      </div>
                    </div>
                  </footer>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* ==== Invoice Container ==== */}
      </div>

      {/* Modal Add New Service */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-9998"
          onClick={handleCloseService}
        >
          <div
            className="fixed bg-gray-700 w-lg h-90 rounded-2xl p-3 z-9999"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
            onClick={(e) => e.stopPropagation()} // يمنع الإغلاق عند الضغط داخل المودال
          >
            <div className="flex justify-between">
              <h1 className="text-center text-white font-semibold text-2xl border-b-2 mb-4 pb-4 w-md mx-auto">
                {t("Add a new service")}
              </h1>
              <span
                className="text-gray-500 text-xl font-bold absolute
           ms-5 top-4 bg-white cursor-pointer px-2 rounded"
                onClick={handleCloseService}
              >
                X
              </span>
            </div>

            <div className="flex justify-between items-center p-3">
              <label htmlFor="service" className="text-white text-lg font-bold">
                {t("service name")} :
              </label>
              <input
                type="text"
                id="service"
                className=" w-80 ms-2 border-2 border-amber-50
             outline-0 rounded p-1 text-white text-lg"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
              />
            </div>

            <div className="flex justify-between items-center p-3">
              <label htmlFor="price" className="text-white text-lg font-bold">
                {t("service price")} :
              </label>
              <input
                type="text"
                id="price"
                onWheel={handleWheel} // استدعاء الدالة عند التمرير
                className=" w-80 ms-2 border-2 border-amber-50
               outline-0 rounded p-1 text-white text-lg"
                value={formatNumber(newServicePrice)}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\D/g, "");
                  setNewServicePrice(Number(rawValue));
                }}
              />
            </div>
            <div className="flex justify-start gap-6 items-center p-3">
              <span className="text-white text-md font-bold">
                {t("Select service currency")} :{" "}
              </span>
              <select
                value={newServiceCurrency}
                onChange={(e) => setNewServiceCurrency(e.target.value)}
                className="p-2 border rounded bg-white focus:outline-slate-400"
              >
                <option value="" disabled>
                  {t("Select currency")}
                </option>
                <option value="USD">{t("USA dollar $")} </option>
                <option value="IQD">{t("Iraqi dinar IQD")}</option>
              </select>
            </div>

            <button
              onClick={handleSubmitNewService}
              className="ms-45 mt-3 bg-blue-700 text-white font-bold text-lg cursor-pointer hover:bg-blue-600 transition px-4 py-2 rounded"
            >
              {t("Add service")}
            </button>
          </div>
        </div>
      )}
      {/* ==== Modal Add New Service ==== */}

      {/* Modal Add Note */}
      {showNoteModal && (
        <div
          className="fixed inset-0 bg-black/50 z-9998"
          onClick={handleCloseNote}
        >
          <div
            className="fixed bg-blue-950 w-3xl rounded-2xl p-3 z-9999"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
            onClick={(e) => e.stopPropagation()} // يمنع الإغلاق عند الضغط داخل المودال
          >
            <div className="flex justify-between">
              <h1 className="text-center text-white font-semibold text-2xl border-b-2 mb-4 pb-4 w-md mx-auto">
                {t("Add a note to the invoice")}
              </h1>
              <span
                className="text-pink-600 text-xl font-bold absolute
           left-5 top-4 bg-white cursor-pointer px-2 rounded"
                onClick={handleCloseNote}
              >
                X
              </span>
            </div>
            <div className="flex items-center p-2 gap-2">
              <label className="w-25 font-bold text-white">
                {t("note")} :{" "}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="bg-slate-50 border focus:outline-transparent border-transparent rounded w-full resize-none p-2"
                rows="4"
              ></textarea>
            </div>
            <button
              onClick={handleSubmitNote}
              className="ms-148 mt-3 bg-blue-500 text-white font-bold text-lg cursor-pointer hover:bg-blue-600 transition px-4 py-2 rounded"
            >
              {t("Add note")}
            </button>
          </div>
        </div>
      )}
      {/* ==== Modal Add Note ==== */}

      {/* Toastify Notification */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={true}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      {/* ==== Toastify Notification ==== */}
    </div>
  );
}
