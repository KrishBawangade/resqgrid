'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Copy, Check, ArrowRight, ShieldCheck, Clock, ExternalLink } from 'lucide-react';
import { ReliefRequest } from '@/lib/types';

interface Props {
  request: ReliefRequest | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function SubmissionSuccessModal({ request, isOpen, onClose }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !request) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(request.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTrack = () => {
    onClose();
    router.push(`/track?id=${encodeURIComponent(request.id)}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative">
        {/* Success Icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-5">
          <CheckCircle2 className="h-8 w-8" />
        </div>

        <div className="text-center">
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">
            Relief Request Registered!
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Your request has been broadcasted to the ResQGrid Coordinator Command Center and queued for depot allocation.
          </p>
        </div>

        {/* Request ID Highlight Box */}
        <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Your Tracking ID
          </div>
          <div className="flex items-center justify-center gap-3">
            <span className="text-2xl font-extrabold tracking-tight text-blue-600 font-mono">
              {request.id}
            </span>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
              title="Copy Request ID"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Summary Details */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs bg-slate-50/80 p-3 rounded-lg border border-slate-100">
          <div>
            <span className="text-slate-500 block">Demanded:</span>
            <span className="font-semibold text-slate-800 capitalize truncate block">
              {request.requestedResources && request.requestedResources.length > 0
                ? request.requestedResources.map((r) => `${r.requestedQty} ${r.resourceType.replace('_', ' ')}`).join(', ')
                : `${request.requestedQty} ${request.resourceType.replace('_', ' ')}`}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Location:</span>
            <span className="font-semibold text-slate-800 truncate block">
              {request.location.zoneName}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Initial Priority Score:</span>
            <span className="font-bold text-blue-600">
              {request.priorityScore} / 100
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">People Affected:</span>
            <span className="font-semibold text-slate-800">
              {request.peopleAffected} persons
            </span>
          </div>
        </div>

        {/* Notice on Command Queue */}
        <div className="mt-4 flex items-start gap-2.5 p-3 rounded-lg bg-blue-50/60 border border-blue-100 text-xs text-blue-900">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p>
            Emergency coordinators prioritize and allocate warehouse stock according to verified urgency, vulnerability, and road accessibility.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleTrack}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors shadow-xs"
          >
            <span>Track this Request Live</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-100 transition-colors"
          >
            Submit Another Request
          </button>
        </div>
      </div>
    </div>
  );
}
