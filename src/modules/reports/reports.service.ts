// src/modules/reports/reports.service.ts
import prisma from '../../lib/prisma.js';
import { ReportType, ReportStatus } from '../../generated/prisma/enums.js';

interface CreateReportInput {
  type: ReportType;
  userId: number | string;
  category: string;
  brand?: string;
  model?: string;
  color?: string;
  uniqueIdentifier?: string;
  description: string;
  locationText: string;
  latitude?: number;
  longitude?: number;
  dateTime: Date;
}

export async function createReport(input: CreateReportInput) {
  const data: any = {
    type: input.type,
    user: {
      connect: { id: Number(input.userId) }
    },
    category: input.category,
    brand: input.brand || null,
    model: input.model || null,
    color: input.color || null,
    uniqueIdentifier: input.uniqueIdentifier || null,
    description: input.description,
    locationText: input.locationText,
    dateLostFound: input.dateTime,
    status: ReportStatus.OPEN,
  };

  if (input.latitude && !isNaN(input.latitude)) {
    data.latitude = Number(input.latitude);
  }

  if (input.longitude && !isNaN(input.longitude)) {
    data.longitude = Number(input.longitude);
  }

  const report = await prisma.report.create({ data });

  return report;
}

export async function getUserReports(userId: number | string) {
  return prisma.report.findMany({
    where: { userId: Number(userId) },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getOpenReports() {
  return prisma.report.findMany({
    where: { status: ReportStatus.OPEN },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      category: true,
      brand: true,
      model: true,
      color: true,
      description: true,
      locationText: true,
      dateLostFound: true,
      status: true,
      createdAt: true,
    },
  });
}

export async function getReportById(id: string) {
  return prisma.report.findUnique({ where: { id } });
}
