import ReliefIntakeForm from '@/components/intake/ReliefIntakeForm';
import Link from 'next/link';
import { Search, ShieldAlert, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-10 pb-12">
      {/* Main Intake Form */}
      <ReliefIntakeForm />

      {/* Quick Jump to Live Tracker Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Already submitted an emergency request?
            </h3>
            <p className="text-xs text-slate-500">
              Check live verification status, warehouse stock reservation, and convoy dispatch in real time.
            </p>
          </div>
        </div>

        <Link
          href="/track"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors shadow-2xs shrink-0"
        >
          <span>Open Live Status Tracker</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
