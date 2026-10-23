'use client';

import { useState, useMemo } from 'react';
import {
  Droplets,
  Utensils,
  Stethoscope,
  Tent,
  MapPin,
  Users,
  Send,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Eye,
  EyeOff,
  Calculator,
  Check,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import {
  ResourceType,
  UrgencyLevel,
  VulnerabilityFactors,
  ReliefRequest,
} from '@/lib/types';
import { SIMULATED_ZONES } from '@/lib/data/initialScenario';
import { computePriorityScore } from '@/lib/engines/prioritization';
import { useCitizenStore } from '@/lib/store/useCitizenStore';
import SubmissionSuccessModal from './SubmissionSuccessModal';

interface ResourceSelection {
  resourceType: ResourceType;
  selected: boolean;
  qty: number;
}

export default function ReliefIntakeForm() {
  const { submitRequest } = useCitizenStore();

  // Judge / Presentation Mode toggle (reveals 55/20/15/10 breakdown)
  const [showJudgeDemoMode, setShowJudgeDemoMode] = useState(false);

  // Form States
  const [requesterName, setRequesterName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [selectedZoneName, setSelectedZoneName] = useState(SIMULATED_ZONES[0].zoneName);
  const [headcount, setHeadcount] = useState<number>(25);
  const [notes, setNotes] = useState('');

  // Multi-Resource State
  const [selectedResources, setSelectedResources] = useState<Record<ResourceType, { selected: boolean; qty: number }>>({
    drinking_water: { selected: true, qty: 100 },
    food_rations: { selected: false, qty: 50 },
    medical_supplies: { selected: false, qty: 20 },
    shelter_kits: { selected: false, qty: 10 },
  });

  // Submission / AI Triage State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<ReliefRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Active Zone Metadata
  const currentZone = useMemo(
    () => SIMULATED_ZONES.find((z) => z.zoneName === selectedZoneName) || SIMULATED_ZONES[0],
    [selectedZoneName]
  );

  const toggleResource = (res: ResourceType) => {
    setSelectedResources((prev) => {
      const current = prev[res];
      const willSelect = !current.selected;
      // Guarantee at least 1 resource remains selected
      const currentlySelectedCount = Object.values(prev).filter((r) => r.selected).length;
      if (!willSelect && currentlySelectedCount <= 1) {
        return prev;
      }
      return {
        ...prev,
        [res]: { ...current, selected: willSelect },
      };
    });
  };

  const updateQuantity = (res: ResourceType, qty: number) => {
    setSelectedResources((prev) => ({
      ...prev,
      [res]: { ...prev[res], qty: Math.max(1, qty) },
    }));
  };

  const getResourceMeta = (res: ResourceType) => {
    switch (res) {
      case 'drinking_water':
        return { label: 'Drinking Water', unit: 'Liters', icon: Droplets, color: 'blue' };
      case 'medical_supplies':
        return { label: 'Medical Supplies', unit: 'Kits / Packs', icon: Stethoscope, color: 'rose' };
      case 'food_rations':
        return { label: 'Food Rations', unit: 'Meal Packs', icon: Utensils, color: 'amber' };
      case 'shelter_kits':
        return { label: 'Shelter Kits', unit: 'Tents / Cots', icon: Tent, color: 'indigo' };
    }
  };

  // Submit Handler: Sends all data + notes to AI Triage, which determines severity & weights
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const activeList = Object.entries(selectedResources)
      .filter(([_, val]) => val.selected)
      .map(([key, val]) => ({
        resourceType: key as ResourceType,
        requestedQty: val.qty,
        allocatedQty: 0,
        unfulfilledQty: val.qty,
      }));

    if (activeList.length === 0) {
      setErrorMessage('Please select at least one emergency resource.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Call AI Triage API: Evaluates the note, multiple resources, headcount, and sector
      const triageRes = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notes.trim(),
          resources: activeList.map((r) => ({ resourceType: r.resourceType, requestedQty: r.requestedQty })),
          headcount: Number(headcount) || 1,
          zoneName: currentZone.zoneName,
        }),
      });

      if (!triageRes.ok) {
        throw new Error('AI Triage failed to process request');
      }

      const triageData = await triageRes.json();

      const primaryRes = triageData.primaryResourceType || activeList[0].resourceType;
      const urgency: UrgencyLevel = triageData.urgencyLevel || 'moderate';
      const vulnFactors: VulnerabilityFactors = triageData.vulnerability || {
        hasChildren: false,
        hasElderly: false,
        hasInjured: false,
        isClinic: false,
      };

      // 2. Compute 55/20/15/10 deterministic score using AI subjective evaluations
      const scoreBreakdown = computePriorityScore(
        primaryRes,
        urgency,
        vulnFactors,
        Number(headcount) || 1,
        0,
        {
          criticalityScore: triageData.criticalityScore,
          vulnerabilityScore: triageData.vulnerabilityScore,
        }
      );

      // 3. Generate Unique Request ID (REQ-XXXX)
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const newId = `REQ-${randomSuffix}`;

      // Sum total quantity for primary legacy compatibility
      const primaryItem = activeList.find((r) => r.resourceType === primaryRes) || activeList[0];

      const newRequest: ReliefRequest = {
        id: newId,
        timestamp: new Date().toISOString(),
        requesterName: requesterName.trim() || 'Anonymous Resident',
        contactNumber: contactNumber.trim() || 'Unspecified Contact',
        resourceType: primaryRes,
        requestedQty: primaryItem.requestedQty,
        allocatedQty: 0,
        unfulfilledQty: primaryItem.requestedQty,
        requestedResources: activeList,
        location: {
          zoneName: currentZone.zoneName,
          lat: currentZone.lat,
          lng: currentZone.lng,
          isSimulated: true,
          accessibility: currentZone.accessibility,
        },
        peopleAffected: Number(headcount) || 1,
        vulnerability: vulnFactors,
        urgencyLevel: urgency,
        scoreBreakdown,
        priorityScore: scoreBreakdown.totalScore,
        verificationStatus: 'pending',
        requestStatus: 'submitted',
        allocatedDepotId: null,
        notes: notes.trim() || undefined,
        waitingMinutes: 0,
        aiTriageInsight: triageData.aiTriageInsight || undefined,
        aiConfidence: triageData.aiConfidence || undefined,
        aiTriageDetails: {
          criticalityScore: triageData.criticalityScore,
          criticalityReason: triageData.criticalityReason,
          vulnerabilityScore: triageData.vulnerabilityScore,
          vulnerabilityReason: triageData.vulnerabilityReason,
          engineUsed: triageData.engineUsed,
        },
      };

      // 4. Save and open confirmation modal
      submitRequest(newRequest);
      setCreatedRequest(newRequest);
      setIsModalOpen(true);
    } catch (err: unknown) {
      console.error('Submission error:', err);
      setErrorMessage('Failed to submit relief request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Header Banner with Judge / Citizen Mode Toggle */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 mb-3">
              <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
              <span>Official Relief Dispatch Intake</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Register Emergency Relief Request
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Request emergency supplies for your household, community, or local shelter. All requests are prioritized by the 
              <strong> ResQGrid Intelligent Triage Engine</strong> to guarantee fair, rapid stock allocation without bias.
            </p>
          </div>

          {/* Judge / Presentation Mode Toggle */}
          <div className="shrink-0 flex flex-col items-start md:items-end gap-1.5 pt-2 md:pt-0">
            <button
              type="button"
              onClick={() => setShowJudgeDemoMode(!showJudgeDemoMode)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs border ${
                showJudgeDemoMode
                  ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
              title="Toggle to reveal how the underlying 55/20/15/10 formula evaluates requests"
            >
              {showJudgeDemoMode ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>🛠️ Demo Mode: Inspector Active</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>🛠️ Demo Mode: Show Algorithmic Inspector</span>
                </>
              )}
            </button>
            <span className="text-[11px] text-slate-400">
              {showJudgeDemoMode ? 'Revealing live 55/20/15/10 calculation' : 'Anti-Gaming Citizen View'}
            </span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. Main Form Grid */}
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Form Controls (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section A: Requester Details & Sector */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Contact Details & Location</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Your Name / Representative Role
                  </label>
                  <input
                    type="text"
                    required
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    placeholder="e.g. Maria Gomez (Clinic Nurse)"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Contact Phone / Radio Call Sign
                  </label>
                  <input
                    type="text"
                    required
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="e.g. +1 (555) 019-2834"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Disaster Sector (Anchored Coordinates)
                </label>
                <select
                  value={selectedZoneName}
                  onChange={(e) => setSelectedZoneName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-medium text-slate-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden"
                >
                  {SIMULATED_ZONES.map((zone) => (
                    <option key={zone.zoneName} value={zone.zoneName}>
                      {zone.zoneName}
                    </option>
                  ))}
                </select>

                <div className="mt-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs flex items-center justify-between flex-wrap gap-2">
                  <span className="text-slate-600">{currentZone.description}</span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
                      currentZone.accessibility === 'flooded_boat_only'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : currentZone.accessibility === 'debris_delay'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {currentZone.accessibility.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Section B: Multiple Resource Selection */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-600" />
                  <span>Needed Resources (Select all that apply)</span>
                </h3>
                <span className="text-xs text-slate-500">
                  Select multiple items if needed
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {(['drinking_water', 'medical_supplies', 'food_rations', 'shelter_kits'] as ResourceType[]).map(
                  (res) => {
                    const meta = getResourceMeta(res);
                    const Icon = meta.icon;
                    const item = selectedResources[res];

                    return (
                      <div
                        key={res}
                        className={`p-4 rounded-xl border transition-all ${
                          item.selected
                            ? 'border-blue-600 bg-blue-50/40 shadow-xs ring-2 ring-blue-500/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => toggleResource(res)}
                            className="flex items-center gap-3 text-left flex-1"
                          >
                            <div
                              className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                                item.selected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-bold text-sm text-slate-900">{meta.label}</div>
                              <div className="text-[11px] text-slate-500">{meta.unit}</div>
                            </div>
                          </button>

                          {/* Checkbox button */}
                          <button
                            type="button"
                            onClick={() => toggleResource(res)}
                            className={`h-5 w-5 rounded-md flex items-center justify-center transition-colors border ${
                              item.selected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-slate-300 bg-white hover:border-slate-400'
                            }`}
                          >
                            {item.selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>
                        </div>

                        {/* Quantity input when selected */}
                        {item.selected && (
                          <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold text-slate-700">
                              Demanded Quantity:
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                required
                                value={item.qty}
                                onChange={(e) => updateQuantity(res, parseInt(e.target.value) || 1)}
                                className="w-24 rounded-lg border border-slate-300 p-1.5 text-xs font-bold text-slate-900 bg-white text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-100 focus:outline-hidden"
                              />
                              <span className="text-xs text-slate-500 font-medium">{meta.unit}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* Section C: Headcount */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Number of People in Need</span>
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Total Headcount (Persons Affected)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    required
                    value={headcount}
                    onChange={(e) => setHeadcount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-40 rounded-xl border border-slate-300 p-2.5 text-sm font-bold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden"
                  />
                  <span className="text-xs text-slate-500">
                    Individuals currently sheltering or awaiting relief
                  </span>
                </div>
              </div>
            </div>

            {/* Section D: Situation Description & Emergency Notes */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Emergency Situation & Field Notes</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Describe your exact situation. Our AI triage system analyzes your description to evaluate demographic vulnerability (e.g. infants, elderly, injured, clinic) and hazard urgency.
                </p>
              </div>

              <div>
                <textarea
                  required
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Floodwater has entered our clinic ground floor. We have 4 newborn infants and 12 elderly patients with no clean drinking water. Dehydration risk is critical; power is ruined. Road access from south harbor is blocked..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden transition-all shadow-2xs"
                />
              </div>

              {/* Quick Sample Prompts for Fast Hackathon Demo Testing */}
              <div className="pt-1 flex items-center gap-2 flex-wrap text-xs text-slate-500">
                <span className="font-semibold text-slate-600">Sample Situations:</span>
                <button
                  type="button"
                  onClick={() =>
                    setNotes(
                      'Floodwater has entered the ground floor of our community clinic in Sector 4. We have 4 newborn infants and 12 elderly patients with zero drinking water. Clean storage tanks are contaminated and power is out. Need 200 Liters of clean water immediately!'
                    )
                  }
                  className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-slate-700 transition-colors"
                >
                  🏥 Sector 4 Clinic (Infants & Water)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setNotes(
                      'North bridge triage outpost has 30 patients injured by falling storm debris. Multiple active bleeding casualties and deep lacerations. Surgical dressings and emergency medical trauma packs urgently needed.'
                    )
                  }
                  className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-slate-700 transition-colors"
                >
                  🩹 Sector 2 Trauma (Injured Casualties)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setNotes(
                      'East High School evacuation shelter currently housing 180 displaced evacuees including 45 children and 30 seniors. Gymnasium provisions exhausted; need 300 emergency food ration meal packs.'
                    )
                  }
                  className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-slate-700 transition-colors"
                >
                  🍞 Sector 7 Shelter (180 Evacuees)
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Context-Aware Sidebar (Judge Mode vs. Non-Gameable Citizen Assurance Mode) */}
          <div className="lg:col-span-1 space-y-6">
            {showJudgeDemoMode ? (
              /* MODE A: Judge / Demo Algorithmic Inspector */
              <div className="bg-white rounded-2xl p-6 border-2 border-indigo-200/90 shadow-sm sticky top-24 space-y-5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Algorithmic Inspector
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-sm">
                    Judge Mode
                  </span>
                </div>

                <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  <strong>55/20/15/10 Formula Architecture:</strong>
                  <ul className="mt-1.5 space-y-1 list-disc list-inside text-[11px] text-slate-500">
                    <li>55% Need Criticality (Evaluated by LLM from note)</li>
                    <li>20% Vulnerability (Extracted by LLM from note)</li>
                    <li>15% People Headcount (Logarithmically scaled)</li>
                    <li>10% Waiting Time (Anti-starvation clock)</li>
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-900">
                  <span className="font-bold block mb-1">On Submission:</span>
                  The LLM analyzes your note in real time, extracts acute hazard severity and demographics, and combines them into the audited queue score.
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Triage AI Analyzing Report...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit & Generate Request ID</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* MODE B: Realistic Public Citizen Assurance View (Non-Gameable) */
              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs sticky top-24 space-y-5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Emergency Relief Protocol
                    </h3>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Active Intake
                  </span>
                </div>

                {/* Status Callout Card */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Intake Triage Assessment
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    Automatic Verification & Prioritized Queue
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Once submitted, your field description is processed by our AI triage engine to assess acute hazards and coordinate warehouse stock dispatch.
                  </p>
                </div>

                {/* Reassurance Guarantees */}
                <div className="space-y-2.5 text-xs text-slate-600">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Fairness Guarantee:</strong> Requests are verified against disaster flood polygons and field scout reports to prevent duplicate claims.
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Continuous Anti-Starvation:</strong> Waiting requests automatically increase in dispatch priority the longer they await fulfillment.
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Zero Deficit Loss:</strong> Partial stock deliveries keep remaining unmet demands strictly preserved in the queue.
                    </span>
                  </div>
                </div>

                {/* Judge Mode Hint */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowJudgeDemoMode(true)}
                    className="w-full text-center text-xs text-indigo-600 hover:text-indigo-800 font-semibold p-2 rounded-lg bg-indigo-50/60 hover:bg-indigo-50 transition-colors border border-indigo-100 flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Presenting to Judges? Reveal Algorithmic Inspector</span>
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>AI Triage Processing Report...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Relief Request</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </form>

      {/* 3. Success Modal */}
      <SubmissionSuccessModal
        request={createdRequest}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
