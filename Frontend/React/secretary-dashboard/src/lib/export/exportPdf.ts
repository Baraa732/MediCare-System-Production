import type { Content, TDocumentDefinitions, TableCell } from "pdfmake/interfaces";
import { containsArabic } from "./bidiText";
import {
  EXPORT_COLUMNS,
  buildExportFilename,
  type ScheduleExportMeta,
  type ScheduleExportRow,
} from "./scheduleExportTypes";

type PdfMakeModule = typeof import("pdfmake/build/pdfmake");

let pdfMakeReady: Promise<PdfMakeModule> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function loadFontAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not load export font (${res.status})`);
  }
  return arrayBufferToBase64(await res.arrayBuffer());
}

async function loadPdfMake(): Promise<PdfMakeModule> {
  if (!pdfMakeReady) {
    pdfMakeReady = (async () => {
      const pdfMakeMod = await import("pdfmake/build/pdfmake");
      const pdfFontsMod = await import("pdfmake/build/vfs_fonts");
      const pdfMake = pdfMakeMod.default ?? pdfMakeMod;
      const fonts = (pdfFontsMod as { default?: unknown }).default ?? pdfFontsMod;

      const [regular, bold] = await Promise.all([
        loadFontAsBase64(`${import.meta.env.BASE_URL}fonts/DejaVuSans.ttf`),
        loadFontAsBase64(`${import.meta.env.BASE_URL}fonts/DejaVuSans-Bold.ttf`),
      ]);

      if (typeof pdfMake.addVirtualFileSystem === "function") {
        pdfMake.addVirtualFileSystem({
          ...(fonts as Record<string, string>),
          "DejaVuSans.ttf": regular,
          "DejaVuSans-Bold.ttf": bold,
        } as never);
      }
      pdfMake.addFonts({
        Roboto: {
          normal: "Roboto-Regular.ttf",
          bold: "Roboto-Medium.ttf",
          italics: "Roboto-Italic.ttf",
          bolditalics: "Roboto-MediumItalic.ttf",
        },
        DejaVu: {
          normal: "DejaVuSans.ttf",
          bold: "DejaVuSans-Bold.ttf",
          italics: "DejaVuSans.ttf",
          bolditalics: "DejaVuSans-Bold.ttf",
        },
      });
      return pdfMake;
    })();
  }
  return pdfMakeReady;
}

const STATUS_FILL: Record<string, string> = {
  Confirmed: "#DBEAFE",
  "Done / Checked-in": "#D1FAE5",
  "In progress": "#E0E7FF",
  Late: "#FEF3C7",
  Pending: "#FFEDD5",
  "No-show": "#FEE2E2",
  Cancelled: "#F1F5F9",
  Unavailable: "#F1F5F9",
};

type CellExtras = {
  alignment?: "left" | "right" | "center";
  fillColor?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  margin?: number[];
};

function bilingualText(value: string, extras: CellExtras = {}): TableCell {
  const text = value?.trim() || "—";
  const rtl = containsArabic(text);
  return {
    text,
    alignment: extras.alignment ?? (rtl ? "right" : "left"),
    fillColor: extras.fillColor,
    fontSize: extras.fontSize,
    color: extras.color,
    bold: extras.bold,
    margin: extras.margin as never,
  };
}

function statusCell(status: string): TableCell {
  return {
    text: status,
    fillColor: STATUS_FILL[status] ?? "#F8FAFC",
    alignment: "center",
    margin: [2, 4, 2, 4],
    fontSize: 8,
    bold: true,
    color: "#0F172A",
  };
}

function buildTableBody(rows: ScheduleExportRow[]): TableCell[][] {
  const header: TableCell[] = EXPORT_COLUMNS.map((col) => ({
    text: col.header,
    style: "tableHeader",
    alignment: "center",
  }));

  if (rows.length === 0) {
    return [
      header,
      [
        {
          text: "No bookings match the current filters for this day.",
          colSpan: EXPORT_COLUMNS.length,
          alignment: "center",
          italics: true,
          color: "#64748B",
          margin: [0, 12, 0, 12],
        },
        {},
        {},
        {},
        {},
        {},
        {},
        {},
      ],
    ];
  }

  const body: TableCell[][] = [header];
  for (const row of rows) {
    const zebra = row.rowNumber % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
    body.push([
      bilingualText(String(row.rowNumber), {
        alignment: "center",
        fillColor: zebra,
        fontSize: 8,
      }),
      bilingualText(row.timeRange, {
        alignment: "center",
        fillColor: zebra,
        fontSize: 8,
      }),
      bilingualText(String(row.durationMinutes), {
        alignment: "center",
        fillColor: zebra,
        fontSize: 8,
      }),
      bilingualText(row.patientName, { fillColor: zebra, fontSize: 8 }),
      bilingualText(row.doctorName, { fillColor: zebra, fontSize: 8 }),
      bilingualText(row.specialty, { fillColor: zebra, fontSize: 8 }),
      statusCell(row.status),
      bilingualText(row.reason, { fillColor: zebra, fontSize: 8, color: "#475569" }),
    ]);
  }
  return body;
}

function buildDocDefinition(
  rows: ScheduleExportRow[],
  meta: ScheduleExportMeta,
): TDocumentDefinitions {
  const clinicRtl = containsArabic(meta.clinicName);
  const headerBlock: Content = {
    columns: [
      {
        width: "*",
        stack: [
          {
            text: meta.clinicName,
            style: "brand",
            alignment: clinicRtl ? "right" : "left",
            margin: [0, 0, 0, 2],
          },
          {
            text: "Daily clinic schedule",
            style: "subtitle",
          },
        ],
      },
      {
        width: "auto",
        alignment: "right",
        stack: [
          { text: meta.scheduleDateLabel, style: "dateBadge" },
          {
            text: `${meta.rowCount} booking${meta.rowCount === 1 ? "" : "s"}`,
            style: "metaMuted",
            margin: [0, 4, 0, 0],
          },
        ],
      },
    ],
    margin: [0, 0, 0, 12],
  };

  const metaLine: Content = {
    columns: [
      {
        text: `Generated ${meta.generatedAtLabel} · by ${meta.exportedBy}`,
        style: "metaMuted",
      },
      {
        text: `Scope: ${meta.filterSummary}`,
        style: "metaMuted",
        alignment: "right",
      },
    ],
    margin: [0, 0, 0, 10],
  };

  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [28, 48, 28, 40],
    info: {
      title: `${meta.clinicName} — schedule ${meta.scheduleDateLabel}`,
      author: meta.exportedBy,
      subject: "Clinic day sheet",
      creator: "MediCare Secretary Dashboard",
      keywords: "schedule,clinic,operations",
    },
    header: (currentPage, pageCount) => ({
      margin: [28, 14, 28, 0],
      columns: [
        {
          text: "MediCare · Clinic schedule",
          fontSize: 8,
          color: "#94A3B8",
        },
        {
          text: `Page ${currentPage} of ${pageCount}`,
          alignment: "right",
          fontSize: 8,
          color: "#94A3B8",
        },
      ],
    }),
    footer: () => ({
      margin: [28, 0, 28, 16],
      columns: [
        {
          text: "Authorized staff only · Do not redistribute outside the clinic",
          fontSize: 7,
          color: "#94A3B8",
        },
        {
          text: meta.clinicName,
          alignment: "right",
          fontSize: 7,
          color: "#94A3B8",
        },
      ],
    }),
    content: [
      headerBlock,
      metaLine,
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [22, 90, 48, "*", "*", 70, 78, "*"],
          body: buildTableBody(rows),
        },
        layout: {
          hLineWidth: (i, node) =>
            i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.4,
          vLineWidth: () => 0.4,
          hLineColor: () => "#E2E8F0",
          vLineColor: () => "#E2E8F0",
          fillColor: (rowIndex) => (rowIndex === 0 ? "#0F172A" : null),
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
    ],
    styles: {
      brand: {
        fontSize: 18,
        bold: true,
        color: "#0066FF",
      },
      subtitle: {
        fontSize: 10,
        color: "#64748B",
      },
      dateBadge: {
        fontSize: 12,
        bold: true,
        color: "#0F172A",
      },
      metaMuted: {
        fontSize: 8,
        color: "#64748B",
      },
      tableHeader: {
        bold: true,
        fontSize: 8,
        color: "#FFFFFF",
        fillColor: "#0F172A",
        margin: [0, 4, 0, 4],
      },
    },
    defaultStyle: {
      font: "DejaVu",
      fontSize: 9,
      color: "#0F172A",
    },
  };
}

export type PdfExportMode = "download" | "print" | "open";

export async function exportSchedulePdf(input: {
  rows: ScheduleExportRow[];
  meta: ScheduleExportMeta;
  dateKey: string;
  mode?: PdfExportMode;
}): Promise<void> {
  const pdfMake = await loadPdfMake();
  const doc = buildDocDefinition(input.rows, input.meta);
  const created = pdfMake.createPdf(doc);
  const mode = input.mode ?? "download";
  const filename = buildExportFilename("pdf", input.dateKey);

  if (mode === "print") {
    await created.print();
    return;
  }
  if (mode === "open") {
    await created.open();
    return;
  }
  await created.download(filename);
}
