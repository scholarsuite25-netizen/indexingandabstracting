"use client";

import React from "react";
import QRCode from "react-qr-code";
import { Badge } from "@/components/ui";

export function CertificateView({
  certificate,
}: {
  certificate: {
    number: string;
    issuedAt: string;
    courseCode: string;
    courseTitle: string;
    studentName: string;
    studentInstitution?: string;
  };
}) {
  const verifyUrl = typeof window !== "undefined" ? `${window.location.origin}/verify/${certificate.number}` : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end no-print">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-strong"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="relative overflow-hidden rounded-2xl border-4 border-primary bg-surface p-10 text-center shadow-lg sm:p-16 print:border-4 print:border-primary print:shadow-none print:m-0 print:rounded-none">
        <div className="absolute top-0 left-0 h-32 w-32 -translate-x-16 -translate-y-16 rounded-full bg-primary-soft opacity-50" />
        <div className="absolute bottom-0 right-0 h-48 w-48 translate-x-16 translate-y-16 rounded-full bg-info-soft opacity-50" />
        
        <div className="relative z-10 flex flex-col items-center gap-6">
          <h2 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl uppercase tracking-widest text-primary-strong">
            Certificate of Completion
          </h2>
          
          <p className="mt-4 text-lg text-ink-muted uppercase tracking-widest">
            This is to certify that
          </p>
          
          <div className="border-b-2 border-ink pb-2 min-w-[300px]">
            <p className="font-display text-3xl font-bold text-ink italic">
              {certificate.studentName}
            </p>
          </div>
          
          {certificate.studentInstitution && (
            <p className="text-sm font-medium text-ink-subtle uppercase">
              {certificate.studentInstitution}
            </p>
          )}

          <p className="mt-4 text-lg text-ink-muted max-w-lg">
            has successfully completed the requirements for the course
          </p>

          <div className="flex flex-col items-center gap-2">
            <Badge variant="info" className="text-base px-4 py-1">{certificate.courseCode}</Badge>
            <h3 className="font-display text-2xl font-bold text-ink">
              {certificate.courseTitle}
            </h3>
          </div>

          <div className="mt-12 flex w-full flex-col items-center justify-between gap-8 sm:flex-row sm:items-end">
            <div className="flex flex-col text-left">
              <span className="text-xs text-ink-subtle uppercase tracking-wider">Date of Issue</span>
              <span className="font-medium text-ink">
                {new Date(certificate.issuedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="bg-white p-2 border border-border">
                <QRCode value={verifyUrl} size={80} level="M" />
              </div>
              <span className="text-[10px] text-ink-subtle">Scan to verify</span>
            </div>
            
            <div className="flex flex-col text-right">
              <span className="text-xs text-ink-subtle uppercase tracking-wider">Certificate ID</span>
              <span className="font-mono text-sm font-medium text-ink">{certificate.number}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
