// ==========================================================================
// DentalInvoice.jsx
// Rewritten with: safe-number handling (no more NaN), input validation,
// small focused helper functions, useCallback for stable handlers,
// clearer state grouping, and defensive checks around external libs
// (html-to-image / jsPDF) so a failure never crashes the UI.
// ==========================================================================

// React Hooks
import { useState, useRef, useMemo, useCallback } from "react";
import { useReactToPrint } from "react-to-print";

// Print & PDF
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

// Logo
import alkamalyLogo from "../public/images/AL-Kamaly_Logo_Header.png";

// Toast Notification
import { ToastContainer } from "react-toastify";
import notify from "./ToastifyNotification";

// Translator
import { useTranslation } from "react-i18next";

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------
const MAX_DISCOUNT_PERCENT = 20;
const CURRENCY = { IQD: "IQD", USD: "USD" };

const DOCTORS = [
  "Dr.Ayman AL-Kamaly",
  "Dr.Omar AL-Kamaly",
  "Dr.Riyadh AL-Kamaly",
  "Dr.Seima Abdel-Samad",
];

const DEFAULT_SERVICES = [
  {
    id: 1,
    name: "RCT 'Root Canal treatment'",
    price: 230000,
    currency: CURRENCY.IQD,
  },
  {
    id: 2,
    name: "Posterior tooth filling",
    price: 90000,
    currency: CURRENCY.IQD,
  },
  {
    id: 3,
    name: "Anterior esthetic filling",
    price: 150000,
    currency: CURRENCY.IQD,
  },
  { id: 4, name: "Zirconium crown", price: 230000, currency: CURRENCY.IQD },
  {
    id: 5,
    name: "Teeth cleaning and polishing",
    price: 75000,
    currency: CURRENCY.IQD,
  },
  { id: 6, name: "Post and core", price: 125000, currency: CURRENCY.IQD },
  {
    id: 7,
    name: "Simple tooth extraction",
    price: 40000,
    currency: CURRENCY.IQD,
  },
  {
    id: 8,
    name: "Root Canal Treatment",
    price: 140000,
    currency: CURRENCY.IQD,
  },
  {
    id: 9,
    name: "Root Canal Retreatment",
    price: 220000,
    currency: CURRENCY.IQD,
  },
  { id: 10, name: "Teeth cultivation", price: 440, currency: CURRENCY.USD },
  {
    id: 11,
    name: "Teeth whitening 'German'",
    price: 220,
    currency: CURRENCY.USD,
  },
  { id: 12, name: "Teeth whitening 'USA'", price: 175, currency: CURRENCY.USD },
  {
    id: 13,
    name: "Surgical tooth extraction",
    price: 150,
    currency: CURRENCY.USD,
  },
  { id: 14, name: "E-MAX crown_veneer", price: 240, currency: CURRENCY.USD },
  { id: 15, name: "Orthodontics", price: 800, currency: CURRENCY.USD },
  {
    id: 16,
    name: "Temporary E-MAX Crown-Veneer Placement",
    price: 10,
    currency: CURRENCY.USD,
  },
];

// --------------------------------------------------------------------------
// Pure helpers (kept outside the component so they don't get re-created
// on every render and are easy to unit-test in isolation)
// --------------------------------------------------------------------------

/** Converts any value to a finite number, falling back to 0 instead of NaN. */
const safeNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Strips everything but digits from a raw input string. */
const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

/** Formats a number with thousands separators, tolerant of empty input. */
const formatNumber = (value) => {
  const n = safeNumber(value);
  if (!n) return "";
  return n.toLocaleString("en-US");
};

/** Clamps a percentage value between 0 and MAX_DISCOUNT_PERCENT. */
const clampPercent = (value) => {
  const n = safeNumber(value);
  return Math.min(Math.max(n, 0), MAX_DISCOUNT_PERCENT);
};

/** Generates a short, human-friendly invoice reference. */
const generateInvoiceRef = () =>
  Math.random().toString(36).slice(2, 11).toUpperCase();

/** Formats today's date as D/M/YYYY. */
const formatDate = (date) =>
  `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

export default function DentalInvoice() {
  // ---- Translation -------------------------------------------------------
  const { i18n, t } = useTranslation();
  const [pageDirection, setPageDirection] = useState(
    i18n.language === "ar" ? "rtl" : "ltr",
  );

  const handleLanguageChange = useCallback(
    (e) => {
      const selectedLanguage = e.target.value;
      const dir = selectedLanguage === "ar" ? "rtl" : "ltr";

      i18n.changeLanguage(selectedLanguage);
      setPageDirection(dir);
      document.documentElement.dir = dir;
      document.documentElement.lang = selectedLanguage;
    },
    [i18n],
  );

  // ---- Core invoice state -------------------------------------------------
  const [patientName, setPatientName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);
  const [services, setServices] = useState(DEFAULT_SERVICES);

  // ---- UI state ------------------------------------------------------------
  const [showDiscount, setShowDiscount] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // ---- Note state ----------------------------------------------------------
  const [note, setNote] = useState("");
  const [displayedNote, setDisplayedNote] = useState("");

  // ---- Discount & received amounts (IQD) ------------------------------------
  const [discountIQD, setDiscountIQD] = useState(0);
  const [percentDiscountIQD, setPercentDiscountIQD] = useState(0);
  const [receivedIQD, setReceivedIQD] = useState(0);

  // ---- Discount & received amounts (USD) ------------------------------------
  const [discountUSD, setDiscountUSD] = useState(0);
  const [percentDiscountUSD, setPercentDiscountUSD] = useState(0);
  const [receivedUSD, setReceivedUSD] = useState(0);

  // ---- Add-service modal fields ----------------------------------------------
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceCurrency, setNewServiceCurrency] = useState("");

  // Translate service names without mutating the original data.
  const translatedServices = useMemo(
    () =>
      services.map((service) => ({
        ...service,
        displayName: t(service.name),
      })),
    [services, t, i18n.language],
  );

  // Group IQD services first, then USD, alphabetised within each group.
  const sortedServices = useMemo(
    () =>
      [...translatedServices].sort((a, b) => {
        if (a.currency === b.currency) {
          return a.displayName.localeCompare(b.displayName);
        }
        return a.currency === CURRENCY.IQD ? -1 : 1;
      }),
    [translatedServices],
  );

  const contentRef = useRef(null);

  // Stable per-mount invoice reference and date.
  const [invoiceRef] = useState(generateInvoiceRef);
  const [dateStr] = useState(() => formatDate(new Date()));

  // ---------------------------------------------------------------------
  // Derived totals — every input funneled through safeNumber so a stray
  // empty string, "-", or partially typed value can never propagate NaN.
  // ---------------------------------------------------------------------
  const iqdServices = useMemo(
    () => selectedServices.filter((s) => s.currency === CURRENCY.IQD),
    [selectedServices],
  );
  const usdServices = useMemo(
    () => selectedServices.filter((s) => s.currency === CURRENCY.USD),
    [selectedServices],
  );

  const sumLineItems = (list) =>
    list.reduce((acc, curr) => {
      const price = safeNumber(curr.customPrice ?? curr.price);
      const qty = safeNumber(curr.quantity) || 1;
      return acc + price * qty;
    }, 0);

  const subtotalIQD = useMemo(() => sumLineItems(iqdServices), [iqdServices]);
  const subtotalUSD = useMemo(() => sumLineItems(usdServices), [usdServices]);

  const discountTotalIQD =
    subtotalIQD * (safeNumber(percentDiscountIQD) / 100) +
    safeNumber(discountIQD);
  const discountTotalUSD =
    subtotalUSD * (safeNumber(percentDiscountUSD) / 100) +
    safeNumber(discountUSD);

  const finalIQD = subtotalIQD - (showDiscount ? discountTotalIQD : 0);
  const finalUSD = subtotalUSD - (showDiscount ? discountTotalUSD : 0);

  const remainingIQD = finalIQD - safeNumber(receivedIQD);
  const remainingUSD = finalUSD - safeNumber(receivedUSD);

  // ---------------------------------------------------------------------
  // Print
  // ---------------------------------------------------------------------
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `${t("invoice")}-${patientName || t("Patient")}`,
    onPrintError: () =>
      notify(`${t("There was a problem loading the PDF")}`, "error"),
  });

  // ---------------------------------------------------------------------
  // Download PDF — wrapped so any failure in the imaging/PDF pipeline
  // surfaces a toast instead of an unhandled rejection, and the button
  // is disabled while the export is in flight to prevent double-clicks.
  // ---------------------------------------------------------------------
  const handleDownloadPDF = useCallback(async () => {
    if (!contentRef.current || isExportingPdf) return;

    setIsExportingPdf(true);
    try {
      const dataUrl = await toPng(contentRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(dataUrl);

      if (!imgProps?.width || !imgProps?.height) {
        throw new Error("Invalid image properties returned by jsPDF");
      }

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      const SCALE_THRESHOLD = 1.1; // allow ~10% overflow before paginating

      if (imgHeight <= pdfHeight * SCALE_THRESHOLD) {
        // Single page: scale to fit and center.
        const scale = pdfHeight / imgHeight;
        const finalHeight = imgHeight * scale;
        const finalWidth = imgWidth * scale;
        const x = (pdfWidth - finalWidth) / 2;
        const y = (pdfHeight - finalHeight) / 2;
        pdf.addImage(dataUrl, "PNG", x, y, finalWidth, finalHeight);
      } else {
        // Multi-page: tile the image downward.
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

      pdf.save(`${t("invoice")}-${patientName || t("Patient")}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      notify(`${t("There was a problem loading the PDF")}`, "error");
    } finally {
      setIsExportingPdf(false);
    }
  }, [isExportingPdf, patientName, t]);

  // ---------------------------------------------------------------------
  // Service selection
  // ---------------------------------------------------------------------
  const toggleService = useCallback((service) => {
    setSelectedServices((prev) =>
      prev.some((s) => s.id === service.id)
        ? prev.filter((s) => s.id !== service.id)
        : [...prev, { ...service, quantity: 1, customPrice: service.price }],
    );
  }, []);

  const updateServiceQuantity = useCallback((serviceId, rawQuantity) => {
    const quantity = Math.max(1, safeNumber(rawQuantity) || 1);
    setSelectedServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, quantity } : s)),
    );
  }, []);

  const updateServicePrice = useCallback(
    (serviceId, rawPrice, fallbackPrice) => {
      const customPrice = Math.max(1, safeNumber(rawPrice) || fallbackPrice);
      setSelectedServices((prev) =>
        prev.map((s) => (s.id === serviceId ? { ...s, customPrice } : s)),
      );
    },
    [],
  );

  // ---------------------------------------------------------------------
  // Add-service modal
  // ---------------------------------------------------------------------
  const handleAddService = useCallback(() => setShowModal(true), []);

  const resetNewServiceForm = useCallback(() => {
    setNewServiceName("");
    setNewServicePrice("");
    setNewServiceCurrency("");
  }, []);

  const handleCloseService = useCallback(() => {
    setShowModal(false);
    resetNewServiceForm();
  }, [resetNewServiceForm]);

  const getNextId = useCallback(
    () => (services.length ? Math.max(...services.map((s) => s.id)) + 1 : 1),
    [services],
  );

  const handleSubmitNewService = useCallback(() => {
    const name = newServiceName.trim();
    const price = safeNumber(newServicePrice);
    const currency = newServiceCurrency;

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
    if (!currency) {
      notify(`${t("Please select the service currency")}`, "warn");
      return;
    }
    const isDuplicate = services.some(
      (s) => s.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (isDuplicate) {
      notify(`${t("This service already exists")}`, "warn");
      return;
    }

    const newService = { id: getNextId(), name, price, currency };

    // Persist to the catalogue so it shows up in the checklist too.
    setServices((prev) => [...prev, newService]);
    setSelectedServices((prev) => [
      ...prev,
      { ...newService, quantity: 1, customPrice: price },
    ]);

    notify(`${t("Service successfully added")}`, "success");
    resetNewServiceForm();
    setShowModal(false);
  }, [
    getNextId,
    newServiceCurrency,
    newServiceName,
    newServicePrice,
    resetNewServiceForm,
    services,
    t,
  ]);

  // ---------------------------------------------------------------------
  // Add-note modal
  // ---------------------------------------------------------------------
  const handleAddNote = useCallback(() => setShowNoteModal(true), []);

  const handleCloseNote = useCallback(() => {
    setShowNoteModal(false);
    setNote("");
  }, []);

  const handleSubmitNote = useCallback(() => {
    const trimmed = note.trim();
    if (!trimmed) {
      notify(`${t("Please fill in the comment field first")}`, "warn");
      return;
    }
    setDisplayedNote(trimmed);
    setShowNoteModal(false);
    notify(`${t("Note successfully added")}`, "success");
  }, [note, t]);

  // ---------------------------------------------------------------------
  // Discount / received-amount handlers
  // Each is guarded against non-numeric input and clamped to sane bounds.
  // ---------------------------------------------------------------------
  const handleDiscountAmountChange = useCallback(
    (rawValue, subtotal, setDiscount) => {
      const value = safeNumber(digitsOnly(rawValue));

      if (subtotal === 0 && value > 0) {
        notify(
          `${t(
            "Please add services to the bill first before attempting to make a deduction",
          )}`,
          "warn",
        );
        setDiscount(0);
        return;
      }

      const maxAllowedDiscount = subtotal * (MAX_DISCOUNT_PERCENT / 100);
      if (value > maxAllowedDiscount) {
        setDiscount(maxAllowedDiscount);
        notify(
          `${t("Sorry, the maximum discount is 20%")} => ${formatNumber(maxAllowedDiscount)}`,
          "warn",
        );
      } else {
        setDiscount(value);
      }
    },
    [t],
  );

  const handleDiscountPercentChange = useCallback(
    (rawValue, subtotal, setPercent) => {
      const value = safeNumber(rawValue);

      if (subtotal === 0 && value > 0) {
        notify(
          `${t(
            "Please add services to the bill first before attempting to make a deduction",
          )}`,
          "warn",
        );
        setPercent(0);
        return;
      }

      const clamped = clampPercent(value);
      if (value > MAX_DISCOUNT_PERCENT) {
        notify(`${t("Sorry, the maximum discount is 20%")}`, "warn");
      }
      setPercent(clamped);
    },
    [t],
  );

  const handleReceivedChange = useCallback((rawValue, setReceived) => {
    setReceived(safeNumber(digitsOnly(rawValue)));
  }, []);

  // Prevents the mouse wheel from silently changing a focused number input.
  const handleWheel = useCallback((e) => e.target.blur(), []);

  return (
    <div className="relative p-4 md:p-10 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ==================== Dashboard ==================== */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-md border border-slate-400 print:hidden h-fit">
          <h2 className="text-xl font-bold mb-2 text-blue-900 border-b pb-2">
            {t("DashBoard")}
          </h2>

          <div className="mb-2">
            <label
              className="text-gray-700 font-bold"
              htmlFor="language-select"
            >
              {t("Select language")} :{" "}
            </label>
            <select
              id="language-select"
              className="p-1 cursor-pointer focus:outline-gray-400 border border-gray-700 rounded"
              onChange={handleLanguageChange}
              value={i18n.language}
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
              {DOCTORS.map((doctor) => (
                <option key={doctor} value={doctor}>
                  {t(doctor)}
                </option>
              ))}
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
                      s.currency === CURRENCY.USD
                        ? "text-blue-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {s.price.toLocaleString()}{" "}
                    {s.currency === CURRENCY.USD ? "$" : t("IQD")}
                  </span>
                </label>
              ))}
              {sortedServices.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-2">
                  {t("No services available")}
                </p>
              )}
            </div>

            <div className="add-service">
              <button
                type="button"
                onClick={handleAddService}
                className="w-full bg-gray-600 text-white py-2 rounded-lg font-bold hover:bg-gray-700 transition cursor-pointer"
              >
                {t("Add a service")}
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddNote}
              className="w-full bg-amber-600 text-white py-2 rounded-lg font-bold hover:bg-amber-700 transition cursor-pointer"
            >
              {t("Add a Note")}
            </button>

            {/* ---- Discount & received amount (IQD) ---- */}
            <div className="p-3 bg-lime-200 rounded-lg space-y-3">
              <p className="font-semibold text-lg text-blue-900">
                {t("Discount and amount received (IQD dinar)")}:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  onWheel={handleWheel}
                  placeholder={t("Discount in dinars")}
                  className="p-2 border-red-400 rounded text-sm focus:outline-red-400 border-2 font-bold"
                  style={{
                    cursor: showDiscount ? "text" : "not-allowed",
                    backgroundColor: showDiscount ? "white" : "#d5d5d5",
                    color: showDiscount ? "red" : "gray",
                    borderColor: showDiscount ? "#ff6467" : "transparent",
                  }}
                  disabled={!showDiscount}
                  value={formatNumber(discountIQD)}
                  onChange={(e) =>
                    handleDiscountAmountChange(
                      e.target.value,
                      subtotalIQD,
                      setDiscountIQD,
                    )
                  }
                />
                <input
                  type="number"
                  min={0}
                  max={MAX_DISCOUNT_PERCENT}
                  step={1}
                  onWheel={handleWheel}
                  className="p-2 border-red-400 rounded text-sm focus:outline-red-400 border-2 font-bold"
                  disabled={!showDiscount}
                  style={{
                    cursor: showDiscount ? "text" : "not-allowed",
                    backgroundColor: showDiscount ? "white" : "#d5d5d5",
                    color: showDiscount ? "red" : "gray",
                    borderColor: showDiscount ? "#ff6467" : "transparent",
                  }}
                  placeholder={t("discount %")}
                  value={percentDiscountIQD}
                  onChange={(e) =>
                    handleDiscountPercentChange(
                      e.target.value,
                      subtotalIQD,
                      setPercentDiscountIQD,
                    )
                  }
                />
              </div>
              <div className="grid grid-cols-1 gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  onWheel={handleWheel}
                  placeholder={t("Amount received IQD")}
                  className="p-2 w-full border rounded text-sm border-green-800 focus:outline-green-800 text-green-800 font-bold bg-emerald-50"
                  value={formatNumber(receivedIQD)}
                  onChange={(e) =>
                    handleReceivedChange(e.target.value, setReceivedIQD)
                  }
                />
              </div>
            </div>

            <hr className="border-b border-blue-900" />

            {/* ---- Discount & received amount (USD) ---- */}
            <div className="p-3 bg-slate-200 rounded-lg space-y-3">
              <p className="font-semibold text-lg text-blue-900">
                {t("Discount and amount received (USD Dollar)")}:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  onWheel={handleWheel}
                  placeholder={t("Discount In Dollars")}
                  className="p-2 border-red-400 rounded text-sm focus:outline-red-400 border-2 font-bold"
                  style={{
                    cursor: showDiscount ? "text" : "not-allowed",
                    backgroundColor: showDiscount ? "white" : "#d5d5d5",
                    color: showDiscount ? "red" : "gray",
                    borderColor: showDiscount ? "#ff6467" : "transparent",
                  }}
                  disabled={!showDiscount}
                  value={formatNumber(discountUSD)}
                  onChange={(e) =>
                    handleDiscountAmountChange(
                      e.target.value,
                      subtotalUSD,
                      setDiscountUSD,
                    )
                  }
                />
                <input
                  type="number"
                  min={0}
                  max={MAX_DISCOUNT_PERCENT}
                  step={1}
                  onWheel={handleWheel}
                  className="p-2 border-red-400 rounded text-sm focus:outline-red-400 border-2 font-bold"
                  disabled={!showDiscount}
                  style={{
                    cursor: showDiscount ? "text" : "not-allowed",
                    backgroundColor: showDiscount ? "white" : "#d5d5d5",
                    color: showDiscount ? "red" : "gray",
                    borderColor: showDiscount ? "#ff6467" : "transparent",
                  }}
                  placeholder={t("discount %")}
                  value={percentDiscountUSD}
                  onChange={(e) =>
                    handleDiscountPercentChange(
                      e.target.value,
                      subtotalUSD,
                      setPercentDiscountUSD,
                    )
                  }
                />
              </div>
              <div className="grid grid-cols-1 gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  onWheel={handleWheel}
                  placeholder={t("Amount received $")}
                  className="p-2 w-full border rounded text-sm border-green-800 focus:outline-green-800 text-green-800 font-bold bg-emerald-50"
                  value={formatNumber(receivedUSD)}
                  onChange={(e) =>
                    handleReceivedChange(e.target.value, setReceivedUSD)
                  }
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => handlePrint()}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition cursor-pointer"
            >
              {t("print")}
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isExportingPdf}
              className="w-full bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-700 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isExportingPdf ? `${t("Download PDF")}...` : t("Download PDF")}
            </button>
            <button
              type="button"
              onClick={() => setShowDiscount((prev) => !prev)}
              className="w-full text-[15px] cursor-pointer text-slate-400 underline"
            >
              {showDiscount ? t("Hide Discount") : t("Show Discount")}
            </button>
          </div>
        </div>
        {/* ==================== /Dashboard ==================== */}

        {/* ==================== Invoice Container ==================== */}
        <div className="lg:col-span-2 flex justify-center" dir={pageDirection}>
          <div
            className="invoice-container relative shadow-2xl bg-white"
            ref={contentRef}
            style={{
              direction: pageDirection,
              textAlign: pageDirection === "rtl" ? "right" : "left",
            }}
          >
            <div className="invoice-box p-[8mm] flex flex-col justify-between h-full min-h-[297mm]">
              <div>
                <header className="relative pb-3 mb-3 border-b-4 border-blue-900">
                  <div className="flex justify-between items-center">
                    <div className="font-mono text-sm text-slate-400">
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

                <table className="w-full table-fixed text-start border-collapse border border-gray-400">
                  <thead>
                    <tr className="bg-blue-900 text-white">
                      <th className="px-2 py-3 border border-gray-300 w-[37%]">
                        {t("Service-Treatment")}
                      </th>
                      <th className="px-2 py-3 border border-gray-300 text-center w-[13%]">
                        {t("Quantity")}
                      </th>
                      <th className="px-2 py-3 border border-gray-300 text-center w-[15%]">
                        {t("Unit Price")}
                      </th>
                      <th className="px-2 py-3 border border-gray-300 text-center w-[17.5%] white-space-nowrap">
                        {t("amount iqd")}
                      </th>
                      <th className="px-2 py-3 border border-gray-300 text-center w-[17.5%]">
                        {t("amount $")}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedServices.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-2 py-6 text-center text-slate-400 border border-gray-300"
                        >
                          {t("No services selected yet")}
                        </td>
                      </tr>
                    )}
                    {selectedServices.map((s) => {
                      const price = safeNumber(s.customPrice ?? s.price);
                      const qty = safeNumber(s.quantity) || 1;
                      const lineTotal = price * qty;

                      return (
                        <tr
                          key={s.id}
                          className="border-b border-slate-100 text-center"
                        >
                          <td className="px-2 py-3 text-lg border font-bold border-gray-300">
                            {t(s.name)}
                          </td>

                          <td className="px-2 py-3 border font-bold border-gray-300 text-center">
                            <input
                              type="number"
                              min="1"
                              value={qty}
                              onChange={(e) =>
                                updateServiceQuantity(s.id, e.target.value)
                              }
                              className="w-16 max-w-full text-center border-none focus:outline-none"
                            />
                          </td>

                          <td className="px-2 py-3 border font-bold border-gray-300 text-center">
                            <input
                              type="number"
                              min="1"
                              value={price}
                              onChange={(e) =>
                                updateServicePrice(
                                  s.id,
                                  e.target.value,
                                  s.price,
                                )
                              }
                              className="w-24 max-w-full text-center text-lg border-none focus:outline-none"
                            />
                          </td>

                          <td className="px-2 py-3 text-lg border font-bold text-center border-gray-300">
                            {s.currency === CURRENCY.IQD
                              ? `${lineTotal.toLocaleString()} ${t("IQD")}`
                              : "-"}
                          </td>

                          <td className="px-2 py-3 text-lg border font-bold text-center border-gray-300">
                            {s.currency === CURRENCY.USD
                              ? `${lineTotal.toLocaleString()} $`
                              : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div>
                <div className="grid grid-cols-2 gap-4 mt-6 border-t pt-4">
                  {/* ---- IQD account summary ---- */}
                  <div className="bg-blue-50 p-3 rounded shadow-sm">
                    <h3 className="font-bold border-b mb-2 text-blue-800">
                      {t("Account in dinars (IQD)")}
                    </h3>
                    <p className="flex justify-between">
                      <span>{t("subtotal")} :</span>
                      <span>{subtotalIQD.toLocaleString()}</span>
                    </p>
                    {showDiscount && (
                      <div className="flex justify-between text-red-500">
                        <span>{t("Discounts")} :</span>
                        <span>{discountTotalIQD.toLocaleString()}</span>
                      </div>
                    )}
                    <p className="flex justify-between">
                      <span>{t("total")} :</span>
                      <span>{finalIQD.toLocaleString()}</span>
                    </p>
                    <p className="flex justify-between text-emerald-600">
                      <span>{t("received")} :</span>
                      <span>{safeNumber(receivedIQD).toLocaleString()}</span>
                    </p>
                    <hr className="border-b my-2 border-blue-900" />
                    <p
                      className={`flex justify-between font-bold ${
                        remainingIQD > 0 ? "text-red-600" : "text-blue-700"
                      }`}
                    >
                      <span>{t("remaining")} :</span>
                      <span>{`${remainingIQD.toLocaleString()} ${t("IQD")}`}</span>
                    </p>
                  </div>

                  {/* ---- USD account summary ---- */}
                  <div className="bg-blue-50 p-3 rounded shadow-sm">
                    <h3 className="font-bold border-b mb-2 text-blue-800">
                      {t("Account in dollars (USD)")}
                    </h3>
                    <p className="flex justify-between">
                      <span>{t("subtotal")} :</span>
                      <span>{subtotalUSD.toLocaleString()}</span>
                    </p>
                    {showDiscount && (
                      <div className="flex justify-between text-red-500">
                        <span>{t("Discounts")} :</span>
                        <span>{discountTotalUSD.toLocaleString()}</span>
                      </div>
                    )}
                    <p className="flex justify-between">
                      <span>{t("total")} :</span>
                      <span>{finalUSD.toLocaleString()}</span>
                    </p>
                    <p className="flex justify-between text-emerald-600">
                      <span>{t("received")} :</span>
                      <span>{safeNumber(receivedUSD).toLocaleString()}</span>
                    </p>
                    <hr className="border-b my-2 border-blue-900" />
                    <p
                      className={`flex justify-between font-bold ${
                        remainingUSD > 0 ? "text-red-600" : "text-blue-700"
                      }`}
                    >
                      <span>{t("remaining")} :</span>
                      <span>{`${remainingUSD.toLocaleString()} $`}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-10">
                  <footer className="text-center">
                    <div className="pb-0 mb-0 w-full">
                      <p className="text-slate-400 text-sm mb-2">
                        {t(
                          "This document is officially approved by the clinic",
                        )}
                      </p>
                      <div className="flex justify-center items-center bg-slate-100 p-1 gap-10 text-[10px] text-slate-300 border-t">
                        <span className="text-amber-950 font-semibold">
                          {t("Address: Erbil - Golan 40 meters")}
                        </span>
                        <span className="text-amber-950 font-semibold">
                          📲 {t("phone")}: 07512030400
                        </span>
                        <span className="text-amber-950 font-semibold">
                          🦷{" "}
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
        {/* ==================== /Invoice Container ==================== */}
      </div>

      {/* ==================== Modal: Add New Service ==================== */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-9998"
          onClick={handleCloseService}
          role="presentation"
        >
          <div
            className="fixed bg-gray-700 w-lg h-90 rounded-2xl p-3 z-9999"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-service-title"
          >
            <div className="flex justify-between">
              <h1
                id="add-service-title"
                className="text-center text-white font-semibold text-2xl border-b-2 mb-4 pb-4 w-md mx-auto"
              >
                {t("Add a new service")}
              </h1>
              <button
                type="button"
                className="text-gray-500 text-xl font-bold absolute ms-5 top-4 bg-white cursor-pointer px-2 rounded"
                onClick={handleCloseService}
                aria-label={t("Close")}
              >
                X
              </button>
            </div>

            <div className="flex justify-between items-center p-3">
              <label htmlFor="service" className="text-white text-lg font-bold">
                {t("service name")} :
              </label>
              <input
                type="text"
                id="service"
                className="w-80 ms-2 border-2 border-amber-50 outline-0 rounded p-1 text-white text-lg"
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
                inputMode="numeric"
                onWheel={handleWheel}
                className="w-80 ms-2 border-2 border-amber-50 outline-0 rounded p-1 text-white text-lg"
                value={formatNumber(newServicePrice)}
                onChange={(e) =>
                  setNewServicePrice(safeNumber(digitsOnly(e.target.value)))
                }
              />
            </div>

            <div className="flex justify-start gap-6 items-center p-3">
              <span className="text-white text-md font-bold">
                {t("Select service currency")} :
              </span>
              <select
                value={newServiceCurrency}
                onChange={(e) => setNewServiceCurrency(e.target.value)}
                className="p-2 border rounded bg-white focus:outline-slate-400"
              >
                <option value="" disabled>
                  {t("Select currency")}
                </option>
                <option value={CURRENCY.USD}>{t("USA dollar $")}</option>
                <option value={CURRENCY.IQD}>{t("Iraqi dinar IQD")}</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleSubmitNewService}
              className="ms-45 mt-3 bg-blue-700 text-white font-bold text-lg cursor-pointer hover:bg-blue-600 transition px-4 py-2 rounded"
            >
              {t("Add service")}
            </button>
          </div>
        </div>
      )}
      {/* ==================== /Modal: Add New Service ==================== */}

      {/* ==================== Modal: Add Note ==================== */}
      {showNoteModal && (
        <div
          className="fixed inset-0 bg-black/50 z-9998"
          onClick={handleCloseNote}
          role="presentation"
        >
          <div
            className="fixed bg-blue-950 w-3xl rounded-2xl p-3 z-9999"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-note-title"
          >
            <div className="flex justify-between">
              <h1
                id="add-note-title"
                className="text-center text-white font-semibold text-2xl border-b-2 mb-4 pb-4 w-md mx-auto"
              >
                {t("Add a note to the invoice")}
              </h1>
              <button
                type="button"
                className="text-pink-600 text-xl font-bold absolute left-5 top-4 bg-white cursor-pointer px-2 rounded"
                onClick={handleCloseNote}
                aria-label={t("Close")}
              >
                X
              </button>
            </div>
            <div className="flex items-center p-2 gap-2">
              <label
                htmlFor="note-textarea"
                className="w-25 font-bold text-white"
              >
                {t("note")} :
              </label>
              <textarea
                id="note-textarea"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="bg-slate-50 border focus:outline-transparent border-transparent rounded w-full resize-none p-2"
                rows="4"
              />
            </div>
            <button
              type="button"
              onClick={handleSubmitNote}
              className="ms-148 mt-3 bg-blue-500 text-white font-bold text-lg cursor-pointer hover:bg-blue-600 transition px-4 py-2 rounded"
            >
              {t("Add note")}
            </button>
          </div>
        </div>
      )}
      {/* ==================== /Modal: Add Note ==================== */}

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
    </div>
  );
}
