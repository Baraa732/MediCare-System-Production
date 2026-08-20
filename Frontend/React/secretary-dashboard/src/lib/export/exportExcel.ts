import ExcelJS from "exceljs";
import {
  EXPORT_COLUMNS,
  buildExportFilename,
  downloadBlob,
  type ScheduleExportMeta,
  type ScheduleExportRow,
} from "./scheduleExportTypes";

const BRAND = "0066FF";
const HEADER_BG = "0F172A";
const ZEBRA = "F8FAFC";
const BORDER = "E2E8F0";

export async function exportScheduleExcel(input: {
  rows: ScheduleExportRow[];
  meta: ScheduleExportMeta;
  dateKey: string;
}): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MediCare Secretary Dashboard";
  workbook.created = new Date();
  workbook.modified = new Date();
  // Strip identifying metadata beyond operational clinic name.
  workbook.company = input.meta.clinicName;
  workbook.title = `Clinic schedule — ${input.meta.scheduleDateLabel}`;
  workbook.description =
    "Operational day sheet. Internal IDs and phone numbers are excluded.";

  const sheet = workbook.addWorksheet("Day schedule", {
    views: [{ state: "frozen", ySplit: 8 }],
    properties: { defaultRowHeight: 18 },
  });

  sheet.mergeCells("A1:H1");
  const title = sheet.getCell("A1");
  title.value = input.meta.clinicName;
  title.font = { name: "Calibri", size: 18, bold: true, color: { argb: `FF${BRAND}` } };
  title.alignment = { vertical: "middle", horizontal: "left" };

  sheet.mergeCells("A2:H2");
  sheet.getCell("A2").value = `Daily schedule · ${input.meta.scheduleDateLabel}`;
  sheet.getCell("A2").font = {
    name: "Calibri",
    size: 12,
    bold: true,
    color: { argb: "FF0F172A" },
  };

  sheet.mergeCells("A3:H3");
  sheet.getCell("A3").value =
    `Generated ${input.meta.generatedAtLabel} · by ${input.meta.exportedBy} · ${input.meta.rowCount} booking(s)`;
  sheet.getCell("A3").font = {
    name: "Calibri",
    size: 10,
    color: { argb: "FF64748B" },
  };

  sheet.mergeCells("A4:H4");
  sheet.getCell("A4").value = `Scope: ${input.meta.filterSummary}`;
  sheet.getCell("A4").font = {
    name: "Calibri",
    size: 10,
    italic: true,
    color: { argb: "FF64748B" },
  };

  sheet.mergeCells("A5:H5");
  sheet.getCell("A5").value =
    "Privacy: patient IDs, doctor IDs, appointment IDs, and phone numbers are not included in this export.";
  sheet.getCell("A5").font = {
    name: "Calibri",
    size: 9,
    color: { argb: "FFB45309" },
  };

  sheet.getRow(1).height = 28;
  sheet.getRow(7).height = 8;

  const headerRowIndex = 8;
  const headerRow = sheet.getRow(headerRowIndex);
  EXPORT_COLUMNS.forEach((col, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = col.header;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${HEADER_BG}` },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: `FF${BORDER}` } },
      left: { style: "thin", color: { argb: `FF${BORDER}` } },
      bottom: { style: "thin", color: { argb: `FF${BORDER}` } },
      right: { style: "thin", color: { argb: `FF${BORDER}` } },
    };
    sheet.getColumn(index + 1).width = col.width;
  });
  headerRow.height = 22;

  input.rows.forEach((row, offset) => {
    const excelRow = sheet.getRow(headerRowIndex + 1 + offset);
    const values = [
      row.rowNumber,
      row.timeRange,
      row.durationMinutes,
      row.patientName,
      row.doctorName,
      row.specialty,
      row.status,
      row.reason,
    ];
    values.forEach((value, index) => {
      const cell = excelRow.getCell(index + 1);
      cell.value = value;
      cell.font = { name: "Calibri", size: 10, color: { argb: "FF0F172A" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: index <= 2 ? "center" : "left",
        wrapText: index === 7,
      };
      if (offset % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: `FF${ZEBRA}` },
        };
      }
      cell.border = {
        top: { style: "hair", color: { argb: `FF${BORDER}` } },
        left: { style: "hair", color: { argb: `FF${BORDER}` } },
        bottom: { style: "hair", color: { argb: `FF${BORDER}` } },
        right: { style: "hair", color: { argb: `FF${BORDER}` } },
      };
    });
    excelRow.height = 20;
  });

  if (input.rows.length === 0) {
    sheet.mergeCells("A9:H9");
    sheet.getCell("A9").value = "No bookings match the current filters for this day.";
    sheet.getCell("A9").font = {
      name: "Calibri",
      size: 11,
      italic: true,
      color: { argb: "FF64748B" },
    };
  }

  const footerRow = headerRowIndex + Math.max(input.rows.length, 1) + 2;
  sheet.mergeCells(`A${footerRow}:H${footerRow}`);
  sheet.getCell(`A${footerRow}`).value =
    "MediCare · Confidential clinic operations · For authorized staff only";
  sheet.getCell(`A${footerRow}`).font = {
    name: "Calibri",
    size: 9,
    color: { argb: "FF94A3B8" },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, buildExportFilename("xlsx", input.dateKey));
}
